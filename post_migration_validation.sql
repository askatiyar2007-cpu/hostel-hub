-- ============================================================================
-- POST-MIGRATION VALIDATION QUERIES
-- Run these in Supabase SQL Editor AFTER applying the migration
-- ============================================================================

-- 1. Verify all 3 new ENUMs were created
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reading_reason') THEN '✓ EXISTS' ELSE '✗ MISSING' END as reading_reason_enum,
  CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'segment_type') THEN '✓ EXISTS' ELSE '✗ MISSING' END as segment_type_enum,
  CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'occupancy_change_type') THEN '✓ EXISTS' ELSE '✗ MISSING' END as occupancy_change_type_enum;

-- 2. Verify all 7 new tables were created
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'electricity_meters') THEN '✓ EXISTS' ELSE '✗ MISSING' END as electricity_meters,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'electricity_rate_history') THEN '✓ EXISTS' ELSE '✗ MISSING' END as electricity_rate_history,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meter_readings') THEN '✓ EXISTS' ELSE '✗ MISSING' END as meter_readings,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing_segments') THEN '✓ EXISTS' ELSE '✗ MISSING' END as billing_segments,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'segment_occupants') THEN '✓ EXISTS' ELSE '✗ MISSING' END as segment_occupants,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_electricity_charges') THEN '✓ EXISTS' ELSE '✗ MISSING' END as student_electricity_charges,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'occupancy_change_events') THEN '✓ EXISTS' ELSE '✗ MISSING' END as occupancy_change_events;

-- 3. Count indexes created (should be 21+ including partial unique constraints)
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND (tablename LIKE '%electric%' OR tablename LIKE '%segment%' OR tablename LIKE '%occupancy%')
ORDER BY tablename, indexname;

-- 4. Verify foreign key constraints
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND (tc.table_name LIKE '%electric%' OR tc.table_name LIKE '%segment%' OR tc.table_name LIKE '%occupancy%')
ORDER BY tc.table_name, kcu.column_name;

-- 5. Verify check constraints
SELECT
  tc.table_name,
  tc.constraint_name,
  cc.check_clause
FROM information_schema.table_constraints AS tc
JOIN information_schema.check_constraints AS cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_type = 'CHECK'
  AND tc.table_schema = 'public'
  AND (tc.table_name LIKE '%electric%' OR tc.table_name LIKE '%segment%' OR tc.table_name LIKE '%occupancy%')
ORDER BY tc.table_name, tc.constraint_name;

-- 6. Verify triggers were created
SELECT
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND (trigger_name LIKE '%meter%' OR trigger_name LIKE '%occupancy%')
ORDER BY event_object_table, trigger_name;

-- 7. Verify functions were created
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_name LIKE '%meter%' OR routine_name LIKE '%occupancy%')
ORDER BY routine_name;

-- 8. Verify existing tables still exist and have same record counts
SELECT 
  'hostels' as table_name, 
  COUNT(*) as record_count 
FROM hostels
UNION ALL
SELECT 'rooms', COUNT(*) FROM rooms
UNION ALL
SELECT 'room_allocations', COUNT(*) FROM room_allocations;

-- 9. Test ENUM values
SELECT 
  enumlabel as reading_reason_values
FROM pg_enum
WHERE enumtypid = 'reading_reason'::regtype
ORDER BY enumsortorder;

SELECT 
  enumlabel as segment_type_values
FROM pg_enum
WHERE enumtypid = 'segment_type'::regtype
ORDER BY enumsortorder;

SELECT 
  enumlabel as occupancy_change_type_values
FROM pg_enum
WHERE enumtypid = 'occupancy_change_type'::regtype
ORDER BY enumsortorder;

-- 10. Verify unique constraints (partial indexes)
SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexdef LIKE '%WHERE%'
  AND (tablename LIKE '%electric%' OR tablename LIKE '%segment%')
ORDER BY tablename, indexname;

