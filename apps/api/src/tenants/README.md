# tenants/

Platform-level tenant management: `TenantsController` (`/platform/tenants/*`) is the Super Admin
panel's backend — list, create, suspend, reinstate. Every route requires a `platform.tenant.*`
permission, which only `super_admin`/`developer`/`maintainer` can hold.

`TenantsService.getOwn()` / `updateTheme()` are also used by `admin/org.controller.ts` — that's
the *tenant's own* view of its one row (its name/branding), not the platform-wide list. Same
service, two different callers with very different permission requirements.
