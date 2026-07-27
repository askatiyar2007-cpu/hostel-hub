-- --------------------------------------------------------------
-- 1️⃣ Add every column the checkout RPC expects (in case they don't exist)
-- --------------------------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS allocation_id    UUID,
  ADD COLUMN IF NOT EXISTS hostel_id        UUID,
  ADD COLUMN IF NOT EXISTS amount_paid      NUMERIC,
  ADD COLUMN IF NOT EXISTS student_fees_id  UUID,
  ADD COLUMN IF NOT EXISTS payment_status   TEXT    DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_method   TEXT    DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS gateway_order_id  TEXT,
  ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS gateway_signature  TEXT,
  ADD COLUMN IF NOT EXISTS paid_date        TIMESTAMPTZ DEFAULT now();

-- --------------------------------------------------------------
-- 2️⃣ Overload: checkout_student(p_student_id UUID, p_fee_id UUID, p_amount NUMERIC)
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkout_student(
    p_student_id UUID,
    p_fee_id     UUID,
    p_amount     NUMERIC
)
RETURNS TABLE (
    payment_id UUID,
    order_id   TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id TEXT := 'mock_order_' || gen_random_uuid();
    v_alloc_id UUID;
    v_hostel_id UUID;
    r_alloc RECORD;
    r_room RECORD;
    v_booking_type TEXT;
    v_new_occupied INT;
BEGIN
    -- Validate parameters
    IF p_student_id IS NULL THEN
        RAISE EXCEPTION 'student_id is required.';
    END IF;

    -- Resolve allocation_id and hostel_id from p_fee_id
    IF p_fee_id IS NOT NULL THEN
        SELECT allocation_id, hostel_id
        INTO v_alloc_id, v_hostel_id
        FROM public.student_fees
        WHERE id = p_fee_id;
    END IF;

    -- Fallback to active allocation if still null
    IF v_alloc_id IS NULL THEN
        SELECT id, hostel_id
        INTO v_alloc_id, v_hostel_id
        FROM public.room_allocations
        WHERE student_id = p_student_id AND active = true
        LIMIT 1;
    END IF;

    -- Ensure allocation is found
    IF v_alloc_id IS NULL THEN
        RAISE EXCEPTION 'Active room allocation not found for student %', p_student_id;
    END IF;

    -- Lock and retrieve allocation record
    SELECT * INTO r_alloc FROM public.room_allocations WHERE id = v_alloc_id FOR UPDATE;
    
    -- Raise exception if allocation is already inactive
    IF NOT r_alloc.active THEN
        RAISE EXCEPTION 'Allocation % is already inactive.', v_alloc_id;
    END IF;

    -- Deactivate the allocation
    UPDATE public.room_allocations
    SET active = false, end_date = CURRENT_DATE
    WHERE id = v_alloc_id;

    -- Lock room details and update occupied count
    SELECT * INTO r_room FROM public.rooms WHERE id = r_alloc.room_id FOR UPDATE;
    IF r_room IS NOT NULL THEN
        -- Check booking type from allocation
        v_booking_type := COALESCE(r_alloc.booking_type, 'shared');

        -- Calculate new occupied count
        IF v_booking_type = 'entire_room' THEN
            v_new_occupied := 0;
        ELSE
            v_new_occupied := GREATEST(0, COALESCE(r_room.occupied_count, r_room.occupancy, 0) - 1);
        END IF;

        -- Update room occupied count and availability
        UPDATE public.rooms
        SET 
            occupied_count = v_new_occupied,
            occupancy = v_new_occupied,
            available = (v_new_occupied < capacity),
            status = CASE WHEN v_new_occupied >= capacity THEN 'occupied' ELSE 'available' END
        WHERE id = r_alloc.room_id;
    END IF;

    -- Insert payment record with allocation_id and hostel_id
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
        now(),
        now()
    )
    RETURNING id INTO payment_id;

    order_id := v_order_id;
    RETURN NEXT;
END;
$$;

-- --------------------------------------------------------------
-- 3️⃣ NEW overload: checkout_student(p_alloc_id UUID)
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkout_student(
    p_alloc_id UUID
)
RETURNS TABLE (
    payment_id UUID,
    order_id   TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r_alloc      RECORD;
    r_room       RECORD;
    v_student_id UUID;
    v_hostel_id  UUID;
    v_fee_id     UUID;
    v_amount     NUMERIC;
    v_order_id   TEXT;
    v_booking_type TEXT;
    v_new_occupied INT;
BEGIN
    -- Validate parameters
    IF p_alloc_id IS NULL THEN
        RAISE EXCEPTION 'allocation_id (p_alloc_id) is required.';
    END IF;

    -- Retrieve and lock the allocation record
    SELECT * INTO r_alloc FROM public.room_allocations WHERE id = p_alloc_id FOR UPDATE;
    
    IF r_alloc IS NULL THEN
        RAISE EXCEPTION 'Allocation with ID % not found.', p_alloc_id;
    END IF;

    IF NOT r_alloc.active THEN
        RAISE EXCEPTION 'Allocation % is already inactive.', p_alloc_id;
    END IF;

    v_student_id := r_alloc.student_id;
    v_hostel_id  := r_alloc.hostel_id;

    -----------------------------------------------------------------
    -- Try to resolve the fee via a student_fees row
    -----------------------------------------------------------------
    SELECT
        sf.id,
        sf.amount
    INTO
        v_fee_id,
        v_amount
    FROM public.student_fees sf
    WHERE sf.allocation_id = p_alloc_id AND sf.status = 'pending'
    LIMIT 1;

    -----------------------------------------------------------------
    -- Fallback: if no pending fee row yet, use rooms rent
    -----------------------------------------------------------------
    IF v_fee_id IS NULL THEN
        SELECT
            r.rent
        INTO
            v_amount
        FROM public.rooms r
        WHERE r.id = r_alloc.room_id;
    END IF;

    -- Ensure amount is not null
    v_amount := COALESCE(v_amount, 0);

    -- Deactivate the allocation
    UPDATE public.room_allocations
    SET active = false, end_date = CURRENT_DATE
    WHERE id = p_alloc_id;

    -- Lock room details and update occupied count
    SELECT * INTO r_room FROM public.rooms WHERE id = r_alloc.room_id FOR UPDATE;
    IF r_room IS NOT NULL THEN
        -- Check booking type from allocation
        v_booking_type := COALESCE(r_alloc.booking_type, 'shared');

        -- Calculate new occupied count
        IF v_booking_type = 'entire_room' THEN
            v_new_occupied := 0;
        ELSE
            v_new_occupied := GREATEST(0, COALESCE(r_room.occupied_count, r_room.occupancy, 0) - 1);
        END IF;

        -- Update room occupied count and availability
        UPDATE public.rooms
        SET 
            occupied_count = v_new_occupied,
            occupancy = v_new_occupied,
            available = (v_new_occupied < capacity),
            status = CASE WHEN v_new_occupied >= capacity THEN 'occupied' ELSE 'available' END
        WHERE id = r_alloc.room_id;
    END IF;

    -- Mock order ID (sandbox mode)
    v_order_id := 'mock_order_' || gen_random_uuid();

    -- Insert the pending payment record
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
        now(),
        now()
    )
    RETURNING id INTO payment_id;

    order_id := v_order_id;
    RETURN NEXT;
END;
$$;

-- --------------------------------------------------------------
-- 4️⃣ Grant execute rights to the authenticated role
-- --------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.checkout_student(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_student(UUID)                TO authenticated;
