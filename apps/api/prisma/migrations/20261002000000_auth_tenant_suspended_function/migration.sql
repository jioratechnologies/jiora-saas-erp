-- ZitadelAuthGuard needs to reject users of suspended tenants. A separate
-- function (rather than widening auth_lookup_by_subject's return type) keeps
-- claim_invite(), which does RETURN QUERY SELECT * FROM auth_lookup_by_subject,
-- unchanged. SECURITY DEFINER for the same RLS reasons as that function.
CREATE OR REPLACE FUNCTION auth_tenant_suspended(p_tenant_id text)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id AND suspended_at IS NOT NULL);
$$;

REVOKE ALL ON FUNCTION auth_tenant_suspended(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_tenant_suspended(text) TO app_runtime;
