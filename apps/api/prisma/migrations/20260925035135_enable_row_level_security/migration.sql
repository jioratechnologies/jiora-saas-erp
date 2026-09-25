-- Row-Level Security: the DB-enforced half of tenant isolation.
-- See docs/adr/0001-multi-tenancy-shared-schema-rls.md and
-- docs/adr/0007-pgbouncer-transaction-pooling-and-set-local.md.
--
-- Tenant context is set per-request with `SET LOCAL app.tenant_id = '<uuid>'`
-- inside the same transaction that does the query (see PrismaService.forTenant
-- in src/prisma/prisma.service.ts). SET LOCAL is transaction-scoped, which is
-- required (not just safe) under PgBouncer transaction pooling.
--
-- Platform rows (tenant_id IS NULL on users/roles, for super_admin/developer/
-- maintainer) are only visible when `app.is_platform_context` is set to
-- 'true' for that transaction — set only by requests already authenticated
-- as a platform role.

-- 1) app_runtime is the role the app actually connects as (via PgBouncer).
--    It must NOT own these tables, otherwise RLS would need FORCE ROW LEVEL
--    SECURITY to apply to it at all. Grant it exactly the privileges it needs.
GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  tenants, departments, designations, users, roles, role_permissions, user_roles
  TO app_runtime;

-- 2) Enable RLS on every tenant-scoped table.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 3) Policies.

-- tenants: a platform-context transaction sees every tenant (super admin /
-- developer / maintainer manage all tenants); a tenant-context transaction
-- sees only its own tenant row (e.g. to read its own theme/branding).
-- Note: ids are Prisma `String` (Postgres text), not the native `uuid` type,
-- so app.tenant_id is compared as text throughout — no ::uuid cast.
CREATE POLICY tenants_platform_or_own ON tenants
  USING (
    current_setting('app.is_platform_context', true) = 'true'
    OR id = current_setting('app.tenant_id', true)
  );

-- departments / designations: strictly tenant-scoped, no platform bypass needed.
CREATE POLICY departments_tenant_isolation ON departments
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY designations_tenant_isolation ON designations
  USING (tenant_id = current_setting('app.tenant_id', true));

-- users: tenant users see only their own tenant's users; platform users
-- (tenant_id IS NULL) are visible only in platform context.
CREATE POLICY users_tenant_isolation ON users
  USING (
    (tenant_id = current_setting('app.tenant_id', true))
    OR (tenant_id IS NULL AND current_setting('app.is_platform_context', true) = 'true')
  );

-- roles: same pattern as users — tenant-scoped custom roles, or platform
-- roles (tenant_id IS NULL) visible only in platform context.
CREATE POLICY roles_tenant_isolation ON roles
  USING (
    (tenant_id = current_setting('app.tenant_id', true))
    OR (tenant_id IS NULL AND current_setting('app.is_platform_context', true) = 'true')
  );

-- role_permissions / user_roles have no tenant_id of their own — scope via
-- the parent role/user row, which is itself already RLS-protected above.
CREATE POLICY role_permissions_via_role ON role_permissions
  USING (EXISTS (SELECT 1 FROM roles r WHERE r.id = role_permissions.role_id));

CREATE POLICY user_roles_via_user_and_role ON user_roles
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = user_roles.user_id)
    AND EXISTS (SELECT 1 FROM roles r WHERE r.id = user_roles.role_id)
  );
