import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// Try multiple locations: env-configured volume (prod), Docker default, local dev paths
const SHADOW_DIRS = [
  process.env.SHADOW_DATA_PATH,
  join(process.cwd(), "shadow-data"),
  join(process.cwd(), "public", "shadows"),
  join(process.cwd(), "..", "pipeline", "data", "shadows"),
].filter((p): p is string => Boolean(p));

function findShadowFile(key: string): { path: string; gzipped: boolean } | null {
  for (const dir of SHADOW_DIRS) {
    const gzPath = join(dir, `${key}.json.gz`);
    if (existsSync(gzPath)) return { path: gzPath, gzipped: true };
    const fp = join(dir, `${key}.json`);
    if (existsSync(fp)) return { path: fp, gzipped: false };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key || !/^\d{2}-\d{2}_\d{2}$/.test(key)) {
    return Response.json({ error: "Invalid key" }, { status: 400 });
  }

  const file = findShadowFile(key);
  if (!file) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const data = await readFile(file.path);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=86400, immutable",
  };
  if (file.gzipped) {
    headers["Content-Encoding"] = "gzip";
  }
  return new Response(data, { headers });
}
