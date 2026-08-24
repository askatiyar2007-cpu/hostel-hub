# Implementation Plan

## Overview
This plan implements the Google OAuth incomplete signup bugfix using the bug condition methodology. Tasks follow the exploratory approach: write tests to understand the bug, preserve existing behavior, then implement the fix with verification.

---

## Phase 1: Exploration & Preservation Tests

### Bug Condition Exploration Test

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Session with password_set=false Treated as Authenticated User
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples demonstrating that incomplete signups are incorrectly treated as authenticated users
  - **Scoped PBT Approach**: Test concrete scenarios across four contexts: session restoration, middleware check, dashboard access, and signup retry
  - Create test scenarios for users with `password_set=false` but active sessions:
    - TC1: Session restoration - user navigates to homepage, currently routed to `/auth/setup-password` (WRONG)
    - TC2: Middleware check - user accesses `/student/dashboard`, currently allowed access (WRONG)
    - TC3: Dashboard guard - DashboardLayout renders, currently redirects to `/auth/setup-password` (WRONG)
    - TC4: Signup retry - user with abandoned signup retries with Google, may show "Account already exists" (WRONG)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bug exists)
  - Document counterexamples found (e.g., "User with password_set=false can access /student/dashboard")
  - Mark task complete when tests are written, run, and failures are documented
  - _Bug_Condition: isBugCondition(context, user) where user.session_exists=TRUE AND user.password_set=FALSE_
  - _Expected_Behavior: All contexts redirect to /auth/login or block access when password_set=false_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

### Preservation Property Tests

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Completed Users and Email/OTP Flow Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for users with `password_set=true`:
    - Completed Student user accessing `/student/dashboard` - currently allowed (CORRECT)
    - Completed Owner user accessing `/owner/dashboard` - currently allowed (CORRECT)
    - Active onboarding user submitting password - session-based update works (CORRECT)
    - Email/OTP signup flow completing - sets `password_set=true` and grants access (CORRECT)
  - Write property-based tests capturing observed behavior patterns:
    - Property: All users with `password_set=true` retain dashboard access
    - Property: All email/OTP signups produce identical account states
    - Property: Session-based password updates succeed without 401 errors
    - Property: Completed users navigating between pages have no unexpected redirects
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Preservation: All users with password_set=true must retain identical access and behavior_
  - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15_

---

## Phase 2: Implementation

### Phase 1: Expose password_set in Context

- [ ] 3. Expose password_set field in AuthProvider context

  - [ ] 3.1 Add password_set to AuthContextType interface
    - Open `lib/auth/context.tsx`
    - Add `password_set: boolean | null` field to `AuthContextType` interface
    - _Requirements: 2.2, 2.3_

  - [ ] 3.2 Extract password_set from account-state API response
    - In `refreshAuthState()` function, after fetching `/api/auth/account-state`
    - Extract `accountState.password_set` from the response
    - Store in state variable: `const [passwordSet, setPasswordSet] = useState<boolean | null>(null)`
    - Set `setPasswordSet(accountState.password_set)` when API succeeds
    - Set `setPasswordSet(null)` when API fails or no session exists
    - _Requirements: 2.2, 2.3_

  - [ ] 3.3 Expose password_set in context value
    - Add `password_set: passwordSet` to the context provider value object
    - Ensure it's available to all consumers via `useAuth()` hook
    - _Requirements: 2.2_

  - [ ] 3.4 Write unit tests for context changes
    - Test that `password_set=true` is correctly exposed for completed users
    - Test that `password_set=false` is correctly exposed for incomplete signups
    - Test that `password_set=null` when account-state fetch fails
    - Test that `password_set` updates when session changes
    - _Requirements: 2.2, 2.3_

### Phase 2: Add DashboardLayout Guard

- [ ] 4. Add password_set guard to DashboardLayout

  - [ ] 4.1 Import password_set from useAuth hook
    - In `components/dashboard-layout.tsx`
    - Destructure `password_set` from `useAuth()` along with existing fields
    - _Requirements: 2.4_

  - [ ] 4.2 Add pre-routing check for incomplete accounts
    - In the useEffect that handles routing, before checking `accountCompletionStep`
    - Add condition: `if (password_set === false)`
    - Call `await signOut()` to clear the session
    - Call `router.push('/auth/login')` to redirect
    - Return early to prevent further routing logic
    - _Bug_Condition: User has session but password_set=false (incomplete signup)_
    - _Expected_Behavior: Sign out user and redirect to /auth/login_
    - _Preservation: Users with password_set=true continue to existing routing logic_
    - _Requirements: 2.4, 2.6_

  - [ ] 4.3 Handle edge cases
    - If `password_set` is null/undefined (fetch failed), fall back to existing behavior
    - Ensure sign-out is async and gracefully handled
    - Add loading state if needed to prevent UI flicker
    - Prevent infinite redirect loops (check current path before redirecting)
    - _Requirements: 2.4_

  - [ ] 4.4 Write unit tests for guard logic
    - Test that `password_set=false` triggers sign-out and redirect to login
    - Test that `password_set=true` with incomplete steps redirects to onboarding
    - Test that `password_set=true` with `is_complete=true` renders dashboard
    - Test that null `password_set` falls back to existing behavior
    - Mock `signOut()` and `router.push()` to verify they're called correctly
    - _Requirements: 2.4, 2.6_

### Phase 3: Add Middleware Check

- [ ] 5. Add password_set verification to middleware

  - [ ] 5.1 Import service role Supabase client
    - In `middleware.ts`
    - Import `supabaseServer` from `@/lib/supabase/server` (service role client)
    - _Requirements: 2.3_

  - [ ] 5.2 Call get_account_state after user authentication
    - After `supabase.auth.getUser()` succeeds and user exists
    - Check if request is for a protected route (starts with `/owner`, `/student`, `/parent`, `/admin`)
    - If protected route, call: `await supabaseServer.rpc('get_account_state', { p_email: user.email })`
    - Extract `password_set` from returned state
    - _Requirements: 2.3_

  - [ ] 5.3 Redirect to login if password_set is false
    - If `password_set === false`, treat as unauthenticated
    - Redirect protected routes to `/auth/login`
    - Also redirect onboarding pages (`/auth/setup-password`, `/auth/select-role`) to `/auth/login`
    - Rationale: These pages are for active signup, not abandoned signups
    - _Bug_Condition: User has session but password_set=false_
    - _Expected_Behavior: Block access to protected routes and onboarding continuation pages_
    - _Preservation: Users with password_set=true can access all routes as before_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

  - [ ] 5.4 Handle edge cases and optimize performance
    - If `get_account_state()` fails, fall back to permissive behavior (prevent lockout)
    - Don't call account-state for public paths (performance optimization)
    - Allow `/auth/callback` to proceed normally (has its own account-state logic)
    - Consider caching account-state result for short duration if performance issues arise
    - _Requirements: 2.3_

  - [ ] 5.5 Write unit tests for middleware logic
    - Test that `password_set=true` users can access protected routes
    - Test that `password_set=false` users are redirected to login from protected routes
    - Test that public routes are accessible without authentication
    - Test that callback route is exempt from account-state checks
    - Test error handling if `get_account_state()` fails (fallback to permissive)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

### Phase 4: Strengthen Callback Logic

- [ ] 6. Strengthen incomplete signup retry logic in OAuth callback

  - [ ] 6.1 Add explicit password_set check to retry detection
    - In `app/auth/callback/route.ts`, locate the incomplete signup retry block (lines ~130-149)
    - Add explicit condition: `accountState.password_set === false`
    - This ensures we only reset when truly incomplete (not just missing a step)
    - _Requirements: 2.7, 2.8_

  - [ ] 6.2 Add detailed logging for debugging
    - Add console.log before calling reset RPC: `'Detected incomplete signup retry, resetting role data for user:', accountState.user_id`
    - Add console.log after successful reset: `'Successfully reset incomplete signup, redirecting to role selection'`
    - Enhance error logging with more details: `console.error('OAuth callback could not reset abandoned Google signup.', resetError, resetData)`
    - _Requirements: 2.7, 2.8_

  - [ ] 6.3 Verify reset RPC call and error handling
    - Ensure `reset_incomplete_google_signup()` RPC is called with correct params
    - Check that both `resetError` and `!resetData?.success` are handled
    - Return `genericLoginError(request)` if reset fails (already implemented)
    - Redirect to `/auth/select-role` only after successful reset
    - _Bug_Condition: User with password_set=false attempts signup retry_
    - _Expected_Behavior: Clear abandoned role data and redirect to role selection_
    - _Preservation: Completed users and first-time signups unaffected_
    - _Requirements: 2.7, 2.8, 2.9_

  - [ ] 6.4 Write unit tests for callback retry logic
    - Test that incomplete signup (`password_set=false`, `missing_step='password'`) calls reset RPC
    - Test that reset RPC failure shows generic error
    - Test that successful reset redirects to `/auth/select-role`
    - Test that completed users are routed to their dashboard
    - Test that login intent with missing profile signs out correctly
    - Mock Supabase RPC calls to verify correct parameters
    - _Requirements: 2.7, 2.8, 2.9_

### Phase 5: Fix Password Field Encoding

- [ ] 7. Fix password field placeholder encoding issue

  - [ ] 7.1 Check file encoding of setup-password page
    - Open `app/auth/setup-password/page.tsx` in editor
    - Verify file encoding is UTF-8 (not UTF-8 with BOM, not Latin-1)
    - Check for any non-ASCII characters in the file
    - _Requirements: 2.10_

  - [ ] 7.2 Update password field placeholders
    - Locate password input field (around line 189)
    - Replace placeholder with ASCII-only text: `placeholder="Enter your password"`
    - Locate confirm password field (around line 211)
    - Replace placeholder with ASCII-only text: `placeholder="Confirm your password"`
    - Remove any bullet characters or special Unicode that may cause mojibake
    - _Requirements: 2.10_

  - [ ] 7.3 Save file with explicit UTF-8 encoding
    - Ensure editor saves as UTF-8 without BOM
    - Verify no encoding artifacts remain
    - _Requirements: 2.10_

  - [ ] 7.4 Test in multiple browsers
    - Load `/auth/setup-password` in Chrome, Firefox, Safari
    - Verify placeholder text renders cleanly without mojibake
    - Test that password input and submission work correctly
    - Verify no encoding issues in database after password submission
    - _Requirements: 2.10_

---

## Phase 3: Verification

### Verify Bug Condition Test Now Passes

- [ ] 8. Re-run bug condition exploration test
  - **Property 1: Expected Behavior** - Session with password_set=false Redirected to Login
  - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
  - The test from task 1 encodes the expected behavior
  - When this test passes, it confirms the expected behavior is satisfied
  - Run all four context scenarios:
    - TC1: Session restoration - user now redirected to `/auth/login` ✓
    - TC2: Middleware check - user now blocked from `/student/dashboard` ✓
    - TC3: Dashboard guard - user now signed out and redirected to `/auth/login` ✓
    - TC4: Signup retry - user now successfully redirected to `/auth/select-role` ✓
  - **EXPECTED OUTCOME**: All tests PASS (confirms bug is fixed)
  - _Expected_Behavior: password_set=false users treated as non-users in all contexts_
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 2.8, 2.9_

### Verify Preservation Tests Still Pass

- [ ] 9. Re-run preservation property tests
  - **Property 2: Preservation** - Completed Users and Email/OTP Flow Unchanged
  - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
  - Run all preservation scenarios:
    - Completed Student accessing dashboard - still allowed ✓
    - Completed Owner accessing dashboard - still allowed ✓
    - Active onboarding password submission - session-based update still works ✓
    - Email/OTP signup flow - still produces identical account states ✓
    - Completed users navigating pages - no unexpected redirects ✓
  - **EXPECTED OUTCOME**: All tests PASS (confirms no regressions)
  - Verify property-based tests covering large input space still pass
  - _Preservation: All password_set=true users retain identical behavior_
  - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15_

---

## Phase 4: Integration Testing

- [ ] 10. Run integration tests for complete user journeys

  - [ ] 10.1 IT1: Google OAuth Incomplete Signup → Abandon → Retry
    - Start Google OAuth signup, select role (role data saved)
    - Reach password page, close browser tab (simulate abandon)
    - Reopen site homepage
    - Assert: Redirected to `/auth/login` (not `/auth/setup-password`) ✓
    - Click "Continue with Google" again with signup intent
    - Assert: Callback clears role data, redirects to `/auth/select-role` ✓
    - Select new role, set password, complete signup
    - Assert: Dashboard access granted, `password_set=true` ✓
    - _Requirements: 2.1, 2.7, 2.8, 2.9_

  - [ ] 10.2 IT2: Google OAuth Complete Signup → Full Access
    - Start Google OAuth signup, complete all steps (profile, role, password)
    - Assert: `password_set=true`, redirected to role-specific dashboard ✓
    - Close browser, reopen site
    - Assert: Still logged in, dashboard accessible ✓
    - Navigate between dashboard pages
    - Assert: No 401 errors, no unexpected redirects ✓
    - _Requirements: 3.13, 3.14, 3.15_

  - [ ] 10.3 IT3: Email/OTP Signup → Complete Flow
    - Enter email, request OTP
    - Verify OTP, select role
    - Set password
    - Assert: `password_set=true`, dashboard access granted ✓
    - Close browser, reopen site
    - Assert: Session persists, dashboard accessible ✓
    - _Requirements: 3.10, 3.11, 3.12_

  - [ ] 10.4 IT4: Middleware Protection Across All Role Types
    - For each role in ['owner', 'student', 'parent', 'super_admin']:
      - Create incomplete account with that role, `password_set=false`
      - Attempt to access role-specific dashboard
      - Assert: Middleware redirects to login ✓
      - Complete the signup (set password)
      - Attempt to access dashboard again
      - Assert: Access granted ✓
    - _Requirements: 2.3, 2.4, 2.6_

  - [ ] 10.5 IT5: Password Field Encoding Verification
    - Load `/auth/setup-password` in Chrome, Firefox, Safari
    - Inspect password input placeholder text
    - Assert: Clean rendering, no mojibake, consistent across browsers ✓
    - Enter password, submit form
    - Assert: Password saved correctly, no encoding issues in database ✓
    - _Requirements: 2.10_

---

## Phase 5: Performance & Security Validation

- [ ] 11. Performance testing and optimization

  - [ ] 11.1 Measure middleware account-state call performance
    - Test middleware latency with account-state RPC calls
    - Measure impact on page load times
    - Target: <50ms overhead for protected route checks
    - _Requirements: 2.3_

  - [ ] 11.2 Optimize if needed
    - If performance issues detected, implement caching strategy
    - Cache account-state result for 5 minutes in session
    - Ensure cache invalidation on password set or sign-out
    - Only call account-state for protected routes, not public pages
    - _Requirements: 2.3_

  - [ ] 11.3 Validate database query optimization
    - Verify `get_account_state()` SQL function has proper indexes
    - Check query execution plan for performance bottlenecks
    - Ensure sub-10ms query execution time
    - _Requirements: 2.3_

- [ ] 12. Security validation

  - [ ] 12.1 Verify defense-in-depth enforcement
    - Confirm password_set checking at all four layers: middleware, AuthProvider, DashboardLayout, callback
    - Test that bypassing one layer still blocks access via others
    - Verify no client-side password_set manipulation possible
    - _Requirements: 2.2, 2.3, 2.4, 2.6_

  - [ ] 12.2 Validate service role client usage
    - Ensure all account-state lookups use service role client
    - Verify no public API endpoints expose password_set manipulation
    - Confirm reset RPC uses proper authorization
    - _Requirements: 2.3, 2.7, 2.8_

  - [ ] 12.3 Test security edge cases
    - Attempt to access dashboard with manually crafted session (password_set=false)
    - Try to bypass middleware with direct API calls
    - Verify account-state API is not publicly accessible
    - Test that sign-out fully clears session and prevents backdoor access
    - _Requirements: 2.2, 2.3, 2.4_

---

## Checkpoint

- [ ] 13. Final checkpoint - Ensure all tests pass
  - Verify all unit tests pass for all modified files
  - Verify all property-based tests pass with large input generation
  - Verify all 5 integration tests pass end-to-end
  - Verify performance benchmarks are acceptable
  - Verify security validation tests pass
  - Run full regression test suite for authentication system
  - Check for any console errors or warnings
  - Ensure no 401 errors in completed user flows
  - Ask user if any questions arise or issues are found
  - _Requirements: All requirements 1.1-1.10, 2.1-2.10, 3.1-3.15_

