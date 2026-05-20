"""
Steg 10: Backfilla website för venues som saknar det.

OSM har website-taggen för ~45% av venuesarna. Resten hämtar vi från
Google Places. Två fall:

1. Venue har `google_place_id` (de som ursprungligen Google-verifierades
   i steg 7/7b). → Place Details (Advanced), bara websiteUri-fält.
2. Venue har inget place_id (rent OSM-bekräftade). → Text Search för att
   hitta place_id, sen Place Details för websiteUri.

Resumable — kör om utan att redo allt. Cache i data/websites.json.
Slutligen uppdateras venues.geojson så att step 04 plockar upp datan.
"""

import json
import os
import time
import urllib.request

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
VENUES_FILE = os.path.join(DATA_DIR, "venues.geojson")
CACHE_FILE = os.path.join(DATA_DIR, "websites.json")

API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
DETAILS_URL = "https://places.googleapis.com/v1/places/{place_id}"


def normalize_url(url: str) -> str:
    """Lägg till https:// om saknas, trimma trailing whitespace."""
    if not url:
        return ""
    url = url.strip()
    if not url:
        return ""
    if not url.lower().startswith(("http://", "https://")):
        url = "https://" + url
    return url


def fetch_website_by_place_id(place_id: str) -> tuple[str | None, str]:
    """Place Details med bara websiteUri. Returnerar (website, status)."""
    url = DETAILS_URL.format(place_id=place_id)
    req = urllib.request.Request(
        url,
        headers={
            "X-Goog-Api-Key": API_KEY,
            "X-Goog-FieldMask": "websiteUri",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return data.get("websiteUri") or None, "ok"
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None, "not_found"
        return None, f"http_{e.code}"
    except Exception as e:
        return None, f"err: {e}"


def search_and_fetch_website(name: str, lat: float, lng: float) -> tuple[str | None, str | None]:
    """Text Search → Place Details för websiteUri. Returnerar (website, place_id)."""
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
            "X-Goog-FieldMask": "places.id,places.websiteUri",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        places = data.get("places", [])
        if not places:
            return None, None
        p = places[0]
        return p.get("websiteUri") or None, p.get("id")
    except Exception as e:
        print(f"    API error: {e}")
        return None, None


def main():
    print("=== Steg 10: Backfilla website från Google Places ===")

    if not API_KEY:
        print("  GOOGLE_PLACES_API_KEY ej satt!")
        return

    with open(VENUES_FILE, "r", encoding="utf-8") as f:
        geo = json.load(f)

    cache: dict[str, dict] = {}
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            cache = json.load(f)
        print(f"  Återupptar — {len(cache)} venues redan slagna upp")

    # Hitta de som saknar website OCH inte redan finns i cachen
    todo = []
    for feat in geo["features"]:
        p = feat["properties"]
        vid = str(p["id"])
        if p.get("website"):
            continue
        if vid in cache:
            continue
        todo.append({
            "id": vid,
            "name": p.get("name", ""),
            "lat": feat["geometry"]["coordinates"][1],
            "lng": feat["geometry"]["coordinates"][0],
            "google_place_id": p.get("google_place_id", ""),
        })

    print(f"  {len(todo)} venues att slå upp")
    if not todo:
        print("  Inget att göra — alla har website eller är cachade.")
        merge_cache_into_geojson(geo, cache)
        return

    with_pid = sum(1 for v in todo if v["google_place_id"])
    print(f"    {with_pid} har place_id (Place Details direkt)")
    print(f"    {len(todo) - with_pid} saknar place_id (Text Search + Details)")

    found = 0
    missing = 0
    errors = 0

    for i, v in enumerate(todo):
        if v["google_place_id"]:
            site, status = fetch_website_by_place_id(v["google_place_id"])
            place_id = v["google_place_id"]
        else:
            site, place_id = search_and_fetch_website(v["name"], v["lat"], v["lng"])
            status = "ok" if site is not None or place_id else "not_found"

        site = normalize_url(site) if site else ""
        cache[v["id"]] = {
            "name": v["name"],
            "website": site,
            "google_place_id": place_id or v["google_place_id"] or "",
            "status": status,
        }
        if site:
            found += 1
        elif status == "ok" or status == "not_found":
            missing += 1
        else:
            errors += 1

        # Spara checkpoint var 25:e
        if (i + 1) % 25 == 0 or i + 1 == len(todo):
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(cache, f, ensure_ascii=False, indent=2)
            print(f"  [{i+1}/{len(todo)}] hittade={found}, saknas={missing}, fel={errors}")

        time.sleep(0.1)  # ~10 req/sec

    # Slutspara
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

    print(f"\n  Klart! {found} websites hittade, {missing} saknas, {errors} fel")
    merge_cache_into_geojson(geo, cache)


def merge_cache_into_geojson(geo: dict, cache: dict) -> None:
    """Skriv tillbaka funna websites till venues.geojson så step 04 plockar upp."""
    updated = 0
    for feat in geo["features"]:
        p = feat["properties"]
        vid = str(p["id"])
        if p.get("website"):
            continue
        entry = cache.get(vid)
        if entry and entry.get("website"):
            p["website"] = entry["website"]
            # Spara place_id också om vi nyligen hittade det via Text Search
            if not p.get("google_place_id") and entry.get("google_place_id"):
                p["google_place_id"] = entry["google_place_id"]
            updated += 1

    with open(VENUES_FILE, "w", encoding="utf-8") as f:
        json.dump(geo, f, ensure_ascii=False, indent=2)
    print(f"  Uppdaterade {updated} venues i {VENUES_FILE}")


if __name__ == "__main__":
    main()
