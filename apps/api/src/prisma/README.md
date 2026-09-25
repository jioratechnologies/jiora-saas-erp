# prisma/

Wraps Prisma's generated client with exactly one addition: `PrismaService.runInTenantContext()`.

Every query touching a tenant-scoped table (departments, designations, users, roles, ...) must go
through it. It's what sets the Postgres session variables Row-Level Security policies check —
skip it and RLS silently returns zero rows instead of the ones you expected. See
`docs/adr/0001-multi-tenancy-shared-schema-rls.md` and
`docs/adr/0007-pgbouncer-transaction-pooling-and-set-local.md`.
