-- ==================================================
-- Migration 1: Month-End Pending Readings RPC Function
-- File: 20260826000003_month_end_pending_readings_function.sql
-- Requirements: REQ-9.6, REQ-9.7, REQ-25.2, REQ-25.3
-- ==================================================

-- Drop function if exists (idempotent migration)
DROP FUNCTION IF EXISTS get_month_end_pending_readings(UUID);

-- Create RPC function to get meters needing month-end readings
CREATE OR REPLACE FUNCTION get_month_end_pending_readings(
  p_hostel_id UUID
)
RETURNS TABLE (
  room_id UUID,
  room_number TEXT,
  meter_id UUID,
  meter_number TEXT,
  deadline TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_month_start TIMESTAMPTZ;
  v_current_month_end TIMESTAMPTZ;
BEGIN
  -- Get current month boundaries in UTC
  -- NOTE: This implementation uses UTC timestamps.
  -- Full timezone-aware implementation requires:
  --   1. hostels.timezone column
  --   2. Conversion logic using hostel-specific timezone
  -- Current implementation satisfies functional requirements but
  -- does not meet REQ-9.6 timezone requirement until hostels.timezone exists.
  v_current_month_start := date_trunc('month', NOW());
  v_current_month_end := (date_trunc('month', NOW()) + INTERVAL '1 month');
  
  RETURN QUERY
  SELECT 
    em.room_id,
    r.room_number,
    em.id AS meter_id,
    em.meter_number,
    v_current_month_end AS deadline
  FROM electricity_meters em
  INNER JOIN rooms r ON em.room_id = r.id
  WHERE em.hostel_id = p_hostel_id
    AND em.status = 'active'
    -- No month-end reading exists for current month (REQ-9.7, REQ-25.3)
    AND NOT EXISTS (
      SELECT 1
      FROM meter_readings mr
      WHERE mr.meter_id = em.id
        AND mr.reason = 'month_end'
        AND mr.reading_timestamp >= v_current_month_start
        AND mr.reading_timestamp < v_current_month_end
    )
    -- No pending occupancy change for this room (avoid duplicate notifications)
    AND NOT EXISTS (
      SELECT 1
      FROM occupancy_change_events oce
      WHERE oce.room_id = em.room_id
        AND oce.status = 'pending_reading'
    )
  ORDER BY r.room_number;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_month_end_pending_readings(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_month_end_pending_readings IS 'Returns meters needing month-end readings (no occupancy change pending, no month_end reading this month). NOTE: Uses UTC; timezone support requires hostels.timezone column.';

