"""
Steg 10: Hämta Google Places-rating för alla venues med soldata.

Läser venues.geojson och korskopplar med befintliga google_id:n från
outdoor_verification.json / outdoor_verification_negative.json.

- Venues med känt google_id → GET places/{id} (billigare, ~$0.005)
- Venues utan google_id → searchText (som steg 7, ~$0.017)

Resultat: data/ratings.json
  { "<osm_id>": { "rating": 4.3, "rating_count": 127 }, ... }

Stödjer återupptagning — avbryt och kör om utan att börja från scratch.
"""

import json
import os
import time
import urllib.request

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
VENUES_FILE = os.path.join(DATA_DIR, "venues.geojson")
VERIFICATION_FILE = os.path.join(DATA_DIR, "outdoor_verification.json")
VERIFICATION_NEG_FILE = os.path.join(DATA_DIR, "outdoor_verification_negative.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "ratings.json")

API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")

PLACES_BASE = "https://places.googleapis.com/v1"
SEARCH_URL = f"{PLACES_BASE}/places:searchText"


def get_place_details(google_id: str) -> dict | None:
    """Fetch rating for a known place ID (cheap Basic fields request)."""
    url = f"{PLACES_BASE}/places/{google_id}"
    req = urllib.request.Request(
        url,
        headers={
            "X-Goog-Api-Key": API_KEY,
            "X-Goog-FieldMask": "rating,userRatingCount",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"    Place Details error ({google_id}): {e}")
        return None


def search_place(name: str, lat: float, lng: float) -> dict | None:
    """Search for a place and return its rating fields."""
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
        SEARCH_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": API_KEY,
            "X-Goog-FieldMask": "places.id,places.rating,places.userRatingCount",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        places = result.get("places", [])
        return places[0] if places else None
    except Exception as e:
        print(f"    searchText error: {e}")
        return None


def main():
    print("=== Steg 10: Hämta Google Places-rating ===")

    if not API_KEY:
        print("  GOOGLE_PLACES_API_KEY ej satt!")
        return

    # Load all confirmed venues (those with shadow data)
    with open(VENUES_FILE, "r", encoding="utf-8") as f:
        venues_geojson = json.load(f)
    venues = []
    for feat in venues_geojson["features"]:
        props = feat["properties"]
        coords = feat["geometry"]["coordinates"]
        venues.append({
            "id": str(props["id"]),
            "name": props.get("name", ""),
            "lat": coords[1],
            "lng": coords[0],
        })
    print(f"  {len(venues)} venues i venues.geojson")

    # Build google_id lookup from both verification files
    google_id_lookup: dict[str, str] = {}
    for path in (VERIFICATION_FILE, VERIFICATION_NEG_FILE):
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                verif = json.load(f)
            for osm_id, entry in verif.items():
                gid = entry.get("google_id")
                if gid and osm_id not in google_id_lookup:
                    google_id_lookup[osm_id] = gid

    known = sum(1 for v in venues if v["id"] in google_id_lookup)
    print(f"  {known} har känt google_id (Place Details) — {len(venues) - known} behöver searchText")

    # Resume from previous run
    results: dict[str, dict] = {}
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            results = json.load(f)
        print(f"  {len(results)} redan hämtade (återupptar)")

    details_count = 0
    search_count = 0
    found_count = 0
    no_rating_count = 0

    for i, venue in enumerate(venues):
        vid = venue["id"]
        if vid in results:
            continue

        google_id = google_id_lookup.get(vid)

        if google_id:
            data = get_place_details(google_id)
            details_count += 1
            if data:
                rating = data.get("rating")
                rating_count = data.get("userRatingCount")
            else:
                rating = None
                rating_count = None
        else:
            place = search_place(venue["name"], venue["lat"], venue["lng"])
            search_count += 1
            if place:
                rating = place.get("rating")
                rating_count = place.get("userRatingCount")
            else:
                rating = None
                rating_count = None

        results[vid] = {
            "rating": round(rating, 1) if rating is not None else None,
            "rating_count": rating_count,
        }

        if rating is not None:
            found_count += 1
        else:
            no_rating_count += 1

        if (i + 1) % 50 == 0 or i + 1 == len(venues):
            done = sum(1 for r in results.values() if r["rating"] is not None)
            print(f"  {i+1}/{len(venues)} — {done} med rating, {len(results)-done} utan")
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(results, f, ensure_ascii=False, indent=2)

        time.sleep(0.1)

    # Final save
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    rated = sum(1 for r in results.values() if r["rating"] is not None)
    print(f"\nKlart! {len(results)} venues:")
    print(f"  Med rating: {rated}")
    print(f"  Utan rating: {len(results) - rated}")
    print(f"  Place Details-anrop: {details_count}")
    print(f"  searchText-anrop: {search_count}")
    print(f"  Sparat till {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
