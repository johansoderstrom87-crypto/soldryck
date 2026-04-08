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
      schedule JSONB NOT NULL,
      comment TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
