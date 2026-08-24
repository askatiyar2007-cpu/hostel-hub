# Google OAuth Incomplete Signup Bugfix Design

## Overview

This design addresses a critical business rule violation where incomplete signups (`password_set=false`) are incorrectly treated as complete HostelHub users. The core issue is that the system currently checks only for session existence and role data presence, without enforcing the fundamental requirement that `password_set=true` is the sole determinant of user status.

The fix introduces `password_set` checking at four critical enforcement points: middleware (session restoration), AuthProvider (client-side state), DashboardLayout (dashboard access guard), and the OAuth callback route (signup retry logic). Additionally, it fixes a password field encoding issue that displays mojibake characters.

**Key Principles:**
- `password_set=false` means NOT a HostelHub user, regardless of role data
- `/api/auth/account-state` remains the single source of truth
- Session-based password updates are preserved (prevents 401 errors)
- No database migrations required (SQL functions already exist)
- Email/OTP signup flow remains unchanged

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when a user has `password_set=false` but is treated as authenticated
- **Property (P)**: The desired behavior - users with `password_set=false` must be treated as non-users and redirected to login
- **Preservation**: Existing behavior that must remain unchanged - session-based updates, account-state API authority, email/OTP flow
- **password_set**: The authoritative completion flag in `profiles` table; `TRUE` grants user status, `FALSE` means incomplete/non-user
- **get_account_state()**: SQL function that returns canonical account completion state including `password_set`, `missing_step`, `is_complete`
- **Fresh visit**: A user opening the site in a new context (new tab, browser restart) after abandoning signup
- **Active onboarding**: A user actively progressing through the signup flow without closing/abandoning
- **Incomplete signup**: An account with `password_set=false`, typically abandoned at role selection or password setup
- **Session restoration**: The process of determining where to route a user when they revisit the site with an existing session

## Bug Details

### Bug Condition

The bug manifests in four distinct contexts, all sharing a common root cause: the system checks session existence or role data presence without verifying `password_set=true`.

**Context 1: Session Restoration (Fresh Visit)**
When a user abandons signup (closes tab at password setup with `password_set=false`) and later reopens the site, the system restores them to `/auth/setup-password` instead of `/auth/login`. This incorrectly treats an incomplete signup as an authenticated user session.

**Context 2: Middleware Authentication Check**
When middleware checks if a user can access protected routes, it only verifies `supabase.auth.getUser()` returns a user object, without checking `password_set` status. This allows users with `password_set=false` to bypass the authentication gate.

**Context 3: Dashboard Access Guard**
When DashboardLayout checks account completion, it redirects based on `accountCompletionStep` but doesn't distinguish between "user with missing step" and "non-user with abandoned progress". A user with role data but `password_set=false` can potentially access dashboards.

**Context 4: Signup Retry**
When a user with `password_set=false` attempts to retry signup with the same Google identity, the callback route checks if they've reached the password step but doesn't adequately clear stale role data, causing "Account already exists" errors instead of allowing a fresh role selection.

**Formal Specification:**
```
FUNCTION isBugCondition(context, user)
  INPUT: 
    context of type {'session_restoration', 'middleware_check', 'dashboard_access', 'signup_retry'}
    user of type { session_exists: boolean, password_set: boolean, role: string | null }
  OUTPUT: boolean
  
  RETURN user.session_exists = TRUE 
         AND user.password_set = FALSE
         AND (
           (context = 'session_restoration' AND userIsRoutedToPasswordPage())
           OR (context = 'middleware_check' AND userPassesAuthCheck())
           OR (context = 'dashboard_access' AND userAccessesDashboard())
           OR (context = 'signup_retry' AND userSeesAccountExistsError())
         )
END FUNCTION
```

### Examples

**Session Restoration Bug:**
- User starts Google OAuth signup, selects "Student" role (role data saved to DB)
- User reaches `/auth/setup-password` page, closes tab without setting password (`password_set=false`)
- Hours later, user opens the site homepage
- **Actual behavior**: System detects session, routes to `/auth/setup-password` (treating as authenticated user)
- **Expected behavior**: System should redirect to `/auth/login` (treating as non-user)

**Middleware Bug:**
- User has `password_set=false` but active session from abandoned signup
- User manually navigates to `/student/dashboard` in address bar
- **Actual behavior**: Middleware sees session exists, allows access to dashboard route
- **Expected behavior**: Middleware should redirect to `/auth/login` because `password_set=false`

**Dashboard Access Bug:**
- User has session, role='student', `password_set=false`
- User somehow bypasses initial checks and DashboardLayout renders
- **Actual behavior**: DashboardLayout checks `accountCompletionStep === 'password'`, redirects to `/auth/setup-password` (treating as authenticated user mid-onboarding)
- **Expected behavior**: System should treat user as non-authenticated and redirect to `/auth/login`

**Signup Retry Bug:**
- User abandons signup at password page with role='student', `password_set=false`
- User clicks "Continue with Google" on signup page again (intent='signup')
- OAuth callback detects `missing_step='password'` and calls `reset_incomplete_google_signup()`
- **Actual behavior**: If role data isn't fully cleared, subsequent logic may treat account as existing
- **Expected behavior**: Role data cleared, user redirected to `/auth/select-role` for fresh signup

**Password Field Encoding Bug:**
- User loads `/auth/setup-password` page
- Password input placeholder displays as `â€¢â€¢â€¢â€¢` (mojibake)
- **Expected behavior**: Clean placeholder text like "At least 6 characters" or bullet dots rendered properly

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Session-based password updates must continue to work (prevents 401 errors during tab switching)
- `/api/auth/account-state` remains the single source of truth for completion status
- Email/OTP signup flow must remain completely unaffected
- Completed users (`password_set=true`) must retain full access to dashboards
- Google OAuth completed flow must work without 401 errors
- Account protection: completed accounts still show "Account already exists" error
- Owner completion model: Owners don't need `owners` table entry, just profile + role + `password_set=true`

**Scope:**
All inputs where `password_set=true` should be completely unaffected by this fix. This includes:
- Completed users signing in via Google or email/OTP
- Users accessing their role-specific dashboards
- Users with active sessions navigating between pages
- Password reset flows for existing users

The fix only affects the narrow condition where `password_set=false` but session exists - this must be treated as "not a user" rather than "authenticated user with missing step".

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

### 1. **Middleware Only Checks Session Existence**
The `middleware.ts` file checks `await supabase.auth.getUser()` to determine if a user can access protected routes. It does not verify `password_set` status. This is the correct check for "does a session exist", but insufficient for "is this a complete HostelHub user". The middleware should consult the account-state to distinguish complete users from incomplete signups.

**Evidence**: `middleware.ts` lines 38-40
```typescript
const { data: { user } } = await supabase.auth.getUser()
// ... later
if (!user && (req.nextUrl.pathname.startsWith('/owner') || ...))
```

### 2. **Session Restoration Lacks Fresh Visit Detection**
When a user reopens the site after abandoning signup, the system has no mechanism to detect this is a "fresh visit" vs "active onboarding". The AuthProvider synchronizes session state and calls `/api/auth/account-state`, but there's no logic that says "if user has `password_set=false` and this is a fresh visit (not mid-onboarding), redirect to login".

The challenge: distinguishing "user actively filling out password form" from "user who abandoned signup and is now returning days later" without complex state tracking. The solution is server-side enforcement: pages like `/auth/setup-password` should verify the user navigated there legitimately (e.g., from callback or select-role), not from a bookmark or fresh browser session.

### 3. **DashboardLayout Guards Based on Completion Step, Not User Status**
The DashboardLayout component checks `accountCompletionStep` and redirects to the appropriate onboarding page. However, it treats `password_set=false` accounts as "authenticated users with missing steps" rather than "non-users who should be logged out". The guard should explicitly check `password_set` and redirect to login if false, rather than to the setup pages.

**Evidence**: `components/dashboard-layout.tsx` lines 107-120
```typescript
if (accountCompletionStep === 'role') {
  router.push('/auth/select-role');
  return;
}
if (accountCompletionStep === 'password' || accountCompletionStep === 'student_onboarding') {
  router.push('/auth/setup-password');
}
```

This logic assumes the user should continue onboarding, but doesn't check if this is a legitimate onboarding session or an abandoned signup being incorrectly restored.

### 4. **Callback Route Incomplete Signup Reset Needs Strengthening**
The OAuth callback route has logic to detect abandoned signups with `missing_step='password'` and call `reset_incomplete_google_signup()`. However, the subsequent checks may not fully account for edge cases where role data persists or the account-state query returns unexpected results after the reset.

**Evidence**: `app/auth/callback/route.ts` lines 129-149 handle the reset, but there may be timing or state synchronization issues.

### 5. **Password Field Placeholder Encoding Issue**
The password input in `app/auth/setup-password/page.tsx` uses `placeholder="At least 6 characters"` (line 189), which should render correctly. The mojibake (`â€¢â€¢â€¢â€¢`) suggests either:
- A file encoding issue (file saved as UTF-8 but read as Latin-1)
- A previous placeholder text that used bullet characters (`•`) but was mis-encoded
- A browser rendering issue with special characters

The most likely cause is the file contains a hardcoded bullet character sequence that was mis-encoded at some point. The fix is to ensure the placeholder uses only ASCII characters or properly encoded UTF-8.

## Correctness Properties

Property 1: Bug Condition - Session with password_set=false Treated as Non-User

_For any_ user session where `password_set=false`, the system SHALL treat the user as not authenticated (not a HostelHub user) and redirect them to `/auth/login`, preventing access to authenticated pages, dashboard routes, and onboarding continuation pages.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6**

Property 2: Preservation - Completed Users Retain Full Access

_For any_ user session where `password_set=true`, the system SHALL produce exactly the same routing, access, and behavior as before this fix, preserving dashboard access, session-based updates, and all authenticated functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8, 3.9, 3.13, 3.14, 3.15**

Property 3: Preservation - Email/OTP Flow Unchanged

_For any_ user completing signup via email and OTP (non-Google flow), the system SHALL behave identically to the pre-fix behavior, with no changes to account creation, session handling, or completion logic.

**Validates: Requirements 3.10, 3.11, 3.12**

Property 4: Bug Condition - Incomplete Signup Retry Clears Progress

_For any_ incomplete signup retry attempt (user with `password_set=false` using "Continue with Google" with intent='signup'), the system SHALL clear abandoned role data and redirect to `/auth/select-role`, allowing the user to start fresh instead of showing "Account already exists" error.

**Validates: Requirements 2.7, 2.8, 2.9**

## Fix Implementation

### Changes Required

The fix requires modifications to four files plus one file encoding check. No database migrations are needed because `get_account_state()` already returns `password_set` and the business logic is correct - we just need to enforce it client-side.

### File 1: `middleware.ts`

**Current Logic:**
```typescript
const { data: { user } } = await supabase.auth.getUser()
// Protected routes require authentication
if (!user && (req.nextUrl.pathname.startsWith('/owner') || ...)) {
  return NextResponse.redirect(url.pathname = '/auth/login')
}
```

**Problem**: Only checks session existence, not `password_set` status.

**Fix Strategy**: After getting the user, call `get_account_state()` via service role client and check `password_set`. If `password_set=false`, treat as unauthenticated and redirect to login.

**Specific Changes**:
1. Import `supabaseServer` from `@/lib/supabase/server` (service role client)
2. After `supabase.auth.getUser()`, if user exists, call `supabaseServer.rpc('get_account_state', { p_email: user.email })`
3. Extract `password_set` from the returned state
4. If `password_set=false`, treat as `!user` for routing purposes (redirect to login for protected routes)
5. Add early return for authenticated pages like `/auth/setup-password` if `password_set=false` (redirect to login)

**Pseudocode**:
```
IF user exists THEN
  state = supabaseServer.rpc('get_account_state', { p_email: user.email })
  
  IF state.password_set = FALSE THEN
    // Treat as unauthenticated
    IF pathname is protected route (/owner, /student, /parent, /admin) THEN
      REDIRECT to /auth/login
    END IF
    
    IF pathname is /auth/setup-password OR /auth/select-role THEN
      // These are onboarding pages for active signup, not for abandoned signups
      REDIRECT to /auth/login
    END IF
  END IF
END IF
```

**Edge Cases**:
- If `get_account_state()` fails, fallback to permissive behavior (allow access) to prevent lockout
- Don't call account-state for public paths (performance optimization)
- Allow `/auth/callback` to proceed normally (it has its own account-state logic)

### File 2: `lib/auth/context.tsx` (AuthProvider)

**Current Logic:**
AuthProvider calls `/api/auth/account-state` and sets `accountCompletionStep` based on `missing_step`. It doesn't explicitly check `password_set` for routing decisions.

**Problem**: The provider exposes account state but doesn't enforce `password_set=false` → redirect to login logic.

**Fix Strategy**: Add `password_set` to the context and check it during auth state refresh. If `password_set=false` and the user is not actively on callback/onboarding pages, trigger sign-out and redirect.

**Specific Changes**:
1. Add `password_set` field to `AuthContextType` interface (optional boolean)
2. In `refreshAuthState()`, after fetching account-state, check if `state.password_set === false`
3. If `password_set=false`, set a flag indicating "incomplete account"
4. Expose `password_set` in the context value
5. **Important**: Don't auto-redirect from AuthProvider (that's page-owned logic), just expose the state accurately

**Rationale**: AuthProvider should remain a "state observer" not a "router". It exposes the true state including `password_set`, and pages/layouts use this to make routing decisions.

**Pseudocode**:
```
FUNCTION refreshAuthState():
  session = await supabase.auth.getSession()
  
  IF no session THEN
    setUser(null)
    setProfile(null)
    setPasswordSet(null)
    RETURN
  END IF
  
  setUser(session.user)
  
  profile = fetch profile from database
  setProfile(profile)
  
  accountState = await fetch('/api/auth/account-state')
  
  IF accountState.ok THEN
    setAccountCompletionStep(accountState.missing_step)
    setPasswordSet(accountState.password_set)  // NEW
  ELSE
    setAccountCompletionStep(null)
    setPasswordSet(null)  // NEW
  END IF
END FUNCTION
```

### File 3: `components/dashboard-layout.tsx`

**Current Logic:**
DashboardLayout checks `accountCompletionStep` and redirects to onboarding pages if incomplete. It doesn't distinguish between "legitimate onboarding in progress" and "abandoned signup being restored".

**Problem**: Users with `password_set=false` are routed to onboarding pages instead of being signed out and sent to login.

**Fix Strategy**: Before checking `accountCompletionStep`, check if `password_set=false`. If so, sign out the user and redirect to login instead of continuing to onboarding pages.

**Specific Changes**:
1. Get `password_set` from useAuth() context (requires File 2 changes first)
2. In the useEffect that handles routing, add a check: if `password_set=false`, call `signOut()` and redirect to `/auth/login`
3. This check should come BEFORE the existing `accountCompletionStep` routing logic

**Pseudocode**:
```
EFFECT [loading, profile, accountCompletionStep, password_set, router]:
  IF loading OR !profile THEN
    RETURN  // Still loading
  END IF
  
  // NEW: Check for incomplete account that should be logged out
  IF password_set = FALSE THEN
    await signOut()  // Clears session
    router.push('/auth/login')
    RETURN
  END IF
  
  // EXISTING: Check for completion step routing
  IF accountCompletionStep = 'role' THEN
    router.push('/auth/select-role')
    RETURN
  END IF
  
  IF accountCompletionStep = 'password' OR 'student_onboarding' THEN
    router.push('/auth/setup-password')
  END IF
END EFFECT
```

**Edge Cases**:
- If `password_set` is null/undefined (account-state fetch failed), fall back to existing behavior (permissive)
- Sign-out should be async and handled gracefully (show loading state if needed)
- Don't create sign-out loop (check that we're not already on login page)

### File 4: `app/auth/callback/route.ts`

**Current Logic:**
Callback route has logic to detect abandoned signups with `missing_step='password'` and calls `reset_incomplete_google_signup()`, then redirects to `/auth/select-role`. This is mostly correct but needs strengthening.

**Problem**: 
1. The reset logic might not handle all edge cases (e.g., role data persistence)
2. The account-state is checked before the reset, but not re-verified after
3. Need to ensure `password_set` is explicitly checked in the incomplete signup detection

**Fix Strategy**: Strengthen the incomplete signup retry logic by:
1. Explicitly checking `password_set=false` (not just `missing_step='password'`)
2. Ensuring the reset RPC is called correctly
3. Verifying the reset worked (optional: re-query account-state after reset)

**Specific Changes**:
1. In the incomplete signup retry block (lines ~130-149), add explicit check for `accountState.password_set === false`
2. Add more detailed logging for debugging retry scenarios
3. Consider re-querying account-state after `reset_incomplete_google_signup()` to verify the reset worked (optional, depends on testing)
4. Ensure the redirect to `/auth/select-role` only happens if reset succeeds

**Current Code Block**:
```typescript
if (
  intent === 'signup'
  && !accountState.is_complete
  && (accountState.missing_step === 'password' || accountState.missing_step === 'student_onboarding')
  && accountState.user_id
) {
  const { data: resetData, error: resetError } = await supabaseServer
    .rpc('reset_incomplete_google_signup', { p_user_id: accountState.user_id });

  if (resetError || !resetData?.success) {
    console.error('OAuth callback could not reset abandoned Google signup.', resetError);
    return genericLoginError(request);
  }

  return redirect(request, '/auth/select-role');
}
```

**Enhanced Version**:
```typescript
// Strengthen the condition to explicitly check password_set
if (
  intent === 'signup'
  && !accountState.is_complete
  && accountState.password_set === false  // EXPLICIT CHECK
  && (accountState.missing_step === 'password' || accountState.missing_step === 'student_onboarding')
  && accountState.user_id
) {
  console.log('Detected incomplete signup retry, resetting role data for user:', accountState.user_id);
  
  const { data: resetData, error: resetError } = await supabaseServer
    .rpc('reset_incomplete_google_signup', { p_user_id: accountState.user_id });

  if (resetError || !resetData?.success) {
    console.error('OAuth callback could not reset abandoned Google signup.', resetError, resetData);
    return genericLoginError(request);
  }

  console.log('Successfully reset incomplete signup, redirecting to role selection');
  return redirect(request, '/auth/select-role');
}
```

**Edge Cases**:
- If reset RPC fails, show generic login error (already handled)
- If `user_id` is null (shouldn't happen based on prior checks, but be defensive)
- If `password_set` is null/undefined, treat as false (incomplete)

### File 5: `app/auth/setup-password/page.tsx`

**Current Issue**: Password field placeholder shows mojibake characters (`â€¢â€¢â€¢â€¢`) instead of clean text.

**Investigation Needed**: Check the actual placeholder text in the file. The code shown in the context has `placeholder="At least 6 characters"` which should render correctly. The mojibake might be:
1. A visual issue in a specific browser
2. An encoding issue in how the file is saved (UTF-8 vs Latin-1)
3. A different placeholder value than shown in the code (e.g., using bullet characters)

**Fix Strategy**:
1. Ensure the file is saved with UTF-8 encoding
2. Verify the placeholder text contains only ASCII characters or properly encoded UTF-8
3. If using bullet characters for password masking, use proper Unicode bullets: `\u2022` or just use asterisks/dots
4. Alternatively, use an empty placeholder or simple text like "Enter password"

**Specific Changes**:
1. Open `app/auth/setup-password/page.tsx` in an editor that shows file encoding
2. Verify encoding is UTF-8 (not UTF-8 with BOM, not Latin-1)
3. Check the placeholder text on lines ~189 and ~211
4. Replace any non-ASCII characters with ASCII equivalents
5. Save the file with explicit UTF-8 encoding

**Recommendation**: Use `placeholder="Enter your password"` instead of "At least 6 characters" to avoid any potential encoding issues with special characters.

### File 6: `/api/auth/account-state/route.ts` (No Changes Needed)

This file already returns `password_set` in the response (line 52), so no changes are required. It's correctly exposing the database state via the API.

### Summary of Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `middleware.ts` | Add `password_set` check | Call account-state API, redirect to login if `password_set=false` |
| `lib/auth/context.tsx` | Expose `password_set` | Add `password_set` field to context from account-state response |
| `components/dashboard-layout.tsx` | Add pre-routing check | Sign out and redirect to login if `password_set=false` |
| `app/auth/callback/route.ts` | Strengthen retry logic | Add explicit `password_set=false` check in incomplete signup handling |
| `app/auth/setup-password/page.tsx` | Fix encoding | Ensure UTF-8 encoding, use ASCII placeholder text |

## Testing Strategy

### Validation Approach

The testing strategy follows a three-phase approach:
1. **Exploratory Bug Condition Checking**: Surface counterexamples on unfixed code to confirm the bug
2. **Fix Checking**: Verify the fix resolves all bug scenarios
3. **Preservation Checking**: Verify completed users and email/OTP flows are unchanged

### Exploratory Bug Condition Checking

**Goal**: Demonstrate the bug on unfixed code to confirm root cause analysis. Run these tests BEFORE implementing the fix.

**Test Plan**: 
1. Create test scenarios that simulate abandoned signups with `password_set=false`
2. Test session restoration, middleware access, dashboard rendering, and signup retry
3. Observe failures and document the exact behavior
4. Use test results to refine the fix implementation

**Test Cases**:

**TC1: Session Restoration - Abandoned Signup**
1. Create a user account with profile, role='student', `password_set=false` (simulate abandoned signup)
2. Create a valid session for this user
3. Simulate navigating to homepage `/`
4. **Expected on unfixed code**: User routed to `/auth/setup-password` (WRONG - demonstrates bug)
5. **Expected on fixed code**: User redirected to `/auth/login` (CORRECT)

**TC2: Middleware - Protected Route Access**
1. Create a user with `password_set=false`, role='student'
2. Create a valid session
3. Attempt to access `/student/dashboard`
4. **Expected on unfixed code**: Middleware allows access (WRONG - demonstrates bug)
5. **Expected on fixed code**: Middleware redirects to `/auth/login` (CORRECT)

**TC3: Dashboard Layout - Incomplete Account Guard**
1. Create user with `password_set=false`, role='owner'
2. Mock AuthProvider to return session with `accountCompletionStep='password'`
3. Render DashboardLayout
4. **Expected on unfixed code**: Component redirects to `/auth/setup-password` (WRONG)
5. **Expected on fixed code**: Component signs out and redirects to `/auth/login` (CORRECT)

**TC4: OAuth Callback - Incomplete Signup Retry**
1. Create user with profile, role='student', `password_set=false`
2. Simulate OAuth callback with `intent='signup'`, valid transaction cookie
3. Mock `get_account_state()` to return `missing_step='password'`, `password_set=false`
4. **Expected on unfixed code**: May show "Account already exists" or fail to clear role data (WRONG)
5. **Expected on fixed code**: Calls reset RPC, redirects to `/auth/select-role` (CORRECT)

**TC5: Password Field Encoding**
1. Load `/auth/setup-password` page in browser
2. Inspect password input placeholder text
3. **Expected on unfixed code**: May show `â€¢â€¢â€¢â€¢` or mojibake (WRONG)
4. **Expected on fixed code**: Shows clean placeholder like "Enter your password" (CORRECT)

**Expected Counterexamples**:
- Session restoration routes to setup-password instead of login
- Middleware allows dashboard access without checking `password_set`
- DashboardLayout treats `password_set=false` as "continue onboarding" instead of "not a user"
- Callback retry logic may fail to clear role data properly
- Password placeholder shows encoding artifacts

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (`password_set=false` with active session), the fixed system produces the expected behavior (redirect to login, block access).

**Pseudocode:**
```
FOR ALL context IN ['session_restoration', 'middleware_check', 'dashboard_access', 'signup_retry'] DO
  FOR ALL user WHERE user.session_exists = TRUE AND user.password_set = FALSE DO
    result := system_fixed(context, user)
    ASSERT result = redirect_to_login OR result = block_access OR result = clear_progress_and_retry
  END FOR
END FOR
```

**Test Plan**: Run the same test cases as exploratory phase, but on FIXED code, asserting the correct behavior.

**Test Cases**:

**TC1-Fixed: Session Restoration**
- Setup: User with `password_set=false`, valid session
- Action: Navigate to `/`
- Assert: Redirected to `/auth/login`

**TC2-Fixed: Middleware Protection**
- Setup: User with `password_set=false`, valid session
- Action: Access `/student/dashboard`
- Assert: Middleware redirects to `/auth/login`

**TC3-Fixed: Dashboard Guard**
- Setup: User with `password_set=false`, DashboardLayout renders
- Action: useEffect runs on mount
- Assert: `signOut()` called, redirected to `/auth/login`

**TC4-Fixed: Signup Retry**
- Setup: User with `password_set=false`, role='student'
- Action: OAuth callback with `intent='signup'`
- Assert: `reset_incomplete_google_signup()` called, redirected to `/auth/select-role`

**TC5-Fixed: Password Encoding**
- Setup: Load setup-password page
- Action: Inspect placeholder
- Assert: Clean text, no mojibake

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (`password_set=true` or no session), the fixed system produces the same result as the original system.

**Pseudocode:**
```
FOR ALL user WHERE (user.password_set = TRUE) OR (user.session_exists = FALSE) DO
  result_original := system_original(user)
  result_fixed := system_fixed(user)
  ASSERT result_original = result_fixed
END FOR
```

**Testing Approach**: Property-based testing is STRONGLY recommended for preservation checking because:
- It generates hundreds of test cases automatically across the input domain
- It catches edge cases that manual tests miss (e.g., different role types, profile states, session configurations)
- It provides high confidence that completed users are unaffected
- It's especially important for business-critical functionality like authentication

**Test Plan**: 
1. Generate random complete user scenarios (`password_set=true` with various roles, profiles, dashboard states)
2. Generate random no-session scenarios (logged out users, public pages)
3. Generate edge cases (owners without owners table, students with student records, etc.)
4. For each scenario, verify behavior is identical pre/post fix

**Test Cases**:

**TC6: Completed User - Student Dashboard Access**
- Setup: User with `password_set=true`, role='student', complete student record
- Action: Access `/student/dashboard`
- Assert: Middleware allows access, DashboardLayout renders dashboard, no redirects

**TC7: Completed User - Owner Dashboard Access**
- Setup: User with `password_set=true`, role='owner', no owners table entry (completion model)
- Action: Access `/owner/dashboard`
- Assert: Full access granted, completion checks pass

**TC8: Completed User - Session-Based Password Update**
- Setup: User on `/auth/setup-password` completing final step (active onboarding)
- Action: Submit password via `/api/auth/onboarding/password`
- Assert: Session-based update succeeds, no 401 errors, redirected to dashboard

**TC9: No Session - Public Page Access**
- Setup: No user session
- Action: Access `/marketplace` or `/` (public pages)
- Assert: Pages load normally, no redirects, no authentication required

**TC10: Email/OTP Signup - Complete Flow**
- Setup: New user starting email/OTP signup
- Action: Complete entire flow (request OTP, verify, set password, select role)
- Assert: Account created with `password_set=true`, dashboard access granted, no regressions

**TC11: Google OAuth Login - Existing Complete User**
- Setup: Existing user with `password_set=true`, role='student'
- Action: Click "Continue with Google" with intent='login'
- Assert: OAuth callback redirects to `/student/dashboard`, no onboarding steps

**TC12: Account Exists Protection**
- Setup: Completed user (password_set=true) with email='test@example.com'
- Action: Attempt to create new account with same email
- Assert: "Account already exists" error shown, account not duplicated

### Unit Tests

The following unit test categories should be implemented:

**Middleware Tests:**
- Test that `password_set=true` users can access protected routes
- Test that `password_set=false` users are redirected to login from protected routes
- Test that public routes are accessible without authentication
- Test that callback route is exempt from account-state checks
- Test error handling if `get_account_state()` fails

**AuthProvider Tests:**
- Test that `password_set` is correctly extracted from account-state response
- Test that null/error responses are handled gracefully
- Test that session changes trigger account-state refresh
- Test that completed users have `password_set=true` in context

**DashboardLayout Tests:**
- Test that `password_set=false` triggers sign-out and redirect to login
- Test that `password_set=true` with incomplete steps redirects to onboarding pages
- Test that completed users (`password_set=true`, `is_complete=true`) render dashboard
- Test loading states are handled correctly
- Test that sign-out doesn't create infinite redirect loops

**OAuth Callback Tests:**
- Test incomplete signup retry logic calls reset RPC
- Test that reset RPC failure shows generic error
- Test that successful reset redirects to `/auth/select-role`
- Test that completed users are routed to their dashboard
- Test that login intent with missing profile signs out and shows "no account" message

### Property-Based Tests

Property-based tests should generate diverse test scenarios automatically:

**Property 1: Incomplete Accounts Never Access Dashboards**
```
PROPERTY incomplete_accounts_blocked:
  FORALL user WHERE user.password_set = FALSE:
    FORALL protected_route IN ['/owner/*', '/student/*', '/parent/*', '/admin/*']:
      result = middleware(user, protected_route)
      ASSERT result.redirected_to = '/auth/login'
```

**Property 2: Completed Accounts Retain Access**
```
PROPERTY completed_accounts_access:
  FORALL user WHERE user.password_set = TRUE AND user.is_complete = TRUE:
    FORALL dashboard_route IN dashboardRoutesForRole(user.role):
      result_before_fix = system_original(user, dashboard_route)
      result_after_fix = system_fixed(user, dashboard_route)
      ASSERT result_before_fix = result_after_fix
```

**Property 3: Email/OTP Flow Unchanged**
```
PROPERTY email_otp_preservation:
  FORALL signup_flow WHERE signup_flow.method = 'email_otp':
    result_before = complete_email_signup_flow_original(signup_flow)
    result_after = complete_email_signup_flow_fixed(signup_flow)
    ASSERT result_before.account_state = result_after.account_state
    ASSERT result_before.dashboard_access = result_after.dashboard_access
```

### Integration Tests

Full end-to-end integration tests covering complete user journeys:

**IT1: Google OAuth Incomplete Signup → Abandon → Retry**
1. Start Google OAuth signup, select role (role data saved)
2. Reach password page, close browser tab (simulate abandon)
3. Reopen site homepage
4. Assert: Redirected to `/auth/login` (not `/auth/setup-password`)
5. Click "Continue with Google" again with signup intent
6. Assert: Callback clears role data, redirects to `/auth/select-role`
7. Select new role, set password, complete signup
8. Assert: Dashboard access granted, `password_set=true`

**IT2: Google OAuth Complete Signup → Full Access**
1. Start Google OAuth signup, complete all steps (profile, role, password)
2. Assert: `password_set=true`, redirected to role-specific dashboard
3. Close browser, reopen site
4. Assert: Still logged in, dashboard accessible
5. Navigate between dashboard pages
6. Assert: No 401 errors, no unexpected redirects

**IT3: Email/OTP Signup → Complete Flow**
1. Enter email, request OTP
2. Verify OTP, select role
3. Set password
4. Assert: `password_set=true`, dashboard access granted
5. Close browser, reopen site
6. Assert: Session persists, dashboard accessible

**IT4: Middleware Protection Across All Role Types**
1. For each role in ['owner', 'student', 'parent', 'super_admin']:
   - Create incomplete account with that role, `password_set=false`
   - Attempt to access role-specific dashboard
   - Assert: Middleware redirects to login
   - Complete the signup (set password)
   - Attempt to access dashboard again
   - Assert: Access granted

**IT5: Password Field Encoding Verification**
1. Load `/auth/setup-password` in multiple browsers (Chrome, Firefox, Safari)
2. Inspect password input placeholder text
3. Assert: Clean rendering, no mojibake, consistent across browsers
4. Enter password, submit form
5. Assert: Password saved correctly, no encoding issues in database

## Implementation Sequence

The changes should be implemented in this order to minimize integration issues:

1. **Phase 1: Expose password_set in Context**
   - Modify `lib/auth/context.tsx` to expose `password_set` field
   - Write unit tests for context changes
   - Verify account-state API correctly returns `password_set`

2. **Phase 2: Add DashboardLayout Guard**
   - Modify `components/dashboard-layout.tsx` to check `password_set` and sign out if false
   - Write unit tests for guard logic
   - Test manually with incomplete account

3. **Phase 3: Add Middleware Check**
   - Modify `middleware.ts` to call account-state and check `password_set`
   - Write unit tests for middleware logic
   - Test performance impact (caching may be needed)

4. **Phase 4: Strengthen Callback Logic**
   - Modify `app/auth/callback/route.ts` to explicitly check `password_set=false`
   - Write unit tests for incomplete signup retry
   - Test manually with abandoned signup scenario

5. **Phase 5: Fix Password Field Encoding**
   - Check file encoding of `app/auth/setup-password/page.tsx`
   - Update placeholder text to ASCII
   - Test in multiple browsers

6. **Phase 6: Integration Testing**
   - Run all 5 integration test scenarios
   - Run property-based tests for preservation checking
   - Performance testing for middleware account-state calls

## Performance Considerations

**Middleware Account-State Calls:**
The middleware now calls `get_account_state()` for every authenticated request to protected routes. This could be a performance bottleneck.

**Mitigation Strategies:**
1. **Conditional Execution**: Only call account-state if user is accessing a protected route (not public pages)
2. **Caching**: Cache the account-state result for a short duration (e.g., 5 minutes) using session storage or in-memory cache
3. **Lazy Evaluation**: Only check `password_set` for routes that actually require it (dashboards), not for API routes
4. **Database Optimization**: Ensure `get_account_state()` SQL function is optimized with proper indexes

**Recommendation**: Start without caching, measure performance impact, add caching only if needed. The `get_account_state()` function is already optimized and should be fast (<10ms).

## Rollback Plan

If the fix causes critical issues in production:

1. **Immediate Rollback**: Revert all 5 file changes using git
2. **Partial Rollback**: If only one component is problematic, revert that file individually:
   - Middleware: Revert to session-only checking (least disruptive)
   - AuthProvider: Remove `password_set` from context
   - DashboardLayout: Remove sign-out logic, revert to completion-step routing
   - Callback: Revert to original incomplete signup handling

3. **Database State**: No rollback needed (no schema changes made)

4. **User Impact Assessment**:
   - Completed users should be completely unaffected
   - Incomplete signups may be able to access dashboards temporarily (business rule violation, but not data corruption)
   - Email/OTP flow should remain functional

## Security Implications

**Positive Security Impact:**
- Enforcing `password_set=true` prevents unauthorized dashboard access by incomplete accounts
- Multiple layers of enforcement (middleware, layout guard, context) provide defense in depth
- Account-state API remains the single source of truth (no logic duplication)

**No New Security Risks:**
- The fix doesn't expose new data or endpoints
- Account-state API is already service-role protected (not public)
- Sign-out logic is safe (uses existing Supabase auth methods)

**Validation:**
- All security-sensitive operations (account-state lookup, reset RPC) use service-role client
- No client-side password_set manipulation possible (read-only from API)
- Middleware enforcement prevents client-side bypass attempts
