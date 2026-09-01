-- Migration: Fix electricity integration to work with 0 meters
-- Date: 2026-09-03
-- Description: Update detect_occupancy_change trigger to skip event creation when no meter exists
--              Update ck_completed_status constraint to allow null required_reading_id

BEGIN;

-- 1. Drop the existing constraint
ALTER TABLE public.occupancy_change_events
DROP CONSTRAINT IF EXISTS ck_completed_status;

-- 2. Add new constraint allowing null required_reading_id for completed status
ALTER TABLE public.occupancy_change_events
ADD CONSTRAINT ck_completed_status CHECK (
  (status = 'completed' AND completed_at IS NOT NULL) OR
  (status != 'completed')
);

COMMENT ON CONSTRAINT ck_completed_status ON public.occupancy_change_events IS 
  'Allows completion without reading when no meter exists';

-- 3. Update detect_occupancy_change trigger to only create events when meter exists
CREATE OR REPLACE FUNCTION detect_occupancy_change()
RETURNS TRIGGER AS $$
DECLARE
  change_type_val occupancy_change_type;
  change_ts TIMESTAMPTZ;
  v_meter_exists BOOLEAN;
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
  
  -- Check if room has an active electricity meter
  SELECT EXISTS (
    SELECT 1 FROM electricity_meters
    WHERE room_id = NEW.room_id
      AND status = 'active'
  ) INTO v_meter_exists;
  
  -- Only create event if meter exists
  IF v_meter_exists THEN
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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION detect_occupancy_change() IS 
  'Creates occupancy change events only when active electricity meter exists';

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
