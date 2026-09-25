# rbac/

The Role Builder's backend logic: `RbacService` creates/edits/deletes tenant-scoped custom roles,
always validated against the fixed permission catalog in `packages/permissions` — a role can
never be granted a permission key that isn't in that catalog, and never a `platform.*` key
(platform permissions are only ever held by the three fixed platform roles, set up outside this
service).

`seedTenantOwnerRole()` is called exactly once, inside the same transaction that creates a new
tenant (`TenantsService.create`) — every tenant has its protected `admin` role from the moment it
exists, granted every non-platform permission in the catalog.
