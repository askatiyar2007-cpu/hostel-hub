-- Ensure booking_type enum exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_type') THEN
        CREATE TYPE public.booking_type AS ENUM ('shared_bed', 'entire_room');
    END IF;
END$$;

-- Ensure room_allocations has required columns matching client requirements
ALTER TABLE public.room_allocations
ADD COLUMN IF NOT EXISTS booking_type public.booking_type NOT NULL DEFAULT 'shared_bed',
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Create or Replace the approve_room_request RPC function returning JSONB
CREATE OR REPLACE FUNCTION public.approve_room_request(req_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  request_record RECORD;
  room_record RECORD;
  allocation_id uuid;
  has_active_alloc boolean;
  v_new_occupied int;
  v_normalized_type text;
  v_final_booking_type public.booking_type;
  
  -- Error capture variables
  v_state text;
  v_msg text;
  v_detail text;
  v_hint text;
  v_context text;
BEGIN
  RAISE NOTICE 'approve_room_request: Starting process for req_id=%', req_id;

  BEGIN
    -- a) Fetch room_request by req_id and lock it
    RAISE NOTICE 'approve_room_request: Fetching room_request...';
    SELECT * INTO request_record FROM public.room_requests WHERE id = req_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found';
    END IF;
    
    RAISE NOTICE 'approve_room_request: Found request: status=%, student_id=%, room_id=%, hostel_id=%, booking_type=%',
                 request_record.status, request_record.student_id, request_record.room_id, request_record.hostel_id, request_record.booking_type;
    
    -- b) Validate request status
    IF request_record.status != 'pending' THEN
        RAISE EXCEPTION 'Request already processed';
    END IF;
    
    -- c) Get room details and lock it
    RAISE NOTICE 'approve_room_request: Fetching room details...';
    SELECT * INTO room_record FROM public.rooms WHERE id = request_record.room_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated room not found';
    END IF;
    
    RAISE NOTICE 'approve_room_request: Found room: capacity=%, occupancy=%', room_record.capacity, room_record.occupancy;
    
    -- d) Check booking type and room availability
    -- Normalize booking type to handle all variations
    v_normalized_type := LOWER(TRIM(COALESCE(request_record.booking_type::text, 'shared_bed')));
    
    -- Handle shared bed variations
    IF v_normalized_type IN ('shared_bed', 'shared', 'shared bed', 'sharebed') THEN
        IF (room_record.capacity - COALESCE(room_record.occupancy, 0)) < 1 THEN
            RAISE EXCEPTION 'Room is full';
        END IF;
        v_new_occupied := COALESCE(room_record.occupancy, 0) + 1;
        v_final_booking_type := 'shared_bed'::public.booking_type;
        
    -- Handle entire room variations
    ELSIF v_normalized_type IN ('entire_room', 'entire', 'entire room', 'entireroom', 'full room') THEN
        IF COALESCE(room_record.occupancy, 0) > 0 THEN
            RAISE EXCEPTION 'Entire room is not available (already occupied)';
        END IF;
        v_new_occupied := room_record.capacity;
        v_final_booking_type := 'entire_room'::public.booking_type;
        
    ELSE
        RAISE EXCEPTION 'Invalid booking type: %', request_record.booking_type;
    END IF;
    
    RAISE NOTICE 'approve_room_request: Booking type = %, new occupancy = %', v_final_booking_type, v_new_occupied;
    
    -- e) Verify student doesn't already have active allocation
    RAISE NOTICE 'approve_room_request: Checking if student already has active allocation...';
    SELECT EXISTS (
        SELECT 1 FROM public.room_allocations 
        WHERE student_id = request_record.student_id AND active = true
    ) INTO has_active_alloc;
    
    IF has_active_alloc THEN
        RAISE EXCEPTION 'Student already has an active room allocation';
    END IF;
    
    -- f) Create room allocation
    RAISE NOTICE 'approve_room_request: Inserting into room_allocations...';
    INSERT INTO public.room_allocations (
        student_id, 
        room_id, 
        hostel_id, 
        booking_type, 
        status, 
        active,
        start_date,
        created_at
    )
    VALUES (
        request_record.student_id, 
        request_record.room_id, 
        request_record.hostel_id, 
        v_final_booking_type, 
        'active', 
        true,
        CURRENT_DATE,
        NOW()
    )
    RETURNING id INTO allocation_id;
    
    RAISE NOTICE 'approve_room_request: room_allocations record inserted with ID=%', allocation_id;

    -- Auto-generate monthly fees for the new allocation
    RAISE NOTICE 'approve_room_request: Generating monthly fees...';
    PERFORM public.create_student_fees(allocation_id);
    
    -- g) Update room occupancy and availability
    RAISE NOTICE 'approve_room_request: Updating room occupancy...';
    UPDATE public.rooms 
    SET 
        occupancy = v_new_occupied,
        available = (v_new_occupied < capacity),
        status = CASE WHEN v_new_occupied >= capacity THEN 'occupied' ELSE 'available' END
    WHERE id = request_record.room_id;
    
    -- h) Update room_request status
    RAISE NOTICE 'approve_room_request: Setting request status to approved...';
    UPDATE public.room_requests 
    SET status = 'approved', approved_at = NOW() 
    WHERE id = req_id;
    
    -- i) Reject other pending requests for this student
    RAISE NOTICE 'approve_room_request: Rejecting student other pending requests...';
    UPDATE public.room_requests 
    SET status = 'rejected' 
    WHERE student_id = request_record.student_id AND id != req_id AND status = 'pending';
    
    -- j) If entire_room booking, reject other pending requests for same room
    IF v_final_booking_type = 'entire_room' THEN
        RAISE NOTICE 'approve_room_request: Rejecting other pending requests for same room...';
        UPDATE public.room_requests 
        SET status = 'rejected' 
        WHERE room_id = request_record.room_id AND id != req_id AND status = 'pending';
    END IF;

    RAISE NOTICE 'approve_room_request: Execution successfully completed';

    -- Return successfully
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Room request approved successfully',
      'allocation_id', allocation_id,
      'room_id', request_record.room_id,
      'student_id', request_record.student_id,
      'booking_type', v_final_booking_type
    );

  EXCEPTION WHEN OTHERS THEN
    -- Capture error details
    GET STACKED DIAGNOSTICS 
        v_state = RETURNED_SQLSTATE,
        v_msg = MESSAGE_TEXT,
        v_detail = PG_EXCEPTION_DETAIL,
        v_hint = PG_EXCEPTION_HINT,
        v_context = PG_EXCEPTION_CONTEXT;
        
    RAISE WARNING 'approve_room_request failed. state=%, msg=%, detail=%, context=%', 
                  v_state, v_msg, v_detail, v_context;
                  
    RETURN jsonb_build_object(
      'success', false,
      'message', v_msg,
      'detail', v_detail,
      'hint', v_hint,
      'code', v_state
    );
  END;
END;
$$;
