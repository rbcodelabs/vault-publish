// Public re-exports for programmatic use
export { readConfig, writeConfig, readVaultConfig } from "./config.js";
export type { VaultPublishConfig, VaultConfig } from "./config.js";
export { scanVault, filterChanged, hasPublishTrue, parseFrontmatter } from "./scanner.js";
export type { ScannedNote, PushCache, ScanOptions, NoteMeta } from "./scanner.js";
export { pushVault } from "./push.js";
export type { PushResult, PushOptions } from "./push.js";
