"""
Steg 8: Slå ihop Google-verifierade venues med huvudlistan.

Läser outdoor_verification.json och outdoor_verification_negative.json och:
- Flyttar venues med outdoorSeating=true till venues.geojson (för solberäkning)
- Genererar venues-unconfirmed.ts med taggar (google_denied / unknown)
- Taggar alla venues med källa så vi kan spåra varifrån datan kommer

Taggar (source):
  osm_confirmed     = outdoor_seating-tagg i OSM
  google_confirmed  = Google Places säger outdoorSeating=true (OSM saknade tagg)
  osm_no_google_yes = OSM sa nej, men Google säger ja (override OSM)
  google_denied     = Google Places säger outdoorSeating=false
  unknown           = Varken OSM eller Google har info
"""

import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
VENUES_FILE = os.path.join(DATA_DIR, "venues.geojson")
VERIFICATION_FILE = os.path.join(DATA_DIR, "outdoor_verification.json")
VERIFICATION_NEG_FILE = os.path.join(DATA_DIR, "outdoor_verification_negative.json")
RAW_UNCONFIRMED = os.path.join(DATA_DIR, "raw", "osm_unconfirmed_venues.json")
RAW_NEGATIVE = os.path.join(DATA_DIR, "raw", "osm_outdoor_no.json")
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "app", "data")
UNCONFIRMED_TS = os.path.join(FRONTEND_DIR, "venues-unconfirmed.ts")


def main():
    print("=== Steg 8: Slå ihop verifierade venues ===")

    with open(VENUES_FILE, "r", encoding="utf-8") as f:
        venues_geojson = json.load(f)

    with open(VERIFICATION_FILE, "r", encoding="utf-8") as f:
        verification = json.load(f)

    with open(RAW_UNCONFIRMED, "r", encoding="utf-8") as f:
        raw_unconfirmed = json.load(f)

    existing_ids = set(feat["properties"]["id"] for feat in venues_geojson["features"])

    # Tag existing OSM-confirmed venues
    for feat in venues_geojson["features"]:
        feat["properties"]["source"] = "osm_confirmed"

    # Build lookup for unconfirmed venue elements
    elem_lookup = {}
    for el in raw_unconfirmed.get("elements", []):
        elem_lookup[str(el["id"])] = el

    # Process verified venues
    added_to_main = 0
    google_denied = []
    unknown_venues = []

    for osm_id, result in verification.items():
        if osm_id in existing_ids:
            continue

        el = elem_lookup.get(osm_id)
        if not el:
            continue

        tags = el.get("tags", {})
        name = tags.get("name", "")
        if not name:
            continue

        amenity = tags.get("amenity", "restaurant")
        if amenity not in ("restaurant", "cafe", "bar", "pub", "biergarten", "fast_food", "ice_cream", "food_court"):
            continue

        if el["type"] == "node":
            lat, lng = el["lat"], el["lon"]
        elif "center" in el:
            lat, lng = el["center"]["lat"], el["center"]["lon"]
        else:
            continue

        outdoor = result.get("outdoor_seating")

        if outdoor is True:
            # Add to main venue list for shadow computation
            venues_geojson["features"].append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lng, lat]},
                "properties": {
                    "id": osm_id,
                    "name": name,
                    "amenity": amenity,
                    "cuisine": tags.get("cuisine", ""),
                    "opening_hours": tags.get("opening_hours", ""),
                    "website": tags.get("website", tags.get("contact:website", "")),
                    "phone": tags.get("phone", tags.get("contact:phone", "")),
                    "addr_street": tags.get("addr:street", ""),
                    "addr_housenumber": tags.get("addr:housenumber", ""),
                    "level": tags.get("level", ""),
                    "outdoor_seating": tags.get("outdoor_seating", ""),
                    "source": "google_confirmed",
                    "google_place_id": result.get("google_id", ""),
                },
            })
            existing_ids.add(osm_id)
            added_to_main += 1

        elif outdoor is False:
            google_denied.append({
                "id": osm_id,
                "name": name,
                "lat": round(lat, 6),
                "lng": round(lng, 6),
                "type": amenity,
                "address": tags.get("addr:street", ""),
                "source": "google_denied",
            })

        else:
            unknown_venues.append({
                "id": osm_id,
                "name": name,
                "lat": round(lat, 6),
                "lng": round(lng, 6),
                "type": amenity,
                "address": tags.get("addr:street", ""),
                "source": "unknown",
            })

    # === Negativ-verifiering: OSM sa "no" men Google fick frågan ===
    added_from_negative = 0
    neg_denied = 0
    neg_unknown = 0

    if os.path.exists(VERIFICATION_NEG_FILE):
        with open(VERIFICATION_NEG_FILE, "r", encoding="utf-8") as f:
            negative = json.load(f)

        # Bygg lookup för raw-tagdata (för cuisine, opening_hours, etc.)
        neg_elem_lookup = {}
        if os.path.exists(RAW_NEGATIVE):
            with open(RAW_NEGATIVE, "r", encoding="utf-8") as f:
                raw_neg = json.load(f)
            for el in raw_neg.get("elements", []):
                neg_elem_lookup[str(el["id"])] = el

        for osm_id, result in negative.items():
            if osm_id in existing_ids:
                continue

            outdoor = result.get("google_outdoor_seating")
            name = result.get("name", "")
            amenity = result.get("amenity", "restaurant")
            lat = result.get("lat")
            lng = result.get("lng")

            if not name or lat is None or lng is None:
                continue
            if amenity not in ("restaurant", "cafe", "bar", "pub", "biergarten", "fast_food", "ice_cream", "food_court"):
                continue

            if outdoor is True:
                # Override OSM — lägg till på kartan
                el = neg_elem_lookup.get(osm_id)
                tags = el.get("tags", {}) if el else {}
                venues_geojson["features"].append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [lng, lat]},
                    "properties": {
                        "id": osm_id,
                        "name": name,
                        "amenity": amenity,
                        "cuisine": tags.get("cuisine", ""),
                        "opening_hours": tags.get("opening_hours", ""),
                        "website": tags.get("website", tags.get("contact:website", "")),
                        "phone": tags.get("phone", tags.get("contact:phone", "")),
                        "addr_street": tags.get("addr:street", result.get("addr_street", "")),
                        "addr_housenumber": tags.get("addr:housenumber", result.get("addr_housenumber", "")),
                        "level": tags.get("level", ""),
                        "outdoor_seating": "yes",  # Override OSM=no
                        "source": "osm_no_google_yes",
                        "google_place_id": result.get("google_id", ""),
                    },
                })
                existing_ids.add(osm_id)
                added_from_negative += 1

            elif outdoor is False:
                google_denied.append({
                    "id": osm_id,
                    "name": name,
                    "lat": round(lat, 6),
                    "lng": round(lng, 6),
                    "type": amenity,
                    "address": result.get("addr_street", ""),
                    "source": "google_denied",
                })
                neg_denied += 1
            else:
                unknown_venues.append({
                    "id": osm_id,
                    "name": name,
                    "lat": round(lat, 6),
                    "lng": round(lng, 6),
                    "type": amenity,
                    "address": result.get("addr_street", ""),
                    "source": "unknown",
                })
                neg_unknown += 1

        print(f"  + Fran negativ-verifiering: {added_from_negative} OSM-no->Google-yes (override),"
              f" {neg_denied} bada nej, {neg_unknown} okanda")

    # Save updated venues.geojson
    with open(VENUES_FILE, "w", encoding="utf-8") as f:
        json.dump(venues_geojson, f, ensure_ascii=False, indent=2)

    total_main = len(venues_geojson["features"])
    print(f"  {added_to_main} Google-bekräftade tillagda i venues.geojson")
    print(f"  Totalt i huvudlistan: {total_main}")

    # Generate unconfirmed TypeScript
    all_unconfirmed = google_denied + unknown_venues

    ts = f"""// Auto-generated: venues without confirmed outdoor seating
// source: google_denied = Google says no outdoor seating
// source: unknown = no data from either OSM or Google

export interface UnconfirmedVenue {{
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  address: string;
  source: "google_denied" | "unknown";
}}

export const unconfirmedVenues: UnconfirmedVenue[] = {json.dumps(all_unconfirmed, ensure_ascii=False, separators=(",", ":"))};
"""

    os.makedirs(FRONTEND_DIR, exist_ok=True)
    with open(UNCONFIRMED_TS, "w", encoding="utf-8") as f:
        f.write(ts)

    print(f"  {len(google_denied)} google_denied (grå + 'ingen uteservering')")
    print(f"  {len(unknown_venues)} unknown (grå)")
    print(f"  Sparat {UNCONFIRMED_TS} ({len(all_unconfirmed)} venues)")


if __name__ == "__main__":
    main()
