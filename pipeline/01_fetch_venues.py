"""
Steg 1: Hämta alla uteserveringar i Stockholm från OpenStreetMap via Overpass API.
Resultat sparas som JSON.
"""

import json
import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Bounding box for central Stockholm
STOCKHOLM_BBOX = "59.30,18.00,59.36,18.12"

QUERY = f"""
[out:json][timeout:60];
(
  node["amenity"~"restaurant|cafe|bar|pub"]["outdoor_seating"="yes"]({STOCKHOLM_BBOX});
  way["amenity"~"restaurant|cafe|bar|pub"]["outdoor_seating"="yes"]({STOCKHOLM_BBOX});
);
out center body;
"""


def fetch_venues():
    print("Hämtar uteserveringar från OpenStreetMap...")
    response = requests.post(OVERPASS_URL, data={"data": QUERY})
    response.raise_for_status()
    data = response.json()

    venues = []
    for element in data.get("elements", []):
        # Get coordinates (center for ways, direct for nodes)
        if element["type"] == "node":
            lat, lng = element["lat"], element["lon"]
        elif "center" in element:
            lat, lng = element["center"]["lat"], element["center"]["lon"]
        else:
            continue

        tags = element.get("tags", {})
        venues.append(
            {
                "id": str(element["id"]),
                "name": tags.get("name", "Okänd"),
                "lat": lat,
                "lng": lng,
                "type": tags.get("amenity", "restaurant"),
                "osm_id": element["id"],
            }
        )

    print(f"Hittade {len(venues)} uteserveringar.")

    with open("data/venues.json", "w", encoding="utf-8") as f:
        json.dump(venues, f, ensure_ascii=False, indent=2)

    print("Sparat till data/venues.json")
    return venues


if __name__ == "__main__":
    import os

    os.makedirs("data", exist_ok=True)
    fetch_venues()
