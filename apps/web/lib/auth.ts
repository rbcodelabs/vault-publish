import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { getRepositories } from "./repositories.js";
import type { User } from "@vault-publish/db";

/** SHA-256 hex digest of a plaintext API key. */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Generates a cryptographically-random 32-byte API key (64 hex chars). */
export function generateApiKey(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Extracts the Bearer token from the Authorization header,
 * hashes it, and looks up the user in the database.
 * Returns null when auth fails (caller sends 401).
 */
export async function authenticateRequest(
  req: NextRequest
): Promise<User | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const hashed = hashApiKey(token);
  const repos = await getRepositories();
  return repos.users.findByApiKey(hashed);
}

/** Validates the ADMIN_SECRET bearer token. */
export function isAdminRequest(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7).trim();
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return token === secret;
}
