-- Product requirement: a new "Continue with Google" SIGNUP click on an
-- abandoned Google signup that already selected a role but never set a
-- password must restart role selection, not resume password setup.
--
-- This is implemented by a new, narrowly-guarded RPC,
-- public.reset_incomplete_google_signup(p_user_id), which clears only the
-- role assignment (the matching public.user_roles row) and any dependent
-- public.students row for that profile. It never touches the public.profiles
-- row itself and never touches the underlying auth.users identity. It also
-- refuses to act on any account that already has password_set = true, and
-- refuses to act on any identity that is not Google-authenticated, so it can
-- only ever affect an incomplete Google signup -- never a completed account
-- and never an account created via email/password.
--
-- No existing function, table, index, trigger, or RLS policy is modified.
-- This migration is purely additive.

BEGIN;

-- Clears an abandoned Google signup's role selection so it can be chosen
-- again from the beginning of the signup flow. This function intentionally
-- never touches the profiles row or the underlying auth identity, and it
-- refuses to act on any account that has already completed password setup
-- (password_set = true) or that is not a Google-authenticated identity, so
-- it can only ever affect an incomplete Google signup, never a completed or
-- email-created account.
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
  v_is_google := v_app_metadata->>'provider' = 'google'
    AND COALESCE((v_app_metadata->'providers') ? 'google', FALSE);

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
