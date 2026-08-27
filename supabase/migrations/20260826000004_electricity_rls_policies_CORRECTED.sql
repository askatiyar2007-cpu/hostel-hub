-- ==================================================
-- Migration 2: Electricity Management RLS Policies
-- File: 20260826000004_electricity_rls_policies.sql
-- Requirements: REQ-19.1 through REQ-19.7
-- ==================================================
-- 
-- IMPORTANT NOTES:
-- 1. All electricity APIs use service_role client (supabaseServer) which BYPASSES RLS
-- 2. RLS provides defense-in-depth security layer for:
--    - Direct database access via Supabase Studio
--    - Future authenticated client operations
--    - Protection against API bugs/bypasses
-- 3. Service role policies (billing_segments, segment_occupants, student_electricity_charges)
--    have no runtime effect but document intended access patterns
-- ==================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Enable RLS on all 7 electricity tables
-- ----------------------------------------------------------------------------

ALTER TABLE electricity_meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE electricity_rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE meter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE segment_occupants ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_electricity_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE occupancy_change_events ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- STEP 2: electricity_meters RLS Policies (4 policies)
-- Requirements: REQ-19.1
-- Security: Hostel owners can manage meters for their hostels only
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "owners_view_own_meters" ON electricity_meters;
CREATE POLICY "owners_view_own_meters" ON electricity_meters
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hostels h
      WHERE h.id = electricity_meters.hostel_id
        AND h.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "owners_create_own_meters" ON electricity_meters;
CREATE POLICY "owners_create_own_meters" ON electricity_meters
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hostels h
      WHERE h.id = electricity_meters.hostel_id
        AND h.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "owners_update_own_meters" ON electricity_meters;
CREATE POLICY "owners_update_own_meters" ON electricity_meters
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hostels h
      WHERE h.id = electricity_meters.hostel_id
        AND h.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "prevent_meter_deletion" ON electricity_meters;
CREATE POLICY "prevent_meter_deletion" ON electricity_meters
  FOR DELETE TO authenticated
  USING (FALSE);

-- ----------------------------------------------------------------------------
-- STEP 3: electricity_rate_history RLS Policies (4 policies)
-- Requirements: REQ-19.1, REQ-11.3 (immutability)
-- Security: Rate history is immutable after creation
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "owners_view_own_rates" ON electricity_rate_history;
CREATE POLICY "owners_view_own_rates" ON electricity_rate_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hostels h
      WHERE h.id = electricity_rate_history.hostel_id
        AND h.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "owners_create_own_rates" ON electricity_rate_history;
CREATE POLICY "owners_create_own_rates" ON electricity_rate_history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hostels h
      WHERE h.id = electricity_rate_history.hostel_id
        AND h.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "prevent_rate_modifications" ON electricity_rate_history;
CREATE POLICY "prevent_rate_modifications" ON electricity_rate_history
  FOR UPDATE TO authenticated
  USING (FALSE);

DROP POLICY IF EXISTS "prevent_rate_deletion" ON electricity_rate_history;
CREATE POLICY "prevent_rate_deletion" ON electricity_rate_history
  FOR DELETE TO authenticated
  USING (FALSE);

-- ----------------------------------------------------------------------------
-- STEP 4: meter_readings RLS Policies (5 policies)
-- Requirements: REQ-19.2, REQ-20.4 (immutability)
-- Security: Readings are immutable, students can view current room readings
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "owners_view_own_readings" ON meter_readings;
CREATE POLICY "owners_view_own_readings" ON meter_readings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hostels h
      WHERE h.id = meter_readings.hostel_id
        AND h.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "owners_create_own_readings" ON meter_readings;
CREATE POLICY "owners_create_own_readings" ON meter_readings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM electricity_meters em
      INNER JOIN hostels h ON em.hostel_id = h.id
      WHERE em.id = meter_readings.meter_id
        AND h.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "prevent_reading_modifications" ON meter_readings;
CREATE POLICY "prevent_reading_modifications" ON meter_readings
  FOR UPDATE TO authenticated
  USING (FALSE);

DROP POLICY IF EXISTS "prevent_reading_deletion" ON meter_readings;
CREATE POLICY "prevent_reading_deletion" ON meter_readings
  FOR DELETE TO authenticated
  USING (FALSE);

DROP POLICY IF EXISTS "students_view_current_room_readings" ON meter_readings;
CREATE POLICY "students_view_current_room_readings" ON meter_readings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM room_allocations ra
      WHERE ra.student_id = auth.uid()
        AND ra.room_id = meter_readings.room_id
        AND ra.status = 'active'
    )
  );

-- ----------------------------------------------------------------------------
-- STEP 5: billing_segments RLS Policies (5 policies)
-- Requirements: REQ-19.1, REQ-7.7 (only open segments updatable)
-- Security: Owners view all, students view their segments, closed segments immutable
-- NOTE: Service role bypasses these policies in production
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "owners_view_own_segments" ON billing_segments;
CREATE POLICY "owners_view_own_segments" ON billing_segments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hostels h
      WHERE h.id = billing_segments.hostel_id
        AND h.owner_id = auth.uid()
    )
  );

-- NOTE: This policy has no effect when using service_role client (current implementation)
-- Included for defense-in-depth if authenticated client is used in future
DROP POLICY IF EXISTS "service_create_segments" ON billing_segments;
CREATE POLICY "service_create_segments" ON billing_segments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hostels h
      WHERE h.id = billing_segments.hostel_id
        AND h.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "prevent_closed_segment_updates" ON billing_segments;
CREATE POLICY "prevent_closed_segment_updates" ON billing_segments
  FOR UPDATE TO authenticated
  USING (end_date IS NULL);

DROP POLICY IF EXISTS "prevent_segment_deletion" ON billing_segments;
CREATE POLICY "prevent_segment_deletion" ON billing_segments
  FOR DELETE TO authenticated
  USING (FALSE);

DROP POLICY IF EXISTS "students_view_own_segments" ON billing_segments;
CREATE POLICY "students_view_own_segments" ON billing_segments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM segment_occupants so
      WHERE so.segment_id = billing_segments.id
        AND so.student_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- STEP 6: segment_occupants RLS Policies (5 policies)
-- Requirements: REQ-7.6 (immutability)
-- Security: Immutable junction table
-- NOTE: Service role bypasses these policies in production
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "owners_view_segment_occupants" ON segment_occupants;
CREATE POLICY "owners_view_segment_occupants" ON segment_occupants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM billing_segments bs
      INNER JOIN hostels h ON bs.hostel_id = h.id
      WHERE bs.id = segment_occupants.segment_id
        AND h.owner_id = auth.uid()
    )
  );

-- NOTE: This policy has no effect when using service_role client (current implementation)
DROP POLICY IF EXISTS "service_create_occupants" ON segment_occupants;
CREATE POLICY "service_create_occupants" ON segment_occupants
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM billing_segments bs
      INNER JOIN hostels h ON bs.hostel_id = h.id
      WHERE bs.id = segment_occupants.segment_id
        AND h.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "prevent_occupant_modifications" ON segment_occupants;
CREATE POLICY "prevent_occupant_modifications" ON segment_occupants
  FOR UPDATE TO authenticated
  USING (FALSE);

DROP POLICY IF EXISTS "prevent_occupant_deletion" ON segment_occupants;
CREATE POLICY "prevent_occupant_deletion" ON segment_occupants
  FOR DELETE TO authenticated
  USING (FALSE);

DROP POLICY IF EXISTS "students_view_own_occupancy" ON segment_occupants;
CREATE POLICY "students_view_own_occupancy" ON segment_occupants
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- ----------------------------------------------------------------------------
-- STEP 7: student_electricity_charges RLS Policies (5 policies)
-- Requirements: REQ-19.3, REQ-10.7 (immutability)
-- Security: Students view own charges, owners view hostel charges, immutable after creation
-- NOTE: Service role bypasses these policies in production
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "students_view_own_charges" ON student_electricity_charges;
CREATE POLICY "students_view_own_charges" ON student_electricity_charges
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "owners_view_hostel_charges" ON student_electricity_charges;
CREATE POLICY "owners_view_hostel_charges" ON student_electricity_charges
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hostels h
      WHERE h.id = student_electricity_charges.hostel_id
        AND h.owner_id = auth.uid()
    )
  );

-- NOTE: This policy has no effect when using service_role client (current implementation)
DROP POLICY IF EXISTS "service_create_charges" ON student_electricity_charges;
CREATE POLICY "service_create_charges" ON student_electricity_charges
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hostels h
      WHERE h.id = student_electricity_charges.hostel_id
        AND h.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "prevent_charge_modifications" ON student_electricity_charges;
CREATE POLICY "prevent_charge_modifications" ON student_electricity_charges
  FOR UPDATE TO authenticated
  USING (FALSE);

DROP POLICY IF EXISTS "prevent_charge_deletion" ON student_electricity_charges;
CREATE POLICY "prevent_charge_deletion" ON student_electricity_charges
  FOR DELETE TO authenticated
  USING (FALSE);

-- ----------------------------------------------------------------------------
-- STEP 8: occupancy_change_events RLS Policies (2 policies)
-- Requirements: REQ-15.2
-- Security: Owners can view events, students have no access
-- NOTE: Service role bypasses these policies in production
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "owners_view_occupancy_events" ON occupancy_change_events;
CREATE POLICY "owners_view_occupancy_events" ON occupancy_change_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hostels h
      WHERE h.id = occupancy_change_events.hostel_id
        AND h.owner_id = auth.uid()
    )
  );

-- NOTE: This policy has no effect when using service_role client (current implementation)
DROP POLICY IF EXISTS "service_manage_events" ON occupancy_change_events;
CREATE POLICY "service_manage_events" ON occupancy_change_events
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hostels h
      WHERE h.id = occupancy_change_events.hostel_id
        AND h.owner_id = auth.uid()
    )
  );

-- ==================================================
-- Migration Complete
-- Total: 29 policies across 7 tables
-- Defense-in-depth security enabled
-- ==================================================

COMMENT ON TABLE electricity_meters IS 'RLS enabled: Owners manage meters for their hostels';
COMMENT ON TABLE electricity_rate_history IS 'RLS enabled: Immutable rate history, owner access only';
COMMENT ON TABLE meter_readings IS 'RLS enabled: Immutable readings, owners + students (current room)';
COMMENT ON TABLE billing_segments IS 'RLS enabled: Owners view all, students view own, closed segments immutable';
COMMENT ON TABLE segment_occupants IS 'RLS enabled: Immutable junction table, owners + students view own';
COMMENT ON TABLE student_electricity_charges IS 'RLS enabled: Immutable billing, students view own charges';
COMMENT ON TABLE occupancy_change_events IS 'RLS enabled: Owners view events, students no access';

