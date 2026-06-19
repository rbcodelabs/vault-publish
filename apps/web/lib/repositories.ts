import { createDsqlRepositories } from "@vault-publish/db";
import type { Repositories } from "@vault-publish/db";
import getPrisma from "./db";

/**
 * Returns repository instances backed by the DSQL-connected Prisma client.
 * App code should only import from this file — never from lib/db.ts directly.
 */
export async function getRepositories(): Promise<Repositories> {
  const prisma = await getPrisma();
  return createDsqlRepositories(prisma);
}
