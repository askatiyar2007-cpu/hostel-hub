-- -----------------------------------------------------------------
-- Add missing columns (if not already present) – same as before
-- -----------------------------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS gateway_order_id TEXT,
  ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- -----------------------------------------------------------------
-- Existing sandbox RPC (kept unchanged)
-- -----------------------------------------------------------------
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
AS $$
DECLARE
    v_order_id TEXT := 'mock_order_' || gen_random_uuid();
BEGIN
    INSERT INTO public.payments (
        student_id,
        fee_id,
        amount,
        status,
        payment_mode,
        gateway_order_id,
        created_at
    )
    VALUES (
        p_student_id,
        p_fee_id,
        p_amount,
        'pending',
        'online',
        v_order_id,
        now()
    )
    RETURNING id INTO payment_id;
    order_id := v_order_id;
    RETURN NEXT;
END;
$$;

-- -----------------------------------------------------------------
-- NEW overload that matches the call the UI is making:
--   checkout_student(alloc_id UUID)
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkout_student(
    p_alloc_id UUID
)
RETURNS TABLE (
    payment_id UUID,
    order_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_student_id UUID;
    v_fee_id     UUID;
    v_amount     NUMERIC;
    v_order_id   TEXT;
BEGIN
    -- -----------------------------------------------------------------
    -- Try to resolve the allocation ID to the needed fields.
    -- -----------------------------------------------------------------
    SELECT
        sf.student_id,
        sf.id,
        sf.amount
    INTO
        v_student_id,
        v_fee_id,
        v_amount
    FROM public.student_fees sf
    WHERE sf.allocation_id = p_alloc_id
    LIMIT 1;

    -- Fallback to room_allocations if no student fees exist yet
    IF v_student_id IS NULL THEN
        SELECT
            ra.student_id,
            r.rent
        INTO
            v_student_id,
            v_amount
        FROM public.room_allocations ra
        JOIN public.rooms r ON r.id = ra.room_id
        WHERE ra.id = p_alloc_id;
    END IF;

    -- If the allocation is not found, raise a clear error.
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Allocation % not found', p_alloc_id;
    END IF;

    -- Create a mock order ID (sandbox mode)
    v_order_id := 'mock_order_' || gen_random_uuid();

    -- Insert the pending payment
    INSERT INTO public.payments (
        student_id,
        fee_id,
        amount,
        status,
        payment_mode,
        gateway_order_id,
        created_at
    )
    VALUES (
        v_student_id,
        v_fee_id,
        v_amount,
        'pending',
        'online',
        v_order_id,
        now()
    )
    RETURNING id INTO payment_id;

    order_id := v_order_id;
    RETURN NEXT;
END;
$$;

-- -----------------------------------------------------------------
-- Ensure the authenticated role can call both RPCs
-- -----------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.checkout_student(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_student(UUID) TO authenticated;
