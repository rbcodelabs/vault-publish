# vault-publish — Claude Code Guidelines

## Package Versions — Always Use Latest Stable

**Before adding or upgrading any dependency, resolve the actual current version:**

```bash
npm show <package> dist-tags.latest
```

Never assume a version from training data — package majors ship faster than
training cutoffs. Examples that bite:

| Package | Don't assume | Always check |
|---|---|---|
| `next` | "it's 14" or "it's 15" | `npm show next dist-tags.latest` |
| `react` / `react-dom` | any specific major | same |
| `typescript` | "5.x is latest" | same |
| `tailwindcss` | "v3" | same |

**When installing a new package, always use `@latest` explicitly:**

```bash
pnpm add next@latest react@latest react-dom@latest
pnpm add -D typescript@latest vitest@latest
```

If a PR description says "added X" but didn't run `npm show X dist-tags.latest`
first, the reviewer should verify the version before merging.

---

## Monorepo Layout

```
apps/web          — Next.js app (App Router). Vercel root dir is set to apps/web.
packages/parser   — Obsidian markdown transforms  (@vault-publish/parser)
packages/cli      — vault-publish push CLI        (@vault-publish/cli)
packages/db       — Repository interfaces + DSQL  (@vault-publish/db)
```

## Key Rules

- **No direct Prisma imports outside `apps/web/lib/db.ts`.** All data access
  goes through the repository interfaces defined in `packages/db/src/types.ts`.
- **AWS DSQL schema constraints** — no `SERIAL`, no FK cascades, no
  `@updatedAt`, no synchronous indexes. Follow the pattern in
  `apps/web/prisma/migrations/001_init/migration.sql`.
- **No `.js` extensions on relative Next.js imports.** Use `./foo` not
  `./foo.js` — webpack cannot resolve `.js` → `.ts`.
- **Test runner is Vitest** (not Jest). Jest's bin shim crashes on Node v22+.

## Commands

```bash
pnpm install   # install all + run prisma generate (postinstall)
pnpm build     # build all packages via turbo
pnpm test      # vitest in parser + cli
pnpm tsc       # type-check all packages via turbo
pnpm dev       # watch mode (all packages)
```

## Vercel Deployment

- Project root in Vercel: `apps/web`
- `vercel.json` lives in `apps/web/` — `buildCommand` uses `cd ../..` to reach
  the monorepo root before running `pnpm build --filter=web`
- AWS DSQL env vars come from the Vercel AWS DSQL integration (never hardcoded)
- `ADMIN_SECRET` is in Vercel env (production); set it before running migrations
