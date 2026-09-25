-- Bug found provisioning the first real tenant: RbacService.seedTenantOwnerRole
-- runs in platform context (tenantId: null, isPlatformContext: true — see
-- TenantsService.create) but writes a role row scoped to the *new* tenant's
-- real id, not NULL. The original roles_tenant_isolation policy only let
-- platform context touch tenant_id IS NULL rows (platform roles), so that
-- INSERT was rejected by RLS: "new row violates row-level security policy".
--
-- Fix: platform context can act on any tenant's roles (it legitimately
-- needs to, for provisioning), same pattern already used for `tenants`
-- (see tenants_platform_or_own in the enable_row_level_security migration).
-- Tenant context is unaffected — still restricted to its own tenant_id only.
DROP POLICY roles_tenant_isolation ON roles;

CREATE POLICY roles_tenant_isolation ON roles
  USING (
    current_setting('app.is_platform_context', true) = 'true'
    OR tenant_id = current_setting('app.tenant_id', true)
  );
