-- ============================================================================
-- POST-MIGRATION VALIDATION - COMPREHENSIVE (Tasks 1-5)
-- ============================================================================
-- CRITICAL: This file contains ONLY SELECT queries (100% READ-ONLY)
-- Safe to execute in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- SECTION 1: VERIFY 3 NEW ENUMS
-- ============================================================================

-- Query 1.1: Check all 3 ENUMs exist
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reading_reason') THEN '✓ EXISTS' ELSE '✗ MISSING' END as reading_reason_enum,
  CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'segment_type') THEN '✓ EXISTS' ELSE '✗ MISSING' END as segment_type_enum,
  CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'occupancy_change_type') THEN '✓ EXISTS' ELSE '✗ MISSING' END as occupancy_change_type_enum;

-- Query 1.2: Verify reading_reason ENUM values (should have 4 values)
SELECT 
  enumlabel as reading_reason_values,
  enumsortorder
FROM pg_enum
WHERE enumtypid = 'reading_reason'::regtype
ORDER BY enumsortorder;
-- Expected: initial, occupancy_change, month_end, manual_check

-- Query 1.3: Verify segment_type ENUM values (should have 2 values)
SELECT 
  enumlabel as segment_type_values,
  enumsortorder
FROM pg_enum
WHERE enumtypid = 'segment_type'::regtype
ORDER BY enumsortorder;
-- Expected: occupied, empty

-- Query 1.4: Verify occupancy_change_type ENUM values (should have 2 values)
SELECT 
  enumlabel as occupancy_change_type_values,
  enumsortorder
FROM pg_enum
WHERE enumtypid = 'occupancy_change_type'::regtype
ORDER BY enumsortorder;
-- Expected: student_join, student_leave

-- ============================================================================
-- SECTION 2: VERIFY 7 NEW TABLES
-- ============================================================================

-- Query 2.1: Check all 7 tables exist
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'electricity_meters') THEN '✓ EXISTS' ELSE '✗ MISSING' END as electricity_meters,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'electricity_rate_history') THEN '✓ EXISTS' ELSE '✗ MISSING' END as electricity_rate_history,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meter_readings') THEN '✓ EXISTS' ELSE '✗ MISSING' END as meter_readings,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing_segments') THEN '✓ EXISTS' ELSE '✗ MISSING' END as billing_segments,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'segment_occupants') THEN '✓ EXISTS' ELSE '✗ MISSING' END as segment_occupants,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_electricity_charges') THEN '✓ EXISTS' ELSE '✗ MISSING' END as student_electricity_charges,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'occupancy_change_events') THEN '✓ EXISTS' ELSE '✗ MISSING' END as occupancy_change_events;

-- Query 2.2: Verify electricity_meters columns and data types
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'electricity_meters'
ORDER BY ordinal_position;

-- Query 2.3: Verify electricity_rate_history columns and data types
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'electricity_rate_history'
ORDER BY ordinal_position;

-- Query 2.4: Verify meter_readings columns and data types
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'meter_readings'
ORDER BY ordinal_position;

-- Query 2.5: Verify billing_segments columns and data types
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'billing_segments'
ORDER BY ordinal_position;

-- Query 2.6: Verify segment_occupants columns and data types
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'segment_occupants'
ORDER BY ordinal_position;

-- Query 2.7: Verify student_electricity_charges columns and data types
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'student_electricity_charges'
ORDER BY ordinal_position;

-- Query 2.8: Verify occupancy_change_events columns and data types
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'occupancy_change_events'
ORDER BY ordinal_position;

-- ============================================================================
-- SECTION 3: VERIFY PRIMARY KEYS
-- ============================================================================

-- Query 3.1: Verify primary keys on all 7 tables
SELECT
  tc.table_name,
  kcu.column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('electricity_meters', 'electricity_rate_history', 'meter_readings', 
                        'billing_segments', 'segment_occupants', 'student_electricity_charges',
                        'occupancy_change_events')
ORDER BY tc.table_name;
-- Expected: 7 rows, all with column_name = 'id'

-- ============================================================================
-- SECTION 4: VERIFY FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Query 4.1: List all foreign key constraints
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND (tc.table_name LIKE '%electric%' OR tc.table_name LIKE '%segment%' OR tc.table_name LIKE '%occupancy%')
ORDER BY tc.table_name, kcu.column_name;
-- Expected: 27 foreign key constraints

-- Query 4.2: Count foreign keys by table
SELECT
  tc.table_name,
  COUNT(*) as fk_count
FROM information_schema.table_constraints AS tc
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND (tc.table_name LIKE '%electric%' OR tc.table_name LIKE '%segment%' OR tc.table_name LIKE '%occupancy%')
GROUP BY tc.table_name
ORDER BY tc.table_name;

-- ============================================================================
-- SECTION 5: VERIFY CHECK CONSTRAINTS
-- ============================================================================

-- Query 5.1: List all CHECK constraints
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
-- Expected: 13+ CHECK constraints

-- Query 5.2: Count CHECK constraints by table
SELECT
  tc.table_name,
  COUNT(*) as check_constraint_count
FROM information_schema.table_constraints AS tc
WHERE tc.constraint_type = 'CHECK'
  AND tc.table_schema = 'public'
  AND (tc.table_name LIKE '%electric%' OR tc.table_name LIKE '%segment%' OR tc.table_name LIKE '%occupancy%')
GROUP BY tc.table_name
ORDER BY tc.table_name;

-- ============================================================================
-- SECTION 6: VERIFY UNIQUE CONSTRAINTS
-- ============================================================================

-- Query 6.1: List all UNIQUE constraints
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE'
  AND tc.table_schema = 'public'
  AND (tc.table_name LIKE '%electric%' OR tc.table_name LIKE '%segment%' OR tc.table_name LIKE '%occupancy%')
ORDER BY tc.table_name, tc.constraint_name;
-- Expected: Multiple UNIQUE constraints

-- Query 6.2: Verify partial unique indexes (WHERE clauses)
SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexdef LIKE '%WHERE%'
  AND (tablename LIKE '%electric%' OR tablename LIKE '%segment%')
ORDER BY tablename, indexname;
-- Expected: uq_one_active_meter_per_room, uq_one_open_segment_per_room

-- ============================================================================
-- SECTION 7: VERIFY INDEXES (21+ expected)
-- ============================================================================

-- Query 7.1: List all indexes on electricity tables
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (tablename LIKE '%electric%' OR tablename LIKE '%segment%' OR tablename LIKE '%occupancy%')
ORDER BY tablename, indexname;

-- Query 7.2: Count indexes by table
SELECT 
  tablename,
  COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
  AND (tablename LIKE '%electric%' OR tablename LIKE '%segment%' OR tablename LIKE '%occupancy%')
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- SECTION 8: VERIFY TRIGGERS (2 expected)
-- ============================================================================

-- Query 8.1: List all triggers
SELECT
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND (trigger_name LIKE '%meter%' OR trigger_name LIKE '%occupancy%')
ORDER BY event_object_table, trigger_name;
-- Expected: trg_validate_meter_reading_value, trg_detect_occupancy_change

-- Query 8.2: Verify specific triggers exist
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trg_validate_meter_reading_value'
  ) THEN '✓ EXISTS' ELSE '✗ MISSING' END as trg_validate_meter_reading,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trg_detect_occupancy_change'
  ) THEN '✓ EXISTS' ELSE '✗ MISSING' END as trg_detect_occupancy;

-- ============================================================================
-- SECTION 9: VERIFY FUNCTIONS (2 expected)
-- ============================================================================

-- Query 9.1: List all functions
SELECT
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_name LIKE '%meter%' OR routine_name LIKE '%occupancy%')
ORDER BY routine_name;
-- Expected: validate_meter_reading_value(), detect_occupancy_change()

-- Query 9.2: Verify specific functions exist
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'validate_meter_reading_value'
  ) THEN '✓ EXISTS' ELSE '✗ MISSING' END as func_validate_meter_reading,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'detect_occupancy_change'
  ) THEN '✓ EXISTS' ELSE '✗ MISSING' END as func_detect_occupancy;

-- ============================================================================
-- SECTION 10: VERIFY EXISTING TABLES INTEGRITY
-- ============================================================================

-- Query 10.1: Verify existing tables still exist
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hostels') THEN '✓ EXISTS' ELSE '✗ MISSING' END as hostels_table,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rooms') THEN '✓ EXISTS' ELSE '✗ MISSING' END as rooms_table,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_allocations') THEN '✓ EXISTS' ELSE '✗ MISSING' END as room_allocations_table;

-- Query 10.2: Verify baseline record counts (CRITICAL)
SELECT 
  'hostels' as table_name, 
  COUNT(*) as record_count,
  CASE WHEN COUNT(*) = 5 THEN '✓ CORRECT' ELSE '✗ MISMATCH' END as status
FROM hostels
UNION ALL
SELECT 
  'rooms',
  COUNT(*),
  CASE WHEN COUNT(*) = 8 THEN '✓ CORRECT' ELSE '✗ MISMATCH' END
FROM rooms
UNION ALL
SELECT 
  'room_allocations',
  COUNT(*),
  CASE WHEN COUNT(*) = 13 THEN '✓ CORRECT' ELSE '✗ MISMATCH' END
FROM room_allocations;
-- Expected: hostels=5, rooms=8, room_allocations=13

-- Query 10.3: Verify no data corruption in existing tables
SELECT 
  'hostels' as table_name,
  COUNT(CASE WHEN id IS NOT NULL THEN 1 END) as valid_ids,
  COUNT(CASE WHEN name IS NOT NULL THEN 1 END) as valid_names
FROM hostels
UNION ALL
SELECT 
  'rooms',
  COUNT(CASE WHEN id IS NOT NULL THEN 1 END),
  COUNT(CASE WHEN room_number IS NOT NULL THEN 1 END)
FROM rooms
UNION ALL
SELECT 
  'room_allocations',
  COUNT(CASE WHEN id IS NOT NULL THEN 1 END),
  COUNT(CASE WHEN room_id IS NOT NULL THEN 1 END)
FROM room_allocations;

-- ============================================================================
-- SECTION 11: VERIFY RELATIONSHIPS
-- ============================================================================

-- Query 11.1: Verify meter relationships (electricity_meters -> rooms, hostels)
SELECT 
  'electricity_meters' as table_name,
  COUNT(*) as total_meters,
  COUNT(DISTINCT hostel_id) as distinct_hostels,
  COUNT(DISTINCT room_id) as distinct_rooms
FROM electricity_meters;

-- Query 11.2: Verify rate history relationships
SELECT 
  'electricity_rate_history' as table_name,
  COUNT(*) as total_rates,
  COUNT(DISTINCT hostel_id) as distinct_hostels
FROM electricity_rate_history;

-- Query 11.3: Verify meter reading relationships
SELECT 
  'meter_readings' as table_name,
  COUNT(*) as total_readings,
  COUNT(DISTINCT meter_id) as distinct_meters,
  COUNT(DISTINCT room_id) as distinct_rooms
FROM meter_readings;

-- Query 11.4: Verify billing segment relationships
SELECT 
  'billing_segments' as table_name,
  COUNT(*) as total_segments,
  COUNT(DISTINCT room_id) as distinct_rooms,
  COUNT(DISTINCT meter_id) as distinct_meters
FROM billing_segments;

-- Query 11.5: Verify segment occupant relationships
SELECT 
  'segment_occupants' as table_name,
  COUNT(*) as total_occupants,
  COUNT(DISTINCT segment_id) as distinct_segments,
  COUNT(DISTINCT student_id) as distinct_students
FROM segment_occupants;

-- Query 11.6: Verify student charge relationships
SELECT 
  'student_electricity_charges' as table_name,
  COUNT(*) as total_charges,
  COUNT(DISTINCT student_id) as distinct_students,
  COUNT(DISTINCT segment_id) as distinct_segments
FROM student_electricity_charges;

-- Query 11.7: Verify occupancy change event relationships
SELECT 
  'occupancy_change_events' as table_name,
  COUNT(*) as total_events,
  COUNT(DISTINCT room_id) as distinct_rooms,
  COUNT(DISTINCT student_id) as distinct_students
FROM occupancy_change_events;

-- ============================================================================
-- SECTION 12: VERIFY CASCADE/RESTRICT BEHAVIOR (metadata only)
-- ============================================================================

-- Query 12.1: Verify CASCADE foreign keys
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND rc.delete_rule = 'CASCADE'
  AND (tc.table_name LIKE '%electric%' OR tc.table_name LIKE '%segment%' OR tc.table_name LIKE '%occupancy%')
ORDER BY tc.table_name, kcu.column_name;

-- Query 12.2: Verify RESTRICT foreign keys
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND rc.delete_rule IN ('RESTRICT', 'NO ACTION')
  AND (tc.table_name LIKE '%electric%' OR tc.table_name LIKE '%segment%' OR tc.table_name LIKE '%occupancy%')
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- SECTION 13: FINAL SUMMARY
-- ============================================================================

-- Query 13.1: Complete object count summary
SELECT 
  'ENUMs' as object_type,
  COUNT(*) as count_created
FROM pg_type
WHERE typname IN ('reading_reason', 'segment_type', 'occupancy_change_type')
UNION ALL
SELECT 
  'Tables',
  COUNT(*)
FROM information_schema.tables
WHERE table_name IN ('electricity_meters', 'electricity_rate_history', 'meter_readings',
                     'billing_segments', 'segment_occupants', 'student_electricity_charges',
                     'occupancy_change_events')
UNION ALL
SELECT 
  'Indexes',
  COUNT(*)
FROM pg_indexes
WHERE tablename LIKE '%electric%' OR tablename LIKE '%segment%' OR tablename LIKE '%occupancy%'
UNION ALL
SELECT 
  'Triggers',
  COUNT(*)
FROM information_schema.triggers
WHERE trigger_name IN ('trg_validate_meter_reading_value', 'trg_detect_occupancy_change')
UNION ALL
SELECT 
  'Functions',
  COUNT(*)
FROM information_schema.routines
WHERE routine_name IN ('validate_meter_reading_value', 'detect_occupancy_change');

-- ============================================================================
-- END OF POST-MIGRATION VALIDATION
-- ============================================================================
