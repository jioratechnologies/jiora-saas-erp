# Kong API gateway

Kong (DB-less, image `kong:3.9`) sits between the web nginx (`/api/*`) and the backend.
Browser -> nginx (strips `/api`) -> Kong `:8000` -> service. Config is `kong.yml` in this folder,
mounted read-only at `/kong`.

Kong does not check JWTs. Each service verifies the Zitadel token itself, and Kong passes the
`Authorization` header through untouched.

## Services and routes

| Kong service | Paths | Today points at |
|---|---|---|
| api-identity | /auth, /admin, /platform, /public, /health | backend:3000 |
| api-hr | /hr | backend:3000 |
| api-payroll | /payroll | backend:3000 |

Paths are not stripped, so the backend keeps its prefixes.

## Validate

    docker run --rm -e KONG_DATABASE=off -v $PWD/infra/kong:/kong kong:3.9 kong config parse /kong/kong.yml

(`KONG_DATABASE=off` is needed, otherwise the command tries to reach Postgres.)

## Add or split a service

1. Add an `upstreams:` entry with its own `targets:` (for example `api-hr:3000`).
2. Add a `services:` entry whose `host` equals the upstream name, with its routes.
3. Split an existing one: only change `target:` of that upstream from `backend:3000` to the new host.
4. Add the new container to the compose files on the same network, validate, restart Kong.

## Plugins

| Plugin | Scope | Setting |
|---|---|---|
| correlation-id | global | X-Request-ID, echoed back |
| cors | global | Authorization, Content-Type, Idempotency-Key; credentials; max_age 3600 |
| request-size-limiting | global 1 MB; 10 MB on upload routes | |
| rate-limiting | global 600/min per IP; 30/min on /auth/claim-invite | Redis db 1, fault tolerant |
| response-transformer | global | X-Content-Type-Options, Referrer-Policy |
| prometheus | global | metrics on status port 8100 |
| proxy-cache | only the routes below | memory, ttl 60, vary on Authorization |

CORS origins: Kong does not substitute env vars in `kong.yml`. Edit the `origins` list, or render the
file with `envsubst` from `KONG_CORS_ORIGINS` before start. Browsers use the same-origin nginx proxy,
so CORS mainly matters for direct callers.

## Caching rules

Cached (GET/HEAD only, 200 only, 60 s, separate per Authorization header):
/admin/departments, /admin/designations, /admin/roles/permission-catalog, /public/tenants,
/hr/holidays, /hr/leave/types. Nothing else is cached. Changes to this data can take up to 60 s to
show up.

## Test

    curl -i http://localhost:8000/health
    curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8000/hr/holidays   # twice: second has X-Cache-Status: Hit
    curl -s http://localhost:8100/metrics | head
    curl -i -H "Origin: http://localhost:5174" -X OPTIONS http://localhost:8000/hr/persons

The admin API listens on 127.0.0.1:8001 inside the container only: `docker exec saas-erp-kong kong health`.

## Caching rule (important)

Tenant data that users can change (departments, designations, holidays, leave types) is **not** cached in Kong:
the API caches it in Redis and clears that cache on every write, so users never see stale lists. Kong's
`proxy-cache` is kept only for the permission catalog and public tenant branding, and it honours the
upstream `Cache-Control` header (a `private` response is never stored by the gateway).
