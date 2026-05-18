// Server-side venues loader. The data file moved out of the JS bundle to
// `public/data/venues-computed.json` (see #29); this module reads it from
// disk and caches it in-process so /api routes can still look up venues by
// id without going through the client store.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ComputedVenue } from "../data/venues-computed";

let cache: ComputedVenue[] | null = null;
let inFlight: Promise<ComputedVenue[]> | null = null;

export async function loadVenues(): Promise<ComputedVenue[]> {
  if (cache) return cache;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const file = path.join(process.cwd(), "public", "data", "venues-computed.json");
    const buf = await readFile(file, "utf8");
    cache = JSON.parse(buf) as ComputedVenue[];
    return cache;
  })().finally(() => { inFlight = null; });
  return inFlight;
}
