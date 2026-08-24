# Bugfix Requirements Document

## Introduction

This bugfix addresses a critical business rule violation in the Google OAuth signup flow where incomplete signups (accounts with `password_set=false`) are incorrectly treated as complete HostelHub users. The core business rule states: **`password_set=false` means NOT a HostelHub user, regardless of whether profile or role data exists in the database.**

Currently, users who abandon the signup process (e.g., closing the tab at the password page) are incorrectly restored to the password setup page instead of the login page, and incomplete accounts can access role-based dashboards despite not having completed registration. This violates the fundamental state machine where only `password_set=true` grants user status and dashboard access.

## Bug Analysis

### Current Behavior (Defect)

#### Session Restoration Issues

1.1 WHEN a user abandons signup at the password page (closes tab with `password_set=false`) and reopens the website THEN the system restores them to `/auth/setup-password` instead of `/auth/login`

1.2 WHEN a user with `password_set=false` has an active session and visits the site THEN the system treats them as an authenticated user instead of treating them as a non-user

1.3 WHEN middleware or authentication guards check user state THEN the system only verifies session existence without checking `password_set` status

#### Dashboard Access Issues

1.4 WHEN a user with `password_set=false` attempts to access role-based dashboards THEN the system grants access based on role data instead of blocking access

1.5 WHEN a user selects a role during signup (e.g., "Student") but doesn't set a password THEN the system saves role data to the database and grants Student permissions prematurely

1.6 WHEN authentication checks determine dashboard access THEN the system uses role data presence instead of requiring `password_set=true`

#### Signup Retry Issues

1.7 WHEN a user with an incomplete signup (`password_set=false`) attempts to retry the signup process with the same Google identity THEN the system shows "Account already exists" error instead of allowing role re-selection

1.8 WHEN `reset_incomplete_google_signup()` is called for a retry THEN the system doesn't clear stale role data for `password_set=false` accounts

1.9 WHEN a user retries an incomplete signup THEN the system blocks the retry flow instead of clearing abandoned progress and redirecting to `/auth/select-role`

#### UI Display Issues

1.10 WHEN the password field is displayed on the setup-password page THEN the system shows mojibake characters (`â€¢â€¢â€¢â€¢`) instead of clean placeholder text

### Expected Behavior (Correct)

#### Session Restoration Fixes

2.1 WHEN a user abandons signup at the password page (closes tab with `password_set=false`) and reopens the website THEN the system SHALL redirect them to `/auth/login`

2.2 WHEN a user with `password_set=false` has an active session and visits the site THEN the system SHALL treat them as NOT a HostelHub user (no authenticated UI)

2.3 WHEN middleware or authentication guards check user state THEN the system SHALL verify both session existence AND `password_set=true` status

#### Dashboard Access Fixes

2.4 WHEN a user with `password_set=false` attempts to access role-based dashboards THEN the system SHALL block access and redirect to `/auth/login`

2.5 WHEN a user selects a role during signup (e.g., "Student") but doesn't set a password THEN the system SHALL save role data as onboarding progress but SHALL NOT grant any role permissions until `password_set=true`

2.6 WHEN authentication checks determine dashboard access THEN the system SHALL require `password_set=true` regardless of role data presence

#### Signup Retry Fixes

2.7 WHEN a user with an incomplete signup (`password_set=false`) attempts to retry the signup process with the same Google identity THEN the system SHALL clear abandoned progress and redirect to `/auth/select-role`

2.8 WHEN `reset_incomplete_google_signup()` is called for a retry THEN the system SHALL clear stale role data for `password_set=false` accounts

2.9 WHEN a user retries an incomplete signup with a different role selection THEN the system SHALL allow the new role selection

#### UI Display Fixes

2.10 WHEN the password field is displayed on the setup-password page THEN the system SHALL show clean placeholder text without mojibake characters

### Unchanged Behavior (Regression Prevention)

#### Session-Based Updates

3.1 WHEN a user sets their password through the API THEN the system SHALL CONTINUE TO use session-based updates to prevent 401 errors

3.2 WHEN a user switches between tabs during the password setup flow THEN the system SHALL CONTINUE TO maintain session state without 401 errors

#### Account State API

3.3 WHEN any component needs to check user completion status THEN the system SHALL CONTINUE TO use `/api/auth/account-state` as the single source of truth

3.4 WHEN the account-state API is called THEN the system SHALL CONTINUE TO return accurate `password_set` status from the database

#### Owner Completion Model

3.5 WHEN an Owner user completes signup THEN the system SHALL CONTINUE TO use the completion model with profile + role + `password_set` without requiring an owners table entry

3.6 WHEN an Owner user sets their password THEN the system SHALL CONTINUE TO set `password_set=true` and grant dashboard access

#### Completed Account Protection

3.7 WHEN a completed user (with `password_set=true`) attempts to create a new account with the same email THEN the system SHALL CONTINUE TO show "Account already exists" error

3.8 WHEN a completed user's account data is accessed THEN the system SHALL CONTINUE TO protect against reset or deletion operations

3.9 WHEN a completed user signs in THEN the system SHALL CONTINUE TO redirect to their role-specific dashboard

#### Email/OTP Signup Flow

3.10 WHEN a user signs up using email and OTP (non-Google flow) THEN the system SHALL CONTINUE TO function without any regressions

3.11 WHEN an email/OTP user completes the signup process THEN the system SHALL CONTINUE TO set `password_set=true` and grant access

3.12 WHEN an email/OTP user abandons signup THEN the system SHALL CONTINUE TO handle incomplete state correctly

#### Google OAuth Completed Flow

3.13 WHEN a Google OAuth user completes the entire signup flow (profile + role + password) THEN the system SHALL CONTINUE TO function without 401 errors

3.14 WHEN a completed Google OAuth Student user accesses their dashboard THEN the system SHALL CONTINUE TO grant appropriate Student permissions

3.15 WHEN a completed user accesses any authenticated endpoint THEN the system SHALL CONTINUE TO validate their session and `password_set` status correctly
