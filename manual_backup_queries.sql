-- ============================================================================
-- MANUAL SQL BACKUP STRATEGY - PRE-MIGRATION
-- ============================================================================
-- 
-- ⚠️  CRITICAL DISCLAIMER:
-- This is a MANUAL METADATA AND DATA EXPORT for validation purposes.
-- This is NOT equivalent to Supabase's official backup/restore system.
-- This does NOT capture:
--   - Binary data (blobs, bytea)
--   - Complete RLS policies
--   - Complete auth schema
--   - System catalogs
--   - Sequences current values
--   - Extension state
-- 
-- This captures only the specific tables and schema objects that the
-- electricity migration depends on, allowing you to verify data integrity
-- and manually restore if needed.
-- ============================================================================

-- ============================================================================
-- PART 1: CAPTURE EXISTING SCHEMA METADATA
-- ============================================================================

-- Query 1: Export existing table schemas (hostels, rooms, room_allocations)
-- Purpose: Capture column definitions, data types, and constraints
-- READ-ONLY: Yes
-- Modifies data: No
-- ---------------------------------------------------------------------------
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('hostels', 'rooms', 'room_allocations')
ORDER BY table_name, ordinal_position;

-- Query 2: Export existing constraints
-- Purpose: Capture primary keys, foreign keys, unique constraints, checks
-- READ-ONLY: Yes
-- Modifies data: No
-- ---------------------------------------------------------------------------
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
LEFT JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('hostels', 'rooms', 'room_allocations')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- Query 3: Export existing indexes
-- Purpose: Capture index definitions
-- READ-ONLY: Yes
-- Modifies data: No
-- ---------------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('hostels', 'rooms', 'room_allocations')
ORDER BY tablename, indexname;

-- ============================================================================
-- PART 2: EXPORT CURRENT DATA (for dependency verification)
-- ============================================================================

-- Query 4: Count records in dependent tables
-- Purpose: Baseline counts to verify no data loss
-- READ-ONLY: Yes
-- Modifies data: No
-- ---------------------------------------------------------------------------
SELECT 
  'hostels' as table_name, 
  COUNT(*) as record_count,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM hostels
UNION ALL
SELECT 
  'rooms',
  COUNT(*),
  MIN(created_at),
  MAX(created_at)
FROM rooms
UNION ALL
SELECT 
  'room_allocations',
  COUNT(*),
  MIN(created_at),
  MAX(created_at)
FROM room_allocations;

-- Query 5: Export hostels table structure and data
-- Purpose: Full data export for manual restoration if needed
-- READ-ONLY: Yes
-- Modifies data: No
-- SAVE RESULTS: Copy output to text file
-- ---------------------------------------------------------------------------
SELECT 
  id,
  name,
  address,
  city,
  state,
  pincode,
  owner_id,
  created_at,
  updated_at
FROM hostels
ORDER BY created_at;

-- Query 6: Export rooms table structure and data
-- Purpose: Full data export for manual restoration if needed
-- READ-ONLY: Yes
-- Modifies data: No
-- SAVE RESULTS: Copy output to text file
-- ---------------------------------------------------------------------------
SELECT 
  id,
  hostel_id,
  room_number,
  floor,
  capacity,
  current_occupancy,
  rent_amount,
  status,
  created_at,
  updated_at
FROM rooms
ORDER BY hostel_id, room_number;

-- Query 7: Export room_allocations table structure and data
-- Purpose: Full data export for manual restoration if needed
-- READ-ONLY: Yes
-- Modifies data: No
-- SAVE RESULTS: Copy output to text file
-- ---------------------------------------------------------------------------
SELECT 
  id,
  room_id,
  student_id,
  start_date,
  end_date,
  status,
  monthly_rent,
  created_at,
  updated_at
FROM room_allocations
ORDER BY room_id, start_date;

-- Query 8: Verify auth.users accessibility (migration depends on it)
-- Purpose: Confirm foreign key target exists
-- READ-ONLY: Yes
-- Modifies data: No
-- ---------------------------------------------------------------------------
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as users_with_email
FROM auth.users;

-- Query 9: Check existing ENUMs (to verify no conflicts)
-- Purpose: Ensure new ENUMs won't conflict
-- READ-ONLY: Yes
-- Modifies data: No
-- ---------------------------------------------------------------------------
SELECT 
  t.typname as enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
GROUP BY t.typname
ORDER BY t.typname;

-- Query 10: Check for any existing electricity-related objects
-- Purpose: Ensure clean slate for migration
-- READ-ONLY: Yes
-- Modifies data: No
-- ---------------------------------------------------------------------------
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
       OR typname LIKE '%segment%' OR typname LIKE '%occupancy%')
ORDER BY object_type, object_name;

-- ============================================================================
-- PART 3: BACKUP COMPLETION CHECKLIST
-- ============================================================================
-- 
-- After running all queries above, you should have captured:
-- 
-- ✓ Schema metadata for hostels, rooms, room_allocations
-- ✓ All constraints on those tables
-- ✓ All indexes on those tables
-- ✓ Record counts and date ranges
-- ✓ Complete data exports (save query results as CSV or text)
-- ✓ Verification that auth.users is accessible
-- ✓ List of existing ENUMs (should NOT include electricity ENUMs)
-- ✓ Confirmation that no electricity objects exist yet
-- 
-- Save all query results before proceeding with migration!
-- 
-- ============================================================================

