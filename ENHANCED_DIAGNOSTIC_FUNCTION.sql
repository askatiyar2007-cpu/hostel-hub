-- ============================================================================
-- ENHANCED DIAGNOSTIC VERSION OF reset_incomplete_google_signup()
-- ============================================================================
--
-- ⚠️  DO NOT APPLY THIS YET - Reference Only
--
-- This enhanced version returns detailed rejection reasons to help diagnose
-- why the function is rejecting reset attempts.
--
-- Use this ONLY if:
-- 1. The OR-logic migration is confirmed applied
-- 2. Users still report failures
-- 3. You need more detailed rejection reasons in server logs
--
-- ============================================================================

-- Drop and recreate with enhanced diagnostics
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
  v_provider_field TEXT;
  v_providers_array JSONB;
  v_has_provider_field BOOLEAN;
  v_has_providers_array BOOLEAN;
BEGIN
  -- Check 1: NULL user_id
  IF p_user_id IS NULL THEN
    RETURN json_build_object(
      'success', FALSE, 
      'status', 'rejected',
      'reason', 'null_user_id',
      'message', 'User ID parameter is null'
    );
  END IF;

  -- Check 2: User exists
  SELECT auth_user.*
  INTO v_user
  FROM auth.users AS auth_user
  WHERE auth_user.id = p_user_id
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', FALSE, 
      'status', 'rejected',
      'reason', 'user_not_found',
      'message', 'User not found in auth.users'
    );
  END IF;

  -- Extract metadata and provider information for diagnostics
  v_app_metadata := COALESCE(v_user.raw_app_meta_data, '{}'::JSONB);
  v_provider_field := v_app_metadata->>'provider';
  v_providers_array := v_app_metadata->'providers';
  v_has_provider_field := (v_provider_field = 'google');
  v_has_providers_array := COALESCE((v_app_metadata->'providers') ? 'google', FALSE);
  
  -- Check 3: Google authentication
  v_is_google := (v_has_provider_field OR v_has_providers_array);

  IF NOT v_is_google THEN
    RETURN json_build_object(
      'success', FALSE, 
      'status', 'rejected',
      'reason', 'not_google',
      'message', 'Account is not authenticated via Google OAuth',
      'diagnostics', json_build_object(
        'provider_field', v_provider_field,
        'providers_array', v_providers_array,
        'has_provider_google', v_has_provider_field,
        'has_providers_google', v_has_providers_array,
        'raw_metadata', v_app_metadata
      )
    );
  END IF;

  -- Acquire advisory lock
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
      'reason', 'profile_not_found',
      'message', 'Profile not found in public.profiles'
    );
  END IF;

  -- Check 5: Safety check - never reset completed accounts
  IF COALESCE(v_profile.password_set, FALSE) THEN
    RETURN json_build_object(
      'success', FALSE, 
      'status', 'rejected',
      'reason', 'password_set',
      'message', 'Account has password_set=true, refusing to reset (safety protection)',
      'diagnostics', json_build_object(
        'password_set', v_profile.password_set,
        'is_complete', v_profile.is_complete
      )
    );
  END IF;

  -- All checks passed, perform reset
  DELETE FROM public.students
  WHERE profile_id = v_profile.id;

  DELETE FROM public.user_roles
  WHERE user_id = p_user_id;

  RETURN json_build_object(
    'success', TRUE, 
    'next', 'role',
    'message', 'Successfully reset incomplete Google signup',
    'diagnostics', json_build_object(
      'provider_field', v_provider_field,
      'providers_array', v_providers_array,
      'students_deleted', TRUE,
      'user_roles_deleted', TRUE
    )
  );
END;
$$;

-- Set permissions (same as original)
REVOKE ALL ON FUNCTION public.reset_incomplete_google_signup(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_incomplete_google_signup(UUID) TO service_role;
ALTER FUNCTION public.reset_incomplete_google_signup(UUID) SET search_path = public, auth;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- ENHANCED RETURN VALUES
-- ============================================================================

/*

SUCCESS CASE:
{
  "success": true,
  "next": "role",
  "message": "Successfully reset incomplete Google signup",
  "diagnostics": {
    "provider_field": "google",
    "providers_array": ["google"],
    "students_deleted": true,
    "user_roles_deleted": true
  }
}


REJECTION CASES:

1. NULL User ID:
{
  "success": false,
  "status": "rejected",
  "reason": "null_user_id",
  "message": "User ID parameter is null"
}

2. User Not Found:
{
  "success": false,
  "status": "rejected",
  "reason": "user_not_found",
  "message": "User not found in auth.users"
}

3. Not Google OAuth:
{
  "success": false,
  "status": "rejected",
  "reason": "not_google",
  "message": "Account is not authenticated via Google OAuth",
  "diagnostics": {
    "provider_field": null,               // or "email", "password", etc.
    "providers_array": null,              // or ["email"], etc.
    "has_provider_google": false,
    "has_providers_google": false,
    "raw_metadata": { ... }               // Full metadata for debugging
  }
}

4. Profile Not Found:
{
  "success": false,
  "status": "rejected",
  "reason": "profile_not_found",
  "message": "Profile not found in public.profiles"
}

5. Password Already Set (Safety):
{
  "success": false,
  "status": "rejected",
  "reason": "password_set",
  "message": "Account has password_set=true, refusing to reset (safety protection)",
  "diagnostics": {
    "password_set": true,
    "is_complete": true
  }
}

*/


-- ============================================================================
-- UPDATED CALLBACK ROUTE HANDLING
-- ============================================================================

/*

In app/auth/callback/route.ts, update the error handling to use the new reasons:

```typescript
const { data: resetData, error: resetError } = await supabaseServer
  .rpc('reset_incomplete_google_signup', { p_user_id: accountState.user_id });

if (resetError || !resetData?.success) {
  console.error('[OAuth Callback] Reset failed:', {
    error: resetError,
    reason: resetData?.reason,
    message: resetData?.message,
    diagnostics: resetData?.diagnostics
  });
  
  // Handle specific rejection reasons
  if (resetData?.reason === 'not_google') {
    console.error('[OAuth Callback] Provider mismatch - user may have switched auth methods');
    console.error('[OAuth Callback] Provider diagnostics:', resetData.diagnostics);
  } else if (resetData?.reason === 'password_set') {
    console.error('[OAuth Callback] Attempted to reset completed account - this is a safety rejection');
  }
  
  // Clear session and redirect with appropriate error
  await sessionClient.auth.signOut();
  return redirect(request, '/auth/login?error=signup-retry-failed');
}

console.log('[OAuth Callback] Reset successful:', resetData.message);
if (resetData.diagnostics) {
  console.log('[OAuth Callback] Reset diagnostics:', resetData.diagnostics);
}
```

*/


-- ============================================================================
-- TESTING THE ENHANCED FUNCTION
-- ============================================================================

/*

You can test this function manually in Supabase SQL Editor:

-- Test with a real user ID (replace with actual UUID)
SELECT reset_incomplete_google_signup('00000000-0000-0000-0000-000000000000');

-- Test with NULL (should return null_user_id reason)
SELECT reset_incomplete_google_signup(NULL);


-- To manually inspect a user's metadata:
SELECT 
  id,
  email,
  raw_app_meta_data->>'provider' AS provider_field,
  raw_app_meta_data->'providers' AS providers_array,
  raw_app_meta_data
FROM auth.users
WHERE email = 'user@example.com';

*/


-- ============================================================================
-- WHEN TO APPLY THIS
-- ============================================================================

/*

Apply this enhanced version if:

1. ✓ The OR-logic migration (20260828000000) is confirmed applied
2. ✓ Users STILL report reset failures
3. ✓ The basic diagnostic logging in route.ts is not enough
4. ✓ You need structured rejection reasons from the database function itself

Before applying:
- Backup your current function (Query 2 from VERIFY_MIGRATION_QUERIES.sql)
- Test in staging/development first if possible
- Update route.ts to handle the new response structure

*/
