import type { NextRequest } from "next/server";
import { getPool, ensureTable } from "../../lib/db";

export const dynamic = "force-dynamic";

// Server-side roll-up cache. Keyed on venue id, bounded by Map size so a
// flood of unique ids can't blow memory. Cheap to skip on cache-miss
// because the DB query is indexed on venue_id.
const CACHE: Map<string, { at: number; reports: number; lastReportAt: string | null }> = new Map();
const TTL_MS = 5 * 60 * 1000; // 5 min — feedback flows in slowly enough
const MAX_CACHE = 500;

/**
 * Returns the number of user feedback rows we've collected for a venue in
 * the last 30 days. Used by the popup builder to render a tiny social-proof
 * chip ("✓ 4 rapporter") when the count is high enough to be meaningful.
 *
 * Anonymous — we never expose comment text or who submitted what, only the
 * aggregate count + most-recent timestamp.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id krävs" }, { status: 400 });

  const now = Date.now();
  const cached = CACHE.get(id);
  if (cached && now - cached.at < TTL_MS) {
    return Response.json({ reports: cached.reports, lastReportAt: cached.lastReportAt });
  }

  const pool = getPool();
  if (!pool) return Response.json({ reports: 0, lastReportAt: null });

  try {
    await ensureTable();
    const { rows } = await pool.query<{ count: number; last_at: string | null }>(
      `SELECT COUNT(*)::int AS count, MAX(created_at)::text AS last_at
         FROM feedback
        WHERE venue_id = $1
          AND created_at > NOW() - INTERVAL '30 days'`,
      [id],
    );
    const reports = rows[0]?.count ?? 0;
    const lastReportAt = rows[0]?.last_at ?? null;

    // Bounded cache — drop oldest if we hit the lid.
    if (CACHE.size > MAX_CACHE) {
      const firstKey = CACHE.keys().next().value;
      if (firstKey !== undefined) CACHE.delete(firstKey);
    }
    CACHE.set(id, { at: now, reports, lastReportAt });

    return Response.json({ reports, lastReportAt });
  } catch (err) {
    console.error("venue-trust failed:", err);
    return Response.json({ reports: 0, lastReportAt: null });
  }
}
