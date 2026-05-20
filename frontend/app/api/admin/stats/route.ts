import type { NextRequest } from "next/server";
import { getPool, ensureEventsTable } from "../../../lib/db";
import { loadVenues } from "../../../lib/venues-server";

export const dynamic = "force-dynamic";

function clampDays(d: string | null): number {
  const n = Number(d ?? 7);
  if (!Number.isFinite(n) || n < 1) return 7;
  return Math.min(90, Math.floor(n));
}

let venueIndex: Map<string, { name: string; type: string }> | null = null;
async function getVenueIndex(): Promise<Map<string, { name: string; type: string }>> {
  if (venueIndex) return venueIndex;
  const list = await loadVenues();
  const m = new Map<string, { name: string; type: string }>();
  for (const v of list) m.set(String(v.id), { name: v.name, type: v.type });
  venueIndex = m;
  return m;
}

export async function GET(req: NextRequest) {
  const days = clampDays(req.nextUrl.searchParams.get("days"));
  const interval = `${days} days`;

  const pool = getPool();
  if (!pool) return Response.json({ error: "DB ej konfigurerad" }, { status: 503 });

  await ensureEventsTable();

  const [totals, eventCounts, topVenues, daily] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(DISTINCT session_id)::int AS sessions,
         COUNT(*) FILTER (WHERE name = 'page_view')::int AS page_views,
         COUNT(*) FILTER (WHERE name = 'popup_opened')::int AS popup_opens,
         COUNT(*) FILTER (WHERE name = 'book_clicked')::int AS bookings,
         COUNT(*) FILTER (WHERE name = 'share_clicked')::int AS shares,
         COUNT(*) FILTER (WHERE name = 'find_sun_clicked')::int AS find_sun,
         COUNT(*) FILTER (WHERE name = 'favorite_added')::int AS favorites_added
       FROM events
       WHERE received_at > NOW() - $1::interval`,
      [interval],
    ),
    pool.query(
      `SELECT name,
              COUNT(*)::int AS n,
              COUNT(DISTINCT session_id)::int AS sessions
         FROM events
        WHERE received_at > NOW() - $1::interval
        GROUP BY name
        ORDER BY n DESC`,
      [interval],
    ),
    pool.query(
      `SELECT props->>'id'   AS venue_id,
              props->>'type' AS venue_type,
              COUNT(*)::int  AS opens,
              COUNT(DISTINCT session_id)::int AS unique_sessions
         FROM events
        WHERE name = 'popup_opened'
          AND received_at > NOW() - $1::interval
          AND props->>'id' IS NOT NULL
        GROUP BY props->>'id', props->>'type'
        ORDER BY opens DESC
        LIMIT 30`,
      [interval],
    ),
    pool.query(
      `SELECT DATE_TRUNC('day', received_at) AS day,
              COUNT(DISTINCT session_id)::int AS sessions,
              COUNT(*) FILTER (WHERE name = 'page_view')::int AS page_views,
              COUNT(*) FILTER (WHERE name = 'popup_opened')::int AS popup_opens
         FROM events
        WHERE received_at > NOW() - $1::interval
        GROUP BY day
        ORDER BY day ASC`,
      [interval],
    ),
  ]);

  const idx = await getVenueIndex();
  const topVenuesEnriched = topVenues.rows.map((r: { venue_id: string; venue_type: string | null; opens: number; unique_sessions: number }) => ({
    id: r.venue_id,
    name: idx.get(r.venue_id)?.name ?? `Venue ${r.venue_id}`,
    type: r.venue_type ?? idx.get(r.venue_id)?.type ?? "?",
    opens: r.opens,
    uniqueSessions: r.unique_sessions,
  }));

  return Response.json({
    window: `${days}d`,
    totals: totals.rows[0] ?? {},
    eventCounts: eventCounts.rows,
    topVenues: topVenuesEnriched,
    daily: daily.rows.map((r: { day: string; sessions: number; page_views: number; popup_opens: number }) => ({
      day: typeof r.day === "string" ? r.day : new Date(r.day).toISOString(),
      sessions: r.sessions,
      pageViews: r.page_views,
      popupOpens: r.popup_opens,
    })),
  });
}
