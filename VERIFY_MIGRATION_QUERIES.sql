-- ============================================================================
-- PRODUCTION VERIFICATION QUERIES
-- Copy and paste these queries into Supabase Dashboard SQL Editor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- QUERY 1: Check if migration was applied
-- ----------------------------------------------------------------------------
-- Expected: 1 row with version '20260828000000' and a timestamp
-- If no rows: Migration was NOT applied
-- ----------------------------------------------------------------------------

SELECT 
    version,
    name,
    executed_at,
    execution_time_ms
FROM supabase_migrations.schema_migrations
WHERE version = '20260828000000'
ORDER BY executed_at DESC;


-- ----------------------------------------------------------------------------
-- QUERY 2: View complete function source code
-- ----------------------------------------------------------------------------
-- Expected: Full function definition including the v_is_google check
-- Look for: "OR" between the two provider checks (not "AND")
-- ----------------------------------------------------------------------------

SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'reset_incomplete_google_signup';


-- ----------------------------------------------------------------------------
-- QUERY 3: Extract just the provider check logic
-- ----------------------------------------------------------------------------
-- This shows ONLY the relevant provider check portion
-- Makes it easier to see AND vs OR without reading entire function
-- ----------------------------------------------------------------------------

SELECT 
    p.proname AS function_name,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%OR COALESCE((v_app_metadata->''providers'') ? ''google''%' 
        THEN '✓ FIXED - Uses OR logic'
        WHEN pg_get_functiondef(p.oid) LIKE '%AND COALESCE((v_app_metadata->''providers'') ? ''google''%' 
        THEN '✗ BROKEN - Uses AND logic'
        ELSE '? UNKNOWN - Check function source'
    END AS provider_check_status,
    pg_get_functiondef(p.oid) AS full_function
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'reset_incomplete_google_signup';


-- ----------------------------------------------------------------------------
-- QUERY 4: Check function permissions
-- ----------------------------------------------------------------------------
-- Expected: EXECUTE permission granted to service_role
-- Expected: REVOKED from public, anon, authenticated
-- ----------------------------------------------------------------------------

SELECT 
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    p.prosecdef AS is_security_definer,
    pg_catalog.array_to_string(p.proacl, E'\n') AS permissions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'reset_incomplete_google_signup';


-- ----------------------------------------------------------------------------
-- QUERY 5: List all migrations (for context)
-- ----------------------------------------------------------------------------
-- Shows all applied migrations in chronological order
-- Helps verify if this migration is the latest or if others came after
-- ----------------------------------------------------------------------------

SELECT 
    version,
    name,
    executed_at
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 20;


-- ----------------------------------------------------------------------------
-- QUERY 6: Check if service_role exists and has permissions
-- ----------------------------------------------------------------------------
-- Verifies that service_role (used by server-side code) exists
-- ----------------------------------------------------------------------------

SELECT 
    rolname,
    rolsuper,
    rolcreaterole,
    rolcreatedb,
    rolcanlogin
FROM pg_roles
WHERE rolname IN ('service_role', 'authenticated', 'anon', 'postgres');


-- ============================================================================
-- INTERPRETATION GUIDE
-- ============================================================================

/*

QUERY 1 RESULTS:
---------------
✓ One row returned → Migration WAS applied on [date]
✗ Zero rows returned → Migration was NOT applied → APPLY MANUALLY


QUERY 2/3 RESULTS:
-----------------
✓ Function contains: "v_app_metadata->>'provider' = 'google' OR COALESCE..."
  → CORRECT: Uses OR logic, allows either provider field OR providers array

✗ Function contains: "v_app_metadata->>'provider' = 'google' AND COALESCE..."
  → BROKEN: Uses AND logic, requires BOTH fields (too strict)

? Function not found
  → CRITICAL: Function doesn't exist at all


QUERY 4 RESULTS:
---------------
✓ prosecdef = true → Security definer is set (correct)
✓ proacl contains "service_role=X" → Service role has execute permission
✗ If proacl is NULL or empty → Permissions not set correctly


QUERY 6 RESULTS:
---------------
✓ service_role exists with appropriate permissions
✗ service_role missing → Supabase installation issue


NEXT STEPS BASED ON RESULTS:
----------------------------

If Migration Not Applied (Query 1 = no rows):
  1. Open file: supabase/migrations/20260828000000_fix_reset_google_signup_provider_check.sql
  2. Copy entire contents
  3. Paste into Supabase SQL Editor
  4. Run it
  5. Re-run Query 1 to confirm

If Function Uses AND Logic (Query 3 = BROKEN):
  1. Migration may have been rolled back or overwritten
  2. Apply migration manually (same steps as above)
  3. Verify with Query 3 again

If Function Uses OR Logic But Still Failing:
  1. The fix is deployed correctly
  2. The issue is something else (see Enhanced Diagnostic Function)
  3. Review Vercel logs for diagnostic output from route.ts
  4. Check what provider metadata values are being logged

*/
