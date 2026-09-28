# Deploying to Coolify

This deployment splits into three independent Coolify resources on one shared
internal Docker network:

1. **Postgres** — Coolify's native PostgreSQL resource (not a compose file).
2. **MinIO** — `infra/docker-compose.minio.yml`.
3. **App stack** — `infra/docker-compose.coolify.yml` (pgbouncer, mongo,
   valkey, Zitadel, api, web).

Nothing publishes a `ports:` mapping. The only two things reachable from the
public internet are `web` (the frontend) and `zitadel` (the auth server —
browsers must be redirected to it directly for the OIDC login flow). The
`api` container has no public route of any kind: `web`'s nginx proxies
`/api/*` to it over the internal network (see `apps/web/nginx.conf`), so the
browser only ever talks to your app's own domain.

## 0. Create the shared internal network

All three resources need to land on the same Docker network so they can
reach each other by service name. Coolify calls this a **Destination**.

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
`docker-compose.coolify.yml` join in addition to `saas-erp-internal`.

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

## 2. MinIO (separate resource)

Deploy `infra/docker-compose.minio.yml` as a Coolify **Docker Compose**
resource, Destination `saas-erp-internal`.

Fill in `.env` for this resource (copy `infra/.env.deploy.example` and take
just the MinIO section):

```
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET=saas-erp-documents
```

The compose file includes a one-shot `create-bucket` service that runs `mc mb --ignore-existing` against the bucket name on every deploy — it exits
immediately and doesn't need attention. There's no public console route by
design; if you need the MinIO console for a one-off look, use Coolify's
"Execute Command" against the `minio` container, or temporarily run
`docker run --rm -it --network saas-erp-internal minio/mc mc alias set local http://minio:9000 <access-key> <secret-key>` from the host, then `mc ls local/saas-erp-documents`.

## 3. App stack

Deploy `infra/docker-compose.coolify.yml` as a Coolify **Docker Compose**
resource, Destination `saas-erp-internal` (the compose file itself also
joins the `coolify` network for the two public-facing services — Coolify
handles that network's existence for you).

Copy `infra/.env.deploy.example` to `.env` for this resource and fill in
every value, plus these additions the compose file needs that aren't in the
example file (because they point at the now-separate Postgres resource and
your real domains):

| Variable              | Value                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `POSTGRES_HOST`     | Internal hostname from the Postgres resource's Connection tab                            |
| `POSTGRES_PORT`     | Usually`5432`                                                                          |
| `WEB_DOMAIN`        | e.g.`app.your-domain.example`                                                          |
| `ZITADEL_DOMAIN`    | e.g.`auth.your-domain.example`                                                         |
| `ZITADEL_CLIENT_ID` | From the one-time Zitadel console step, see`docs/onboarding/GETTING_STARTED.md` step 4 |

Point Coolify's DNS/domain settings at `WEB_DOMAIN` and `ZITADEL_DOMAIN` as
you would for any Coolify app — Traefik picks up the routing from the
labels already in the compose file, no port numbers involved anywhere.

Deploy order matters on first bring-up: Postgres and MinIO need to exist
and be reachable before the app stack starts, since `zitadel` needs its
database on first boot and `api` needs both on startup.

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
