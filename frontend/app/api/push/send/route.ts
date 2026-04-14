import { NextRequest } from "next/server";
import webpush from "web-push";
import { getPool, ensurePushTable } from "../../../lib/db";
import { venues, getClosestDateKey, getVenueStatus } from "../../../data/venues-computed";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:hej@soldryck.se";
const CRON_SECRET = process.env.CRON_SECRET;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

async function fetchStockholmWeather() {
  try {
    const res = await fetch(
      "https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/18.07/lat/59.33/data.json"
    );
    if (!res.ok) return null;
    const raw = await res.json();
    const out: Record<number, { symbolCode: number; temperature: number }> = {};
    const today = new Date().toISOString().slice(0, 10);
    for (const entry of raw.timeSeries || []) {
      if (!entry.time?.startsWith(today)) continue;
      const hour = new Date(entry.time).getHours();
      const d: Record<string, number> = entry.data ?? {};
      out[hour] = {
        symbolCode: d.symbol_code ?? 1,
        temperature: d.air_temperature ?? 0,
      };
    }
    return out;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return Response.json({ error: "VAPID-nycklar saknas" }, { status: 503 });
  }

  const pool = getPool();
  if (!pool) return Response.json({ error: "Databas ej konfigurerad" }, { status: 503 });

  await ensurePushTable();

  const now = new Date();
  const hour = now.getHours();
  if (hour < 8 || hour > 20) {
    return Response.json({ ok: true, skipped: "outside hours" });
  }

  const today = now.toISOString().slice(0, 10);
  const dateKey = getClosestDateKey(now);
  const weather = await fetchStockholmWeather();
  const currentWeather = weather?.[hour];

  // Only notify on good weather days — sunny/clear
  if (!currentWeather || currentWeather.symbolCode > 4) {
    return Response.json({ ok: true, skipped: "bad weather" });
  }

  const venueMap = new Map(venues.map((v) => [v.id, v]));
  const { rows } = await pool.query<{
    endpoint: string;
    subscription: any;
    favorite_ids: string[];
    last_notified_date: string | null;
  }>(`SELECT endpoint, subscription, favorite_ids, last_notified_date FROM push_subscriptions`);

  let sent = 0;
  const toDelete: string[] = [];

  for (const row of rows) {
    if (row.last_notified_date === today) continue;

    const favs = (row.favorite_ids ?? []).map((id) => venueMap.get(id)).filter(Boolean);
    if (favs.length === 0) continue;

    // Any favorite with sun right now?
    const sunny = favs.filter((v) => {
      const s = getVenueStatus(v!, dateKey, hour);
      return s === "s";
    });
    if (sunny.length === 0) continue;

    const first = sunny[0]!;
    const title = sunny.length === 1
      ? `\u2600\uFE0F Sol på ${first.name}!`
      : `\u2600\uFE0F ${sunny.length} favoriter har sol just nu`;
    const body = sunny.length === 1
      ? `${Math.round(currentWeather.temperature)}°C — dags att ta en fika`
      : `${first.name} m.fl. — ${Math.round(currentWeather.temperature)}°C`;

    const payload = JSON.stringify({
      title,
      body,
      url: `/?venue=${first.id}&hour=${hour}`,
    });

    try {
      const sub = typeof row.subscription === "string" ? JSON.parse(row.subscription) : row.subscription;
      await webpush.sendNotification(sub, payload);
      await pool.query(
        `UPDATE push_subscriptions SET last_notified_date = $2 WHERE endpoint = $1`,
        [row.endpoint, today]
      );
      sent++;
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        toDelete.push(row.endpoint);
      }
    }
  }

  if (toDelete.length > 0) {
    await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = ANY($1)`, [toDelete]);
  }

  return Response.json({ ok: true, sent, removed: toDelete.length });
}
