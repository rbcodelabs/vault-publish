import { readFile, readdir, stat } from "node:fs/promises";
import { join, extname, relative } from "node:path";
import { createHash } from "node:crypto";

export interface ScannedNote {
  absolutePath: string;
  /** Vault-relative slug (path without .md, forward-slash separated) */
  slug: string;
  content: string;
  sha256: string;
}

/**
 * Recursively scans a vault directory for notes with `publish: true` in
 * their frontmatter. Returns one ScannedNote per qualifying file.
 */
export async function scanVault(vaultDir: string): Promise<ScannedNote[]> {
  const results: ScannedNote[] = [];
  await walk(vaultDir, vaultDir, results);
  return results;
}

async function walk(
  root: string,
  dir: string,
  acc: ScannedNote[]
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    // Skip hidden dirs (e.g. .obsidian)
    if (entry.name.startsWith(".")) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(root, fullPath, acc);
    } else if (entry.isFile() && extname(entry.name) === ".md") {
      const content = await readFile(fullPath, "utf8");
      if (!hasPublishTrue(content)) continue;
      const relPath = relative(root, fullPath);
      const slug = relPath.replace(/\.md$/, "").replace(/\\/g, "/");
      const sha256 = createHash("sha256").update(content).digest("hex");
      acc.push({ absolutePath: fullPath, slug, content, sha256 });
    }
  }
}

const FM_REGEX = /^---\r?\n[\s\S]*?publish\s*:\s*true[\s\S]*?\r?\n---/;

export function hasPublishTrue(content: string): boolean {
  return FM_REGEX.test(content);
}

// ---------------------------------------------------------------------------
// Push cache — records sha256 per slug from last successful push
// ---------------------------------------------------------------------------

export interface PushCache {
  [slug: string]: string;
}

/**
 * Returns only notes whose SHA-256 differs from the cache.
 */
export function filterChanged(
  notes: ScannedNote[],
  cache: PushCache
): ScannedNote[] {
  return notes.filter((n) => cache[n.slug] !== n.sha256);
}
