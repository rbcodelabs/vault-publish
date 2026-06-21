import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import { DsqlSigner } from "@aws-sdk/dsql-signer";
import { awsCredentialsProvider } from "@vercel/functions/oidc";
import { getActiveSchema } from "@/lib/schema";
import { isAdminRequest } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getMigrationPool(): Promise<Pool> {
  const host = process.env.PGHOST!;
  const signer = new DsqlSigner({
    credentials: awsCredentialsProvider({ roleArn: process.env.AWS_ROLE_ARN! }),
    region: process.env.AWS_REGION!,
    hostname: host,
    expiresIn: 900,
  });
  return new Pool({
    host,
    user: process.env.PGUSER ?? "admin",
    database: process.env.PGDATABASE ?? "postgres",
    password: () => signer.getDbConnectAdminAuthToken(),
    port: 5432,
    ssl: true,
    max: 5,
  });
}

async function getMigrationSQL(): Promise<string> {
  const sqlPath = join(
    process.cwd(),
    "prisma",
    "migrations",
    "001_init",
    "migration.sql"
  );
  return readFile(sqlPath, "utf8");
}

// DSQL requires one DDL statement per transaction.
function splitStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));
}

// ---------------------------------------------------------------------------
// GET /api/admin/migrate — preview the migration SQL
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sql = await getMigrationSQL();
  const schema = getActiveSchema();
  return NextResponse.json({ schema, sql, statements: splitStatements(sql).length });
}

// ---------------------------------------------------------------------------
// POST /api/admin/migrate — run the migration
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schema = getActiveSchema();
  const sql = await getMigrationSQL();
  const statements = splitStatements(sql);
  const pool = await getMigrationPool();
  const results: string[] = [];
  const errors: string[] = [];

  // Ensure schema exists
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      results.push(`Schema "${schema}" ready.`);

      // Run each DDL statement in its own transaction (DSQL constraint)
      for (const stmt of statements) {
        try {
          await client.query("BEGIN");
          await client.query(stmt);
          await client.query("COMMIT");
          results.push(`OK: ${stmt.slice(0, 60)}...`);
        } catch (err) {
          await client.query("ROLLBACK").catch(() => {});
          const msg = err instanceof Error ? err.message : String(err);
          // IF NOT EXISTS means duplicates are safe to skip
          if (msg.includes("already exists")) {
            results.push(`SKIP (exists): ${stmt.slice(0, 60)}...`);
          } else {
            errors.push(`ERR: ${msg} | stmt: ${stmt.slice(0, 80)}`);
          }
        }
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }

  const status = errors.length > 0 ? 500 : 200;
  return NextResponse.json({ schema, results, errors }, { status });
}
