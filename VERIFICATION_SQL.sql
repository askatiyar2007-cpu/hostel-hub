-- ==================================================
-- VERIFICATION SQL FOR MIGRATIONS 1 & 2
-- Run this AFTER executing both migrations to verify success
-- ==================================================

-- ============================================================================
-- PART 1: Verify Migration 1 (Month-End Pending Readings Function)
-- ============================================================================

SELECT '=== MIGRATION 1 VERIFICATION ===' AS verification_step;

-- 1.1: Check function exists
SELECT 
  'Function Exists' AS check_name,
  CASE 
    WHEN COUNT(*) = 1 THEN '✓ PASS'
    ELSE '✗ FAIL - Function not found'
  END AS result
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_month_end_pending_readings';

-- 1.2: Check function signature
SELECT 
  'Function Signature' AS check_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_month_end_pending_readings';

-- 1.3: Check function permissions
SELECT 
  'Function Permissions' AS check_name,
  CASE 
    WHEN grantee = 'authenticated' AND privilege_type = 'EXECUTE' THEN '✓ PASS'
    ELSE '✗ FAIL'
  END AS result
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name = 'get_month_end_pending_readings';

-- 1.4: Test function execution (should return empty or valid rows)
SELECT 
  'Function Execution Test' AS check_name,
  CASE 
    WHEN COUNT(*) >= 0 THEN '✓ PASS - Function executes without error'
    ELSE '✗ FAIL'
  END AS result
FROM get_month_end_pending_readings('00000000-0000-0000-0000-000000000000'::UUID);

-- ============================================================================
-- PART 2: Verify Migration 2 (RLS Policies)
-- ============================================================================

SELECT '=== MIGRATION 2 VERIFICATION ===' AS verification_step;

-- 2.1: Check RLS enabled on all 7 tables
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity THEN '✓ RLS ENABLED'
    ELSE '✗ RLS DISABLED'
  END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'electricity_meters',
    'electricity_rate_history',
    'meter_readings',
    'billing_segments',
    'segment_occupants',
    'student_electricity_charges',
    'occupancy_change_events'
  )
ORDER BY tablename;

-- 2.2: Count policies per table (should match expected counts)
SELECT 
  tablename,
  COUNT(*) AS policy_count,
  CASE tablename
    WHEN 'electricity_meters' THEN CASE WHEN COUNT(*) = 4 THEN '✓ PASS' ELSE '✗ FAIL (expected 4)' END
    WHEN 'electricity_rate_history' THEN CASE WHEN COUNT(*) = 4 THEN '✓ PASS' ELSE '✗ FAIL (expected 4)' END
    WHEN 'meter_readings' THEN CASE WHEN COUNT(*) = 5 THEN '✓ PASS' ELSE '✗ FAIL (expected 5)' END
    WHEN 'billing_segments' THEN CASE WHEN COUNT(*) = 5 THEN '✓ PASS' ELSE '✗ FAIL (expected 5)' END
    WHEN 'segment_occupants' THEN CASE WHEN COUNT(*) = 5 THEN '✓ PASS' ELSE '✗ FAIL (expected 5)' END
    WHEN 'student_electricity_charges' THEN CASE WHEN COUNT(*) = 5 THEN '✓ PASS' ELSE '✗ FAIL (expected 5)' END
    WHEN 'occupancy_change_events' THEN CASE WHEN COUNT(*) = 2 THEN '✓ PASS' ELSE '✗ FAIL (expected 2)' END
  END AS verification
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'electricity_meters',
    'electricity_rate_history',
    'meter_readings',
    'billing_segments',
    'segment_occupants',
    'student_electricity_charges',
    'occupancy_change_events'
  )
GROUP BY tablename
ORDER BY tablename;

-- 2.3: List all policies with their operations
SELECT 
  tablename,
  policyname,
  cmd AS operation,
  CASE 
    WHEN roles = '{authenticated}' THEN '✓ authenticated'
    ELSE roles::text
  END AS roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'electricity_meters',
    'electricity_rate_history',
    'meter_readings',
    'billing_segments',
    'segment_occupants',
    'student_electricity_charges',
    'occupancy_change_events'
  )
ORDER BY tablename, policyname;

-- 2.4: Check for duplicate policies (should return 0 rows)
SELECT 
  'Duplicate Policy Check' AS check_name,
  tablename,
  policyname,
  COUNT(*) AS duplicate_count,
  '✗ FAIL - Duplicate found' AS result
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'electricity_meters',
    'electricity_rate_history',
    'meter_readings',
    'billing_segments',
    'segment_occupants',
    'student_electricity_charges',
    'occupancy_change_events'
  )
GROUP BY tablename, policyname
HAVING COUNT(*) > 1;

-- 2.5: Verify column existence for policy references
SELECT 
  'Column Existence Check' AS check_name,
  t.table_name,
  c.column_name,
  '✓ PASS' AS result
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public'
  AND t.table_name IN (
    'electricity_meters',
    'electricity_rate_history',
    'meter_readings',
    'billing_segments',
    'segment_occupants',
    'student_electricity_charges',
    'occupancy_change_events'
  )
  AND c.column_name IN ('hostel_id', 'room_id', 'meter_id', 'student_id', 'status', 'end_date')
ORDER BY t.table_name, c.column_name;

-- ============================================================================
-- PART 3: Final Summary
-- ============================================================================

SELECT '=== VERIFICATION SUMMARY ===' AS summary;

SELECT 
  '29 Total Policies Expected' AS metric,
  COUNT(*) AS actual_count,
  CASE 
    WHEN COUNT(*) = 29 THEN '✓ PASS'
    ELSE '✗ FAIL'
  END AS result
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'electricity_meters',
    'electricity_rate_history',
    'meter_readings',
    'billing_segments',
    'segment_occupants',
    'student_electricity_charges',
    'occupancy_change_events'
  );

SELECT 
  '7 Tables with RLS' AS metric,
  COUNT(*) AS actual_count,
  CASE 
    WHEN COUNT(*) = 7 THEN '✓ PASS'
    ELSE '✗ FAIL'
  END AS result
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'electricity_meters',
    'electricity_rate_history',
    'meter_readings',
    'billing_segments',
    'segment_occupants',
    'student_electricity_charges',
    'occupancy_change_events'
  )
  AND rowsecurity = true;

SELECT '=== VERIFICATION COMPLETE ===' AS final_status;

