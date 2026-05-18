// Datadelen av denna fil flyttades till `public/data/venues-computed.json`
// — den här filen exporterar bara typer + pure helpers (inga React-APIs!)
// så att server-routes kan importera helpers utan att Turbopack drar in
// client-only `useSyncExternalStore` i server-bundlen.
//
// Den mutable store-delen (setVenues/getVenues/useVenues) lever i
// venues-store.ts med "use client".
//
// Pipeline-genereraren `pipeline/04_export_frontend.py` skriver JSON-filen
// direkt — den rör inte den här TS-filen.

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
