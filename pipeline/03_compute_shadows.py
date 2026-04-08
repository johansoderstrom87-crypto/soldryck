"""
Steg 3: Beräkna skuggstatus för varje uteservering, timme för timme.

Logik:
1. För varje uteservering och tidpunkt, räkna ut solens position (azimut, elevation)
2. Beräkna skuggans riktning och längd från varje närliggande byggnad
3. Kolla om serveringspunkten hamnar i skugga

Datum: 1:a och 15:e varje månad, mars-november
Timmar: 08:00 - 22:00
"""

import json
import math
from datetime import datetime, timezone, timedelta
import numpy as np
from pysolar.solar import get_altitude, get_azimuth
from shapely.geometry import Point, Polygon, LineString

# Stockholm timezone offset (CEST = UTC+2, CET = UTC+1)
# Vi förenklar med UTC+2 (sommartid) för mars-nov
TZ_OFFSET = timedelta(hours=2)

# Sökradie runt varje servering (meter) — byggnader längre bort kan inte skugga
SEARCH_RADIUS_DEG = 0.002  # ~200 meter i Stockholm

# Datum att beräkna
DATES = []
for month in range(3, 12):  # Mars - November
    for day in [1, 15]:
        DATES.append((2025, month, day))

HOURS = list(range(8, 23))  # 08:00 - 22:00


def deg_to_meters(dlat: float, dlng: float, ref_lat: float) -> tuple[float, float]:
    """Konvertera grader till ungefärliga meter."""
    m_per_deg_lat = 111320
    m_per_deg_lng = 111320 * math.cos(math.radians(ref_lat))
    return dlat * m_per_deg_lat, dlng * m_per_deg_lng


def is_in_shadow(
    venue_lat: float,
    venue_lng: float,
    buildings: list[dict],
    sun_altitude: float,
    sun_azimuth: float,
) -> str:
    """
    Kolla om en punkt skuggas av någon byggnad.
    Returnerar 'sun', 'partial' eller 'shade'.
    """
    if sun_altitude <= 0:
        return "shade"  # Solen under horisonten

    if sun_altitude < 5:
        return "shade"  # Solen för låg, generellt skuggigt

    venue_point = Point(venue_lng, venue_lat)

    # Skuggriktning = motsatt solens azimut
    shadow_dir_rad = math.radians(sun_azimuth)
    # Enhetsvektorn i skuggans riktning (lng, lat-komponent)
    dx = math.sin(shadow_dir_rad)
    dy = math.cos(shadow_dir_rad)

    shadow_count = 0

    for building in buildings:
        poly_coords = building["polygon"]
        height = building["height"]

        building_poly = Polygon(poly_coords)
        if not building_poly.is_valid:
            continue

        # Skippa om byggnaden är för långt bort
        centroid = building_poly.centroid
        dist_deg = math.sqrt(
            (venue_lat - centroid.y) ** 2 + (venue_lng - centroid.x) ** 2
        )
        if dist_deg > SEARCH_RADIUS_DEG:
            continue

        # Beräkna skugglängd (i meter)
        shadow_length = height / math.tan(math.radians(sun_altitude))

        # Konvertera till grader
        m_per_deg_lat = 111320
        m_per_deg_lng = 111320 * math.cos(math.radians(venue_lat))

        shadow_length_lat = shadow_length / m_per_deg_lat
        shadow_length_lng = shadow_length / m_per_deg_lng

        # Projicera varje hörn av byggnaden + skugga
        shadow_points = []
        for lng, lat in poly_coords:
            shadow_lng = lng + dx * shadow_length_lng
            shadow_lat = lat - dy * shadow_length_lat  # Minus för att norr = positiv lat
            shadow_points.append((shadow_lng, shadow_lat))

        # Skuggpolygon = byggnad + projicerade punkter
        all_points = list(poly_coords) + shadow_points
        try:
            shadow_poly = Polygon(all_points).convex_hull
            if shadow_poly.contains(venue_point):
                shadow_count += 1
        except Exception:
            continue

    if shadow_count >= 2:
        return "shade"
    elif shadow_count == 1:
        return "partial"
    else:
        return "sun"


def compute_all():
    print("Laddar data...")
    with open("data/venues.json", "r", encoding="utf-8") as f:
        venues = json.load(f)

    with open("data/buildings.json", "r", encoding="utf-8") as f:
        buildings = json.load(f)

    print(f"Beräknar skuggor för {len(venues)} serveringar...")
    print(f"Datum: {len(DATES)} dagar, Timmar: {len(HOURS)} per dag")
    print(f"Totalt: {len(venues) * len(DATES) * len(HOURS)} beräkningar")

    results = {}

    for i, venue in enumerate(venues):
        venue_id = venue["id"]
        results[venue_id] = {
            "name": venue["name"],
            "lat": venue["lat"],
            "lng": venue["lng"],
            "type": venue["type"],
            "schedule": {},
        }

        # Hitta närliggande byggnader (för prestanda)
        nearby = [
            b
            for b in buildings
            if abs(Polygon(b["polygon"]).centroid.y - venue["lat"]) < SEARCH_RADIUS_DEG
            and abs(Polygon(b["polygon"]).centroid.x - venue["lng"])
            < SEARCH_RADIUS_DEG
        ]

        for year, month, day in DATES:
            date_key = f"{month:02d}-{day:02d}"
            results[venue_id]["schedule"][date_key] = {}

            for hour in HOURS:
                dt = datetime(year, month, day, hour, 0, 0, tzinfo=timezone.utc) - TZ_OFFSET

                altitude = get_altitude(venue["lat"], venue["lng"], dt)
                azimuth = get_azimuth(venue["lat"], venue["lng"], dt)

                status = is_in_shadow(
                    venue["lat"], venue["lng"], nearby, altitude, azimuth
                )
                results[venue_id]["schedule"][date_key][hour] = status

        if (i + 1) % 10 == 0:
            print(f"  {i + 1}/{len(venues)} klara...")

    with open("data/shadow_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print("Klart! Resultat sparade i data/shadow_results.json")


if __name__ == "__main__":
    compute_all()
