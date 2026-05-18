import type { NextRequest } from "next/server";
import {
  getAllClaimedVenues,
  upsertClaim,
  deleteClaim,
  type ClaimedVenueData,
} from "../../../lib/claimed-venues-storage";

export const dynamic = "force-dynamic";

function validateClaim(body: unknown): { ok: true; data: ClaimedVenueData } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be an object" };
  const b = body as Record<string, unknown>;
  const verifiedAt = typeof b.verifiedAt === "string" && b.verifiedAt.length > 0
    ? b.verifiedAt
    : new Date().toISOString().slice(0, 10);
  const out: ClaimedVenueData = { verifiedAt };
  if (typeof b.ownerEmail === "string") out.ownerEmail = b.ownerEmail.slice(0, 200);
  if (typeof b.ownerNotes === "string") out.ownerNotes = b.ownerNotes.slice(0, 1000);
  if (b.happyHour && typeof b.happyHour === "object") {
    const hh = b.happyHour as Record<string, unknown>;
    const start = Number(hh.start);
    const end = Number(hh.end);
    if (
      typeof hh.daysLabel !== "string" || !hh.daysLabel ||
      !Number.isFinite(start) || start < 0 || start > 23 ||
      !Number.isFinite(end) || end < 1 || end > 24 ||
      end <= start ||
      typeof hh.description !== "string" || !hh.description
    ) {
      return { ok: false, error: "Invalid happyHour fields" };
    }
    out.happyHour = {
      daysLabel: hh.daysLabel.slice(0, 50),
      start,
      end,
      description: hh.description.slice(0, 200),
    };
  }
  return { ok: true, data: out };
}

export async function GET() {
  const all = await getAllClaimedVenues();
  return Response.json(all, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const venueId = req.nextUrl.searchParams.get("id");
  if (!venueId || !/^[\w\-]{1,32}$/.test(venueId)) {
    return Response.json({ error: "Missing or invalid id" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const validated = validateClaim(body);
  if (!validated.ok) {
    return Response.json({ error: validated.error }, { status: 400 });
  }
  await upsertClaim(venueId, validated.data);
  return Response.json({ ok: true, venueId, data: validated.data });
}

export async function DELETE(req: NextRequest) {
  const venueId = req.nextUrl.searchParams.get("id");
  if (!venueId) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }
  const removed = await deleteClaim(venueId);
  if (!removed) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ ok: true, venueId });
}
