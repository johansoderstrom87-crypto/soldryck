"""
Steg 7: Verifiera uteservering via Google Places API.

For varje obekraftad venue:
1. Sok efter platsen via "Find Place" (namn + koordinater)
2. Hamta Place Details med outdoorSeating-faltet
3. Kategorisera: confirmed / denied / unknown

Resultat: data/outdoor_verification.json
"""

import json
import os
import time
import urllib.request
import urllib.parse

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
INPUT_FILE = os.path.join(DATA_DIR, "raw", "osm_unconfirmed_venues.json")
VENUES_FILE = os.path.join(DATA_DIR, "venues.geojson")
OUTPUT_FILE = os.path.join(DATA_DIR, "outdoor_verification.json")

API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")

FIND_PLACE_URL = "https://places.googleapis.com/v1/places:searchText"


def search_place(name: str, lat: float, lng: float) -> dict | None:
    """Find a place via Google Places API (New) and get outdoor seating info."""
    body = json.dumps({
        "textQuery": f"{name} Stockholm",
        "locationBias": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": 200.0,
            }
        },
        "maxResultCount": 1,
    }).encode("utf-8")

    req = urllib.request.Request(
        FIND_PLACE_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": API_KEY,
            "X-Goog-FieldMask": "places.id,places.displayName,places.outdoorSeating,places.dineIn,places.location",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        places = result.get("places", [])
        if not places:
            return None
        return places[0]
    except Exception as e:
        print(f"    API error: {e}")
        return None


def main():
    print("=== Steg 7: Verifiera uteservering via Google Places ===")

    if not API_KEY:
        print("  GOOGLE_PLACES_API_KEY ej satt!")
        return

    # Load unconfirmed venues
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        raw = json.load(f)

    # Load confirmed venues to skip duplicates
    with open(VENUES_FILE, "r", encoding="utf-8") as f:
        confirmed = json.load(f)
    confirmed_ids = set(f["properties"]["id"] for f in confirmed["features"])

    # Parse unconfirmed venues
    venues = []
    seen = set()
    for el in raw.get("elements", []):
        osm_id = str(el["id"])
        if osm_id in seen or osm_id in confirmed_ids:
            continue
        seen.add(osm_id)

        tags = el.get("tags", {})
        name = tags.get("name", "")
        if not name:
            continue

        amenity = tags.get("amenity", "")
        if amenity not in ("restaurant", "cafe", "bar", "pub", "biergarten", "fast_food", "ice_cream", "food_court"):
            continue

        if el["type"] == "node":
            lat, lng = el["lat"], el["lon"]
        elif "center" in el:
            lat, lng = el["center"]["lat"], el["center"]["lon"]
        else:
            continue

        venues.append({
            "osm_id": osm_id,
            "name": name,
            "lat": lat,
            "lng": lng,
            "amenity": amenity,
            "address": tags.get("addr:street", ""),
        })

    print(f"  {len(venues)} obekraftade venues att verifiera")

    # Resume from previous run if exists
    results = {}
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            results = json.load(f)
        print(f"  {len(results)} redan verifierade (aterupptar)")

    confirmed_count = 0
    denied_count = 0
    unknown_count = 0
    skipped = 0

    for i, venue in enumerate(venues):
        if venue["osm_id"] in results:
            skipped += 1
            continue

        place = search_place(venue["name"], venue["lat"], venue["lng"])

        if place is None:
            results[venue["osm_id"]] = {
                "name": venue["name"],
                "outdoor_seating": None,
                "google_id": None,
            }
            unknown_count += 1
        else:
            outdoor = place.get("outdoorSeating")
            results[venue["osm_id"]] = {
                "name": venue["name"],
                "outdoor_seating": outdoor,
                "google_id": place.get("id"),
                "google_name": place.get("displayName", {}).get("text"),
            }
            if outdoor is True:
                confirmed_count += 1
            elif outdoor is False:
                denied_count += 1
            else:
                unknown_count += 1

        # Progress
        total_done = i + 1 - skipped + len([r for r in results if r not in {v["osm_id"] for v in venues[:i]}])
        if (i + 1 - skipped) % 25 == 0 or i + 1 == len(venues):
            print(f"  {i+1}/{len(venues)} (ja={confirmed_count}, nej={denied_count}, ?={unknown_count})")

            # Save intermediate results
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(results, f, ensure_ascii=False, indent=2)

        # Rate limit: ~10 requests/sec to stay within quota
        time.sleep(0.1)

    # Final save
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # Final stats
    all_confirmed = sum(1 for r in results.values() if r["outdoor_seating"] is True)
    all_denied = sum(1 for r in results.values() if r["outdoor_seating"] is False)
    all_unknown = sum(1 for r in results.values() if r["outdoor_seating"] is None)

    print(f"\nKlart! {len(results)} verifierade:")
    print(f"  Uteservering bekraftad: {all_confirmed}")
    print(f"  Ingen uteservering: {all_denied}")
    print(f"  Okant: {all_unknown}")
    print(f"  Sparat till {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
