// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  username: string;
  apiKeyHash: string;
  displayName: string | null;
  createdAt: Date;
}

export interface Note {
  id: string;
  userId: string;
  slug: string;
  title: string;
  blobUrl: string;
  frontmatter: Record<string, unknown>;
  outlinks: string[];
  tags: string[];
  wordCount: number;
  updatedAt: Date;
}

export interface VaultGraph {
  userId: string;
  manifest: GraphManifest;
  updatedAt: Date;
}

export interface GraphNode {
  id: string;
  slug: string;
  title: string;
  tags: string[];
  linkCount: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphManifest {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateUserInput {
  username: string;
  apiKeyHash: string;
  displayName?: string;
}

export interface UpsertNoteInput {
  userId: string;
  slug: string;
  title: string;
  blobUrl: string;
  frontmatter: Record<string, unknown>;
  outlinks: string[];
  tags: string[];
  wordCount: number;
}

// ---------------------------------------------------------------------------
// Repository interfaces
// ---------------------------------------------------------------------------

export interface UserRepository {
  findByApiKey(hashedKey: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  create(data: CreateUserInput): Promise<User>;
}

export interface NoteRepository {
  upsert(data: UpsertNoteInput): Promise<Note>;
  findBySlug(userId: string, slug: string): Promise<Note | null>;
  listByUser(userId: string): Promise<Note[]>;
  delete(userId: string, slug: string): Promise<void>;
}

export interface GraphRepository {
  upsert(userId: string, manifest: GraphManifest): Promise<void>;
  findByUser(userId: string): Promise<GraphManifest | null>;
}

// ---------------------------------------------------------------------------
// Combined repository bag — what app code receives
// ---------------------------------------------------------------------------

export interface Repositories {
  users: UserRepository;
  notes: NoteRepository;
  graphs: GraphRepository;
}
