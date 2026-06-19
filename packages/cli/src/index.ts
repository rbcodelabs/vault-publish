// Public re-exports for programmatic use
export { readConfig, writeConfig } from "./config.js";
export type { VaultPublishConfig } from "./config.js";
export { scanVault, filterChanged, hasPublishTrue } from "./scanner.js";
export type { ScannedNote, PushCache } from "./scanner.js";
export { pushVault } from "./push.js";
export type { PushResult } from "./push.js";
