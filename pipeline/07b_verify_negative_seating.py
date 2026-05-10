"""
Steg 7b: Dubbelkolla OSM-venues taggade outdoor_seating=no via Google Places.

Bakgrund: Vissa OSM-bidragsgivare har bulk-taggat venues som outdoor_seating=no
fast de faktiskt har uteservering (ex: Charles Dickens, Kelly's, The Central Bar
på Folkungagatan, alla taggade av samma user 2024-03-05). Steg 1 exkluderar
dessa, och de hamnar inte heller i obekräftad-listan eftersom 07 bara behandlar
venues UTAN outdoor_seating-tag.

Detta steg:
1. Läser data/raw/osm_outdoor_no.json (skapas av Overpass-query nedan om saknas)
2. Frågar Google Places om varje venue
3. Sparar till data/outdoor_verification_negative.json
   - outdoor_seating=true  → Google säger ja, override OSM
   - outdoor_seating=false → båda källor överens
   - outdoor_seating=null  → Google har ingen data

Resultatet används av 08_merge_verified_venues.py.
"""

import json
import os
import time
import urllib.parse
import urllib.request

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
RAW_DIR = os.path.join(DATA_DIR, "raw")
INPUT_FILE = os.path.join(RAW_DIR, "osm_outdoor_no.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "outdoor_verification_negative.json")

API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
BBOX = "59.23,17.82,59.44,18.22"

OVERPASS_QUERY = f"""[out:json][timeout:120];
nwr["amenity"~"restaurant|cafe|bar|pub|biergarten|fast_food|ice_cream|food_court"]["outdoor_seating"~"^(no|none|0)$",i]({BBOX});
out meta center;"""

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


def fetch_negative_venues() -> dict:
    """Hämta alla OSM-venues taggade outdoor_seating=no i Stockholm."""
    data = urllib.parse.urlencode({"data": OVERPASS_QUERY}).encode("utf-8")
    for url in OVERPASS_URLS:
        try:
            print(f"  Försöker {url}...")
            req = urllib.request.Request(
                url,
                data=data,
                headers={"User-Agent": "Soldryck/1.0 (sun-tracker)"},
            )
            resp = urllib.request.urlopen(req, timeout=180)
            return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"  Misslyckades: {e}")
    raise RuntimeError("Kunde inte nå Overpass API")


def search_place(name: str, lat: float, lng: float) -> dict | None:
    """Slå upp plats via Google Places searchText."""
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
            "X-Goog-FieldMask": "places.id,places.displayName,places.outdoorSeating,places.location",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        places = result.get("places", [])
        return places[0] if places else None
    except Exception as e:
        print(f"    API error: {e}")
        return None


def main():
    print("=== Steg 7b: Verifiera outdoor_seating=no via Google Places ===")

    if not API_KEY:
        print("  GOOGLE_PLACES_API_KEY ej satt! Sätt miljövariabeln och kör igen.")
        return

    # Ladda OSM-data (cachad eller fresh)
    if os.path.exists(INPUT_FILE):
        print(f"  Använder cachad fil: {INPUT_FILE}")
        with open(INPUT_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
    else:
        print("  Hämtar från Overpass...")
        os.makedirs(RAW_DIR, exist_ok=True)
        raw = fetch_negative_venues()
        with open(INPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(raw, f, ensure_ascii=False, indent=2)

    # Parsa venues
    venues = []
    seen = set()
    for el in raw.get("elements", []):
        osm_id = str(el["id"])
        if osm_id in seen:
            continue
        seen.add(osm_id)

        tags = el.get("tags", {})
        name = tags.get("name", "")
        if not name:
            continue

        if el["type"] == "node":
            lat, lng = el["lat"], el["lon"]
        elif "center" in el:
            lat, lng = el["center"]["lat"], el["center"]["lon"]
        else:
            continue

        venues.append({
            "osm_id": osm_id,
            "osm_type": el["type"],
            "name": name,
            "lat": lat,
            "lng": lng,
            "amenity": tags.get("amenity", ""),
            "addr_street": tags.get("addr:street", ""),
            "addr_housenumber": tags.get("addr:housenumber", ""),
            "osm_user": el.get("user", ""),
            "osm_timestamp": el.get("timestamp", ""),
        })

    print(f"  {len(venues)} OSM-venues att dubbelkolla")

    # Återuppta
    results = {}
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            results = json.load(f)
        print(f"  {len(results)} redan verifierade (återupptar)")

    google_yes = 0
    google_no = 0
    google_unknown = 0
    skipped = 0

    for i, venue in enumerate(venues):
        if venue["osm_id"] in results:
            skipped += 1
            continue

        place = search_place(venue["name"], venue["lat"], venue["lng"])

        if place is None:
            results[venue["osm_id"]] = {
                **venue,
                "google_outdoor_seating": None,
                "google_id": None,
                "google_name": None,
            }
            google_unknown += 1
        else:
            outdoor = place.get("outdoorSeating")
            results[venue["osm_id"]] = {
                **venue,
                "google_outdoor_seating": outdoor,
                "google_id": place.get("id"),
                "google_name": place.get("displayName", {}).get("text"),
            }
            if outdoor is True:
                google_yes += 1
                safe_name = venue["name"].encode("ascii", errors="replace").decode("ascii")
                print(f"  YES: {safe_name:30} (OSM sa nej, Google sa JA)")
            elif outdoor is False:
                google_no += 1
            else:
                google_unknown += 1

        # Spara checkpoint var 25:e
        if (i + 1 - skipped) > 0 and (i + 1 - skipped) % 25 == 0:
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            print(f"  [{i+1}/{len(venues)}] Google YES={google_yes}, NO={google_no}, ?={google_unknown}")

        time.sleep(0.1)  # Rate limit

    # Final save
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # Slutstatistik
    all_yes = sum(1 for r in results.values() if r["google_outdoor_seating"] is True)
    all_no = sum(1 for r in results.values() if r["google_outdoor_seating"] is False)
    all_unknown = sum(1 for r in results.values() if r["google_outdoor_seating"] is None)

    print(f"\n=== Klart! {len(results)} verifierade ===")
    print(f"  Google YES (override OSM):  {all_yes}")
    print(f"  Google NO  (båda överens):  {all_no}")
    print(f"  Google okänt:               {all_unknown}")
    print(f"  Sparat till {OUTPUT_FILE}")

    # Visa alla "OSM no, Google yes" — de som ska komma in på kartan
    if all_yes > 0:
        print(f"\n=== {all_yes} venues att lägga till ({all_yes} ställen som OSM hade fel om) ===")
        for r in results.values():
            if r["google_outdoor_seating"] is True:
                addr = f"{r['addr_street']} {r['addr_housenumber']}".strip() or "(ingen adress)"
                safe_name = r["name"].encode("ascii", errors="replace").decode("ascii")
                print(f"  + {safe_name:35} {addr:30} (osm-user: {r['osm_user']})")


if __name__ == "__main__":
    main()
