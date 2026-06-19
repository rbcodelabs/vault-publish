import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

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
