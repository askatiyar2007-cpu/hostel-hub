# Quick Fix Guide - OAuth Callback Reset Failure

**Problem:** Users retrying abandoned Google signups see "signup-retry-failed" error.

**Most Likely Cause:** Database migration not applied to production.

---

## ⚡ 5-Minute Fix (Try This First)

### Step 1: Check If Migration Applied (1 minute)

Open Supabase Dashboard → SQL Editor, run:

```sql
SELECT version, executed_at
FROM supabase_migrations.schema_migrations
WHERE version = '20260828000000';
```

**Result:**
- ✅ **1 row returned** → Migration was applied, skip to [Advanced Diagnosis](#advanced-diagnosis)
- ❌ **0 rows returned** → Migration NOT applied, continue to Step 2

---

### Step 2: Apply Migration (2 minutes)

1. Open local file: `supabase/migrations/20260828000000_fix_reset_google_signup_provider_check.sql`
2. Copy the **entire contents** of the file
3. In Supabase Dashboard SQL Editor, paste and click **Run**
4. Wait for "Success" message

---

### Step 3: Verify Fix Applied (1 minute)

Run this in SQL Editor:

```sql
SELECT 
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%OR COALESCE((v_app_metadata->''providers'') ? ''google''%' 
        THEN 'FIXED ✓'
        ELSE 'STILL BROKEN ✗'
    END AS status
FROM pg_proc p
WHERE proname = 'reset_incomplete_google_signup';
```

**Result should be:** `FIXED ✓`

---

### Step 4: Test With User (1 minute)

Ask the affected user to:
1. Go to login page
2. Click "Sign up with Google"
3. Complete the OAuth flow
4. Should now reach role selection (not error page)

---

## ✅ Done!

If the above fixed it, you're done. The issue was the database function using `AND` logic instead of `OR` logic for provider checks.

---

## 🔍 Advanced Diagnosis

**If migration WAS applied but users still report failures**, the issue is more complex.

### Quick Diagnostic Script

Run this in Supabase SQL Editor to get a complete diagnostic:

```sql
-- Full diagnostic check
SELECT 
    'Migration Status' AS check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM supabase_migrations.schema_migrations 
            WHERE version = '20260828000000'
        ) THEN 'Applied ✓'
        ELSE 'Not Applied ✗'
    END AS result
UNION ALL
SELECT 
    'Function Logic' AS check_type,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%OR COALESCE((v_app_metadata->''providers'') ? ''google''%' 
        THEN 'Uses OR ✓'
        WHEN pg_get_functiondef(p.oid) LIKE '%AND COALESCE((v_app_metadata->''providers'') ? ''google''%'
        THEN 'Uses AND ✗'
        ELSE 'Unknown ⚠'
    END
FROM pg_proc p
WHERE proname = 'reset_incomplete_google_signup'
UNION ALL
SELECT 
    'Function Exists' AS check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'reset_incomplete_google_signup'
        ) THEN 'Yes ✓'
        ELSE 'No ✗'
    END;
```

**Expected output for working system:**
```
Migration Status  | Applied ✓
Function Logic    | Uses OR ✓
Function Exists   | Yes ✓
```

---

## 🔄 If Still Not Working

### Check 1: Verify Latest Code Deployed

1. Go to Vercel Dashboard → Your Project → Deployments
2. Click latest deployment
3. Check Git commit includes diagnostic logging code
4. Lines 175-188 of `app/auth/callback/route.ts` should have:
   ```typescript
   console.log('[OAuth Callback] Provider metadata diagnostics:');
   console.log('  - Full raw_app_meta_data:', JSON.stringify(rawMetadata, null, 2));
   ```

**If missing:** Deploy latest version from git.

---

### Check 2: Look at Production Logs

1. Vercel Dashboard → Logs
2. Filter by time when user reported issue
3. Search for `[OAuth Callback]`

**Look for these patterns:**

| Log Message | Meaning | Solution |
|-------------|---------|----------|
| "Provider metadata diagnostics:" | Code is running, check metadata values | See [Analyze Metadata](#analyze-metadata) |
| "Could not fetch admin user data" | Missing service role key | See [Fix Service Role](#fix-service-role) |
| No logs at all | Old code deployed or wrong flow | Verify code deployment |

---

### Analyze Metadata

If you see diagnostic logs, check the provider values:

```
[OAuth Callback] Provider metadata diagnostics:
  - provider field: "google"     ← Should be "google" or null
  - providers array: ["google"]  ← Should include "google" or be null
```

**Decision table:**

| provider | providers | Should Work? | Action |
|----------|-----------|--------------|--------|
| "google" | ["google"] | ✅ YES | Function should work, investigate other causes |
| "google" | null | ✅ YES | Function should work with OR logic |
| null | ["google"] | ✅ YES | Function should work with OR logic |
| null | null | ❌ NO | OAuth metadata issue, see [OAuth Config](#fix-oauth-config) |
| "email" | ["email"] | ❌ NO | User used email, not Google (correct rejection) |

---

### Fix Service Role

If logs show "Could not fetch admin user data for diagnostics":

1. Vercel Dashboard → Settings → Environment Variables
2. Check `SUPABASE_SERVICE_ROLE_KEY` exists for Production
3. If missing:
   - Get key from Supabase Dashboard → Settings → API → service_role key
   - Add to Vercel environment variables
   - Redeploy

---

### Fix OAuth Config

If both provider fields are null (rare):

1. Supabase Dashboard → Authentication → Providers
2. Check Google OAuth:
   - Client ID set?
   - Client Secret set?
   - Redirect URI correct?
3. Test with new account to verify metadata populates

---

## 📚 Need More Help?

See detailed investigation guides:
- **Systematic debugging:** `PRODUCTION_DEBUGGING_RUNBOOK.md`
- **Detailed verification:** `PRODUCTION_DIAGNOSTIC_CHECKLIST.md`
- **SQL queries:** `VERIFY_MIGRATION_QUERIES.sql`
- **Enhanced diagnostics:** `ENHANCED_DIAGNOSTIC_FUNCTION.sql` (if needed)

---

## 🎯 Summary Flowchart

```
User reports "signup-retry-failed" error
│
├─→ Check migration applied (Step 1)
│   │
│   ├─→ Not applied → Apply migration (Step 2) → Test → FIXED ✓
│   │
│   └─→ Applied → Check function logic
│       │
│       ├─→ Uses AND → Re-apply migration → FIXED ✓
│       │
│       └─→ Uses OR → Check deployment
│           │
│           ├─→ Old code → Deploy latest → FIXED ✓
│           │
│           └─→ Latest code → Check logs → Analyze metadata
│               │
│               └─→ See Advanced Diagnosis
```

---

**Last Updated:** Migration `20260828000000`
