"""
Steg 9: Hitta restauranger med uteservering via Google Places som saknas i OSM.

Soker Google Places API i ett rutnät over Stockholm for att hitta
restauranger/caféer/barer med outdoorSeating=true som inte redan
finns i var data.

Resultat: data/google_discovered_venues.json

Krav: GOOGLE_PLACES_API_KEY i miljovariabel
"""

import json
import math
import os
import time
import urllib.request
import urllib.parse

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
VENUES_FILE = os.path.join(DATA_DIR, "venues.geojson")
OUTPUT_FILE = os.path.join(DATA_DIR, "google_discovered_venues.json")
PROGRESS_FILE = os.path.join(DATA_DIR, "google_discover_progress.json")

API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")

# Stockholm bounding box - grid search
LAT_MIN, LAT_MAX = 59.28, 59.42
LNG_MIN, LNG_MAX = 17.85, 18.20

# Search radius per cell (meters) — 500m gives good coverage with overlap
CELL_RADIUS = 500

# Approximate degrees per meter at Stockholm latitude
M_PER_DEG_LAT = 111320.0
M_PER_DEG_LNG = 111320.0 * math.cos(math.radians(59.33))

SEARCH_URL = "https://places.googleapis.com/v1/places:searchNearby"


def search_nearby(lat: float, lng: float, radius: float = CELL_RADIUS) -> list:
    """Search for restaurants with outdoor seating near a point."""
    body = json.dumps({
        "includedTypes": [
            "restaurant", "cafe", "bar",
        ],
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": radius,
            }
        },
        "maxResultCount": 20,
    }).encode("utf-8")

    req = urllib.request.Request(
        SEARCH_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": API_KEY,
            "X-Goog-FieldMask": (
                "places.id,places.displayName,places.location,"
                "places.outdoorSeating,places.types,"
                "places.formattedAddress,places.primaryType"
            ),
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        return result.get("places", [])
    except Exception as e:
        print(f"    API error: {e}")
        return []


def main():
    print("=== Steg 9: Hitta nya venues via Google Places ===")

    if not API_KEY:
        print("  GOOGLE_PLACES_API_KEY ej satt!")
        print("  Satt miljovariabeln och kor igen:")
        print("    export GOOGLE_PLACES_API_KEY=din-nyckel")
        print("    python 09_discover_google_venues.py")
        return

    # Load existing venues to avoid duplicates
    with open(VENUES_FILE, "r", encoding="utf-8") as f:
        existing = json.load(f)

    existing_coords = set()
    for f in existing["features"]:
        coords = f["geometry"]["coordinates"]
        # Round to ~10m precision for dedup
        key = (round(coords[1], 4), round(coords[0], 4))
        existing_coords.add(key)
    print(f"  {len(existing_coords)} befintliga venues (koordinat-dedup)")

    # Also load previously discovered venues
    discovered = {}
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            discovered = json.load(f)
        print(f"  {len(discovered)} tidigare upptackta")

    # Load progress (which grid cells are done)
    done_cells = set()
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            done_cells = set(json.load(f))
        print(f"  {len(done_cells)} cells redan sokta (aterupptar)")

    # Generate grid
    lat_step = (CELL_RADIUS * 1.5) / M_PER_DEG_LAT  # 1.5x radius for overlap
    lng_step = (CELL_RADIUS * 1.5) / M_PER_DEG_LNG

    grid = []
    lat = LAT_MIN
    while lat <= LAT_MAX:
        lng = LNG_MIN
        while lng <= LNG_MAX:
            grid.append((round(lat, 5), round(lng, 5)))
            lng += lng_step
        lat += lat_step

    print(f"  {len(grid)} rutnatsceller att soka")
    print(f"  {len(grid) - len(done_cells)} aterstar")

    new_found = 0
    duplicates = 0
    api_calls = 0

    for i, (lat, lng) in enumerate(grid):
        cell_key = f"{lat},{lng}"
        if cell_key in done_cells:
            continue

        places = search_nearby(lat, lng)
        api_calls += 1

        for place in places:
            outdoor = place.get("outdoorSeating")
            if outdoor is not True:
                continue  # Only keep confirmed outdoor seating

            loc = place.get("location", {})
            plat = loc.get("latitude", 0)
            plng = loc.get("longitude", 0)
            coord_key = (round(plat, 4), round(plng, 4))

            google_id = place.get("id", "")
            if google_id in discovered:
                continue  # Already discovered

            if coord_key in existing_coords:
                duplicates += 1
                continue  # Already in our data

            name = place.get("displayName", {}).get("text", "")
            primary_type = place.get("primaryType", "restaurant")
            address = place.get("formattedAddress", "")

            # Map Google type to our amenity types
            amenity_map = {
                "restaurant": "restaurant",
                "cafe": "cafe",
                "bar": "bar",
                "coffee_shop": "cafe",
                "pizza_restaurant": "restaurant",
                "sushi_restaurant": "restaurant",
                "thai_restaurant": "restaurant",
                "indian_restaurant": "restaurant",
                "italian_restaurant": "restaurant",
                "chinese_restaurant": "restaurant",
                "japanese_restaurant": "restaurant",
                "mexican_restaurant": "restaurant",
                "hamburger_restaurant": "restaurant",
                "seafood_restaurant": "restaurant",
                "steak_house": "restaurant",
                "brunch_restaurant": "restaurant",
                "breakfast_restaurant": "restaurant",
                "fast_food_restaurant": "fast_food",
                "ice_cream_shop": "ice_cream",
            }
            amenity = amenity_map.get(primary_type, "restaurant")

            discovered[google_id] = {
                "name": name,
                "lat": plat,
                "lng": plng,
                "amenity": amenity,
                "address": address,
                "google_id": google_id,
                "primary_type": primary_type,
                "source": "google_discovered",
            }
            new_found += 1
            safe_name = name.encode("ascii", errors="replace").decode("ascii")
            print(f"    NY: {safe_name} ({plat:.4f}, {plng:.4f}) [{primary_type}]")

        done_cells.add(cell_key)

        # Save progress periodically
        if api_calls % 50 == 0:
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(discovered, f, ensure_ascii=False, indent=2)
            with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
                json.dump(list(done_cells), f)
            remaining = len(grid) - len(done_cells)
            print(f"  [{len(done_cells)}/{len(grid)}] {new_found} nya, {duplicates} dupl, {remaining} kvar")

        # Rate limit
        time.sleep(0.15)

    # Final save
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(discovered, f, ensure_ascii=False, indent=2)
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(list(done_cells), f)

    print(f"\nKlart! {api_calls} API-anrop")
    print(f"  {new_found} nya venues med uteservering")
    print(f"  {duplicates} redan i datan")
    print(f"  {len(discovered)} totalt upptackta")
    print(f"  Sparat till {OUTPUT_FILE}")
    print(f"\nKor sedan:")
    print(f"  python 09b_merge_discovered.py  # Lagg till i venues.geojson")
    print(f"  python 02b_adjust_venue_positions.py")
    print(f"  python 03b_compute_shadows_incremental.py")
    print(f"  python 04_export_frontend.py")


if __name__ == "__main__":
    main()
