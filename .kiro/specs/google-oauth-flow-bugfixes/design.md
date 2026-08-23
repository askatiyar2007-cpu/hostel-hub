# Google OAuth Flow Bugfixes Design

## Overview

This design covers two independent but related defects in the Google OAuth signup/login flow built on top of the `production-auth-email-otp` spec.

**Bug 1 (deployment gap)**: `app/auth/callback/route.ts` already contains the correct call to `supabaseServer.rpc('reset_incomplete_google_signup', { p_user_id })` for the abandoned-Google-signup-restart case. The SQL migration `supabase/migrations/20260827000000_reset_abandoned_google_signup_role.sql` that defines this function is present in the repository but has never been applied to the production Supabase project, so PostgREST's schema cache has no such function and every invocation fails with `PGRST202`. This is an **operational deployment gap**, not a code defect — the fix is to deploy the migration through the normal Supabase migration process, not to add a workaround in the callback route.

**Bug 2 (unwanted tab auto-switching)**: When the Google account state doesn't match the user's stated intent (no account on a login attempt, or a complete account on a signup attempt), two things currently force a tab switch the user did not ask for:
1. The callback redirects to a URL that explicitly sets `tab=signup` or `tab=login` (opposite of the tab the user started from).
2. `app/auth/login/page.tsx`'s `reason`-handling `useEffect` calls `router.replace('/auth/login?tab=...')`, which re-derives `activeTab` from the URL and visually flips the tab before the user acts.

The fix keeps the existing `reason` query values (`no-account`, `signin`) as the sole signal for which `AuthMessage` to show, removes the forced `tab=` override from the callback's redirect for these two branches, and changes the login page to preserve whatever tab the user is currently on, showing the message inline and deferring the tab switch to the message's explicit action button click.

## Glossary

- **Bug_Condition (C)**: The condition that triggers a bug — for Bug 1, an abandoned Google SIGNUP-intent attempt on an incomplete-but-role-selected account; for Bug 2, a Google OAuth attempt whose resulting `reason` (`no-account` or `signin`) doesn't match the tab the user was on.
- **Property (P)**: The desired behavior once the bug condition holds.
- **Preservation**: Existing behavior for inputs that do NOT satisfy the bug condition, which must remain byte-for-byte identical after the fix.
- **`reset_incomplete_google_signup(p_user_id)`**: SECURITY DEFINER RPC defined in `supabase/migrations/20260827000000_reset_abandoned_google_signup_role.sql`. Deletes the `user_roles` row and any dependent `students` row for a Google-authenticated user whose `profiles.password_set` is `false`. Never touches `auth.users` or `profiles`.
- **`intent`**: `'login' | 'signup'`, derived server-side in `app/auth/callback/route.ts` from a signed transaction (`verifyOAuthIntentTransaction`), reflecting which button (Sign In tab's or Sign Up tab's "Continue with Google") the user clicked.
- **`accountState.missing_step`**: One of `'profile' | 'role' | 'password' | 'student_onboarding'`, or `is_complete: true`, returned by the `get_account_state` RPC.
- **`reason`**: Existing callback query parameter (`no-account` | `signin`) that the login page already reads to decide which `AuthMessage` to display.
- **`activeTab`**: Client state in `app/auth/login/page.tsx` that controls which `TabsContent` (`login` | `signup`) is visible; today it is synchronized from the `tab` search param on every render via a `useEffect`.

## Bug Details

### Bug 1: Undeployed RPC Breaks Abandoned-Signup Restart

**Bug Condition:**

```
FUNCTION isBugCondition_Bug1(input)
  INPUT: input of type { intent: 'login' | 'signup', accountState: AccountState, rpcDeployed: boolean }
  OUTPUT: boolean

  RETURN input.intent = 'signup'
         AND input.accountState.is_complete = false
         AND input.accountState.missing_step IN ('password', 'student_onboarding')
         AND input.rpcDeployed = false
END FUNCTION
```

The callback code path that calls the RPC is already correct (see `app/auth/callback/route.ts`, the `intent === 'signup' && !accountState.is_complete && ...` branch). The bug condition is purely `rpcDeployed = false` in the target Supabase project's schema cache — the migration file exists locally but was never run against production.

**Examples:**
- User selects "Student" role via Google signup, closes the tab before setting a password. Days later, clicks "Continue with Google" again from the Sign Up tab. Expected: redirected to `/auth/select-role`. Actual (production, bug present): RPC call returns a `PGRST202` error, `resetError` is truthy, callback falls through to `genericLoginError` → `/auth/login?error=oauth`.
- Same scenario but intent is `login` (user clicks "Continue with Google" from the Sign In tab): the RPC branch is never reached (guarded by `intent === 'signup'`), so this case is unaffected by Bug 1 and already resumes at `/auth/setup-password` via the existing `onboardingDestinationForStep` fallback.

### Bug 2: Forced Tab Switching on Mismatched OAuth Intent

**Bug Condition:**

```
FUNCTION isBugCondition_Bug2(input)
  INPUT: input of type { startingTab: 'login' | 'signup', reason: 'no-account' | 'signin' | null }
  OUTPUT: boolean

  RETURN (input.startingTab = 'login' AND input.reason = 'no-account')
         OR (input.startingTab = 'signup' AND input.reason = 'signin')
END FUNCTION
```

This covers exactly the two "mismatch" redirects the callback already produces:
- `intent === 'login'` + `missing_step === 'profile'` (no account found) → `reason=no-account` (user started on Sign In tab).
- `intent === 'signup'` + `is_complete` (account already exists) → `reason=signin` (user started on Sign Up tab).

**Examples:**
- User on `/auth/login?tab=login`, clicks "Continue with Google" with an email that has no HostelHub account. Callback today redirects to `/auth/login?tab=signup&reason=no-account`. Login page's effect calls `router.replace('/auth/login?tab=signup')` and `setActiveTab('signup')` is implicitly forced by the tab-sync effect reading `tab=signup` from the URL. Result: user lands on Sign Up tab despite never asking to switch. Expected: user stays on Sign In tab, sees one `AuthMessage` ("Account not found" / "Create account" button); tab only changes if that button is clicked.
- User on `/auth/login?tab=signup`, clicks "Continue with Google" with an email that already has a complete account. Callback today redirects to `/auth/login?tab=login&reason=signin`. Same forced-switch problem, mirrored.
- Edge case (must remain unaffected): user manually clicks the "Sign Up" tab trigger with no OAuth involved — `handleTabChange` must continue to call `router.replace` and switch tabs immediately, since this is direct user action, not an OAuth mismatch redirect.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Login-intent resume-at-setup-password behavior for an incomplete-but-role-selected account (`intent === 'login'` on the same state Bug 1 concerns) must be untouched — this is the login/signup intent distinction that Bug 1's fix must not blur.
- A completed account attempting Google signup must continue to be rejected with `reason=signin` (only the forced tab switch changes, not the rejection itself).
- A nonexistent account attempting Google login must continue to be rejected with `reason=no-account` (only the forced tab switch changes, not the rejection itself).
- A fully complete account authenticating via Google (either intent) must continue to route straight to its dashboard.
- Manual tab-trigger clicks (`handleTabChange`, unrelated to OAuth `reason` redirects) must continue to update the `tab` query param and switch tabs immediately.
- OTP verification must remain a manual "Verify code" button click; no auto-submit on the 6th digit.
- The `googleRedirectInFlightRef` + `pageshow` Back-button fix must remain unmodified.
- `reset_incomplete_google_signup` must never delete `auth.users` or `profiles` rows, and must never run for an account with `password_set = true` or a non-Google identity (already enforced inside the SQL function itself; no change needed there).
- All other existing callback branches (`missing_step === 'profile'` under login intent, `missing_step` role/student_onboarding fallbacks, generic `error=oauth` on exchange failure) are unaffected.

**Scope:**
Bug 1's fix scope is entirely a deployment action (running the existing migration against the live Supabase project) plus verification that the RPC is now reachable — no application code changes. Bug 2's fix scope is limited to (a) the two callback redirects that currently force `tab=`, and (b) the login page's `reason`-handling effect and its interaction with tab state. No other routing branch, no OTP logic, and no `accountCompletionStep` logic in `lib/auth/context.tsx` should change.

## Hypothesized Root Cause

1. **Bug 1 — Missing deployment step**: The migration `20260827000000_reset_abandoned_google_signup_role.sql` was authored and committed as part of a prior task but the deployment step (`supabase db push` / applying it to the linked production project) was never executed, or was executed against a different project/environment than the one currently serving production traffic. PostgREST caches the schema and has no knowledge of a function that was never created in the actual database, hence `PGRST202`.

2. **Bug 2 — Callback hard-codes the destination tab**: `redirect(request, '/auth/login?tab=signup&reason=no-account')` and `redirect(request, '/auth/login?tab=login&reason=signin')` both explicitly set `tab=` to the *opposite* of the tab the user came from, assuming the UI should always jump to the "correct" tab for the account state. This assumption is what causes the unwanted auto-switch.

3. **Bug 2 — Login page re-derives and rewrites tab state on `reason`**: The `useEffect` that handles `reason === 'no-account'` / `reason === 'signin'` calls `setActiveTab(...)` implicitly by calling `router.replace('/auth/login?tab=...')`, which re-triggers the tab-sync effect (`const tab = searchParams.get('tab') === 'signup' ? 'signup' : 'login'; setActiveTab(tab);`). Even though the message's `action.onClick` also calls `setActiveTab`, the `router.replace` call happens unconditionally and immediately, before the user has clicked anything, so the visible tab flips regardless of the deferred `onClick` handler.

## Correctness Properties

Property 1: Bug Condition - Abandoned Google Signup Restarts at Role Selection

_For any_ Google SIGNUP-intent OAuth completion where the account is incomplete with `missing_step` of `password` or `student_onboarding` (i.e. a role was previously selected but password setup was never finished), once the `reset_incomplete_google_signup` RPC is deployed and reachable, the fixed flow SHALL clear the prior role assignment (and any dependent `students` row) and SHALL redirect the user to `/auth/select-role`, never resuming directly at `/auth/setup-password` for this SIGNUP-intent case.

**Validates: Requirements 2.1**

Property 2: Preservation - Login Intent Still Resumes at Setup Password

_For any_ OAuth completion where the account is incomplete with `missing_step` of `password` or `student_onboarding` but the intent is LOGIN (not SIGNUP), the fixed flow SHALL produce the same result as the original flow: redirect directly to `/auth/setup-password`, without invoking the reset RPC.

**Validates: Requirements 2.2, 3.1**

Property 3: Bug Condition - No Forced Tab Switch on OAuth Reason Mismatch

_For any_ Google OAuth completion that results in `reason=no-account` while the user was on the Sign In tab, or `reason=signin` while the user was on the Sign Up tab, the fixed flow SHALL keep the user on their starting tab, SHALL NOT change the `tab` query parameter as a side effect of the redirect or of rendering the message, and SHALL display exactly one `AuthMessage` whose action button, when clicked, is the only trigger that switches the tab.

**Validates: Requirements 2.3, 2.4**

Property 4: Preservation - Manual Tab Switching and Other OAuth Branches Unaffected

_For any_ input that is NOT one of the two `reason` mismatch cases above — including manual tab-trigger clicks, non-OAuth navigation to `/auth/login`, and all other existing callback branches (complete-account routing, generic `error=oauth`, `missing_step` role/profile/student_onboarding fallbacks) — the fixed code SHALL produce exactly the same behavior as the original code.

**Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Bug 1 — Deployment action (no application code change)

**File**: `supabase/migrations/20260827000000_reset_abandoned_google_signup_role.sql` (already correct, already committed)

**Changes Required**:
1. **Deploy the migration**: Run the project's standard Supabase migration deployment process (e.g. `supabase db push` or the CI/CD migration step used for this project) against the actual production Supabase project so `public.reset_incomplete_google_signup(p_user_id)` exists there.
2. **Verify schema cache reload**: Confirm PostgREST has picked up the new function (the migration already ends with `NOTIFY pgrst, 'reload schema';`; if the hosted Supabase project doesn't process that notification automatically, a manual "reload schema" from the Supabase dashboard or API restart may be required).
3. **No routing-logic workaround**: Explicitly do NOT add a fallback in `app/auth/callback/route.ts` that tries to emulate the RPC's effect in application code (e.g. deleting `user_roles`/`students` rows directly from the route handler) as a substitute for deploying the migration. The RPC's SECURITY DEFINER guards (Google-identity check, `password_set` check, advisory lock) are the single source of truth for this mutation's safety and must not be duplicated or bypassed.
4. **Post-deploy confirmation**: After deployment, manually reproduce the abandoned-signup scenario against production (or staging with the same migration applied) and confirm the redirect reaches `/auth/select-role` instead of `/auth/login?error=oauth`.

### Bug 2 — Callback redirect changes

**File**: `app/auth/callback/route.ts`

**Function**: `GET`

**Specific Changes**:
1. Change the login-intent-missing-account branch to redirect without forcing `tab=signup`:
   - Before: `redirect(request, '/auth/login?tab=signup&reason=no-account')`
   - After: `redirect(request, '/auth/login?reason=no-account')`
2. Change the signup-intent-already-complete branch to redirect without forcing `tab=login`:
   - Before: `redirect(request, '/auth/login?tab=login&reason=signin')`
   - After: `redirect(request, '/auth/login?reason=signin')`
3. Leave every other redirect in this file untouched, including the abandoned-signup-restart redirect to `/auth/select-role` (Bug 1) and all dashboard/onboarding-step redirects.

### Bug 2 — Login page changes

**File**: `app/auth/login/page.tsx`

**Function**: The `reason`-handling `useEffect` (currently calls `router.replace('/auth/login?tab=signup')` / `router.replace('/auth/login?tab=login')`)

**Specific Changes**:
1. Remove the `router.replace('/auth/login?tab=...')` calls from the `reason === 'no-account'` and `reason === 'signin'` branches. The tab must remain whatever it currently is (the tab the user was on when they clicked "Continue with Google").
2. Still clear the `reason` (and any transient OAuth query params) from the URL via `router.replace` so refreshing the page doesn't re-show the message, but do so WITHOUT including a `tab=` param that differs from `activeTab`'s current value — e.g. `router.replace(`/auth/login?tab=${activeTab}`)` (same tab) or, more robustly, `router.replace('/auth/login')` combined with reading `activeTab` from local state (not re-derived from the now-cleared search params) so the visible tab does not flicker.
3. Keep the `AuthMessage` construction exactly as today (same Title/Description/Action label text already implemented) — only the `action.onClick` handlers (`setActiveTab('signup')` / `setActiveTab('login')`) remain the sole way the tab changes for these two cases.
4. No change to the generic `error || reason` fallback branch, to `handleTabChange`, to the tab-sync effect's behavior for direct user tab clicks, or to any OTP/`accountCompletionStep` logic.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate each bug on unfixed code, then verify each fix works correctly and preserves existing behavior. Bug 1's "fix" is a deployment action, so its exploration/validation is done by directly exercising the RPC and the callback branch against a database that does/doesn't have the function, rather than by testing arbitrary inputs.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate each bug BEFORE implementing the fix (deployment for Bug 1, redirect/page changes for Bug 2). Confirm or refute the root cause analysis.

**Test Plan**:
- Bug 1: Call `reset_incomplete_google_signup` directly against a database snapshot without the migration applied and confirm it errors with "function does not exist" / `PGRST202`-equivalent; then confirm the callback's abandoned-signup branch falls through to `genericLoginError` when `resetError` is set.
- Bug 2: Simulate the callback redirect URLs directly (`/auth/login?tab=signup&reason=no-account` starting from a Sign In click, and `/auth/login?tab=login&reason=signin` starting from a Sign Up click) against current `app/auth/login/page.tsx` and observe `activeTab` after the effect runs.

**Test Cases**:
1. **RPC absence test (Bug 1)**: Invoke `reset_incomplete_google_signup` on a database without the migration applied; expect a "function not found" error (will fail/error on unfixed/undeployed state).
2. **Callback fallback test (Bug 1)**: With the RPC unreachable, hit the abandoned-signup callback branch and confirm it redirects to `/auth/login?error=oauth` instead of `/auth/select-role` (demonstrates the regression).
3. **Sign In → no-account tab flip test (Bug 2)**: Start with `activeTab = 'login'`, simulate arriving at `/auth/login?tab=signup&reason=no-account`; on unfixed code, expect `activeTab` to become `'signup'` (the bug).
4. **Sign Up → signin tab flip test (Bug 2)**: Start with `activeTab = 'signup'`, simulate arriving at `/auth/login?tab=login&reason=signin`; on unfixed code, expect `activeTab` to become `'login'` (the bug).

**Expected Counterexamples**:
- Bug 1: `resetError` truthy / RPC call rejected due to missing function in schema cache.
- Bug 2: `activeTab` changes value without any user click on the `AuthMessage` action button.

### Fix Checking

**Goal**: Verify that for all inputs where each bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition_Bug1(input) DO
  result := callbackHandler_fixed(input)   // with RPC deployed
  ASSERT result.redirectPath = '/auth/select-role'
  ASSERT result.userRolesRowCleared = true
  ASSERT result.studentsRowCleared = true (if previously existed)
END FOR

FOR ALL input WHERE isBugCondition_Bug2(input) DO
  result := loginPage_fixed(input)
  ASSERT result.activeTab = input.startingTab
  ASSERT result.authMessageShown = exactly one message matching input.reason
  ASSERT result.urlTabParam = input.startingTab OR absent
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where each bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition_Bug1(input) DO
  ASSERT callbackHandler_original(input) = callbackHandler_fixed(input)
END FOR

FOR ALL input WHERE NOT isBugCondition_Bug2(input) DO
  ASSERT loginPage_original(input) = loginPage_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking of Bug 2 because the input domain (starting tab × reason × error combinations) is small but combinatorial, and because it catches accidental coupling between the `reason` effect and unrelated tab-sync logic. Bug 1's preservation is narrower (login-intent branch must be untouched) and is adequately covered by targeted unit/integration tests against the callback route.

**Test Plan**: Observe behavior on UNFIXED code first for the login-intent resume-at-setup-password case (Bug 1) and for manual tab clicks / all non-mismatch `reason` values (Bug 2), then write tests capturing that observed behavior.

**Test Cases**:
1. **Login-intent resume preservation (Bug 1)**: Observe that `intent === 'login'` with `missing_step === 'password'` redirects to `/auth/setup-password` without calling the reset RPC on unfixed code; assert this is unchanged after the fix.
2. **Completed-account signup rejection preservation (Bug 2)**: Observe that `intent === 'signup'` + complete account still redirects with `reason=signin` (only the `tab=` param removal changes); assert the rejection itself and the `AuthMessage` content are unchanged.
3. **Manual tab click preservation (Bug 2)**: Observe that clicking the Sign Up tab trigger directly (no `reason` param involved) still calls `router.replace('/auth/login?tab=signup')` and updates `activeTab` immediately; assert this continues to work identically after the fix.
4. **OTP manual-submit preservation**: Observe that typing all 6 OTP digits does not call `submitVerificationCode` automatically; assert this is unchanged.
5. **Back-button fix preservation**: Observe that triggering a `pageshow` event with `persisted: true` while `googleRedirectInFlightRef.current` is `true` clears `loading`; assert this is unchanged.

### Unit Tests

- Callback route: abandoned-signup branch calls the RPC with the correct `p_user_id` and redirects to `/auth/select-role` on success (Bug 1, post-deployment).
- Callback route: login-intent branch on the same account state does not call the RPC and redirects to `/auth/setup-password` (Bug 1 preservation).
- Callback route: the two `reason` redirects no longer include a `tab=` query parameter (Bug 2).
- Login page: `reason=no-account` renders the "Account not found" `AuthMessage` without changing `activeTab`, and clicking "Create account" changes `activeTab` to `signup`.
- Login page: `reason=signin` renders the "Account already exists" `AuthMessage` without changing `activeTab`, and clicking "Sign in" changes `activeTab` to `login`.
- Login page: manual `handleTabChange` invocation still updates the URL and `activeTab` immediately.

### Property-Based Tests

- Generate random combinations of `(startingTab, reason)` pairs across the full domain (`login`/`signup` × `no-account`/`signin`/`null`/other) and assert: `activeTab` only changes for the two mismatch combinations, and only after the action button is clicked (never as an immediate side effect of the redirect).
- Generate random `AccountState` shapes (`missing_step`, `is_complete`, `user_id` presence) crossed with `intent` (`login`/`signup`) and assert the RPC is invoked if and only if `intent === 'signup' AND !is_complete AND missing_step IN ('password','student_onboarding')`.

### Integration Tests

- Full abandoned-signup-restart flow: select role via Google → abandon before password → "Continue with Google" from Sign Up tab again → land on `/auth/select-role` → select role again → proceed to `/auth/setup-password` (requires migration deployed in the test environment).
- Full no-account-on-login flow: Sign In tab → "Continue with Google" with unknown email → stay on Sign In tab with message shown → click "Create account" → Sign Up tab now active with the same message context cleared.
- Full complete-account-on-signup flow: Sign Up tab → "Continue with Google" with existing complete account's email → stay on Sign Up tab with message shown → click "Sign in" → Sign In tab now active.
