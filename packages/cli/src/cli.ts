#!/usr/bin/env node
/**
 * vault-publish CLI
 *
 * Commands:
 *   vault-publish init                      Configure API endpoint + key
 *   vault-publish push [dir] [flags]        Push publishable notes
 *
 * Push flags:
 *   --include-all, -a           Publish every .md file (no publish:true needed)
 *   --include <folder,...>      Publish notes in these folders without publish:true
 *   --exclude <folder,...>      Exclude notes in these folders (publish:true overrides)
 *   --prune                     Delete server notes removed from the local vault
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { resolve } from "node:path";
import { readConfig, writeConfig, readVaultConfig } from "./config.js";
import { pushVault, type PushOptions } from "./push.js";

const [, , command, ...args] = process.argv;

async function main(): Promise<void> {
  switch (command) {
    case "init":
      await runInit();
      break;
    case "push":
      await runPush(args);
      break;
    default:
      printHelp();
      process.exit(0);
  }
}

function printHelp(): void {
  console.log("vault-publish — open-source Obsidian publishing CLI");
  console.log("");
  console.log("Usage:");
  console.log("  vault-publish init                     Configure API endpoint and key");
  console.log("  vault-publish push [vault-dir] [flags] Push publishable notes");
  console.log("");
  console.log("Push flags:");
  console.log("  --include-all, -a           Publish every .md (no frontmatter needed)");
  console.log("  --include <folder,...>       Auto-include notes in these folders");
  console.log("  --exclude <folder,...>       Auto-exclude notes in these folders");
  console.log("  --prune                      Delete server notes removed locally");
  console.log("");
  console.log("Vault config (.vault-publish.json at vault root):");
  console.log('  { "includedFolders": ["Blog"], "excludedFolders": ["Private"] }');
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

async function runPush(rawArgs: string[]): Promise<void> {
  const config = await readConfig();
  if (!config) {
    console.error("No config found. Run `vault-publish init` first.");
    process.exit(1);
  }

  // ── Parse flags ──────────────────────────────────────────────────────────
  let vaultDirArg: string | undefined;
  const options: PushOptions = {};
  const includeFolders: string[] = [];
  const excludeFolders: string[] = [];

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === "--include-all" || arg === "-a") {
      options.includeAll = true;
    } else if (arg === "--prune") {
      options.prune = true;
    } else if (arg === "--include" && rawArgs[i + 1]) {
      includeFolders.push(
        ...rawArgs[++i].split(",").map((s) => s.trim()).filter(Boolean)
      );
    } else if (arg === "--exclude" && rawArgs[i + 1]) {
      excludeFolders.push(
        ...rawArgs[++i].split(",").map((s) => s.trim()).filter(Boolean)
      );
    } else if (!arg.startsWith("-")) {
      vaultDirArg = arg;
    }
  }

  const vaultDir = resolve(vaultDirArg ?? ".");

  // ── Load per-vault config, then merge CLI overrides ──────────────────────
  const vaultConfig = await readVaultConfig(vaultDir);

  options.includedFolders = [
    ...(vaultConfig.includedFolders ?? []),
    ...includeFolders,
  ];
  options.excludedFolders = [
    ...(vaultConfig.excludedFolders ?? []),
    ...excludeFolders,
  ];

  // Normalise empty arrays to undefined so the scanner doesn't check them.
  if (options.includedFolders.length === 0) delete options.includedFolders;
  if (options.excludedFolders.length === 0) delete options.excludedFolders;

  // ── Log active mode ───────────────────────────────────────────────────────
  if (options.includeAll) {
    console.log("Mode: include-all (publishing every .md)");
  } else if (options.includedFolders?.length) {
    console.log(
      `Mode: folder-based — included: ${options.includedFolders.join(", ")}`
    );
  } else {
    console.log("Mode: frontmatter (publish:true required)");
  }
  if (options.excludedFolders?.length) {
    console.log(`Excluded folders: ${options.excludedFolders.join(", ")}`);
  }

  const result = await pushVault(config, vaultDir, options, console.log);

  if (result.errors.length > 0) {
    console.error(`\nErrors (${result.errors.length}):`);
    for (const e of result.errors) {
      console.error(`  ${e.slug}: ${e.error}`);
    }
    process.exit(1);
  }

  const parts = [
    `Pushed: ${result.pushed}`,
    `Skipped (unchanged): ${result.skipped}`,
  ];
  if (result.deleted > 0) parts.push(`Deleted: ${result.deleted}`);
  console.log(`\nDone. ${parts.join(", ")}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
