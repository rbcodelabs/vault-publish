import { readFile, readdir } from "node:fs/promises";
import { join, extname, relative, dirname } from "node:path";
import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScannedNote {
  absolutePath: string;
  /** Effective slug: either the `permalink` frontmatter value or the
   *  vault-relative path without .md extension, forward-slash separated. */
  slug: string;
  /** Original vault-relative path (no .md). Same as slug when no permalink. */
  vaultPath: string;
  content: string;
  sha256: string;
  /** Metadata extracted from frontmatter for the API. */
  meta: NoteMeta;
}

export interface NoteMeta {
  title?: string;
  description?: string;
  /** OG image URL or vault-relative path (from `image` or `cover` property). */
  image?: string;
}

/**
 * Options controlling which notes are included in a scan.
 *
 * Rules (matching Obsidian Publish behaviour):
 *   1. `publish: false` in frontmatter → always excluded.
 *   2. `publish: true` in frontmatter → always included (overrides excludedFolders).
 *   3. Folder is in excludedFolders AND note doesn't have publish:true → excluded.
 *   4. includeAll is true AND note not excluded by rule 1/3 → included.
 *   5. Folder is in includedFolders AND note not excluded by rule 1/3 → included.
 *   6. Otherwise → excluded (note requires explicit publish:true).
 */
export interface ScanOptions {
  /** Publish every .md file without requiring publish:true frontmatter. */
  includeAll?: boolean;
  /**
   * Vault-relative folder paths to auto-include. Notes inside these folders
   * are published without requiring publish:true (unless excluded by rule 1/3).
   * Matches any path prefix (e.g. "Blog" also includes "Blog/2024/post.md").
   */
  includedFolders?: string[];
  /**
   * Vault-relative folder paths to auto-exclude. Notes inside these folders
   * are skipped unless they have publish:true in frontmatter.
   */
  excludedFolders?: string[];
}

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

interface ParsedFrontmatter {
  publishTrue: boolean;   // publish: true explicitly set
  publishFalse: boolean;  // publish: false explicitly set
  permalink?: string;
  title?: string;
  description?: string;
  image?: string;
}

/** Parses only the fields vault-publish cares about from YAML frontmatter. */
export function parseFrontmatter(content: string): ParsedFrontmatter {
  const result: ParsedFrontmatter = { publishTrue: false, publishFalse: false };

  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return result;

  const yaml = fmMatch[1];

  // publish: true / false
  const publishMatch = yaml.match(/^publish\s*:\s*(.+)$/m);
  if (publishMatch) {
    const val = publishMatch[1].trim().toLowerCase();
    if (val === "true") result.publishTrue = true;
    else if (val === "false") result.publishFalse = true;
  }

  // permalink
  const permalinkMatch = yaml.match(/^permalink\s*:\s*(.+)$/m);
  if (permalinkMatch) {
    result.permalink = permalinkMatch[1].trim().replace(/^["']|["']$/g, "");
  }

  // title
  const titleMatch = yaml.match(/^title\s*:\s*(.+)$/m);
  if (titleMatch) {
    result.title = titleMatch[1].trim().replace(/^["']|["']$/g, "");
  }

  // description
  const descMatch = yaml.match(/^description\s*:\s*(.+)$/m);
  if (descMatch) {
    result.description = descMatch[1].trim().replace(/^["']|["']$/g, "");
  }

  // image or cover (image takes precedence)
  const imageMatch =
    yaml.match(/^image\s*:\s*(.+)$/m) ??
    yaml.match(/^cover\s*:\s*(.+)$/m);
  if (imageMatch) {
    result.image = imageMatch[1].trim().replace(/^["']|["']$/g, "");
  }

  return result;
}

// ---------------------------------------------------------------------------
// Legacy helper (kept for backward compat / tests)
// ---------------------------------------------------------------------------

/** @deprecated Use parseFrontmatter instead */
export function hasPublishTrue(content: string): boolean {
  return parseFrontmatter(content).publishTrue;
}

// ---------------------------------------------------------------------------
// Folder matching helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if `vaultRelativePath` (e.g. "Blog/2024/post.md") is inside
 * `folderPath` (e.g. "Blog" or "Blog/2024").
 */
function isInsideFolder(vaultRelativePath: string, folderPath: string): boolean {
  const normalFolder = folderPath.replace(/\\/g, "/").replace(/\/$/, "");
  const normalPath = vaultRelativePath.replace(/\\/g, "/");
  return (
    normalPath === normalFolder ||
    normalPath.startsWith(normalFolder + "/")
  );
}

function matchesFolderList(vaultRelativePath: string, folders: string[]): boolean {
  return folders.some((f) => isInsideFolder(vaultRelativePath, f));
}

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

/**
 * Recursively scans a vault directory and returns notes that should be
 * published according to the given options.
 */
export async function scanVault(
  vaultDir: string,
  options: ScanOptions = {}
): Promise<ScannedNote[]> {
  const results: ScannedNote[] = [];
  await walk(vaultDir, vaultDir, results, options);
  return results;
}

async function walk(
  root: string,
  dir: string,
  acc: ScannedNote[],
  options: ScanOptions
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    // Skip hidden dirs/files (e.g. .obsidian, .vault-publish.json parent).
    if (entry.name.startsWith(".")) continue;
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await walk(root, fullPath, acc, options);
    } else if (entry.isFile() && extname(entry.name) === ".md") {
      const content = await readFile(fullPath, "utf8");
      const fm = parseFrontmatter(content);

      // Rule 1: publish:false is an absolute veto.
      if (fm.publishFalse) continue;

      const relPath = relative(root, fullPath).replace(/\\/g, "/");

      // Rule 3 check: is this path in an excluded folder?
      const inExcluded =
        options.excludedFolders && matchesFolderList(relPath, options.excludedFolders);

      // Rule 2: publish:true always wins — even excluded folders.
      const shouldInclude =
        fm.publishTrue ||
        (!inExcluded &&
          (options.includeAll ||
            (options.includedFolders &&
              matchesFolderList(relPath, options.includedFolders))));

      if (!shouldInclude) continue;

      const vaultPath = relPath.replace(/\.md$/, "");
      // Permalink overrides the published slug (but not the blob storage key).
      const slug = fm.permalink ?? vaultPath;
      const sha256 = createHash("sha256").update(content).digest("hex");

      acc.push({
        absolutePath: fullPath,
        slug,
        vaultPath,
        content,
        sha256,
        meta: {
          title: fm.title,
          description: fm.description,
          image: fm.image,
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Push cache — records sha256 per vaultPath from last successful push
// ---------------------------------------------------------------------------

export interface PushCache {
  [vaultPath: string]: string;
}

/**
 * Returns only notes whose SHA-256 differs from the cache.
 * Cache is keyed by vaultPath (stable, unlike slug which can change via permalink).
 */
export function filterChanged(
  notes: ScannedNote[],
  cache: PushCache
): ScannedNote[] {
  return notes.filter((n) => cache[n.vaultPath] !== n.sha256);
}
