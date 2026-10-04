-- Designations become the unit of access control.
--
-- Each designation owns exactly one backing role (roles.designation_id) that
-- holds its permission set. A user's permissions are:
--   protected roles they hold via user_roles (the tenant "admin" owner role)
--   + the role of their designation (persons.designation_id, falling back to
--     users.designation_id for users without a person record)
--   + the code-defined self-service set (SELF_SERVICE_PERMISSION_KEYS in
--     packages/permissions), added by ZitadelAuthGuard.
-- Free-standing custom roles are retired. Their permissions are first copied
-- onto the designations of the people who held them, so nobody loses access.

ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "designation_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "roles_designation_id_key" ON "roles"("designation_id");
DO $$ BEGIN
  ALTER TABLE "roles" ADD CONSTRAINT "roles_designation_id_fkey"
    FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. Permissions each designation's current holders get from custom roles.
CREATE TEMP TABLE designation_access_seed ON COMMIT DROP AS
SELECT DISTINCT
  COALESCE(p.designation_id, u.designation_id) AS designation_id,
  rp.permission_key
FROM users u
LEFT JOIN persons p ON p.user_id = u.id
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id AND r.is_protected = false AND r.designation_id IS NULL
JOIN role_permissions rp ON rp.role_id = r.id
WHERE COALESCE(p.designation_id, u.designation_id) IS NOT NULL;

-- 2. Designations nobody holds a custom role for start from that tenant's
--    "Employee" role, if one exists.
INSERT INTO designation_access_seed (designation_id, permission_key)
SELECT d.id, rp.permission_key
FROM designations d
JOIN roles r ON r.tenant_id = d.tenant_id AND r.name = 'Employee' AND r.is_protected = false AND r.designation_id IS NULL
JOIN role_permissions rp ON rp.role_id = r.id
WHERE NOT EXISTS (SELECT 1 FROM designation_access_seed s WHERE s.designation_id = d.id);

-- Users who hold a custom role but have no designation fall back to the
-- self-service set (agreed behaviour for users without a designation).
-- List them in the migration log so HR can assign a designation.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT u.email, ro.name AS role_name
    FROM users u
    LEFT JOIN persons p ON p.user_id = u.id
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles ro ON ro.id = ur.role_id AND ro.is_protected = false AND ro.designation_id IS NULL
    WHERE COALESCE(p.designation_id, u.designation_id) IS NULL
  LOOP
    RAISE NOTICE 'No designation: % loses custom role "%" and keeps self-service access only', r.email, r.role_name;
  END LOOP;
END $$;

-- 3. Retire free-standing custom roles (cascades their user_roles and role_permissions).
DELETE FROM "roles" WHERE is_protected = false AND designation_id IS NULL AND tenant_id IS NOT NULL;

-- 4. One backing role per designation.
INSERT INTO "roles" ("id", "tenant_id", "name", "is_protected", "designation_id", "created_at")
SELECT
  gen_random_uuid()::text,
  d.tenant_id,
  CASE WHEN EXISTS (SELECT 1 FROM roles r WHERE r.tenant_id = d.tenant_id AND r.name = d.name)
       THEN d.name || ' (designation)' ELSE d.name END,
  false,
  d.id,
  CURRENT_TIMESTAMP
FROM designations d
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.designation_id = d.id);

INSERT INTO "role_permissions" ("role_id", "permission_key")
SELECT DISTINCT r.id, s.permission_key
FROM designation_access_seed s
JOIN roles r ON r.designation_id = s.designation_id
ON CONFLICT DO NOTHING;

-- 5. Permission lookup now includes the designation's role.
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
      array_agg(DISTINCT k.permission_key) FILTER (WHERE k.permission_key IS NOT NULL),
      '{}'
    )
  FROM users u
  LEFT JOIN persons p ON p.user_id = u.id
  LEFT JOIN LATERAL (
    SELECT rp.permission_key
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    WHERE ur.user_id = u.id
    UNION
    SELECT rp.permission_key
    FROM roles r
    JOIN role_permissions rp ON rp.role_id = r.id
    WHERE r.designation_id = COALESCE(p.designation_id, u.designation_id)
  ) k ON true
  WHERE u.zitadel_subject_id = p_subject
    AND u.deactivated_at IS NULL
  GROUP BY u.id, u.tenant_id;
$$;

REVOKE ALL ON FUNCTION auth_lookup_by_subject(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_by_subject(text) TO app_runtime;
