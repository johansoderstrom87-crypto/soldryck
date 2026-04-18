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
OUTPUT_FILE = os.path.join(
    os.path.dirname(__file__), "..", "frontend", "app", "data", "venues-computed.ts"
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

    # Load venues.geojson for level data
    level_lookup = {}
    if os.path.exists(VENUES_FILE):
        with open(VENUES_FILE, "r", encoding="utf-8") as f:
            geojson = json.load(f)
        for feat in geojson["features"]:
            props = feat["properties"]
            level_lookup[str(props["id"])] = props.get("level", "")

    print(f"Läste {len(results)} platser")

    # Bygg venues-array
    venues = []
    rooftop_count = 0
    for venue_id, data in results.items():
        level = level_lookup.get(venue_id, "")
        rooftop = is_rooftop(data["name"], level)
        if rooftop:
            rooftop_count += 1
        venue = {
            "id": venue_id,
            "name": data["name"],
            "lat": round(data["lat"], 6),
            "lng": round(data["lng"], 6),
            "type": data["type"],
            "address": data.get("address", ""),
            "schedule": compact_schedule(data["schedule"]),
        }
        if rooftop:
            venue["rooftop"] = True
        venues.append(venue)

    print(f"  {rooftop_count} takbarer/takrestauranger")

    # Generera TypeScript
    ts_content = f"""// Auto-genererad av pipeline/04_export_frontend.py
// {len(venues)} uteserveringar i Stockholm med soldata
// Genererad: {__import__('datetime').datetime.now().isoformat()[:19]}

export type SunStatus = "s" | "d" | "p" | "n";
// s = sol, d = skugga (darkness), p = delvis sol, n = natt

export interface ComputedVenue {{
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  address: string;
  rooftop?: boolean;
  /** schedule[MM-DD][hour] = SunStatus */
  schedule: Record<string, Record<string, SunStatus>>;
}}

export const STATUS_LABELS: Record<SunStatus, string> = {{
  s: "Sol",
  d: "Skugga",
  p: "Delvis sol",
  n: "Natt",
}};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const venues = {json.dumps(venues, ensure_ascii=False, separators=(',', ':'))} as any as ComputedVenue[];

/** Hitta närmaste tillgängliga datum-nyckel */
export function getClosestDateKey(date: Date): string {{
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = date.getDate();
  const snapDay = day < 8 ? "01" : day < 23 ? "15" : "01";
  const snapMonth = day >= 23
    ? String(Math.min(date.getMonth() + 2, 12)).padStart(2, "0")
    : month;
  return `${{snapMonth}}-${{snapDay}}`;
}}

/** Hämta status för en plats vid specifik tid */
export function getVenueStatus(venue: ComputedVenue, dateKey: string, hour: number): SunStatus {{
  return venue.schedule[dateKey]?.[String(hour)] ?? "d";
}}

/** Räkna soltimmar för en plats på ett datum */
export function getSunHours(venue: ComputedVenue, dateKey: string): number {{
  const day = venue.schedule[dateKey];
  if (!day) return 0;
  return Object.values(day).filter((s) => s === "s").length;
}}
"""

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(ts_content)

    size_kb = os.path.getsize(OUTPUT_FILE) / 1024
    print(f"Exporterat {len(venues)} platser till {OUTPUT_FILE}")
    print(f"Filstorlek: {size_kb:.0f} KB")


if __name__ == "__main__":
    main()
