import { NextRequest } from "next/server";
import { getPool, ensureTable } from "../../lib/db";

export async function POST(req: NextRequest) {
  const pool = getPool();
  if (!pool) {
    return Response.json({ error: "Databas ej konfigurerad" }, { status: 503 });
  }

  try {
    await ensureTable();

    const body = await req.json();
    const { venueId, venueName, schedule, comment } = body;

    if (!venueId || !schedule) {
      return Response.json({ error: "venueId och schedule krävs" }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO feedback (venue_id, venue_name, schedule, comment) VALUES ($1, $2, $3, $4)`,
      [venueId, venueName || "", JSON.stringify(schedule), comment || null]
    );

    return Response.json({ ok: true });
  } catch (err: any) {
    console.error("Feedback error:", err);
    return Response.json({ error: "Kunde inte spara" }, { status: 500 });
  }
}

export async function GET() {
  const pool = getPool();
  if (!pool) {
    return Response.json({ error: "Databas ej konfigurerad" }, { status: 503 });
  }

  try {
    await ensureTable();
    const result = await pool.query(
      `SELECT * FROM feedback ORDER BY created_at DESC LIMIT 200`
    );
    return Response.json(result.rows);
  } catch (err: any) {
    console.error("Feedback fetch error:", err);
    return Response.json({ error: "Kunde inte hämta" }, { status: 500 });
  }
}
