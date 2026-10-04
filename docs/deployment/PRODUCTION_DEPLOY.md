# Deploying to production

This deployment splits into three independent resources on whatever
Docker-Compose-capable host you're running (self-hosted PaaS like Coolify or
Dokploy, or a plain VM with Docker):

1. **Postgres** — use your host's managed/native Postgres resource if it has
   one (you get backups and a UI for free); otherwise deploy Postgres itself
   via a plain compose file, same idea as `infra/docker-compose.postgres.yaml`
   but with a real host path and real credentials.
2. **Object storage** — `infra/docker-compose.minio.yaml` (MinIO; any other
   S3-compatible service works too — `apps/api` talks to it through the
   generic AWS S3 SDK, nothing MinIO-specific in the code).
3. **App stack** — `infra/docker-compose.production.yaml` (pgbouncer, mongo,
   redis, Zitadel, api, web).

Nothing publishes a `ports:` mapping, with two deliberate exceptions: object
storage and `api`. `web` (the frontend), `zitadel` (the auth server —
browsers must be redirected to it directly for the OIDC login flow), and
`api` (needed for the mobile app, which can't use web's same-origin nginx
`/api/*` proxy trick the way a browser can) are the things meant to be
reachable from the public internet. Object storage also ends up publicly
reachable: `apps/api` issues presigned GET/PUT URLs that the browser fetches
directly (see `apps/api/src/storage/storage.service.ts`), bypassing `api`
entirely, so the storage endpoint has to be a public HTTPS host. This is the
same shape as real AWS S3: a public endpoint protected by request signing,
not an open door. The browser itself still only ever calls `web`'s own
domain for everything except those presigned storage URLs;
`CORS_ALLOWED_ORIGINS` on `api` locks out any other browser-based caller
even though `api` is publicly reachable for mobile.

## 0. Create the shared internal network

Postgres, object storage, and the app stack all need to land on the same
Docker network so they can reach each other by service name (object storage
also needs `dokploy-network` — see step 2 — but still joins this one too,
for the `setup` one-shot job's internal call).

Most self-hosted PaaS tools have their own name for "a Docker network you
can attach resources to" (Coolify calls it a Destination, Dokploy will have
its own term) — check your platform's UI for the equivalent, or just do it
directly on the host:

```bash
docker network create saas-erp-internal
```

Your host's own reverse proxy listens on a separate network it manages
itself. On Dokploy this is `dokploy-network` — created automatically during
install, do not `docker network create` it yourself; confirm the exact name
via its Traefik config (`providers.docker.network` in `traefik.yml`, under
Dokploy's Web Server settings) if it's ever unclear. Both
`docker-compose.production.yaml` and `docker-compose.minio.yaml` already
reference `dokploy-network` by that name. On a different host, rename that
network key (and its references) to match whatever that host's reverse
proxy actually listens on, or create your own dedicated one and point your
proxy at it:

```bash
docker network create proxy
```

## 1. Postgres (separate resource)

If your host has a managed/native Postgres resource type, use it — you get
backups and a UI for free, and it doesn't run custom init scripts the way
`infra/postgres/init/` does locally, so the role setup below has to happen
manually once instead.

1. Create the Postgres resource, on the `saas-erp-internal` network/
   destination. Set a strong password for the default superuser.
2. Once it's running, find its internal hostname (this is your
   `POSTGRES_HOST` for the app stack's `.env`) and port (normally `5432`) —
   usually shown on a "Connection" tab or equivalent.
3. Open a terminal against it (your host's resource page likely has a
   "Terminal" / "Execute Command" action, or `docker exec -it <container>
   psql -U <user>`) and run, once:

   ```sql
   CREATE DATABASE zitadel;

   CREATE ROLE app_runtime LOGIN PASSWORD 'put-a-real-password-here';
   GRANT CONNECT ON DATABASE saaserp TO app_runtime;
   ```

   This mirrors `infra/postgres/init/01-create-zitadel-db.sql` and
   `02-create-app-runtime-role.sh` from the local dev stack — a managed
   Postgres resource typically doesn't run those, so this is the one-time
   manual equivalent. `app_runtime` is the least-privilege role the app
   connects as; see `docs/adr/0001-multi-tenancy-shared-schema-rls.md` for
   why it's not the table owner.
4. The `saaserp` database itself is whatever database name you gave the
   resource when creating it — make sure it matches `POSTGRES_DB` in the
   app stack's `.env`.

## 2. Object storage — MinIO (separate resource)

Deploy `infra/docker-compose.minio.yaml` as a Docker Compose resource,
Destination/network `saas-erp-internal`. It also joins `dokploy-network`
on its own (declared in the compose file) so its S3 API can get a Traefik
route — that's required, not optional: `apps/api` issues presigned GET/PUT
URLs that the browser fetches directly (see
`apps/api/src/storage/storage.service.ts`), bypassing `api` entirely, so the
storage endpoint has to be a public HTTPS host. Same shape as real AWS S3: a
public endpoint protected by request signing, not an open door. The console
(port 9001) has no route baked into the compose file's labels — add it
separately via your platform's domain/routing settings if you want console
access, and put it behind basic auth or similar — it's the full admin
console, not the S3 API.

MinIO Inc. discontinued free distribution of the plain community image in
2025 — `quay.io/minio/minio`, Docker Hub's `minio/minio`, `ghcr.io/minio/minio`,
and the `dl.min.io` binary all deny anonymous access now, even pinned to old
release tags, confirmed by testing all four directly. Rather than depend on
MinIO's AIStor image (works, but needs a license file mounted at runtime) or
on quay.io's anonymous-pull policy holding, the compose file points at
`bhindwarg/minio:latest` and `bhindwarg/mc:latest` — a mirror of the last
working images, pulled while quay.io still allowed it and pushed to a plain
Docker Hub repo under our own account. No license, no third-party access
policy to depend on. If that account ever needs to change, re-pull the
last-known-good quay.io images (still cached wherever they were pulled
before) and re-push under the new account — same process as before.

Before first deploy, create the fixed host path the compose file bind-mounts
(a named volume would get re-namespaced if this resource is ever deleted and
recreated by whatever's managing it, silently starting empty):

```bash
mkdir -p /data/saas-erp/minio
```

Fill in `.env` for this resource (copy `infra/.env.deploy.example`, take the
object storage section, plus add the domain):

```
MINIO_ROOT_USER=...
MINIO_ROOT_PASSWORD=...
OBJECT_STORAGE_ACCESS_KEY=...
OBJECT_STORAGE_SECRET_KEY=...
OBJECT_STORAGE_BUCKET=saas-erp-documents
MINIO_DOMAIN=storage.your-domain.example
```

`MINIO_ROOT_USER`/`PASSWORD` and `OBJECT_STORAGE_ACCESS_KEY`/`SECRET_KEY`
must be different values — see the compose file's header comment for why.
The root pair is the console/admin login; the `OBJECT_STORAGE_*` pair is a
separate, scoped user the compose file creates automatically, restricted to
this one bucket, which is what `apps/api` actually connects with.

The compose file includes a one-shot `setup` service that, on every deploy,
creates the bucket, creates that scoped user, and attaches a policy limiting
it to read/write/list on `OBJECT_STORAGE_BUCKET` only — then exits. Every
step is idempotent, safe to re-run. Verify the scoping actually holds before
trusting it: `mc admin user list` (or creating another bucket) using the
`OBJECT_STORAGE_*` credentials should fail with Access Denied — if it
doesn't, something's wrong with the policy attach step.

Any other self-hosted S3-compatible service (Garage, SeaweedFS, etc.) works
the same way — `apps/api`'s `StorageService` talks to it through the generic
`@aws-sdk/client-s3` SDK with `forcePathStyle: true`, nothing MinIO-specific
in the code.

## 3. App stack

Deploy `infra/docker-compose.production.yaml` as a Docker Compose resource,
Destination/network `saas-erp-internal` (the compose file itself also joins
`dokploy-network` for the public-facing services — already exists on this
host, see step 0).

Copy `infra/.env.deploy.example` to `.env` for this resource and fill in every value, plus these critical additions the compose file needs:

**Required environment variables:**

| Variable | Value |
| --- | --- |
| `DIRECT_URL` | Owner role direct connection to Postgres: `postgresql://<owner>:<password>@<host>:<port>/<db>?schema=public` — migrations only, never for runtime |
| `APP_RUNTIME_PASSWORD` | Password for the `app_runtime` role (created in step 1) |
| `POSTGRES_HOST` | Internal hostname from Postgres resource connection details |
| `POSTGRES_PORT` | Usually `5432` |
| `ZITADEL_PROJECT_ID` | From Zitadel console — required to verify JWT audience claim |
| `WEB_DOMAIN` | e.g. `app.your-domain.example` |

**Mail (invitation emails via Resend or SMTP):**

Set either Resend API or SMTP credentials (Resend is simpler):

```env
# Resend (recommended):
RESEND_API_KEY=<key from Resend dashboard>
RESEND_FROM_ADDRESS=<verified domain email>
RESEND_FROM_NAME=Jiora SaaS ERP   # optional

# OR SMTP (fallback, used if RESEND_API_KEY not set):
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASSWORD=<RESEND_API_KEY>
SMTP_SECURE=true
SMTP_FROM=<verified domain email>

WEB_BASE_URL=https://${WEB_DOMAIN}
```

**Object storage, Zitadel, and routing:**

| Variable | Value |
| --- | --- |
| `OBJECT_STORAGE_ENDPOINT` | Same as `MINIO_DOMAIN` from step 2, no scheme/port |
| `API_DOMAIN` | e.g. `api.your-domain.example` — mobile app baseUrl |
| `ZITADEL_DOMAIN` | e.g. `auth.your-domain.example` |
| `ZITADEL_CLIENT_ID` | From Zitadel console, see `docs/onboarding/GETTING_STARTED.md` step 4 |

Point your platform's DNS/domain settings at `WEB_DOMAIN`, `API_DOMAIN`, and
`ZITADEL_DOMAIN` as you would for any app on it. On Dokploy specifically,
configure these three domains through its own **Domains** UI on this Compose
service — one entry per service, picking the right container and port
(`web` → 80, `api` → 3000, `zitadel` → 8080), HTTPS on, cert resolver
`letsencrypt`. Don't also hand-write `traefik.*` labels in the compose file
for these services — confirmed live: labels alongside Dokploy's
auto-generated ones create two competing routers for the same host, one of
them pointing at the wrong container port, and the losing router's HTTPS
entryPoint never takes effect. A host without Dokploy's own Domains
UI (plain Traefik, Coolify, etc.) would instead read routing straight from
`traefik.*` labels in the compose file — add them back for that case.

### Critical: Migrations, database backup, and secrets rotation

**Before first deploy, back up your database** — migrations cannot be rolled back easily:

```bash
# Postgres managed resource: use your provider's backup UI
# Self-hosted Postgres: pg_dump your saaserp database before proceeding
```

**Migrations run automatically** when the `api` container starts. Do **not** run migrations from a `docker exec` — let the app's startup flow handle them. If you prefer manual control or are re-deploying:

```bash
cd apps/api
DIRECT_URL="<DIRECT_URL>" npx prisma migrate deploy
```

**Migrations in the October 2026 revamp** (applied automatically on deploy):

- `20261002000000_auth_tenant_suspended_function` — SQL function for suspended-tenant checks
- `20261002010000_payroll_models` — Salary, adjustments, claims, payroll runs
- `20261003000000_person_contact_fields` — Employee master (drops `persons.whatsapp`)
- `20261004000000_designation_access` — **Data transformation:** copies all permissions from custom roles (HR Manager, Developer, Employee, etc.) to their corresponding designations, then deletes the custom roles. Designations now own permissions directly.
- `20261005000000_org_work_schedule` — Organisation default work schedule
- `20261006000000_payroll_adjustments` — Advance claims and voucher deductions

**Critical: Rotate any secrets** that were ever pasted in chat logs, PR descriptions, or stdout — even if they're behind a private GitHub repo, assume logs were captured:

- `APP_RUNTIME_PASSWORD` — change in Postgres and `.env`
- `ZITADEL_CLIENT_ID` — rotate in Zitadel console if it was ever shared
- `RESEND_API_KEY`, SMTP credentials — regenerate if logged
- `MINIO_ROOT_PASSWORD`, `OBJECT_STORAGE_SECRET_KEY` — rotate in MinIO

**Database latency note:** If your Postgres is far from the API container (different region or cloud provider), configure:

```env
PRISMA_TX_TIMEOUT_MS=60000        # transaction timeout (default 30s)
PRISMA_TX_MAX_WAIT_MS=5000        # max wait to acquire a connection
```

PgBouncer should run on the same network as Postgres (or same VM) for lowest latency.

### Critical: Deployment order and MinIO setup

**Deploy order matters on first bring-up.** Postgres and object storage need to
exist and be reachable before the app stack starts:

1. **Postgres** (managed resource, or your own compose deploy) — `zitadel`
   needs its database on first boot
2. **Object storage** (MinIO compose resource) — **must include the `setup` one-shot service**
   - When you deploy `infra/docker-compose.minio.yaml`, the `setup` service runs automatically and creates:
     - The `saas-erp-documents` bucket
     - The scoped app user with `OBJECT_STORAGE_ACCESS_KEY`/`SECRET_KEY`
     - A restrictive policy (read/write/delete/list on the bucket only — cannot create buckets or other resources)
   - **Wait for `setup` to complete** before proceeding (check the resource logs — it should finish with policy attachment and exit).
   - If you redeploy MinIO later, `setup` is safe to re-run (all steps are idempotent).
3. **App stack** (`infra/docker-compose.production.yaml`) — now safe to start
   - The `api` container will start and verify the bucket exists.
   - If you see a warning in logs: `Failed to create object storage bucket "saas-erp-documents": Access Denied`, it means `setup` didn't run or hasn't completed yet — wait for it and redeploy `api` once the bucket exists.

**Why this order?** The app user (`OBJECT_STORAGE_ACCESS_KEY`) is intentionally scoped and cannot create buckets — only read/write within an existing one. The `setup` service runs with root credentials (`MINIO_ROOT_USER`/`PASSWORD`) and does the one-time initialization.

## Notes

- `api` gets a public route (`API_DOMAIN`) specifically for the mobile app.
  The browser itself still only ever calls `web`'s own domain though;
  `CORS_ALLOWED_ORIGINS` on `api` locks out any other browser-based caller
  regardless of `api` being publicly reachable.
- `ZITADEL_ISSUER` (used by `api` to validate tokens) and
  `VITE_ZITADEL_ISSUER` (baked into the `web` build) must both resolve to
  the same public HTTPS URL — `https://${ZITADEL_DOMAIN}` — since it's
  embedded in issued tokens and used for JWKS discovery.
- **Object storage uploads** are scoped to PDF and image MIME types only
  (`StorageService.isAllowedMimeType()`). Inline preview is supported for
  PDFs and images; other file types cannot be stored. This is intentional —
  see `apps/api/src/storage/storage.service.ts`.
- SMTP (Resend) was originally set up via env vars directly on `zitadel` —
  the very first bootstrap admin activation email has to send before anyone
  can log in to reach the Console at all, so it can't wait for a post-login
  manual step the way local dev's Mailpit setup does. That approach hit a
  platform-specific variable-substitution bug on Coolify (see
  `docker-compose.production.yaml`'s comment on the `zitadel` service for
  the full story) and the config was pulled back out as a result — worth
  re-testing on whatever host you actually deploy to; if env-var
  substitution works cleanly there, re-add it, otherwise configure SMTP via
  the Console UI after first login instead. Mailpit itself is intentionally
  not used here — it only catches mail locally, doesn't deliver anywhere a
  real user could read it.
- Observability (`otel-collector`, `tempo`, `loki`, `prometheus`, `grafana`
  from the local dev stack) is intentionally left out of the production
  compose file. Add it as its own resource on `saas-erp-internal` later if
  needed; none of it needs a public route except optionally `grafana`.

## Zitadel runs as its own resource

Zitadel is no longer part of `infra/docker-compose.production.yaml`. Like Postgres and MinIO it is deployed as a
separate resource, with its own database (a `zitadel` database and its own database user), its own master key and
its own public HTTPS domain. The app stack only needs to know where it is:

| Variable | Used by | Meaning |
|---|---|---|
| `ZITADEL_ISSUER` | api | Public HTTPS URL of the Zitadel resource, exactly as it appears in the `iss` claim of tokens |
| `ZITADEL_PROJECT_ID` | api | Project id of the app's Zitadel project (token audience is checked against it) |
| `VITE_ZITADEL_ISSUER` | web build | Defaults to `ZITADEL_ISSUER` |
| `VITE_ZITADEL_CLIENT_ID` / `ZITADEL_CLIENT_ID` | web build | Client id of the SPA application (PKCE, access tokens of type JWT) |

Do **not** put `ZITADEL_MASTERKEY`, `ZITADEL_ADMIN_USERNAME` or `ZITADEL_ADMIN_PASSWORD` in the app stack; they belong to
the Zitadel resource only. The master key cannot be rotated after first start, so generate a fresh one for any new
Zitadel and never paste it into chat or tickets.

Moving existing users to a new Zitadel: see `apps/api/prisma/migrate-users-to-zitadel.js` (dry run by default; it
creates the users in the new Zitadel and then updates `users.zitadel_subject_id`). Production needs HTTPS on the
Zitadel domain (`ZITADEL_EXTERNALSECURE=true`, port 443) because browsers will not redirect an HTTPS site to an HTTP login.
