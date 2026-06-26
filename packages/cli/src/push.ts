import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import type { VaultPublishConfig } from "./config.js";
import { scanVault, filterChanged, type PushCache, type ScanOptions } from "./scanner.js";

function cachePath(vaultDir: string): string {
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

export interface PushOptions extends ScanOptions {
  /** Also delete notes from the server that were removed from the vault.
   *  Off by default (safe default). */
  prune?: boolean;
}

export interface PushResult {
  pushed: number;
  skipped: number;
  deleted: number;
  errors: Array<{ slug: string; error: string }>;
}

export async function pushVault(
  config: VaultPublishConfig,
  vaultDir: string,
  options: PushOptions = {},
  log: (msg: string) => void = console.log
): Promise<PushResult> {
  log(`Scanning ${vaultDir}...`);
  const notes = await scanVault(vaultDir, options);
  log(`Found ${notes.length} publishable note(s).`);

  const cache = await readCache(vaultDir);
  const changed = filterChanged(notes, cache);
  const skipped = notes.length - changed.length;

  if (changed.length === 0 && !options.prune) {
    log("Nothing changed — all notes are up to date.");
    return { pushed: 0, skipped, deleted: 0, errors: [] };
  }

  const errors: Array<{ slug: string; error: string }> = [];
  const newCache = { ...cache };

  // ── Push changed notes ──────────────────────────────────────────────────
  if (changed.length > 0) {
    log(`Pushing ${changed.length} changed note(s)...`);
  }

  for (const note of changed) {
    try {
      const formData = new FormData();
      formData.append("slug", note.slug);
      formData.append("markdown", note.content);

      // Title: frontmatter > H1 (parsed server-side) > slug filename
      const titleFallback = note.slug.split("/").pop() ?? note.slug;
      formData.append("title", note.meta.title ?? titleFallback);

      if (note.meta.description) formData.append("description", note.meta.description);
      if (note.meta.image) formData.append("image", note.meta.image);

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

      // Cache by vaultPath — stable even when permalink changes.
      newCache[note.vaultPath] = note.sha256;
      log(`  ✓ ${note.slug}${note.slug !== note.vaultPath ? ` (← ${note.vaultPath})` : ""}`);
    } catch (err) {
      errors.push({
        slug: note.slug,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Prune removed notes ─────────────────────────────────────────────────
  let deleted = 0;
  if (options.prune) {
    const publishedVaultPaths = new Set(notes.map((n) => n.vaultPath));
    const removedVaultPaths = Object.keys(cache).filter(
      (p) => !publishedVaultPaths.has(p)
    );

    if (removedVaultPaths.length > 0) {
      log(`Deleting ${removedVaultPaths.length} removed note(s)...`);
    }

    for (const vaultPath of removedVaultPaths) {
      try {
        const response = await fetch(`${config.apiEndpoint}/api/publish`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ slug: vaultPath }),
        });

        if (!response.ok && response.status !== 404) {
          const text = await response.text();
          errors.push({ slug: vaultPath, error: `HTTP ${response.status}: ${text}` });
          continue;
        }

        delete newCache[vaultPath];
        deleted++;
        log(`  ✗ ${vaultPath} (deleted)`);
      } catch (err) {
        errors.push({
          slug: vaultPath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  await writeCache(vaultDir, newCache);
  return { pushed: changed.length - errors.length, skipped, deleted, errors };
}
