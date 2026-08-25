-- Add diagnostic reason field to reset_incomplete_google_signup function
--
-- This migration enhances the reset function with diagnostic reasons to help
-- troubleshoot production issues where Google OAuth accounts are rejected
-- during incomplete signup retry attempts.
--
-- Changes:
-- - Each rejection response now includes a 'reason' field with a diagnostic code
-- - Business logic remains UNCHANGED (same 5 rejection conditions)
-- - No sensitive data is exposed (passwords, tokens, etc.)
--
-- Reason codes:
-- - null_user_id: The provided user ID was null
-- - user_not_found: User does not exist in auth.users
-- - not_google_provider: Account is not authenticated via Google OAuth
-- - profile_not_found: Profile does not exist in public.profiles
-- - password_already_set: Account has password_set=true (completed account protection)

BEGIN;

-- Drop and recreate the function with diagnostic reasons
DROP FUNCTION IF EXISTS public.reset_incomplete_google_signup(UUID);

CREATE OR REPLACE FUNCTION public.reset_incomplete_google_signup(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user auth.users%ROWTYPE;
  v_app_metadata JSONB;
  v_is_google BOOLEAN;
  v_profile public.profiles%ROWTYPE;
BEGIN
  -- Check 1: Null user ID
  IF p_user_id IS NULL THEN
    RETURN json_build_object(
      'success', FALSE,
      'status', 'rejected',
      'reason', 'null_user_id'
    );
  END IF;

  -- Check 2: User exists in auth.users
  SELECT auth_user.*
  INTO v_user
  FROM auth.users AS auth_user
  WHERE auth_user.id = p_user_id
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', FALSE,
      'status', 'rejected',
      'reason', 'user_not_found'
    );
  END IF;

  -- Check 3: Google provider validation
  v_app_metadata := COALESCE(v_user.raw_app_meta_data, '{}'::JSONB);
  
  -- Check if this is a Google-authenticated account
  -- Supabase may store provider info in different formats depending on OAuth flow:
  -- - provider field may be 'google'
  -- - providers array may contain 'google'
  -- We check both conditions with OR to be robust across different Supabase versions
  v_is_google := (
    v_app_metadata->>'provider' = 'google'
    OR COALESCE((v_app_metadata->'providers') ? 'google', FALSE)
  );

  IF NOT v_is_google THEN
    RETURN json_build_object(
      'success', FALSE,
      'status', 'rejected',
      'reason', 'not_google_provider'
    );
  END IF;

  -- Acquire advisory lock for this onboarding session
  PERFORM pg_advisory_xact_lock(hashtext('onboarding:' || p_user_id::TEXT));

  -- Check 4: Profile exists
  SELECT profile.*
  INTO v_profile
  FROM public.profiles AS profile
  WHERE profile.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', FALSE,
      'status', 'rejected',
      'reason', 'profile_not_found'
    );
  END IF;

  -- Check 5: Password not already set (completed account protection)
  -- Never reset an account that already has a password: that is either a
  -- completed account or a different in-progress state entirely, and this
  -- function must only ever affect an abandoned, password-less Google
  -- signup that already picked a role.
  IF COALESCE(v_profile.password_set, FALSE) THEN
    RETURN json_build_object(
      'success', FALSE,
      'status', 'rejected',
      'reason', 'password_already_set'
    );
  END IF;

  -- All checks passed: clear onboarding data
  DELETE FROM public.students
  WHERE profile_id = v_profile.id;

  DELETE FROM public.user_roles
  WHERE user_id = p_user_id;

  -- Success response
  RETURN json_build_object(
    'success', TRUE,
    'next', 'role'
  );
END;
$$;

-- Restore permissions
REVOKE ALL ON FUNCTION public.reset_incomplete_google_signup(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_incomplete_google_signup(UUID) TO service_role;
ALTER FUNCTION public.reset_incomplete_google_signup(UUID) SET search_path = public, auth;

NOTIFY pgrst, 'reload schema';

COMMIT;
