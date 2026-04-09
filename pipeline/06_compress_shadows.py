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


def main():
    print("=== Steg 6: Komprimera skuggfiler ===")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Clear old files
    for f in os.listdir(OUTPUT_DIR):
        if f.endswith(".json"):
            os.remove(os.path.join(OUTPUT_DIR, f))

    files = sorted(glob.glob(os.path.join(SHADOW_DIR, "*.json")))
    print(f"  {len(files)} filer att komprimera")

    start = time.time()
    total = 0

    for i, fpath in enumerate(files):
        with open(fpath) as f:
            data = json.load(f)

        for feature in data["features"]:
            geom = shape(feature["geometry"])
            geom = geom.simplify(SIMPLIFY_TOLERANCE, preserve_topology=True)
            if not geom.is_valid:
                geom = make_valid(geom)

            m = mapping(geom)
            if m["type"] == "Polygon":
                m["coordinates"] = [round_coords(ring) for ring in m["coordinates"]]
            elif m["type"] == "MultiPolygon":
                m["coordinates"] = [[round_coords(ring) for ring in poly] for poly in m["coordinates"]]
            feature["geometry"] = m

        outpath = os.path.join(OUTPUT_DIR, os.path.basename(fpath))
        with open(outpath, "w") as f:
            json.dump(data, f, separators=(",", ":"))

        total += os.path.getsize(outpath)

        if (i + 1) % 20 == 0 or i + 1 == len(files):
            print(f"  {i+1}/{len(files)}")

    elapsed = time.time() - start
    print(f"\nKlart! {len(files)} filer, {total/1024/1024:.1f} MB, {elapsed:.0f}s")


if __name__ == "__main__":
    main()
