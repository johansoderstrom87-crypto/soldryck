import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// Try multiple locations: Docker production, then local dev paths
const SHADOW_DIRS = [
  join(process.cwd(), "shadow-data"),
  join(process.cwd(), "public", "shadows"),
  join(process.cwd(), "..", "pipeline", "data", "shadows"),
];

function findShadowFile(key: string): string | null {
  for (const dir of SHADOW_DIRS) {
    const fp = join(dir, `${key}.json`);
    if (existsSync(fp)) return fp;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key || !/^\d{2}-\d{2}_\d{2}$/.test(key)) {
    return Response.json({ error: "Invalid key" }, { status: 400 });
  }

  const filePath = findShadowFile(key);
  if (!filePath) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const data = await readFile(filePath);
  return new Response(data, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
