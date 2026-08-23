# Implementation Plan

## Overview

This plan fixes two independent defects in the Google OAuth signup/login flow: Bug 1, an undeployed database migration that leaves the abandoned-signup-restart RPC unreachable in production, and Bug 2, unwanted forced tab switching on the login page when an OAuth attempt's resulting `reason` doesn't match the tab the user started from.

## Tasks

- [x] 1. Write bug condition exploration test for Bug 1 (undeployed RPC breaks abandoned-signup restart)
  - **Property 1: Bug Condition** - Abandoned Google Signup Restarts at Role Selection
  - **CRITICAL**: This test MUST FAIL on unfixed/undeployed state - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Surface the counterexample that demonstrates the RPC is unreachable and the callback falls back to a generic error instead of restarting signup
  - **Scoped approach**: This is a deterministic deployment-gap bug, not a random-input bug. Scope to the concrete case: `intent = 'signup'`, `accountState.missing_step IN ('password', 'student_onboarding')`, `accountState.is_complete = false`, against a database where `reset_incomplete_google_signup` does not exist
  - Test that calling `reset_incomplete_google_signup(p_user_id)` against a database snapshot without migration `20260827000000_reset_abandoned_google_signup_role.sql` applied returns a "function does not exist" / PGRST202-equivalent error (from Bug Condition in design)
  - Test that `app/auth/callback/route.ts`'s abandoned-signup branch, when the RPC call errors, redirects to `/auth/login?error=oauth` rather than `/auth/select-role`
  - Run test against the current (undeployed-migration) state
  - **EXPECTED OUTCOME**: Test FAILS / demonstrates the fallback-to-generic-error behavior (this is correct - it proves the bug exists)
  - Document the counterexample found (e.g. "reset_incomplete_google_signup raised PGRST202; callback redirected to /auth/login?error=oauth instead of /auth/select-role")
  - Mark task complete when test is written, run, and failure/counterexample is documented
  - _Requirements: 1.1_

- [ ] 2. Write bug condition exploration test for Bug 2 (forced tab auto-switch on OAuth reason mismatch)
  - **Property 3: Bug Condition** - No Forced Tab Switch on OAuth Reason Mismatch
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Surface counterexamples that demonstrate the login page and/or callback force a tab switch without user action
  - **Scoped PBT approach**: Scope the property to the two concrete mismatch cases: `(startingTab='login', reason='no-account')` and `(startingTab='signup', reason='signin')`
  - Test that starting with `activeTab='login'` and navigating to `/auth/login?tab=signup&reason=no-account` (the current callback redirect) results in `activeTab` becoming `'signup'` on unfixed code, with no click on the `AuthMessage` action button (from Bug Condition in design, `isBugCondition_Bug2`)
  - Test that starting with `activeTab='signup'` and navigating to `/auth/login?tab=login&reason=signin` (the current callback redirect) results in `activeTab` becoming `'login'` on unfixed code, with no click on the `AuthMessage` action button
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL to preserve the starting tab (this is correct - it proves the bug exists)
  - Document counterexamples found (e.g. "activeTab changed from 'login' to 'signup' purely from the redirect/effect, before any user click")
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.2, 1.3_

- [x] 3. Write preservation property tests for Bug 1 (BEFORE deploying migration / touching callback code)
  - **Property 2: Preservation** - Login Intent Still Resumes at Setup Password
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: on current code, `intent='login'` with `accountState.missing_step IN ('password','student_onboarding')` does NOT call `reset_incomplete_google_signup` and redirects to `/auth/setup-password`
  - Observe: on current code, a completed account (`is_complete=true`) attempting SIGNUP intent still redirects with `reason=signin` (rejection behavior, independent of the `tab=` param issue)
  - Write property-based test: for all `(intent, accountState)` combinations where NOT (`intent='signup' AND !is_complete AND missing_step IN ('password','student_onboarding')`), the RPC is never invoked and the redirect destination matches current behavior (from Preservation Requirements in design)
  - Verify tests pass on current/unfixed code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 2.2, 3.1_

- [ ] 4. Write preservation property tests for Bug 2 (BEFORE implementing the redirect/page fix)
  - **Property 4: Preservation** - Manual Tab Switching and Other OAuth Branches Unaffected
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: on current code, clicking the Sign Up/Sign In tab trigger directly (`handleTabChange`, no `reason` param) updates the URL's `tab=` param and `activeTab` immediately
  - Observe: on current code, navigating to `/auth/login` with no `reason` and no `error` leaves `activeTab` derived purely from the `tab` param with no `AuthMessage` shown
  - Observe: on current code, typing all 6 OTP digits does not call `submitVerificationCode` (manual "Verify code" click required)
  - Observe: on current code, a `pageshow` event with `persisted: true` while `googleRedirectInFlightRef.current` is `true` clears `loading`
  - Write property-based test: for all `(startingTab, reason)` pairs NOT equal to `(login, no-account)` or `(signup, signin)`, `activeTab` and message-display behavior match current observed output (from Preservation Requirements in design)
  - Verify tests pass on current/unfixed code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 5. Fix for Bug 1: deploy the missing RPC migration (operational, no application code change)

  - [ ] 5.1 Deploy `supabase/migrations/20260827000000_reset_abandoned_google_signup_role.sql` to the production Supabase project
    - Run the project's standard migration deployment process (e.g. `supabase db push` or the existing CI/CD migration step) against the actual production project, not a different/staging project
    - Confirm the migration's `NOTIFY pgrst, 'reload schema';` takes effect, or manually trigger a PostgREST schema reload if the hosted project doesn't auto-apply it
    - Explicitly do NOT add any fallback/workaround in `app/auth/callback/route.ts` that duplicates the RPC's logic in application code -- the RPC's SECURITY DEFINER guards remain the single source of truth
    - _Bug_Condition: isBugCondition_Bug1(input) from design_
    - _Expected_Behavior: expectedBehavior for Property 1 in design_
    - _Preservation: Preservation Requirements (login-intent branch, RPC's own guards) from design_
    - _Requirements: 2.1, 3.6_

  - [ ] 5.2 Verify bug condition exploration test for Bug 1 now passes
    - **Property 1: Expected Behavior** - Abandoned Google Signup Restarts at Role Selection
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - Confirm `reset_incomplete_google_signup` is now reachable (no PGRST202) and the callback's abandoned-signup branch redirects to `/auth/select-role`
    - **EXPECTED OUTCOME**: Test PASSES (confirms the deployment gap is closed)
    - _Requirements: 2.1_

  - [ ] 5.3 Verify preservation tests for Bug 1 still pass
    - **Property 2: Preservation** - Login Intent Still Resumes at Setup Password
    - **IMPORTANT**: Re-run the SAME tests from task 3 - do NOT write new tests
    - Confirm the login-intent resume-at-setup-password branch and the completed-account signup rejection are unchanged
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions from the deployment)

- [ ] 6. Fix for Bug 2: stop forcing tab switches on OAuth reason mismatch

  - [ ] 6.1 Update `app/auth/callback/route.ts` redirects to stop forcing `tab=`
    - Change the login-intent-missing-account redirect from `/auth/login?tab=signup&reason=no-account` to `/auth/login?reason=no-account`
    - Change the signup-intent-already-complete redirect from `/auth/login?tab=login&reason=signin` to `/auth/login?reason=signin`
    - Leave every other redirect in the file (including the Bug 1 `/auth/select-role` redirect and all dashboard/onboarding redirects) unchanged
    - _Bug_Condition: isBugCondition_Bug2(input) from design_
    - _Expected_Behavior: expectedBehavior for Property 3 in design_
    - _Requirements: 2.3, 2.4_

  - [ ] 6.2 Update `app/auth/login/page.tsx` to preserve the starting tab on `reason` redirects
    - Remove the `router.replace('/auth/login?tab=signup')` call from the `reason === 'no-account'` branch and the `router.replace('/auth/login?tab=login')` call from the `reason === 'signin'` branch
    - Clear the `reason` query param from the URL (so a page refresh doesn't re-show the message) without introducing a `tab=` value that differs from the current `activeTab`
    - Keep the existing `AuthMessage` Title/Description/Action text and the `action.onClick` handlers (`setActiveTab('signup')` / `setActiveTab('login')`) as the only way these two cases change the visible tab
    - Do not modify the generic `error || reason` fallback branch, `handleTabChange`, the tab-sync effect for direct user tab clicks, OTP logic, or `accountCompletionStep` logic
    - _Bug_Condition: isBugCondition_Bug2(input) from design_
    - _Expected_Behavior: expectedBehavior for Property 3 in design_
    - _Preservation: Preservation Requirements (manual tab switching, other reason/error handling) from design_
    - _Requirements: 2.3, 2.4, 3.2, 3.3, 3.7_

  - [ ] 6.3 Verify bug condition exploration test for Bug 2 now passes
    - **Property 3: Expected Behavior** - No Forced Tab Switch on OAuth Reason Mismatch
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Confirm `activeTab` no longer changes on either mismatch redirect until the `AuthMessage` action button is clicked
    - **EXPECTED OUTCOME**: Tests PASS (confirms the auto-switch bug is fixed)
    - _Requirements: 2.3, 2.4_

  - [ ] 6.4 Verify preservation tests for Bug 2 still pass
    - **Property 4: Preservation** - Manual Tab Switching and Other OAuth Branches Unaffected
    - **IMPORTANT**: Re-run the SAME tests from task 4 - do NOT write new tests
    - Confirm manual tab clicks, non-mismatch `reason`/`error` handling, OTP manual-submit behavior, and the Back-button fix are all unchanged
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all exploration, preservation, unit, property-based, and integration tests from the design's Testing Strategy pass together
  - Confirm Bug 1: abandoned Google signup restarts at `/auth/select-role`; login intent on the same state still resumes at `/auth/setup-password`
  - Confirm Bug 2: Sign In tab stays on Sign In with "Account not found" message until "Create account" is clicked; Sign Up tab stays on Sign Up with "Account already exists" message until "Sign in" is clicked
  - Ask the user if questions arise

## Notes

- Tasks 1 and 3 (Bug 1 exploration/preservation) and tasks 2 and 4 (Bug 2 exploration/preservation) must be written and run against the current, unfixed code first, per the exploration-before-fix and observation-first preservation methodology — do not implement either fix before these baselines are established.
- Task 5.1 is a production deployment action (running an already-committed migration against the live Supabase project and confirming the PostgREST schema reload), not an application code change. No fallback/workaround should be added to `app/auth/callback/route.ts` to compensate for the RPC being unreachable.
- Bug 1's fix and Bug 2's fix are independent and touch different files (Bug 1: deployment only; Bug 2: `app/auth/callback/route.ts` and `app/auth/login/page.tsx`), so their exploration/preservation/implementation tracks may proceed in parallel.
- Task 6.1 and 6.2 modify different files (`app/auth/callback/route.ts` vs `app/auth/login/page.tsx`) and can be done in parallel, but both must follow the Bug 2 exploration/preservation baseline (tasks 2 and 4).
- Task 7 is the final checkpoint and depends on both fixes (Bug 1 and Bug 2) being implemented and verified.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2", "3", "4"] },
    { "id": 1, "tasks": ["5.1", "6.1", "6.2"] },
    { "id": 2, "tasks": ["5.2", "5.3", "6.3"] },
    { "id": 3, "tasks": ["6.4"] },
    { "id": 4, "tasks": ["7"] }
  ]
}
```
