#!/usr/bin/env node
/**
 * vault-publish CLI
 *
 * Commands:
 *   vault-publish init      — configure API endpoint + key
 *   vault-publish push [dir] — push publishable notes to the server
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { resolve } from "node:path";
import { readConfig, writeConfig } from "./config.js";
import { pushVault } from "./push.js";

const [, , command, ...args] = process.argv;

async function main(): Promise<void> {
  switch (command) {
    case "init":
      await runInit();
      break;
    case "push":
      await runPush(args[0]);
      break;
    default:
      console.log("vault-publish — open-source Obsidian publishing CLI");
      console.log("");
      console.log("Usage:");
      console.log("  vault-publish init              Configure API endpoint and key");
      console.log("  vault-publish push [vault-dir]  Push publishable notes");
      process.exit(0);
  }
}

async function runInit(): Promise<void> {
  const rl = createInterface({ input, output });
  try {
    const apiEndpoint = (
      await rl.question("API endpoint URL (e.g. https://your-vault.vercel.app): ")
    ).trim();
    const apiKey = (await rl.question("API key: ")).trim();

    if (!apiEndpoint || !apiKey) {
      console.error("Both endpoint and API key are required.");
      process.exit(1);
    }

    await writeConfig({ apiEndpoint, apiKey });
    console.log("Config saved to ~/.vault-publish/config.json");
  } finally {
    rl.close();
  }
}

async function runPush(vaultDirArg?: string): Promise<void> {
  const config = await readConfig();
  if (!config) {
    console.error(
      "No config found. Run `vault-publish init` first."
    );
    process.exit(1);
  }

  const vaultDir = resolve(vaultDirArg ?? ".");
  const result = await pushVault(config, vaultDir, console.log);

  if (result.errors.length > 0) {
    console.error(`\nErrors (${result.errors.length}):`);
    for (const e of result.errors) {
      console.error(`  ${e.slug}: ${e.error}`);
    }
    process.exit(1);
  }

  console.log(
    `\nDone. Pushed: ${result.pushed}, Skipped (unchanged): ${result.skipped}`
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
