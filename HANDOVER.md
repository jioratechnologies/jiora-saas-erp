# Handover — saas-erp (Sachhi Saheli ERP)

Written 2026-10-05. Everything described here is in the working tree. **Nothing has been committed or pushed to git yet** (126 changed files on `main`). No secrets are in this file.

## 1. What this system is

Multi-tenant, white-labelable SaaS ERP. Pilot tenant: Sachhi Saheli (NGO), tenant slug `jiorasacchisahelitest1`.

- `apps/api` — NestJS (modular monolith today), Prisma, Postgres with row-level security per tenant.
- `apps/web` — React + Vite + HeroUI-style components, served by nginx.
- `apps/mobile`, `apps/mobile_flutter` — mobile clients (not touched in this work).
- `packages/permissions`, `packages/shared-types` — shared catalog and types.
- `infra/` — compose files (dev stack, production stack, Kong, Postgres/MinIO resources).
- Start reading: `docs/architecture/ARCHITECTURE.md`, `docs/onboarding/GETTING_STARTED.md`, `docs/adr/`, `docs/architecture/MICROSERVICES_SPLIT_PLAN.md`.

Phases: 0–3 built and hardened (infrastructure, admin/RBAC, HR core, payroll and claims). Phase 4 (Finance), 5 (Projects), 6 (CRM) are not started. The Phase 4 plan was reviewed; the revised 10-slice plan is in this repo's history of the conversation and should be rewritten into `docs/` before starting.

## 2. What changed in this session (by area)

**Platform and security**
- Global exception filter (friendly errors only), JWT audience check, lazy issuer config, suspended-tenant 403 (`auth_tenant_suspended()`), production compose uses the restricted `app_runtime` role through PgBouncer, seed script guarded.
- Authorization hardening across HR, payroll and admin (ownership checks, no self-approval, tenant checks on foreign keys, masked bank/PAN, scoped lists).
- Uploads: allowlist (PDF, PNG, JPEG, WebP, Word, Excel; 10 MB; avatar/logo images only). Inline preview only for PDF and images, everything else downloads (fixes a stored-XSS risk).
- Session: automatic refresh-token renewal and one retry on 401.

**Access model — designation = role** (ADR 0010)
- Each designation owns a role. Permissions = protected `admin` role + the person's designation role + a code-defined self-service set (`SELF_SERVICE_PERMISSION_KEYS`). Old custom roles were migrated into designations and deleted.
- Changing a designation requires being an admin or already holding all its permissions; nobody can change their own.
- UI: "Access Control" page with collapsible module cards, single "Grant Access" button, no permission keys shown.

**HR**
- Shared `PersonForm` (first/middle/last name, gender, DOB, phone required; alternate phone, addresses, emergency contact optional; WhatsApp removed). Optional login invitation email on create and bulk import. Bulk import is Excel-only with preview and a template.
- Exit flow: resignation sets NOTICE_PERIOD; EXITED only through the checklist (four items, exit date, reason). Final-settlement preview in the drawer.
- Attendance & Leave sidebar group (Attendance, My Leaves, Leave Approvals, Leave Policies & Holidays). Attendance report with employee search, date presets, Excel export. Manual entry endpoint fixed a bug where regularizing someone else checked in the manager.
- Departments page rebuilt (collapsible cards, head, add existing or create staff). Department Teams removed from HR.
- Users: single Invite button, Deactivated tab, permanent delete (login only; HR record kept).

**Payroll** (ADR 0011)
- Day-rate pay: per-day = monthly gross ÷ organisation "working days per month". Credit per working day from attendance, leave and holidays; half-day rule from "hours per day". Formula and tests are in `payroll-calc.ts` / `payroll-calc.spec.ts`.
- Organisation settings: working days, hours per day, salary split (basic/HRA/other = 50/25/25 by default). PF/PT/TDS are still placeholders labelled as such.
- Compensation page (monthly gross, CTC ×12, increments as an amount), Payroll page (month picker, attendance-and-pay table, Draft → Calculated → Approved → Disbursed, register export), bonus/allowance/deduction adjustments, A4 salary voucher with print/PDF/Excel, onboarding salary field.
- Structure templates and component UI were removed from the screens (tables still exist).

**Performance**
- Measured cause: the database is on a remote VM (~40 ms per round trip; spikes seen). A simple request cost about 8 round trips.
- Added: Redis cache for the login lookup (45 s, generation-counter invalidation), person-context cache, reference-data cache with explicit invalidation, server-side paging with search and stats, React Query caching, indexes, request timing log (>500 ms).
- Browser caching for reference data is `private, no-cache` (not max-age) so lists never look stale.
- Not done: join-loading (`relationJoins`) for the profile and roster handlers.

**Platform direction**
- Kong gateway config (`infra/kong/`), microservice split plan with NATS JetStream for events (`docs/architecture/MICROSERVICES_SPLIT_PLAN.md`). Only the Kong configuration is implemented; the code is still one deployable. Plan slices 2–14 are not started.

## 3. State of each environment

**Local compose (`infra/docker-compose.yaml`)**: backend, frontend, redis, pgbouncer, kong (defined, not yet started). Backend and frontend images were last rebuilt before the Kong and speed changes, so they do **not** include the Redis caches or Kong. If the backend crash-loops with "Can't reach database server at pgbouncer:5432", run `docker compose up -d redis pgbouncer` from `infra/`.

**Database**: one Postgres on the VM, used by local development *and* production. Applied so far: migrations through `20261006000000_payroll_adjustments`. **Not applied:** `20261007000000_performance_indexes` (14 indexes, `pg_trgm` extension). It will apply automatically when a rebuilt API container starts. Take a backup first.

**Starter data**: `apps/api/prisma/seed-payroll-demo.js` was applied once (a test salary and six holidays). Never run `prisma/seed.js` against a shared database: it truncates everything.

**Zitadel**: now a separate resource with its own database at `https://authsaaserp.jioratech.com`. The console API address, SMTP (Resend) and project were set up by the owner. Details in section 4.

## 4. Open items, in order

1. **Review and push.** The speed, index and Kong review failed on two items, both fixed (`backend` alias for Kong in production, real client IP for rate limits). Then: one summary commit on `main` and `git push origin main` (approval was asked, not yet given). If Dokploy deploys from `main`, the push triggers a production deploy and the index migration.
2. **Production environment (Dokploy)** must define: `ZITADEL_ISSUER`, `ZITADEL_PROJECT_ID`, `ZITADEL_CLIENT_ID`, `APP_RUNTIME_PASSWORD`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `WEB_DOMAIN`, `RESEND_*`. `DIRECT_URL` is now derived from the `POSTGRES_*` values when not set. Remove `ZITADEL_DOMAIN`, `ZITADEL_MASTERKEY` and the admin variables from the app stack (they belong to the Zitadel resource) and delete the old zitadel domain row there.
3. **Move users to the new Zitadel** (cutover): `node apps/api/prisma/migrate-users-to-zitadel.js` — dry run done: 4 active users (1 existing admin to link, 3 to create). Remaining: obtain the web application's Client ID, deploy the web build with the new issuer and client ID, then run `--create --link` (writes `users.zitadel_subject_id`, saves a backup file first). Logins on the old Zitadel stop the moment linking runs. New users set passwords with "Forgot password" (SMTP must work).
4. **Verify in a browser** (nothing in this session was clicked through): Payroll run, Add bonus, voucher print, Compensation and Increments, Organisation work schedule, People bulk import, document preview, Access Control.
5. **Housekeeping**: delete the Zitadel machine-user token after the migration. Put the new Resend key in `infra/.env` for local invite emails.
6. **Known gaps**: payroll maker-checker (needs a `calculatedBy` column); payroll for past months uses the current gross; the attendance report does not list days with no record as absent; PF/PT/TDS are placeholders awaiting client confirmation; Claims "outstanding advance" and other stats now come from the server, but are filtered by the active status filter.

## 5. Security actions needed (important)

Several secrets were pasted into chat during this work: Postgres and app-runtime passwords, MinIO keys, a Resend API key, the old Zitadel master key and admin password, the new Zitadel master key and admin password, and a Zitadel personal access token. **Rotate all of them.** The Zitadel master key cannot be rotated on a running instance; it should be regenerated before real users are added, which means recreating that instance. Never put secrets in tickets, chat or this repository. `.env`, `.env.*`, `docs/CREDENTIALS.local.md` and `zitadel-subject-backup-*.json` are gitignored.

## 6. Runbook

```bash
# tests and type checks
cd apps/api && npx tsc --noEmit -p . && npx jest        # 82 tests
cd apps/web && npx tsc --noEmit -p .

# local stack
cd infra && docker compose up -d redis pgbouncer backend frontend
curl -s localhost:3000/health

# Kong config check (no network needed)
docker run --rm -e KONG_DATABASE=off -v "$PWD/infra/kong":/kong kong:3.9 kong config parse /kong/kong.yml

# starter data (dry run by default)
node apps/api/prisma/seed-payroll-demo.js
# user migration to the new Zitadel (dry run by default)
node apps/api/prisma/migrate-users-to-zitadel.js
```

Rules used in this repo (see `CLAUDE.md`): friendly error messages only (never Prisma codes), map Prisma errors to Nest HTTP exceptions, errors in the web app go through `formatErrorMessage`, all tenant queries go through `runInTenantContext`, never re-add `incremental` to the API tsconfig.

## 7. Where to find things

| Topic | Location |
|---|---|
| Access model decision | `docs/adr/0010-designation-based-access.md` |
| Payroll day-rate decision | `docs/adr/0011-payroll-day-rate.md` |
| Split into services plan (NATS, Kong) | `docs/architecture/MICROSERVICES_SPLIT_PLAN.md` |
| Kong config and caching rules | `infra/kong/` |
| New indexes and EXPLAIN commands | `docs/performance/INDEXES.md` |
| Deploy guide, migrations list | `docs/deployment/PRODUCTION_DEPLOY.md` |
| Local setup, tests, seeding | `docs/onboarding/GETTING_STARTED.md` |
| Phase 2/3 deliverable and revamp notes | `docs/deliverables/PHASE_2_3_COMPLETION_DELIVERABLE.md` |
