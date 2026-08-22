-- Ensure database columns exist with correct types
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS occupied_count INTEGER DEFAULT 0;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS occupancy INTEGER DEFAULT 0;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 1;

ALTER TABLE public.room_allocations ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

ALTER TABLE public.student_fees ADD COLUMN IF NOT EXISTS month_year TEXT;

-- Update column types explicitly just in case they were different
ALTER TABLE public.rooms ALTER COLUMN occupied_count SET DATA TYPE INTEGER;
ALTER TABLE public.rooms ALTER COLUMN occupancy SET DATA TYPE INTEGER;
ALTER TABLE public.rooms ALTER COLUMN capacity SET DATA TYPE INTEGER;
ALTER TABLE public.room_allocations ALTER COLUMN active SET DATA TYPE BOOLEAN;
ALTER TABLE public.student_fees ALTER COLUMN month_year SET DATA TYPE TEXT;

-- Update existing records if necessary
UPDATE public.rooms SET capacity = 1 WHERE capacity IS NULL;
UPDATE public.rooms SET occupied_count = 0 WHERE occupied_count IS NULL;
UPDATE public.rooms SET occupancy = 0 WHERE occupancy IS NULL;
UPDATE public.room_allocations SET active = true WHERE active IS NULL;

-- Restore profiles update policy
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
CREATE POLICY "Profiles update policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Restore students insert and update policies
DROP POLICY IF EXISTS "Students insert policy" ON public.students;
CREATE POLICY "Students insert policy" ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Students update policy" ON public.students;
CREATE POLICY "Students update policy" ON public.students
  FOR UPDATE TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Recreate create_student_fees RPC to generate exactly 12 months (Loop 0..11) and include month_year
CREATE OR REPLACE FUNCTION public.create_student_fees(p_allocation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_student_id uuid;
    v_hostel_id uuid;
    v_room_id uuid;
    v_rent numeric;
    v_start_date date;
    v_day int;
    v_due_date date;
    v_billing_period text;
    v_month_year text;
    i int;
BEGIN
    -- Fetch allocation and room info
    SELECT ra.student_id, ra.hostel_id, ra.room_id, ra.start_date, r.rent
    INTO v_student_id, v_hostel_id, v_room_id, v_start_date, v_rent
    FROM public.room_allocations ra
    JOIN public.rooms r ON r.id = ra.room_id
    WHERE ra.id = p_allocation_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Room allocation not found.';
    END IF;

    -- Extract day of the month for due date (default to 15th if parsing fails, cap at 28)
    v_day := LEAST(COALESCE(EXTRACT(DAY FROM v_start_date)::int, 15), 28);

    -- Generate fees for exactly 12 months (current month + 11 future months)
    FOR i IN 0..11 LOOP
        -- Calculate due date
        v_due_date := (date_trunc('month', v_start_date + (i || ' month')::interval) + (v_day - 1 || ' days')::interval)::date;
        v_billing_period := TRIM(to_char(v_due_date, 'Month YYYY'));
        v_month_year := to_char(v_due_date, 'YYYY-MM');

        -- Insert fee
        INSERT INTO public.student_fees (
            allocation_id,
            student_id,
            hostel_id,
            amount,
            due_date,
            billing_period,
            month_year,
            status
        )
        VALUES (
            p_allocation_id,
            v_student_id,
            v_hostel_id,
            v_rent,
            v_due_date,
            v_billing_period,
            v_month_year,
            'pending'
        )
        ON CONFLICT DO NOTHING; -- prevent duplicates if rerun
    END LOOP;

    -- Create notification for student
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT p.user_id, 'Fees Schedule Generated', 'Your monthly fees schedule has been generated for the next 12 months.', 'fees'
    FROM public.students s
    JOIN public.profiles p ON p.id = s.profile_id
    WHERE s.id = v_student_id;
END;
$$;

-- Recreate approve_room_request RPC to fix occupancy update:
-- UPDATE rooms SET occupied_count = occupied_count + 1
-- UPDATE rooms SET occupancy = occupied_count
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
    
    -- g) Update room occupancy and availability (using occupied_count + 1 and occupancy = occupied_count)
    RAISE NOTICE 'approve_room_request: Updating room occupancy...';
    UPDATE public.rooms 
    SET 
        occupied_count = COALESCE(occupied_count, 0) + 1,
        occupancy = COALESCE(occupied_count, 0) + 1,
        available = (COALESCE(occupied_count, 0) + 1 < capacity),
        status = CASE WHEN COALESCE(occupied_count, 0) + 1 >= capacity THEN 'occupied' ELSE 'available' END
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

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
