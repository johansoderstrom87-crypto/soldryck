import { NextRequest } from "next/server";

const cache = new Map<string, { photoUrl: string | null; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

function venueTypeToPlacesTypes(type: string): string[] {
  switch (type) {
    case "restaurant": return ["restaurant"];
    case "cafe": return ["cafe"];
    case "bar": case "pub": return ["bar"];
    default: return ["restaurant", "bar", "cafe"];
  }
}

const FIELD_MASK = "places.id,places.photos";

async function findPlace(apiKey: string, name: string, lat: number, lng: number, venueType: string): Promise<any | null> {
  // 1. Text search by name — works when OSM name matches Google
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

  // 2. Fallback: nearby search by coordinates — finds whatever is actually there
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
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return Response.json({ photoUrl: null });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") ?? "";
  const name = searchParams.get("name") ?? "";
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const venueType = searchParams.get("type") ?? "";

  if (!name || !lat || !lng) return Response.json({ error: "Saknar params" }, { status: 400 });

  const cached = cache.get(id);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return Response.json({ photoUrl: cached.photoUrl });

  try {
    const place = await findPlace(key, name, Number(lat), Number(lng), venueType);
    const photoName = place?.photos?.[0]?.name;

    if (!photoName) {
      cache.set(id, { photoUrl: null, ts: Date.now() });
      return Response.json({ photoUrl: null });
    }

    const photoRes = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400&skipHttpRedirect=true`,
      { headers: { "X-Goog-Api-Key": key } },
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
