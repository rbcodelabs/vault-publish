import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { VaultPublishConfig } from "./config.js";
import { scanVault, filterChanged, type PushCache } from "./scanner.js";

function cachePath(vaultDir: string): string {
  // Stable cache file keyed by vault path hash
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  const key = createHash("sha256").update(vaultDir).digest("hex").slice(0, 16);
  return join(homedir(), ".vault-publish", `cache-${key}.json`);
}

async function readCache(vaultDir: string): Promise<PushCache> {
  try {
    const raw = await readFile(cachePath(vaultDir), "utf8");
    return JSON.parse(raw) as PushCache;
  } catch {
    return {};
  }
}

async function writeCache(vaultDir: string, cache: PushCache): Promise<void> {
  const p = cachePath(vaultDir);
  await mkdir(join(homedir(), ".vault-publish"), { recursive: true });
  await writeFile(p, JSON.stringify(cache, null, 2), "utf8");
}

export interface PushResult {
  pushed: number;
  skipped: number;
  errors: Array<{ slug: string; error: string }>;
}

export async function pushVault(
  config: VaultPublishConfig,
  vaultDir: string,
  log: (msg: string) => void = console.log
): Promise<PushResult> {
  log(`Scanning ${vaultDir}...`);
  const notes = await scanVault(vaultDir);
  log(`Found ${notes.length} publishable note(s).`);

  const cache = await readCache(vaultDir);
  const changed = filterChanged(notes, cache);
  const skipped = notes.length - changed.length;

  if (changed.length === 0) {
    log("Nothing changed — all notes are up to date.");
    return { pushed: 0, skipped, errors: [] };
  }

  log(`Pushing ${changed.length} changed note(s)...`);
  const errors: Array<{ slug: string; error: string }> = [];
  const newCache = { ...cache };

  for (const note of changed) {
    try {
      const formData = new FormData();
      formData.append("slug", note.slug);
      formData.append("markdown", note.content);
      // Derive title from slug as fallback
      const titleFallback = note.slug.split("/").pop() ?? note.slug;
      formData.append("title", titleFallback);

      const response = await fetch(`${config.apiEndpoint}/api/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}` },
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        errors.push({ slug: note.slug, error: `HTTP ${response.status}: ${text}` });
        continue;
      }

      newCache[note.slug] = note.sha256;
      log(`  pushed: ${note.slug}`);
    } catch (err) {
      errors.push({
        slug: note.slug,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await writeCache(vaultDir, newCache);
  return { pushed: changed.length - errors.length, skipped, errors };
}
