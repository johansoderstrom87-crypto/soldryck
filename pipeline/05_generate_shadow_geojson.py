"""
Steg 5: Generera skuggpolygoner som GeoJSON-filer for kartoverlay.

For varje tidpunkt (datum + timme):
1. Projicera alla byggnaders skuggor
2. Union alla skuggpolygoner till en enda geometri
3. Forenkla (simplify) for att minska filstorlek
4. Spara som GeoJSON

Resultat: data/shadows/{MM-DD}_{HH}.json (en fil per tidpunkt)
Bara tidpunkter med sol (elevation > 3 grader) genereras.
"""

import json
import math
import os
import time
from datetime import datetime, timezone, timedelta
from multiprocessing import Pool as ProcessPool, cpu_count

import geopandas as gpd
import numpy as np
from shapely.geometry import mapping, MultiPolygon, Polygon
from shapely.ops import unary_union
from pysolar.solar import get_altitude, get_azimuth

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
BUILDINGS_FILE = os.path.join(DATA_DIR, "buildings.gpkg")
OUTPUT_DIR = os.path.join(DATA_DIR, "shadows")

# Same dates/hours as 03_compute_shadows.py
DATES = []
for month in range(4, 11):
    for day in [1, 15]:
        DATES.append((2025, month, day))

HOURS = list(range(7, 23))

M_PER_DEG_LAT = 111320.0
M_PER_DEG_LNG = 111320.0 * math.cos(math.radians(59.33))

# Simplification tolerance in degrees (~5m)
SIMPLIFY_TOLERANCE = 0.00005


def get_utc_offset(month: int) -> timedelta:
    if 4 <= month <= 10:
        return timedelta(hours=2)
    return timedelta(hours=1)


def project_shadow(geom, height: float, sun_az: float, sun_alt: float):
    """Project a single building's shadow polygon."""
    if sun_alt <= 2 or height <= 0:
        return None

    shadow_length_m = min(height / math.tan(math.radians(sun_alt)), 500)
    az_rad = math.radians(sun_az)
    dx = -(math.sin(az_rad) * shadow_length_m / M_PER_DEG_LNG)
    dy = -(math.cos(az_rad) * shadow_length_m / M_PER_DEG_LAT)

    polys = list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]
    parts = []
    for poly in polys:
        if not poly.is_valid or poly.is_empty:
            continue
        try:
            coords = list(poly.exterior.coords)
            shadow_coords = [(x + dx, y + dy) for x, y in coords]
            combined = unary_union([Polygon(coords), Polygon(shadow_coords)]).convex_hull
            if combined.is_valid and not combined.is_empty:
                parts.append(combined)
        except Exception:
            continue

    if not parts:
        return None
    try:
        return unary_union(parts)
    except Exception:
        return parts[0]


def process_timepoint(args):
    """Process a single timepoint: project all buildings, union, simplify."""
    date_key, hour, sun_alt, sun_az, buildings_data = args

    if sun_alt <= 3:
        return None

    shadows = []
    for geom_wkb, height in buildings_data:
        from shapely import wkb
        geom = wkb.loads(geom_wkb)
        shadow = project_shadow(geom, height, sun_az, sun_alt)
        if shadow:
            shadows.append(shadow)

    if not shadows:
        return None

    # Batch union in chunks for performance
    chunk_size = 500
    while len(shadows) > 1:
        chunks = [shadows[i:i+chunk_size] for i in range(0, len(shadows), chunk_size)]
        shadows = []
        for chunk in chunks:
            try:
                merged = unary_union(chunk)
                if merged.is_valid and not merged.is_empty:
                    shadows.append(merged)
            except Exception:
                shadows.extend(chunk)

    if not shadows:
        return None

    combined = shadows[0]

    # Simplify to reduce file size
    combined = combined.simplify(SIMPLIFY_TOLERANCE, preserve_topology=True)

    # Buffer(0) to fix any topology issues
    if not combined.is_valid:
        combined = combined.buffer(0)

    geojson = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {"date": date_key, "hour": hour},
            "geometry": mapping(combined),
        }],
    }

    filename = f"{date_key}_{hour:02d}.json"
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, "w") as f:
        json.dump(geojson, f)

    # Report file size
    size_kb = os.path.getsize(filepath) / 1024
    return f"  {filename}: {size_kb:.0f} KB"


def main():
    print("=== Steg 5: Generera skugg-GeoJSON ===")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("Laddar byggnader...")
    buildings_gdf = gpd.read_file(BUILDINGS_FILE)
    print(f"  {len(buildings_gdf)} byggnader")

    # Pre-serialize building geometries + heights
    print("Forbereder byggnadsdata...")
    from shapely import wkb
    buildings_data = []
    for _, row in buildings_gdf.iterrows():
        h = row.get("BYGG_H", 10)
        mark_z = row.get("MARK_Z", 0)
        # Use full height including terrain
        effective_h = h + max(0, mark_z)
        if effective_h > 0:
            buildings_data.append((row.geometry.wkb, effective_h))
    print(f"  {len(buildings_data)} byggnader med hojd")

    # Precompute sun positions
    print("Beraknar solpositioner...")
    tasks = []
    for year, month, day in DATES:
        date_key = f"{month:02d}-{day:02d}"
        utc_offset = get_utc_offset(month)
        for hour in HOURS:
            utc_dt = datetime(year, month, day, hour, 0, 0, tzinfo=timezone.utc) - utc_offset
            alt = get_altitude(59.33, 18.07, utc_dt)
            az = get_azimuth(59.33, 18.07, utc_dt)
            if alt > 3:
                tasks.append((date_key, hour, alt, az, buildings_data))

    print(f"  {len(tasks)} tidpunkter med sol (av {len(DATES)*len(HOURS)} totalt)")

    start = time.time()
    print(f"\nGenererar skuggpolygoner (sekventiellt)...")

    results = []
    for i, task in enumerate(tasks):
        result = process_timepoint(task)
        if result:
            results.append(result)
        if (i + 1) % 10 == 0 or i + 1 == len(tasks):
            elapsed = time.time() - start
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            remaining = (len(tasks) - i - 1) / rate if rate > 0 else 0
            print(f"  {i+1}/{len(tasks)} ({elapsed:.0f}s, ~{remaining:.0f}s kvar)")

    elapsed = time.time() - start
    print(f"\nKlart! {len(results)} filer genererade pa {elapsed:.1f}s")

    # Summary
    total_size = sum(
        os.path.getsize(os.path.join(OUTPUT_DIR, f))
        for f in os.listdir(OUTPUT_DIR)
        if f.endswith(".json")
    )
    print(f"Total storlek: {total_size/1024/1024:.1f} MB")

    for r in results:
        print(r)


if __name__ == "__main__":
    main()
