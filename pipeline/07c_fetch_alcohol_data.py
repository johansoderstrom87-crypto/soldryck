"""
Steg 7c: Hämta alkoholdata för redan Google-verifierade venues.

Läser outdoor_verification.json + outdoor_verification_negative.json och
hämtar servesBeer/servesWine/servesLiquor via place ID för venues som:
  - har outdoor_seating=True (bekräftad uteservering)
  - har ett google_id sparat
  - saknar serves_alcohol-nyckeln (verifierades innan steg 7c lades till)

Använder Places API GET /places/{id} — ett anrop per venue, ingen ny sökning.
Tar ca 2-3 min för ~1500 venues. Kräver GOOGLE_PLACES_API_KEY.

Kör sedan:
  python 08_merge_verified_venues.py
  python 04_export_frontend.py
"""

import json
import os
import time
import urllib.request

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
VERIFICATION_FILE = os.path.join(DATA_DIR, "outdoor_verification.json")
VERIFICATION_NEG_FILE = os.path.join(DATA_DIR, "outdoor_verification_negative.json")

API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")
PLACES_BASE = "https://places.googleapis.com/v1/places"


def fetch_alcohol(place_id: str) -> bool | None:
    """Hämta alkoholfält via Google Places place ID. Returnerar True/False/None."""
    req = urllib.request.Request(
        f"{PLACES_BASE}/{place_id}",
        headers={
            "X-Goog-Api-Key": API_KEY,
            "X-Goog-FieldMask": "servesBeer,servesWine,servesCocktails",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            place = json.loads(resp.read().decode("utf-8"))
        beer = place.get("servesBeer")
        wine = place.get("servesWine")
        cocktails = place.get("servesCocktails")
        if beer or wine or cocktails:
            return True
        if beer is False and wine is False and cocktails is False:
            return False
        return None
    except Exception as e:
        print(f"    API-fel ({place_id[:20]}...): {e}")
        return None


def update_file(path: str, outdoor_key: str, label: str) -> int:
    """Uppdatera en verifieringsfil med alkoholdata. Returnerar antal uppdaterade."""
    if not os.path.exists(path):
        print(f"  {label}: filen saknas, hoppar över")
        return 0

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    to_update = [
        (osm_id, entry)
        for osm_id, entry in data.items()
        if entry.get(outdoor_key) is True
        and entry.get("google_id")
        and entry.get("serves_alcohol") is not True  # retry None (prev errors) and missing
    ]

    already_done = sum(1 for e in data.values() if e.get("serves_alcohol") is True)
    print(f"  {label}: {len(to_update)} saknar alkoholdata, {already_done} redan klara")

    if not to_update:
        return 0

    yes = no = unknown = 0
    for i, (osm_id, entry) in enumerate(to_update):
        serves_alcohol = fetch_alcohol(entry["google_id"])
        data[osm_id]["serves_alcohol"] = serves_alcohol

        if serves_alcohol is True:
            yes += 1
        elif serves_alcohol is False:
            no += 1
        else:
            unknown += 1

        if (i + 1) % 50 == 0 or i + 1 == len(to_update):
            print(f"    [{i+1}/{len(to_update)}] ja={yes} nej={no} okänt={unknown}")
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

        time.sleep(0.1)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return len(to_update)


def main():
    print("=== Steg 7c: Hämta alkoholdata för bekräftade venues ===\n")

    if not API_KEY:
        print("  GOOGLE_PLACES_API_KEY ej satt!")
        return

    upd1 = update_file(VERIFICATION_FILE, "outdoor_seating", "outdoor_verification.json")
    print()
    upd2 = update_file(VERIFICATION_NEG_FILE, "google_outdoor_seating", "outdoor_verification_negative.json")

    print(f"\nKlart! {upd1 + upd2} venues uppdaterade.")
    print("\nNästa steg:")
    print("  python 08_merge_verified_venues.py")
    print("  python 04_export_frontend.py")


if __name__ == "__main__":
    main()
