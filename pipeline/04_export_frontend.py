"""
Steg 4: Exportera beräkningsresultaten till en TypeScript-fil för frontend.
"""

import json


def export_to_frontend():
    with open("data/shadow_results.json", "r", encoding="utf-8") as f:
        results = json.load(f)

    # Konvertera till frontend-format
    venues = []
    for venue_id, data in results.items():
        venues.append(
            {
                "id": venue_id,
                "name": data["name"],
                "lat": data["lat"],
                "lng": data["lng"],
                "type": data["type"],
                "schedule": data["schedule"],
            }
        )

    # Skriv som TypeScript
    ts_output = f"""// Auto-genererad fil — kör inte manuellt
// Genererad av pipeline/04_export_frontend.py
import type {{ Venue }} from "./mock-venues";

export const venues: Venue[] = {json.dumps(venues, ensure_ascii=False, indent=2)};
"""

    output_path = "../frontend/app/data/venues.ts"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(ts_output)

    print(f"Exporterat {len(venues)} platser till {output_path}")


if __name__ == "__main__":
    export_to_frontend()
