"""
Steg 9b: Slå ihop Google-upptäckta venues med huvudlistan.

Tar venues från google_discovered_venues.json och lägger till dem
i venues.geojson med source='google_discovered'.

Kör efter 09_discover_google_venues.py.
"""

import json
import math
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DISCOVERED_FILE = os.path.join(DATA_DIR, "google_discovered_venues.json")
VENUES_FILE = os.path.join(DATA_DIR, "venues.geojson")

# Minimum distance (meters) to consider as duplicate
DEDUP_DISTANCE_M = 30
M_PER_DEG_LAT = 111320.0
M_PER_DEG_LNG = 111320.0 * math.cos(math.radians(59.33))


def haversine_approx(lat1, lng1, lat2, lng2):
    """Approximate distance in meters between two points."""
    dlat = (lat2 - lat1) * M_PER_DEG_LAT
    dlng = (lng2 - lng1) * M_PER_DEG_LNG
    return math.sqrt(dlat**2 + dlng**2)


def main():
    print("=== Steg 9b: Slå ihop Google-upptäckta venues ===")

    if not os.path.exists(DISCOVERED_FILE):
        print("  Ingen discovered-data. Kör 09_discover_google_venues.py först.")
        return

    with open(DISCOVERED_FILE, "r", encoding="utf-8") as f:
        discovered = json.load(f)
    print(f"  {len(discovered)} upptäckta venues")

    with open(VENUES_FILE, "r", encoding="utf-8") as f:
        geojson = json.load(f)

    existing = geojson["features"]
    print(f"  {len(existing)} befintliga venues")

    # Build coordinate index for dedup
    existing_points = []
    for feat in existing:
        coords = feat["geometry"]["coordinates"]
        existing_points.append((coords[1], coords[0]))  # lat, lng

    added = 0
    skipped_dup = 0
    # Use a counter for generating unique IDs
    max_id = max(int(f["properties"]["id"]) for f in existing if f["properties"]["id"].isdigit())

    for google_id, venue in discovered.items():
        lat = venue["lat"]
        lng = venue["lng"]

        # Check for nearby duplicates
        is_dup = False
        for elat, elng in existing_points:
            if haversine_approx(lat, lng, elat, elng) < DEDUP_DISTANCE_M:
                is_dup = True
                break

        if is_dup:
            skipped_dup += 1
            continue

        max_id += 1
        feature = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": {
                "id": str(max_id),
                "name": venue["name"],
                "amenity": venue.get("amenity", "restaurant"),
                "cuisine": "",
                "opening_hours": "",
                "website": "",
                "phone": "",
                "addr_street": venue.get("address", ""),
                "addr_housenumber": "",
                "level": "",
                "outdoor_seating": "yes",
                "source": "google_discovered",
                "google_id": google_id,
            },
        }
        geojson["features"].append(feature)
        existing_points.append((lat, lng))
        added += 1
        print(f"  + {venue['name']} ({lat:.4f}, {lng:.4f})")

    # Save
    with open(VENUES_FILE, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

    print(f"\nKlart!")
    print(f"  Tillagda: {added}")
    print(f"  Dubbletter: {skipped_dup}")
    print(f"  Totalt: {len(geojson['features'])} venues")
    print(f"\nKör sedan:")
    print(f"  python 02b_adjust_venue_positions.py")
    print(f"  python 03b_compute_shadows_incremental.py")
    print(f"  python 04_export_frontend.py")


if __name__ == "__main__":
    main()
