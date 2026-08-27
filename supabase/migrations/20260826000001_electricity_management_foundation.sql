-- ============================================================================
-- Migration: Electricity Management System - Foundation
-- Version: 1.0
-- Date: 2026-08-26
-- Description: Creates core tables, ENUMs, and constraints for electricity management
-- Tasks: 1, 2, 3 (Database schema foundation, constraints, triggers)
-- ============================================================================

-- ============================================================================
-- SECTION 1: CREATE ENUM TYPES
-- ============================================================================

-- Reading reason enum for meter_readings.reason
-- Controls segment lifecycle: only occupancy_change/month_end close segments
CREATE TYPE reading_reason AS ENUM (
  'initial',           -- First reading when meter configured
  'occupancy_change',  -- Reading before student joins/leaves (closes segments)
  'month_end',         -- Month-end reading for billing (closes segments)
  'manual_check'       -- Owner checking meter (does NOT close segments)
);

COMMENT ON TYPE reading_reason IS 'Categorizes meter readings; occupancy_change and month_end close/create segments; manual_check does not';

-- Segment type enum for billing_segments.segment_type
-- Distinguishes occupied rooms (charge students) from empty rooms (no charges)
CREATE TYPE segment_type AS ENUM ('occupied', 'empty');

COMMENT ON TYPE segment_type IS 'occupied: charge students; empty: track consumption but zero student charges';

-- Occupancy change type for occupancy_change_events.change_type
CREATE TYPE occupancy_change_type AS ENUM ('student_join', 'student_leave');

COMMENT ON TYPE occupancy_change_type IS 'Tracks whether student is joining or leaving room';

-- ============================================================================
-- SECTION 2: CREATE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: electricity_meters
-- Purpose: Configure one active meter per room for consumption tracking
-- Requirements: REQ-1.1, REQ-1.2, REQ-1.3, REQ-1.7
-- ----------------------------------------------------------------------------
CREATE TABLE electricity_meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  meter_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  
  -- Ensure meter_number is unique per hostel
  CONSTRAINT uq_meter_number_per_hostel UNIQUE (hostel_id, meter_number)
);

COMMENT ON TABLE electricity_meters IS 'Physical electricity meters configured per room';
COMMENT ON COLUMN electricity_meters.status IS 'active or inactive; only one active meter per room allowed';
COMMENT ON COLUMN electricity_meters.meter_number IS 'Unique identifier for meter within hostel';
COMMENT ON COLUMN electricity_meters.created_by IS 'User who configured the meter';

-- ----------------------------------------------------------------------------
-- Table: electricity_rate_history
-- Purpose: Store complete rate change history with effective_from timestamps
-- Requirements: REQ-2.3, REQ-2.5, REQ-11.8
-- ----------------------------------------------------------------------------
CREATE TABLE electricity_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  rate_per_unit NUMERIC(10,4) NOT NULL CHECK (rate_per_unit > 0),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  notes TEXT,
  
  -- No two rates can have the same effective_from for same hostel
  CONSTRAINT uq_rate_effective_from UNIQUE (hostel_id, effective_from)
);

COMMENT ON TABLE electricity_rate_history IS 'Complete electricity rate history with effective dates for immutable billing';
COMMENT ON COLUMN electricity_rate_history.rate_per_unit IS 'Cost per kWh in rupees; must be strictly > 0';
COMMENT ON COLUMN electricity_rate_history.effective_from IS 'Timestamp when this rate becomes effective; determines which rate applies to billing segments';

-- ----------------------------------------------------------------------------
-- Table: meter_readings
-- Purpose: Record all meter readings with reason tracking
-- Requirements: REQ-3.2, REQ-4.1, REQ-4.4
-- ----------------------------------------------------------------------------
CREATE TABLE meter_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id UUID NOT NULL REFERENCES electricity_meters(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  reading_value NUMERIC(10,2) NOT NULL CHECK (reading_value >= 0),
  reading_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reason reading_reason NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate readings within timeframe
  CONSTRAINT uq_reading_deduplication UNIQUE (meter_id, reading_value, reading_timestamp)
);

COMMENT ON TABLE meter_readings IS 'All meter readings with reason tracking; readings with reason occupancy_change or month_end close/create billing segments';
COMMENT ON COLUMN meter_readings.reason IS 'initial: first reading; occupancy_change/month_end: close segments; manual_check: just record';
COMMENT ON COLUMN meter_readings.reading_value IS 'Cumulative meter reading in kWh; must be >= previous reading';

-- ----------------------------------------------------------------------------
-- Table: billing_segments
-- Purpose: Time periods with fixed occupancy for electricity billing
-- Requirements: REQ-6.1, REQ-7.7, REQ-8.1
-- ----------------------------------------------------------------------------
CREATE TABLE billing_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  meter_id UUID NOT NULL REFERENCES electricity_meters(id) ON DELETE RESTRICT,
  
  -- Reading boundaries
  start_reading_id UUID NOT NULL REFERENCES meter_readings(id) ON DELETE RESTRICT,
  end_reading_id UUID REFERENCES meter_readings(id) ON DELETE RESTRICT,
  
  -- Timestamp boundaries
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  
  -- Consumption and costs (stored values)
  consumption_units NUMERIC(10,2),
  rate_per_unit NUMERIC(10,4) NOT NULL,
  total_cost_paise INTEGER,
  
  -- Occupancy
  occupant_count INTEGER NOT NULL CHECK (occupant_count >= 0),
  segment_type segment_type NOT NULL,
  
  -- Billing month for grouping
  billing_month TEXT NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT ck_segment_dates CHECK (end_date IS NULL OR end_date > start_date),
  CONSTRAINT ck_segment_closed_consistency CHECK (
    (end_date IS NULL AND end_reading_id IS NULL AND consumption_units IS NULL AND total_cost_paise IS NULL AND closed_at IS NULL) OR
    (end_date IS NOT NULL AND end_reading_id IS NOT NULL AND consumption_units IS NOT NULL AND total_cost_paise IS NOT NULL AND closed_at IS NOT NULL)
  ),
  CONSTRAINT ck_empty_room_type CHECK (
    (occupant_count = 0 AND segment_type = 'empty') OR
    (occupant_count > 0 AND segment_type = 'occupied')
  )
);

COMMENT ON TABLE billing_segments IS 'Billing periods with fixed occupancy; created only by occupancy_change or month_end readings';
COMMENT ON COLUMN billing_segments.segment_type IS 'occupied: charge students; empty: track consumption but zero student charges';
COMMENT ON COLUMN billing_segments.total_cost_paise IS 'Total cost stored in paise (1/100 rupee) for precision';
COMMENT ON COLUMN billing_segments.rate_per_unit IS 'Rate effective at segment creation; immutable even if current rate changes';
COMMENT ON COLUMN billing_segments.billing_month IS 'YYYY-MM format for grouping monthly charges';

-- ----------------------------------------------------------------------------
-- Table: segment_occupants
-- Purpose: Immutable junction table for segment occupancy
-- Requirements: REQ-6.5, REQ-20.6
-- ----------------------------------------------------------------------------
CREATE TABLE segment_occupants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES billing_segments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  allocation_id UUID NOT NULL REFERENCES room_allocations(id) ON DELETE RESTRICT,
  
  -- Snapshot of student info at segment creation
  student_name TEXT NOT NULL,
  student_email TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Each student appears once per segment
  CONSTRAINT uq_student_per_segment UNIQUE (segment_id, student_id)
);

COMMENT ON TABLE segment_occupants IS 'Immutable record of students in room during billing segment';
COMMENT ON COLUMN segment_occupants.allocation_id IS 'Reference to room_allocation that was active during segment';

-- ----------------------------------------------------------------------------
-- Table: student_electricity_charges
-- Purpose: Per-student electricity charges in paise
-- Requirements: REQ-10.1, REQ-10.4, REQ-20.1
-- ----------------------------------------------------------------------------
CREATE TABLE student_electricity_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES billing_segments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  
  -- Charge amount in paise (integer for precision)
  charge_amount_paise INTEGER NOT NULL CHECK (charge_amount_paise >= 0),
  
  -- Billing period
  billing_month TEXT NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Each student charged once per segment
  CONSTRAINT uq_student_charge_per_segment UNIQUE (segment_id, student_id)
);

COMMENT ON TABLE student_electricity_charges IS 'Individual student electricity charges in paise with deterministic remainder allocation';
COMMENT ON COLUMN student_electricity_charges.charge_amount_paise IS 'Charge in paise (1/100 rupee); sum per segment must equal segment total_cost_paise';
COMMENT ON COLUMN student_electricity_charges.billing_month IS 'YYYY-MM for monthly aggregation';

-- ----------------------------------------------------------------------------
-- Table: occupancy_change_events
-- Purpose: Track pending occupancy changes awaiting meter readings
-- Requirements: REQ-5.1, REQ-5.2, REQ-5.4
-- ----------------------------------------------------------------------------
CREATE TABLE occupancy_change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  allocation_id UUID NOT NULL REFERENCES room_allocations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  change_type occupancy_change_type NOT NULL,
  change_timestamp TIMESTAMPTZ NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending_reading' CHECK (status IN ('pending_reading', 'reading_recorded', 'completed', 'cancelled')),
  
  -- Reading requirement
  required_reading_id UUID REFERENCES meter_readings(id) ON DELETE SET NULL,
  reading_deadline TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  CONSTRAINT ck_completed_status CHECK (
    (status = 'completed' AND completed_at IS NOT NULL AND required_reading_id IS NOT NULL) OR
    (status != 'completed')
  )
);

COMMENT ON TABLE occupancy_change_events IS 'Pending occupancy changes awaiting meter readings before completion';
COMMENT ON COLUMN occupancy_change_events.status IS 'pending_reading: awaiting meter reading; reading_recorded: reading exists; completed: segment created';
COMMENT ON COLUMN occupancy_change_events.change_timestamp IS 'When student joins/leaves; reading must be at or before this timestamp';

-- ============================================================================
-- SECTION 3: CREATE INDEXES
-- ============================================================================

-- Indexes for electricity_meters
CREATE INDEX idx_electricity_meters_hostel ON electricity_meters(hostel_id);
CREATE INDEX idx_electricity_meters_room ON electricity_meters(room_id);
CREATE INDEX idx_electricity_meters_status ON electricity_meters(status) WHERE status = 'active';

-- Indexes for electricity_rate_history
CREATE INDEX idx_rate_history_hostel_effective ON electricity_rate_history(hostel_id, effective_from DESC);

-- Indexes for meter_readings
CREATE INDEX idx_meter_readings_meter ON meter_readings(meter_id, reading_timestamp DESC);
CREATE INDEX idx_meter_readings_hostel ON meter_readings(hostel_id);
CREATE INDEX idx_meter_readings_reason ON meter_readings(reason);

-- Indexes for billing_segments
CREATE INDEX idx_billing_segments_hostel ON billing_segments(hostel_id);
CREATE INDEX idx_billing_segments_room ON billing_segments(room_id, start_date DESC);
CREATE INDEX idx_billing_segments_meter ON billing_segments(meter_id);
CREATE INDEX idx_billing_segments_billing_month ON billing_segments(billing_month);
CREATE INDEX idx_billing_segments_open ON billing_segments(room_id) WHERE end_date IS NULL;

-- Partial unique index: only one open segment per room
CREATE UNIQUE INDEX uq_one_open_segment_per_room 
  ON billing_segments(room_id) 
  WHERE end_date IS NULL;

COMMENT ON INDEX uq_one_open_segment_per_room IS 'Ensures only one open segment per room at a time';

-- Indexes for segment_occupants
CREATE INDEX idx_segment_occupants_segment ON segment_occupants(segment_id);
CREATE INDEX idx_segment_occupants_student ON segment_occupants(student_id);

-- Indexes for student_electricity_charges
CREATE INDEX idx_student_charges_student_month ON student_electricity_charges(student_id, billing_month);
CREATE INDEX idx_student_charges_hostel ON student_electricity_charges(hostel_id);
CREATE INDEX idx_student_charges_segment ON student_electricity_charges(segment_id);

-- Indexes for occupancy_change_events
CREATE INDEX idx_occupancy_events_pending ON occupancy_change_events(hostel_id, status) WHERE status = 'pending_reading';
CREATE INDEX idx_occupancy_events_room ON occupancy_change_events(room_id, change_timestamp);
CREATE INDEX idx_occupancy_events_allocation ON occupancy_change_events(allocation_id);

-- ============================================================================
-- SECTION 4: CREATE PARTIAL UNIQUE CONSTRAINTS
-- ============================================================================

-- Partial unique constraint: only one active meter per room
-- Uses NULLS NOT DISTINCT to treat multiple NULLs as equal
CREATE UNIQUE INDEX uq_one_active_meter_per_room 
  ON electricity_meters(room_id, (CASE WHEN status = 'active' THEN status ELSE NULL END))
  WHERE status = 'active';

COMMENT ON INDEX uq_one_active_meter_per_room IS 'Ensures only one active meter per room using partial unique constraint';

-- ============================================================================
-- SECTION 5: CREATE VALIDATION TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: validate_meter_reading_value()
-- Purpose: Validate new reading >= previous reading, warn on high consumption
-- Requirements: REQ-3.3, REQ-4.3, REQ-4.8
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_meter_reading_value()
RETURNS TRIGGER AS $$
DECLARE
  previous_reading NUMERIC(10,2);
  previous_timestamp TIMESTAMPTZ;
BEGIN
  -- Get most recent previous reading for this meter
  SELECT reading_value, reading_timestamp 
  INTO previous_reading, previous_timestamp
  FROM meter_readings
  WHERE meter_id = NEW.meter_id
    AND id != NEW.id
  ORDER BY reading_timestamp DESC, created_at DESC
  LIMIT 1;
  
  -- If this is not the first reading
  IF previous_reading IS NOT NULL THEN
    -- Validate value is not less than previous (REQ-3.3, REQ-4.3)
    IF NEW.reading_value < previous_reading THEN
      RAISE EXCEPTION 'Reading value % is less than previous reading % (recorded at %)', 
        NEW.reading_value, previous_reading, previous_timestamp
        USING ERRCODE = 'check_violation';
    END IF;
    
    -- Validate timestamp is not before previous
    IF NEW.reading_timestamp < previous_timestamp THEN
      RAISE EXCEPTION 'Reading timestamp % is before previous reading timestamp %', 
        NEW.reading_timestamp, previous_timestamp
        USING ERRCODE = 'check_violation';
    END IF;
    
    -- Warn if consumption exceeds 1000 units (REQ-4.8)
    IF NEW.reading_value - previous_reading > 1000 THEN
      RAISE WARNING 'High consumption detected: % units since previous reading', 
        NEW.reading_value - previous_reading;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_meter_reading_value
  BEFORE INSERT OR UPDATE ON meter_readings
  FOR EACH ROW
  EXECUTE FUNCTION validate_meter_reading_value();

COMMENT ON FUNCTION validate_meter_reading_value() IS 'Validates meter readings are not less than previous and warns on high consumption';

-- ----------------------------------------------------------------------------
-- Function: detect_occupancy_change()
-- Purpose: Detect room allocation changes and create pending events
-- Requirements: REQ-5.1, REQ-5.2, REQ-5.4
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION detect_occupancy_change()
RETURNS TRIGGER AS $$
DECLARE
  change_type_val occupancy_change_type;
  change_ts TIMESTAMPTZ;
BEGIN
  -- Determine change type and timestamp
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    change_type_val := 'student_join';
    change_ts := NEW.start_date;
  ELSIF TG_OP = 'UPDATE' AND 
        (OLD.status = 'active' AND NEW.status != 'active' OR NEW.end_date IS NOT NULL AND OLD.end_date IS NULL) THEN
    change_type_val := 'student_leave';
    change_ts := COALESCE(NEW.end_date, NOW());
  ELSE
    RETURN NEW;  -- No occupancy change
  END IF;
  
  -- Create occupancy_change_event
  INSERT INTO occupancy_change_events (
    hostel_id,
    room_id,
    allocation_id,
    student_id,
    change_type,
    change_timestamp,
    status,
    reading_deadline
  ) VALUES (
    (SELECT hostel_id FROM rooms WHERE id = NEW.room_id),
    NEW.room_id,
    NEW.id,
    NEW.student_id,
    change_type_val,
    change_ts,
    'pending_reading',
    change_ts + INTERVAL '24 hours'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_detect_occupancy_change
  AFTER INSERT OR UPDATE ON room_allocations
  FOR EACH ROW
  EXECUTE FUNCTION detect_occupancy_change();

COMMENT ON FUNCTION detect_occupancy_change() IS 'Detects room allocation changes and creates occupancy_change_events requiring meter readings';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
