# PR Guidelines — vault-publish

## Commands
| Task | Command |
|---|---|
| Type-check | `pnpm tsc --noEmit` (run from each package root) |
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

## Project-Specific Gates
- `pnpm tsc --noEmit` must be clean across all packages before any PR.
- Prisma schema must pass DSQL constraints (no SERIAL, no FK, no @updatedAt, no sync indexes).
