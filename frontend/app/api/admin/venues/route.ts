import type { NextRequest } from "next/server";
import { loadVenues } from "../../../lib/venues-server";

export const dynamic = "force-dynamic";

interface VenueSummary {
  id: string;
  name: string;
  type: string;
  address: string;
}

let summaryCache: VenueSummary[] | null = null;

async function loadVenueSummaries(): Promise<VenueSummary[]> {
  if (summaryCache) return summaryCache;
  const list = await loadVenues();
  summaryCache = list.map((v) => ({ id: String(v.id), name: v.name, type: v.type, address: v.address }));
  return summaryCache;
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const id = req.nextUrl.searchParams.get("id");
  const venues = await loadVenueSummaries();

  if (id) {
    const v = venues.find((v) => v.id === id);
    return Response.json({ venue: v ?? null });
  }

  if (!q) {
    return Response.json({ venues: [] });
  }

  const matches = venues
    .filter((v) => v.name.toLowerCase().includes(q) || v.id === q)
    .slice(0, 30);

  return Response.json({ venues: matches });
}
