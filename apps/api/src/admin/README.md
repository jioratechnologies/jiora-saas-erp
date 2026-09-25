# admin/

The tenant Admin panel — everything a tenant's `admin` (or a custom role with the right
permissions) can manage: org profile/theme (`org.controller.ts`), departments, designations, the
Role Builder (`roles.controller.ts`, wraps `RbacService`), and user invites
(`users.controller.ts`).

This is "Phase 1 — Foundation & Admin" from `docs/architecture/ARCHITECTURE.md`. HR Core
(employee/volunteer master, attendance, leave) is Phase 2 and lives in its own module once built
— it is **not** part of this one, even though it'll sit right next to it in the nav.

Every service method takes a `tenantId` explicitly and calls
`PrismaService.runInTenantContext(...)` — see `src/prisma/README.md`.
