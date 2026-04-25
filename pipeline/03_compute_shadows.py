"""
Steg 3: Beräkna skuggstatus för varje uteservering.

Logik:
1. För varje uteservering och tidpunkt → solens position (azimut, elevation)
2. Projicera skuggpolygoner från närliggande byggnader
3. Kolla om serveringspunkten hamnar i skuggpolygon

Datum: 1:a och 15:e varje månad, april-oktober (14 datapunkter)
Timmar: 07:00-22:00 (16 timmar per dag)
Totalt: venues × 14 × 16 beräkningar

Resultat: data/shadow_results.json
"""

import json
import math
import os
import time
from datetime import datetime, timezone, timedelta
from collections import defaultdict

import geopandas as gpd
import pandas as pd
import numpy as np
from shapely.geometry import Point, Polygon, MultiPolygon, box
from shapely.ops import unary_union
from pysolar.solar import get_altitude, get_azimuth

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
VENUES_FILE = os.path.join(DATA_DIR, "venues.geojson")
BUILDINGS_FILE = os.path.join(DATA_DIR, "buildings.gpkg")
BUILDINGS_OVERTURE_FILE = os.path.join(DATA_DIR, "buildings_overture.gpkg")
DEM_FILE = os.path.join(DATA_DIR, "dem_stockholm.tif")
OUTPUT_FILE = os.path.join(DATA_DIR, "shadow_results.json")

# Tidszon: Sverige sommartid (CEST = UTC+2)
# Vi hanterar CET/CEST mer exakt per datum
def get_utc_offset(month: int) -> timedelta:
    """Returnera UTC-offset för Sverige baserat på månad."""
    # Sommartid (CEST): sista söndagen i mars → sista söndagen i oktober
    # Förenkling: april-oktober = UTC+2, annars UTC+1
    if 4 <= month <= 10:
        return timedelta(hours=2)
    return timedelta(hours=1)


# Datum att beräkna
DATES = []
for month in range(4, 11):  # April-Oktober
    for day in [1, 15]:
        DATES.append((2025, month, day))

HOURS = list(range(7, 23))  # 07:00-22:00

# Sökradie runt varje servering (grader ≈ ~300m)
SEARCH_RADIUS = 0.003

# Meter per grad i Stockholm (lat ≈ 59.33)
M_PER_DEG_LAT = 111320.0
M_PER_DEG_LNG = 111320.0 * math.cos(math.radians(59.33))


def project_building_shadow(
    building_geom, building_height: float, ground_elevation: float,
    sun_azimuth: float, sun_altitude: float
) -> Polygon | None:
    """
    Projicera en byggnads skuggpolygon givet solens position.

    Skugglängd = höjd / tan(solhöjd)
    Skuggriktning = solens azimut + 180° (skuggan faller bort från solen)
    """
    if sun_altitude <= 2:
        return None  # Sol under horisonten eller för låg

    # Skugglängd i meter
    shadow_length_m = building_height / math.tan(math.radians(sun_altitude))

    # Begränsa till rimligt avstånd (en 30m byggnad vid 5° solhöjd → 343m skugga)
    shadow_length_m = min(shadow_length_m, 500)

    # Skuggans riktning (solen lyser från azimut, skuggan faller åt motsatt håll)
    shadow_azimuth_rad = math.radians(sun_azimuth)

    # Offset i grader (skuggan pekar BORT från solen)
    dx_deg = math.sin(shadow_azimuth_rad) * shadow_length_m / M_PER_DEG_LNG
    dy_deg = math.cos(shadow_azimuth_rad) * shadow_length_m / M_PER_DEG_LAT
    # Skuggan faller bort, så vi vänder riktningen
    dx_deg = -dx_deg
    dy_deg = -dy_deg

    # Hantera MultiPolygon
    if isinstance(building_geom, MultiPolygon):
        polys = list(building_geom.geoms)
    else:
        polys = [building_geom]

    shadow_parts = []
    for poly in polys:
        if not poly.is_valid or poly.is_empty:
            continue

        # Projicera varje punkt i polygonen längs skuggriktningen
        exterior_coords = list(poly.exterior.coords)
        shadow_coords = [(x + dx_deg, y + dy_deg) for x, y in exterior_coords]

        # Skuggpolygon = union av original + projicerad polygon
        try:
            original = Polygon(exterior_coords)
            shadow_poly = Polygon(shadow_coords)
            combined = unary_union([original, shadow_poly]).convex_hull
            if combined.is_valid and not combined.is_empty:
                shadow_parts.append(combined)
        except Exception:
            continue

    if not shadow_parts:
        return None

    try:
        return unary_union(shadow_parts)
    except Exception:
        return shadow_parts[0] if shadow_parts else None


def precompute_sun_positions(ref_lat: float, ref_lng: float) -> dict:
    """Förberäkna solpositioner — samma för hela Stockholm (variation <0.01°)."""
    print("Förberäknar solpositioner...")
    positions = {}
    for year, month, day in DATES:
        date_key = f"{month:02d}-{day:02d}"
        utc_offset = get_utc_offset(month)
        positions[date_key] = {}
        for hour in HOURS:
            utc_dt = datetime(year, month, day, hour, 0, 0, tzinfo=timezone.utc) - utc_offset
            alt = get_altitude(ref_lat, ref_lng, utc_dt)
            az = get_azimuth(ref_lat, ref_lng, utc_dt)
            positions[date_key][hour] = (alt, az)
    print(f"  {len(DATES)} datum × {len(HOURS)} timmar = {len(DATES)*len(HOURS)} positioner")
    return positions


def load_dem_sampler():
    """
    Ladda DEM och returnera en funktion som ger markhöjd (meter) för (lng, lat).
    Returnerar None om DEM-filen saknas — fallback till MARK_Z används då.
    """
    if not os.path.exists(DEM_FILE):
        print(f"  OBS: {DEM_FILE} saknas — kör 02c_load_dem.py för bättre terrängdata")
        print("  Faller tillbaka på MARK_Z från byggnadsdata")
        return None

    try:
        import rasterio
        src = rasterio.open(DEM_FILE)
        data = src.read(1).astype(float)
        nodata = src.nodata
        if nodata is not None:
            data[data == nodata] = 0.0
        transform = src.transform
        src.close()

        def sampler(lng: float, lat: float) -> float:
            col = int((lng - transform.c) / transform.a)
            row = int((lat - transform.f) / transform.e)
            h, w = data.shape
            if 0 <= row < h and 0 <= col < w:
                return float(data[row, col])
            return 0.0

        print(f"  DEM laddad: {DEM_FILE}")
        return sampler
    except Exception as e:
        print(f"  Kunde inte ladda DEM: {e} — faller tillbaka på MARK_Z")
        return None


def compute_shadows():
    print("=== Steg 3: Beräkna skuggor ===")

    # Ladda data
    print("Laddar uteserveringar...")
    venues_gdf = gpd.read_file(VENUES_FILE)
    print(f"  {len(venues_gdf)} uteserveringar")

    print("Laddar byggnader...")
    if os.path.exists(BUILDINGS_OVERTURE_FILE):
        buildings_gdf = gpd.read_file(BUILDINGS_OVERTURE_FILE)
        height_col = "height"
        print(f"  {len(buildings_gdf)} byggnads-objekt (Overture + LOD1-fallback)")
    else:
        buildings_gdf = gpd.read_file(BUILDINGS_FILE)
        height_col = "BYGG_H"
        print(f"  {len(buildings_gdf)} byggnader (LOD1)")
        print("  Tips: kör 02d_load_overture_buildings.py för mer detaljerade skuggor")

    # Ladda höjdmodell
    print("Laddar höjdmodell (DEM)...")
    dem_sample = load_dem_sampler()

    # Förberäkna markhöjd per byggnad (en gång, inte per venue)
    if dem_sample:
        print("  Förberäknar byggnadsmarkhöjder från DEM...")
        building_ground_z = np.array([
            dem_sample(row.geometry.centroid.x, row.geometry.centroid.y)
            for _, row in buildings_gdf.iterrows()
        ])
    else:
        mark_z = buildings_gdf["MARK_Z"].fillna(0) if "MARK_Z" in buildings_gdf.columns else pd.Series(0, index=buildings_gdf.index)
        building_ground_z = mark_z.values

    # Bygg spatial index
    print("Bygger rumsligt index...")
    buildings_sindex = buildings_gdf.sindex

    # Förberäkna solpositioner (alla venues i Stockholm har i princip samma sol)
    sun_positions = precompute_sun_positions(59.33, 18.07)

    total_venues = len(venues_gdf)
    total_calcs = total_venues * len(DATES) * len(HOURS)
    print(f"\nBeräknar {total_calcs:,} sol/skugga-värden...")

    results = {}
    start_time = time.time()

    for vi in range(total_venues):
        venue = venues_gdf.iloc[vi]
        venue_id = venue["id"]
        venue_point = venue.geometry
        venue_lng, venue_lat = venue_point.x, venue_point.y

        # Hitta närliggande byggnader
        search_box = box(
            venue_lng - SEARCH_RADIUS,
            venue_lat - SEARCH_RADIUS,
            venue_lng + SEARCH_RADIUS,
            venue_lat + SEARCH_RADIUS,
        )
        candidate_idxs = list(buildings_sindex.intersection(search_box.bounds))

        # Venue markhöjd — DEM om tillgänglig, annars närmaste byggnads MARK_Z
        if dem_sample:
            venue_ground_z = dem_sample(venue_lng, venue_lat)
        else:
            venue_ground_z = 0
            for idx in candidate_idxs:
                row = buildings_gdf.iloc[idx]
                if row.geometry.distance(venue_point) * M_PER_DEG_LAT < 5:
                    venue_ground_z = row.get("MARK_Z", 0) or 0
                    break

        # Förbered byggnadsdata — exkludera byggnader som venue-punkten
        # ligger väldigt nära (< 0.5m), dvs den egna byggnaden
        nearby_list = []
        for idx in candidate_idxs:
            row = buildings_gdf.iloc[idx]
            dist_m = row.geometry.distance(venue_point) * M_PER_DEG_LAT
            if dist_m < 0.5:
                continue
            bground = building_ground_z[idx]
            nearby_list.append((row.geometry, row[height_col], bground))

        # Venue elevation (rooftop terraces etc.)
        venue_elevation = venue.get("venue_elevation_m", 0) or 0

        results[venue_id] = {
            "name": venue.get("name", "Okänd"),
            "lat": venue_lat,
            "lng": venue_lng,
            "type": venue.get("amenity", "restaurant"),
            "address": f"{venue.get('addr_street', '')} {venue.get('addr_housenumber', '')}".strip(),
            "schedule": {},
        }

        for date_key, hours_data in sun_positions.items():
            results[venue_id]["schedule"][date_key] = {}

            for hour, (sun_alt, sun_az) in hours_data.items():
                if sun_alt <= 0:
                    results[venue_id]["schedule"][date_key][str(hour)] = "night"
                    continue

                if sun_alt < 3:
                    results[venue_id]["schedule"][date_key][str(hour)] = "shade"
                    continue

                # Kolla skugga från närliggande byggnader
                in_shadow = False
                for bgeom, bheight, bground in nearby_list:
                    # Effektiv höjd = byggnadshöjd + (byggnadens markhöjd - venuens markhöjd) - venue elevation
                    # A rooftop at 40m is not shadowed by a 30m building
                    effective_height = bheight + max(0, bground - venue_ground_z) - venue_elevation
                    if effective_height <= 0:
                        continue  # Building is shorter than venue elevation
                    shadow_poly = project_building_shadow(
                        bgeom, effective_height, 0, sun_az, sun_alt,
                    )
                    if shadow_poly and shadow_poly.contains(venue_point):
                        in_shadow = True
                        break

                results[venue_id]["schedule"][date_key][str(hour)] = "shade" if in_shadow else "sun"

        # Progress
        if (vi + 1) % 50 == 0 or vi + 1 == total_venues:
            elapsed = time.time() - start_time
            rate = (vi + 1) / elapsed
            remaining = (total_venues - vi - 1) / rate if rate > 0 else 0
            print(f"  {vi + 1}/{total_venues} platser ({elapsed:.0f}s, ~{remaining:.0f}s kvar)")

    # Spara
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    elapsed = time.time() - start_time
    print(f"\nKlart! {len(results)} platser beräknade på {elapsed:.1f}s")
    print(f"Sparat till {OUTPUT_FILE}")

    # Statistik
    sun_counts = defaultdict(int)
    total_points = 0
    for venue_data in results.values():
        for date_data in venue_data["schedule"].values():
            for status in date_data.values():
                sun_counts[status] += 1
                total_points += 1

    print(f"\nStatistik ({total_points:,} datapunkter):")
    for status, count in sorted(sun_counts.items()):
        pct = count / total_points * 100
        print(f"  {status}: {count:,} ({pct:.1f}%)")


if __name__ == "__main__":
    compute_shadows()
