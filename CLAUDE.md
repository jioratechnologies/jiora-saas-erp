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

## Error Handling & Client-Facing Messages (MANDATORY STANDARD)

Always make error messages short, clear, and client-oriented. Never show technical details, raw JSON, Prisma codes, or database stack traces to the user.

1. **Client Understanding First**:
   - Error messages must explain what happened in plain, non-technical English that an end user or customer immediately understands.
   - Never display raw status code JSON like `{"statusCode":500,"message":"Internal server error"}` or Prisma codes like `P2002`.
2. **Short, Actionable, & Perfect**:
   - Duplicate entries: `"A record with this name already exists. Please choose a different one."`
   - Not found: `"The requested item could not be found."`
   - Form / validation errors: `"Please check the highlighted fields and try again."`
   - Permissions: `"You do not have permission to perform this action."`
   - Session / auth expired: `"Your session has expired. Please sign in again."`
   - Network failure: `"Unable to connect to the server. Please check your internet connection."`
   - Server errors (500): `"Something went wrong on the server. Please try again in a moment."`
3. **Backend Service Rule (`apps/api`)**:
   - In all NestJS services, catch database and Prisma exceptions (e.g. `P2002` duplicate unique key, `P2025` not found) and map them to appropriate NestJS HTTP exceptions (`ConflictException`, `NotFoundException`, `BadRequestException`) with human-friendly descriptions rather than letting them bubble up as unhandled 500s.
4. **Frontend API Client & Toast Rule (`apps/web`)**:
   - Always run API error responses and toast errors through `formatErrorMessage` from `apps/web/src/lib/error-formatter.ts`.
   - The API client (`apps/web/src/api/client.ts`) and `toast.error()` automatically sanitize and format any unexpected error payloads before display.

