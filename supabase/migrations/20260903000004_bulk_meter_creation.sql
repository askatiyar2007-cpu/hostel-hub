-- Migration: Bulk Electricity Meter Creation
-- Date: 2026-09-03
-- Description: Adds bulk_create_meters RPC function to atomically create multiple electricity meters without readings

CREATE OR REPLACE FUNCTION bulk_create_meters(
  p_hostel_id UUID,
  p_meters JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $func$
DECLARE
  v_hostel RECORD;
  v_meter_data JSONB;
  v_room_id UUID;
  v_room RECORD;
  v_meter_number TEXT;
  v_notes TEXT;
  v_new_meter_id UUID;
  v_created_meters JSONB := '[]'::jsonb;
  v_index INTEGER := 0;
  v_user_id UUID;

  -- Error capture variables
  v_state TEXT;
  v_msg TEXT;
  v_detail TEXT;
  v_hint TEXT;
  v_context TEXT;
BEGIN
  -- Step 1: Verify hostel ownership
  IF auth.role() = 'service_role' THEN
    SELECT * INTO v_hostel FROM hostels WHERE id = p_hostel_id;
  ELSE
    SELECT * INTO v_hostel FROM hostels WHERE id = p_hostel_id AND owner_id = auth.uid();
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hostel not found or unauthorized';
  END IF;

  v_user_id := COALESCE(auth.uid(), v_hostel.owner_id);

  -- Step 2: Validate p_meters payload format
  IF p_meters IS NULL OR (jsonb_typeof(p_meters) != 'array' AND jsonb_typeof(p_meters) != 'string') THEN
    RAISE EXCEPTION 'Invalid meters payload';
  END IF;

  IF jsonb_typeof(p_meters) = 'string' THEN
    p_meters := (p_meters #>> '{}')::jsonb;
  END IF;

  IF jsonb_typeof(p_meters) != 'array' OR jsonb_array_length(p_meters) = 0 THEN
    RAISE EXCEPTION 'At least one meter is required';
  END IF;

  IF jsonb_array_length(p_meters) > 100 THEN
    RAISE EXCEPTION 'Maximum 100 meters per batch';
  END IF;

  -- Step 3: Validate all items before inserting (fail-fast, atomic validation)
  FOR v_meter_data IN SELECT * FROM jsonb_array_elements(p_meters) AS data
  LOOP
    v_room_id := NULLIF(trim(COALESCE(v_meter_data->>'room_id', '')), '')::UUID;
    v_meter_number := trim(COALESCE(v_meter_data->>'meter_number', ''));

    IF v_room_id IS NULL THEN
      RAISE EXCEPTION 'Room ID is required';
    END IF;

    IF v_meter_number = '' THEN
      RAISE EXCEPTION 'Meter number is required';
    END IF;

    -- Verify room exists and belongs to this hostel
    SELECT * INTO v_room FROM rooms WHERE id = v_room_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Room % not found', v_room_id;
    END IF;

    IF v_room.hostel_id != p_hostel_id THEN
      RAISE EXCEPTION 'Room % does not belong to specified hostel', v_room.room_number;
    END IF;

    -- Check if room already has an active meter in database
    IF EXISTS (
      SELECT 1 FROM electricity_meters
      WHERE room_id = v_room_id AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'Room % already has an active meter', v_room.room_number;
    END IF;

    -- Check if meter_number already exists in this hostel in database
    IF EXISTS (
      SELECT 1 FROM electricity_meters
      WHERE hostel_id = p_hostel_id AND lower(trim(meter_number)) = lower(v_meter_number)
    ) THEN
      RAISE EXCEPTION 'Meter number % already exists in this hostel', v_meter_number;
    END IF;

    -- Check for duplicate room in current batch
    IF (SELECT count(*) FROM jsonb_array_elements(p_meters) AS elem WHERE (elem->>'room_id')::UUID = v_room_id) > 1 THEN
      RAISE EXCEPTION 'Duplicate room % in batch', v_room.room_number;
    END IF;

    -- Check for duplicate meter number in current batch
    IF (SELECT count(*) FROM jsonb_array_elements(p_meters) AS elem WHERE lower(trim(COALESCE(elem->>'meter_number', ''))) = lower(v_meter_number)) > 1 THEN
      RAISE EXCEPTION 'Duplicate meter number % in batch', v_meter_number;
    END IF;
  END LOOP;

  -- Step 4: Create all meters atomically
  -- CRITICAL RULE: Never create electricity readings during meter creation.
  FOR v_meter_data IN SELECT * FROM jsonb_array_elements(p_meters) AS data
  LOOP
    v_room_id := (v_meter_data->>'room_id')::UUID;
    v_meter_number := trim(v_meter_data->>'meter_number');
    v_notes := NULLIF(trim(COALESCE(v_meter_data->>'notes', '')), '');

    SELECT room_number INTO v_room FROM rooms WHERE id = v_room_id;

    INSERT INTO electricity_meters (
      hostel_id,
      room_id,
      meter_number,
      status,
      created_by,
      notes
    ) VALUES (
      p_hostel_id,
      v_room_id,
      v_meter_number,
      'active',
      v_user_id,
      v_notes
    )
    RETURNING id INTO v_new_meter_id;

    v_created_meters := v_created_meters || jsonb_build_object(
      'meter_id', v_new_meter_id,
      'meter_number', v_meter_number,
      'room_id', v_room_id,
      'room_number', v_room.room_number
    );

    v_index := v_index + 1;
  END LOOP;

  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Created %s meters successfully', v_index),
    'meters_created', v_index,
    'meters', v_created_meters
  );

EXCEPTION WHEN OTHERS THEN
  -- Capture error details
  GET STACKED DIAGNOSTICS 
    v_state = RETURNED_SQLSTATE,
    v_msg = MESSAGE_TEXT,
    v_detail = PG_EXCEPTION_DETAIL,
    v_hint = PG_EXCEPTION_HINT,
    v_context = PG_EXCEPTION_CONTEXT;

  RAISE WARNING 'bulk_create_meters failed. state=%, msg=%, detail=%, context=%', 
    v_state, v_msg, v_detail, v_context;

  RETURN jsonb_build_object(
    'success', false,
    'message', v_msg,
    'detail', v_detail,
    'hint', v_hint,
    'code', v_state
  );
END;
$func$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION bulk_create_meters(UUID, JSONB) TO authenticated, service_role;

-- Add comment
COMMENT ON FUNCTION bulk_create_meters IS 'Atomically create multiple electricity meters for rooms in a single transaction without creating readings.';
