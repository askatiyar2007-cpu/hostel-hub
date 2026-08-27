-- ============================================================================
-- FUNCTIONAL VALIDATION - COMPREHENSIVE (Tasks 1-5)
-- ============================================================================
-- WARNING: This file contains INSERT statements for testing purposes
-- Creates test data, validates triggers/constraints, then cleans up
-- ============================================================================

-- ============================================================================
-- SECTION 1: PRE-TEST VERIFICATION
-- ============================================================================

-- Query F1: Verify tables are empty before testing
SELECT 
  'electricity_meters' as table_name,
  COUNT(*) as current_count
FROM electricity_meters
UNION ALL
SELECT 'electricity_rate_history', COUNT(*) FROM electricity_rate_history
UNION ALL
SELECT 'meter_readings', COUNT(*) FROM meter_readings
UNION ALL
SELECT 'billing_segments', COUNT(*) FROM billing_segments;
-- Expected: All counts should be 0

-- ============================================================================
-- SECTION 2: TEST ELECTRICITY RATE INSERTION
-- ============================================================================

-- Test F2: Insert test electricity rate
INSERT INTO electricity_rate_history (
  hostel_id,
  rate_per_unit,
  effective_from,
  created_by,
  notes
) VALUES (
  (SELECT id FROM hostels LIMIT 1),
  8.5000,
  NOW(),
  (SELECT id FROM auth.users LIMIT 1),
  'TEST-RATE-VALIDATION'
) RETURNING id, rate_per_unit, effective_from, notes;
-- Expected: 1 row returned with rate_per_unit = 8.5000

-- Test F3: Verify rate was inserted
SELECT 
  id,
  hostel_id,
  rate_per_unit,
  effective_from,
  notes
FROM electricity_rate_history
WHERE notes = 'TEST-RATE-VALIDATION';
-- Expected: 1 row

-- ============================================================================
-- SECTION 3: TEST ELECTRICITY METER INSERTION
-- ============================================================================

-- Test F4: Insert test electricity meter
INSERT INTO electricity_meters (
  hostel_id,
  room_id,
  meter_number,
  status,
  created_by,
  notes
) VALUES (
  (SELECT id FROM hostels LIMIT 1),
  (SELECT id FROM rooms LIMIT 1),
  'TEST-METER-001',
  'active',
  (SELECT id FROM auth.users LIMIT 1),
  'TEST-METER-VALIDATION'
) RETURNING id, meter_number, status, notes;
-- Expected: 1 row returned with meter_number = 'TEST-METER-001'

-- Test F5: Verify meter was inserted
SELECT 
  id,
  hostel_id,
  room_id,
  meter_number,
  status
FROM electricity_meters
WHERE meter_number = 'TEST-METER-001';
-- Expected: 1 row

-- Test F6: Verify unique constraint - meter_number per hostel
-- Try to insert duplicate meter_number in same hostel (should FAIL)
-- COMMENTED OUT - uncomment to test failure
-- INSERT INTO electricity_meters (
--   hostel_id,
--   room_id,
--   meter_number,
--   status,
--   created_by
-- ) VALUES (
--   (SELECT hostel_id FROM electricity_meters WHERE meter_number = 'TEST-METER-001'),
--   (SELECT id FROM rooms OFFSET 1 LIMIT 1),
--   'TEST-METER-001',
--   'active',
--   (SELECT id FROM auth.users LIMIT 1)
-- );
-- Expected: ERROR - duplicate key value violates unique constraint

-- ============================================================================
-- SECTION 4: TEST INITIAL METER READING
-- ============================================================================

-- Test F7: Insert initial meter reading
INSERT INTO meter_readings (
  meter_id,
  room_id,
  hostel_id,
  reading_value,
  reading_timestamp,
  recorded_by,
  reason,
  notes
) VALUES (
  (SELECT id FROM electricity_meters WHERE meter_number = 'TEST-METER-001'),
  (SELECT room_id FROM electricity_meters WHERE meter_number = 'TEST-METER-001'),
  (SELECT hostel_id FROM electricity_meters WHERE meter_number = 'TEST-METER-001'),
  1000.00,
  NOW(),
  (SELECT id FROM auth.users LIMIT 1),
  'initial',
  'TEST-READING-INITIAL'
) RETURNING id, reading_value, reason, notes;
-- Expected: 1 row with reading_value = 1000.00, reason = 'initial'

-- Test F8: Verify reading was inserted
SELECT 
  id,
  meter_id,
  reading_value,
  reason,
  reading_timestamp
FROM meter_readings
WHERE notes = 'TEST-READING-INITIAL';
-- Expected: 1 row

-- ============================================================================
-- SECTION 5: TEST METER READING VALIDATION TRIGGER
-- ============================================================================

-- Test F9: Try to insert reading LOWER than previous (should FAIL)
-- COMMENTED OUT - uncomment to test trigger validation failure
-- INSERT INTO meter_readings (
--   meter_id,
--   room_id,
--   hostel_id,
--   reading_value,
--   reading_timestamp,
--   recorded_by,
--   reason
-- ) VALUES (
--   (SELECT id FROM electricity_meters WHERE meter_number = 'TEST-METER-001'),
--   (SELECT room_id FROM electricity_meters WHERE meter_number = 'TEST-METER-001'),
--   (SELECT hostel_id FROM electricity_meters WHERE meter_number = 'TEST-METER-001'),
--   900.00,
--   NOW() + INTERVAL '30 minutes',
--   (SELECT id FROM auth.users LIMIT 1),
--   'manual_check'
-- );
-- Expected: ERROR from trigger - reading value is less than previous reading

-- Test F10: Insert valid second reading (higher value)
INSERT INTO meter_readings (
  meter_id,
  room_id,
  hostel_id,
  reading_value,
  reading_timestamp,
  recorded_by,
  reason,
  notes
) VALUES (
  (SELECT id FROM electricity_meters WHERE meter_number = 'TEST-METER-001'),
  (SELECT room_id FROM electricity_meters WHERE meter_number = 'TEST-METER-001'),
  (SELECT hostel_id FROM electricity_meters WHERE meter_number = 'TEST-METER-001'),
  1050.00,
  NOW() + INTERVAL '1 hour',
  (SELECT id FROM auth.users LIMIT 1),
  'manual_check',
  'TEST-READING-SECOND'
) RETURNING id, reading_value, reason, notes;
-- Expected: 1 row with reading_value = 1050.00

-- Test F11: Verify both readings exist and are ordered correctly
SELECT 
  id,
  reading_value,
  reason,
  reading_timestamp,
  notes
FROM meter_readings
WHERE meter_id = (SELECT id FROM electricity_meters WHERE meter_number = 'TEST-METER-001')
ORDER BY reading_timestamp;
-- Expected: 2 rows, first = 1000.00, second = 1050.00

-- ============================================================================
-- SECTION 6: TEST UNIQUE CONSTRAINT - ONE ACTIVE METER PER ROOM
-- ============================================================================

-- Test F12: Try to insert second active meter for same room (should FAIL)
-- COMMENTED OUT - uncomment to test unique constraint
-- INSERT INTO electricity_meters (
--   hostel_id,
--   room_id,
--   meter_number,
--   status,
--   created_by
-- ) VALUES (
--   (SELECT hostel_id FROM electricity_meters WHERE meter_number = 'TEST-METER-001'),
--   (SELECT room_id FROM electricity_meters WHERE meter_number = 'TEST-METER-001'),
--   'TEST-METER-002',
--   'active',
--   (SELECT id FROM auth.users LIMIT 1)
-- );
-- Expected: ERROR - violates unique constraint (only one active meter per room)

-- Test F13: Insert inactive meter for same room (should SUCCEED)
INSERT INTO electricity_meters (
  hostel_id,
  room_id,
  meter_number,
  status,
  created_by,
  notes
) VALUES (
  (SELECT hostel_id FROM electricity_meters WHERE meter_number = 'TEST-METER-001'),
  (SELECT room_id FROM electricity_meters WHERE meter_number = 'TEST-METER-001'),
  'TEST-METER-INACTIVE',
  'inactive',
  (SELECT id FROM auth.users LIMIT 1),
  'TEST-INACTIVE-METER'
) RETURNING id, meter_number, status;
-- Expected: 1 row with status = 'inactive'

-- Test F14: Verify only one active meter per room
SELECT 
  room_id,
  COUNT(*) as total_meters,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_meters,
  COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_meters
FROM electricity_meters
WHERE room_id = (SELECT room_id FROM electricity_meters WHERE meter_number = 'TEST-METER-001')
GROUP BY room_id;
-- Expected: total_meters = 2, active_meters = 1, inactive_meters = 1

-- ============================================================================
-- SECTION 7: TEST CHECK CONSTRAINTS
-- ============================================================================

-- Test F15: Try to insert negative reading value (should FAIL)
-- COMMENTED OUT - uncomment to test CHECK constraint
-- INSERT INTO meter_readings (
--   meter_id,
--   room_id,
--   hostel_id,
--   reading_value,
--   reading_timestamp,
--   recorded_by,
--   reason
-- ) VALUES (
--   (SELECT id FROM electricity_meters WHERE meter_number = 'TEST-METER-001'),
--   (SELECT room_id FROM electricity_meters WHERE meter_number = 'TEST-METER-001'),
--   (SELECT hostel_id FROM electricity_meters WHERE meter_number = 'TEST-METER-001'),
--   -10.00,
--   NOW() + INTERVAL '2 hours',
--   (SELECT id FROM auth.users LIMIT 1),
--   'manual_check'
-- );
-- Expected: ERROR - check constraint violated (reading_value >= 0)

-- Test F16: Try to insert zero rate (should FAIL)
-- COMMENTED OUT - uncomment to test CHECK constraint
-- INSERT INTO electricity_rate_history (
--   hostel_id,
--   rate_per_unit,
--   effective_from,
--   created_by
-- ) VALUES (
--   (SELECT id FROM hostels LIMIT 1),
--   0.0000,
--   NOW() + INTERVAL '1 day',
--   (SELECT id FROM auth.users LIMIT 1)
-- );
-- Expected: ERROR - check constraint violated (rate_per_unit > 0)

-- ============================================================================
-- SECTION 8: VERIFY FOREIGN KEY RELATIONSHIPS
-- ============================================================================

-- Test F17: Verify meter references valid hostel and room
SELECT 
  em.id,
  em.meter_number,
  h.id as hostel_exists,
  h.name as hostel_name,
  r.id as room_exists,
  r.room_number
FROM electricity_meters em
JOIN hostels h ON em.hostel_id = h.id
JOIN rooms r ON em.room_id = r.id
WHERE em.meter_number = 'TEST-METER-001';
-- Expected: 1 row with valid hostel and room data

-- Test F18: Verify rate references valid hostel
SELECT 
  er.id,
  er.rate_per_unit,
  h.id as hostel_exists,
  h.name as hostel_name
FROM electricity_rate_history er
JOIN hostels h ON er.hostel_id = h.id
WHERE er.notes = 'TEST-RATE-VALIDATION';
-- Expected: 1 row with valid hostel data

-- Test F19: Verify readings reference valid meter, room, hostel
SELECT 
  mr.id,
  mr.reading_value,
  em.meter_number,
  r.room_number,
  h.name as hostel_name
FROM meter_readings mr
JOIN electricity_meters em ON mr.meter_id = em.id
JOIN rooms r ON mr.room_id = r.id
JOIN hostels h ON mr.hostel_id = h.id
WHERE mr.notes LIKE 'TEST-READING-%';
-- Expected: 2 rows with valid related data

-- ============================================================================
-- SECTION 9: TEST DATA SUMMARY
-- ============================================================================

-- Test F20: Summary of test data created
SELECT 
  m.meter_number,
  m.status,
  COUNT(r.id) as reading_count,
  MIN(r.reading_value) as min_reading,
  MAX(r.reading_value) as max_reading,
  MAX(r.reading_value) - MIN(r.reading_value) as consumption
FROM electricity_meters m
LEFT JOIN meter_readings r ON r.meter_id = m.id
WHERE m.notes LIKE 'TEST-%'
GROUP BY m.id, m.meter_number, m.status
ORDER BY m.meter_number;
-- Expected: 2 rows (TEST-METER-001 with 2 readings, TEST-METER-INACTIVE with 0 readings)

-- ============================================================================
-- SECTION 10: CLEANUP TEST DATA
-- ============================================================================

-- IMPORTANT: Run these cleanup queries after validation is complete

-- Cleanup F21: Delete test readings
DELETE FROM meter_readings 
WHERE notes LIKE 'TEST-%';
-- Expected: 2 rows deleted

-- Cleanup F22: Delete test meters
DELETE FROM electricity_meters 
WHERE notes LIKE 'TEST-%';
-- Expected: 2 rows deleted

-- Cleanup F23: Delete test rates
DELETE FROM electricity_rate_history 
WHERE notes LIKE 'TEST-%';
-- Expected: 1 row deleted

-- Cleanup F24: Verify all test data removed
SELECT 
  'electricity_meters' as table_name,
  COUNT(*) as remaining_test_data
FROM electricity_meters
WHERE notes LIKE 'TEST-%'
UNION ALL
SELECT 'electricity_rate_history', COUNT(*)
FROM electricity_rate_history
WHERE notes LIKE 'TEST-%'
UNION ALL
SELECT 'meter_readings', COUNT(*)
FROM meter_readings
WHERE notes LIKE 'TEST-%';
-- Expected: All counts should be 0

-- ============================================================================
-- END OF FUNCTIONAL VALIDATION
-- ============================================================================
