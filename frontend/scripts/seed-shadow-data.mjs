#!/usr/bin/env node
/**
 * Seed shadow-data from GitHub if the target directory is empty.
 * Runs at container startup. Idempotent — skips if files already present.
 *
 * Env: SHADOW_DATA_PATH (target dir, default /app/shadow-data)
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const TARGET_DIR = process.env.SHADOW_DATA_PATH || "/app/shadow-data";
const REPO = "johansoderstrom87-crypto/soldryck";
const BRANCH = "master";
const CONCURRENCY = 8;
const EXPECTED_MIN_FILES = 180; // ~187 files, allow margin

async function listFiles() {
  const url = `https://api.github.com/repos/${REPO}/contents/shadow-data?ref=${BRANCH}`;
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "soldryck-seed" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const items = await res.json();
  return items.filter((i) => i.type === "file" && i.name.endsWith(".json.gz"));
}

async function downloadOne(file) {
  const localPath = join(TARGET_DIR, file.name);
  if (existsSync(localPath)) return false;
  const res = await fetch(file.download_url);
  if (!res.ok) throw new Error(`Failed ${file.name}: ${res.status}`);
  await writeFile(localPath, Buffer.from(await res.arrayBuffer()));
  return true;
}

async function main() {
  await mkdir(TARGET_DIR, { recursive: true });

  const existing = (await readdir(TARGET_DIR)).filter((f) => f.endsWith(".json.gz"));
  if (existing.length >= EXPECTED_MIN_FILES) {
    console.log(`[seed] ${existing.length} files already present in ${TARGET_DIR}, skipping`);
    return;
  }

  console.log(`[seed] Volume has ${existing.length} files — fetching list from GitHub...`);
  const files = await listFiles();
  console.log(`[seed] ${files.length} files to consider, downloading with concurrency=${CONCURRENCY}`);

  const queue = [...files];
  let done = 0;
  let downloaded = 0;
  const t0 = Date.now();

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const file = queue.shift();
        if (!file) break;
        const wasDownloaded = await downloadOne(file);
        done++;
        if (wasDownloaded) downloaded++;
        if (done % 20 === 0) {
          console.log(`[seed] ${done}/${files.length} processed (${downloaded} new)`);
        }
      }
    })
  );

  const secs = Math.round((Date.now() - t0) / 1000);
  console.log(`[seed] Done — ${downloaded} downloaded in ${secs}s, ${TARGET_DIR} ready`);
}

main().catch((err) => {
  console.error("[seed] FAILED:", err);
  process.exit(1);
});
