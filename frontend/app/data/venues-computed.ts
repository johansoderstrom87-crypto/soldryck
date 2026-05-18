// Datadelen av denna fil flyttades till `public/data/venues-computed.json`
// — den här filen exporterar bara typer, helpers och en liten mutable
// store som datan fetchas in i. Bundle-storleken på huvud-JS-paketet sjönk
// från ~6 MB till några KB; JSON-payloaden hämtas separat på client.
//
// Pipeline-genereraren `pipeline/04_export_frontend.py` skriver numera
// JSON-filen direkt. Om du saknar den, kör pipelinen igen — eller
// regenerera från en gammal `.ts.bak` med:
//   awk 'NR==31{sub(/^export const venues = /,"");sub(/ as any.*$/,"");print}' \
//     venues-computed.ts.bak > ../public/data/venues-computed.json

import { useSyncExternalStore } from "react";

export type SunStatus = "s" | "d" | "p" | "n";
// s = sol, d = skugga (darkness), p = delvis sol, n = natt

export interface ComputedVenue {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  address: string;
  rooftop?: boolean;
  servesAlcohol?: boolean;
  rating?: number;
  ratingCount?: number;
  /** Google Places price-level: 1 ($) – 4 ($$$$). Populated by pipeline
   *  step 07 — older JSON exports may omit it. */
  priceLevel?: number;
  /** OSM wheelchair tag: "yes" | "no" | "limited". */
  wheelchair?: string;
  /** schedule[MM-DD][hour] = SunStatus */
  schedule: Record<string, Record<string, SunStatus>>;
}

export const STATUS_LABELS: Record<SunStatus, string> = {
  s: "Sol",
  d: "Skugga",
  p: "Delvis sol",
  n: "Natt",
};

// --- Store ------------------------------------------------------------------

let venuesStore: ComputedVenue[] = [];
const listeners = new Set<() => void>();

/** Replace the entire venues store. Called by page.tsx once the JSON arrives. */
export function setVenues(v: ComputedVenue[]): void {
  venuesStore = v;
  for (const fn of listeners) fn();
}

/** Synchronous snapshot — useful outside React (event handlers, refs). */
export function getVenues(): ComputedVenue[] {
  return venuesStore;
}

/** React hook — subscribes to store changes so consumers re-render when data
 *  arrives. Returns an empty array until `setVenues()` has been called. */
export function useVenues(): ComputedVenue[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    () => venuesStore,
    () => venuesStore,
  );
}

// --- Helpers (pure, no data dependency) -------------------------------------

/** Hitta närmaste tillgängliga datum-nyckel */
export function getClosestDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = date.getDate();
  const snapDay = day < 8 ? "01" : day < 23 ? "15" : "01";
  const snapMonth = day >= 23
    ? String(Math.min(date.getMonth() + 2, 12)).padStart(2, "0")
    : month;
  return `${snapMonth}-${snapDay}`;
}

/** Hämta status för en plats vid specifik tid */
export function getVenueStatus(venue: ComputedVenue, dateKey: string, hour: number): SunStatus {
  return venue.schedule[dateKey]?.[String(hour)] ?? "d";
}

/** Räkna soltimmar för en plats på ett datum */
export function getSunHours(venue: ComputedVenue, dateKey: string): number {
  const day = venue.schedule[dateKey];
  if (!day) return 0;
  return Object.values(day).filter((s) => s === "s").length;
}
