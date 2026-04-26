"""
Steg 6: Komprimera skuggfiler for deploy.

Laser pipeline/data/shadows/*.json, forenklar med lagre tolerans,
rundar koordinater, och sparar kompakt till shadow-data/.
"""

import json
import os
import glob
import time

from shapely.geometry import shape, mapping
from shapely.validation import make_valid

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
SHADOW_DIR = os.path.join(DATA_DIR, "shadows")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "shadow-data")

# ~10m tolerance — keeps building shapes recognizable
SIMPLIFY_TOLERANCE = 0.0001
COORD_PRECISION = 5  # 5 decimals ~ 1m


def round_coords(coords):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], COORD_PRECISION), round(coords[1], COORD_PRECISION)]
    return [round_coords(c) for c in coords]


def process_file(fpath, outpath):
    with open(fpath) as f:
        data = json.load(f)

    for feature in data["features"]:
        geom = shape(feature["geometry"])
        # buffer(0) is more stable than make_valid() for huge MultiPolygons
        if not geom.is_valid:
            geom = geom.buffer(0)
        try:
            geom = geom.simplify(SIMPLIFY_TOLERANCE, preserve_topology=True)
        except Exception as e:
            print(f"    simplify failed ({e}), fallback to non-topology")
            geom = geom.simplify(SIMPLIFY_TOLERANCE, preserve_topology=False)
        if not geom.is_valid:
            geom = geom.buffer(0)

        m = mapping(geom)
        if m["type"] == "Polygon":
            m["coordinates"] = [round_coords(ring) for ring in m["coordinates"]]
        elif m["type"] == "MultiPolygon":
            m["coordinates"] = [[round_coords(ring) for ring in poly] for poly in m["coordinates"]]
        feature["geometry"] = m

    with open(outpath, "w") as f:
        json.dump(data, f, separators=(",", ":"))

    return os.path.getsize(outpath)


def main():
    print("=== Steg 6: Komprimera skuggfiler ===", flush=True)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Clear old files
    for f in os.listdir(OUTPUT_DIR):
        if f.endswith(".json"):
            os.remove(os.path.join(OUTPUT_DIR, f))

    files = sorted(glob.glob(os.path.join(SHADOW_DIR, "*.json")))
    print(f"  {len(files)} filer att komprimera", flush=True)

    start = time.time()
    total = 0
    failed = []

    for i, fpath in enumerate(files):
        name = os.path.basename(fpath)
        outpath = os.path.join(OUTPUT_DIR, name)
        try:
            size = process_file(fpath, outpath)
            total += size
            if (i + 1) % 5 == 0 or i + 1 == len(files):
                elapsed = time.time() - start
                print(f"  {i+1}/{len(files)} ({name}, {elapsed:.0f}s)", flush=True)
        except Exception as e:
            print(f"  FEL pa {name}: {e}", flush=True)
            failed.append(name)

    elapsed = time.time() - start
    print(f"\nKlart! {len(files)-len(failed)}/{len(files)} filer, {total/1024/1024:.1f} MB, {elapsed:.0f}s")
    if failed:
        print(f"Misslyckade: {failed}")


if __name__ == "__main__":
    main()
