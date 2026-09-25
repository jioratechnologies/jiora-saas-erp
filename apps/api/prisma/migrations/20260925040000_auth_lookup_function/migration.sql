-- The chicken-and-egg problem RLS creates for login: to find out which
-- tenant a user belongs to, we have to look them up by their Zitadel
-- subject id BEFORE we know their tenant_id — but the `users` RLS policy
-- requires tenant_id to already be set. A SECURITY DEFINER function is the
-- standard, narrow way through this: it runs with the privileges of its
-- owner (table owner "saaserp", who is exempt from RLS) internally, but
-- app_runtime is only ever granted EXECUTE on this one function — it still
-- cannot SELECT the tables directly outside a tenant context.
--
-- Called exactly once per request, by ZitadelAuthGuard, right after JWT
-- verification. See src/auth/zitadel-auth.guard.ts.
CREATE OR REPLACE FUNCTION auth_lookup_by_subject(p_subject text)
RETURNS TABLE (
  user_id text,
  tenant_id text,
  is_platform boolean,
  permission_keys text[]
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT
    u.id,
    u.tenant_id,
    (u.tenant_id IS NULL) AS is_platform,
    COALESCE(
      array_agg(DISTINCT rp.permission_key) FILTER (WHERE rp.permission_key IS NOT NULL),
      '{}'
    )
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN role_permissions rp ON rp.role_id = ur.role_id
  WHERE u.zitadel_subject_id = p_subject
    AND u.deactivated_at IS NULL
  GROUP BY u.id, u.tenant_id;
$$;

REVOKE ALL ON FUNCTION auth_lookup_by_subject(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_by_subject(text) TO app_runtime;
