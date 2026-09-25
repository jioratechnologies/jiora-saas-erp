-- AlterTable
ALTER TABLE "users" ALTER COLUMN "zitadel_subject_id" DROP NOT NULL;

-- Same SECURITY DEFINER reasoning as auth_lookup_by_subject (see that
-- migration's comment): claiming an invite means finding a user row by
-- email BEFORE we have any tenant context to scope the lookup by. Only
-- matches rows that are still pending (zitadel_subject_id IS NULL), and
-- the email is the one Zitadel just verified via the caller's JWT, not a
-- user-supplied value — the API layer must never let this be called with
-- an arbitrary/unverified email. See UsersService.claimInvite.
CREATE OR REPLACE FUNCTION claim_invite(p_subject text, p_email text)
RETURNS TABLE (
  user_id text,
  tenant_id text,
  is_platform boolean,
  permission_keys text[]
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_match_count int;
BEGIN
  -- One email can have at most one pending invite claimed per call. If the
  -- same email has pending invites in more than one tenant (e.g. a
  -- consultant working with two NGOs), this deliberately claims none —
  -- ambiguous multi-tenant identity linking is out of scope for this pass.
  SELECT count(*) INTO v_match_count
  FROM users
  WHERE zitadel_subject_id IS NULL AND lower(email) = lower(p_email) AND deactivated_at IS NULL;

  IF v_match_count = 1 THEN
    UPDATE users
    SET zitadel_subject_id = p_subject
    WHERE zitadel_subject_id IS NULL AND lower(email) = lower(p_email) AND deactivated_at IS NULL;
  END IF;

  RETURN QUERY SELECT * FROM auth_lookup_by_subject(p_subject);
END;
$$;

REVOKE ALL ON FUNCTION claim_invite(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_invite(text, text) TO app_runtime;
