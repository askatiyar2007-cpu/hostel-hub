# Bugfix Requirements Document

## Introduction

This bugfix addresses a critical production issue where Google OAuth users with abandoned signups cannot recover or complete onboarding due to missing profile records. The root cause is a missing `on_auth_user_created` database trigger in production, which should automatically create profile records during signup. This affects users who have `auth.users` entries but no corresponding `public.profiles` or `public.user_roles` records, making the existing `reset_incomplete_google_signup()` function unable to recover these accounts.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user has an `auth.users` row with Google provider metadata but no corresponding `public.profiles` row THEN the `reset_incomplete_google_signup()` function returns `{success:false, reason:'profile_not_found'}` without creating the missing profile

1.2 WHEN the `on_auth_user_created` trigger is missing from the production database THEN new Google OAuth signups do not automatically create `public.profiles` or `public.user_roles` records

1.3 WHEN a user attempts to access onboarding APIs with a missing profile THEN all onboarding operations fail because they require a profile to exist

1.4 WHEN a user navigates to `/auth/select-role` with a missing profile THEN they encounter a dead-end and cannot proceed with account setup

### Expected Behavior (Correct)

2.1 WHEN a user has an `auth.users` row with Google provider metadata but no corresponding `public.profiles` row THEN the `reset_incomplete_google_signup()` function SHALL create a minimal profile record and allow the reset to proceed

2.2 WHEN the `on_auth_user_created` trigger is properly registered in the database THEN new Google OAuth signups SHALL automatically create both `public.profiles` and `public.user_roles` records

2.3 WHEN a user with a newly recovered profile attempts to access onboarding APIs THEN all onboarding operations SHALL succeed and allow account completion

2.4 WHEN a user with a recovered profile navigates to `/auth/select-role` THEN they SHALL be able to select a role and complete onboarding

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user has `password_set=TRUE` in their profile THEN the `reset_incomplete_google_signup()` function SHALL CONTINUE TO reject the reset (completed accounts are protected)

3.2 WHEN a user attempts to reset a non-Google provider account THEN the `reset_incomplete_google_signup()` function SHALL CONTINUE TO validate that the user has Google provider credentials

3.3 WHEN the reset operation encounters an error condition THEN the function SHALL CONTINUE TO fail safely without continuing with stale data

3.4 WHEN authorization checks are performed during reset or profile operations THEN the system SHALL CONTINUE TO enforce all existing authorization rules without weakening security

3.5 WHEN a user completes a normal Google OAuth signup with the trigger present THEN the system SHALL CONTINUE TO create profile and role records automatically as designed
