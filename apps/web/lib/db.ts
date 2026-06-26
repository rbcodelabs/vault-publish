import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { DsqlSigner } from "@aws-sdk/dsql-signer";
import { fromWebToken } from "@aws-sdk/credential-provider-web-identity";
import { getVercelOidcToken } from "@vercel/functions/oidc";
import { attachDatabasePool } from "@vercel/functions";
import { getActiveSchema } from "./schema";

/**
 * Creates a Prisma client with a fresh DSQL-signed pg pool.
 *
 * IMPORTANT: This must be called once per request, not cached globally.
 *
 * WHY we read the OIDC token eagerly:
 * awsCredentialsProvider() uses a closure that calls getVercelOidcTokenSync()
 * when the pg pool actually needs credentials. That happens lazily inside
 * Prisma's WASM/Rust core, which runs in a *different* async context than the
 * original request handler. AsyncLocalStorage context (where the OIDC token
 * lives) is NOT propagated through Prisma's internal execution. So if we let
 * the token read happen lazily, it throws "x-vercel-oidc-token header missing".
 *
 * Solution: call getVercelOidcToken() HERE, while we are still inside the
 * Vercel request context, and capture the token value in the signer closure.
 */
export default async function getPrisma(): Promise<PrismaClient> {
  const host = process.env.PGHOST;
  if (!host) {
    throw new Error(
      "PGHOST is not set. Configure the Aurora DSQL integration in Vercel."
    );
  }

  const schema = getActiveSchema();

  // Eagerly capture the OIDC token while the request context is still active.
  const webIdentityToken = await getVercelOidcToken();

  const signer = new DsqlSigner({
    // Use the already-captured token; do NOT re-read it inside the closure
    // because Prisma's WASM layer will have left the request context by then.
    credentials: async () =>
      fromWebToken({
        roleArn: process.env.AWS_ROLE_ARN!,
        webIdentityToken,
      })(),
    region: process.env.AWS_REGION!,
    hostname: host,
    expiresIn: 900,
  });

  const pool = new Pool({
    host,
    user: process.env.PGUSER ?? "admin",
    database: process.env.PGDATABASE ?? "postgres",
    password: () => signer.getDbConnectAdminAuthToken(),
    port: 5432,
    ssl: true,
    max: 5,
  });

  attachDatabasePool(pool);
  const adapter = new PrismaPg(pool, { schema });
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
}
