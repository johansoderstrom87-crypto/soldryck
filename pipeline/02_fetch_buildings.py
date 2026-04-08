"""
Steg 2: Hämta byggnadsdata (polygoner + höjder) från OpenStreetMap.
"""

import json
import requests
from shapely.geometry import shape, Polygon

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

STOCKHOLM_BBOX = "59.30,18.00,59.36,18.12"

QUERY = f"""
[out:json][timeout:120];
(
  way["building"]({STOCKHOLM_BBOX});
  relation["building"]({STOCKHOLM_BBOX});
);
out body geom;
"""

DEFAULT_FLOOR_HEIGHT = 3.0  # meter per våning
DEFAULT_FLOORS = 4  # om ingen data finns


def estimate_height(tags: dict) -> float:
    """Estimera byggnadshöjd från OSM-taggar."""
    if "height" in tags:
        try:
            return float(tags["height"].replace("m", "").strip())
        except ValueError:
            pass

    if "building:levels" in tags:
        try:
            return float(tags["building:levels"]) * DEFAULT_FLOOR_HEIGHT
        except ValueError:
            pass

    return DEFAULT_FLOORS * DEFAULT_FLOOR_HEIGHT


def fetch_buildings():
    print("Hämtar byggnadsdata från OpenStreetMap...")
    response = requests.post(OVERPASS_URL, data={"data": QUERY})
    response.raise_for_status()
    data = response.json()

    buildings = []
    for element in data.get("elements", []):
        if element["type"] != "way" or "geometry" not in element:
            continue

        tags = element.get("tags", {})
        height = estimate_height(tags)

        # Build polygon from geometry nodes
        coords = [(node["lon"], node["lat"]) for node in element["geometry"]]
        if len(coords) < 3:
            continue

        buildings.append(
            {
                "id": element["id"],
                "height": height,
                "polygon": coords,
            }
        )

    print(f"Hittade {len(buildings)} byggnader med geometri.")

    with open("data/buildings.json", "w", encoding="utf-8") as f:
        json.dump(buildings, f, indent=2)

    print("Sparat till data/buildings.json")
    return buildings


if __name__ == "__main__":
    import os

    os.makedirs("data", exist_ok=True)
    fetch_buildings()
