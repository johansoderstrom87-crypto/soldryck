import type { NextRequest } from "next/server";
import { getPool, ensureFavoriteSyncsTable } from "../../lib/db";

const MAX_FAVORITES = 200;
const CODE_LEN = 6;
// Unambiguous alphabet — no 0/1/O/I/L. 30^6 ≈ 729 M combinations, plenty
// for an anonymous sync system where collisions only matter while a code is
// active (we generate fresh ones if a candidate collides).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function newCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

function normaliseFavorites(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const trimmed = v.slice(0, 60); // venue ids are short
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= MAX_FAVORITES) break;
  }
  return out;
}

function normaliseCode(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.toUpperCase().replace(/[^A-Z2-9]/g, "");
  return cleaned.length === CODE_LEN ? cleaned : null;
}

/**
 * GET /api/favorites-sync?code=ABC123 → { favoriteIds: string[] }
 * Returns 404 if the code doesn't exist. Bumps last_seen_at so prune cron
 * can skip codes that someone is actively using.
 */
export async function GET(req: NextRequest) {
  const code = normaliseCode(req.nextUrl.searchParams.get("code"));
  if (!code) return Response.json({ error: "Ogiltig kod" }, { status: 400 });

  const pool = getPool();
  if (!pool) return Response.json({ error: "DB ej konfigurerad" }, { status: 503 });

  await ensureFavoriteSyncsTable();

  const { rows } = await pool.query<{ favorite_ids: string[] }>(
    `UPDATE favorite_syncs
        SET last_seen_at = NOW()
      WHERE code = $1
      RETURNING favorite_ids`,
    [code],
  );
  if (rows.length === 0) return Response.json({ error: "Koden hittades inte" }, { status: 404 });

  return Response.json({ favoriteIds: rows[0].favorite_ids ?? [] });
}

/**
 * POST /api/favorites-sync
 * Body: { favoriteIds: string[], code?: string }
 *  - With code → upsert that code (used by repeat pushes from same device)
 *  - Without code → generate a fresh one and insert
 * Returns: { code, favoriteIds }
 */
export async function POST(req: NextRequest) {
  let body: { favoriteIds?: unknown; code?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Ogiltig JSON" }, { status: 400 });
  }

  const favoriteIds = normaliseFavorites(body.favoriteIds);
  const requestedCode = typeof body.code === "string" ? normaliseCode(body.code) : null;

  const pool = getPool();
  if (!pool) return Response.json({ error: "DB ej konfigurerad" }, { status: 503 });

  await ensureFavoriteSyncsTable();

  // Reuse the requested code if it's well-formed. Otherwise generate one and
  // retry on collision (vanishingly rare with a 30^6 keyspace).
  let code = requestedCode;
  let inserted = false;
  for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
    const candidate = code ?? newCode();
    const { rowCount } = await pool.query(
      `INSERT INTO favorite_syncs (code, favorite_ids, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (code) DO UPDATE
       SET favorite_ids = EXCLUDED.favorite_ids,
           updated_at = NOW(),
           last_seen_at = NOW()`,
      [candidate, JSON.stringify(favoriteIds)],
    );
    if (rowCount && rowCount > 0) {
      code = candidate;
      inserted = true;
    } else {
      code = null; // try a fresh code next iteration
    }
  }

  if (!code) return Response.json({ error: "Kunde inte spara — försök igen" }, { status: 500 });
  return Response.json({ code, favoriteIds });
}
