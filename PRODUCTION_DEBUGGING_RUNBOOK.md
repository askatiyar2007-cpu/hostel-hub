# Production Debugging Runbook
## Reset Function Failure - Step-by-Step Investigation

This runbook provides a systematic approach to diagnose and fix the `reset_incomplete_google_signup()` failure in production.

---

## 🎯 Goal

Determine why users retrying abandoned Google signups see "signup-retry-failed" error and cannot proceed.

---

## 📋 Prerequisites

Before starting, have access to:
- [ ] Supabase Dashboard (with SQL Editor access)
- [ ] Vercel Dashboard (to view deployment and logs)
- [ ] Local git repository
- [ ] Ability to reproduce the issue (or user report with timestamp)

---

## 🔍 Investigation Steps

### Step 1: Verify Migration Status (5 minutes)

**Objective:** Confirm if the fix was applied to production database

1. Open Supabase Dashboard → SQL Editor
2. Run Query 1 from `VERIFY_MIGRATION_QUERIES.sql`:

```sql
SELECT version, name, executed_at
FROM supabase_migrations.schema_migrations
WHERE version = '20260828000000';
```

**Decision Tree:**

```
Query returns 1 row?
├─ YES → Migration WAS applied
│         Go to Step 2
│
└─ NO  → Migration NOT applied ❌
          STOP HERE and go to "Fix 1: Apply Migration"
```

---

### Step 2: Verify Function Logic (5 minutes)

**Objective:** Confirm the live function uses OR logic (not AND)

1. Run Query 3 from `VERIFY_MIGRATION_QUERIES.sql`:

```sql
SELECT 
    p.proname AS function_name,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%OR COALESCE((v_app_metadata->''providers'') ? ''google''%' 
        THEN '✓ FIXED - Uses OR logic'
        WHEN pg_get_functiondef(p.oid) LIKE '%AND COALESCE((v_app_metadata->''providers'') ? ''google''%' 
        THEN '✗ BROKEN - Uses AND logic'
        ELSE '? UNKNOWN - Check function source'
    END AS provider_check_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'reset_incomplete_google_signup';
```

**Decision Tree:**

```
Result = "✓ FIXED - Uses OR logic"?
├─ YES → Function logic is correct
│         Go to Step 3
│
├─ NO (✗ BROKEN) → Function still uses AND logic ❌
│                   STOP HERE and go to "Fix 1: Apply Migration"
│
└─ ? UNKNOWN → Function might be missing or malformed ❌
                STOP HERE and go to "Fix 2: Rebuild Function"
```

---

### Step 3: Verify Code Deployment (3 minutes)

**Objective:** Confirm diagnostic logging code is deployed to Vercel

1. Go to Vercel Dashboard → Your Project
2. Click on latest deployment
3. Note the Git commit hash
4. In local repo, run:

```bash
git show <commit-hash>:app/auth/callback/route.ts | grep -A 5 "Provider metadata diagnostics"
```

**Decision Tree:**

```
Diagnostic logging code found in deployed commit?
├─ YES → Latest code is deployed
│         Go to Step 4
│
└─ NO  → Old code is deployed ❌
          STOP HERE and go to "Fix 3: Deploy Latest Code"
```

---

### Step 4: Check Production Logs (10 minutes)

**Objective:** Find the actual error output from when user hit the issue

1. Go to Vercel Dashboard → Project → Logs
2. Filter by:
   - Function: Contains "callback" or "auth"
   - Time: When user reported the issue
3. Search for: `[OAuth Callback]`

**What to look for:**

| Log Message | Meaning | Next Step |
|-------------|---------|-----------|
| `Provider metadata diagnostics:` | ✓ Diagnostic code ran | Analyze the metadata values |
| `Could not fetch admin user data for diagnostics:` | ❌ Service role key issue | Go to Step 5 |
| `Could not reset abandoned Google signup:` | ❌ Function rejected | Analyze rejection details |
| No logs at all | ❌ Code didn't execute | Check if user triggered correct flow |

---

### Step 5: Check Service Role Configuration (5 minutes)

**Objective:** Verify server-side code can access admin APIs

1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Check for: `SUPABASE_SERVICE_ROLE_KEY`
3. Verify it's set for **Production** environment

**Decision Tree:**

```
SUPABASE_SERVICE_ROLE_KEY exists and is set for Production?
├─ YES → Service role is configured
│         Go to Step 6
│
└─ NO  → Missing environment variable ❌
          STOP HERE and go to "Fix 4: Set Service Role Key"
```

---

### Step 6: Analyze Provider Metadata (15 minutes)

**Objective:** Understand what metadata Google OAuth is providing

If you reached this step, you should have diagnostic logs from Step 4 that look like:

```
[OAuth Callback] Provider metadata diagnostics:
  - Full raw_app_meta_data: { ... }
  - provider field: "google" (or null)
  - providers array: ["google"] (or null)
  - user.app_metadata.provider type: string
  - user.app_metadata.providers type: object
  - Is providers an array? true
```

**Analysis Table:**

| provider field | providers array | OR Logic Result | Should Work? |
|----------------|-----------------|-----------------|--------------|
| "google" | ["google"] | ✓ TRUE | YES |
| "google" | null | ✓ TRUE | YES |
| null | ["google"] | ✓ TRUE | YES |
| null | null | ✗ FALSE | NO - This is the problem! |
| "email" | ["email"] | ✗ FALSE | NO - User used email, not Google |

**Decision Tree:**

```
Both provider AND providers are null/missing?
├─ YES → Supabase OAuth metadata issue ❌
│         Go to "Fix 5: Supabase OAuth Configuration"
│
├─ NO (At least one is "google") → OR logic should work ✓
│                                   But function still rejected?
│                                   Go to Step 7
│
└─ Different provider (not google) → User didn't use Google OAuth
                                      This is CORRECT rejection
                                      Go to "Explain to User"
```

---

### Step 7: Check Other Rejection Reasons (10 minutes)

**Objective:** Function might reject for OTHER valid safety reasons

Review the logs for these rejection patterns:

```typescript
// Pattern 1: Password already set (safety protection)
if (resetData?.reason === 'password_set') {
  // This means the account is COMPLETED, not abandoned
  // Function SHOULD reject - this is correct behavior
}

// Pattern 2: Profile not found
if (resetData?.reason === 'profile_not_found') {
  // Data integrity issue - profile should exist
}

// Pattern 3: User not found
if (resetData?.reason === 'user_not_found') {
  // Session has user_id that doesn't exist in auth.users
}
```

**If password_set rejection:**
- This is CORRECT behavior
- The account is not abandoned, it's completed
- User should use normal login, not retry signup
- Update user-facing error message to clarify this

**If profile/user not found:**
- Data integrity issue
- Go to "Fix 6: Data Investigation"

---

## 🔧 Fixes

### Fix 1: Apply Migration Manually

**When:** Step 1 or Step 2 detected migration not applied or wrong logic

**Steps:**
1. Open file: `supabase/migrations/20260828000000_fix_reset_google_signup_provider_check.sql`
2. Copy entire contents
3. Open Supabase Dashboard → SQL Editor
4. Paste and run
5. Verify with Step 2 query
6. Should now show "✓ FIXED - Uses OR logic"

**Verification:**
```sql
-- Should return "✓ FIXED"
SELECT 
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%OR COALESCE((v_app_metadata->''providers'') ? ''google''%' 
        THEN '✓ FIXED - Uses OR logic'
        ELSE '✗ STILL BROKEN'
    END AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'reset_incomplete_google_signup';
```

---

### Fix 2: Rebuild Function

**When:** Step 2 shows function is missing or malformed

**Steps:**
1. Same as Fix 1 - apply migration file
2. This will recreate the function from scratch
3. Verify permissions with Query 4 from `VERIFY_MIGRATION_QUERIES.sql`

---

### Fix 3: Deploy Latest Code

**When:** Step 3 detected old code deployed without diagnostics

**Steps:**
1. In local repo, verify latest commit has diagnostic code:
   ```bash
   git log --oneline -5
   git show HEAD:app/auth/callback/route.ts | grep -A 3 "Provider metadata diagnostics"
   ```

2. If latest commit has the code:
   - Push to main branch (or trigger Vercel deploy)
   - Wait for deployment to complete
   - Verify in Vercel Dashboard

3. If latest commit doesn't have the code:
   - The diagnostic logging was never committed
   - Check lines 175-188 of `app/auth/callback/route.ts`
   - Should contain extensive provider metadata logging

---

### Fix 4: Set Service Role Key

**When:** Step 5 detected missing `SUPABASE_SERVICE_ROLE_KEY`

**Steps:**
1. Go to Supabase Dashboard → Project Settings → API
2. Copy the `service_role` key (secret, starts with `eyJ...`)
3. Go to Vercel Dashboard → Project Settings → Environment Variables
4. Add new variable:
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: (paste the key)
   - Environment: ✓ Production
5. Redeploy the application
6. Test that diagnostic logs now appear

---

### Fix 5: Supabase OAuth Configuration

**When:** Step 6 shows both provider metadata fields are null

**This is rare but possible if:**
- OAuth provider configuration is incomplete
- Supabase Auth settings are misconfigured
- User's account was created through non-standard flow

**Steps:**
1. Go to Supabase Dashboard → Authentication → Providers
2. Check Google OAuth configuration:
   - Client ID set
   - Client Secret set
   - Authorized redirect URIs correct
3. Test OAuth flow with a new test account:
   ```
   1. Go to /auth/login
   2. Click "Sign up with Google"
   3. Complete OAuth
   4. Check if metadata is populated
   ```

4. If new accounts also have null metadata:
   - OAuth configuration is broken
   - Fix Google provider settings in Supabase
   - May need to re-configure OAuth app

5. If only specific user has null metadata:
   - Their account may have been created through different flow
   - Consider manual data fix or ask them to create new account

---

### Fix 6: Data Investigation

**When:** Step 7 found data integrity issues (missing profile/user)

**Steps:**
1. In Supabase Dashboard → SQL Editor, investigate the user:

```sql
-- Replace with actual user_id from logs
SELECT 
  u.id,
  u.email,
  u.created_at AS user_created,
  p.id AS profile_id,
  p.created_at AS profile_created,
  p.password_set,
  p.is_complete
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE u.id = '00000000-0000-0000-0000-000000000000';
```

2. Possible findings:

| Finding | Diagnosis | Fix |
|---------|-----------|-----|
| User exists, no profile | Profile creation failed during signup | Create profile manually |
| No user, no profile | User was deleted | Cannot recover, user must signup again |
| User exists, profile exists | Should not reject | Review function logs again |

---

## 🎓 Understanding the User Flow

**Normal Abandoned Signup Retry:**
```
Day 1: User signs up with Google → Picks role → Abandons at student details
       Database state: user_roles has role, students table empty, password_set=false

Day 2: User clicks Google signup again → Callback detects incomplete signup
       → Calls reset function → Clears user_roles → Redirects to role selection
       → User picks role again → Completes student details → Done
```

**Why Reset is Needed:**
- Without reset: User has stale role data, redirects to wrong place
- With reset: Clean slate, restart onboarding from role selection

**Safety Protection:**
- If password_set=true → Account is complete, do NOT reset
- Function refuses to reset completed accounts

---

## 📊 Expected Outcomes by Scenario

### Scenario A: Migration Not Applied
- **Symptoms:** AND logic in function, fails for most users
- **Fix:** Apply migration (Fix 1)
- **Result:** 95%+ of users can retry signups successfully

### Scenario B: Old Code Deployed
- **Symptoms:** No diagnostic logs in Vercel
- **Fix:** Deploy latest code (Fix 3)
- **Result:** Can see what's happening, make informed decisions

### Scenario C: Service Role Missing
- **Symptoms:** Diagnostic logs show admin API errors
- **Fix:** Set service role key (Fix 4)
- **Result:** Diagnostic logging works, deeper analysis possible

### Scenario D: Null Metadata (Rare)
- **Symptoms:** Both provider fields are null
- **Fix:** OAuth reconfiguration (Fix 5)
- **Result:** New signups populate metadata correctly

---

## 🚀 Quick Start: Most Likely Fix

**If you just want to fix it quickly without investigation:**

Most production issues are caused by **migration not applied**. Try this first:

1. Copy contents of `supabase/migrations/20260828000000_fix_reset_google_signup_provider_check.sql`
2. Paste into Supabase SQL Editor
3. Run it
4. Test with a user retry

This fixes 90% of cases. If it doesn't work, come back and do full investigation.

---

## 📞 When to Escalate

Contact a database administrator or Supabase support if:
- [ ] Migration file fails to run with PostgreSQL errors
- [ ] Function permissions cannot be set
- [ ] OAuth metadata is consistently null for all new users
- [ ] Data integrity issues (missing profiles for many users)

---

## 📝 Post-Fix Verification

After applying any fix, verify with:

1. **Check migration applied:**
   ```sql
   SELECT version FROM supabase_migrations.schema_migrations 
   WHERE version = '20260828000000';
   ```
   Should return 1 row.

2. **Check function logic:**
   ```sql
   SELECT pg_get_functiondef(p.oid) 
   FROM pg_proc p 
   WHERE proname = 'reset_incomplete_google_signup';
   ```
   Should contain `OR COALESCE` (not `AND COALESCE`).

3. **Test with real user:**
   - Ask affected user to retry signup
   - Watch Vercel logs in real-time
   - Should see successful reset message
   - User should reach role selection screen

4. **Monitor for 24-48 hours:**
   - Check for any new "signup-retry-failed" errors
   - If errors persist, user may have different issue

---

**Last Updated:** Based on migration `20260828000000` and diagnostic logging in `route.ts`.
