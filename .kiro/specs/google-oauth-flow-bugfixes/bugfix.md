# Bugfix Requirements Document

## Introduction

This bugfix covers two related defects in the Google OAuth signup/login flow that sits on top of the already-implemented `production-auth-email-otp` spec (see `app/auth/callback/route.ts`, `app/auth/login/page.tsx`, `components/auth-message.tsx`, `lib/auth/context.tsx`).

**Bug 1** — An abandoned Google signup (role selected, password never set) does not restart at role selection on a fresh "Continue with Google" signup attempt. The callback route already calls the `reset_incomplete_google_signup(p_user_id)` RPC for this case, but the migration that creates this function (`supabase/migrations/20260827000000_reset_abandoned_google_signup_role.sql`) has never been deployed to the live Supabase project, so the RPC call fails in production with `PGRST202: Could not find the function public.reset_incomplete_google_signup(p_user_id) in the schema cache`.

**Bug 2** — When a Google OAuth attempt doesn't match the account state (no account found on a Sign In attempt, or a complete account found on a Sign Up attempt), the login page currently force-switches the visible tab (Sign In ↔ Sign Up) and rewrites the `tab` query parameter automatically. This happens both because the callback redirect itself sets `tab=`, and because `app/auth/login/page.tsx` additionally calls `router.replace('/auth/login?tab=...')` in its `reason` handling effect, which changes `activeTab` before the user has taken any action. The desired behavior is to stay on the tab the user was already on, show exactly one inline `AuthMessage`, and only switch tabs when the user explicitly clicks the message's action button.

Both bugs affect only the Google OAuth callback branching and the login page's OAuth-result handling. They do not affect the email/OTP signup flow, manual OTP verification (no auto-submit), or the existing Back-button fix (`googleRedirectInFlightRef` + `pageshow` listener).

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user completed Google Sign Up, selected a role, but left before setting a password, and later clicks "Continue with Google" again from the Sign Up tab intending to restart signup THEN the system calls the undeployed `reset_incomplete_google_signup` RPC, which does not exist in the production schema cache (`PGRST202`), causing the RPC call to fail and the callback to fall through to a generic error redirect (`/auth/login?error=oauth`) instead of restarting the signup at role selection.

1.2 WHEN a user on `/auth/login?tab=login` (Sign In tab) clicks "Continue with Google" using a Google account that has no HostelHub account THEN the system signs the user out, redirects to `/auth/login?tab=signup&reason=no-account`, and the login page immediately calls `router.replace('/auth/login?tab=signup')`, which forces `activeTab` to `signup` and visually switches the user to the Sign Up tab before the user has clicked anything.

1.3 WHEN a user on `/auth/login?tab=signup` (Sign Up tab) clicks "Continue with Google" using a Google account that already has a COMPLETE HostelHub account THEN the system signs the user out, redirects to `/auth/login?tab=login&reason=signin`, and the login page immediately calls `router.replace('/auth/login?tab=login')`, which forces `activeTab` to `login` and visually switches the user to the Sign In tab before the user has clicked anything.

### Expected Behavior (Correct)

2.1 WHEN a user with an abandoned Google signup (role selected, password not yet set) clicks "Continue with Google" again with SIGNUP intent THEN the system SHALL successfully invoke the deployed `reset_incomplete_google_signup(p_user_id)` RPC, clearing only the prior role assignment (`user_roles` row) and any dependent `students` row for that profile, and SHALL redirect the user to `/auth/select-role` so the user must choose a role again before reaching `/auth/setup-password`.

2.2 WHEN the same abandoned-signup account state (role selected, password not set) is encountered under a LOGIN intent rather than a SIGNUP intent THEN the system SHALL NOT invoke the reset RPC and SHALL continue to resume the user directly at `/auth/setup-password`, preserving the existing intent-based branching that distinguishes login intent from signup intent on identical underlying account state.

2.3 WHEN a user on the Sign In tab clicks "Continue with Google" and the Google account has no matching HostelHub account THEN the system SHALL keep the user on the Sign In tab, SHALL NOT rewrite the `tab` query parameter away from `login`, and SHALL show exactly one inline `AuthMessage` with Title "Account not found", Description "No HostelHub account exists with this Google email. Please create an account first.", and Action button "Create account". The system SHALL switch the visible tab to Sign Up only when the user explicitly clicks "Create account".

2.4 WHEN a user on the Sign Up tab clicks "Continue with Google" and the Google account already has a complete HostelHub account THEN the system SHALL keep the user on the Sign Up tab, SHALL NOT rewrite the `tab` query parameter away from `signup`, and SHALL show exactly one inline `AuthMessage` with Title "Account already exists", Description "An account with this Google email already exists. Please sign in instead.", and Action button "Sign in". The system SHALL switch the visible tab to Sign In only when the user explicitly clicks "Sign in".

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user's Google signup is already complete (role selected AND password set, and a `students` row exists if role is `student`) and the user attempts SIGNUP again THEN the system SHALL CONTINUE TO reject the signup attempt, sign the user out, and redirect with `reason=signin`, without deleting any data.

3.2 WHEN a LOGIN intent is used and no HostelHub account exists for that Google email THEN the system SHALL CONTINUE TO sign the user out and redirect with `reason=no-account`.

3.3 WHEN a user's account is fully complete and they authenticate with Google (login or signup intent as applicable) THEN the system SHALL CONTINUE TO route directly to that role's dashboard without extra prompts.

3.4 WHEN a user is on the OTP verify-code screen during email/password signup THEN the system SHALL CONTINUE TO require an explicit "Verify code" button click; entering all 6 digits SHALL CONTINUE TO NOT auto-submit the code.

3.5 WHEN a user clicks "Continue with Google" and then presses the browser Back button before the OAuth redirect completes THEN the system SHALL CONTINUE TO clear the loading state via the existing `googleRedirectInFlightRef` + `pageshow` listener behavior, unchanged.

3.6 The `reset_incomplete_google_signup` RPC SHALL CONTINUE TO NEVER delete rows from `auth.users` or `profiles`, and SHALL CONTINUE TO NEVER create duplicate identities, regardless of how many times it is invoked.

3.7 WHEN a user manually clicks the Sign In / Sign Up tab triggers directly (not as a result of an OAuth `reason` redirect) THEN the system SHALL CONTINUE TO update the `tab` query parameter and switch tabs immediately, exactly as it does today.

3.8 WHEN the callback encounters any other existing account-state branch not described above (e.g. missing `profile` step, `student_onboarding` step, generic exchange/auth errors) THEN the system SHALL CONTINUE TO behave exactly as it does today.
