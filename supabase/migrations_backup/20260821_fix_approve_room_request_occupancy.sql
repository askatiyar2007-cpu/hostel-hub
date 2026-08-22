-- Fix approve_room_request function to check occupancy against real active allocations
-- instead of relying on rooms.occupancy/rooms.occupied_count columns.
-- This ensures concurrent safety and self-heals rooms columns.

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
  v_actual_occupancy int;
  v_fees_count int;
  
  -- Student profile info for fallback snapshot
  v_student_name TEXT;
  v_student_email TEXT;
  v_student_phone TEXT;
  
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
    
    -- Fetch student profile info for fallback
    SELECT p.full_name, p.email, p.phone_number 
    INTO v_student_name, v_student_email, v_student_phone
    FROM public.students s
    JOIN public.profiles p ON p.id = s.profile_id
    WHERE s.id = request_record.student_id;
    
    -- c) Get room details and lock it
    RAISE NOTICE 'approve_room_request: Fetching room details...';
    SELECT * INTO room_record FROM public.rooms WHERE id = request_record.room_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated room not found';
    END IF;
    
    -- d) Calculate REAL occupancy from active allocations (source of truth)
    SELECT COUNT(*) INTO v_actual_occupancy
    FROM public.room_allocations
    WHERE room_id = request_record.room_id 
      AND active = true;

    RAISE NOTICE 'approve_room_request: Found room: capacity=%, actual active occupancy=%', room_record.capacity, v_actual_occupancy;
    
    -- e) Check booking type and room availability based on REAL occupancy
    -- Normalize booking type to handle all variations
    v_normalized_type := LOWER(TRIM(COALESCE(request_record.booking_type::text, 'shared_bed')));
    
    -- Handle shared bed variations
    IF v_normalized_type IN ('shared_bed', 'shared', 'shared bed', 'sharebed') THEN
        IF (room_record.capacity - v_actual_occupancy) < 1 THEN
            RAISE EXCEPTION 'Room is full';
        END IF;
        v_new_occupied := v_actual_occupancy + 1;
        v_final_booking_type := 'shared_bed'::public.booking_type;
        
    -- Handle entire room variations
    ELSIF v_normalized_type IN ('entire_room', 'entire', 'entire room', 'entireroom', 'full room') THEN
        IF v_actual_occupancy > 0 THEN
            RAISE EXCEPTION 'Entire room is not available (already occupied)';
        END IF;
        v_new_occupied := room_record.capacity;
        v_final_booking_type := 'entire_room'::public.booking_type;
        
    ELSE
        RAISE EXCEPTION 'Invalid booking type: %', request_record.booking_type;
    END IF;
    
    RAISE NOTICE 'approve_room_request: Booking type = %, new occupancy = %', v_final_booking_type, v_new_occupied;
    
    -- f) Verify student doesn't already have active allocation
    RAISE NOTICE 'approve_room_request: Checking if student already has active allocation...';
    SELECT EXISTS (
        SELECT 1 FROM public.room_allocations 
        WHERE student_id = request_record.student_id AND active = true
    ) INTO has_active_alloc;
    
    IF has_active_alloc THEN
        RAISE EXCEPTION 'Student already has an active room allocation';
    END IF;
    
    -- g) Create room allocation
    RAISE NOTICE 'approve_room_request: Inserting into room_allocations...';
    INSERT INTO public.room_allocations (
        student_id, 
        room_id, 
        hostel_id, 
        booking_type, 
        status, 
        active,
        start_date,
        created_at,
        student_name,
        student_email,
        student_phone
    )
    VALUES (
        request_record.student_id, 
        request_record.room_id, 
        request_record.hostel_id, 
        v_final_booking_type, 
        'active', 
        true,
        CURRENT_DATE,
        NOW(),
        COALESCE(request_record.student_name, v_student_name),
        COALESCE(request_record.student_email, v_student_email),
        COALESCE(request_record.student_phone, v_student_phone)
    )
    RETURNING id INTO allocation_id;
    
    RAISE NOTICE 'approve_room_request: room_allocations record inserted with ID=%', allocation_id;

    -- Auto-generate monthly fees for the new allocation
    RAISE NOTICE 'approve_room_request: Generating monthly fees...';
    PERFORM public.create_student_fees(allocation_id);
    
    -- h) Update room occupancy and availability (using v_new_occupied)
    RAISE NOTICE 'approve_room_request: Updating room occupancy...';
    UPDATE public.rooms 
    SET 
        occupied_count = v_new_occupied,
        occupancy = v_new_occupied,
        available = (v_new_occupied < capacity),
        status = CASE WHEN v_new_occupied >= capacity THEN 'occupied' ELSE 'available' END
    WHERE id = request_record.room_id;
    
    -- i) Update room_request status
    RAISE NOTICE 'approve_room_request: Setting request status to approved...';
    UPDATE public.room_requests 
    SET status = 'approved', approved_at = NOW() 
    WHERE id = req_id;
    
    -- j) Reject other pending requests for this student
    RAISE NOTICE 'approve_room_request: Rejecting student other pending requests...';
    UPDATE public.room_requests 
    SET status = 'rejected' 
    WHERE student_id = request_record.student_id AND id != req_id AND status = 'pending';
    
    -- k) If entire_room booking, reject other pending requests for same room
    IF v_final_booking_type = 'entire_room' THEN
        RAISE NOTICE 'approve_room_request: Rejecting other pending requests for same room...';
        UPDATE public.room_requests 
        SET status = 'rejected' 
        WHERE room_id = request_record.room_id AND id != req_id AND status = 'pending';
    END IF;

    -- l) Count the fees that were generated
    SELECT COUNT(*) INTO v_fees_count 
    FROM public.student_fees 
    WHERE allocation_id = allocation_id;

    RAISE NOTICE 'approve_room_request: Execution successfully completed';

    -- Return successfully
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Room request approved successfully',
      'allocation_id', allocation_id,
      'room_id', request_record.room_id,
      'student_id', request_record.student_id,
      'booking_type', v_final_booking_type,
      'fees_count', v_fees_count
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

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
