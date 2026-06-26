# vault-publish

Open-source Obsidian Publish clone — deploy your own multi-user markdown vault hosting to Vercel, backed by AWS Aurora DSQL and Vercel Blob.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/rbcodelabs/vault-publish)

**Live demo:** [vault-publish-drab.vercel.app](https://vault-publish-drab.vercel.app) (custom domain: `vaults.rbcodelabs.com`)

---

## Features

- Publish notes from any Obsidian vault with `publish: true` in frontmatter
- Wikilinks, embeds, callouts, and tags rendered correctly
- Interactive D3-force knowledge graph (full vault + per-note mini graph)
- Backlinks panel on every note page
- Multi-user: each user has their own namespace (`/username/note-slug`)
- SHA-256 diffing in the CLI — only changed notes are uploaded on subsequent pushes
- ISR-cached pages (60s revalidation)

---

## Required Environment Variables

| Variable | Description |
|---|---|
| `PGHOST` | Aurora DSQL cluster endpoint |
| `PGUSER` | Database user (default: `admin`) |
| `PGDATABASE` | Database name (default: `postgres`) |
| `AWS_REGION` | AWS region of the DSQL cluster (e.g. `us-east-1`) |
| `AWS_ROLE_ARN` | IAM role ARN for Vercel OIDC federation |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token (set automatically when you add a Blob store) |
| `ADMIN_SECRET` | Secret for admin API endpoints |
| `PGSCHEMA` | Schema prefix (optional, default: `vaultpublish`) |

---

## Setup

### 1. Deploy to Vercel

Click the Deploy button above, or:

```bash
git clone https://github.com/rbcodelabs/vault-publish
cd vault-publish
vercel --scope your-team
```

Set the **root directory** to `apps/web` in your Vercel project settings (or via `vercel.json` at repo root).

### 2. Add AWS DSQL integration

In your Vercel project → **Storage** → **Connect Store** → **Aurora DSQL**. This populates `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPORT`, `PGSSLMODE`, `AWS_REGION`, `AWS_ROLE_ARN`, and `AWS_ACCOUNT_ID` automatically.

### 3. Add Vercel Blob

```bash
vercel blob create-store --access public "my-vault-notes"
# Follow the prompt to link it to your project
```

Or in the Vercel dashboard: **Storage** → **Connect Store** → **Blob**.

### 4. Set the admin secret

```bash
vercel env add ADMIN_SECRET production
# Enter a long random secret — save it in 1Password
```

### 5. Run the migration

```bash
curl -X POST https://your-domain.vercel.app/api/admin/migrate \
  -H "Authorization: Bearer $ADMIN_SECRET"
```

Returns `{"errors":[]}` on success.

### 6. Create a user

```bash
curl -X POST https://your-domain.vercel.app/api/admin/users \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "displayName": "Alice"}'
```

**Save the returned `apiKey` immediately — it is shown once and never stored.**

### 7. Push your vault from the CLI

The CLI isn't on npm yet. Run it directly from the repo:

```bash
cd packages/cli
pnpm build
node dist/index.js init    # enter your endpoint URL and API key
node dist/index.js push ~/path/to/your-vault
```

Any note with `publish: true` in its frontmatter will be uploaded. Only changed files (by SHA-256 hash) are uploaded on subsequent runs.

---

## CLI Reference

```
vault-publish init              Configure API endpoint and API key
vault-publish push [vault-dir]  Push publishable notes (default: current dir)
```

Config is stored at `~/.vault-publish/config.json`.
Push cache (for SHA-256 diffing) is stored at `~/.vault-publish/cache-<username>.json`.

---

## API Reference

### User endpoints

Require `Authorization: Bearer <userApiKey>`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/publish` | Publish or update a note |
| `DELETE` | `/api/publish` | Delete a note |

#### POST /api/publish

Multipart form body:

| Field | Type | Required | Description |
|---|---|---|---|
| `slug` | string | yes | URL slug (e.g. `my-note` or `folder/my-note`) |
| `title` | string | no | Note title (falls back to H1 or slug) |
| `markdown` | string | yes | Raw Obsidian markdown |

**Example:**
```bash
curl -X POST https://your-domain.vercel.app/api/publish \
  -H "Authorization: Bearer $API_KEY" \
  -F "slug=hello-world" \
  -F "title=Hello World" \
  -F "markdown=# Hello World

Your content here. Links like [[other-note]] work."
```

Returns `{"success":true,"slug":"hello-world","url":"/alice/hello-world"}`.

#### DELETE /api/publish

```bash
curl -X DELETE "https://your-domain.vercel.app/api/publish?slug=hello-world" \
  -H "Authorization: Bearer $API_KEY"
```

### Admin endpoints

Require `Authorization: Bearer $ADMIN_SECRET`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/admin/users` | Create a user; returns one-time API key |
| `GET` | `/api/admin/migrate` | Preview migration SQL |
| `POST` | `/api/admin/migrate` | Run migration |

---

## URL Structure

| URL | Description |
|---|---|
| `/{username}` | User's vault index (all published notes) |
| `/{username}/{slug}` | Individual note with sidebar graph |
| `/{username}/graph` | Full vault D3 graph |

---

## Monorepo Structure

```
vault-publish/
├── apps/
│   └── web/                    # Next.js 16 app (App Router)
│       ├── app/                # Routes: [username], [username]/[slug], api/...
│       ├── components/         # GraphView, MiniGraph
│       ├── lib/                # db.ts, auth.ts, repositories.ts
│       └── prisma/             # Schema + migrations
├── packages/
│   ├── parser/                 # Obsidian markdown → HTML + metadata
│   ├── cli/                    # vault-publish push CLI (TypeScript)
│   └── db/                     # Repository interfaces + Aurora DSQL adapter
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

---

## Development

```bash
pnpm install
pnpm dev         # starts Next.js app in watch mode
pnpm test        # unit tests (parser + CLI, via Vitest)
pnpm build       # production build
pnpm tsc         # type-check all packages
```

Local dev against DSQL requires pulling Vercel env vars:

```bash
cd apps/web && vercel env pull .env.local
```

---

## Technical Notes

- **Database:** AWS Aurora DSQL with Vercel OIDC authentication (no long-lived credentials). Prisma 6 with `@prisma/adapter-pg` driver adapter.
- **Storage:** Vercel Blob (public bucket) for raw markdown files.
- **Auth:** SHA-256 hashed API keys stored in DSQL. OIDC token is captured eagerly at request time before Prisma's WASM layer loses `AsyncLocalStorage` context.
- **Indexes:** DSQL requires `CREATE INDEX ASYNC` — all indexes in the migration use this.
- **Arrays:** DSQL doesn't support `TEXT[]` — `outlinks` and `tags` use `JSONB`.

---

## License

MIT
