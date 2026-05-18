import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

export interface HappyHour {
  daysLabel: string;
  start: number;
  end: number;
  description: string;
}

export interface ClaimedVenueData {
  verifiedAt: string;
  ownerEmail?: string;
  ownerNotes?: string;
  happyHour?: HappyHour;
}

export interface ClaimedVenuesFile {
  _readme?: string;
  venues: Record<string, ClaimedVenueData>;
}

/**
 * Public view per venue — strips admin-only fields like ownerEmail/ownerNotes
 * so they don't leak through the public /api/claimed-venues endpoint.
 */
export interface PublicClaimedVenueData {
  verifiedAt: string;
  happyHour?: HappyHour;
}

const FILENAME = "claimed-venues.json";

function resolveWritePath(): string {
  if (process.env.CLAIMED_DATA_PATH) {
    return join(process.env.CLAIMED_DATA_PATH, FILENAME);
  }
  return join(process.cwd(), "app", "data", FILENAME);
}

function resolveReadPaths(): string[] {
  const paths: string[] = [];
  if (process.env.CLAIMED_DATA_PATH) {
    paths.push(join(process.env.CLAIMED_DATA_PATH, FILENAME));
  }
  paths.push(join(process.cwd(), "app", "data", FILENAME));
  paths.push(join(process.cwd(), "frontend", "app", "data", FILENAME));
  return paths;
}

let cache: { data: ClaimedVenuesFile; mtime: number } | null = null;

async function loadFile(): Promise<ClaimedVenuesFile> {
  for (const p of resolveReadPaths()) {
    if (!existsSync(p)) continue;
    const raw = await readFile(p, "utf-8");
    const parsed = JSON.parse(raw) as ClaimedVenuesFile;
    if (!parsed.venues || typeof parsed.venues !== "object") {
      parsed.venues = {};
    }
    return parsed;
  }
  return { venues: {} };
}

export async function getAllClaimedVenues(): Promise<ClaimedVenuesFile> {
  if (cache) return cache.data;
  const data = await loadFile();
  cache = { data, mtime: Date.now() };
  return data;
}

export async function getPublicClaimedVenues(): Promise<Record<string, PublicClaimedVenueData>> {
  const all = await getAllClaimedVenues();
  const out: Record<string, PublicClaimedVenueData> = {};
  for (const [id, v] of Object.entries(all.venues)) {
    out[id] = { verifiedAt: v.verifiedAt, ...(v.happyHour ? { happyHour: v.happyHour } : {}) };
  }
  return out;
}

async function saveFile(data: ClaimedVenuesFile): Promise<void> {
  const path = resolveWritePath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
  cache = { data, mtime: Date.now() };
}

export async function upsertClaim(venueId: string, data: ClaimedVenueData): Promise<void> {
  const all = await getAllClaimedVenues();
  all.venues[venueId] = data;
  await saveFile(all);
}

export async function deleteClaim(venueId: string): Promise<boolean> {
  const all = await getAllClaimedVenues();
  if (!(venueId in all.venues)) return false;
  delete all.venues[venueId];
  await saveFile(all);
  return true;
}
