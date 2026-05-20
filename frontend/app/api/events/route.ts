import { NextRequest } from "next/server";
import { getPool, ensureEventsTable } from "../../lib/db";
import { isAdminRequest, unauthorizedResponse } from "../../lib/admin-auth";

const MAX_BATCH = 60;
const MAX_NAME_LEN = 80;
const MAX_PATH_LEN = 200;
const MAX_SESSION_LEN = 60;

interface IncomingEvent {
  name: string;
  props: Record<string, unknown>;
  t: number;
}

/**
 * Anonymous event sink. Producer side is `lib/analytics.ts`, which batches
 * via `sendBeacon` so this route is fire-and-forget — we always return 204
 * to avoid blocking the browser's beacon retry.
 *
 * No IP, user agent, or referer is persisted; only what the producer sent.
 * If the DB isn't configured we accept and drop, so the app keeps working.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      sessionId?: unknown;
      path?: unknown;
      events?: unknown;
    };

    const events = Array.isArray(body.events) ? (body.events as IncomingEvent[]) : [];
    if (events.length === 0) return new Response(null, { status: 204 });

    const pool = getPool();
    if (!pool) return new Response(null, { status: 204 });

    await ensureEventsTable();

    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId.slice(0, MAX_SESSION_LEN) : null;
    const path = typeof body.path === "string" ? body.path.slice(0, MAX_PATH_LEN) : null;

    // Cap batch size so a buggy / hostile client can't flood the table.
    const trimmed = events.slice(0, MAX_BATCH);

    // Build a single multi-row insert. UNNEST keeps it to one round-trip.
    const names: string[] = [];
    const props: string[] = [];
    const occurredAt: Date[] = [];
    for (const e of trimmed) {
      if (typeof e?.name !== "string") continue;
      names.push(e.name.slice(0, MAX_NAME_LEN));
      props.push(JSON.stringify(e.props && typeof e.props === "object" ? e.props : {}));
      occurredAt.push(new Date(typeof e.t === "number" ? e.t : Date.now()));
    }
    if (names.length === 0) return new Response(null, { status: 204 });

    await pool.query(
      `INSERT INTO events (session_id, name, props, path, occurred_at)
       SELECT $1, n, p::jsonb, $2, t
       FROM unnest($3::text[], $4::text[], $5::timestamptz[]) AS u(n, p, t)`,
      [sessionId, path, names, props, occurredAt],
    );

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("events POST failed:", err);
    // Still return 204 — analytics failures must never affect the client.
    return new Response(null, { status: 204 });
  }
}

/**
 * Admin readout — protected by ADMIN_KEY query string. Returns a coarse
 * roll-up of the last 7 days so you don't pull millions of rows for a
 * dashboard view. Add more aggregations as needed.
 */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  const pool = getPool();
  if (!pool) return Response.json({ error: "DB ej konfigurerad" }, { status: 503 });

  await ensureEventsTable();

  const counts = await pool.query(`
    SELECT name, COUNT(*)::int AS n,
           COUNT(DISTINCT session_id)::int AS sessions
      FROM events
     WHERE received_at > NOW() - INTERVAL '7 days'
     GROUP BY name
     ORDER BY n DESC
  `);
  const totals = await pool.query(`
    SELECT COUNT(*)::int AS total,
           COUNT(DISTINCT session_id)::int AS sessions
      FROM events
     WHERE received_at > NOW() - INTERVAL '7 days'
  `);

  return Response.json({
    window: "7d",
    totals: totals.rows[0],
    counts: counts.rows,
  });
}
