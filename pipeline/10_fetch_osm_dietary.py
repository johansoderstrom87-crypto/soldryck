"""
Steg 10: Hämta dietary- och pet-policy-taggar från OSM.

Drar `dog=*` och `diet:gluten_free=*` för alla relevanta amenity-typer
inom Stockholm-bboxen. Gratis via Overpass — ingen API-nyckel.

Resultat: data/osm_dietary_tags.json
Schema:
  {
    "<osm_id>": {
      "dog": "yes" | "outside" | "leashed" | "no" | ...,
      "gluten_free": "yes" | "limited" | "only" | "no" | ...
    }
  }

Endast venues som har minst en av taggarna inkluderas.
"""

import json
import os
import time
import urllib.parse
import urllib.request

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "osm_dietary_tags.json")

# Samma bbox som steg 01
BBOX = "59.23,17.82,59.44,18.22"

AMENITY_REGEX = "restaurant|cafe|bar|pub|biergarten|fast_food|ice_cream|food_court"

OVERPASS_QUERY = f"""[out:json][timeout:120];
(
  nwr["amenity"~"{AMENITY_REGEX}"]["dog"]({BBOX});
  nwr["amenity"~"{AMENITY_REGEX}"]["diet:gluten_free"]({BBOX});
  nwr["leisure"="outdoor_seating"]["dog"]({BBOX});
  nwr["leisure"="outdoor_seating"]["diet:gluten_free"]({BBOX});
);
out tags center;"""

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


def fetch_overpass(query: str, max_retries: int = 3) -> dict:
    data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    for attempt in range(max_retries):
        for url in OVERPASS_URLS:
            try:
                print(f"  Försöker {url} (försök {attempt + 1})...")
                req = urllib.request.Request(
                    url,
                    data=data,
                    headers={"User-Agent": "Soldryck/1.0 (sun-tracker)"},
                )
                resp = urllib.request.urlopen(req, timeout=180)
                return json.loads(resp.read().decode("utf-8"))
            except Exception as e:
                print(f"  Misslyckades: {e}")
                time.sleep(5)
    raise RuntimeError("Kunde inte nå Overpass API")


def main():
    print("=== Steg 10: Hämta OSM dietary/pet-tags ===")
    result_raw = fetch_overpass(OVERPASS_QUERY)
    elements = result_raw.get("elements", [])
    print(f"  {len(elements)} element från Overpass")

    out: dict[str, dict[str, str]] = {}
    for el in elements:
        osm_id = str(el["id"])
        tags = el.get("tags", {})
        entry: dict[str, str] = {}
        dog = tags.get("dog")
        if dog:
            entry["dog"] = dog
        gf = tags.get("diet:gluten_free")
        if gf:
            entry["gluten_free"] = gf
        if entry:
            # Vid dupliceringar (samma osm_id i flera delqueries) tar vi bara senaste
            out[osm_id] = entry

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    dog_count = sum(1 for v in out.values() if "dog" in v)
    dog_yes = sum(1 for v in out.values() if v.get("dog") in ("yes", "outside", "leashed"))
    gf_count = sum(1 for v in out.values() if "gluten_free" in v)
    gf_yes = sum(1 for v in out.values() if v.get("gluten_free") in ("yes", "limited", "only"))

    print(f"\nKlart! {len(out)} venues med minst en tagg:")
    print(f"  dog=* totalt: {dog_count}  (varav hundvänliga: {dog_yes})")
    print(f"  diet:gluten_free=* totalt: {gf_count}  (varav glutenfria: {gf_yes})")
    print(f"  Sparat till {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
