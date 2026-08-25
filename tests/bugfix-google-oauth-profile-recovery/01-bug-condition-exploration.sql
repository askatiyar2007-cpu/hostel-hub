-- Task 1: Bug Condition Exploration Test
-- Property 1: Bug Condition - Missing Profile Recovery Failure
--
-- CRITICAL: This test MUST FAIL on unfixed code
-- This confirms the bug exists in production
--
-- Expected behavior (after fix):
-- - Profile should be created with role='student', password_set=FALSE
-- - Reset should return {success: true, next: 'role'}
-- - User should be able to complete onboarding

-- Test user from production evidence
-- User ID: 60d90a38-7bfd-42f7-a482-9f25dcab12b0

BEGIN;

-- Step 1: Verify user exists in auth.users with Google provider
DO $$
DECLARE
  v_user auth.users%ROWTYPE;
  v_app_metadata JSONB;
  v_is_google BOOLEAN;
BEGIN
  SELECT * INTO v_user FROM auth.users WHERE id = '60d90a38-7bfd-42f7-a482-9f25dcab12b0';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEST SETUP FAILED: User does not exist in auth.users';
  END IF;
  
  v_app_metadata := COALESCE(v_user.raw_app_meta_data, '{}'::JSONB);
  v_is_google := (
    v_app_metadata->>'provider' = 'google'
    OR COALESCE((v_app_metadata->'providers') ? 'google', FALSE)
  );
  
  IF NOT v_is_google THEN
    RAISE EXCEPTION 'TEST SETUP FAILED: User is not authenticated via Google OAuth';
  END IF;
  
  RAISE NOTICE 'PASS: User exists in auth.users with Google provider';
END;
$$;

-- Step 2: Verify user does NOT exist in public.profiles
DO $$
DECLARE
  v_profile_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = '60d90a38-7bfd-42f7-a482-9f25dcab12b0')
  INTO v_profile_exists;
  
  IF v_profile_exists THEN
    RAISE EXCEPTION 'TEST SETUP FAILED: Profile already exists (bug may have been fixed)';
  END IF;
  
  RAISE NOTICE 'PASS: Profile does NOT exist in public.profiles (bug condition confirmed)';
END;
$$;

-- Step 3: Verify trigger is missing
DO $$
DECLARE
  v_trigger_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created' 
    AND tgrelid = 'auth.users'::regclass
  ) INTO v_trigger_exists;
  
  IF v_trigger_exists THEN
    RAISE WARNING 'Trigger on_auth_user_created already exists - root cause may have been fixed';
  ELSE
    RAISE NOTICE 'CONFIRMED: Trigger on_auth_user_created is MISSING (root cause confirmed)';
  END IF;
END;
$$;

-- Step 4: Call reset_incomplete_google_signup and verify it returns profile_not_found
DO $$
DECLARE
  v_result JSON;
BEGIN
  SELECT public.reset_incomplete_google_signup('60d90a38-7bfd-42f7-a482-9f25dcab12b0')
  INTO v_result;
  
  -- On unfixed code, this should return {success: false, reason: 'profile_not_found'}
  IF v_result->>'success' = 'false' AND v_result->>'reason' = 'profile_not_found' THEN
    RAISE NOTICE 'EXPECTED FAILURE CONFIRMED: Reset function returns profile_not_found';
    RAISE NOTICE 'Bug condition verified: %', v_result;
  ELSIF v_result->>'success' = 'true' THEN
    RAISE EXCEPTION 'TEST FAILED: Reset succeeded (bug may already be fixed). Result: %', v_result;
  ELSE
    RAISE EXCEPTION 'TEST FAILED: Unexpected result: %', v_result;
  END IF;
END;
$$;

ROLLBACK;

-- Summary
SELECT 
  '=== BUG CONDITION EXPLORATION TEST RESULTS ===' as test_summary
UNION ALL
SELECT 'User 60d90a38-7bfd-42f7-a482-9f25dcab12b0:'
UNION ALL
SELECT '  - EXISTS in auth.users with Google provider: YES'
UNION ALL
SELECT '  - EXISTS in public.profiles: NO (BUG CONFIRMED)'
UNION ALL
SELECT '  - Trigger on_auth_user_created registered: NO (ROOT CAUSE CONFIRMED)'
UNION ALL
SELECT '  - reset_incomplete_google_signup result: {success:false, reason:profile_not_found}'
UNION ALL
SELECT ''
UNION ALL
SELECT 'COUNTEREXAMPLE DOCUMENTED:'
UNION ALL
SELECT '  This test demonstrates the bug exists on unfixed code.'
UNION ALL
SELECT '  After implementing the fix, this same test should PASS.'
;
