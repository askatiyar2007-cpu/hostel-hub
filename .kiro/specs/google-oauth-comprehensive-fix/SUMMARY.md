# TECHNICAL SPECIFICATION
## Comprehensive Google OAuth Signup/Onboarding Fix

**Status:** Inspection Complete - Awaiting Approval for Implementation  
**Date:** 2026-01-06

---

## EXECUTIVE SUMMARY

This specification defines the comprehensive fix for the Google OAuth authentication flow in HostelHub, addressing five critical architectural issues discovered during deep inspection:

1. **Session invalidation race condition** causing 401 errors after password setup
2. **Duplicate account-state logic** in database and client maintaining conflicting completion rules  
3. **Incomplete dashboard protection** allowing authenticated-but-incomplete users to reach protected routes
4. **Automatic tab switching** violating user intent during OAuth redirects
5. **Missing intent-aware onboarding restart** for abandoned Google signups

The root cause is that **Supabase Auth identity ≠ Complete Application Account**, but several parts of the system conflate the two.

---

## KEY FINDINGS FROM INSPECTION

### 1. OWNER COMPLETION REQUIREMENT

**Finding:** The `get_account_state()` function does NOT check for any owner-specific table. Once a hostel_owner has profile + role + password_set=true, they are considered complete.

**The `hostels` table exists** but is for business data (created when owner adds their first hostel), NOT for auth completion.

**Decision:** Do NOT invent an owners table requirement. Current behavior is correct.

### 2. THE 401 BUG ROOT CAUSE

**Current code (app/api/auth/onboarding/password/route.ts):**
```typescript
await supabaseServer.auth.admin.updateUserById(user.id, { password })
```

**Problem:** Admin API invalidates browser's session cookie. Next API call fails with 401.

**Fix:** Use session-based update:
```typescript
await sessionClient.auth.updateUser({ password })
```

This preserves the session atomically.

### 3. DUPLICATE COMPLETION LOGIC

**Two implementations exist:**
1. Database: `get_account_state()` SQL function (authoritative)
2. Client: `AuthProvider.refreshAuthState()` (reimplementation)

**Risk:** Divergence if only one is updated.

**Fix:** Client calls new `/api/auth/account-state` endpoint which wraps `get_account_state()`.

### 4. CALLBACK LOGIC IS CORRECT

OAuth callback in `app/auth/callback/route.ts` already:
- Distinguishes signup vs login intent ✅
- Calls `reset_incomplete_google_signup()` for abandoned signups ✅  
- Routes to appropriate onboarding step ✅

**No changes needed to callback.**

### 5. reset_incomplete_google_signup() IS SECURE

Function correctly:
- Only affects Google identities ✅
- Rejects if password_set=true ✅
- Never touches auth.users ✅
- Only deletes user_roles + students ✅

**No changes needed to reset function.**

---

## FILES TO MODIFY: 5

### 1. app/api/auth/onboarding/password/route.ts
**Purpose:** Fix 401 bug  
**Change:** Line ~45 - Replace admin API with session-based update

### 2. app/api/auth/account-state/route.ts (NEW)
**Purpose:** Single source of truth  
**Change:** Create endpoint that exposes get_account_state to authenticated users

### 3. lib/auth/context.tsx
**Purpose:** Eliminate duplicate logic  
**Change:** Lines ~45-85 - Call /api/auth/account-state instead of reimplementing

### 4. app/auth/login/page.tsx
**Purpose:** Fix tab switching  
**Change:** Lines ~190-220 - Remove router.replace from reason effect

### 5. components/dashboard-layout.tsx
**Purpose:** Documentation  
**Change:** Add comment explaining server-derived state (no behavior change)

---

## DATABASE MIGRATIONS: 0

All necessary functions already exist and are correct:
- get_account_state() ✅
- reset_incomplete_google_signup() ✅  
- complete_onboarding_* functions ✅

**No SQL changes needed.**

---

## TEST MATRIX (12 scenarios)

A. New Google signup → role → password → student → dashboard (401 fix validation)
B. Abandoned after role → return via signup → restart from role
C. Abandoned at password → return via signup → restart from role
D. Completed account → signup → "Account already exists" + no tab switch
E. Completed account → login → dashboard
F. Missing account → login → "Account not found" + no tab switch
G. Incomplete → signup → treated as new (not existing account)
H. Incomplete → direct dashboard URL → redirect to onboarding
I. Google password → student API (401 fix for Google)
J. Email/OTP password → student API (401 fix for email)
K. Owner flow (no student record required)
L. Reset function rejects completed accounts

---

Ready for implementation approval.
