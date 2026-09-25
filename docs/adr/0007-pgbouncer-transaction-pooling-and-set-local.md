# ADR 0007 — PgBouncer in transaction-pooling mode, and what that requires of every query

## Context

NestJS/Prisma opening and closing a raw Postgres connection per request doesn't scale well —
connection setup is relatively expensive, and Postgres has a hard limit on concurrent
connections. A connection pooler sits in front of Postgres to reuse a small set of real
connections across many app-level requests.

## Decision

**PgBouncer, in transaction-pooling mode** (`infra/docker-compose.yml`, service `pgbouncer`,
`POOL_MODE: transaction`). The app connects to PgBouncer (`DATABASE_URL`, via the `app_runtime`
role — see ADR 0001), never directly to Postgres, except for migrations (`DIRECT_URL`, via the
`saaserp` owner role, straight to Postgres — migrations run DDL, which needs a direct
connection).

## What "transaction pooling" requires of the app

In transaction-pooling mode, PgBouncer only guarantees you keep the same physical Postgres
connection **for the duration of one transaction** — the next transaction on the same app-level
connection might land on a completely different physical connection. This matters a lot here,
because Postgres RLS (ADR 0001) depends on session state (`app.tenant_id`).

Two settings are relevant:

- `SET app.tenant_id = '...'` is **session**-scoped — it would "leak" onto whatever the next
  transaction pulled from the pool happens to be, on a connection that might now belong to a
  different tenant's request. **Do not use this.**
- `SET LOCAL app.tenant_id = '...'` (equivalently, `set_config('app.tenant_id', ..., true)`) is
  **transaction**-scoped — it's automatically cleared when the transaction ends, which is exactly
  what transaction pooling requires.

This is why `PrismaService.runInTenantContext()` (`apps/api/src/prisma/prisma.service.ts`) always
wraps the tenant-context `SET` and the actual query in the *same* `$transaction(...)` call — the
two have to happen atomically together, every time.

## Consequences

- Nobody should ever call `set_config(..., false)` (session-scoped) or a bare `SET` (also
  session-scoped) anywhere in this codebase for tenant context. If you find yourself needing to
  set it outside `runInTenantContext`, that's a sign the query should be restructured to go
  through it instead.
- Pool size (`DEFAULT_POOL_SIZE: 20` in `infra/docker-compose.yml`) can be tuned independently of
  how many concurrent app requests are in flight, since PgBouncer is what's actually managing the
  small set of real Postgres connections.
