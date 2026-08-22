-- Migration: Fix room occupancy, booking logic, and checkout logic
-- Target: public

-- ============================================================
-- 1. DROP EXISTING FUNCTIONS
-- ============================================================

DROP FUNCTION IF EXISTS public.approve_room_request(uuid);

DROP FUNCTION IF EXISTS public.checkout_student(uuid);
DROP FUNCTION IF EXISTS public.checkout_student(uuid, uuid, numeric);

DROP FUNCTION IF EXISTS public.create_manual_assignment_with_invite(
    uuid, uuid, text, text, text, text, text, text, text, text, text,
    date, text, timestamptz, uuid, public.booking_type
);

DROP FUNCTION IF EXISTS public.get_room_actual_occupancy(uuid);
DROP FUNCTION IF EXISTS public.sync_room_occupancy(uuid);


-- ============================================================
-- 2. ENSURE PAYMENTS TABLE HAS REQUIRED COLUMNS
-- ============================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS allocation_id UUID,
  ADD COLUMN IF NOT EXISTS hostel_id UUID,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC,
  ADD COLUMN IF NOT EXISTS student_fees_id UUID,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS gateway_order_id TEXT,
  ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS gateway_signature TEXT,
  ADD COLUMN IF NOT EXISTS paid_date TIMESTAMPTZ DEFAULT now();


-- ============================================================
-- 3. GET REAL ROOM OCCUPANCY
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_room_actual_occupancy(
    p_room_id UUID
)
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_capacity INT;
    v_has_entire_room BOOLEAN;
    v_active_allocs_count INT;
BEGIN
    SELECT capacity
    INTO v_capacity
    FROM public.rooms
    WHERE id = p_room_id;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.room_allocations
        WHERE room_id = p_room_id
          AND active = true
          AND booking_type = 'entire_room'::public.booking_type
    )
    INTO v_has_entire_room;

    IF v_has_entire_room THEN
        RETURN v_capacity;
    END IF;

    SELECT COUNT(*)
    INTO v_active_allocs_count
    FROM public.room_allocations
    WHERE room_id = p_room_id
      AND active = true;

    RETURN v_active_allocs_count;
END;
$$;

REVOKE EXECUTE
ON FUNCTION public.get_room_actual_occupancy(UUID)
FROM PUBLIC;


-- ============================================================
-- 4. SYNC ROOM OCCUPANCY
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_room_occupancy(
    p_room_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_capacity INT;
    v_new_occupancy INT;
BEGIN
    SELECT capacity
    INTO v_capacity
    FROM public.rooms
    WHERE id = p_room_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_new_occupancy :=
        public.get_room_actual_occupancy(p_room_id);

    UPDATE public.rooms
    SET
        occupied_count = v_new_occupancy,
        occupancy = v_new_occupancy,
        available = (v_new_occupancy < v_capacity),
        status = CASE
            WHEN v_new_occupancy >= v_capacity
                THEN 'occupied'
            ELSE 'available'
        END
    WHERE id = p_room_id;
END;
$$;

REVOKE EXECUTE
ON FUNCTION public.sync_room_occupancy(UUID)
FROM PUBLIC;


-- ============================================================
-- 5. APPROVE ROOM REQUEST
-- ============================================================

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
    -- Lock room
    -- --------------------------------------------------------

    SELECT capacity
    INTO room_capacity
    FROM public.rooms
    WHERE id = request_record.room_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated room not found';
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

REVOKE EXECUTE
ON FUNCTION public.approve_room_request(UUID)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.approve_room_request(UUID)
TO authenticated;


-- ============================================================
-- 6. MANUAL ASSIGNMENT WITH INVITE
-- ============================================================

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
    v_actual_occupancy INT;

    v_has_active_alloc BOOLEAN;

    v_normalized_type TEXT;
    v_final_booking_type public.booking_type;
BEGIN

    -- --------------------------------------------------------
    -- Verify hostel ownership
    -- --------------------------------------------------------

    IF NOT EXISTS (
        SELECT 1
        FROM public.hostels
        WHERE id = p_hostel_id
          AND owner_id = p_owner_id
    ) THEN
        RAISE EXCEPTION
            'You do not own this hostel';
    END IF;


    -- --------------------------------------------------------
    -- Verify room belongs to hostel
    -- --------------------------------------------------------

    IF NOT EXISTS (
        SELECT 1
        FROM public.rooms
        WHERE id = p_room_id
          AND hostel_id = p_hostel_id
    ) THEN
        RAISE EXCEPTION
            'Room does not belong to this hostel';
    END IF;


    -- --------------------------------------------------------
    -- Lock room
    -- --------------------------------------------------------

    SELECT capacity
    INTO v_room_capacity
    FROM public.rooms
    WHERE id = p_room_id
    FOR UPDATE;


    -- --------------------------------------------------------
    -- Calculate real occupancy
    -- --------------------------------------------------------

    v_actual_occupancy :=
        public.get_room_actual_occupancy(
            p_room_id
        );


    -- --------------------------------------------------------
    -- Normalize booking type
    -- --------------------------------------------------------

    v_normalized_type :=
        LOWER(
            TRIM(
                COALESCE(
                    p_booking_type::TEXT,
                    'shared_bed'
                )
            )
        );


    -- --------------------------------------------------------
    -- Shared bed
    -- --------------------------------------------------------

    IF v_normalized_type IN (
        'shared_bed',
        'shared',
        'shared bed',
        'sharebed'
    ) THEN

        IF (v_room_capacity - v_actual_occupancy) < 1 THEN
            RAISE EXCEPTION 'Room is full';
        END IF;

        v_final_booking_type :=
            'shared_bed'::public.booking_type;


    -- --------------------------------------------------------
    -- Entire room
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
            p_booking_type;

    END IF;


    -- --------------------------------------------------------
    -- Find existing profile
    -- --------------------------------------------------------

    SELECT id
    INTO v_existing_profile_id
    FROM public.profiles
    WHERE LOWER(email) =
          LOWER(TRIM(p_student_email));


    IF v_existing_profile_id IS NOT NULL THEN

        SELECT id
        INTO v_existing_student_id
        FROM public.students
        WHERE profile_id = v_existing_profile_id;

    ELSE

        SELECT id
        INTO v_existing_student_id
        FROM public.students
        WHERE LOWER(student_email) =
              LOWER(TRIM(p_student_email))
          AND profile_id IS NULL;

    END IF;


    -- --------------------------------------------------------
    -- Existing student
    -- --------------------------------------------------------

    IF v_existing_student_id IS NOT NULL THEN

        SELECT EXISTS (
            SELECT 1
            FROM public.room_allocations
            WHERE student_id = v_existing_student_id
              AND active = true
        )
        INTO v_has_active_alloc;


        IF v_has_active_alloc THEN
            RAISE EXCEPTION
                'Student with this email already has an active room allocation';
        END IF;


        v_student_id :=
            v_existing_student_id;


    ELSE

        -- ----------------------------------------------------
        -- Create pending student
        -- ----------------------------------------------------

        INSERT INTO public.students (
            id,
            profile_id,
            status,
            student_name,
            student_email,
            admission_date
        )
        VALUES (
            gen_random_uuid(),
            NULL,
            'pending',
            p_student_name,
            LOWER(TRIM(p_student_email)),
            p_start_date
        )
        RETURNING id
        INTO v_student_id;

    END IF;


    -- --------------------------------------------------------
    -- Create pre-approved room request
    -- --------------------------------------------------------

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
    )
    VALUES (
        v_student_id,
        p_hostel_id,
        p_room_id,
        p_parent_name,
        p_parent_phone,
        p_parent_email,
        p_address,
        p_emergency_name || ' - ' ||
            p_emergency_phone,
        'approved',
        v_final_booking_type,
        p_student_name,
        LOWER(TRIM(p_student_email)),
        p_student_phone,
        NOW()
    )
    RETURNING id
    INTO v_request_id;


    -- --------------------------------------------------------
    -- Create allocation
    -- --------------------------------------------------------

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
    RETURNING id
    INTO v_allocation_id;


    -- --------------------------------------------------------
    -- Sync occupancy
    -- --------------------------------------------------------

    PERFORM public.sync_room_occupancy(
        p_room_id
    );


    -- --------------------------------------------------------
    -- Generate fees
    -- --------------------------------------------------------

    PERFORM public.create_student_fees(
        v_allocation_id
    );


    -- --------------------------------------------------------
    -- Create invitation
    -- --------------------------------------------------------

    INSERT INTO public.student_invitations (
        student_id,
        email,
        token_hash,
        expires_at
    )
    VALUES (
        v_student_id,
        LOWER(TRIM(p_student_email)),
        p_token_hash,
        p_expires_at
    )
    RETURNING id
    INTO v_invitation_id;


    RETURN json_build_object(
        'success', true,
        'student_id', v_student_id,
        'allocation_id', v_allocation_id,
        'request_id', v_request_id,
        'invitation_id', v_invitation_id,
        'booking_type',
            v_final_booking_type::TEXT
    );

END;
$$;

REVOKE EXECUTE
ON FUNCTION public.create_manual_assignment_with_invite(
    UUID,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT,
    TIMESTAMPTZ,
    UUID,
    public.booking_type
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.create_manual_assignment_with_invite(
    UUID,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT,
    TIMESTAMPTZ,
    UUID,
    public.booking_type
)
TO authenticated;


-- ============================================================
-- 7. CHECKOUT BY ALLOCATION ID
-- ============================================================

CREATE OR REPLACE FUNCTION public.checkout_student(
    p_alloc_id UUID
)
RETURNS TABLE (
    payment_id UUID,
    order_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    r_alloc RECORD;

    v_student_id UUID;
    v_hostel_id UUID;

    v_fee_id UUID;
    v_amount NUMERIC;

    v_order_id TEXT;
BEGIN

    IF p_alloc_id IS NULL THEN
        RAISE EXCEPTION
            'allocation_id (p_alloc_id) is required.';
    END IF;


    -- --------------------------------------------------------
    -- Lock allocation
    -- --------------------------------------------------------

    SELECT *
    INTO r_alloc
    FROM public.room_allocations
    WHERE id = p_alloc_id
    FOR UPDATE;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Allocation with ID % not found.',
            p_alloc_id;
    END IF;


    IF NOT r_alloc.active THEN
        RAISE EXCEPTION
            'Allocation % is already inactive.',
            p_alloc_id;
    END IF;


    v_student_id := r_alloc.student_id;
    v_hostel_id := r_alloc.hostel_id;


    -- --------------------------------------------------------
    -- Find pending fee
    -- --------------------------------------------------------

    SELECT
        sf.id,
        sf.amount
    INTO
        v_fee_id,
        v_amount
    FROM public.student_fees sf
    WHERE sf.allocation_id = p_alloc_id
      AND sf.status = 'pending'
    LIMIT 1;


    -- --------------------------------------------------------
    -- Fallback to room rent
    -- --------------------------------------------------------

    IF v_fee_id IS NULL THEN

        SELECT r.rent
        INTO v_amount
        FROM public.rooms r
        WHERE r.id = r_alloc.room_id;

    END IF;


    v_amount :=
        COALESCE(v_amount, 0);


    -- --------------------------------------------------------
    -- Deactivate allocation
    -- --------------------------------------------------------

    UPDATE public.room_allocations
    SET
        active = false,
        end_date = CURRENT_DATE
    WHERE id = p_alloc_id;


    -- --------------------------------------------------------
    -- Sync occupancy
    -- --------------------------------------------------------

    PERFORM public.sync_room_occupancy(
        r_alloc.room_id
    );


    -- --------------------------------------------------------
    -- Generate order ID
    -- --------------------------------------------------------

    v_order_id :=
        'mock_order_' ||
        gen_random_uuid();


    -- --------------------------------------------------------
    -- Create pending payment
    -- --------------------------------------------------------

    INSERT INTO public.payments (
        student_id,
        allocation_id,
        hostel_id,
        amount_paid,
        student_fees_id,
        payment_status,
        payment_method,
        gateway_order_id,
        paid_date,
        created_at
    )
    VALUES (
        v_student_id,
        p_alloc_id,
        v_hostel_id,
        v_amount,
        v_fee_id,
        'pending',
        'online',
        v_order_id,
        NOW(),
        NOW()
    )
    RETURNING id
    INTO payment_id;


    order_id :=
        v_order_id;

    RETURN NEXT;

END;
$$;

REVOKE EXECUTE
ON FUNCTION public.checkout_student(UUID)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.checkout_student(UUID)
TO authenticated;


-- ============================================================
-- 8. CHECKOUT BY STUDENT + FEE + AMOUNT
-- ============================================================

CREATE OR REPLACE FUNCTION public.checkout_student(
    p_student_id UUID,
    p_fee_id UUID,
    p_amount NUMERIC
)
RETURNS TABLE (
    payment_id UUID,
    order_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_order_id TEXT :=
        'mock_order_' ||
        gen_random_uuid();

    v_alloc_id UUID;
    v_hostel_id UUID;

    r_alloc RECORD;
BEGIN

    IF p_student_id IS NULL THEN
        RAISE EXCEPTION
            'student_id is required.';
    END IF;


    -- --------------------------------------------------------
    -- Resolve allocation from fee
    -- --------------------------------------------------------

    IF p_fee_id IS NOT NULL THEN

        SELECT
            allocation_id,
            hostel_id
        INTO
            v_alloc_id,
            v_hostel_id
        FROM public.student_fees
        WHERE id = p_fee_id;

    END IF;


    -- --------------------------------------------------------
    -- Fallback to student's active allocation
    -- --------------------------------------------------------

    IF v_alloc_id IS NULL THEN

        SELECT
            id,
            hostel_id
        INTO
            v_alloc_id,
            v_hostel_id
        FROM public.room_allocations
        WHERE student_id = p_student_id
          AND active = true
        LIMIT 1;

    END IF;


    IF v_alloc_id IS NULL THEN
        RAISE EXCEPTION
            'Active room allocation not found for student %',
            p_student_id;
    END IF;


    -- --------------------------------------------------------
    -- Lock allocation
    -- --------------------------------------------------------

    SELECT *
    INTO r_alloc
    FROM public.room_allocations
    WHERE id = v_alloc_id
    FOR UPDATE;


    IF NOT r_alloc.active THEN
        RAISE EXCEPTION
            'Allocation % is already inactive.',
            v_alloc_id;
    END IF;


    -- --------------------------------------------------------
    -- Deactivate allocation
    -- --------------------------------------------------------

    UPDATE public.room_allocations
    SET
        active = false,
        end_date = CURRENT_DATE
    WHERE id = v_alloc_id;


    -- --------------------------------------------------------
    -- Sync occupancy
    -- --------------------------------------------------------

    PERFORM public.sync_room_occupancy(
        r_alloc.room_id
    );


    -- --------------------------------------------------------
    -- Create pending payment
    -- --------------------------------------------------------

    INSERT INTO public.payments (
        student_id,
        allocation_id,
        hostel_id,
        amount_paid,
        student_fees_id,
        payment_status,
        payment_method,
        gateway_order_id,
        paid_date,
        created_at
    )
    VALUES (
        p_student_id,
        v_alloc_id,
        v_hostel_id,
        p_amount,
        p_fee_id,
        'pending',
        'online',
        v_order_id,
        NOW(),
        NOW()
    )
    RETURNING id
    INTO payment_id;


    order_id :=
        v_order_id;

    RETURN NEXT;

END;
$$;

REVOKE EXECUTE
ON FUNCTION public.checkout_student(UUID, UUID, NUMERIC)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.checkout_student(UUID, UUID, NUMERIC)
TO authenticated;


-- ============================================================
-- 9. REFRESH POSTGREST SCHEMA CACHE
-- ============================================================

NOTIFY pgrst, 'reload schema';