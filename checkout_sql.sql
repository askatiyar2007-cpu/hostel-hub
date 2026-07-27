-- Ensure payments table has required columns
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS gateway_order_id TEXT,
  ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Create or replace checkout_student RPC (sandbox mock)
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

GRANT EXECUTE ON FUNCTION public.checkout_student(UUID, UUID, NUMERIC) TO authenticated;
