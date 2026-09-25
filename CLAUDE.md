# Repo Instructions

## Credentials

Whenever a new credential, login, port, or connection detail is created for local dev/demo
(a new service, a new bootstrap user, a new Zitadel client ID, a changed port) — add it to
`docs/CREDENTIALS.local.md`. That file is gitignored; it's the single place to look for
"what do I log into this with" during a demo, instead of hunting through `.env.example` files.

Never put real production secrets there or anywhere in this repo — only local dev-only values
(the kind already documented in `infra/docker-compose.yml` with `dev_password`-style defaults).

## Known build gotcha

`apps/api` had a recurring bug where a stale `tsconfig.tsbuildinfo` made `nest build` silently
skip emitting files after `dist/` was wiped, producing `Cannot find module` at runtime. Fixed by
removing `incremental` from `apps/api/tsconfig.json` — don't re-add it without also handling
`nest-cli.json`'s `deleteOutDir` interaction.

## Where things are

- `docs/architecture/ARCHITECTURE.md` — system overview, start here
- `docs/onboarding/GETTING_STARTED.md` — how to actually run this repo
- `docs/adr/` — why each tech choice was made
- `docs/CREDENTIALS.local.md` — local dev logins (gitignored)
