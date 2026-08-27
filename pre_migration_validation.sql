-- ============================================================================
-- PRE-MIGRATION VALIDATION QUERIES
-- Run these in Supabase SQL Editor BEFORE applying the migration
-- ============================================================================

-- 1. Check existing tables (should NOT include electricity tables yet)
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Check existing ENUMs (verify no conflicts)
SELECT typname as enum_name
FROM pg_type 
WHERE typtype = 'e'
  AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY typname;

-- 3. Verify critical existing tables exist
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hostels') THEN 'EXISTS'
    ELSE 'MISSING'
  END as hostels_table,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rooms') THEN 'EXISTS'
    ELSE 'MISSING'
  END as rooms_table,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_allocations') THEN 'EXISTS'
    ELSE 'MISSING'
  END as room_allocations_table,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN 'EXISTS'
    ELSE 'MISSING'
  END as profiles_table;

-- 4. Count records in critical tables (to verify no data loss after migration)
SELECT 
  'hostels' as table_name, 
  COUNT(*) as record_count 
FROM hostels
UNION ALL
SELECT 'rooms', COUNT(*) FROM rooms
UNION ALL
SELECT 'room_allocations', COUNT(*) FROM room_allocations;

-- 5. Check for any existing electricity-related tables (should be none)
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%electric%'
ORDER BY table_name;

