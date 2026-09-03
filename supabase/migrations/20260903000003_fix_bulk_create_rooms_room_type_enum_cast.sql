-- Migration: Fix room_type Enum Cast in Bulk Room Creation
-- Date: 2026-09-03
-- Description: Explicitly cast v_room_type to room_type enum in bulk_create_rooms INSERT statement

CREATE OR REPLACE FUNCTION bulk_create_rooms(
  p_hostel_id UUID,
  p_rooms JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_hostel RECORD;
  v_room RECORD;
  v_room_data JSONB;
  v_new_room_id UUID;
  v_capacity INTEGER;
  v_bed_number INTEGER;
  v_floor INTEGER;
  v_room_type TEXT;
  v_room_number TEXT;
  v_rent NUMERIC;
  v_security_deposit NUMERIC;
  v_facilities TEXT[];
  v_facilities_array TEXT[];
  v_created_rooms JSONB := '[]'::jsonb;
  v_allow_duplicate BOOLEAN;
  v_index INTEGER := 0;
  
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

  -- Validate p_rooms payload format
  IF p_rooms IS NULL OR (jsonb_typeof(p_rooms) != 'array' AND jsonb_typeof(p_rooms) != 'string') THEN
    RAISE EXCEPTION 'Invalid rooms payload';
  END IF;

  IF jsonb_typeof(p_rooms) = 'string' THEN
    p_rooms := (p_rooms #>> '{}')::jsonb;
  END IF;

  IF jsonb_typeof(p_rooms) != 'array' OR jsonb_array_length(p_rooms) = 0 THEN
    RAISE EXCEPTION 'At least one room is required';
  END IF;

  IF jsonb_array_length(p_rooms) > 50 THEN
    RAISE EXCEPTION 'Maximum 50 rooms per batch';
  END IF;
  
  -- Step 2: Check for duplicate room numbers in the batch and existing rooms
  FOR v_room_data IN SELECT * FROM jsonb_array_elements(p_rooms) AS data
  LOOP
    v_room_number := trim(COALESCE(v_room_data->>'room_number', ''));

    IF v_room_number = '' THEN
      RAISE EXCEPTION 'Room number is required';
    END IF;

    -- Check if duplicate was explicitly approved
    v_allow_duplicate := COALESCE(
      (v_room_data->>'allow_duplicate')::boolean,
      (v_room_data->>'approved')::boolean,
      false
    );
    
    IF NOT v_allow_duplicate THEN
      -- Check if room number already exists in this hostel
      IF EXISTS (SELECT 1 FROM rooms WHERE hostel_id = p_hostel_id AND room_number = v_room_number) THEN
        RAISE EXCEPTION 'Room number % already exists in this hostel', v_room_number;
      END IF;
      
      -- Check for duplicate in current batch:
      -- If the room number appears more than once in the batch and this draft was not approved, reject it!
      IF (SELECT count(*) FROM jsonb_array_elements(p_rooms) AS elem WHERE trim(COALESCE(elem->>'room_number', '')) = v_room_number) > 1 THEN
        RAISE EXCEPTION 'Duplicate room number % in batch', v_room_number;
      END IF;
    END IF;
  END LOOP;
  
  -- Step 3: Create all rooms and beds in a transaction
  FOR v_room_data IN SELECT * FROM jsonb_array_elements(p_rooms) AS data
  LOOP
    v_room_number := trim(v_room_data->>'room_number');
    v_floor := COALESCE((v_room_data->>'floor')::INTEGER, 0);
    v_room_type := COALESCE(v_room_data->>'room_type', 'double');
    v_rent := COALESCE((v_room_data->>'rent')::NUMERIC, 0);
    v_security_deposit := COALESCE((v_room_data->>'security_deposit')::NUMERIC, 0);
    
    -- Convert facilities from JSON array to PostgreSQL array
    IF v_room_data->'facilities' IS NOT NULL AND jsonb_typeof(v_room_data->'facilities') = 'array' THEN
      SELECT array_agg(trim(elem)) INTO v_facilities_array
      FROM jsonb_array_elements_text(v_room_data->'facilities') AS elem;
      v_facilities_array := COALESCE(v_facilities_array, ARRAY[]::TEXT[]);
    ELSE
      v_facilities_array := ARRAY[]::TEXT[];
    END IF;
    
    -- Determine capacity based on room type
    v_capacity := CASE v_room_type
      WHEN 'single' THEN 1
      WHEN 'double' THEN 2
      WHEN 'triple' THEN 3
      WHEN 'quad' THEN 4
      ELSE 2
    END;
    
    -- Insert room (explicitly cast v_room_type to room_type enum)
    INSERT INTO rooms (
      hostel_id,
      room_number,
      floor,
      room_type,
      capacity,
      rent,
      security_deposit,
      facilities,
      status,
      available,
      occupancy,
      occupied_count,
      occupied_beds
    ) VALUES (
      p_hostel_id,
      v_room_number,
      v_floor,
      v_room_type::room_type,
      v_capacity,
      v_rent,
      v_security_deposit,
      v_facilities_array,
      'available',
      true,
      0,
      0,
      0
    )
    RETURNING id INTO v_new_room_id;
    
    -- Create beds
    FOR v_bed_number IN 1..v_capacity LOOP
      INSERT INTO beds (room_id, bed_number, status)
      VALUES (v_new_room_id, v_bed_number, 'available');
    END LOOP;
    
    -- Add to created rooms array
    v_created_rooms := v_created_rooms || jsonb_build_object(
      'room_id', v_new_room_id,
      'room_number', v_room_number,
      'capacity', v_capacity
    );
    
    v_index := v_index + 1;
  END LOOP;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Created %s rooms successfully', v_index),
    'rooms_created', v_index,
    'rooms', v_created_rooms
  );

EXCEPTION WHEN OTHERS THEN
  -- Capture error details
  GET STACKED DIAGNOSTICS 
    v_state = RETURNED_SQLSTATE,
    v_msg = MESSAGE_TEXT,
    v_detail = PG_EXCEPTION_DETAIL,
    v_hint = PG_EXCEPTION_HINT,
    v_context = PG_EXCEPTION_CONTEXT;
    
  -- Transaction will automatically rollback on exception
  RAISE WARNING 'bulk_create_rooms failed. state=%, msg=%, detail=%, context=%', 
    v_state, v_msg, v_detail, v_context;
    
  RETURN jsonb_build_object(
    'success', false,
    'message', v_msg,
    'detail', v_detail,
    'hint', v_hint,
    'code', v_state
  );
END;
$$;

-- Grant execute permission to authenticated and service_role users
GRANT EXECUTE ON FUNCTION bulk_create_rooms TO authenticated, service_role;

-- Add comment
COMMENT ON FUNCTION bulk_create_rooms IS 'Atomically create multiple rooms with beds in a single transaction. Allows duplicate room numbers if explicitly confirmed by owner. Explicitly casts room_type to room_type enum.';
