# Sachhi Saheli / jioratech SaaS-ERP — Platform Architecture & Admin+HR Implementation

## Context

Repo (`jioratech/saas-erp`) is currently empty of code — only client-facing requirement docs (`docs/requirements/`, `docs/archive/`) and three deliverable `.docx` files sit at the root. The earlier work in this repo scoped one client's (Sachhi Saheli) ERP requirements and a 6-phase delivery plan (Foundation & Admin → HR Core → HR Payroll → Finance → Projects → CRM).

The user now wants to build the underlying **product**, not just Sachhi Saheli's instance: a **multi-tenant, white-labelable SaaS ERP platform**, starting with the Admin + HR module. Other tenants (clients) will run on the same platform later, each with their own branding/theme, own custom roles, and own data, while a platform team (Super Admin / Developer / Maintainer) operates and maintains all tenants centrally.

This plan covers: full tech stack decisions, repo scaffold, multi-tenancy + auth/RBAC design, observability, documentation structure, system diagrams, and the first implementation pass (Phase 0 infra + Phase 1 Foundation & Admin, wired into Postgres/Zitadel/etc. and buildable/runnable locally).

## Key Architecture Decisions

| Area | Decision | Why |
|---|---|---|
| Monorepo tool | **pnpm workspaces + Turborepo** | pnpm for install/linking, Turborepo on top for cached, parallelised `build`/`lint`/`test`/`dev` pipelines across `apps/*` and `packages/*` — avoids every app re-building everything on every change, still just one `turbo.json` for interns to read. |
| Backend | **Node.js + TypeScript, NestJS** | Modular (DI, guards, interceptors) — maps directly to "tenant context," "role guard," "audit interceptor" concepts interns can name and find. Built-in OpenAPI/Swagger doc generation. |
| Frontend build | **Vite** | Dev server + build for the React app — fast HMR, minimal config, standard pairing with React+TS. |
| ORM | **Prisma** | Single `schema.prisma` = readable source of truth for the whole DB, type-safe client, migration history in-repo. Raw SQL escape hatch used only for Postgres RLS policies (Prisma doesn't manage RLS natively). |
| Primary DB | **PostgreSQL 17** | All core business entities (tenants, users, roles, employees, HR records). Row-Level Security (RLS) enforces tenant isolation at the DB layer, not just app code. |
| Connection pooling | **PgBouncer** in front of Postgres 17, **transaction pooling mode** | Nest/Prisma open/close connections per request far faster than pooled DB connections can be recycled without it; transaction mode scales best under many tenants/short requests. Tenant context is therefore set with `SET LOCAL app.tenant_id` inside each request's transaction (not session-level `SET`), since transaction-mode pooling doesn't guarantee the same physical connection across statements — `SET LOCAL` is scoped to the transaction and is safe under it. |
| Multi-tenancy model | **Shared DB, shared schema, `tenant_id` + Postgres RLS** (default for all tenants) | Cheapest to operate at NGO/SMB scale, one migration path, DB-enforced isolation. Every table that holds tenant data carries `tenant_id`; a session-scoped Postgres role variable (`app.tenant_id`) drives RLS policies. Escape hatch: because every query is already tenant-scoped at the app layer, a large/compliance-sensitive tenant can be moved to a dedicated DB later as a data-migration job, not an architecture rewrite. |
| Secondary DB | **MongoDB**, scoped narrowly to **audit/activity log + notification history** | High-write, schema-flexible, append-mostly data doesn't belong in the relational core. All business entities stay in Postgres — Mongo never holds source-of-truth business data. This scoping is written up as an ADR so it's never "which DB do I use" per feature. |
| Cache / queue | **Valkey** (Redis-protocol-compatible, Linux-Foundation-governed open-source fork) instead of Redis | Redis itself moved off a permissive OSS license in 2024; Valkey is the drop-in-compatible open fork. Used for: BullMQ job queues (payroll runs, report generation, notification dispatch), permission/theme cache, rate limiting. |
| Object storage | **MinIO** (S3-compatible) | Employee documents, evidence photos, payslips, exports. Backend issues presigned PUT/GET URLs; files never proxy through the API process. |
| AuthN | **Zitadel** (self-hosted) | Native multi-tenant "Organization" concept out of the box, OIDC/OAuth2, MFA, lightweight and fast compared to Keycloak, actively maintained, Postgres-backed (fits existing infra). Zitadel = **who you are**. |
| AuthZ | **Custom RBAC in Postgres** (permissions catalog + tenant-scoped roles + role_permissions + user_roles) | Zitadel handles identity only. Fine-grained, per-tenant custom roles need SQL-queryable, RLS-joinable authorization — Zitadel's own role model isn't a fit for "org owner builds arbitrary custom roles." Zitadel = **who you are**, Postgres RBAC = **what you can do**. |
| Fixed roles | `super_admin`, `developer`, `maintainer` (platform-level, cross-tenant) + `admin` (one per tenant, org owner, seeded at tenant creation, not deletable) | Matches the user's explicit instruction — nothing else is fixed. |
| Custom roles | Tenant `admin` creates/edits/deletes roles via a Role Builder UI; each role = a named subset of a fixed, system-seeded permission catalog (e.g. `hr.employee.read`, `finance.expense.approve`) | Standard RBAC-with-custom-roles pattern; interns can read the `permissions` seed file to see the full catalog. |
| Frontend | **React + Vite + TypeScript**, TanStack Query (data fetching), Zustand (state), React Router, **shadcn/ui + Tailwind** | shadcn/ui components are theyme-driven via CSS custom properties out of the box — direct fit for "multiple theme options" and white-labelling per tenant. Zustand over Redux: far less boilerplate for interns. |
| Theming / white-label | Tenant `theme` record (colors, logo, optional custom domain) fetched at app boot, applied as CSS variables via a `ThemeProvider` | No rebuild needed per tenant; "powered by" branding is conditional on a tenant flag. |
| Observability | **OpenTelemetry SDK** in the NestJS backend (auto-instrumented HTTP/Postgres/Redis/Mongo clients) → **OTel Collector** → **Grafana stack** (Tempo=traces, Loki=logs, Prometheus=metrics, Grafana=dashboards) | Fully open-source, self-hosted, one vendor-neutral instrumentation layer. |
| Go / Python | **Not used in v1.** Revisit only if a specific worker (e.g. heavy PDF/Excel generation, OCR) proves Node.js is a bottleneck. | Avoids polyglot ops overhead before there's a measured need — stated explicitly as an ADR, not a silent omission. |
| Backend topology | **Modular monolith** (single NestJS app, feature modules), not microservices | Matches team size and fresher-onboarding goal. Module boundaries (`tenants`, `auth`, `hr`, `finance`, …) are drawn so any module can be extracted into its own service later without a rewrite. |

## Repository Structure

```
saas-erp/
  apps/
    api/                 # NestJS backend (modular monolith)
    web/                 # React + Vite frontend (tenant-facing app + super admin panel, route-gated)
  packages/
    shared-types/        # TS types/DTOs shared between api and web
    permissions/         # the seeded permission catalog (single source of truth)
  infra/
    docker-compose.yml   # postgres, pgbouncer, mongo, valkey, minio, zitadel, otel-collector, grafana stack
    otel/                # collector config
  docs/
    architecture/        # ARCHITECTURE.md + diagrams/*.svg
    adr/                 # one .md per key decision above
    onboarding/          # GETTING_STARTED.md — intern-facing
    requirements/        # (existing) client requirement docs
    deliverables/        # move the 3 root-level client .docx files here (housekeeping)
  turbo.json              # pipeline definitions (build/lint/test/dev) for turborepo
  pnpm-workspace.yaml
  README.md
```

App services (`api`, `web`) and Prisma connect through **PgBouncer**, never directly to Postgres — this is the one connection string interns need to know (`DATABASE_URL` → PgBouncer; a separate `DIRECT_URL` → Postgres is used only for running Prisma migrations, since DDL needs a direct, non-pooled connection).

## RBAC Data Model (Postgres)

- `tenants` — id, name, theme/branding, custom domain
- `users` — id, tenant_id (nullable for platform users), zitadel_subject_id
- `permissions` — system-seeded catalog, not tenant-editable (e.g. `hr.employee.read`)
- `roles` — tenant_id (nullable for platform roles), name, `is_protected` (true for seeded `admin`)
- `role_permissions`, `user_roles` — join tables
- RLS policy on every tenant-scoped table: `USING (tenant_id = current_setting('app.tenant_id')::uuid)`. Set per-request via `SET LOCAL app.tenant_id = …` inside the same Prisma transaction that resolves the caller's tenant — required (not just recommended) because requests go through PgBouncer in transaction-pooling mode.

## Diagrams (Mermaid → exported to `docs/architecture/diagrams/*.svg`, referenced from ARCHITECTURE.md)

1. High-level system architecture (web/api/Postgres/Mongo/Valkey/MinIO/Zitadel/OTel)
2. Multi-tenancy request flow (JWT → tenant resolution → `SET app.tenant_id` → RLS)
3. AuthN/AuthZ flow (Zitadel OIDC handshake → Postgres RBAC permission check)
4. Role model (fixed platform roles + tenant `admin` + custom tenant roles)
5. Admin & HR data flow (org setup → user/role → employee/volunteer → attendance/leave)

Diagrams are drafted with the draw.io/Mermaid MCP for quick visual iteration, then the final Mermaid source is rendered to `.svg` via `npx @mermaid-js/mermaid-cli` and committed as real files under `docs/architecture/diagrams/` (not just left as in-chat widgets).

## Documentation Plan

- `docs/architecture/ARCHITECTURE.md` — system overview, links to all diagrams
- `docs/adr/0001-multi-tenancy-shared-schema-rls.md`, `0002-zitadel-for-authn.md`, `0003-postgres-rbac-for-authz.md`, `0004-valkey-over-redis.md`, `0005-mongo-scoped-to-audit-log.md`, `0006-no-go-python-in-v1.md`, `0007-pgbouncer-transaction-pooling-and-set-local.md` — each: context, decision, consequences (fresher-readable, ~half a page each)
- `docs/onboarding/GETTING_STARTED.md` — clone → `pnpm install` → `docker compose up` → `pnpm --filter api prisma migrate dev` → `pnpm dev`, walks the repo structure, explains where to add a new module
- Every NestJS module gets a short `README.md` explaining its purpose (not inline essay-comments — comments in code stay minimal per normal engineering practice; the "explain it to a fresher" job belongs to these READMEs and the ADRs)

## Implementation Phases

- **Phase 0 — Infra & Scaffold** (this pass): pnpm + Turborepo monorepo skeleton, `infra/docker-compose.yml` (Postgres 17, PgBouncer, MongoDB, Valkey, MinIO, Zitadel, OTel Collector, Grafana stack), Prisma schema skeleton (`tenants`, `users`, `permissions`, `roles`, `role_permissions`, `user_roles`), RLS policies + tenant-context middleware, Zitadel integration (login → JWT verified in NestJS), base NestJS app with health check, base React app with auth-gated shell + ThemeProvider. Diagrams + docs scaffolding (ADRs 1–6, ARCHITECTURE.md, GETTING_STARTED.md). Caveman skill install (`caveman:caveman-init`).
- **Phase 1 — Foundation & Admin** (this pass): tenant provisioning (create org, seed `admin` role), Super Admin panel skeleton (tenant list/create/suspend, impersonate), tenant Admin panel skeleton (org profile, department/designation CRUD, Role Builder UI wired to the permission catalog, user invite/list with role assignment), theming settings screen.
- **Phase 2 — HR Core** (next pass, not in this implementation): Employee/Volunteer master, attendance, leave — deferred until Phase 1 is reviewed and running.
- **Phase 3 — HR Payroll & Claims** (future pass): as scoped in the existing Phased Delivery Plan doc.

Phases 2–3 are **not** built in this pass — Phase 0+1 alone is already a full backend+frontend+infra slice; bundling HR Core into the same pass risks an unreviewable wall of code.

## Verification (end of this pass)

- `docker compose up` brings up all infra services cleanly
- `pnpm --filter api prisma migrate dev` applies schema + RLS policies without error
- Can log in via Zitadel from the web app, land on tenant-scoped dashboard shell with theme applied
- Creating a second tenant (via Super Admin panel) and switching between them proves RLS isolation (tenant A cannot see tenant B's data) — verified with a direct `psql` query (against Postgres directly) and through the API (through PgBouncer), confirming RLS holds under pooled connections too
- `turbo run build` and `turbo run dev` both work from the repo root and correctly scope to `apps/api` + `apps/web`
- `docs/architecture/diagrams/*.svg` files exist and are referenced from `ARCHITECTURE.md`
- Each ADR file exists and is linked from `ARCHITECTURE.md`
