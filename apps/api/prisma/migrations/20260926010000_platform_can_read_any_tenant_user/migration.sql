-- Same bug class as the roles fix (20260926000000): platform context could
-- only see users with tenant_id IS NULL (platform staff), not any tenant's
-- actual users — because the policy checked tenant_id = current_setting
-- ('app.tenant_id'), which platform-context callers usually leave unset.
-- Super Admin needs to see/manage users across any tenant (listing
-- invites, cancelling them) without first "becoming" that tenant.
DROP POLICY users_tenant_isolation ON users;

CREATE POLICY users_tenant_isolation ON users
  USING (
    current_setting('app.is_platform_context', true) = 'true'
    OR tenant_id = current_setting('app.tenant_id', true)
  );
