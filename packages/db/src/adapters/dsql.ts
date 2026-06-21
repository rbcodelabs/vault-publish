/**
 * DSQL adapter — the only file in this package that imports PrismaClient.
 *
 * All app code imports repository interfaces from @vault-publish/db and
 * receives concrete instances through dependency injection; Prisma is never
 * imported directly outside this file.
 */

// PrismaClient is provided by the app's own generated client (apps/web).
// We use `any` for the client type here so packages/db has no hard dep on
// a generated artifact. The adapter is instantiated by apps/web which passes
// its own PrismaClient instance.
/* eslint-disable @typescript-eslint/no-explicit-any */
type PrismaClientLike = any;

import type {
  UserRepository,
  NoteRepository,
  GraphRepository,
  Repositories,
  User,
  Note,
  GraphManifest,
  CreateUserInput,
  UpsertNoteInput,
} from "../types.js";

// ---------------------------------------------------------------------------
// User repository
// ---------------------------------------------------------------------------

class DsqlUserRepository implements UserRepository {
  constructor(private readonly db: PrismaClientLike) {}

  async findByApiKey(hashedKey: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { apiKeyHash: hashedKey } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { username } });
  }

  async create(data: CreateUserInput): Promise<User> {
    return this.db.user.create({
      data: {
        username: data.username,
        apiKeyHash: data.apiKeyHash,
        displayName: data.displayName ?? null,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Note repository
// ---------------------------------------------------------------------------

class DsqlNoteRepository implements NoteRepository {
  constructor(private readonly db: PrismaClientLike) {}

  async upsert(data: UpsertNoteInput): Promise<Note> {
    return this.db.note.upsert({
      where: { userId_slug: { userId: data.userId, slug: data.slug } },
      create: {
        userId: data.userId,
        slug: data.slug,
        title: data.title,
        blobUrl: data.blobUrl,
        frontmatter: data.frontmatter,
        outlinks: data.outlinks,
        tags: data.tags,
        wordCount: data.wordCount,
      },
      update: {
        title: data.title,
        blobUrl: data.blobUrl,
        frontmatter: data.frontmatter,
        outlinks: data.outlinks,
        tags: data.tags,
        wordCount: data.wordCount,
        // DSQL: no @updatedAt — set manually
        updatedAt: new Date(),
      },
    });
  }

  async findBySlug(userId: string, slug: string): Promise<Note | null> {
    return this.db.note.findUnique({
      where: { userId_slug: { userId, slug } },
    });
  }

  async listByUser(userId: string): Promise<Note[]> {
    return this.db.note.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
  }

  async delete(userId: string, slug: string): Promise<void> {
    await this.db.note.delete({
      where: { userId_slug: { userId, slug } },
    });
  }
}

// ---------------------------------------------------------------------------
// Graph repository
// ---------------------------------------------------------------------------

class DsqlGraphRepository implements GraphRepository {
  constructor(private readonly db: PrismaClientLike) {}

  async upsert(userId: string, manifest: GraphManifest): Promise<void> {
    await this.db.vaultGraph.upsert({
      where: { userId },
      create: { userId, manifest },
      update: { manifest, updatedAt: new Date() },
    });
  }

  async findByUser(userId: string): Promise<GraphManifest | null> {
    const row = await this.db.vaultGraph.findUnique({ where: { userId } });
    if (!row) return null;
    return row.manifest as GraphManifest;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDsqlRepositories(db: PrismaClientLike): Repositories {
  return {
    users: new DsqlUserRepository(db),
    notes: new DsqlNoteRepository(db),
    graphs: new DsqlGraphRepository(db),
  };
}
