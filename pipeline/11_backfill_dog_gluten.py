"""
Steg 11: Backfill av Google-data — allowsDogs + reviews för glutenfri-detektion.

Steg 07 sparar `allows_dogs` numera men befintliga entries i
`outdoor_verification.json` (~3 100 st) hämtades innan vi la till det fältet.
Och reviews har vi aldrig hämtat alls. Det här steget fyller på dem i en
separat fil så att vi inte rör steg 07-resultatet.

Källa: Google Places API (New) — Place Details by place_id.
Endpoint: GET https://places.googleapis.com/v1/places/{place_id}

Fält som hämtas: allowsDogs, reviews (Atmosphere tier).

Kostnad: ~$0.030 per anrop × ~2 500 venues ≈ ~$75. Eftersom Atmosphere-
tier (reviews) är dyrast och vi vill ha den för glutenfri-keyword-scan
finns en flagga `--no-reviews` om man bara vill ha allowsDogs (~$42).

Resultat: data/dog_gluten_backfill.json
Schema:
  {
    "<osm_id>": {
      "allows_dogs": true | false | null,
      "review_glutenfree_mentions": 0,
      "google_id": "places/..."
    }
  }

Resumable: kör om utan att förlora progress (samma mönster som steg 07).

Användning:
  python 11_backfill_dog_gluten.py              # full backfill (reviews + dogs)
  python 11_backfill_dog_gluten.py --no-reviews # bara dogs (billigare)
  python 11_backfill_dog_gluten.py --dry-run    # rapportera bara hur många anrop som skulle göras
"""

import argparse
import json
import os
import re
import time
import urllib.request

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
VERIFICATION_FILE = os.path.join(DATA_DIR, "outdoor_verification.json")
VERIFICATION_NEG_FILE = os.path.join(DATA_DIR, "outdoor_verification_negative.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "dog_gluten_backfill.json")

API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")

# Glutenfri-detektion via review text. Vi räknar fall av dessa keywords
# (case-insensitive, hela ord). Tröskel: ≥2 oberoende reviews → True i export-steget.
GLUTENFREE_PATTERNS = [
    re.compile(r"\bglutenfri(?:tt|a)?\b", re.IGNORECASE),
    re.compile(r"\bgluten[\s-]?free\b", re.IGNORECASE),
    # "GF" är för fuzzy — två bokstäver triggar falska positiver. Hoppar.
]


def count_glutenfree_mentions(reviews: list) -> int:
    """Räkna unika reviews som nämner glutenfri-keywords."""
    count = 0
    for review in reviews:
        text_obj = review.get("text") or review.get("originalText") or {}
        text = text_obj.get("text", "") if isinstance(text_obj, dict) else str(text_obj)
        if not text:
            continue
        for pattern in GLUTENFREE_PATTERNS:
            if pattern.search(text):
                count += 1
                break  # max 1 per review
    return count


def fetch_place_details(place_id: str, include_reviews: bool) -> dict | None:
    """Place Details by ID. place_id ser ut som 'places/ChIJ...'.

    Anropet returnerar ett Place-objekt direkt (inte wrappat i {"places": [...]}).
    """
    # Field mask — minimera tier-kostnaden om vi inte vill ha reviews
    fields = ["id", "allowsDogs"]
    if include_reviews:
        fields.append("reviews")
    field_mask = ",".join(fields)

    # place_id från steg 07 sparas som "places/ChIJ..." — strippa prefix för URL
    pid = place_id.split("/", 1)[1] if place_id.startswith("places/") else place_id
    url = f"https://places.googleapis.com/v1/places/{pid}"

    req = urllib.request.Request(
        url,
        headers={
            "X-Goog-Api-Key": API_KEY,
            "X-Goog-FieldMask": field_mask,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"    API error för {pid}: {e}")
        return None


def load_candidates() -> list[tuple[str, str]]:
    """(osm_id, google_id) för alla venues vi har google_id på."""
    candidates: list[tuple[str, str]] = []
    seen: set[str] = set()
    for vfile in (VERIFICATION_FILE, VERIFICATION_NEG_FILE):
        if not os.path.exists(vfile):
            continue
        with open(vfile, "r", encoding="utf-8") as f:
            vdata = json.load(f)
        for osm_id, entry in vdata.items():
            if osm_id in seen:
                continue
            gid = entry.get("google_id")
            if gid:
                candidates.append((osm_id, gid))
                seen.add(osm_id)
    return candidates


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-reviews", action="store_true", help="Skippa reviews — bara allowsDogs (billigare).")
    ap.add_argument("--dry-run", action="store_true", help="Visa antal anrop utan att kalla API:t.")
    args = ap.parse_args()

    include_reviews = not args.no_reviews
    print("=== Steg 11: Backfill allowsDogs + reviews ===")
    print(f"  Reviews: {'ja (~$0.030/anrop)' if include_reviews else 'nej (~$0.017/anrop)'}")

    candidates = load_candidates()
    print(f"  {len(candidates)} venues med google_id")

    # Resume
    results: dict = {}
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            results = json.load(f)
        print(f"  {len(results)} redan backfillade (återupptar)")

    to_fetch = [(osm_id, gid) for osm_id, gid in candidates if osm_id not in results]
    print(f"  {len(to_fetch)} kvar att hämta")

    if args.dry_run:
        cost_per = 0.030 if include_reviews else 0.017
        print(f"\n[DRY-RUN] Skulle gora {len(to_fetch)} anrop ~ ${len(to_fetch) * cost_per:.2f}")
        return

    if not API_KEY:
        print("  GOOGLE_PLACES_API_KEY ej satt!")
        return

    if not to_fetch:
        print("  Inget att göra.")
        return

    dogs_yes = sum(1 for r in results.values() if r.get("allows_dogs") is True)
    dogs_no = sum(1 for r in results.values() if r.get("allows_dogs") is False)
    gf_hits = sum(1 for r in results.values() if r.get("review_glutenfree_mentions", 0) >= 2)

    for i, (osm_id, gid) in enumerate(to_fetch):
        place = fetch_place_details(gid, include_reviews=include_reviews)
        entry = {
            "google_id": gid,
            "allows_dogs": None,
            "review_glutenfree_mentions": 0,
        }
        if place is not None:
            entry["allows_dogs"] = place.get("allowsDogs")
            if include_reviews:
                reviews = place.get("reviews") or []
                entry["review_glutenfree_mentions"] = count_glutenfree_mentions(reviews)

        results[osm_id] = entry

        if entry["allows_dogs"] is True:
            dogs_yes += 1
        elif entry["allows_dogs"] is False:
            dogs_no += 1
        if entry["review_glutenfree_mentions"] >= 2:
            gf_hits += 1

        if (i + 1) % 25 == 0 or i + 1 == len(to_fetch):
            print(f"  {i+1}/{len(to_fetch)} (hundar: {dogs_yes} ja / {dogs_no} nej, glutenfri-hits: {gf_hits})")
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(results, f, ensure_ascii=False, indent=2)

        time.sleep(0.1)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    total_dogs_yes = sum(1 for r in results.values() if r.get("allows_dogs") is True)
    total_dogs_no = sum(1 for r in results.values() if r.get("allows_dogs") is False)
    total_gf = sum(1 for r in results.values() if r.get("review_glutenfree_mentions", 0) >= 2)
    print(f"\nKlart! {len(results)} venues backfillade:")
    print(f"  allowsDogs=true: {total_dogs_yes}")
    print(f"  allowsDogs=false: {total_dogs_no}")
    print(f"  Reviews nämner glutenfri ≥2 ggr: {total_gf}")
    print(f"  Sparat till {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
