import { NextRequest } from "next/server";
import { getPool, ensurePushTable } from "../../../lib/db";

export async function POST(req: NextRequest) {
  const pool = getPool();
  if (!pool) return Response.json({ error: "Databas ej konfigurerad" }, { status: 503 });

  try {
    await ensurePushTable();
    const { subscription, favoriteIds } = await req.json();
    if (!subscription?.endpoint) {
      return Response.json({ error: "Saknar subscription" }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO push_subscriptions (endpoint, subscription, favorite_ids)
       VALUES ($1, $2, $3)
       ON CONFLICT (endpoint) DO UPDATE SET subscription = $2, favorite_ids = $3`,
      [subscription.endpoint, JSON.stringify(subscription), JSON.stringify(favoriteIds || [])]
    );
    return Response.json({ ok: true });
  } catch (err) {
    console.error("push subscribe error:", err);
    return Response.json({ error: "Kunde inte spara" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const pool = getPool();
  if (!pool) return Response.json({ error: "Databas ej konfigurerad" }, { status: 503 });

  try {
    await ensurePushTable();
    const { endpoint, favoriteIds } = await req.json();
    if (!endpoint) return Response.json({ error: "Saknar endpoint" }, { status: 400 });

    await pool.query(
      `UPDATE push_subscriptions SET favorite_ids = $2 WHERE endpoint = $1`,
      [endpoint, JSON.stringify(favoriteIds || [])]
    );
    return Response.json({ ok: true });
  } catch (err) {
    console.error("push patch error:", err);
    return Response.json({ error: "Kunde inte uppdatera" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const pool = getPool();
  if (!pool) return Response.json({ error: "Databas ej konfigurerad" }, { status: 503 });

  try {
    await ensurePushTable();
    const { endpoint } = await req.json();
    if (!endpoint) return Response.json({ error: "Saknar endpoint" }, { status: 400 });

    await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("push delete error:", err);
    return Response.json({ error: "Kunde inte ta bort" }, { status: 500 });
  }
}
