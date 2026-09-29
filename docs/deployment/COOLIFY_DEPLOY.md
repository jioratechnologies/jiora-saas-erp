# Deploying to Coolify

This deployment splits into three independent Coolify resources:

1. **Postgres** — Coolify's native PostgreSQL resource (not a compose file).
2. **Object storage** — `infra/docker-compose.minio.yaml` (MinIO; any other
   S3-compatible service works too — `apps/api` talks to it through the
   generic AWS S3 SDK, nothing MinIO-specific in the code).
3. **App stack** — `infra/docker-compose.coolify.yaml` (pgbouncer, mongo,
   valkey, Zitadel, api, web).

Nothing publishes a `ports:` mapping, with one deliberate exception: object
storage. `web` (the frontend) and `zitadel` (the auth server — browsers must
be redirected to it directly for the OIDC login flow) are the two things
meant to be reachable from the public internet. Object storage also ends up
publicly reachable, but not because it's added to the app stack's network —
`apps/api` issues presigned GET/PUT URLs that the browser fetches directly
(see `apps/api/src/storage/storage.service.ts`), bypassing `api` entirely,
so the storage endpoint has to be a public HTTPS host. This is the same
shape as real AWS S3: a public endpoint protected by request signing, not an
open door. `api` itself has no public route of any kind: `web`'s nginx
proxies `/api/*` to it over the internal network (see `apps/web/nginx.conf`),
so the browser never talks to `api` directly.

## 0. Create the shared internal network

Postgres, object storage, and the app stack all need to land on the same
Docker network so they can reach each other by service name (object storage
also needs the `coolify` network — see step 2 — but still joins this one
too, for the `setup` one-shot job's internal call). Coolify calls
this a **Destination**.

In Coolify: **Servers → your server → Destinations → + Add Docker Network**,
name it `saas-erp-internal`. When you create each resource below, pick this
Destination for it.

If you'd rather do it by hand once on the host instead:

```bash
docker network create saas-erp-internal
```

Coolify's own Traefik listens on a separate network it manages itself,
usually named `coolify` — that one already exists on every Coolify server
and is what the `web` and `zitadel` services in
`docker-compose.coolify.yaml` join in addition to `saas-erp-internal`.

## 1. Postgres (separate resource)

Use Coolify's built-in **PostgreSQL** database resource rather than a
compose file — you get backups and a UI for free.

1. **Resources → + Add → Database → PostgreSQL**. Set the Destination to
   `saas-erp-internal`. Set a strong password for the default superuser.
2. Once it's running, open its Connection tab and note the internal
   hostname Coolify gives it (this is your `POSTGRES_HOST` for the app
   stack's `.env`) and the port (normally `5432`).
3. Open a terminal against it (Coolify's resource page has a "Terminal" /
   "Execute Command" action, or `docker exec -it <container> psql -U <user>`) and run, once:

   ```sql
   CREATE DATABASE zitadel;

   CREATE ROLE app_runtime LOGIN PASSWORD 'put-a-real-password-here';
   GRANT CONNECT ON DATABASE saaserp TO app_runtime;
   ```

   This mirrors `infra/postgres/init/01-create-zitadel-db.sql` and
   `02-create-app-runtime-role.sh` from the local dev stack — Coolify's
   native Postgres resource doesn't run custom init scripts, so this is the
   one-time manual equivalent. `app_runtime` is the least-privilege role the
   app connects as; see `docs/adr/0001-multi-tenancy-shared-schema-rls.md`
   for why it's not the table owner.
4. The `saaserp` database itself is whatever database name you gave the
   resource when creating it — make sure it matches `POSTGRES_DB` in the
   app stack's `.env`.

## 2. Object storage — MinIO (separate resource)

Deploy `infra/docker-compose.minio.yaml` as a Coolify **Docker Compose**
resource, Destination `saas-erp-internal`. It also joins the `coolify`
network on its own (declared in the compose file) so its S3 API can get a
Traefik route — that's required, not optional: `apps/api` issues presigned
GET/PUT URLs that the browser fetches directly (see
`apps/api/src/storage/storage.service.ts`), bypassing `api` entirely, so the
storage endpoint has to be a public HTTPS host. Same shape as real AWS S3: a
public endpoint protected by request signing, not an open door. The
console (port 9001) has no route baked into the compose file's labels — add
it separately via Coolify's **Domains** page if you want console access
(pick the `Minio` service, port `9001`, and turn on that domain's **Basic
Auth** option before saving — it's the full admin console, not the S3 API).

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
recreated in Coolify, silently starting empty):

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

Deploy `infra/docker-compose.coolify.yaml` as a Coolify **Docker Compose**
resource, Destination `saas-erp-internal` (the compose file itself also
joins the `coolify` network for the two public-facing services — Coolify
handles that network's existence for you).

Copy `infra/.env.deploy.example` to `.env` for this resource and fill in
every value, plus these additions the compose file needs that aren't in the
example file (because they point at the now-separate Postgres and object
storage resources, and your real domains):

| Variable | Value |
| --- | --- |
| `POSTGRES_HOST` | Internal hostname from the Postgres resource's Connection tab |
| `POSTGRES_PORT` | Usually `5432` |
| `OBJECT_STORAGE_ENDPOINT` | Same as `MINIO_DOMAIN` from step 2, no scheme/port |
| `WEB_DOMAIN` | e.g. `app.your-domain.example` |
| `ZITADEL_DOMAIN` | e.g. `auth.your-domain.example` |
| `RESEND_API_KEY` | From Resend's dashboard |
| `RESEND_FROM_ADDRESS` | Must be on a domain verified in Resend |
| `RESEND_FROM_NAME` | Optional, defaults to "Jiora SaaS ERP" |
| `ZITADEL_CLIENT_ID` | From the one-time Zitadel console step, see `docs/onboarding/GETTING_STARTED.md` step 4 |

Point Coolify's DNS/domain settings at `WEB_DOMAIN` and `ZITADEL_DOMAIN` as
you would for any Coolify app — Traefik picks up the routing from the
labels already in the compose file, no port numbers involved anywhere.

### Critical: Deployment order and MinIO setup

**Deploy order matters on first bring-up.** Postgres and object storage need to
exist and be reachable before the app stack starts:

1. **Postgres** (Coolify native resource) — `zitadel` needs its database on first boot
2. **Object storage** (MinIO compose resource) — **must include the `setup` one-shot service**
   - When you deploy `infra/docker-compose.minio.yaml` to Coolify, the `setup` service runs automatically and creates:
     - The `saas-erp-documents` bucket
     - The scoped app user with `OBJECT_STORAGE_ACCESS_KEY`/`SECRET_KEY`
     - A restrictive policy (read/write/delete/list on the bucket only — cannot create buckets or other resources)
   - **Wait for `setup` to complete** before proceeding (check the resource logs in Coolify — it should finish with policy attachment and exit).
   - If you redeploy MinIO later, `setup` is safe to re-run (all steps are idempotent).
3. **App stack** (`infra/docker-compose.coolify.yaml`) — now safe to start
   - The `api` container will start and verify the bucket exists.
   - If you see a warning in logs: `Failed to create object storage bucket "saas-erp-documents": Access Denied`, it means `setup` didn't run or hasn't completed yet — wait for it and redeploy `api` once the bucket exists.

**Why this order?** The app user (`OBJECT_STORAGE_ACCESS_KEY`) is intentionally scoped and cannot create buckets — only read/write within an existing one. The `setup` service runs with root credentials (`MINIO_ROOT_USER`/`PASSWORD`) and does the one-time initialization.

## Notes

- `api` never gets a `coolify` network membership or Traefik labels — this
  is intentional, not an oversight. If a later feature needs the browser to
  reach `api` directly (e.g. a websocket endpoint nginx can't proxy), add a
  dedicated `location` block to `apps/web/nginx.conf` rather than exposing
  `api` itself.
- `ZITADEL_ISSUER` (used by `api` to validate tokens) and
  `VITE_ZITADEL_ISSUER` (baked into the `web` build) must both resolve to
  the same public HTTPS URL — `https://${ZITADEL_DOMAIN}` — since it's
  embedded in issued tokens and used for JWKS discovery.
- SMTP (Resend) is configured via env vars directly on `zitadel`, not
  through its Console UI — the very first bootstrap admin activation email
  has to send before anyone can log in to reach the Console at all, so it
  can't wait for a post-login manual step the way local dev's Mailpit setup
  does. Mailpit itself is intentionally not used here — it only catches
  mail locally, doesn't deliver anywhere a real user could read it.
- Observability (`otel-collector`, `tempo`, `loki`, `prometheus`, `grafana`
  from the local dev stack) is intentionally left out of the Coolify compose
  file. Add it as its own resource on `saas-erp-internal` later if needed;
  none of it needs a public route except optionally `grafana`.
