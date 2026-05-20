import { NextRequest } from "next/server";
import { getPool, ensureSuggestionsTable } from "../../lib/db";
import { isAdminRequest, unauthorizedResponse } from "../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const pool = getPool();
  if (!pool) {
    return Response.json({ error: "Databas ej konfigurerad" }, { status: 503 });
  }

  try {
    await ensureSuggestionsTable();
    const body = await req.json();
    const message = String(body?.message ?? "").trim().slice(0, 2000);
    if (!message) {
      return Response.json({ error: "Meddelande krävs" }, { status: 400 });
    }
    await pool.query(`INSERT INTO suggestions (message) VALUES ($1)`, [message]);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Suggestion create error:", err);
    return Response.json({ error: "Kunde inte spara" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorizedResponse();
  const pool = getPool();
  if (!pool) {
    return Response.json({ error: "Databas ej konfigurerad" }, { status: 503 });
  }
  try {
    await ensureSuggestionsTable();
    const result = await pool.query(
      `SELECT id, message, status, created_at FROM suggestions ORDER BY created_at DESC LIMIT 500`
    );
    return Response.json(result.rows);
  } catch (err) {
    console.error("Suggestion fetch error:", err);
    return Response.json({ error: "Kunde inte hämta" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorizedResponse();
  const pool = getPool();
  if (!pool) {
    return Response.json({ error: "Databas ej konfigurerad" }, { status: 503 });
  }
  try {
    const body = await req.json();
    const id = Number(body?.id);
    const status = String(body?.status ?? "");
    if (!Number.isFinite(id) || !["new", "liked"].includes(status)) {
      return Response.json({ error: "Ogiltig data" }, { status: 400 });
    }
    await pool.query(`UPDATE suggestions SET status = $1 WHERE id = $2`, [status, id]);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Suggestion update error:", err);
    return Response.json({ error: "Kunde inte uppdatera" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorizedResponse();
  const pool = getPool();
  if (!pool) {
    return Response.json({ error: "Databas ej konfigurerad" }, { status: 503 });
  }
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!Number.isFinite(id)) {
      return Response.json({ error: "Ogiltig id" }, { status: 400 });
    }
    await pool.query(`DELETE FROM suggestions WHERE id = $1`, [id]);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Suggestion delete error:", err);
    return Response.json({ error: "Kunde inte ta bort" }, { status: 500 });
  }
}
