# PR Guidelines — vault-publish

## Commands
| Task | Command |
|---|---|
| Type-check | `pnpm tsc` (runs `tsc --noEmit` in every package via turbo) |
| Unit tests | `pnpm test` |
| Build | `pnpm build` |

## Coverage Requirements
- Unit tests for: parser transforms, API route auth logic, CLI scanner/differ, DB repository interfaces.
- No E2E suite in v1.

## Visual Verification
Whenever UI files are touched, verify at:
- Desktop: 1280x800
- Mobile: 390x844 (iPhone 14)

Check: layout not broken, graph view renders, note content correct.

## Docs Location
`README.md` — update for any user-facing API or CLI change.

## Secrets & Deployment Gate

Before touching any secret, env var, or Vercel setting — complete this checklist **in order**:

1. [ ] Run `op item list --format=json | jq -r '.[].title' | grep -i "vault-publish"` — if an item exists for this secret, **use it**. Do not generate a new value.
2. [ ] Invoke the `vercel-tools` skill before any `vercel env` command or `curl` to a `*.vercel.app` URL.
3. [ ] Use `printf '%s'` not `echo` when piping values to `vercel env add`.

## Project-Specific Gates
- `pnpm tsc` must be clean across all packages before any PR (build packages first with `pnpm build`).
- Prisma schema must pass DSQL constraints (no SERIAL, no FK, no @updatedAt, no sync indexes).
- **New or upgraded packages:** run `npm show <pkg> dist-tags.latest` and confirm the installed version matches. Never install a package without checking the current latest — training data versions are stale.
