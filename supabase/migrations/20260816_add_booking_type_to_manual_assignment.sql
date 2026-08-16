-- Update create_manual_assignment_with_invite to support booking_type
-- This migration adds booking type support to the manual assignment RPC

CREATE OR REPLACE FUNCTION public.create_manual_assignment_with_invite(
    p_hostel_id UUID,
    p_room_id UUID,
    p_student_name TEXT,
    p_student_email TEXT,
    p_student_phone TEXT,
    p_parent_name TEXT,
    p_parent_phone TEXT,
    p_parent_email TEXT,
    p_address TEXT,
    p_emergency_name TEXT,
    p_emergency_phone TEXT,
    p_start_date DATE,
    p_token_hash TEXT,
    p_expires_at TIMESTAMPTZ,
    p_owner_id UUID,
    p_booking_type public.booking_type DEFAULT 'shared_bed'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_student_id UUID;
    v_existing_student_id UUID;
    v_existing_profile_id UUID;
    v_allocation_id UUID;
    v_request_id UUID;
    v_invitation_id UUID;
    v_room_capacity INT;
    v_room_occupancy INT;
    v_has_active_alloc BOOLEAN;
    v_assign_result JSON;
    v_normalized_type text;
    v_new_occupied int;
    v_final_booking_type public.booking_type;
BEGIN
    -- a) Verify hostel ownership
    IF NOT EXISTS (
        SELECT 1 FROM public.hostels 
        WHERE id = p_hostel_id AND owner_id = p_owner_id
    ) THEN
        RAISE EXCEPTION 'You do not own this hostel';
    END IF;

    -- b) Verify room belongs to hostel
    IF NOT EXISTS (
        SELECT 1 FROM public.rooms 
        WHERE id = p_room_id AND hostel_id = p_hostel_id
    ) THEN
        RAISE EXCEPTION 'Room does not belong to this hostel';
    END IF;

    -- c) Verify room has capacity (Lock row for update)
    SELECT capacity, occupancy INTO v_room_capacity, v_room_occupancy 
    FROM public.rooms 
    WHERE id = p_room_id FOR UPDATE;

    -- d) Check booking type and room availability
    -- Normalize booking type to handle all variations
    v_normalized_type := LOWER(TRIM(COALESCE(p_booking_type::text, 'shared_bed')));

    -- Handle shared bed variations
    IF v_normalized_type IN ('shared_bed', 'shared', 'shared bed', 'sharebed') THEN
        IF (v_room_capacity - COALESCE(v_room_occupancy, 0)) < 1 THEN
            RAISE EXCEPTION 'Room is full';
        END IF;
        v_new_occupied := COALESCE(v_room_occupancy, 0) + 1;
        v_final_booking_type := 'shared_bed'::public.booking_type;

    -- Handle entire room variations
    ELSIF v_normalized_type IN ('entire_room', 'entire', 'entire room', 'entireroom', 'full room') THEN
        IF COALESCE(v_room_occupancy, 0) > 0 THEN
            RAISE EXCEPTION 'Entire room is not available (already occupied)';
        END IF;
        v_new_occupied := v_room_capacity;
        v_final_booking_type := 'entire_room'::public.booking_type;

    ELSE
        RAISE EXCEPTION 'Invalid booking type: %', p_booking_type;
    END IF;

    -- e) Check if student already exists by email
    SELECT id INTO v_existing_profile_id 
    FROM public.profiles 
    WHERE LOWER(email) = LOWER(TRIM(p_student_email));

    IF v_existing_profile_id IS NOT NULL THEN
        -- Find student record linked to profile
        SELECT id INTO v_existing_student_id 
        FROM public.students 
        WHERE profile_id = v_existing_profile_id;
    ELSE
        -- Find pending student record with this email
        SELECT id INTO v_existing_student_id 
        FROM public.students 
        WHERE LOWER(student_email) = LOWER(TRIM(p_student_email)) AND profile_id IS NULL;
    END IF;

    -- f) If student exists, check for active allocation
    IF v_existing_student_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.room_allocations 
            WHERE student_id = v_existing_student_id AND active = true
        ) INTO v_has_active_alloc;

        IF v_has_active_alloc THEN
            RAISE EXCEPTION 'Student with this email already has an active room allocation';
        END IF;

        v_student_id := v_existing_student_id;
    ELSE
        -- Create a new pending student record
        INSERT INTO public.students (
            id,
            profile_id,
            status,
            student_name,
            student_email,
            admission_date
        ) VALUES (
            gen_random_uuid(),
            NULL,
            'pending',
            p_student_name,
            LOWER(TRIM(p_student_email)),
            p_start_date
        ) RETURNING id INTO v_student_id;
    END IF;

    -- g) Create the pre-approved room request to store parent, address, and emergency details
    INSERT INTO public.room_requests (
        student_id,
        hostel_id,
        room_id,
        parent_name,
        parent_phone,
        parent_email,
        address,
        emergency_contact,
        status,
        booking_type,
        student_name,
        student_email,
        student_phone,
        created_at
    ) VALUES (
        v_student_id,
        p_hostel_id,
        p_room_id,
        p_parent_name,
        p_parent_phone,
        p_parent_email,
        p_address,
        p_emergency_name || ' - ' || p_emergency_phone,
        'approved',
        v_final_booking_type,
        p_student_name,
        LOWER(TRIM(p_student_email)),
        p_student_phone,
        NOW()
    ) RETURNING id INTO v_request_id;

    -- h) Allocate the room using existing assign_student_to_room RPC with booking type
    -- Since assign_student_to_room doesn't support booking_type, we'll insert directly and update occupancy manually
    INSERT INTO public.room_allocations (
        student_id,
        room_id,
        hostel_id,
        start_date,
        active,
        status,
        booking_type,
        created_at,
        student_name,
        student_email,
        student_phone
    )
    VALUES (
        v_student_id,
        p_room_id,
        p_hostel_id,
        p_start_date,
        true,
        'active',
        v_final_booking_type,
        NOW(),
        p_student_name,
        LOWER(TRIM(p_student_email)),
        p_student_phone
    )
    RETURNING id INTO v_allocation_id;

    -- i) Update room occupancy based on booking type
    IF v_final_booking_type = 'entire_room'::public.booking_type THEN
        -- For entire room, set occupancy to full capacity
        UPDATE public.rooms 
        SET occupied_count = v_room_capacity,
            occupancy = v_room_capacity
        WHERE id = p_room_id;
    ELSE
        -- For shared bed, increment by 1
        UPDATE public.rooms 
        SET occupied_count = COALESCE(occupied_count, 0) + 1,
            occupancy = COALESCE(occupied_count, 0) + 1
        WHERE id = p_room_id;
    END IF;

    -- j) Generate 12 months of student fees using the existing create_student_fees RPC
    PERFORM public.create_student_fees(v_allocation_id);

    -- k) Create the invitation record
    INSERT INTO public.student_invitations (
        student_id,
        email,
        token_hash,
        expires_at
    ) VALUES (
        v_student_id,
        LOWER(TRIM(p_student_email)),
        p_token_hash,
        p_expires_at
    ) RETURNING id INTO v_invitation_id;

    -- l) Return JSON with status details
    RETURN json_build_object(
        'success', true,
        'student_id', v_student_id,
        'allocation_id', v_allocation_id,
        'request_id', v_request_id,
        'invitation_id', v_invitation_id,
        'booking_type', v_final_booking_type::text
    );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.create_manual_assignment_with_invite TO authenticated;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';