import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

// ---------------------------------------------------------------------------
// Global config (~/.vault-publish/config.json)
// ---------------------------------------------------------------------------

export interface VaultPublishConfig {
  apiEndpoint: string;
  apiKey: string;
}

function configDir(): string {
  return join(homedir(), ".vault-publish");
}

function configPath(): string {
  return join(configDir(), "config.json");
}

export async function readConfig(): Promise<VaultPublishConfig | null> {
  try {
    const raw = await readFile(configPath(), "utf8");
    return JSON.parse(raw) as VaultPublishConfig;
  } catch {
    return null;
  }
}

export async function writeConfig(config: VaultPublishConfig): Promise<void> {
  await mkdir(configDir(), { recursive: true });
  await writeFile(configPath(), JSON.stringify(config, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// Per-vault config (.vault-publish.json at vault root)
// ---------------------------------------------------------------------------

/**
 * Optional per-vault configuration file placed at the root of an Obsidian
 * vault. Mirrors Obsidian Publish's "Included/Excluded folders" concept.
 *
 * Example .vault-publish.json:
 * {
 *   "includedFolders": ["Blog", "Notes/Public"],
 *   "excludedFolders": ["Private", "Templates", "Archive"]
 * }
 */
export interface VaultConfig {
  /**
   * Folders whose notes are published without needing publish:true in
   * frontmatter. Matches any sub-path (e.g. "Blog" also includes
   * "Blog/2024/my-post.md").
   */
  includedFolders?: string[];
  /**
   * Folders whose notes are excluded from publishing unless they have
   * publish:true in frontmatter.
   */
  excludedFolders?: string[];
}

/**
 * Reads .vault-publish.json from the vault root. Returns {} if absent.
 */
export async function readVaultConfig(vaultDir: string): Promise<VaultConfig> {
  try {
    const raw = await readFile(join(vaultDir, ".vault-publish.json"), "utf8");
    return JSON.parse(raw) as VaultConfig;
  } catch {
    return {};
  }
}
