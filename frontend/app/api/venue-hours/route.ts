import { NextRequest } from "next/server";

type HoursInfo = {
  openNow: boolean | null;
  closesAt: string | null; // "22:00"
  weekday: string[] | null; // ["Måndag: 11:00–22:00", ...]
};

const cache = new Map<string, { info: HoursInfo; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days

const WEEKDAY_SV = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];

function emptyInfo(): HoursInfo {
  return { openNow: null, closesAt: null, weekday: null };
}

export async function GET(req: NextRequest) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return Response.json(emptyInfo());
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") ?? "";
  const name = searchParams.get("name") ?? "";
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!name || !lat || !lng) {
    return Response.json({ error: "Saknar params" }, { status: 400 });
  }

  const cached = cache.get(id);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return Response.json(cached.info);
  }

  try {
    const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.regularOpeningHours.weekdayDescriptions,places.currentOpeningHours.openNow,places.currentOpeningHours.periods",
      },
      body: JSON.stringify({
        textQuery: `${name} Stockholm`,
        locationBias: {
          circle: {
            center: { latitude: Number(lat), longitude: Number(lng) },
            radius: 200,
          },
        },
        maxResultCount: 1,
      }),
    });

    if (!searchRes.ok) {
      const info = emptyInfo();
      cache.set(id, { info, ts: Date.now() });
      return Response.json(info);
    }

    const data = await searchRes.json();
    const place = data.places?.[0];
    if (!place) {
      const info = emptyInfo();
      cache.set(id, { info, ts: Date.now() });
      return Response.json(info);
    }

    const regular = place.regularOpeningHours?.weekdayDescriptions as string[] | undefined;
    const current = place.currentOpeningHours;
    const openNow = typeof current?.openNow === "boolean" ? current.openNow : null;

    // Find today's closing time if open now
    let closesAt: string | null = null;
    if (openNow && Array.isArray(current?.periods)) {
      const now = new Date();
      const weekday = (now.getDay() + 6) % 7; // JS: 0=Sun, we want 0=Mon
      for (const p of current.periods) {
        const openDay = p.open?.day;
        const closeDay = p.close?.day;
        // Places API day: 0=Sun..6=Sat. Convert to 0=Mon..6=Sun.
        const convert = (d: number) => (d + 6) % 7;
        if (openDay === undefined) continue;
        if (convert(openDay) === weekday) {
          const h = p.close?.hour;
          const m = p.close?.minute ?? 0;
          if (typeof h === "number") {
            closesAt = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          }
          break;
        }
        if (closeDay !== undefined && convert(closeDay) === weekday) {
          const h = p.close?.hour;
          const m = p.close?.minute ?? 0;
          if (typeof h === "number") {
            closesAt = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          }
          break;
        }
      }
    }

    // Places API returns weekday descriptions starting with Monday when lang=sv.
    // If missing, build our own from periods; otherwise just use Google's.
    const weekdayDescriptions = regular && regular.length === 7 ? regular : buildWeekdayFromPeriods(current?.periods);

    const info: HoursInfo = {
      openNow,
      closesAt,
      weekday: weekdayDescriptions,
    };

    cache.set(id, { info, ts: Date.now() });
    return Response.json(info);
  } catch (err) {
    console.error("venue-hours error:", err);
    const info = emptyInfo();
    cache.set(id, { info, ts: Date.now() });
    return Response.json(info);
  }
}

function buildWeekdayFromPeriods(periods: unknown): string[] | null {
  if (!Array.isArray(periods) || periods.length === 0) return null;
  const byDay: Record<number, string[]> = {};
  for (const p of periods as Array<{ open?: { day?: number; hour?: number; minute?: number }; close?: { hour?: number; minute?: number } }>) {
    const d = p.open?.day;
    if (typeof d !== "number") continue;
    const dayIdx = (d + 6) % 7; // Mon=0
    const openH = p.open?.hour ?? 0;
    const openM = p.open?.minute ?? 0;
    const closeH = p.close?.hour ?? 0;
    const closeM = p.close?.minute ?? 0;
    const segment = `${String(openH).padStart(2, "0")}:${String(openM).padStart(2, "0")}–${String(closeH).padStart(2, "0")}:${String(closeM).padStart(2, "0")}`;
    (byDay[dayIdx] ??= []).push(segment);
  }
  return WEEKDAY_SV.map((name, i) => {
    const segs = byDay[i];
    return `${name}: ${segs && segs.length ? segs.join(", ") : "Stängt"}`;
  });
}
