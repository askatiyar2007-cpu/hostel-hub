# ACCOUNT STATE MODEL & FLOW DIAGRAMS
## Google OAuth Comprehensive Fix

---

## CANONICAL ACCOUNT STATES

### State Progression

```
STATE 1: identity
├─ auth.users EXISTS
├─ profiles: NONE
├─ user_roles: NONE
├─ password_set: N/A
└─ Status: INCOMPLETE

STATE 2: profile  
├─ auth.users EXISTS
├─ profiles EXISTS
├─ user_roles: NONE
├─ password_set: FALSE
└─ Status: INCOMPLETE

STATE 3: role
├─ auth.users EXISTS
├─ profiles EXISTS  
├─ user_roles: 0 or >1 or mismatch
├─ password_set: FALSE
└─ Status: INCOMPLETE

STATE 4: password
├─ auth.users EXISTS
├─ profiles EXISTS
├─ user_roles: 1 matching
├─ password_set: FALSE
└─ Status: INCOMPLETE

STATE 5: student_onboarding (only for role=student)
├─ auth.users EXISTS
├─ profiles EXISTS
├─ user_roles: 1 matching (role=student)
├─ password_set: TRUE
├─ students: NOT EXISTS
└─ Status: INCOMPLETE

STATE 6: complete
├─ auth.users EXISTS
├─ profiles EXISTS
├─ user_roles: 1 matching
├─ password_set: TRUE
├─ students EXISTS (if role=student)
└─ Status: COMPLETE ✅
```

---

## GOOGLE SIGNUP FLOW

```
┌──────────────────────────────────────────────┐
│ User clicks "Create Account" → Google button │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │ POST                │
         │ /api/auth/          │
         │  oauth-intent       │
         │ intent='signup'     │
         └──────┬──────────────┘
                │
                ├─→ Creates signed transaction
                ├─→ Sets HttpOnly cookie
                └─→ Returns redirectTo URL
                   │
                   ▼
         ┌─────────────────────┐
         │ Google OAuth        │
         │ User selects        │
         │ Google account      │
         └──────┬──────────────┘
                │
                ▼
         ┌──────────────────────────────────┐
         │ GET /auth/callback?transaction=  │
         │                                  │
         │ 1. Verify signed transaction     │
         │ 2. Verify HttpOnly cookie        │
         │ 3. Exchange code for session     │
         │ 4. Call get_account_state()      │
         └──────┬───────────────────────────┘
                │
                ▼
    ┌───────────────────────────────────────┐
    │ Branch on (intent, account_state)     │
    └───────────┬───────────────────────────┘
                │
      ┌─────────┴─────────┐
      │                   │
      ▼                   ▼
┌──────────────┐    ┌──────────────────┐
│ is_complete? │    │ missing_step?    │
└──┬───────────┘    └──┬───────────────┘
   │                   │
   │ YES               │
   │                   ├─→ identity: impossible (no auth.users)
   ▼                   │
Sign out               ├─→ profile: /auth/select-role
→ /auth/login         │
  ?reason=signin      ├─→ role: /auth/select-role
   │                   │
   │                   ├─→ password: 
   │                   │   ├─→ reset_incomplete_google_signup()
   │                   │   └─→ /auth/select-role
   │                   │
   │                   └─→ student_onboarding:
   │                       ├─→ reset_incomplete_google_signup()
   │                       └─→ /auth/select-role
   │
   ▼
User sees "Account already exists"
Stays on Create Account tab
Clicks "Sign in instead" → switches to Sign In tab
```

---

## GOOGLE LOGIN FLOW

```
┌─────────────────────────────────────────┐
│ User clicks "Sign In" → Google button   │
└──────────────────┬──────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │ POST                │
         │ /api/auth/          │
         │  oauth-intent       │
         │ intent='login'      │
         └──────┬──────────────┘
                │
                ├─→ Creates signed transaction
                ├─→ Sets HttpOnly cookie
                └─→ Returns redirectTo URL
                   │
                   ▼
         ┌─────────────────────┐
         │ Google OAuth        │
         │ User selects        │
         │ Google account      │
         └──────┬──────────────┘
                │
                ▼
         ┌──────────────────────────────────┐
         │ GET /auth/callback?transaction=  │
         │                                  │
         │ 1. Verify signed transaction     │
         │ 2. Verify HttpOnly cookie        │
         │ 3. Exchange code for session     │
         │ 4. Call get_account_state()      │
         └──────┬───────────────────────────┘
                │
                ▼
    ┌───────────────────────────────────────┐
    │ Branch on (intent, account_state)     │
    └───────────┬───────────────────────────┘
                │
      ┌─────────┴─────────┐
      │                   │
      ▼                   ▼
┌──────────────┐    ┌──────────────────┐
│ is_complete? │    │ missing_step?    │
└──┬───────────┘    └──┬───────────────┘
   │                   │
   │ YES               │
   ▼                   ├─→ profile: 
Dashboard              │   ├─→ Sign out
                       │   └─→ /auth/login?reason=no-account
                       │
                       ├─→ role: /auth/select-role (RESUME)
                       │
                       ├─→ password: /auth/setup-password (RESUME)
                       │   (NO reset — user can continue)
                       │
                       └─→ student_onboarding: 
                           /auth/setup-password (RESUME)
```

---

## ABANDONED SIGNUP RESTART FLOW

```
DAY 1:
User → Create Account → Google → Select Student → Close tab

   auth.users: EXISTS
   profiles: EXISTS (role='student')
   user_roles: EXISTS (role='student')
   password_set: FALSE
   students: NOT EXISTS

DAY 2:
User → Create Account → Google (same identity)

         ┌──────────────────────────────────┐
         │ OAuth callback                   │
         │ intent='signup'                  │
         │ missing_step='password'          │
         └──────┬───────────────────────────┘
                │
                ▼
         ┌──────────────────────────────────┐
         │ reset_incomplete_google_signup() │
         │                                  │
         │ ✓ Checks: provider='google'      │
         │ ✓ Checks: password_set=false     │
         │                                  │
         │ DELETE FROM user_roles           │
         │  WHERE user_id = p_user_id       │
         │                                  │
         │ DELETE FROM students             │
         │  WHERE profile_id = v_profile.id │
         │                                  │
         │ PRESERVES:                       │
         │  - auth.users                    │
         │  - profiles                      │
         └──────┬───────────────────────────┘
                │
                ▼
         Redirect /auth/select-role

   auth.users: EXISTS (preserved)
   profiles: EXISTS (preserved)
   user_roles: NONE (cleared)
   password_set: FALSE (unchanged)
   students: NONE (cleared)

User selects role again → password → student onboarding → complete
```

---

## DIRECT DASHBOARD ACCESS FLOW

```
User: profile + role + password_set=false (STATE 4)
Action: Types /student/dashboard in browser

         ┌──────────────────────┐
         │ middleware.ts        │
         │                      │
         │ auth.user exists?    │
         │ YES → allow through  │
         └──────┬───────────────┘
                │
                ▼
         ┌──────────────────────┐
         │ /student/dashboard   │
         │ page renders         │
         │ (server component)   │
         └──────┬───────────────┘
                │
                ▼
         ┌──────────────────────────────────┐
         │ DashboardLayout                  │
         │ (client component)               │
         │                                  │
         │ AuthProvider.refreshAuthState()  │
         └──────┬───────────────────────────┘
                │
                ▼
         ┌──────────────────────────────────┐
         │ GET /api/auth/account-state      │
         │                                  │
         │ → Calls get_account_state()      │
         │ → Returns:                       │
         │   {                              │
         │     missing_step: 'password',    │
         │     is_complete: false           │
         │   }                              │
         └──────┬───────────────────────────┘
                │
                ▼
         setAccountCompletionStep('password')
                │
                ▼
         ┌──────────────────────────────────┐
         │ DashboardLayout useEffect        │
         │                                  │
         │ if (accountCompletionStep ===    │
         │     'password')                  │
         │   router.push(                   │
         │     '/auth/setup-password'       │
         │   )                              │
         └──────┬───────────────────────────┘
                │
                ▼
         User completes password setup
                │
                ▼
         Redirects back to /student/dashboard
                │
                ▼
         Dashboard renders ✅
```

---

## SESSION PRESERVATION FLOW (401 FIX)

### BEFORE (Broken):

```
POST /api/auth/onboarding/password
  │
  ├─→ sessionClient.auth.getUser() ✅
  │   (reads cookie, validates session)
  │
  ├─→ supabaseServer.auth.admin.updateUserById()
  │   (admin API)
  │   │
  │   └─→ Supabase invalidates ALL sessions ❌
  │       (security feature: password change = session reset)
  │
  └─→ Returns 200

Browser cookie is now STALE ❌

POST /api/auth/onboarding/student
  │
  ├─→ sessionClient.auth.getUser()
  │   (reads cookie)
  │   │
  │   └─→ Session validation FAILS ❌
  │
  └─→ Returns 401 ❌
```

### AFTER (Fixed):

```
POST /api/auth/onboarding/password
  │
  ├─→ sessionClient.auth.getUser() ✅
  │   (reads cookie, validates session)
  │
  ├─→ sessionClient.auth.updateUser({ password }) ✅
  │   (session-based API)
  │   │
  │   ├─→ Supabase updates password
  │   └─→ Supabase refreshes session atomically ✅
  │       (new session token generated)
  │
  ├─→ SSR cookie middleware writes NEW cookie ✅
  │   (via createClient's cookie.setAll)
  │
  └─→ Returns 200 with Set-Cookie header

Browser receives FRESH cookie ✅

POST /api/auth/onboarding/student
  │
  ├─→ sessionClient.auth.getUser() ✅
  │   (reads fresh cookie)
  │   │
  │   └─→ Session validation SUCCESS ✅
  │
  ├─→ complete_onboarding_student() ✅
  │
  └─→ Returns 200 ✅
```

---

END OF FLOW DIAGRAMS
