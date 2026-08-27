-- ============================================================================
-- ROLLBACK PLAN - ELECTRICITY MIGRATION
-- ============================================================================
--
-- ⚠️  USE ONLY IF MIGRATION FAILS OR NEEDS TO BE REVERSED
--
-- This script removes ONLY the new electricity management objects created by:
-- 20260826000001_electricity_management_foundation.sql
--
-- This does NOT restore deleted data or modify existing tables.
-- This is NOT a complete database restore.
--
-- BEFORE RUNNING: Verify you have saved backup query results!
--
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP TRIGGERS (must be dropped before functions)
-- ============================================================================

-- Drop trigger on meter_readings
DROP TRIGGER IF EXISTS trg_validate_meter_reading_value ON meter_readings;

-- Drop trigger on room_allocations
DROP TRIGGER IF EXISTS trg_detect_occupancy_change ON room_allocations;

-- ============================================================================
-- STEP 2: DROP FUNCTIONS
-- ============================================================================

-- Drop meter reading validation function
DROP FUNCTION IF EXISTS validate_meter_reading_value() CASCADE;

-- Drop occupancy change detection function
DROP FUNCTION IF EXISTS detect_occupancy_change() CASCADE;

-- ============================================================================
-- STEP 3: DROP TABLES (CASCADE removes dependent objects)
-- ============================================================================
-- Drop order matters due to foreign key dependencies
-- Start with tables that reference other electricity tables

-- Drop occupancy_change_events (references meter_readings)
DROP TABLE IF EXISTS occupancy_change_events CASCADE;

-- Drop student_electricity_charges (references billing_segments)
DROP TABLE IF EXISTS student_electricity_charges CASCADE;

-- Drop segment_occupants (references billing_segments)
DROP TABLE IF EXISTS segment_occupants CASCADE;

-- Drop billing_segments (references meter_readings, electricity_meters)
DROP TABLE IF EXISTS billing_segments CASCADE;

-- Drop meter_readings (references electricity_meters)
DROP TABLE IF EXISTS meter_readings CASCADE;

-- Drop electricity_rate_history (no dependencies)
DROP TABLE IF EXISTS electricity_rate_history CASCADE;

-- Drop electricity_meters (no dependencies from other electricity tables)
DROP TABLE IF EXISTS electricity_meters CASCADE;

-- ============================================================================
-- STEP 4: DROP ENUM TYPES
-- ============================================================================

-- Drop occupancy_change_type enum
DROP TYPE IF EXISTS occupancy_change_type CASCADE;

-- Drop segment_type enum
DROP TYPE IF EXISTS segment_type CASCADE;

-- Drop reading_reason enum
DROP TYPE IF EXISTS reading_reason CASCADE;

-- ============================================================================
-- STEP 5: VERIFY ROLLBACK COMPLETION
-- ============================================================================

-- Check that all electricity objects are gone
SELECT 
  'table' as object_type,
  table_name as object_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE '%electric%' OR table_name LIKE '%meter%' 
       OR table_name LIKE '%segment%' OR table_name LIKE '%occupancy%')
UNION ALL
SELECT 
  'enum' as object_type,
  typname as object_name
FROM pg_type
WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND (typname LIKE '%electric%' OR typname LIKE '%reading%' 
       OR typname LIKE '%segment%' OR typname LIKE '%occupancy%');

-- Expected result: 0 rows (all electricity objects removed)

-- ============================================================================
-- STEP 6: VERIFY EXISTING TABLES INTACT
-- ============================================================================

-- Verify existing tables still exist
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hostels') THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as hostels_table,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rooms') THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as rooms_table,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_allocations') THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as room_allocations_table;

-- Expected result: All show "✓ EXISTS"

-- ============================================================================
-- STEP 7: VERIFY DATA COUNTS UNCHANGED
-- ============================================================================

-- Compare with backup counts from manual_backup_queries.sql Query 4
SELECT 
  'hostels' as table_name, 
  COUNT(*) as current_count
FROM hostels
UNION ALL
SELECT 'rooms', COUNT(*) FROM rooms
UNION ALL
SELECT 'room_allocations', COUNT(*) FROM room_allocations;

-- Expected result: Counts match your backup query results

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================
-- 
-- After running this script:
-- 
-- ✓ All 7 electricity tables removed
-- ✓ All 3 electricity ENUMs removed
-- ✓ Both triggers removed
-- ✓ Both functions removed
-- ✓ Existing tables (hostels, rooms, room_allocations) intact
-- ✓ Existing data unchanged
-- 
-- The database is now in the same state as before the migration.
-- 
-- ============================================================================

