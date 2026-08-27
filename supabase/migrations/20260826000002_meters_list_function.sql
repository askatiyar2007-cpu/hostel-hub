-- Migration: Add get_meters_list RPC function for enriched meter data
-- Design Section 6.2.3
-- Requirements: REQ-12.1, REQ-12.3, REQ-12.6

-- Drop function if exists (for redeployment)
DROP FUNCTION IF EXISTS get_meters_list(UUID, TEXT);

-- Create RPC function to list meters with enriched data
CREATE OR REPLACE FUNCTION get_meters_list(
  p_hostel_id UUID,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  room_id UUID,
  room_number TEXT,
  meter_number TEXT,
  status TEXT,
  last_reading JSONB,
  open_segment_id UUID,
  pending_reading BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    em.id,
    em.room_id,
    r.room_number,
    em.meter_number,
    em.status,
    -- Last reading subquery (REQ-12.3)
    (
      SELECT jsonb_build_object(
        'value', mr.reading_value,
        'timestamp', mr.reading_timestamp
      )
      FROM meter_readings mr
      WHERE mr.meter_id = em.id
      ORDER BY mr.reading_timestamp DESC, mr.created_at DESC
      LIMIT 1
    ) AS last_reading,
    -- Open segment subquery
    (
      SELECT bs.id
      FROM billing_segments bs
      WHERE bs.meter_id = em.id AND bs.end_date IS NULL
      LIMIT 1
    ) AS open_segment_id,
    -- Pending reading indicator (REQ-12.6)
    EXISTS (
      SELECT 1 
      FROM occupancy_change_events oce
      WHERE oce.room_id = em.room_id 
        AND oce.status = 'pending_reading'
    ) AS pending_reading
  FROM electricity_meters em
  JOIN rooms r ON em.room_id = r.id
  WHERE em.hostel_id = p_hostel_id
    AND (p_status IS NULL OR em.status = p_status)
  ORDER BY r.room_number;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_meters_list(UUID, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_meters_list IS 'List electricity meters with last reading, open segment, and pending reading indicators for owner dashboard';
