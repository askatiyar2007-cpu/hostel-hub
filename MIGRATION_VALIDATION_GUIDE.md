# ============================================================================
# MANUAL MIGRATION VALIDATION GUIDE
# ============================================================================

## Overview
This guide walks you through manually validating the electricity management
migration without using Docker/local Supabase.

## ⚠️ IMPORTANT WARNINGS
- This will modify your PRODUCTION database at pcwlceklvjuddghogfbf.supabase.co
- BACKUP your database before proceeding (Supabase Dashboard > Database > Backups)
- The migration is ADDITIVE ONLY - it does NOT drop or modify existing tables
- All existing data will be preserved

## Prerequisites
✓ Supabase CLI installed (version 2.115.0 detected)
✓ Linked to project: pcwlceklvjuddghogfbf.supabase.co
✓ Migration file created: supabase/migrations/20260826000001_electricity_management_foundation.sql

## Step-by-Step Validation Process

### STEP 1: Pre-Migration Validation (REQUIRED)

1. Open Supabase Dashboard: https://supabase.com/dashboard/project/pcwlceklvjuddghogfbf
2. Go to: SQL Editor
3. Open file: pre_migration_validation.sql
4. Run all queries and SAVE the results
5. Verify:
   - hostels, rooms, room_allocations tables exist
   - No electricity_* tables exist yet
   - Record counts are documented

Expected Results:
- hostels_table: EXISTS
- rooms_table: EXISTS  
- room_allocations_table: EXISTS
- profiles_table: EXISTS
- No tables with 'electric' in name

### STEP 2: Create Database Backup (REQUIRED)

1. In Supabase Dashboard, go to: Database > Backups
2. Click "Create Backup" or verify recent backup exists
3. Document backup timestamp

### STEP 3: Apply Migration

Option A: Using Supabase CLI (Recommended)
`powershell
cd "c:\Users\BIT\Downloads\hostelhub combine\files"
supabase db push --linked
`

Option B: Manual SQL Execution
1. Open: supabase/migrations/20260826000001_electricity_management_foundation.sql
2. Copy entire contents
3. In Supabase Dashboard > SQL Editor
4. Paste and run
5. Check for errors

### STEP 4: Post-Migration Validation (REQUIRED)

1. Open file: post_migration_validation.sql
2. Run all queries in Supabase SQL Editor
3. Verify all checks pass:

Expected Results:
✓ 3 ENUMs created: reading_reason, segment_type, occupancy_change_type
✓ 7 tables created: electricity_meters, electricity_rate_history, meter_readings,
  billing_segments, segment_occupants, student_electricity_charges, 
  occupancy_change_events
✓ 21+ indexes created
✓ 13+ constraints created
✓ 2 triggers created: trg_validate_meter_reading_value, trg_detect_occupancy_change
✓ 2 functions created: validate_meter_reading_value(), detect_occupancy_change()
✓ All existing tables still have same record counts
✓ All foreign keys reference correct tables

### STEP 5: Functional Validation (REQUIRED)

1. Open file: functional_validation.sql
2. Run test queries one by one
3. Verify:
   - Can insert electricity rate
   - Can insert meter
   - Can insert initial reading
   - Trigger prevents reading < previous (expected failure)
   - Can insert valid second reading
   - Unique constraint prevents duplicate active meter per room
4. Clean up test data (uncomment cleanup queries at end)

### STEP 6: Final Checks

Run these additional checks:

`sql
-- Count all new objects
SELECT 
  (SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_name LIKE '%electric%' OR table_name LIKE '%segment%' 
   OR table_name LIKE '%occupancy%') as new_tables,
  (SELECT COUNT(*) FROM pg_type 
   WHERE typname IN ('reading_reason', 'segment_type', 'occupancy_change_type')) as new_enums,
  (SELECT COUNT(*) FROM pg_indexes 
   WHERE tablename LIKE '%electric%' OR tablename LIKE '%segment%' 
   OR tablename LIKE '%occupancy%') as new_indexes;
`

Expected: new_tables = 7, new_enums = 3, new_indexes = 21+

## Validation Checklist

After completing all steps, verify:

□ Pre-migration validation completed
□ Database backup created
□ Migration applied successfully (no errors)
□ All 3 ENUMs exist
□ All 7 tables exist
□ All 21+ indexes exist
□ All 13+ constraints exist
□ Both triggers exist and fire correctly
□ Both functions exist
□ Foreign keys reference correct tables
□ Existing tables unchanged
□ Functional tests pass
□ Test data cleaned up

## If Migration Fails

1. STOP immediately
2. Check error message
3. DO NOT proceed to Tasks 6-12
4. Restore from backup if needed
5. Report the exact error for diagnosis

## After Successful Validation

✅ Tasks 1-5: COMPLETE
✅ Database foundation: READY FOR PRODUCTION
✅ Tasks 6-12: READY TO BEGIN

Tasks 6-12 will implement TypeScript business logic:
- Task 6: Meter reading validation functions
- Task 7: Billing segment lifecycle management
- Task 8: Student charge calculation
- Task 9: Occupancy change processing
- Task 11: Month-end processing
- Task 12: Concurrency control

## Rollback Instructions (If Needed)

If you need to rollback the migration:

`sql
-- Drop all new tables (cascades to dependent objects)
DROP TABLE IF EXISTS occupancy_change_events CASCADE;
DROP TABLE IF EXISTS student_electricity_charges CASCADE;
DROP TABLE IF EXISTS segment_occupants CASCADE;
DROP TABLE IF EXISTS billing_segments CASCADE;
DROP TABLE IF EXISTS meter_readings CASCADE;
DROP TABLE IF EXISTS electricity_rate_history CASCADE;
DROP TABLE IF EXISTS electricity_meters CASCADE;

-- Drop ENUMs
DROP TYPE IF EXISTS occupancy_change_type CASCADE;
DROP TYPE IF EXISTS segment_type CASCADE;
DROP TYPE IF EXISTS reading_reason CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS detect_occupancy_change() CASCADE;
DROP FUNCTION IF EXISTS validate_meter_reading_value() CASCADE;
`

