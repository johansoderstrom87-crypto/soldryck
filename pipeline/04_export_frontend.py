"""
Steg 4: Exportera beräkningsresultat till frontend-format.

Läser shadow_results.json och genererar en kompakt TypeScript-fil
som frontenden kan importera direkt.

Resultat: ../frontend/app/data/venues-computed.ts
"""

import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
INPUT_FILE = os.path.join(DATA_DIR, "shadow_results.json")
VENUES_FILE = os.path.join(DATA_DIR, "venues.geojson")
RATINGS_FILE = os.path.join(DATA_DIR, "ratings.json")
VERIFICATION_FILE = os.path.join(DATA_DIR, "outdoor_verification.json")
VERIFICATION_NEG_FILE = os.path.join(DATA_DIR, "outdoor_verification_negative.json")
# Datan ligger numera som ren JSON under public/ (#29 i refactor-rundan).
# Den manuellt underhållna `frontend/app/data/venues-computed.ts` exporterar
# bara typer + helpers + en client-side store — pipeline rör inte filen.
OUTPUT_FILE = os.path.join(
    os.path.dirname(__file__), "..", "frontend", "public", "data", "venues-computed.json"
)

# Known rooftop venues — name-based identification for venues without OSM level data
KNOWN_ROOFTOP_NAMES = {
    "tak", "tak stockholm", "takpark by urban deli", "takpark",
    "gondolen", "eriks gondolen", "himlen",
    "mosebacke etablissement", "mosebacketerrassen",
    "le hibou", "the capital", "capital",
    "3sixty", "3sixty skybar",
    "sus", "stockholm under stjärnorna",
    "pelago", "basta",
    "scandic anglais terrassbaren", "terrassbaren",
    "the winery hotel", "dramatenterrassen",
    "the nest", "the nest at downtown camper",
    "freyja + söder", "freyja",
    "arc", "arc at blique by nobis", "blique by nobis",
    "spesso", "ascaroterrassen",
    "sjöstaden skybar", "sjostaden skybar",
    "la terrazza", "la terrazza at italienskan",
    "rooftop garden bar", "clarion sign",
    "slakthuset",
}

# Minimum OSM level to count as rooftop
ROOFTOP_MIN_LEVEL = 6

# OSM amenity types that implicitly serve alcohol
ALCOHOL_AMENITY_TYPES = {"bar", "pub", "biergarten"}


def compact_schedule(schedule: dict) -> dict:
    """Komprimera schedule för mindre filstorlek.

    Konverterar {"04-01": {"7": "shade", "8": "sun", ...}}
    till {"04-01": {"7": "d", "8": "s", ...}}
    där s=sun, d=shade, p=partial, n=night
    """
    STATUS_MAP = {"sun": "s", "shade": "d", "partial": "p", "night": "n"}
    compact = {}
    for date_key, hours in schedule.items():
        compact[date_key] = {}
        for hour, status in hours.items():
            compact[date_key][hour] = STATUS_MAP.get(status, "d")
    return compact


def is_rooftop(name: str, level_str: str) -> bool:
    """Determine if a venue is a rooftop bar/restaurant."""
    # Check OSM level
    if level_str:
        try:
            # Handle multi-level like "-1;0" — take the max
            levels = [int(x) for x in level_str.replace(";", ",").split(",") if x.strip().lstrip("-").isdigit()]
            if levels and max(levels) >= ROOFTOP_MIN_LEVEL:
                return True
        except ValueError:
            pass

    # Check known names
    name_lower = name.lower().strip()
    for known in KNOWN_ROOFTOP_NAMES:
        if name_lower == known or name_lower.startswith(known + " ") or name_lower.endswith(" " + known):
            return True

    return False


def main():
    print("=== Steg 4: Exportera till frontend ===")

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        results = json.load(f)

    # Load venues.geojson for level + wheelchair data
    level_lookup = {}
    wheelchair_lookup = {}
    if os.path.exists(VENUES_FILE):
        with open(VENUES_FILE, "r", encoding="utf-8") as f:
            geojson = json.load(f)
        for feat in geojson["features"]:
            props = feat["properties"]
            vid = str(props["id"])
            level_lookup[vid] = props.get("level", "")
            wc = props.get("wheelchair", "")
            if wc:
                wheelchair_lookup[vid] = wc

    # Build alcohol lookup from verification files (covers all google-verified venues)
    alcohol_lookup = {}
    for vfile in (VERIFICATION_FILE, VERIFICATION_NEG_FILE):
        if os.path.exists(vfile):
            with open(vfile, "r", encoding="utf-8") as f:
                vdata = json.load(f)
            for osm_id, result in vdata.items():
                if result.get("serves_alcohol") is True:
                    alcohol_lookup[osm_id] = True
    print(f"  {len(alcohol_lookup)} venues med bekräftat serveringstillstånd (Google)")

    # Load ratings if available
    ratings_lookup: dict = {}
    if os.path.exists(RATINGS_FILE):
        with open(RATINGS_FILE, "r", encoding="utf-8") as f:
            ratings_lookup = json.load(f)
        rated = sum(1 for r in ratings_lookup.values() if r.get("rating") is not None)
        print(f"  Laddade ratings för {rated}/{len(ratings_lookup)} venues")

    print(f"Läste {len(results)} platser")

    # Bygg venues-array
    venues = []
    rooftop_count = 0
    for venue_id, data in results.items():
        level = level_lookup.get(venue_id, "")
        rooftop = is_rooftop(data["name"], level)
        if rooftop:
            rooftop_count += 1
        venue_type = data["type"]
        serves_alcohol = alcohol_lookup.get(venue_id) or (venue_type in ALCOHOL_AMENITY_TYPES) or None
        venue = {
            "id": venue_id,
            "name": data["name"],
            "lat": round(data["lat"], 6),
            "lng": round(data["lng"], 6),
            "type": venue_type,
            "address": data.get("address", ""),
            "schedule": compact_schedule(data["schedule"]),
        }
        if rooftop:
            venue["rooftop"] = True
        if serves_alcohol is True:
            venue["servesAlcohol"] = True
        rating_entry = ratings_lookup.get(venue_id, {})
        if rating_entry.get("rating") is not None:
            venue["rating"] = rating_entry["rating"]
        if rating_entry.get("rating_count") is not None:
            venue["ratingCount"] = rating_entry["rating_count"]
        wc = wheelchair_lookup.get(venue_id)
        if wc:
            venue["wheelchair"] = wc
        venues.append(venue)

    print(f"  {rooftop_count} takbarer/takrestauranger")

    # Skriv som ren JSON-array. Helpers + typer underhålls separat i
    # frontend/app/data/venues-computed.ts — den filen rör pipeline inte.
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(venues, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = os.path.getsize(OUTPUT_FILE) / 1024
    print(f"Exporterat {len(venues)} platser till {OUTPUT_FILE}")
    print(f"Filstorlek: {size_kb:.0f} KB (gzippas automatiskt av Railway/Next)")


if __name__ == "__main__":
    main()
