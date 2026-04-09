"""
Steg 2d: Lagg till hojddata for venues (takterrasser etc.).

Kallar:
1. OSM-taggar: level, building:levels, roof:terrace
2. Kanda takterrasser (manuell lista)
3. Beraknar venue_elevation_m som anvands i skuggberakningen

En venue pa 6:e vaningen (18m) pavekas inte av 15m-byggnader runtomkring.
"""

import os
import json

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
VENUES_FILE = os.path.join(DATA_DIR, "venues.geojson")
OUTPUT_FILE = os.path.join(DATA_DIR, "venues.geojson")

FLOOR_HEIGHT = 3.0  # meters per floor

# Known rooftop terraces in Stockholm (name -> approximate floor/height)
# These are manually curated for accuracy
KNOWN_ROOFTOPS = {
    "Tak": 40,           # Tak Stockholm, 13th floor ~40m
    "TAK": 40,
    "Tak Stockholm": 40,
    "Urban Deli": 15,    # Svampen/Nytorget, elevated
    "Gondolen": 30,      # At Katarinahissen, ~30m
    "Himlen": 80,        # Gotgatan 78, 26th floor
    "Stockholm Under Stjarnorna": 25,
    "Mosebacke Etablissement": 25,  # Mosebacke terrace, elevated
    "Mosebacketerrassen": 25,
    "Eriks Gondolen": 30,
    "Restaurang Himmla": 20,
    "Le Hibou": 20,      # Sodra teatern rooftop
    "Scandic Sjofartshotellet": 20,  # Rooftop bar
    "At Six Rooftop": 25,
    "Rooftop at Brunkebergstorg": 25,
    "The Rooftop": 20,
    "Hotellet": 20,      # Hotel rooftop bars
    "Blique by Nobis": 20,
    "Miss Clara Rooftop": 20,
}


def main():
    print("=== Steg 2d: Venue-hojddata ===")

    with open(VENUES_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    elevated = 0
    for feat in data["features"]:
        props = feat["properties"]
        name = props.get("name", "")
        venue_height = 0.0

        # Check known rooftops (exact match or name starts/ends with known name)
        name_lower = name.lower().strip()
        for known_name, height in KNOWN_ROOFTOPS.items():
            known_lower = known_name.lower()
            # Exact match, or the venue name equals the known name
            # Avoid substring matches like "Takumi" matching "Tak"
            if name_lower == known_lower or name_lower.startswith(known_lower + " ") or name_lower.endswith(" " + known_lower):
                venue_height = height
                break

        # Check OSM tags (if available from Overpass)
        if venue_height == 0:
            level = props.get("level", "")
            if level:
                try:
                    venue_height = float(level) * FLOOR_HEIGHT
                except (ValueError, TypeError):
                    pass

        props["venue_elevation_m"] = venue_height

        if venue_height > 0:
            elevated += 1
            print(f"  {name}: {venue_height}m")

    print(f"\n  {elevated} venues med hojddata")
    print(f"  {len(data['features']) - elevated} venues pa markplan")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  Sparat till {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
