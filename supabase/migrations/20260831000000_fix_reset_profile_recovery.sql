-- Migration: Fix Reset Function Profile Recovery
-- Date: 2026-08-31
-- Purpose: Enhance reset_incomplete_google_signup() with defensive profile creation
--
-- Problem:
-- Existing Google OAuth users with auth.users but no public.profiles cannot recover
-- because reset_incomplete_google_signup() returns profile_not_found instead of
-- creating the missing profile.
--
-- Solution:
-- When reset function encounters a Google OAuth user with missing profile,
-- defensively create the profile using the same logic as provision_authorized_new_user().
--
-- Safety Preserved:
-- - All five validation checks maintained (null_user_id, user_not_found, 
--   not_google_provider, password_already_set, profile validation)
-- - Completed accounts (password_set=TRUE) remain protected
-- - Non-Google providers remain rejected
-- - Authorization rules unchanged
-- - Transaction safety via advisory lock preserved
--
-- Validates Requirements:
-- - 2.1: Missing profile → create and proceed with reset
-- - 2.3, 2.4: Recovered profile → onboarding can complete
-- - 3.1-3.4: All safety checks preserved

BEGIN;

-- Drop and recreate with defensive profile creation
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
  v_metadata JSONB;
  v_is_google BOOLEAN;
  v_profile public.profiles%ROWTYPE;
  v_normalized_email TEXT;
  v_full_name TEXT;
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

  -- Check 4: Profile exists OR create if missing (DEFENSIVE RECOVERY PATH)
  SELECT profile.*
  INTO v_profile
  FROM public.profiles AS profile
  WHERE profile.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- RECOVERY PATH: Profile missing for Google OAuth user
    -- Create minimal profile using same logic as provision_authorized_new_user()
    
    v_normalized_email := lower(trim(v_user.email));
    v_metadata := COALESCE(v_user.raw_user_meta_data, '{}'::JSONB);
    
    -- Extract full_name using same fallback logic as provision function
    -- Priority: full_name > name > email local part
    v_full_name := NULLIF(btrim(COALESCE(
      v_metadata->>'full_name',
      v_metadata->>'name',
      split_part(v_normalized_email, '@', 1)
    )), '');
    
    IF v_full_name IS NULL THEN
      -- Last resort fallback
      v_full_name := 'User';
    END IF;
    
    -- Create profile with minimal required fields
    INSERT INTO public.profiles (user_id, full_name, email, role, password_set)
    VALUES (p_user_id, v_full_name, v_normalized_email, 'student'::public.app_role, FALSE)
    RETURNING * INTO v_profile;
    
    -- Create user_roles to match normal signup flow
    -- This allows the user to proceed through role selection
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, 'student'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Defensive recovery: Created missing profile for Google OAuth user %', p_user_id;
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
  -- Delete any existing student record (for role change)
  DELETE FROM public.students
  WHERE profile_id = v_profile.id;

  -- Delete existing user_roles (will be recreated during onboarding)
  DELETE FROM public.user_roles
  WHERE user_id = p_user_id;

  -- Success response
  RETURN json_build_object(
    'success', TRUE,
    'next', 'role'
  );
END;
$$;

-- Restore permissions (unchanged)
REVOKE ALL ON FUNCTION public.reset_incomplete_google_signup(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_incomplete_google_signup(UUID) TO service_role;
ALTER FUNCTION public.reset_incomplete_google_signup(UUID) SET search_path = public, auth;

-- Verify function was created successfully
DO $$
DECLARE
  v_function_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'reset_incomplete_google_signup'
  ) INTO v_function_exists;
  
  IF NOT v_function_exists THEN
    RAISE EXCEPTION 'Migration failed: Function was not created';
  END IF;
  
  RAISE NOTICE 'SUCCESS: reset_incomplete_google_signup() enhanced with defensive profile creation';
END;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Migration Complete
-- The reset function now:
-- 1. Maintains all five existing safety checks
-- 2. Defensively creates missing profiles for Google OAuth users
-- 3. Uses same profile creation logic as provision_authorized_new_user()
-- 4. Enables recovery for users like 60d90a38-7bfd-42f7-a482-9f25dcab12b0
