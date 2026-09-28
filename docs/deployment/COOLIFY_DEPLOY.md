# Deploying to Coolify

This deployment splits into three independent Coolify resources:

1. **Postgres** — Coolify's native PostgreSQL resource (not a compose file).
2. **Object storage** — Coolify's one-click **Garage** template (S3-compatible;
   any other S3-compatible service works too — `apps/api` talks to it through
   the generic AWS S3 SDK, nothing Garage- or MinIO-specific in the code).
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

Postgres and the app stack need to land on the same Docker network so they
can reach each other by service name. Coolify calls this a **Destination**.
Object storage does *not* need to join it — see the note in the intro above,
it's reached over its public HTTPS endpoint instead.

In Coolify: **Servers → your server → Destinations → + Add Docker Network**,
name it `saas-erp-internal`. When you create the Postgres and app stack
resources below, pick this Destination for them.

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

## 2. Object storage (separate resource)

Use Coolify's one-click **Garage** service template rather than a compose
file from this repo — **Resources → + Add → Garage** (or search "Garage" in
the service catalog). Leave its **Network attachment** as "Use the stack
network only" — it doesn't need `saas-erp-internal`, since `api` reaches it
over its public S3 API URL (required for presigned URLs, see the intro
above), not an internal service name.

Garage has no web dashboard — it's CLI/API only. Once the service is
running, open its **Terminal** (or **Actions → Execute Command**) on the
`Garage` container and run, once:

```bash
garage bucket create saas-erp-documents
garage key create saas-erp-app-key
garage bucket allow --read --write --owner saas-erp-documents --key saas-erp-app-key
```

`garage key create` prints a **Key ID** and **Secret Access Key** — shown
only once, copy both. These, plus the service's **S3 API URL** (shown on its
General page, e.g. `s3-<host>.sslip.io`), are what the app stack needs:

```
OBJECT_STORAGE_ENDPOINT=s3-<host>.sslip.io   # host only, no https:// or port
OBJECT_STORAGE_ACCESS_KEY=<Key ID>
OBJECT_STORAGE_SECRET_KEY=<Secret Access Key>
OBJECT_STORAGE_BUCKET=saas-erp-documents
```

Any other self-hosted S3-compatible service (MinIO, SeaweedFS, etc.) works
the same way — `apps/api`'s `StorageService` talks to it through the generic
`@aws-sdk/client-s3` SDK with `forcePathStyle: true`, nothing provider-specific
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
| `OBJECT_STORAGE_ENDPOINT` | Garage's S3 API URL host, no scheme/port — see step 2 |
| `WEB_DOMAIN` | e.g. `app.your-domain.example` |
| `ZITADEL_DOMAIN` | e.g. `auth.your-domain.example` |
| `ZITADEL_CLIENT_ID` | From the one-time Zitadel console step, see `docs/onboarding/GETTING_STARTED.md` step 4 |

Point Coolify's DNS/domain settings at `WEB_DOMAIN` and `ZITADEL_DOMAIN` as
you would for any Coolify app — Traefik picks up the routing from the
labels already in the compose file, no port numbers involved anywhere.

Deploy order matters on first bring-up: Postgres and object storage need to
exist and be reachable before the app stack starts, since `zitadel` needs
its database on first boot and `api` needs both on startup.

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
- Observability (`otel-collector`, `tempo`, `loki`, `prometheus`, `grafana`
  from the local dev stack) is intentionally left out of the Coolify compose
  file. Add it as its own resource on `saas-erp-internal` later if needed;
  none of it needs a public route except optionally `grafana`.
