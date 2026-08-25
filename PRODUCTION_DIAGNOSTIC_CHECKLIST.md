# Production Diagnostic Checklist
## OAuth Callback Reset Function Failure Investigation

This checklist helps diagnose why `reset_incomplete_google_signup()` is failing in production when users retry abandoned Google signups.

---

## Section A: Verify Migration Applied

### 1. Access Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** in left sidebar

### 2. Check Migration History

Run this query to verify the migration was applied:

```sql
-- Check if the migration was applied
SELECT version, name, executed_at
FROM supabase_migrations.schema_migrations
WHERE version = '20260828000000'
ORDER BY executed_at DESC;
```

**Expected Result:**
- Should return 1 row with version `20260828000000`
- If no rows returned → Migration was NOT applied

### 3. View Live Function Source Code

Run this query to see the actual function code deployed:

```sql
-- Get the complete source code of the live function
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'reset_incomplete_google_signup';
```

**What to Look For:**

Search the output for the provider check logic. You should find one of these patterns:

**OLD (BROKEN) - AND logic:**
```sql
v_is_google := (
  v_app_metadata->>'provider' = 'google'
  AND COALESCE((v_app_metadata->'providers') ? 'google', FALSE)
);
```

**NEW (FIXED) - OR logic:**
```sql
v_is_google := (
  v_app_metadata->>'provider' = 'google'
  OR COALESCE((v_app_metadata->'providers') ? 'google', FALSE)
);
```

**Critical:** If you see `AND`, the migration was NOT applied correctly.

---

## Section B: Verify Code Deployed

### 1. Check Latest Commit in Vercel

1. Go to your Vercel Dashboard
2. Select the project
3. Click on the latest deployment
4. Look for **"Commit"** or **"Source"** section
5. Note the commit hash

### 2. Compare with Local Repository

Run this command in your local repository:

```bash
git log --oneline -5
```

Find the commit that contains:
- The diagnostic logging code in `app/auth/callback/route.ts`
- Lines 175-188 with extensive provider metadata logging

### 3. Verify Diagnostic Code Is Live

The diagnostic logging code should include:
- `console.log('[OAuth Callback] Provider metadata diagnostics:')`
- Logging of `raw_app_meta_data`, `provider`, `providers` array
- Type checking: `typeof rawMetadata?.provider`
- Array check: `Array.isArray(rawMetadata?.providers)`

**If the commit with diagnostic code is NOT the deployed commit:**
- You need to deploy the latest version
- The logs won't appear until deployment is complete

---

## Section C: Why Diagnostic Logs Missing

If a user reported the issue but you don't see the diagnostic logs, investigate:

### Possible Cause 1: Service Role Key Not Set

The code uses `supabaseServer.auth.admin.getUserById()` which requires service role key.

**Verify in Vercel:**
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Check if `SUPABASE_SERVICE_ROLE_KEY` exists
3. Verify it's set for Production environment

**Test Query:**
```sql
-- Check if service role has admin access
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb
FROM pg_roles
WHERE rolname = 'service_role';
```

### Possible Cause 2: Logs Not Being Captured

**Check Vercel Logs:**
1. Vercel Dashboard → Project → Logs
2. Filter by function: `/api/auth/callback` or similar
3. Look for `[OAuth Callback]` prefix
4. Check timestamp matches when user reported issue

**If no logs appear at all:**
- The code path might not be executing
- User might not be triggering the exact scenario
- There could be an earlier error preventing execution

### Possible Cause 3: getUserById Permission Error

If you see error logs like:
```
[OAuth Callback] Could not fetch admin user data for diagnostics: <error>
```

This means:
- Service role key is set but invalid
- Service role doesn't have permission to read auth.users
- Network/connection issue with Supabase

---

## Section D: Next Steps Based on Findings

### Scenario 1: Migration NOT Applied

**Symptoms:**
- Query in Section A.2 returns no rows, OR
- Function source shows `AND` logic instead of `OR`

**Action:**
1. Apply the migration manually via Supabase Dashboard SQL Editor
2. Copy the entire content of `supabase/migrations/20260828000000_fix_reset_google_signup_provider_check.sql`
3. Run it in SQL Editor
4. Verify with Section A.3 that function now uses `OR` logic

### Scenario 2: Migration Applied But Still Failing

**Symptoms:**
- Query in Section A.2 confirms migration applied
- Function source shows correct `OR` logic
- Users still report failures
- Diagnostic logs show rejection

**Action:**
1. Review the diagnostic logs that DID appear
2. Look for the provider metadata values:
   - What is `provider` field value?
   - What is `providers` array value?
   - Are they both null/undefined?
3. If both are missing → Supabase OAuth configuration issue
4. Consider applying the **Enhanced Diagnostic Function** (see Section E)

### Scenario 3: Diagnostic Logs Missing Entirely

**Symptoms:**
- User reports issue
- No `[OAuth Callback]` logs in Vercel
- No diagnostic output visible

**Action:**
1. Verify latest code is deployed (Section B)
2. Check service role key is set (Section C.1)
3. Ask user to reproduce the issue while you watch logs in real-time
4. Check Vercel function errors/crashes that might prevent logging

### Scenario 4: Everything Looks Correct But Users Still Report Issues

**Symptoms:**
- Migration applied correctly
- Code deployed with diagnostics
- Logs appear but function still rejects
- No obvious cause in metadata

**Action:**
1. The function might be rejecting for OTHER reasons:
   - `password_set` is true (protection against resetting completed accounts)
   - Profile not found
   - User ID mismatch
2. Review the complete error logging in callback route.ts lines 192-200
3. Apply **Enhanced Diagnostic Function** to get detailed rejection reasons

---

## Section E: Enhanced Diagnostic Function (Reference Only)

If you need more detailed rejection reasons from the database function itself, use this enhanced version. **DO NOT apply yet** - this is for reference when needed.

See: `ENHANCED_DIAGNOSTIC_FUNCTION.sql`

This version returns structured rejection reasons:
- `null_user_id` - Called with null user_id
- `user_not_found` - User doesn't exist in auth.users
- `not_google` - Provider check failed (neither provider='google' nor 'google' in providers array)
- `profile_not_found` - No profile exists
- `password_set` - Account already has password (safety protection)

---

## Quick Reference: Common SQL Queries

### Check Function Exists
```sql
SELECT proname FROM pg_proc 
WHERE proname = 'reset_incomplete_google_signup';
```

### Check Function Permissions
```sql
SELECT 
    p.proname,
    pg_get_function_identity_arguments(p.oid) AS args,
    p.proacl AS permissions
FROM pg_proc p
WHERE proname = 'reset_incomplete_google_signup';
```

### View All OAuth-Related Functions
```sql
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname LIKE '%google%' OR proname LIKE '%oauth%';
```

---

## Contact Points for Each Layer

- **Vercel Deployment Issues** → Check Vercel Dashboard, deployment logs
- **Supabase Migration Issues** → Check Supabase SQL Editor, migration table
- **Function Logic Issues** → Review function source, test with manual queries
- **OAuth Metadata Issues** → Check Supabase Auth settings, provider configuration

---

**Last Updated:** Based on migration `20260828000000` and diagnostic logging added to `route.ts` lines 175-188.
