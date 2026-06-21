export function getActiveSchema(): string {
  const prefix = process.env.PGSCHEMA ?? "vaultpublish";
  if (process.env.NODE_ENV === "development") return `${prefix}_dev`;
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "preview") return `${prefix}_preview`;
  if (vercelEnv === "production") return `${prefix}_prod`;
  return `${prefix}_dev`;
}
