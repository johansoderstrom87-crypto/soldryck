import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      max: 5,
    });
  }
  return pool;
}

export async function ensureTable() {
  const p = getPool();
  if (!p) return;
  await p.query(`
    CREATE TABLE IF NOT EXISTS feedback (
      id SERIAL PRIMARY KEY,
      venue_id TEXT NOT NULL,
      venue_name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'schedule',
      schedule JSONB NOT NULL DEFAULT '{}'::jsonb,
      comment TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await p.query(`ALTER TABLE feedback ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'schedule'`);
}

export async function ensureSuggestionsTable() {
  const p = getPool();
  if (!p) return;
  await p.query(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id SERIAL PRIMARY KEY,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function ensurePushTable() {
  const p = getPool();
  if (!p) return;
  await p.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      subscription JSONB NOT NULL,
      favorite_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      last_notified_date TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function ensureEventsTable() {
  const p = getPool();
  if (!p) return;
  // Anonymous event stream — no user-identifying data, just session id and
  // a small JSONB payload. Indexed by name + time so the admin view can
  // produce "events per hour" / "top events"-counts without scanning all
  // rows. Older rows can be deleted periodically with a simple cron.
  await p.query(`
    CREATE TABLE IF NOT EXISTS events (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT,
      name TEXT NOT NULL,
      props JSONB NOT NULL DEFAULT '{}'::jsonb,
      path TEXT,
      occurred_at TIMESTAMPTZ NOT NULL,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await p.query(`CREATE INDEX IF NOT EXISTS events_name_received_idx ON events (name, received_at DESC)`);
  await p.query(`CREATE INDEX IF NOT EXISTS events_session_idx ON events (session_id, received_at DESC)`);
}
