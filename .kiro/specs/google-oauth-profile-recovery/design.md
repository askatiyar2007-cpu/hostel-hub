# Google OAuth Profile Recovery Bugfix Design

## Overview

This bugfix implements a two-part solution to recover Google OAuth accounts with missing profile records. The root cause is a missing `on_auth_user_created` trigger in production that should automatically create profile records during signup. The fix involves (1) re-registering the missing trigger to prevent future cases, and (2) enhancing the existing `reset_incomplete_google_signup()` function to defensively create missing profiles during recovery attempts. This approach is minimal, targeted, and preserves all existing safety mechanisms while enabling account recovery for affected users.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when a Google OAuth user has an `auth.users` record but no corresponding `public.profiles` record
- **Property (P)**: The desired behavior when the bug condition is detected - the reset function should create the missing profile and allow recovery to proceed
- **Preservation**: All existing safety checks (password_set protection, Google provider validation, authorization rules) must remain unchanged
- **reset_incomplete_google_signup()**: The function in `supabase/migrations/20260829000000_add_reset_diagnostic_reasons.sql` that attempts to reset abandoned Google signups by clearing role assignments
- **provision_authorized_new_user()**: The trigger function in `supabase/migrations/20260817000000_production_signup_otp.sql` that automatically creates profile and role records after successful OAuth authentication
- **on_auth_user_created**: The database trigger that invokes `provision_authorized_new_user()` after INSERT on `auth.users` - currently missing in production
- **profile_not_found**: The diagnostic reason code returned when reset function encounters a user with no profile record

## Bug Details

### Bug Condition

The bug manifests when a Google OAuth user attempts to recover their incomplete signup but lacks a profile record. The `reset_incomplete_google_signup()` function is correctly identifying the missing profile but cannot proceed with recovery because it assumes the profile always exists for Google OAuth users. The underlying cause is a missing database trigger in production.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { user_id: UUID }
  OUTPUT: boolean
  
  RETURN userExistsInAuthUsers(input.user_id)
         AND isGoogleProvider(input.user_id)
         AND NOT profileExistsInPublicProfiles(input.user_id)
         AND passwordNotSet(input.user_id)
END FUNCTION
```

### Examples

- **Example 1**: User `60d90a38-7bfd-42f7-a482-9f25dcab12b0` authenticated via Google OAuth, has `auth.users` record with Google provider metadata, but no `public.profiles` or `public.user_roles` records. Reset function returns `{success:false, reason:'profile_not_found'}`. **Expected**: Reset function should create minimal profile record and proceed with recovery.

- **Example 2**: New Google OAuth user signs up while `on_auth_user_created` trigger is missing. Auth callback succeeds and creates `auth.users`, but no profile is created. User is redirected to `/auth/select-role` where all onboarding APIs fail. **Expected**: Trigger should exist and automatically create profile during OAuth callback.

- **Example 3**: User with existing profile and `password_set=TRUE` attempts reset. Reset function returns `{success:false, reason:'password_already_set'}`. **Expected**: This behavior should remain unchanged (completed account protection).

- **Edge Case**: User with non-Google provider (email/password) and missing profile attempts reset. Reset function returns `{success:false, reason:'not_google_provider'}`. **Expected**: This rejection should remain unchanged (function only handles Google OAuth accounts).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Users with `password_set=TRUE` must continue to be rejected with `password_already_set` reason (completed accounts are never reset)
- Users without Google provider credentials must continue to be rejected with `not_google_provider` reason
- All authorization checks and security validations must remain exactly as implemented
- Normal Google OAuth signup flow (when trigger is present) must continue to work identically
- All other reset function logic (advisory locks, transaction safety, role cleanup) must remain unchanged

**Scope:**
All inputs that do NOT involve Google OAuth users with missing profiles should be completely unaffected by this fix. This includes:
- Completed accounts (password_set=TRUE)
- Email/password accounts
- Google OAuth users with existing profiles
- Normal signup flows when trigger is properly registered

## Hypothesized Root Cause

Based on the investigation findings, the root causes are:

1. **Missing Database Trigger in Production**: The `on_auth_user_created` trigger is not registered in the production database, despite the trigger creation statement existing in migration `20260817000000_production_signup_otp.sql`. This causes Google OAuth signups to skip the automatic profile creation step.

2. **Incomplete Reset Function Logic**: The `reset_incomplete_google_signup()` function assumes profiles always exist for Google OAuth users and returns `profile_not_found` error instead of defensively creating the missing profile. This was a reasonable assumption when the trigger was working correctly, but becomes a failure point when profiles are missing.

3. **No Recovery Path in Onboarding Flow**: The entire onboarding flow requires a profile to exist before any operations can proceed. The `complete_onboarding_role()` function calls `get_account_state()` which requires a profile, and all subsequent operations use `FOR UPDATE` locks that fail on non-existent rows.

4. **Silent Trigger Deployment Failure**: The migration file contains the trigger creation statement, but it was not successfully applied to production (possibly skipped, failed silently, or rolled back due to an unrelated error in the migration batch).

## Correctness Properties

Property 1: Bug Condition - Profile Creation During Reset

_For any_ Google OAuth user where the bug condition holds (auth.users exists with Google provider, but public.profiles does not exist, and password is not set), the fixed reset_incomplete_google_signup function SHALL create a minimal profile record with data sourced from auth.users metadata (full_name, email) and default values (role='student', password_set=FALSE), then proceed with the normal reset flow to enable account recovery.

**Validates: Requirements 2.1, 2.3, 2.4**

Property 2: Preservation - Existing Safety Checks

_For any_ input where the bug condition does NOT hold (user has password_set=TRUE, user is not Google provider, user already has a profile, or user does not exist), the fixed reset_incomplete_google_signup function SHALL produce exactly the same rejection behavior as the original function, preserving all five existing safety checks (null_user_id, user_not_found, not_google_provider, password_already_set, and profile validation for existing profiles).

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

Property 3: Prevention - Trigger Registration

_For any_ new Google OAuth signup that occurs after the trigger is properly registered, the system SHALL automatically create both public.profiles and public.user_roles records in the same transaction as the auth.users insert, preventing future occurrences of the missing profile condition.

**Validates: Requirements 2.2, 3.5**

## Fix Implementation

### Changes Required

The fix requires two separate migrations to address both the root cause and the recovery path.

**Migration 1: Re-register Missing Trigger**

**File**: `supabase/migrations/20260830000000_register_oauth_profile_trigger.sql`

**Purpose**: Ensure the `on_auth_user_created` trigger is present in production to prevent future profile-missing cases

**Specific Changes**:
1. **Idempotent Trigger Registration**: Use `DROP TRIGGER IF EXISTS` followed by `CREATE TRIGGER` to safely re-register the trigger without failing if it already exists
2. **Preserve Existing Logic**: Reference the existing `provision_authorized_new_user()` function without modification
3. **Add Migration Comment**: Document that this is a production hotfix for a missing trigger

```sql
-- Re-register the on_auth_user_created trigger for Google OAuth profile creation
-- This trigger should have been present from migration 20260817000000_production_signup_otp.sql
-- but is missing in production, causing Google OAuth users to have auth.users without profiles

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.provision_authorized_new_user();
```

**Migration 2: Enhance Reset Function with Defensive Profile Creation**

**File**: `supabase/migrations/20260831000000_fix_reset_profile_recovery.sql`

**Purpose**: Modify `reset_incomplete_google_signup()` to create missing profiles during recovery attempts

**Specific Changes**:
1. **Remove Profile Rejection**: Replace the `profile_not_found` return with profile creation logic
2. **Source Profile Data from auth.users**: Extract `full_name` from `raw_user_meta_data` (same logic as `provision_authorized_new_user()`)
3. **Create Minimal Profile**: Insert profile with required fields only: `user_id`, `full_name`, `email`, `role='student'`, `password_set=FALSE`
4. **Create User Role**: Insert `public.user_roles` record to match normal signup flow
5. **Preserve Transaction Safety**: All operations remain within the existing advisory lock and transaction boundaries
6. **Maintain Existing Checks**: Keep all five validation checks (null user, user exists, Google provider, password_set) in their original order

**Modified Logic Flow**:
```
BEFORE (current):
  Check 4: Profile exists
  IF NOT FOUND THEN
    RETURN {success:false, reason:'profile_not_found'}
  END IF

AFTER (fixed):
  Check 4: Profile exists OR create if missing for Google users
  SELECT profile INTO v_profile WHERE user_id = p_user_id FOR UPDATE
  
  IF NOT FOUND THEN
    -- Extract full_name from auth.users metadata (same logic as provision function)
    v_full_name := COALESCE(
      v_user.raw_user_meta_data->>'full_name',
      v_user.raw_user_meta_data->>'name',
      split_part(lower(trim(v_user.email)), '@', 1)
    )
    
    -- Create minimal profile
    INSERT INTO public.profiles (user_id, full_name, email, role, password_set)
    VALUES (p_user_id, v_full_name, lower(trim(v_user.email)), 'student', FALSE)
    RETURNING * INTO v_profile
    
    -- Create user_roles to match normal signup
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, 'student')
  END IF
```

6. **Update Function Comment**: Document that the function now handles missing profiles defensively

## Testing Strategy

### Validation Approach

The testing strategy follows a three-phase approach: (1) demonstrate the bug on unfixed code with real production data, (2) verify the migration fixes the specific broken accounts, and (3) verify all existing safety checks remain intact and no regressions occur.

### Exploratory Bug Condition Checking

**Goal**: Demonstrate the bug BEFORE implementing the fix using the actual production user account. Confirm the root cause analysis is correct.

**Test Plan**: Query production database to verify user `60d90a38-7bfd-42f7-a482-9f25dcab12b0` has `auth.users` with Google provider but no `public.profiles`. Call the unfixed `reset_incomplete_google_signup()` function and observe the `profile_not_found` error. Verify the trigger is indeed missing from production.

**Test Cases**:
1. **Verify Bug Condition**: Query `auth.users` and `public.profiles` for user `60d90a38-7bfd-42f7-a482-9f25dcab12b0` (will confirm auth exists, profile missing)
2. **Verify Reset Fails**: Call `reset_incomplete_google_signup('60d90a38-7bfd-42f7-a482-9f25dcab12b0')` on unfixed database (will return `{success:false, reason:'profile_not_found'}`)
3. **Verify Missing Trigger**: Query `pg_trigger` for `on_auth_user_created` trigger on `auth.users` table (will return no rows in production)
4. **Verify Onboarding Blocked**: Attempt to call `complete_onboarding_role()` for the affected user (will fail due to missing profile in `get_account_state()`)

**Expected Counterexamples**:
- User `60d90a38-7bfd-42f7-a482-9f25dcab12b0` has `auth.users` but no `public.profiles`
- Reset function returns `profile_not_found` instead of recovering the account
- Trigger `on_auth_user_created` does not exist in production database
- All onboarding APIs fail for this user due to missing profile

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior (creates profile and enables recovery).

**Pseudocode:**
```
FOR ALL user_id WHERE isBugCondition({user_id: user_id}) DO
  -- Apply migrations
  result := reset_incomplete_google_signup_fixed(user_id)
  
  -- Assert profile was created
  ASSERT profileExistsInPublicProfiles(user_id)
  
  -- Assert profile has correct fields
  profile := getProfile(user_id)
  ASSERT profile.role = 'student'
  ASSERT profile.password_set = FALSE
  ASSERT profile.email = getUserEmail(user_id)
  ASSERT profile.full_name IS NOT NULL
  
  -- Assert user_roles was created
  ASSERT userRolesExists(user_id)
  
  -- Assert reset succeeded
  ASSERT result.success = TRUE
  ASSERT result.next = 'role'
END FOR
```

**Test Plan**: Apply both migrations to production. Call the fixed reset function for user `60d90a38-7bfd-42f7-a482-9f25dcab12b0`. Verify profile and user_roles records are created. Verify user can now complete onboarding through `/auth/select-role`.

**Test Cases**:
1. **Profile Creation Test**: After migration, call `reset_incomplete_google_signup('60d90a38-7bfd-42f7-a482-9f25dcab12b0')` and verify it returns `{success:true, next:'role'}`
2. **Profile Data Test**: Query `public.profiles` and verify record exists with `role='student'`, `password_set=FALSE`, correct email and full_name
3. **User Roles Test**: Query `public.user_roles` and verify record exists with `role='student'`
4. **Onboarding Completion Test**: Call `complete_onboarding_role()` with `owner` role and verify account can complete successfully
5. **Trigger Prevention Test**: Create a test Google OAuth account after migration and verify profile is automatically created (no manual reset needed)

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function (all existing safety checks preserved).

**Pseudocode:**
```
FOR ALL user_id WHERE NOT isBugCondition({user_id: user_id}) DO
  -- Get original behavior (from current function logic)
  expected_result := getExpectedRejectionReason(user_id)
  
  -- Apply fix and test
  actual_result := reset_incomplete_google_signup_fixed(user_id)
  
  -- Assert same rejection behavior
  ASSERT actual_result = expected_result
  
  -- Assert no profile was created
  IF NOT profileExistedBefore(user_id) THEN
    ASSERT NOT profileExistsAfter(user_id)
  END IF
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the rejection conditions
- It catches edge cases where the fix might inadvertently weaken safety checks
- It provides strong guarantees that completed accounts and non-Google users are protected

**Test Plan**: Identify users in each rejection category (password_set=TRUE, non-Google provider, null user, non-existent user). Call the fixed reset function and verify identical rejection responses. Verify no profiles are created for rejected cases.

**Test Cases**:
1. **Completed Account Preservation**: Find a Google OAuth user with `password_set=TRUE`, call reset function, verify `password_already_set` rejection (no profile creation)
2. **Non-Google Provider Preservation**: Find an email/password user, call reset function, verify `not_google_provider` rejection
3. **Null User Preservation**: Call `reset_incomplete_google_signup(NULL)`, verify `null_user_id` rejection
4. **Non-Existent User Preservation**: Call with random UUID that doesn't exist, verify `user_not_found` rejection
5. **Normal Profile Preservation**: Find a Google OAuth user with existing profile, call reset function, verify it proceeds normally and does NOT create duplicate profile

### Unit Tests

- Test profile creation logic with various `raw_user_meta_data` formats (full_name, name, email fallback)
- Test that profile creation fails gracefully if email is invalid
- Test that user_roles creation is atomic with profile creation (both succeed or both roll back)
- Test that trigger registration is idempotent (can run multiple times without errors)
- Test all five rejection conditions with the fixed function

### Property-Based Tests

- Generate random Google OAuth users with missing profiles and verify all can be recovered
- Generate random completed accounts and verify none can be reset
- Generate random non-Google accounts and verify all are rejected
- Generate random user metadata variations and verify profile creation handles all formats correctly

### Integration Tests

- Test full recovery flow: reset function → profile creation → role selection → account completion
- Test normal signup flow with trigger present: OAuth callback → automatic profile creation → onboarding
- Test concurrent reset attempts (advisory lock should prevent race conditions)
- Test transaction rollback scenarios (if profile creation fails, reset should fail atomically)
