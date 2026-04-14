import { NextRequest } from "next/server";

const cache = new Map<string, { photoUrl: string | null; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

export async function GET(req: NextRequest) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return Response.json({ photoUrl: null });
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
    return Response.json({ photoUrl: cached.photoUrl });
  }

  try {
    // Places API (New) — Text Search
    const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.photos",
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
      cache.set(id, { photoUrl: null, ts: Date.now() });
      return Response.json({ photoUrl: null });
    }

    const data = await searchRes.json();
    const photoName = data.places?.[0]?.photos?.[0]?.name;

    if (!photoName) {
      cache.set(id, { photoUrl: null, ts: Date.now() });
      return Response.json({ photoUrl: null });
    }

    // Build photo URL (Places API returns redirect — we fetch to get final URL)
    const photoRes = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400&skipHttpRedirect=true`,
      {
        headers: { "X-Goog-Api-Key": key },
      }
    );

    if (!photoRes.ok) {
      cache.set(id, { photoUrl: null, ts: Date.now() });
      return Response.json({ photoUrl: null });
    }

    const photoData = await photoRes.json();
    const photoUrl = photoData.photoUri ?? null;

    cache.set(id, { photoUrl, ts: Date.now() });
    return Response.json({ photoUrl });
  } catch (err) {
    console.error("venue-photo error:", err);
    cache.set(id, { photoUrl: null, ts: Date.now() });
    return Response.json({ photoUrl: null });
  }
}
