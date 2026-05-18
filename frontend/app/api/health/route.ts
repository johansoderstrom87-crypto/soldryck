import { stat, readdir } from "node:fs/promises";
import path from "node:path";
import { loadVenues } from "../../lib/venues-server";

export const dynamic = "force-dynamic";

/**
 * Liveness + data-readiness probe. Designed to be cheap enough for an
 * uptime monitor to poll every minute, while still surfacing the
 * conditions that have actually broken Soldryck in past incidents:
 *  - Pipeline regen forgot to update the JSON → `venues.count` drops to 0
 *  - Railway volume re-creation lost shadow data → `shadows.count` drops
 *  - Static build missed the public/data directory → JSON file missing
 *
 * Returns HTTP 200 with `ok: false` when any sub-check failed, so the
 * monitor can alert on body content rather than just the status code.
 */
export async function GET() {
  const startedAt = Date.now();
  const checks = {
    venues: await checkVenues(),
    shadows: await checkShadows(),
  };
  const ok = checks.venues.ok && checks.shadows.ok;

  return Response.json({
    ok,
    checks,
    elapsedMs: Date.now() - startedAt,
    builtAt: new Date().toISOString(),
  });
}

async function checkVenues(): Promise<{ ok: boolean; count: number; updatedAt: string | null; error?: string }> {
  try {
    const file = path.join(process.cwd(), "public", "data", "venues-computed.json");
    const [stats, venues] = await Promise.all([stat(file), loadVenues()]);
    return {
      ok: venues.length > 100,
      count: venues.length,
      updatedAt: stats.mtime.toISOString(),
    };
  } catch (err) {
    return { ok: false, count: 0, updatedAt: null, error: (err as Error).message };
  }
}

async function checkShadows(): Promise<{ ok: boolean; count: number; path: string }> {
  const shadowPath = process.env.SHADOW_DATA_PATH
    ?? path.join(process.cwd(), "public", "shadows");
  try {
    const entries = await readdir(shadowPath);
    const gz = entries.filter((e) => e.endsWith(".json.gz"));
    // Pipeline produces 187 timepoints — anything well below means a
    // volume re-seed didn't finish, or the env var points somewhere wrong.
    return { ok: gz.length >= 100, count: gz.length, path: shadowPath };
  } catch {
    return { ok: false, count: 0, path: shadowPath };
  }
}
