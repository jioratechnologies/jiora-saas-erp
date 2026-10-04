# Splitting the API into services behind Kong

Status: approved direction, implementation in slices. Supersedes the "modular monolith, not microservices" note in `ARCHITECTURE.md` once slice 11 ships (see ADR 0012).

## Goal

Run the ERP as separately deployable services, one per business area, behind Kong, from a single codebase and a single Postgres (row-level security per tenant stays). Public URLs do not change, so the web and mobile apps keep working.

| Service | Owns (tables) | Public prefixes |
|---|---|---|
| `identity` | Tenant, Department, Designation, User, Role, RolePermission, UserRole | `/auth`, `/admin`, `/platform`, `/public` |
| `hr` | Person, PersonDocument, Attendance, LeaveType, LeaveRequest, Holiday | `/hr`, `/auth/profile/(kyc\|documents)`, `/admin/departments/:id/(members\|head)` |
| `payroll` | SalaryComponent, SalaryStructure, EmployeeSalaryAssignment, SalaryRevision, PayrollRun, Payslip, ExpenseClaim, SalaryAdvance, PayrollAdjustment | `/payroll` |

A module may read shared reference tables (Tenant, Department, Designation, User, Role, Person, Holiday, Attendance, LeaveRequest) through read-only readers. It never writes another module's tables.

## Cross-module coupling found in the code

Writes that must become events or internal calls:

1. Onboarding salary: `hr/services/persons.service.ts` writes payroll tables when a person is created or bulk imported.
2. Invites: `persons.service.ts` imports `createInvitedUserInTx` from `admin/users.service.ts` (identity tables, mail).
3. Exit: `finalizeExit` deactivates the user (identity table).
4. Promotion: `payroll/services/salary.service.ts` updates `person.designationId` (hr table).
5. Department people operations: `admin/departments.service.ts` updates persons (members, head, remove, manager reassignment).
6. Profile: `auth/profile.controller.ts` writes Person and PersonDocument.

Reads that stay as shared read-only access for now: payroll reading attendance, leave, holidays, persons and tenant work-schedule settings; hr reading users, departments and designations; the permission-assignment rule in `rbac.service.ts`.

## Target design

- One repository, one build, several entry points: `entries/{all,identity,hr,payroll}.main.ts`. `all` runs every module in one process for development and tests.
- Layout: `src/modules/{identity,hr,payroll}` plus `src/shared/*` (prisma, auth guard, cache, storage, mail, events, internal HTTP, readers, common). Modules import only `@shared/*` and themselves; a lint rule enforces this, and a model-ownership check fails the build on cross-module writes.
- One Docker image with `ARG SERVICE`. Migrations run as a single one-shot job, never at service start.
- Events: NATS JetStream (its own infrastructure resource; 3 nodes in production, 1 locally) with a transactional outbox table. A relay publishes outbox rows to the stream `ERP_EVENTS`, de-duplicating with the `Nats-Msg-Id` header. Subjects look like `erp.<service>.<entity>.<event>` (for example `erp.hr.person.created`); the tenant id travels in the event envelope. Each service has its own durable consumers with a delivery limit and a dead-letter subject. Consumers are idempotent. Events: `person.created`, `person.exited`, `designation.changed`, `leave.approved`, `tenant.suspended`, `authctx.invalidate`.
- Internal calls: NATS request/reply with a 2 s timeout (or HTTP under `/internal/*` with signed service tokens as a fallback). Each cross-module call is a port with a local adapter (same process) and a remote adapter, so rollback is a configuration change. NATS accounts and credentials replace hand-rolled service tokens.
- Redis is cache only (login context, person context, reference data, Kong rate limits): one instance, `maxmemory-policy allkeys-lru`, no persistence. It is never used for events.
- Login: every service verifies the Zitadel token itself. The permission lookup is cached in Redis (30-60 s) and invalidated by events.
- Observability: `x-request-id` from Kong in every log line, event and internal call; OpenTelemetry traces across services.

## Sagas

- Onboarding with salary: create the person, then call payroll; if payroll is down the outbox event applies the salary later and the response says "Salary will be applied shortly."
- Invite: create the person, call identity to create or link the user and send the mail, then link the user to the person. A failure only produces the existing "invitation could not be sent" note.
- Promotion: change the designation in hr first, then write the revision in payroll; compensate by restoring the old designation if payroll fails.
- Exit: hr marks the person exited and emits `person.exited`; identity deactivates the login within seconds.

## Slices

1. Kong in front of the monolith (all routes to one upstream). **Done as configuration; see `infra/kong/`.**
2. Restructure into `modules/` and `shared/`, add the `all` entry (mechanical, no behaviour change).
3. Break compile-time coupling (shared validators, invite port, person reader), add the boundary lint.
4. Model-ownership check; add `person_id` and `person_status` to the login lookup function.
5. Events and outbox infrastructure on NATS JetStream (stream, durable consumers, relay, dead-letter handling). Needs the `nats` client dependency.
6. Internal calls (NATS request/reply, HTTP fallback) and port adapters.
7. Convert onboarding salary and promotion.
8. Convert invite and exit deactivation.
9. Convert department person operations and profile documents; add Kong regex routes.
10. Login-context cache with invalidation events.
11. Dockerfile `ARG SERVICE`, migrate job, per-service env and pool sizes, compose `split` profile.
12. OpenTelemetry and request-id propagation.
13. Cut over payroll, soak, then hr; identity is what remains. Rollback: point the Kong route back at `all` and set `INTERNAL_MODE=local`.
14. Per-service database roles and grants (cross-module writes fail in the database).

Per-service sizing to start with: identity port 3001, pool 10; hr 3002, pool 15; payroll 3003, pool 8 with a 60 s transaction timeout for payroll runs. The sum of pools must stay below the PgBouncer pool and Postgres `max_connections`.

## Rules while this is in progress

- The single-process `all` build must keep working at every slice.
- Database changes are expand-only until the split is complete, so any step can be rolled back by routing back to `all`.
- No slice goes live without a review and your approval for any database migration.
