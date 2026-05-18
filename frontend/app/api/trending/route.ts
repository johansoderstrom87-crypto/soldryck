import type { NextRequest } from "next/server";
import { getPool, ensureEventsTable } from "../../lib/db";
import { loadVenues } from "../../lib/venues-server";

// Rolling-window cache so we don't hammer Postgres for every map open.
let cache: { at: number; data: TrendingItem[] } | null = null;
const TTL_MS = 60_000; // 1 min — trending changes slowly enough

interface TrendingItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  rooftop?: boolean;
  count: number;
}

/**
 * Top-N venues by popup_opened events in the last 24 h. Returns enriched
 * objects (name + coords + type) so the client can render straight from the
 * response without doing its own venue-id lookup.
 *
 * Falls back to an empty list if the DB isn't reachable; the UI hides the
 * Trending section in that case rather than showing a broken state.
 */
export async function GET(_req: NextRequest) {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return Response.json({ trending: cache.data });
  }

  const pool = getPool();
  if (!pool) return Response.json({ trending: [] });

  try {
    await ensureEventsTable();
    const { rows } = await pool.query<{ id: string; count: number }>(
      `SELECT props->>'id' AS id, COUNT(*)::int AS count
         FROM events
        WHERE name = 'popup_opened'
          AND received_at > NOW() - INTERVAL '24 hours'
          AND props ? 'id'
        GROUP BY props->>'id'
        ORDER BY count DESC
        LIMIT 5`,
    );

    if (rows.length === 0) {
      cache = { at: Date.now(), data: [] };
      return Response.json({ trending: [] });
    }

    const venues = await loadVenues();
    const byId = new Map(venues.map((v) => [String(v.id), v]));
    const trending: TrendingItem[] = [];
    for (const r of rows) {
      const v = byId.get(r.id);
      if (!v) continue;
      trending.push({
        id: String(v.id),
        name: v.name,
        lat: v.lat,
        lng: v.lng,
        type: v.type,
        rooftop: v.rooftop,
        count: r.count,
      });
    }

    cache = { at: Date.now(), data: trending };
    return Response.json({ trending });
  } catch (err) {
    console.error("trending failed:", err);
    return Response.json({ trending: [] });
  }
}
