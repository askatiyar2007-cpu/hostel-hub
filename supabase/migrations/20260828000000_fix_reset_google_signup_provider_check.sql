-- Fix for abandoned Google signup reset function provider metadata check
--
-- The original reset_incomplete_google_signup function had a provider check
-- that was too strict (required BOTH provider='google' AND providers array
-- contains 'google'). This caused legitimate Google OAuth accounts to be
-- rejected if Supabase stores metadata in a slightly different format.
--
-- This migration relaxes the check to accept Google accounts that have EITHER:
-- - provider field set to 'google' OR
-- - providers array containing 'google'
--
-- This is safe because:
-- 1. password_set=false check still protects completed accounts
-- 2. Function is service-role only (not exposed to users)
-- 3. Only affects incomplete Google signups (intent='signup' from callback)

BEGIN;

-- Drop and recreate the function with relaxed provider check
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
  IF p_user_id IS NULL THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  SELECT auth_user.*
  INTO v_user
  FROM auth.users AS auth_user
  WHERE auth_user.id = p_user_id
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

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
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('onboarding:' || p_user_id::TEXT));

  SELECT profile.*
  INTO v_profile
  FROM public.profiles AS profile
  WHERE profile.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  -- Never reset an account that already has a password: that is either a
  -- completed account or a different in-progress state entirely, and this
  -- function must only ever affect an abandoned, password-less Google
  -- signup that already picked a role.
  IF COALESCE(v_profile.password_set, FALSE) THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  DELETE FROM public.students
  WHERE profile_id = v_profile.id;

  DELETE FROM public.user_roles
  WHERE user_id = p_user_id;

  RETURN json_build_object('success', TRUE, 'next', 'role');
END;
$$;

REVOKE ALL ON FUNCTION public.reset_incomplete_google_signup(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_incomplete_google_signup(UUID) TO service_role;
ALTER FUNCTION public.reset_incomplete_google_signup(UUID) SET search_path = public, auth;

NOTIFY pgrst, 'reload schema';

COMMIT;
