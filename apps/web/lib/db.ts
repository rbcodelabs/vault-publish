import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { DsqlSigner } from "@aws-sdk/dsql-signer";
import { awsCredentialsProvider } from "@vercel/functions/oidc";
import { attachDatabasePool } from "@vercel/functions";
import { getActiveSchema } from "./schema";

/**
 * Creates a Prisma client with a fresh DSQL-signed pg pool.
 *
 * IMPORTANT: This must be called once per request, not cached globally.
 * awsCredentialsProvider() reads the x-vercel-oidc-token from the active
 * Vercel request context. If the client is cached across requests the OIDC
 * token from the original request is reused (or lost), causing a
 * "x-vercel-oidc-token header is missing" error on subsequent calls.
 */
export default async function getPrisma(): Promise<PrismaClient> {
  const host = process.env.PGHOST;
  if (!host) {
    throw new Error(
      "PGHOST is not set. Configure the Aurora DSQL integration in Vercel."
    );
  }

  const schema = getActiveSchema();

  // Create a fresh signer bound to the current request's OIDC token.
  const signer = new DsqlSigner({
    credentials: awsCredentialsProvider({ roleArn: process.env.AWS_ROLE_ARN! }),
    region: process.env.AWS_REGION!,
    hostname: host,
    expiresIn: 900,
  });

  const pool = new Pool({
    host,
    user: process.env.PGUSER ?? "admin",
    database: process.env.PGDATABASE ?? "postgres",
    // password is a function so pg re-signs on each new connection
    password: () => signer.getDbConnectAdminAuthToken(),
    port: 5432,
    ssl: true,
    // Small pool per-request — Vercel functions are short-lived
    max: 5,
  });

  attachDatabasePool(pool);
  const adapter = new PrismaPg(pool, { schema });
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
}
