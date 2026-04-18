"""
Steg 3b: Inkrementell skuggberäkning för nya venues.

Läser venues.geojson och shadow_results.json, hittar venues som
saknar skuggdata, och beräknar bara dessa. Resultat mergas in.
"""

import json
import os
import time
from datetime import datetime, timezone, timedelta

import geopandas as gpd
import numpy as np
from shapely.geometry import Point, box
from pysolar.solar import get_altitude, get_azimuth

# Reuse constants and functions from main compute script
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
VENUES_FILE = os.path.join(DATA_DIR, "venues.geojson")
BUILDINGS_FILE = os.path.join(DATA_DIR, "buildings.gpkg")
OUTPUT_FILE = os.path.join(DATA_DIR, "shadow_results.json")

SEARCH_RADIUS = 0.004  # ~400m in degrees
M_PER_DEG_LAT = 111_320

MONTHS = list(range(4, 11))  # April-October
DATES = []
for m in MONTHS:
    DATES.append((m, 1))
    DATES.append((m, 15))

HOURS = list(range(7, 23))  # 07:00-22:00
STOCKHOLM_TZ = timedelta(hours=2)  # CEST


def precompute_sun_positions(lat, lng):
    positions = {}
    for month, day in DATES:
        date_key = f"{month:02d}-{day:02d}"
        positions[date_key] = {}
        for hour in HOURS:
            dt = datetime(2025, month, day, hour, 0, 0, tzinfo=timezone(STOCKHOLM_TZ))
            alt = get_altitude(lat, lng, dt)
            az = get_azimuth(lat, lng, dt)
            positions[date_key][hour] = (alt, az)
    return positions


def project_building_shadow(building_geom, height, ground_elev, sun_azimuth, sun_altitude):
    from shapely.geometry import Polygon, MultiPolygon
    from shapely.ops import unary_union

    if sun_altitude <= 0 or height <= 0:
        return None

    shadow_length = min(height / max(np.tan(np.radians(sun_altitude)), 0.001), 500)
    shadow_dx = -shadow_length * np.sin(np.radians(sun_azimuth)) / M_PER_DEG_LAT
    shadow_dy = -shadow_length * np.cos(np.radians(sun_azimuth)) / M_PER_DEG_LAT

    try:
        if building_geom.geom_type == "Polygon":
            polys = [building_geom]
        elif building_geom.geom_type == "MultiPolygon":
            polys = list(building_geom.geoms)
        else:
            return None

        shadows = []
        for poly in polys:
            coords = list(poly.exterior.coords)
            shifted = [(x + shadow_dx, y + shadow_dy) for x, y in coords]
            all_pts = coords + shifted
            shadow = Polygon(all_pts).convex_hull
            if shadow.is_valid and shadow.area > 0:
                shadows.append(shadow)

        return unary_union(shadows) if shadows else None
    except Exception:
        return None


def main():
    print("=== Steg 3b: Inkrementell skuggberäkning ===")

    # Load existing results
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            results = json.load(f)
        print(f"  {len(results)} befintliga venues med skuggdata")
    else:
        results = {}

    # Load venues
    venues_gdf = gpd.read_file(VENUES_FILE)
    print(f"  {len(venues_gdf)} venues totalt")

    # Find venues without shadow data
    new_venues = []
    for i in range(len(venues_gdf)):
        v = venues_gdf.iloc[i]
        if str(v["id"]) not in results:
            new_venues.append(i)

    if not new_venues:
        print("  Alla venues har redan skuggdata!")
        return

    print(f"  {len(new_venues)} nya venues att beräkna")

    # Load buildings
    print("Laddar byggnader...")
    buildings_gdf = gpd.read_file(BUILDINGS_FILE)
    buildings_sindex = buildings_gdf.sindex
    print(f"  {len(buildings_gdf)} byggnader")

    sun_positions = precompute_sun_positions(59.33, 18.07)
    start_time = time.time()

    for idx, vi in enumerate(new_venues):
        venue = venues_gdf.iloc[vi]
        venue_id = str(venue["id"])
        venue_point = venue.geometry
        venue_lng, venue_lat = venue_point.x, venue_point.y

        search_box = box(
            venue_lng - SEARCH_RADIUS,
            venue_lat - SEARCH_RADIUS,
            venue_lng + SEARCH_RADIUS,
            venue_lat + SEARCH_RADIUS,
        )
        candidate_idxs = list(buildings_sindex.intersection(search_box.bounds))
        nearby_buildings = buildings_gdf.iloc[candidate_idxs]

        nearby_list = []
        for _, row in nearby_buildings.iterrows():
            dist_m = row.geometry.distance(venue_point) * M_PER_DEG_LAT
            if dist_m < 0.5:
                continue
            nearby_list.append((row.geometry, row["BYGG_H"], row.get("MARK_Z", 0)))

        venue_ground_z = 0
        for _, row in nearby_buildings.iterrows():
            if row.geometry.distance(venue_point) * M_PER_DEG_LAT < 5:
                venue_ground_z = row.get("MARK_Z", 0)
                break

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

                in_shadow = False
                for bgeom, bheight, bground in nearby_list:
                    effective_height = bheight + max(0, bground - venue_ground_z) - venue_elevation
                    if effective_height <= 0:
                        continue
                    shadow_poly = project_building_shadow(
                        bgeom, effective_height, 0, sun_az, sun_alt,
                    )
                    if shadow_poly and shadow_poly.contains(venue_point):
                        in_shadow = True
                        break

                results[venue_id]["schedule"][date_key][str(hour)] = "shade" if in_shadow else "sun"

        elapsed = time.time() - start_time
        print(f"  {idx + 1}/{len(new_venues)}: {venue.get('name', '?')} ({elapsed:.0f}s)")

    # Save
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\nKlart! {len(new_venues)} nya venues beräknade, {len(results)} totalt")


if __name__ == "__main__":
    main()
