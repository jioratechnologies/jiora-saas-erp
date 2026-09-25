# ADR 0005 — MongoDB, scoped narrowly to audit/activity log

## Context

The platform runs two databases: Postgres (ADR 0001) and MongoDB. Having two databases only
works if it's always obvious which one a given piece of data belongs in — otherwise every new
feature becomes a "which DB do I use?" debate.

## Decision

**MongoDB holds only audit/activity log and notification history.** Every business entity —
tenants, users, roles, departments, and everything HR/Finance/Projects/CRM add in later phases —
lives in Postgres. Nothing that needs to join against tenant/user/role data, or that Postgres RLS
needs to protect, goes in Mongo.

## Why

- Audit/activity log data is high-write, append-mostly, and doesn't need relational integrity —
  a good fit for Mongo's document model and write throughput.
- It's schema-flexible by nature (every action logs a different shape of "what changed"), which
  is exactly what forcing it into rigid Postgres columns would fight against.
- Keeping it out of Postgres means the audit log's write volume never competes with the
  transactional core for the same connection pool / RLS-checked queries.

## Consequences

- If a future feature seems to need "a bit of both," that's a sign it's actually a Postgres
  entity with a Mongo-logged history of changes to it (e.g. "employee record" = Postgres,
  "history of edits to that employee record" = Mongo) — not one Mongo collection holding the
  entity itself.
- Mongo access is not behind Postgres RLS — tenant isolation for audit log entries has to be
  enforced in application code (always filter by `tenantId` on every Mongo query). This is a
  weaker guarantee than the RLS-backed Postgres tables, which is acceptable for this ADR's scope
  (audit/log data, not primary business records) but should be kept in mind if audit log
  read-access is ever exposed directly to tenant users.
