"""
Steg 1b: Filtrera bort isolerade uteserveringar.

Ta bort venues som ligger ensamma langre ut fran stan — de saknar ofta
byggnadsdata och ser konstiga ut med 100% sol.

Regel: En venue behovs ha minst 2 andra venues inom 2km for att behaltas.
"""

import os
import json
import math

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
VENUES_FILE = os.path.join(DATA_DIR, "venues.geojson")
OUTPUT_FILE = os.path.join(DATA_DIR, "venues.geojson")  # Overwrite

MIN_NEIGHBORS = 2
RADIUS_KM = 2.0


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def main():
    print("=== Steg 1b: Filtrera isolerade venues ===")

    with open(VENUES_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    features = data["features"]
    print(f"  {len(features)} venues innan filtrering")

    # Extract coordinates
    coords = []
    for feat in features:
        lng, lat = feat["geometry"]["coordinates"]
        coords.append((lat, lng))

    # Filter
    keep = []
    removed = []
    for i, feat in enumerate(features):
        lat1, lng1 = coords[i]
        neighbors = 0
        for j, (lat2, lng2) in enumerate(coords):
            if i == j:
                continue
            if haversine_km(lat1, lng1, lat2, lng2) <= RADIUS_KM:
                neighbors += 1
                if neighbors >= MIN_NEIGHBORS:
                    break

        if neighbors >= MIN_NEIGHBORS:
            keep.append(feat)
        else:
            name = feat["properties"].get("name", "?")
            removed.append(name)

    print(f"  {len(keep)} venues behalles")
    print(f"  {len(removed)} venues borttagna (isolerade):")
    for name in removed[:20]:
        print(f"    - {name}")
    if len(removed) > 20:
        print(f"    ... och {len(removed)-20} till")

    data["features"] = keep
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  Sparat till {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
