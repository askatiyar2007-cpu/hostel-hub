-- ============================================================================
-- FUNCTIONAL VALIDATION QUERIES
-- Test actual functionality after migration is applied
-- ============================================================================

-- TEST 1: Insert a test electricity rate
INSERT INTO electricity_rate_history (
  hostel_id,
  rate_per_unit,
  effective_from,
  created_by,
  notes
) VALUES (
  (SELECT id FROM hostels LIMIT 1),  -- Use first hostel
  8.5000,
  NOW(),
  (SELECT id FROM auth.users LIMIT 1),  -- Use first user
  'Test rate for validation'
) RETURNING id, rate_per_unit, effective_from;

-- TEST 2: Insert a test electricity meter
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
  'Test meter for validation'
) RETURNING id, meter_number, status;

-- TEST 3: Insert initial meter reading
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
  'Initial test reading'
) RETURNING id, reading_value, reason;

-- TEST 4: Try to insert reading LOWER than previous (should FAIL with trigger error)
-- This should fail - comment out if you want to skip failure test
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
--   900.00,  -- Lower than previous 1000.00
--   NOW(),
--   (SELECT id FROM auth.users LIMIT 1),
--   'manual_check'
-- );

-- TEST 5: Insert valid second reading (should SUCCEED)
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
  1050.00,  -- Higher than previous
  NOW() + INTERVAL '1 hour',
  (SELECT id FROM auth.users LIMIT 1),
  'manual_check',
  'Second test reading - should succeed'
) RETURNING id, reading_value, reason;

-- TEST 6: Verify unique constraint - only one active meter per room
-- This should FAIL if you try to insert second active meter for same room
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

-- TEST 7: Query test data
SELECT 
  m.meter_number,
  m.status,
  COUNT(r.id) as reading_count,
  MIN(r.reading_value) as min_reading,
  MAX(r.reading_value) as max_reading
FROM electricity_meters m
LEFT JOIN meter_readings r ON r.meter_id = m.id
WHERE m.meter_number = 'TEST-METER-001'
GROUP BY m.id, m.meter_number, m.status;

-- CLEANUP: Remove test data after validation
-- Uncomment these after validation is complete
-- DELETE FROM meter_readings WHERE meter_id = (SELECT id FROM electricity_meters WHERE meter_number = 'TEST-METER-001');
-- DELETE FROM electricity_meters WHERE meter_number = 'TEST-METER-001';
-- DELETE FROM electricity_rate_history WHERE notes = 'Test rate for validation';

