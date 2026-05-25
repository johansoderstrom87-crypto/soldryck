import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

type DaySegment = { open: string; close: string };
type HoursInfo = {
  openNow: boolean | null;
  closesAt: string | null;
  week: DaySegment[][] | null;
};
type CacheEntry = { info: HoursInfo; ts: number };

// 90 days — opening hours rarely change, this triples cost-efficiency vs 30d
const CACHE_TTL = 1000 * 60 * 60 * 24 * 90;

// Resolve cache file path from the same Railway volume as shadow-data.
// Returns null in dev (no volume mounted) → falls back to in-memory only.
function cacheFilePath(): string | null {
  const dir = process.env.SHADOW_DATA_PATH;
  if (!dir) return null;
  return path.join(dir, "venue-hours-cache.json");
}

// In-memory layer — fast lookup, also the write buffer.
const cache = new Map<string, CacheEntry>();
let loaded = false;

function loadFromDisk(): void {
  if (loaded) return;
  loaded = true;
  const p = cacheFilePath();
  if (!p) return;
  try {
    if (!fs.existsSync(p)) return;
    const data = JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, CacheEntry>;
    for (const [id, entry] of Object.entries(data)) cache.set(id, entry);
    console.log(`[venue-hours] loaded ${cache.size} entries from disk cache`);
  } catch {
    console.warn("[venue-hours] disk cache unreadable — starting fresh");
  }
}

// Write the full cache to disk asynchronously (fire-and-forget).
// Writes to a tmp file then renames to avoid corruption on crash.
function saveToDisk(): void {
  const p = cacheFilePath();
  if (!p) return;
  const tmp = p + ".tmp";
  const data: Record<string, CacheEntry> = {};
  for (const [id, entry] of cache.entries()) data[id] = entry;
  fs.writeFile(tmp, JSON.stringify(data), "utf-8", (err) => {
    if (err) { console.warn("[venue-hours] cache write error:", err); return; }
    fs.rename(tmp, p, (err2) => {
      if (err2) console.warn("[venue-hours] cache rename error:", err2);
    });
  });
}

function emptyInfo(): HoursInfo {
  return { openNow: null, closesAt: null, week: null };
}

function hhmm(h?: number, m?: number): string {
  return `${String(h ?? 0).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;
}

function toMon0(d: number): number {
  return (d + 6) % 7;
}

function buildWeek(periods: unknown): DaySegment[][] | null {
  if (!Array.isArray(periods) || periods.length === 0) return null;
  const week: DaySegment[][] = [[], [], [], [], [], [], []];
  for (const p of periods as Array<{ open?: { day?: number; hour?: number; minute?: number }; close?: { day?: number; hour?: number; minute?: number } }>) {
    const openDay = p.open?.day;
    if (typeof openDay !== "number") continue;
    week[toMon0(openDay)].push({
      open: hhmm(p.open?.hour, p.open?.minute),
      close: hhmm(p.close?.hour, p.close?.minute),
    });
  }
  return week;
}

function venueTypeToPlacesTypes(type: string): string[] {
  switch (type) {
    case "restaurant": return ["restaurant"];
    case "cafe": return ["cafe"];
    case "bar": case "pub": return ["bar"];
    default: return ["restaurant", "bar", "cafe"];
  }
}

const FIELD_MASK =
  "places.id,places.regularOpeningHours.periods,places.currentOpeningHours.openNow,places.currentOpeningHours.periods";

async function findPlace(apiKey: string, name: string, lat: number, lng: number, venueType: string): Promise<any | null> {
  const textRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELD_MASK },
    body: JSON.stringify({
      textQuery: `${name} Stockholm`,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 200 } },
      maxResultCount: 1,
    }),
  });
  if (textRes.ok) {
    const data = await textRes.json();
    if (data.places?.[0]) return data.places[0];
  }

  const nearbyRes = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELD_MASK },
    body: JSON.stringify({
      includedTypes: venueTypeToPlacesTypes(venueType),
      maxResultCount: 1,
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 50 } },
    }),
  });
  if (nearbyRes.ok) {
    const data = await nearbyRes.json();
    if (data.places?.[0]) return data.places[0];
  }

  return null;
}

export async function GET(req: NextRequest) {
  loadFromDisk();

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return Response.json(emptyInfo());

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") ?? "";
  const name = searchParams.get("name") ?? "";
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const venueType = searchParams.get("type") ?? "";

  if (!name || !lat || !lng) return Response.json({ error: "Saknar params" }, { status: 400 });

  const cached = cache.get(id);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return Response.json(cached.info);

  try {
    const place = await findPlace(key, name, Number(lat), Number(lng), venueType);
    if (!place) {
      const info = emptyInfo();
      cache.set(id, { info, ts: Date.now() });
      saveToDisk();
      return Response.json(info);
    }

    const current = place.currentOpeningHours;
    const regular = place.regularOpeningHours;
    const openNow = typeof current?.openNow === "boolean" ? current.openNow : null;
    const week = buildWeek(regular?.periods) ?? buildWeek(current?.periods);

    let closesAt: string | null = null;
    if (openNow && Array.isArray(current?.periods)) {
      const todayMon0 = toMon0(new Date().getDay());
      for (const p of current.periods as Array<{ open?: { day?: number; hour?: number; minute?: number }; close?: { day?: number; hour?: number; minute?: number } }>) {
        if (typeof p.open?.day !== "number") continue;
        if (toMon0(p.open.day) === todayMon0 || (typeof p.close?.day === "number" && toMon0(p.close.day) === todayMon0)) {
          if (typeof p.close?.hour === "number") closesAt = hhmm(p.close.hour, p.close.minute);
          break;
        }
      }
    }

    const info: HoursInfo = { openNow, closesAt, week };
    cache.set(id, { info, ts: Date.now() });
    saveToDisk();
    return Response.json(info);
  } catch (err) {
    console.error("venue-hours error:", err);
    const info = emptyInfo();
    cache.set(id, { info, ts: Date.now() });
    saveToDisk();
    return Response.json(info);
  }
}
