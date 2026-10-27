-- ============================================================================
-- Migration: 20261028000000_sec06_approve_room_request_hostel_validation.sql
-- Description: SEC-06 - Enforce room-to-hostel validation in public.approve_room_request
-- Target: public.approve_room_request(uuid)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_room_request(
    p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    request_record RECORD;

    room_capacity INT;

    v_allocation_id UUID;

    has_active_alloc BOOLEAN;

    v_normalized_type TEXT;

    v_final_booking_type public.booking_type;

    v_actual_occupancy INT;

    v_fees_count INT;

    v_student_name TEXT;
    v_student_email TEXT;
    v_student_phone TEXT;

    v_state TEXT;
    v_msg TEXT;
    v_detail TEXT;
    v_hint TEXT;
    v_context TEXT;
BEGIN

    RAISE NOTICE
        'approve_room_request: Starting process for request=%',
        p_request_id;


    -- --------------------------------------------------------
    -- Fetch and lock request
    -- --------------------------------------------------------

    SELECT *
    INTO request_record
    FROM public.room_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found';
    END IF;


    -- --------------------------------------------------------
    -- SECURITY: Only hostel owner can approve
    -- --------------------------------------------------------

    IF NOT EXISTS (
        SELECT 1
        FROM public.hostels
        WHERE id = request_record.hostel_id
          AND owner_id = auth.uid()
    ) THEN
        RAISE EXCEPTION
            'Access denied. You are not authorized to approve requests for this hostel.';
    END IF;


    -- --------------------------------------------------------
    -- Request must still be pending
    -- --------------------------------------------------------

    IF request_record.status != 'pending' THEN
        RAISE EXCEPTION 'Request already processed';
    END IF;


    -- --------------------------------------------------------
    -- Get student profile fallback data
    -- --------------------------------------------------------

    SELECT
        p.full_name,
        p.email,
        p.phone_number
    INTO
        v_student_name,
        v_student_email,
        v_student_phone
    FROM public.students s
    JOIN public.profiles p
        ON p.id = s.profile_id
    WHERE s.id = request_record.student_id;


    -- --------------------------------------------------------
    -- Lock room (SEC-06: strictly require room belongs to requested hostel)
    -- --------------------------------------------------------

    SELECT capacity
    INTO room_capacity
    FROM public.rooms
    WHERE id = request_record.room_id
      AND hostel_id = request_record.hostel_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated room does not belong to this hostel or does not exist';
    END IF;


    -- --------------------------------------------------------
    -- Calculate REAL occupancy
    -- --------------------------------------------------------

    v_actual_occupancy :=
        public.get_room_actual_occupancy(
            request_record.room_id
        );


    -- --------------------------------------------------------
    -- Normalize booking type
    -- --------------------------------------------------------

    v_normalized_type :=
        LOWER(
            TRIM(
                COALESCE(
                    request_record.booking_type::TEXT,
                    'shared_bed'
                )
            )
        );


    -- --------------------------------------------------------
    -- SHARED BED
    -- --------------------------------------------------------

    IF v_normalized_type IN (
        'shared_bed',
        'shared',
        'shared bed',
        'sharebed'
    ) THEN

        IF (room_capacity - v_actual_occupancy) < 1 THEN
            RAISE EXCEPTION 'Room is full';
        END IF;

        v_final_booking_type :=
            'shared_bed'::public.booking_type;


    -- --------------------------------------------------------
    -- ENTIRE ROOM
    -- --------------------------------------------------------

    ELSIF v_normalized_type IN (
        'entire_room',
        'entire',
        'entire room',
        'entireroom',
        'full room'
    ) THEN

        IF v_actual_occupancy > 0 THEN
            RAISE EXCEPTION
                'Entire room is not available (already occupied)';
        END IF;

        v_final_booking_type :=
            'entire_room'::public.booking_type;


    ELSE

        RAISE EXCEPTION
            'Invalid booking type: %',
            request_record.booking_type;

    END IF;


    -- --------------------------------------------------------
    -- Student cannot already have active allocation
    -- --------------------------------------------------------

    SELECT EXISTS (
        SELECT 1
        FROM public.room_allocations
        WHERE student_id = request_record.student_id
          AND active = true
    )
    INTO has_active_alloc;

    IF has_active_alloc THEN
        RAISE EXCEPTION
            'Student already has an active room allocation';
    END IF;


    -- --------------------------------------------------------
    -- Create allocation
    -- --------------------------------------------------------

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
        COALESCE(
            request_record.student_name,
            v_student_name
        ),
        COALESCE(
            request_record.student_email,
            v_student_email
        ),
        COALESCE(
            request_record.student_phone,
            v_student_phone
        )
    )
    RETURNING id
    INTO v_allocation_id;


    -- --------------------------------------------------------
    -- Generate fees
    -- --------------------------------------------------------

    PERFORM public.create_student_fees(
        v_allocation_id
    );


    -- --------------------------------------------------------
    -- Sync room occupancy
    -- --------------------------------------------------------

    PERFORM public.sync_room_occupancy(
        request_record.room_id
    );


    -- --------------------------------------------------------
    -- Approve request
    -- --------------------------------------------------------

    UPDATE public.room_requests
    SET
        status = 'approved',
        approved_at = NOW()
    WHERE id = p_request_id;


    -- --------------------------------------------------------
    -- Reject student's other pending requests
    -- --------------------------------------------------------

    UPDATE public.room_requests
    SET status = 'rejected'
    WHERE student_id = request_record.student_id
      AND id != p_request_id
      AND status = 'pending';


    -- --------------------------------------------------------
    -- Entire-room booking blocks other requests
    -- --------------------------------------------------------

    IF v_final_booking_type =
       'entire_room'::public.booking_type THEN

        UPDATE public.room_requests
        SET status = 'rejected'
        WHERE room_id = request_record.room_id
          AND id != p_request_id
          AND status = 'pending';

    END IF;


    -- --------------------------------------------------------
    -- Count generated fees
    -- --------------------------------------------------------

    SELECT COUNT(*)
    INTO v_fees_count
    FROM public.student_fees sf
    WHERE sf.allocation_id = v_allocation_id;


    RETURN jsonb_build_object(
        'success', true,
        'message', 'Room request approved successfully',
        'allocation_id', v_allocation_id,
        'room_id', request_record.room_id,
        'student_id', request_record.student_id,
        'booking_type', v_final_booking_type,
        'fees_count', v_fees_count
    );


EXCEPTION
    WHEN OTHERS THEN

        GET STACKED DIAGNOSTICS
            v_state = RETURNED_SQLSTATE,
            v_msg = MESSAGE_TEXT,
            v_detail = PG_EXCEPTION_DETAIL,
            v_hint = PG_EXCEPTION_HINT,
            v_context = PG_EXCEPTION_CONTEXT;

        RAISE WARNING
            'approve_room_request failed. state=%, msg=%, detail=%, context=%',
            v_state,
            v_msg,
            v_detail,
            v_context;

        RETURN jsonb_build_object(
            'success', false,
            'message', v_msg,
            'detail', v_detail,
            'hint', v_hint,
            'code', v_state
        );

END;
$$;

-- Preserve privilege hardening (from 20261002010000_phase3c1_approve_room_request_revoke_anon.sql)
REVOKE EXECUTE ON FUNCTION public.approve_room_request(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_room_request(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.approve_room_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_room_request(UUID) TO service_role;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
