# ADR 0001 — Multi-tenancy: shared schema, `tenant_id` + Postgres RLS

## Context

Every tenant (client organisation, e.g. Sachhi Saheli) needs its data kept completely separate
from every other tenant's. There are three common ways to do this:

1. **Shared database, shared schema** — one set of tables, every tenant-scoped row carries a
   `tenant_id` column, and something enforces that a query only ever touches its own tenant's rows.
2. **Shared database, one schema per tenant** — same database, but each tenant gets its own
   Postgres schema (its own copy of every table).
3. **One database per tenant** — full physical separation.

## Decision

Option 1, with the enforcement done by **Postgres Row-Level Security (RLS)**, not just
application code. Every tenant-scoped table (`departments`, `designations`, `users`, `roles`,
`role_permissions`, `user_roles`) has RLS policies that filter rows to the tenant set on the
current transaction (`app.tenant_id`, via `SET LOCAL` — see ADR 0007).

## Why not the alternatives

- **Schema-per-tenant** means every migration has to run once per tenant schema. Fine for a
  handful of large enterprise tenants; painful once you have dozens of small NGO/SMB tenants —
  exactly the client base this platform is built for.
- **Database-per-tenant** is the strongest isolation, but the highest operational cost (one
  Postgres instance/connection pool per tenant). Reserved as a possible **premium/compliance
  tier later** — because every query already goes through `tenant_id`, moving one specific tenant
  to its own database is a data-migration exercise, not an architecture rewrite.

## Why RLS specifically, not just "always add `WHERE tenant_id = ...`" in application code

Application-level filtering works right up until one query forgets the `WHERE` clause — a single
missed filter in one endpoint leaks one tenant's data to another. RLS makes the database itself
refuse to return rows outside the current tenant, even if the application code has a bug. It's a
second, independent layer, not a replacement for careful queries.

## Consequences

- The app must always run tenant-scoped queries inside `PrismaService.runInTenantContext(...)`
  (see `apps/api/src/prisma/prisma.service.ts`) — a plain `prisma.department.findMany()` outside
  that helper runs with no tenant context set, and RLS will return zero rows, not "all rows".
- The app connects to Postgres as a **non-owner** role (`app_runtime`), because RLS does not
  apply to a table's owner by default. See ADR 0007 and the `enable_row_level_security` migration.
- Platform-level rows (e.g. `users`/`roles` with `tenant_id IS NULL`) are visible only when the
  transaction is explicitly in "platform context" — see ADR 0003.
