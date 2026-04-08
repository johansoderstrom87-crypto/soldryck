"""
Steg 1: Hämta alla uteserveringar i Stockholm.

Källa: OpenStreetMap via Overpass API
- Alla restauranger, caféer, barer, pubar med outdoor_seating=yes
- Område: Hela Stockholms kommun (utökat bounding box)

Resultat: data/venues.geojson
"""

import json
import time
import urllib.request
import urllib.parse
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
RAW_DIR = os.path.join(DATA_DIR, "raw")
OUTPUT_FILE = os.path.join(DATA_DIR, "venues.geojson")

# Bounding box: Stockholms kommun med lite marginal
BBOX = "59.23,17.82,59.44,18.22"

OVERPASS_QUERY = f"""[out:json][timeout:120];
(
  node["amenity"~"restaurant|cafe|bar|pub"]["outdoor_seating"="yes"]({BBOX});
  way["amenity"~"restaurant|cafe|bar|pub"]["outdoor_seating"="yes"]({BBOX});
  node["amenity"~"restaurant|cafe|bar|pub"]["outdoor_seating"~"yes|summer|seasonal"]({BBOX});
);
out center body;"""

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


def fetch_overpass(query: str, max_retries: int = 3) -> dict:
    """Hämta data från Overpass API med retries och fallback-servrar."""
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
                resp = urllib.request.urlopen(req, timeout=120)
                raw = resp.read().decode("utf-8")
                return json.loads(raw)
            except Exception as e:
                print(f"  Misslyckades: {e}")
                time.sleep(5)

    raise RuntimeError("Kunde inte nå Overpass API efter alla försök")


def elements_to_geojson(elements: list) -> dict:
    """Konvertera Overpass-element till GeoJSON FeatureCollection."""
    features = []
    seen_ids = set()

    for el in elements:
        # Deduplicera (en plats kan matcha flera queries)
        osm_id = el["id"]
        if osm_id in seen_ids:
            continue
        seen_ids.add(osm_id)

        # Koordinater
        if el["type"] == "node":
            lat, lng = el["lat"], el["lon"]
        elif "center" in el:
            lat, lng = el["center"]["lat"], el["center"]["lon"]
        else:
            continue

        tags = el.get("tags", {})
        name = tags.get("name", "Okänd")

        # Skippa om ingen koordinat
        if not lat or not lng:
            continue

        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lng, lat]},
                "properties": {
                    "id": str(osm_id),
                    "name": name,
                    "amenity": tags.get("amenity", "restaurant"),
                    "cuisine": tags.get("cuisine", ""),
                    "opening_hours": tags.get("opening_hours", ""),
                    "website": tags.get("website", ""),
                    "phone": tags.get("phone", ""),
                    "addr_street": tags.get("addr:street", ""),
                    "addr_housenumber": tags.get("addr:housenumber", ""),
                },
            }
        )

    return {"type": "FeatureCollection", "features": features}


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(RAW_DIR, exist_ok=True)

    print("=== Steg 1: Hämta uteserveringar ===")
    print(f"Område: Stockholm ({BBOX})")

    # Kolla om vi redan har cachad rådata
    raw_file = os.path.join(RAW_DIR, "osm_venues.json")
    if os.path.exists(raw_file):
        print(f"Använder cachad data: {raw_file}")
        with open(raw_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = fetch_overpass(OVERPASS_QUERY)
        with open(raw_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Rådata sparad: {raw_file}")

    elements = data.get("elements", [])
    print(f"Hittade {len(elements)} element från OSM")

    # Konvertera till GeoJSON
    geojson = elements_to_geojson(elements)
    print(f"Konverterade till {len(geojson['features'])} unika platser")

    # Statistik
    by_type = {}
    for f in geojson["features"]:
        t = f["properties"]["amenity"]
        by_type[t] = by_type.get(t, 0) + 1
    for t, count in sorted(by_type.items()):
        print(f"  {t}: {count}")

    # Spara
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    print(f"\nSparat till {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
