# Getting Started

Written for someone who has never seen this repo before. Read
`docs/architecture/ARCHITECTURE.md` first if you haven't — this is the "how do I actually run it"
follow-up.

## 1. Prerequisites

- Node.js 20+
- Docker + Docker Compose
- `corepack enable pnpm` (pnpm itself doesn't need a separate install — corepack ships with Node)

## 2. Start infrastructure

Postgres and MinIO are separate compose files, mirroring how they're split into their own
resources in production (see `docs/deployment/PRODUCTION_DEPLOY.md`) — this is deliberate, not
accidental sprawl, so local dev and prod share the same shape.

```bash
cd infra
docker network create saas-erp-local-internal   # once, if it doesn't exist yet
docker compose -f docker-compose.postgres.yaml up -d
docker compose -f docker-compose.minio.local.yaml up -d
docker compose up -d
```

This starts Postgres 18, MinIO, PgBouncer, MongoDB, Redis, Zitadel, and the OTel/Grafana stack.
If the backend later crashes with "Can't reach database server at pgbouncer:5432", PgBouncer may
not be ready yet — bring it up first:

```bash
cd infra
docker compose up -d redis pgbouncer
```

**Note on ports:** several services are mapped to non-default host ports (Postgres on 5433 not
5432, PgBouncer on 6433, Redis on 6380, MinIO on 9010/9011, Zitadel on 8081 not 8080) — this is
deliberate, not a typo. This machine runs other unrelated projects that already hold the default
ports for some of these. See `infra/docker-compose.yaml`'s top comment and inline comments.

## 3. Install dependencies and set up the database

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm --filter @saas-erp/api prisma migrate dev
```

This applies every migration, including the Row-Level Security policies and the
`auth_lookup_by_subject`/`claim_invite` SQL functions — see ADR 0001, ADR 0007, and the migration
files themselves (`apps/api/prisma/migrations/`) for what each one does and why.

## 4. One-time manual Zitadel setup

Zitadel is running, but creating the actual login application inside it is a manual step this
repo doesn't automate yet:

1. Open <http://localhost:8081>, log in with the bootstrap admin
   (`ZITADEL_FIRSTINSTANCE_ORG_HUMAN_USERNAME` / `_PASSWORD` in `infra/docker-compose.yaml`).
2. Create a Project, then an Application inside it of type **User Agent** (SPA), with:
   - Redirect URI: `http://localhost:5174/callback`
   - Post-logout redirect URI: `http://localhost:5174`
   - Auth method: PKCE
3. Copy the generated **Client ID** into `apps/web/.env` as `VITE_ZITADEL_CLIENT_ID`.
4. Copy the **Project ID** into `apps/api/.env` as `ZITADEL_PROJECT_ID`.

Why this isn't scripted: it needs Zitadel's own management API, authenticated as the bootstrap
admin, which is a bigger integration than Phase 0/1 needed — see the "not yet done" note in
`docs/architecture/ARCHITECTURE.md`. Worth automating once there's a second environment (staging)
that also needs it.

## 5. Run the app

```bash
pnpm dev
```

This runs `apps/api` (http://localhost:3000, Swagger at `/docs`) and `apps/web`
(http://localhost:5174) together via Turborepo.

## 6. First login

There's no seeded platform user yet. To create the first `super_admin`:

```bash
# find your own zitadel "sub" after logging in once — decode the id_token at jwt.io, or:
docker exec -it saas-erp-dev-postgres-1 psql -U saaserp -d saaserp
```

```sql
-- inside psql, as the owner role (bypasses RLS):
INSERT INTO roles (id, tenant_id, name, is_protected) VALUES ('r1', NULL, 'super_admin', true);
INSERT INTO permissions... -- see packages/permissions for the platform.* keys to grant
INSERT INTO users (id, tenant_id, zitadel_subject_id, email, display_name)
  VALUES ('u1', NULL, '<your zitadel sub>', 'you@example.com', 'Your Name');
INSERT INTO user_roles (user_id, role_id) VALUES ('u1', 'r1');
```

This bootstrap-the-first-platform-user step is manual by design — there's no unauthenticated
"become super admin" endpoint, on purpose.

## 7. Repo structure — where to add things

```
apps/api/src/
  <module>/
    <module>.module.ts       # wires controller + service + anything it needs
    <module>.controller.ts   # routes — @RequirePermission(...) on every guarded one
    <module>.service.ts      # business logic — always via PrismaService.runInTenantContext(...)
    dto.ts                   # class-validator request DTOs
```

A new feature module (e.g. Phase 2's HR Core) follows this same shape — see `src/admin/` as the
reference example. Add its permission keys to `packages/permissions/src/index.ts` first (that's
the single source of truth both frontend and backend read from), then the module.

```
apps/web/src/routes/
  <Feature>Page.tsx   # one file per screen, uses TanStack Query against apps/api
```

## 8. Running tests

Unit and integration tests for the backend:

```bash
cd apps/api
npx jest                    # run all tests once
npx jest --watch            # watch mode, re-run on file changes
```

## 9. Database seeding

**Important:** Never run `node prisma/seed.js` on a shared database — it **TRUNCATES everything**.
It requires `SEED_ALLOW_RESET=true` and is only for local dev fresh starts.

**Safe additive script** (dry-run by default, adds demo payroll data without destructing):

```bash
cd apps/api
DIRECT_URL="..." node prisma/seed-payroll-demo.js        # dry-run
DIRECT_URL="..." node prisma/seed-payroll-demo.js --apply # write changes

# Optional env vars:
#   SEED_TENANT_SLUG    — target tenant (default: any one with org)
#   SEED_ALLOW_RESET    — never set this to true on shared DBs
```

This script idempotently adds missing leave types, fixed-date holidays, and salary structures to
support payroll demo workflows.

## 10. Common commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run api + web together |
| `pnpm build` | Build everything (`turbo run build`) |
| `pnpm typecheck` | Typecheck everything |
| `pnpm --filter @saas-erp/api prisma migrate dev` | Create/apply a migration |
| `pnpm --filter @saas-erp/api prisma studio` | Browse the database in a GUI |
| `docker compose -f infra/docker-compose.yaml logs -f <service>` | Tail one infra service's logs |

## 11. Attendance & scheduling

The HR attendance module uses timezone-aware date boundaries. Set the timezone for
your dev environment:

```bash
export ATTENDANCE_TIMEZONE="Asia/Kolkata"   # or your timezone (IANA format)
```

If not set, defaults to UTC. This env var is read by the attendance service when
recording punch-in/punch-out times and calculating daily attendance.

## 12. If something's already running on these ports

This is a shared dev machine in some setups — check `docs/architecture/ARCHITECTURE.md`'s port
note, and `infra/docker-compose.yaml`'s top comment, before assuming a port conflict means
something's broken.
