-- ============================================================================
-- PRODUCTION SCHEMA VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify migration compatibility with production schema
-- READ-ONLY queries to check existing table structures
-- ============================================================================

-- Query 1: Verify hostels table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'hostels'
ORDER BY ordinal_position;

-- Query 2: Verify rooms table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'rooms'
ORDER BY ordinal_position;

-- Query 3: Verify room_allocations table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'room_allocations'
ORDER BY ordinal_position;

-- Query 4: Verify auth.users table accessibility and id column
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'auth'
  AND table_name = 'users'
  AND column_name = 'id';

-- Query 5: Check primary keys on referenced tables
SELECT
  tc.table_name,
  kcu.column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('hostels', 'rooms', 'room_allocations')
ORDER BY tc.table_name;

-- Query 6: Check if room_allocations has 'status' or 'active' column
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'room_allocations'
  AND (column_name = 'status' OR column_name = 'active');

