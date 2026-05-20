// Server-side venue-lookup. Läser venues-computed.json från disk en gång
// vid första anrop och bygger en slug→venue Map. Cachas i process-minnet
// så efterföljande lookups är O(1). Används bara av SSR-sidor (/uteservering/*),
// inte av klient-koden — klient-koden får sin data via /api eller propagated
// fetch i page.tsx.

import { readFileSync } from "fs";
import { join } from "path";
import type { ComputedVenue } from "../data/venues-computed";
import { venueSlug } from "./slug";

let cachedVenues: ComputedVenue[] | null = null;
let cachedSlugMap: Map<string, ComputedVenue> | null = null;

function loadVenues(): ComputedVenue[] {
  if (cachedVenues) return cachedVenues;
  const path = join(process.cwd(), "public", "data", "venues-computed.json");
  const raw = readFileSync(path, "utf-8");
  cachedVenues = JSON.parse(raw) as ComputedVenue[];
  return cachedVenues;
}

function getSlugMap(): Map<string, ComputedVenue> {
  if (cachedSlugMap) return cachedSlugMap;
  const map = new Map<string, ComputedVenue>();
  for (const v of loadVenues()) {
    map.set(venueSlug(v), v);
  }
  cachedSlugMap = map;
  return map;
}

export function findVenueBySlug(slug: string): ComputedVenue | undefined {
  return getSlugMap().get(slug);
}

export function getAllVenues(): ComputedVenue[] {
  return loadVenues();
}
