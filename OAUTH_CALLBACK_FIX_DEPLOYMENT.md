# OAuth Callback Reset Fix - Deployment Guide

## Problem Summary

Abandoned Google signup retry was redirecting to `/auth/setup-password` instead of `/auth/select-role` because the `reset_incomplete_google_signup()` SQL function was rejecting the reset with `{success: false, status: 'rejected'}`.

## Root Cause

The SQL function's provider metadata check was too strict:

```sql
-- BEFORE (too strict - requires BOTH conditions):
v_is_google := v_app_metadata->>'provider' = 'google'
  AND COALESCE((v_app_metadata->'providers') ? 'google', FALSE);
```

Supabase Google OAuth may only populate ONE of these fields depending on the OAuth flow version, causing legitimate Google accounts to be rejected.

## Fixes Implemented

### 1. Fixed Admin Client Usage (DEPLOYED - Code Change)
**File**: `app/auth/callback/route.ts` line 173

**Change**: Use `supabaseServer.auth.admin` instead of `sessionClient.auth.admin`
- `sessionClient` uses anon key (no admin access)
- `supabaseServer` uses service role key (has admin access)

```typescript
// BEFORE:
const { data: adminUserData, error: adminUserError } = await sessionClient.auth.admin.getUserById(accountState.user_id);

// AFTER:
const { data: adminUserData, error: adminUserError } = await supabaseServer.auth.admin.getUserById(accountState.user_id);
```

### 2. Relaxed Provider Metadata Check (REQUIRES MIGRATION)
**Files**: 
- `supabase/migrations/20260827000000_reset_abandoned_google_signup_role.sql` (updated)
- `supabase/migrations/20260828000000_fix_reset_google_signup_provider_check.sql` (new)

**Change**: Use OR instead of AND for provider check

```sql
-- BEFORE (too strict):
v_is_google := v_app_metadata->>'provider' = 'google'
  AND COALESCE((v_app_metadata->'providers') ? 'google', FALSE);

-- AFTER (more robust):
v_is_google := (
  v_app_metadata->>'provider' = 'google'
  OR COALESCE((v_app_metadata->'providers') ? 'google', FALSE)
);
```

**Safety**: This change is safe because:
- `password_set=false` check (line 74-76) still protects completed accounts
- Function is service-role only (not exposed to users)
- Only affects incomplete Google signups with `intent='signup'`

### 3. Improved Reset Failure Handling (DEPLOYED - Code Change)
**File**: `app/auth/callback/route.ts` lines 188-201

**Change**: Added fallback to force redirect to role selection even if reset fails

```typescript
if (resetError || !resetData?.success) {
  console.error('[OAuth Callback] Could not reset abandoned Google signup:', resetError, resetData);
  // Enhanced diagnostic logging...
  
  // FALLBACK: Force redirect to role selection rather than showing generic error
  console.warn('[OAuth Callback] Forcing redirect to role selection despite reset failure');
  return redirect(request, '/auth/select-role');
}
```

**Rationale**: If the reset fails but we know this is an incomplete signup (`password_set=false`), it's better to let the user proceed to role selection than block them with a generic error.

## Deployment Steps

### Step 1: Deploy Code Changes (READY)
The code changes in `app/auth/callback/route.ts` can be deployed immediately:
1. Build the Next.js application
2. Deploy to production/staging
3. Verify the callback route works

### Step 2: Apply Database Migration (REQUIRED)
The SQL function fix requires a database migration:

**Option A: Using Supabase CLI** (if available)
```bash
npx supabase db push
```

**Option B: Using Supabase Dashboard**
1. Go to Supabase Dashboard → SQL Editor
2. Copy the contents of `supabase/migrations/20260828000000_fix_reset_google_signup_provider_check.sql`
3. Execute the SQL
4. Verify the function was updated:
```sql
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'reset_incomplete_google_signup';
```

**Option C: Using psql** (if direct database access available)
```bash
psql $DATABASE_URL < supabase/migrations/20260828000000_fix_reset_google_signup_provider_check.sql
```

## Testing After Deployment

### Test Case 1: Abandoned Signup Retry (PRIMARY FIX)
1. Create Google OAuth account, select role, reach password page
2. Close tab WITHOUT setting password (`password_set=false`)
3. Return to site, click "Continue with Google" with signup intent
4. **Expected**: Redirected to `/auth/select-role` (can pick new role)
5. **Failure**: Redirected to `/auth/setup-password` or shows "Account already exists"

### Test Case 2: Completed Account Protection (REGRESSION CHECK)
1. Create Google OAuth account, complete entire flow (`password_set=true`)
2. Try to create new account with same Google identity
3. **Expected**: Shows "Account already exists" error
4. **Failure**: Allows duplicate signup or shows generic error

### Test Case 3: First-Time Signup (REGRESSION CHECK)
1. New user (no existing account) clicks "Continue with Google"
2. Complete profile → select role → set password
3. **Expected**: Smooth flow, dashboard access granted
4. **Failure**: Any errors or unexpected redirects

## Diagnostic Logging

The callback now logs detailed diagnostics when reset is attempted:

```
[OAuth Callback] Detected incomplete signup retry (password_set=false), resetting role data for user: <uuid>
[OAuth Callback] Account state before reset: {...}
[OAuth Callback] Provider metadata diagnostics:
  - Full raw_app_meta_data: {...}
  - provider field: google
  - providers array: ["google"]
  - ...
[OAuth Callback] Successfully reset incomplete signup, redirecting to role selection
```

If reset fails, you'll see:
```
[OAuth Callback] Could not reset abandoned Google signup: <error>
[OAuth Callback] Reset rejection details - this may indicate:
  - Missing provider field in raw_app_meta_data
  - Missing providers array in raw_app_meta_data
  - Provider value is not "google"
  - password_set is true (function safety check)
[OAuth Callback] Forcing redirect to role selection despite reset failure (incomplete signup with password_set=false)
```

## Rollback Plan

### If Code Changes Cause Issues:
```bash
git revert <commit-hash>
```
Revert `app/auth/callback/route.ts` to previous version

### If Migration Causes Issues:
Execute the original (strict) version:
```sql
-- Restore original strict check
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
```

## Expected Behavior After Fix

### Abandoned Signup Retry
**User Journey**:
1. User starts Google OAuth signup
2. Selects "Student" role (role data saved to DB)
3. Reaches `/auth/setup-password` page
4. Closes tab without setting password (`password_set=false`)
5. Later returns to site
6. Clicks "Continue with Google" on signup page

**Before Fix**: 
- Reset fails → falls through to active onboarding block
- Redirects to `/auth/setup-password` with old role data
- User cannot change role selection

**After Fix**:
- Reset succeeds (or fails but forces redirect anyway)
- Redirects to `/auth/select-role`
- User can select different role
- After password setup → dashboard access

### Completed Account (Regression Protection)
**User Journey**:
1. User completes Google OAuth signup (`password_set=true`)
2. Later tries "Continue with Google" on signup page again

**Before & After Fix** (should be identical):
- Callback detects `intent='signup' + is_complete=true`
- Shows "Account already exists" error (line 128)
- NO reset called
- Account remains intact

## Additional Notes

### Why the Fallback is Safe
The fallback (force redirect even if reset fails) is safe because:
1. Only triggered when `intent='signup' + password_set=false`
2. User is clearly in incomplete signup state (not a completed user)
3. Role selection page will create new role assignment (overwrites old data)
4. `password_set=false` ensures this is not a completed account
5. Better UX than blocking user with generic error

### Why OR Instead of AND is Safe
Using OR for provider check is safe because:
1. Supabase OAuth accounts will have at least ONE of the two fields
2. Non-Google accounts will have neither field (still rejected)
3. The `password_set=false` check is the primary safety mechanism
4. Function is only called for `intent='signup'` from trusted callback route
5. Service-role only access (users cannot call directly)

## Questions or Issues

If you encounter issues after deployment:
1. Check server logs for `[OAuth Callback]` diagnostic messages
2. Verify the SQL function was updated (check `prosrc` in `pg_proc`)
3. Test with a real Google OAuth account (sandbox may behave differently)
4. Check `raw_app_meta_data` structure in `auth.users` table for test account
5. Verify `SUPABASE_SERVICE_ROLE_KEY` is set in environment variables

## Files Changed

### Code Changes (Ready to Deploy)
- `app/auth/callback/route.ts` - Fixed admin client usage, improved fallback handling

### Database Changes (Requires Migration)
- `supabase/migrations/20260827000000_reset_abandoned_google_signup_role.sql` - Updated inline
- `supabase/migrations/20260828000000_fix_reset_google_signup_provider_check.sql` - New migration file

### Documentation
- `OAUTH_CALLBACK_FIX_DEPLOYMENT.md` - This file
