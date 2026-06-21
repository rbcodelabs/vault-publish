# vault-publish

Open-source Obsidian Publish clone — deploy your own multi-user markdown vault hosting to Vercel, backed by AWS Aurora DSQL and Vercel Blob.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/rbcodelabs/vault-publish)

---

## Features

- Publish notes from any Obsidian vault with `publish: true` in frontmatter
- Wikilinks, embeds, callouts, and tags rendered correctly
- Interactive D3-force knowledge graph (full vault + per-note mini graph)
- Backlinks panel on every note page
- Multi-user: each user has their own namespace (`/username/note-slug`)
- SHA-256 diffing in the CLI — only changed notes are uploaded
- ISR-cached pages (60s revalidation)

---

## Required Environment Variables

| Variable | Description |
|---|---|
| `PGHOST` | Aurora DSQL cluster endpoint |
| `PGUSER` | Database user (default: `admin`) |
| `PGDATABASE` | Database name (default: `postgres`) |
| `AWS_REGION` | AWS region of the DSQL cluster (e.g. `us-east-2`) |
| `AWS_ROLE_ARN` | IAM role ARN for Vercel OIDC federation |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token |
| `ADMIN_SECRET` | Secret for admin API endpoints |
| `PGSCHEMA` | Schema prefix (optional, default: `vaultpublish`) |

---

## Setup

### 1. Deploy to Vercel

Click the Deploy button above, or:

```bash
git clone https://github.com/rbcodelabs/vault-publish
cd vault-publish
vercel
```

### 2. Enable OIDC Federation

In your Vercel project settings, enable "AWS OIDC" under Integrations and configure the trust policy for the `AWS_ROLE_ARN`.

### 3. Run the Migration

```bash
curl -X POST https://your-vault.vercel.app/api/admin/migrate \
  -H "Authorization: Bearer $ADMIN_SECRET"
```

### 4. Create a User

```bash
curl -X POST https://your-vault.vercel.app/api/admin/users \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "displayName": "Alice"}'
```

Save the returned `apiKey` — it is shown once and never stored.

### 5. Install the CLI and Push Your Vault

```bash
npx vault-publish init
# Enter your endpoint URL and API key when prompted

npx vault-publish push ./my-vault
```

Any note with `publish: true` in its frontmatter will be uploaded. Only changed files (by SHA-256) are sent on subsequent pushes.

---

## CLI Reference

```
vault-publish init              Configure API endpoint and key
vault-publish push [vault-dir]  Push publishable notes (default: current dir)
```

Config is stored at `~/.vault-publish/config.json`. Push cache is stored at `~/.vault-publish/cache-<id>.json`.

---

## API Reference

All API routes require `Authorization: Bearer <key>`.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/publish` | User API key | Publish or update a note |
| `DELETE` | `/api/publish` | User API key | Delete a note |
| `POST` | `/api/admin/users` | `ADMIN_SECRET` | Create a user, returns API key |
| `GET` | `/api/admin/migrate` | `ADMIN_SECRET` | Preview migration SQL |
| `POST` | `/api/admin/migrate` | `ADMIN_SECRET` | Run migration |

### POST /api/publish

Multipart form fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `slug` | string | yes | URL slug (e.g. `notes/my-note`) |
| `title` | string | yes | Note title |
| `markdown` | string | yes | Raw Obsidian markdown content |

---

## Monorepo Structure

```
vault-publish/
├── apps/
│   └── web/                    # Next.js 15 app (App Router)
├── packages/
│   ├── parser/                 # Obsidian markdown transforms
│   ├── cli/                    # vault-publish push CLI
│   └── db/                     # Repository interfaces + DSQL adapter
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

---

## Development

```bash
pnpm install
pnpm dev         # starts all packages in watch mode
pnpm test        # unit tests (parser + CLI)
pnpm build       # production build
```

---

## License

MIT
