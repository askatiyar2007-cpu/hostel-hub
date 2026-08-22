


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."app_role" AS ENUM (
    'super_admin',
    'hostel_owner',
    'student',
    'parent'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."bill_status" AS ENUM (
    'pending',
    'paid',
    'overdue',
    'cancelled',
    'failed'
);


ALTER TYPE "public"."bill_status" OWNER TO "postgres";


CREATE TYPE "public"."bill_type" AS ENUM (
    'rent',
    'electricity',
    'deposit',
    'mess',
    'maintenance',
    'other'
);


ALTER TYPE "public"."bill_type" OWNER TO "postgres";


CREATE TYPE "public"."booking_type" AS ENUM (
    'shared_bed',
    'entire_room'
);


ALTER TYPE "public"."booking_type" OWNER TO "postgres";


CREATE TYPE "public"."complaint_category" AS ENUM (
    'electrical',
    'plumbing',
    'wifi',
    'cleaning',
    'furniture',
    'security',
    'other'
);


ALTER TYPE "public"."complaint_category" OWNER TO "postgres";


CREATE TYPE "public"."complaint_status" AS ENUM (
    'open',
    'assigned',
    'in_progress',
    'resolved',
    'closed'
);


ALTER TYPE "public"."complaint_status" OWNER TO "postgres";


CREATE TYPE "public"."hostel_status" AS ENUM (
    'pending',
    'approved',
    'suspended'
);


ALTER TYPE "public"."hostel_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'paid',
    'overdue',
    'cancelled'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."request_status" AS ENUM (
    'open',
    'assigned',
    'in_progress',
    'resolved',
    'closed'
);


ALTER TYPE "public"."request_status" OWNER TO "postgres";


CREATE TYPE "public"."room_status" AS ENUM (
    'available',
    'occupied',
    'maintenance'
);


ALTER TYPE "public"."room_status" OWNER TO "postgres";


CREATE TYPE "public"."room_type" AS ENUM (
    'single',
    'double',
    'triple',
    'quad'
);


ALTER TYPE "public"."room_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'hostel_owner',
    'student',
    'parent'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_room_request"("p_request_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."approve_room_request"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_student_to_room"("p_student_id" "uuid", "p_room_id" "uuid", "p_hostel_id" "uuid", "p_start_date" "date", "p_student_name" "text" DEFAULT NULL::"text", "p_student_email" "text" DEFAULT NULL::"text", "p_student_phone" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_room RECORD;
    v_hostel_owner UUID;
    v_active_count INTEGER;
    v_existing_allocation UUID;
    v_new_alloc_id UUID;
    v_fees_count INTEGER;
BEGIN
    /*
     * 1. Verify that the hostel belongs to the authenticated owner.
     */
    SELECT h.owner_id
    INTO v_hostel_owner
    FROM public.hostels h
    WHERE h.id = p_hostel_id;

    IF v_hostel_owner IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Hostel not found'
        );
    END IF;

    IF v_hostel_owner <> auth.uid() THEN
        RETURN json_build_object(
            'success', false,
            'error', 'You are not authorized to assign students in this hostel'
        );
    END IF;


    /*
     * 2. Lock the room row.
     *
     * This prevents two simultaneous assignments from
     * both taking the last available bed.
     */
    SELECT
        r.id,
        r.hostel_id,
        r.capacity
    INTO v_room
    FROM public.rooms r
    WHERE r.id = p_room_id
    FOR UPDATE;

    IF v_room.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Room not found'
        );
    END IF;


    /*
     * 3. Make sure the room actually belongs to
     *    the hostel supplied to the function.
     */
    IF v_room.hostel_id <> p_hostel_id THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Room does not belong to the selected hostel'
        );
    END IF;


    /*
     * 4. Count CURRENT occupants only.
     *
     * Historical checked-out allocations do not count.
     */
    SELECT COUNT(*)
    INTO v_active_count
    FROM public.room_allocations ra
    WHERE ra.room_id = p_room_id
      AND ra.status = 'active'
      AND ra.active = true;


    /*
     * 5. Enforce room capacity at the database level.
     */
    IF v_active_count >= v_room.capacity THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Room is full',
            'capacity', v_room.capacity,
            'occupied', v_active_count,
            'available_beds', 0
        );
    END IF;


    /*
     * 6. A student cannot have two active room allocations.
     */
    SELECT ra.id
    INTO v_existing_allocation
    FROM public.room_allocations ra
    WHERE ra.student_id = p_student_id
      AND ra.status = 'active'
      AND ra.active = true
    LIMIT 1;

    IF v_existing_allocation IS NOT NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Student already has an active room allocation',
            'allocation_id', v_existing_allocation::text
        );
    END IF;


    /*
     * 7. Create the allocation.
     */
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
        p_student_id,
        p_room_id,
        p_hostel_id,
        p_start_date,
        true,
        'active',
        'shared_bed',
        NOW(),
        p_student_name,
        p_student_email,
        p_student_phone
    )
    RETURNING id INTO v_new_alloc_id;


    /*
     * 8. Create the 12 scheduled fees.
     */
    INSERT INTO public.student_fees (
        student_id,
        allocation_id,
        room_id,
        hostel_id,
        month_year,
        amount_due,
        amount,
        due_date,
        status,
        created_at
    )
    SELECT
        p_student_id,
        v_new_alloc_id,
        p_room_id,
        p_hostel_id,
        TO_CHAR(
            p_start_date + (i || ' months')::INTERVAL,
            'YYYY-MM'
        ),
        5000,
        5000,
        (
            p_start_date + (i || ' months')::INTERVAL
        )::DATE + INTERVAL '14 days',
        'pending',
        NOW()
    FROM generate_series(0, 11) AS i;


    /*
     * 9. Recalculate occupancy from the actual allocation table.
     *
     * Do not simply increment a possibly stale counter.
     */
    SELECT COUNT(*)
    INTO v_active_count
    FROM public.room_allocations ra
    WHERE ra.room_id = p_room_id
      AND ra.status = 'active'
      AND ra.active = true;

    UPDATE public.rooms
    SET
        occupied_count = v_active_count,
        occupancy = v_active_count,
        occupied_beds = v_active_count,
        available = v_active_count < capacity
    WHERE id = p_room_id;


    /*
     * 10. Count generated fees.
     */
    SELECT COUNT(*)
    INTO v_fees_count
    FROM public.student_fees
    WHERE allocation_id = v_new_alloc_id;


    RETURN json_build_object(
        'success', true,
        'allocation_id', v_new_alloc_id::text,
        'message', 'Student assigned successfully',
        'fees_count', v_fees_count,
        'occupied_beds', v_active_count,
        'capacity', v_room.capacity,
        'available_beds', v_room.capacity - v_active_count
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;


ALTER FUNCTION "public"."assign_student_to_room"("p_student_id" "uuid", "p_room_id" "uuid", "p_hostel_id" "uuid", "p_start_date" "date", "p_student_name" "text", "p_student_email" "text", "p_student_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."checkout_student"("p_alloc_id" "uuid") RETURNS TABLE("payment_id" "uuid", "order_id" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."checkout_student"("p_alloc_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."checkout_student"("p_student_id" "uuid", "p_fee_id" "uuid", "p_amount" numeric) RETURNS TABLE("payment_id" "uuid", "order_id" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."checkout_student"("p_student_id" "uuid", "p_fee_id" "uuid", "p_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_otps"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$

DECLARE
    v_deleted_count INTEGER;

BEGIN

    DELETE FROM public.email_verifications
    WHERE expires_at < NOW()
       OR (
            verified_at IS NOT NULL
            AND used_at IS NOT NULL
            AND used_at < NOW() - INTERVAL '1 hour'
       );

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN v_deleted_count;

END;
$$;


ALTER FUNCTION "public"."cleanup_expired_otps"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_invitation_signup"("p_student_id" "uuid", "p_profile_user_id" "uuid", "p_phone_number" "text", "p_invitation_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_profile_id UUID;
    v_student_name TEXT;
    v_student_email TEXT;
BEGIN
    -- 1. Get student details
    SELECT student_name, student_email
    INTO v_student_name, v_student_email
    FROM public.students
    WHERE id = p_student_id;

    -- 2. Check whether profile already exists
    SELECT id
    INTO v_profile_id
    FROM public.profiles
    WHERE user_id = p_profile_user_id;

    -- 3. Create profile if it doesn't exist
    IF v_profile_id IS NULL THEN

        INSERT INTO public.profiles (
            user_id,
            full_name,
            email,
            role
        )
        VALUES (
            p_profile_user_id,
            COALESCE(v_student_name, 'Student'),
            v_student_email,
            'student'
        )
        ON CONFLICT (user_id) DO NOTHING
        RETURNING id INTO v_profile_id;

        -- If another process/trigger created it,
        -- fetch the existing profile
        IF v_profile_id IS NULL THEN
            SELECT id
            INTO v_profile_id
            FROM public.profiles
            WHERE user_id = p_profile_user_id;
        END IF;

    END IF;

    -- 4. Make sure we have a profile
    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'Unable to create or find profile for this user';
    END IF;

    -- 5. Add phone number if provided
    IF p_phone_number IS NOT NULL
       AND p_phone_number <> '' THEN

        UPDATE public.profiles
        SET phone_number = COALESCE(phone_number, p_phone_number)
        WHERE id = v_profile_id;

    END IF;

    -- 6. Link profile to student and activate student
    UPDATE public.students
    SET
        profile_id = v_profile_id,
        status = 'active'
    WHERE id = p_student_id;

    -- 7. Make sure the student was found
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student record not found';
    END IF;

    -- 8. Mark invitation as used
    UPDATE public.student_invitations
    SET used_at = NOW()
    WHERE id = p_invitation_id
      AND used_at IS NULL;

    -- 9. Prevent reuse of invitation
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation has already been used';
    END IF;

END;
$$;


ALTER FUNCTION "public"."complete_invitation_signup"("p_student_id" "uuid", "p_profile_user_id" "uuid", "p_phone_number" "text", "p_invitation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_manual_assignment_with_invite"("p_hostel_id" "uuid", "p_room_id" "uuid", "p_student_name" "text", "p_student_email" "text", "p_student_phone" "text", "p_parent_name" "text", "p_parent_phone" "text", "p_parent_email" "text", "p_address" "text", "p_emergency_name" "text", "p_emergency_phone" "text", "p_start_date" "date", "p_token_hash" "text", "p_expires_at" timestamp with time zone, "p_owner_id" "uuid", "p_booking_type" "public"."booking_type" DEFAULT 'shared_bed'::"public"."booking_type") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."create_manual_assignment_with_invite"("p_hostel_id" "uuid", "p_room_id" "uuid", "p_student_name" "text", "p_student_email" "text", "p_student_phone" "text", "p_parent_name" "text", "p_parent_phone" "text", "p_parent_email" "text", "p_address" "text", "p_emergency_name" "text", "p_emergency_phone" "text", "p_start_date" "date", "p_token_hash" "text", "p_expires_at" timestamp with time zone, "p_owner_id" "uuid", "p_booking_type" "public"."booking_type") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_student_fees"("p_allocation_id" "uuid") RETURNS TABLE("fee_id" "uuid", "month_year" "text", "amount_due" numeric, "due_date" "date")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_student_id UUID;
    v_hostel_id UUID;
    v_room_id UUID;
    v_rent NUMERIC;
    v_start_date DATE;
    v_month DATE;
    v_month_year TEXT;
    v_due_date DATE;
    v_new_fee_id UUID;
    i INTEGER;
BEGIN
    -- Get allocation
    SELECT student_id, hostel_id, room_id, COALESCE(start_date, CURRENT_DATE)
    INTO v_student_id, v_hostel_id, v_room_id, v_start_date
    FROM public.room_allocations
    WHERE id = p_allocation_id;

    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Allocation not found';
    END IF;

    -- Get rent
    SELECT rent INTO v_rent FROM public.rooms WHERE id = v_room_id;
    v_rent := COALESCE(v_rent, 5000);

    -- Start from first day of month
    v_month := DATE_TRUNC('month', v_start_date)::DATE;

    -- Generate EXACTLY 12 consecutive months
    FOR i IN 0..11 LOOP
        v_month_year := TO_CHAR(v_month, 'YYYY-MM');
        v_due_date := v_month + INTERVAL '14 days';

        -- Insert
        INSERT INTO public.student_fees (
            student_id, allocation_id, room_id, hostel_id,
            month_year, amount_due, amount, due_date, status, created_at
        )
        VALUES (
            v_student_id, p_allocation_id, v_room_id, v_hostel_id,
            v_month_year, v_rent, v_rent, v_due_date, 'pending', NOW()
        )
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_new_fee_id;

        -- Return result
        fee_id := COALESCE(v_new_fee_id, gen_random_uuid());
        month_year := v_month_year;
        amount_due := v_rent;
        due_date := v_due_date;
        RETURN NEXT;

        -- IMPORTANT: Move to next month AFTER inserting current month
        v_month := v_month + INTERVAL '1 month';
    END LOOP;
END $$;


ALTER FUNCTION "public"."create_student_fees"("p_allocation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_room_actual_occupancy"("p_room_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_room_actual_occupancy"("p_room_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    user_id,
    email,
    full_name,
    role,
    auth_method,
    google_linked,
    password_set
  )
  VALUES (
    gen_random_uuid(),
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    'student',
    'email_password',
    false,
    false
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_parent_of"("_parent_id" "uuid", "_student_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.parent_links WHERE parent_id = _parent_id AND student_id = _student_id)
$$;


ALTER FUNCTION "public"."is_parent_of"("_parent_id" "uuid", "_student_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_payment_paid"("p_fee_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE public.student_fees
    SET status = 'paid', paid_date = NOW()
    WHERE id = p_fee_id;
    
    RETURN json_build_object(
        'fee_id', p_fee_id::TEXT,
        'status', 'paid',
        'message', 'Payment marked as paid',
        'paid_date', NOW()::TEXT
    );
END $$;


ALTER FUNCTION "public"."mark_payment_paid"("p_fee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_otp"("p_email" "text", "p_purpose" "text" DEFAULT 'password_reset'::"text", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_email TEXT;
    v_otp TEXT;
    v_otp_hash TEXT;
    v_expires_at TIMESTAMPTZ;
    v_student_name TEXT;
    v_user_exists BOOLEAN;
BEGIN
    v_email := LOWER(TRIM(p_email));

    -- Password reset: check whether user exists
    IF p_purpose = 'password_reset' THEN
        SELECT EXISTS (
            SELECT 1
            FROM auth.users
            WHERE email = v_email
        ) INTO v_user_exists;

        IF NOT v_user_exists THEN
            RETURN json_build_object(
                'success', true,
                'message', 'If an account is associated with this email, we have sent a verification code.',
                'user_exists', false
            );
        END IF;
    END IF;

    -- Get student name for room request
    IF p_purpose = 'room_request_verification'
       AND p_user_id IS NOT NULL THEN

        SELECT full_name
        INTO v_student_name
        FROM public.profiles
        WHERE user_id = p_user_id;

    END IF;

    -- Generate secure 6-digit OTP
    v_otp := (
        abs(
            ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::int
        ) % 900000
    ) + 100000;

    -- Hash OTP
    v_otp_hash := encode(
        extensions.digest(v_otp::TEXT, 'sha256'),
        'hex'
    );

    v_expires_at := NOW() + INTERVAL '10 minutes';

    -- Store OTP
    INSERT INTO public.email_verifications (
        email,
        otp_hash,
        expires_at,
        purpose,
        verified,
        created_at
    )
    VALUES (
        v_email,
        v_otp_hash,
        v_expires_at,
        p_purpose,
        false,
        NOW()
    );

    RETURN json_build_object(
        'success', true,
        'message', 'If an account is associated with this email, we have sent a verification code.',
        'otp', v_otp::TEXT,
        'email', v_email,
        'student_name', v_student_name,
        'purpose', p_purpose
    );
END;
$$;


ALTER FUNCTION "public"."request_otp"("p_email" "text", "p_purpose" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_password_with_token"("p_reset_token" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$

DECLARE
    v_token_hash TEXT;
    v_record RECORD;
    v_user_id UUID;

BEGIN

    -- Normalize and securely hash the reset token
    v_token_hash := encode(
        extensions.digest(
            convert_to(TRIM(p_reset_token), 'UTF8'),
            'sha256'::text
        ),
        'hex'
    );

    -- Find the valid password-reset token
    SELECT *
    INTO v_record
    FROM public.email_verifications
    WHERE otp_hash = v_token_hash
      AND purpose = 'password_reset'
      AND expires_at > NOW()
      AND verified_at IS NOT NULL
      AND used_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1;

    -- Invalid, expired, or already-used token
    IF NOT FOUND THEN

        RETURN json_build_object(
            'success', false,
            'error', 'Invalid or expired reset token'
        );

    END IF;


    -- Find the Supabase Auth user
    SELECT id
    INTO v_user_id
    FROM auth.users
    WHERE LOWER(email) = LOWER(v_record.email)
    LIMIT 1;

    IF v_user_id IS NULL THEN

        RETURN json_build_object(
            'success', false,
            'error', 'User not found'
        );

    END IF;


    -- Atomically mark this reset token as used
    UPDATE public.email_verifications
    SET used_at = NOW()
    WHERE id = v_record.id
      AND used_at IS NULL;

    -- Make sure another request did not consume it
    IF NOT FOUND THEN

        RETURN json_build_object(
            'success', false,
            'error', 'Reset token has already been used'
        );

    END IF;


    RETURN json_build_object(
        'success', true,
        'user_id', v_user_id::TEXT,
        'email', v_record.email,
        'message', 'Password reset authorized'
    );

END;

$$;


ALTER FUNCTION "public"."reset_password_with_token"("p_reset_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_room_occupancy"("p_room_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."sync_room_occupancy"("p_room_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_otp"("p_email" "text", "p_otp" "text", "p_purpose" "text" DEFAULT 'room_request_verification'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$

DECLARE
    v_email TEXT;
    v_otp_hash TEXT;
    v_record RECORD;
    v_reset_token TEXT;
    v_reset_token_hash TEXT;

BEGIN

    -- Normalize email
    v_email := LOWER(TRIM(p_email));

    -- Validate purpose
    IF p_purpose NOT IN (
        'password_reset',
        'room_request_verification'
    ) THEN

        RETURN json_build_object(
            'success', false,
            'error', 'Invalid OTP purpose'
        );

    END IF;

    -- Hash submitted OTP
    v_otp_hash := encode(
        extensions.digest(TRIM(p_otp)::TEXT, 'sha256'),
        'hex'
    );

    -- Find active OTP
    SELECT *
    INTO v_record
    FROM public.email_verifications
    WHERE email = v_email
      AND otp_hash = v_otp_hash
      AND purpose = p_purpose
      AND expires_at > NOW()
      AND verified_at IS NULL
      AND used_at IS NULL
      AND attempts < 5
    ORDER BY created_at DESC
    LIMIT 1;

    -- Invalid OTP
    IF NOT FOUND THEN

        UPDATE public.email_verifications
        SET attempts = attempts + 1
        WHERE email = v_email
          AND purpose = p_purpose
          AND expires_at > NOW()
          AND verified_at IS NULL
          AND used_at IS NULL;

        -- Invalidate OTP after too many attempts
        UPDATE public.email_verifications
        SET used_at = NOW()
        WHERE email = v_email
          AND purpose = p_purpose
          AND attempts >= 5
          AND verified_at IS NULL
          AND used_at IS NULL;

        RETURN json_build_object(
            'success', false,
            'error', 'Invalid or expired verification code'
        );

    END IF;

    -- Mark OTP verified
    UPDATE public.email_verifications
    SET verified_at = NOW()
    WHERE id = v_record.id;

    -- PASSWORD RESET
    IF p_purpose = 'password_reset' THEN

        -- Generate secure reset token
        v_reset_token :=
            encode(extensions.gen_random_bytes(32), 'hex');

        -- Store only hash
        v_reset_token_hash :=
            encode(
                extensions.digest(v_reset_token, 'sha256'),
                'hex'
            );

        -- Reset token valid for 15 minutes
        UPDATE public.email_verifications
        SET otp_hash = v_reset_token_hash,
            expires_at = NOW() + INTERVAL '15 minutes'
        WHERE id = v_record.id;

        RETURN json_build_object(
            'success', true,
            'reset_token', v_reset_token,
            'message', 'Verification successful'
        );

    END IF;

    -- ROOM REQUEST
    RETURN json_build_object(
        'success', true,
        'message', 'Verification successful'
    );

END;
$$;


ALTER FUNCTION "public"."verify_otp"("p_email" "text", "p_otp" "text", "p_purpose" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."beds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "bed_number" integer NOT NULL,
    "status" "text" DEFAULT 'available'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."beds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hostel_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "bill_type" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "due_date" "date" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."complaints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hostel_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "category" "public"."complaint_category" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "priority" integer DEFAULT 2,
    "status" "public"."complaint_status" DEFAULT 'open'::"public"."complaint_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."complaints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_verifications" (
    "email" "text" NOT NULL,
    "otp" "text",
    "verified" boolean DEFAULT false NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "purpose" "text" DEFAULT 'room_request_verification'::"text" NOT NULL,
    "otp_hash" "text",
    "attempts" integer DEFAULT 0 NOT NULL,
    "verified_at" timestamp with time zone,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    CONSTRAINT "email_verifications_purpose_check" CHECK (("purpose" = ANY (ARRAY['password_reset'::"text", 'room_request_verification'::"text"])))
);


ALTER TABLE "public"."email_verifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hostels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "address" "text" NOT NULL,
    "city" "text" NOT NULL,
    "state" "text" NOT NULL,
    "pincode" "text" NOT NULL,
    "contact_number" "text",
    "email" "text",
    "amenities" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "public"."hostel_status" DEFAULT 'pending'::"public"."hostel_status",
    "area" "text",
    "starting_price" numeric DEFAULT 0,
    "rating" numeric(3,1) DEFAULT 0,
    "total_reviews" integer DEFAULT 0,
    "cover_image_url" "text",
    "rules" "text"
);


ALTER TABLE "public"."hostels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."maintenance_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "hostel_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "status" "public"."request_status" DEFAULT 'open'::"public"."request_status",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."maintenance_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hostel_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "notice_type" "text" DEFAULT 'general'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parent_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."parent_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "emergency_contact" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."parents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hostel_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "payment_type" "text" NOT NULL,
    "upi_id" "text",
    "qr_code_url" "text",
    "bank_account" "text",
    "ifsc_code" "text",
    "account_holder_name" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_primary" boolean DEFAULT false
);


ALTER TABLE "public"."payment_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_fees_id" "uuid",
    "student_id" "uuid",
    "allocation_id" "uuid",
    "hostel_id" "uuid",
    "amount_paid" numeric,
    "payment_method" "text",
    "payment_status" "text" DEFAULT 'completed'::"text",
    "reference_number" "text",
    "paid_date" timestamp with time zone DEFAULT "now"(),
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "payment_type" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "payment_mode" "text" DEFAULT 'manual'::"text",
    "gateway_order_id" "text",
    "gateway_payment_id" "text",
    "gateway_signature" "text",
    "fee_id" "uuid",
    "amount" numeric,
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text", 'manual_pending'::"text", 'verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."payments"."student_fees_id" IS 'Nullable FK to student_fees; filled when payment tied to specific fee.';



COMMENT ON COLUMN "public"."payments"."allocation_id" IS 'Nullable FK to room_allocations; set when payment tied to specific allocation.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone_number" "text",
    "role" "text" DEFAULT 'student'::"public"."user_role" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "gender" "text",
    "date_of_birth" "date",
    "auth_method" "text" DEFAULT 'email_password'::"text",
    "password_set" boolean DEFAULT false,
    "google_linked" boolean DEFAULT false,
    CONSTRAINT "profiles_auth_method_check" CHECK (("auth_method" = ANY (ARRAY['google'::"text", 'email_password'::"text", 'both'::"text"]))),
    CONSTRAINT "role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'student'::"text", 'hostel_owner'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rent_payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "hostel_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "month_year" "text" NOT NULL,
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rent_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "bed_id" "uuid",
    "student_id" "uuid" NOT NULL,
    "hostel_id" "uuid" NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "booking_type" "public"."booking_type" DEFAULT 'shared_bed'::"public"."booking_type" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "approved_at" timestamp with time zone,
    "student_name" "text",
    "student_email" "text",
    "student_phone" "text"
);


ALTER TABLE "public"."room_allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "hostel_id" "uuid" NOT NULL,
    "room_id" "uuid" NOT NULL,
    "check_in_date" "date" DEFAULT CURRENT_DATE,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."room_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "hostel_id" "uuid" NOT NULL,
    "room_id" "uuid" NOT NULL,
    "parent_name" "text" NOT NULL,
    "parent_phone" "text" NOT NULL,
    "parent_email" "text" NOT NULL,
    "address" "text" NOT NULL,
    "emergency_contact" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "student_name" "text",
    "student_email" "text",
    "student_phone" "text",
    "booking_type" "text",
    "approved_at" timestamp with time zone,
    "full_name" "text",
    "phone_number" "text",
    "date_of_birth" "date",
    "gender" "text",
    "aadhar_number" "text",
    "college_name" "text",
    "course" "text",
    "semester" "text",
    "branch" "text",
    "house_name" "text",
    "street" "text",
    "city" "text",
    "district" "text",
    "state" "text",
    "pincode" "text",
    "parent_relationship" "text",
    "parent_occupation" "text",
    "emergency_contact_name" "text",
    "emergency_contact_relationship" "text",
    "emergency_contact_phone" "text",
    "medical_condition" "text",
    "medications" "text",
    "allergies" "text",
    "disability" "text",
    CONSTRAINT "room_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."room_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hostel_id" "uuid" NOT NULL,
    "room_number" "text" NOT NULL,
    "capacity" integer NOT NULL,
    "rent" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'available'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "room_type" "public"."room_type" DEFAULT 'double'::"public"."room_type",
    "floor" integer DEFAULT 0,
    "security_deposit" numeric DEFAULT 0,
    "facilities" "text"[] DEFAULT '{}'::"text"[],
    "occupancy" integer DEFAULT 0,
    "available" boolean DEFAULT true,
    "type" "text",
    "occupied_count" integer DEFAULT 0,
    "occupied_beds" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_fees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "allocation_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "room_id" "uuid" NOT NULL,
    "hostel_id" "uuid" NOT NULL,
    "month_year" "text" NOT NULL,
    "amount_due" numeric NOT NULL,
    "due_date" "date" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "paid_date" timestamp with time zone,
    "payment_method" "text",
    "is_overdue" boolean DEFAULT false,
    "late_fee_applied" numeric(10,2) DEFAULT 0,
    "amount" numeric
);


ALTER TABLE "public"."student_fees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."student_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "college" "text",
    "course" "text",
    "year" "text",
    "student_name" "text",
    "student_email" "text",
    "admission_date" "date" DEFAULT CURRENT_DATE NOT NULL
);


ALTER TABLE "public"."students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."beds"
    ADD CONSTRAINT "beds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beds"
    ADD CONSTRAINT "beds_room_id_bed_number_key" UNIQUE ("room_id", "bed_number");



ALTER TABLE ONLY "public"."bills"
    ADD CONSTRAINT "bills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."complaints"
    ADD CONSTRAINT "complaints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_verifications"
    ADD CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hostels"
    ADD CONSTRAINT "hostels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."maintenance_requests"
    ADD CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parent_links"
    ADD CONSTRAINT "parent_links_parent_id_student_id_key" UNIQUE ("parent_id", "student_id");



ALTER TABLE ONLY "public"."parent_links"
    ADD CONSTRAINT "parent_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parents"
    ADD CONSTRAINT "parents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parents"
    ADD CONSTRAINT "parents_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."rent_payments"
    ADD CONSTRAINT "rent_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."room_allocations"
    ADD CONSTRAINT "room_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."room_assignments"
    ADD CONSTRAINT "room_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."room_requests"
    ADD CONSTRAINT "room_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_fees"
    ADD CONSTRAINT "student_fees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_invitations"
    ADD CONSTRAINT "student_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_invitations"
    ADD CONSTRAINT "student_invitations_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_profile_id_unique" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



CREATE INDEX "idx_email_verifications_email" ON "public"."email_verifications" USING "btree" ("email");



CREATE INDEX "idx_email_verifications_expires_at" ON "public"."email_verifications" USING "btree" ("expires_at");



CREATE INDEX "idx_email_verifications_otp_hash" ON "public"."email_verifications" USING "btree" ("otp_hash");



CREATE INDEX "idx_email_verifications_purpose" ON "public"."email_verifications" USING "btree" ("purpose");



CREATE INDEX "idx_student_invitations_email" ON "public"."student_invitations" USING "btree" ("email");



CREATE INDEX "idx_student_invitations_student_id" ON "public"."student_invitations" USING "btree" ("student_id");



CREATE INDEX "idx_student_invitations_token_hash" ON "public"."student_invitations" USING "btree" ("token_hash");



ALTER TABLE ONLY "public"."beds"
    ADD CONSTRAINT "beds_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bills"
    ADD CONSTRAINT "bills_hostel_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bills"
    ADD CONSTRAINT "bills_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."complaints"
    ADD CONSTRAINT "complaints_hostel_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."complaints"
    ADD CONSTRAINT "complaints_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hostels"
    ADD CONSTRAINT "hostels_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."maintenance_requests"
    ADD CONSTRAINT "maintenance_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_hostel_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parent_links"
    ADD CONSTRAINT "parent_links_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parent_links"
    ADD CONSTRAINT "parent_links_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parents"
    ADD CONSTRAINT "parents_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_hostel_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id");



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "public"."room_allocations"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_hostel_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_student_fees_id_fkey" FOREIGN KEY ("student_fees_id") REFERENCES "public"."student_fees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rent_payments"
    ADD CONSTRAINT "rent_payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."room_allocations"
    ADD CONSTRAINT "room_allocations_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "public"."beds"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."room_allocations"
    ADD CONSTRAINT "room_allocations_hostel_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_allocations"
    ADD CONSTRAINT "room_allocations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_allocations"
    ADD CONSTRAINT "room_allocations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_assignments"
    ADD CONSTRAINT "room_assignments_hostel_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_assignments"
    ADD CONSTRAINT "room_assignments_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_assignments"
    ADD CONSTRAINT "room_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_requests"
    ADD CONSTRAINT "room_requests_hostel_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_requests"
    ADD CONSTRAINT "room_requests_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_requests"
    ADD CONSTRAINT "room_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_hostel_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_fees"
    ADD CONSTRAINT "student_fees_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "public"."room_allocations"("id");



ALTER TABLE ONLY "public"."student_fees"
    ADD CONSTRAINT "student_fees_hostel_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id");



ALTER TABLE ONLY "public"."student_fees"
    ADD CONSTRAINT "student_fees_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id");



ALTER TABLE ONLY "public"."student_fees"
    ADD CONSTRAINT "student_fees_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_invitations"
    ADD CONSTRAINT "student_invitations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow all operations on email_verifications" ON "public"."email_verifications" USING (true) WITH CHECK (true);



CREATE POLICY "Allow individual insert" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow individual update" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow public read approved hostels" ON "public"."hostels" FOR SELECT USING (("status" = 'approved'::"public"."hostel_status"));



CREATE POLICY "Approved hostels public" ON "public"."hostels" FOR SELECT USING ((("status" = 'approved'::"public"."hostel_status") OR ("auth"."uid"() = "owner_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Authenticated users can insert student records" ON "public"."students" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can update their student records" ON "public"."students" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can view their student records" ON "public"."students" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Beds public read" ON "public"."beds" FOR SELECT USING (true);



CREATE POLICY "Bills visibility" ON "public"."bills" FOR SELECT TO "authenticated" USING ((("student_id" = "auth"."uid"()) OR "public"."is_parent_of"("auth"."uid"(), "student_id") OR (EXISTS ( SELECT 1
   FROM "public"."hostels" "h"
  WHERE (("h"."id" = "bills"."hostel_id") AND ("h"."owner_id" = "auth"."uid"())))) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Complaint visibility" ON "public"."complaints" FOR SELECT TO "authenticated" USING ((("student_id" = "auth"."uid"()) OR "public"."is_parent_of"("auth"."uid"(), "student_id") OR (EXISTS ( SELECT 1
   FROM "public"."hostels" "h"
  WHERE (("h"."id" = "complaints"."hostel_id") AND ("h"."owner_id" = "auth"."uid"())))) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "No direct access to email_verifications" ON "public"."email_verifications" USING (false) WITH CHECK (false);



CREATE POLICY "Own Profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Owners can add payment methods" ON "public"."payment_methods" FOR INSERT WITH CHECK (("owner_id" = ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Owners can insert room allocations" ON "public"."room_allocations" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."hostels" "h"
  WHERE (("h"."id" = "room_allocations"."hostel_id") AND ("h"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can read hostel requests" ON "public"."room_requests" FOR SELECT USING (("hostel_id" IN ( SELECT "hostels"."id"
   FROM "public"."hostels"
  WHERE ("hostels"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Owners can update hostel requests" ON "public"."room_requests" FOR UPDATE USING (("hostel_id" IN ( SELECT "hostels"."id"
   FROM "public"."hostels"
  WHERE ("hostels"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Owners can update payment methods" ON "public"."payment_methods" FOR UPDATE USING (("owner_id" = ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Owners can view hostel fees" ON "public"."student_fees" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."hostels" "h"
  WHERE (("h"."id" = "student_fees"."hostel_id") AND ("h"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can view hostel payments" ON "public"."payments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."hostels" "h"
  WHERE (("h"."id" = "payments"."hostel_id") AND ("h"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can view invitations" ON "public"."student_invitations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."students" "s"
     JOIN "public"."room_allocations" "ra" ON (("ra"."student_id" = "s"."id")))
     JOIN "public"."hostels" "h" ON (("h"."id" = "ra"."hostel_id")))
  WHERE (("s"."id" = "student_invitations"."student_id") AND ("h"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can view their payment methods" ON "public"."payment_methods" FOR SELECT USING (("owner_id" = ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Owners manage beds" ON "public"."beds" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM ("public"."rooms" "r"
     JOIN "public"."hostels" "h" ON (("h"."id" = "r"."hostel_id")))
  WHERE (("r"."id" = "beds"."room_id") AND ("h"."owner_id" = "auth"."uid"())))) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Owners manage bills" ON "public"."bills" USING (("auth"."uid"() IN ( SELECT "p"."user_id"
   FROM ("public"."profiles" "p"
     JOIN "public"."hostels" "h" ON (("h"."owner_id" = "p"."id")))
  WHERE ("h"."id" = "bills"."hostel_id"))));



CREATE POLICY "Owners manage own hostels" ON "public"."hostels" TO "authenticated" USING ((("auth"."uid"() = "owner_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Owners manage rooms" ON "public"."rooms" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."hostels" "h"
  WHERE (("h"."id" = "rooms"."hostel_id") AND ("h"."owner_id" = "auth"."uid"())))) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Parents can view student fees" ON "public"."student_fees" FOR SELECT USING ("public"."is_parent_of"("auth"."uid"(), "student_id"));



CREATE POLICY "Parents can view student payments" ON "public"."payments" FOR SELECT USING ("public"."is_parent_of"("auth"."uid"(), "student_id"));



CREATE POLICY "Public view hostels" ON "public"."hostels" FOR SELECT USING (true);



CREATE POLICY "Rooms public read" ON "public"."rooms" FOR SELECT USING (true);



CREATE POLICY "Students can insert own requests" ON "public"."room_requests" FOR INSERT WITH CHECK (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."profile_id" IN ( SELECT "profiles"."id"
           FROM "public"."profiles"
          WHERE ("profiles"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Students can read own requests" ON "public"."room_requests" FOR SELECT USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."profile_id" IN ( SELECT "profiles"."id"
           FROM "public"."profiles"
          WHERE ("profiles"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Students can view own fees" ON "public"."student_fees" FOR SELECT USING (("auth"."uid"() = ( SELECT "p"."user_id"
   FROM ("public"."profiles" "p"
     JOIN "public"."students" "s" ON (("s"."profile_id" = "p"."id")))
  WHERE ("s"."id" = "student_fees"."student_id"))));



CREATE POLICY "Students can view own payments" ON "public"."payments" FOR SELECT USING (("auth"."uid"() = ( SELECT "p"."user_id"
   FROM ("public"."profiles" "p"
     JOIN "public"."students" "s" ON (("s"."profile_id" = "p"."id")))
  WHERE ("s"."id" = "payments"."student_id"))));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can select own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "View allocations" ON "public"."room_allocations" FOR SELECT USING ((("auth"."uid"() = ( SELECT "profiles"."user_id"
   FROM ("public"."profiles"
     JOIN "public"."students" ON (("students"."profile_id" = "profiles"."id")))
  WHERE ("students"."id" = "room_allocations"."student_id"))) OR "public"."is_parent_of"("auth"."uid"(), "student_id") OR (EXISTS ( SELECT 1
   FROM "public"."hostels" "h"
  WHERE (("h"."id" = "room_allocations"."hostel_id") AND ("h"."owner_id" = "auth"."uid"())))) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "View notices" ON "public"."notices" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."room_allocations" "ra"
  WHERE (("ra"."hostel_id" = "notices"."hostel_id") AND ("ra"."student_id" = "auth"."uid"()) AND ("ra"."active" = true)))) OR (EXISTS ( SELECT 1
   FROM "public"."hostels" "h"
  WHERE (("h"."id" = "notices"."hostel_id") AND ("h"."owner_id" = "auth"."uid"())))) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



ALTER TABLE "public"."beds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."complaints" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_verifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hostels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."maintenance_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parent_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_methods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rent_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."room_allocations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."room_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."room_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_fees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."approve_room_request"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_room_request"("p_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_room_request"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_room_request"("p_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_student_to_room"("p_student_id" "uuid", "p_room_id" "uuid", "p_hostel_id" "uuid", "p_start_date" "date", "p_student_name" "text", "p_student_email" "text", "p_student_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_student_to_room"("p_student_id" "uuid", "p_room_id" "uuid", "p_hostel_id" "uuid", "p_start_date" "date", "p_student_name" "text", "p_student_email" "text", "p_student_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_student_to_room"("p_student_id" "uuid", "p_room_id" "uuid", "p_hostel_id" "uuid", "p_start_date" "date", "p_student_name" "text", "p_student_email" "text", "p_student_phone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."checkout_student"("p_alloc_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."checkout_student"("p_alloc_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."checkout_student"("p_alloc_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkout_student"("p_alloc_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."checkout_student"("p_student_id" "uuid", "p_fee_id" "uuid", "p_amount" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."checkout_student"("p_student_id" "uuid", "p_fee_id" "uuid", "p_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."checkout_student"("p_student_id" "uuid", "p_fee_id" "uuid", "p_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkout_student"("p_student_id" "uuid", "p_fee_id" "uuid", "p_amount" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_expired_otps"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_expired_otps"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_otps"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_otps"() TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_invitation_signup"("p_student_id" "uuid", "p_profile_user_id" "uuid", "p_phone_number" "text", "p_invitation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_invitation_signup"("p_student_id" "uuid", "p_profile_user_id" "uuid", "p_phone_number" "text", "p_invitation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_invitation_signup"("p_student_id" "uuid", "p_profile_user_id" "uuid", "p_phone_number" "text", "p_invitation_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_manual_assignment_with_invite"("p_hostel_id" "uuid", "p_room_id" "uuid", "p_student_name" "text", "p_student_email" "text", "p_student_phone" "text", "p_parent_name" "text", "p_parent_phone" "text", "p_parent_email" "text", "p_address" "text", "p_emergency_name" "text", "p_emergency_phone" "text", "p_start_date" "date", "p_token_hash" "text", "p_expires_at" timestamp with time zone, "p_owner_id" "uuid", "p_booking_type" "public"."booking_type") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_manual_assignment_with_invite"("p_hostel_id" "uuid", "p_room_id" "uuid", "p_student_name" "text", "p_student_email" "text", "p_student_phone" "text", "p_parent_name" "text", "p_parent_phone" "text", "p_parent_email" "text", "p_address" "text", "p_emergency_name" "text", "p_emergency_phone" "text", "p_start_date" "date", "p_token_hash" "text", "p_expires_at" timestamp with time zone, "p_owner_id" "uuid", "p_booking_type" "public"."booking_type") TO "anon";
GRANT ALL ON FUNCTION "public"."create_manual_assignment_with_invite"("p_hostel_id" "uuid", "p_room_id" "uuid", "p_student_name" "text", "p_student_email" "text", "p_student_phone" "text", "p_parent_name" "text", "p_parent_phone" "text", "p_parent_email" "text", "p_address" "text", "p_emergency_name" "text", "p_emergency_phone" "text", "p_start_date" "date", "p_token_hash" "text", "p_expires_at" timestamp with time zone, "p_owner_id" "uuid", "p_booking_type" "public"."booking_type") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_manual_assignment_with_invite"("p_hostel_id" "uuid", "p_room_id" "uuid", "p_student_name" "text", "p_student_email" "text", "p_student_phone" "text", "p_parent_name" "text", "p_parent_phone" "text", "p_parent_email" "text", "p_address" "text", "p_emergency_name" "text", "p_emergency_phone" "text", "p_start_date" "date", "p_token_hash" "text", "p_expires_at" timestamp with time zone, "p_owner_id" "uuid", "p_booking_type" "public"."booking_type") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_student_fees"("p_allocation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_student_fees"("p_allocation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_student_fees"("p_allocation_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_room_actual_occupancy"("p_room_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_room_actual_occupancy"("p_room_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_room_actual_occupancy"("p_room_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_room_actual_occupancy"("p_room_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_parent_of"("_parent_id" "uuid", "_student_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_parent_of"("_parent_id" "uuid", "_student_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_parent_of"("_parent_id" "uuid", "_student_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_payment_paid"("p_fee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_payment_paid"("p_fee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_payment_paid"("p_fee_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_otp"("p_email" "text", "p_purpose" "text", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_otp"("p_email" "text", "p_purpose" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."request_otp"("p_email" "text", "p_purpose" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_otp"("p_email" "text", "p_purpose" "text", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reset_password_with_token"("p_reset_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reset_password_with_token"("p_reset_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reset_password_with_token"("p_reset_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_password_with_token"("p_reset_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_room_occupancy"("p_room_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_room_occupancy"("p_room_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_room_occupancy"("p_room_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_room_occupancy"("p_room_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."verify_otp"("p_email" "text", "p_otp" "text", "p_purpose" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_otp"("p_email" "text", "p_otp" "text", "p_purpose" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_otp"("p_email" "text", "p_otp" "text", "p_purpose" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_otp"("p_email" "text", "p_otp" "text", "p_purpose" "text") TO "service_role";



GRANT ALL ON TABLE "public"."beds" TO "anon";
GRANT ALL ON TABLE "public"."beds" TO "authenticated";
GRANT ALL ON TABLE "public"."beds" TO "service_role";



GRANT ALL ON TABLE "public"."bills" TO "anon";
GRANT ALL ON TABLE "public"."bills" TO "authenticated";
GRANT ALL ON TABLE "public"."bills" TO "service_role";



GRANT ALL ON TABLE "public"."complaints" TO "anon";
GRANT ALL ON TABLE "public"."complaints" TO "authenticated";
GRANT ALL ON TABLE "public"."complaints" TO "service_role";



GRANT ALL ON TABLE "public"."email_verifications" TO "anon";
GRANT ALL ON TABLE "public"."email_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."email_verifications" TO "service_role";



GRANT ALL ON TABLE "public"."hostels" TO "anon";
GRANT ALL ON TABLE "public"."hostels" TO "authenticated";
GRANT ALL ON TABLE "public"."hostels" TO "service_role";



GRANT ALL ON TABLE "public"."maintenance_requests" TO "anon";
GRANT ALL ON TABLE "public"."maintenance_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."maintenance_requests" TO "service_role";



GRANT ALL ON TABLE "public"."notices" TO "anon";
GRANT ALL ON TABLE "public"."notices" TO "authenticated";
GRANT ALL ON TABLE "public"."notices" TO "service_role";



GRANT ALL ON TABLE "public"."parent_links" TO "anon";
GRANT ALL ON TABLE "public"."parent_links" TO "authenticated";
GRANT ALL ON TABLE "public"."parent_links" TO "service_role";



GRANT ALL ON TABLE "public"."parents" TO "anon";
GRANT ALL ON TABLE "public"."parents" TO "authenticated";
GRANT ALL ON TABLE "public"."parents" TO "service_role";



GRANT ALL ON TABLE "public"."payment_methods" TO "anon";
GRANT ALL ON TABLE "public"."payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_methods" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."rent_payments" TO "anon";
GRANT ALL ON TABLE "public"."rent_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."rent_payments" TO "service_role";



GRANT ALL ON TABLE "public"."room_allocations" TO "anon";
GRANT ALL ON TABLE "public"."room_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."room_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."room_assignments" TO "anon";
GRANT ALL ON TABLE "public"."room_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."room_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."room_requests" TO "anon";
GRANT ALL ON TABLE "public"."room_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."room_requests" TO "service_role";



GRANT ALL ON TABLE "public"."rooms" TO "anon";
GRANT ALL ON TABLE "public"."rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."rooms" TO "service_role";



GRANT ALL ON TABLE "public"."student_fees" TO "anon";
GRANT ALL ON TABLE "public"."student_fees" TO "authenticated";
GRANT ALL ON TABLE "public"."student_fees" TO "service_role";



GRANT ALL ON TABLE "public"."student_invitations" TO "anon";
GRANT ALL ON TABLE "public"."student_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."student_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."students" TO "anon";
GRANT ALL ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







