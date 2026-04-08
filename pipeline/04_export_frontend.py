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
OUTPUT_FILE = os.path.join(
    os.path.dirname(__file__), "..", "frontend", "app", "data", "venues-computed.ts"
)


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


def main():
    print("=== Steg 4: Exportera till frontend ===")

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        results = json.load(f)

    print(f"Läste {len(results)} platser")

    # Bygg venues-array
    venues = []
    for venue_id, data in results.items():
        venues.append(
            {
                "id": venue_id,
                "name": data["name"],
                "lat": round(data["lat"], 6),
                "lng": round(data["lng"], 6),
                "type": data["type"],
                "address": data.get("address", ""),
                "schedule": compact_schedule(data["schedule"]),
            }
        )

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
  /** schedule[MM-DD][hour] = SunStatus */
  schedule: Record<string, Record<string, SunStatus>>;
}}

export const STATUS_LABELS: Record<SunStatus, string> = {{
  s: "Sol",
  d: "Skugga",
  p: "Delvis sol",
  n: "Natt",
}};

export const venues: ComputedVenue[] = {json.dumps(venues, ensure_ascii=False, separators=(',', ':'))};

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
