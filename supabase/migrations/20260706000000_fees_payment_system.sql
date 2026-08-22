-- 1. Create tables
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('upi', 'bank', 'qr')),
    upi_id text,
    display_name text,
    account_holder text,
    account_number text,
    ifsc_code text,
    bank_name text,
    qr_code_url text,
    is_primary boolean DEFAULT false,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Ensure room_allocations has deposit_status
ALTER TABLE public.room_allocations 
ADD COLUMN IF NOT EXISTS deposit_status text NOT NULL DEFAULT 'pending' CHECK (deposit_status IN ('pending', 'paid'));

CREATE TABLE IF NOT EXISTS public.student_fees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id uuid NOT NULL REFERENCES public.room_allocations(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    hostel_id uuid NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
    amount numeric NOT NULL CHECK (amount >= 0),
    due_date date NOT NULL,
    billing_period text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'pending_verification', 'paid', 'overdue')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_id uuid REFERENCES public.student_fees(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    amount numeric NOT NULL CHECK (amount >= 0),
    payment_method text NOT NULL,
    reference_number text,
    proof_url text,
    status text NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'completed', 'failed')),
    verified_at timestamptz,
    verified_by uuid REFERENCES auth.users(id),
    notes text,
    paid_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- Create notifications table IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL,
    read boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- RLS Enable
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- payment_methods policies
DROP POLICY IF EXISTS "Owners manage their own payment methods" ON public.payment_methods;
CREATE POLICY "Owners manage their own payment methods" ON public.payment_methods
    FOR ALL TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Students can read hostel owner payment methods" ON public.payment_methods;
CREATE POLICY "Students can read hostel owner payment methods" ON public.payment_methods
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.room_allocations ra
            JOIN public.hostels h ON h.id = ra.hostel_id
            WHERE ra.student_id = (SELECT id FROM public.students WHERE profile_id = auth.uid())
            AND h.owner_id = owner_id
        )
    );

-- student_fees policies
DROP POLICY IF EXISTS "Students can read their own fees" ON public.student_fees;
CREATE POLICY "Students can read their own fees" ON public.student_fees
    FOR SELECT TO authenticated USING (
        student_id = (SELECT id FROM public.students WHERE profile_id = auth.uid())
    );

DROP POLICY IF EXISTS "Owners can read/write fees for their hostels" ON public.student_fees;
CREATE POLICY "Owners can read/write fees for their hostels" ON public.student_fees
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.hostels h
            WHERE h.id = hostel_id AND h.owner_id = auth.uid()
        )
    );

-- payments policies
DROP POLICY IF EXISTS "Students can read/write their own payments" ON public.payments;
CREATE POLICY "Students can read/write their own payments" ON public.payments
    FOR ALL TO authenticated USING (
        student_id = (SELECT id FROM public.students WHERE profile_id = auth.uid())
    );

DROP POLICY IF EXISTS "Owners can read/write payments for their hostels" ON public.payments;
CREATE POLICY "Owners can read/write payments for their hostels" ON public.payments
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.student_fees sf
            JOIN public.hostels h ON h.id = sf.hostel_id
            WHERE sf.id = fee_id AND h.owner_id = auth.uid()
        )
    );

-- 2. RPC functions

-- create_student_fees RPC
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

    -- Generate fees for current month + next 2 months (total 3 months)
    FOR i IN 0..2 LOOP
        -- Calculate due date
        v_due_date := (date_trunc('month', v_start_date + (i || ' month')::interval) + (v_day - 1 || ' days')::interval)::date;
        v_billing_period := TRIM(to_char(v_due_date, 'Month YYYY'));

        -- Insert fee
        INSERT INTO public.student_fees (
            allocation_id,
            student_id,
            hostel_id,
            amount,
            due_date,
            billing_period,
            status
        )
        VALUES (
            p_allocation_id,
            v_student_id,
            v_hostel_id,
            v_rent,
            v_due_date,
            v_billing_period,
            'pending'
        )
        ON CONFLICT DO NOTHING; -- prevent duplicates if rerun
    END LOOP;

    -- Create notification for student
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT p.user_id, 'Fees Schedule Generated', 'Your monthly fees schedule has been generated for the next 3 months.', 'fees'
    FROM public.students s
    JOIN public.profiles p ON p.id = s.profile_id
    WHERE s.id = v_student_id;
END;
$$;

-- mark_deposit_paid RPC
CREATE OR REPLACE FUNCTION public.mark_deposit_paid(
    p_allocation_id uuid,
    p_amount numeric,
    p_date date,
    p_owner_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_student_id uuid;
    v_hostel_id uuid;
    v_owner_user_id uuid;
BEGIN
    -- Get student and hostel details
    SELECT student_id, hostel_id INTO v_student_id, v_hostel_id
    FROM public.room_allocations
    WHERE id = p_allocation_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Allocation not found.';
    END IF;

    -- Get owner's user_id
    v_owner_user_id := COALESCE(p_owner_id, auth.uid());

    -- Update allocation deposit status
    UPDATE public.room_allocations
    SET deposit_status = 'paid'
    WHERE id = p_allocation_id;

    -- Create payment record
    INSERT INTO public.payments (
        fee_id,
        student_id,
        amount,
        payment_method,
        status,
        verified_at,
        verified_by,
        notes,
        paid_at
    )
    VALUES (
        NULL,
        v_student_id,
        p_amount,
        'manual',
        'completed',
        now(),
        v_owner_user_id,
        'Security Deposit Paid',
        p_date
    );

    -- Notify student
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT p.user_id, 'Security Deposit Paid', 'Your security deposit has been verified as paid ✓', 'payment'
    FROM public.students s
    JOIN public.profiles p ON p.id = s.profile_id
    WHERE s.id = v_student_id;
END;
$$;

-- mark_fee_paid_manual RPC
CREATE OR REPLACE FUNCTION public.mark_fee_paid_manual(
    p_student_fees_id uuid,
    p_amount numeric,
    p_payment_method text,
    p_date date,
    p_notes text,
    p_verified_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_student_id uuid;
    v_billing_period text;
BEGIN
    -- Fetch student and billing period
    SELECT student_id, billing_period INTO v_student_id, v_billing_period
    FROM public.student_fees
    WHERE id = p_student_fees_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Fee record not found.';
    END IF;

    -- Update fee status
    UPDATE public.student_fees
    SET status = 'paid',
        updated_at = now()
    WHERE id = p_student_fees_id;

    -- Check if a payment proof record already exists for this fee and is pending
    UPDATE public.payments
    SET status = 'completed',
        amount = p_amount,
        payment_method = p_payment_method,
        verified_at = now(),
        verified_by = p_verified_by,
        notes = COALESCE(p_notes, notes),
        paid_at = p_date
    WHERE fee_id = p_student_fees_id AND status = 'pending_verification';

    IF NOT FOUND THEN
        INSERT INTO public.payments (
            fee_id,
            student_id,
            amount,
            payment_method,
            status,
            verified_at,
            verified_by,
            notes,
            paid_at
        )
        VALUES (
            p_student_fees_id,
            v_student_id,
            p_amount,
            p_payment_method,
            'completed',
            now(),
            p_verified_by,
            p_notes,
            p_date
        );
    END IF;

    -- Notify student
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT p.user_id, 'Payment Verified', 'Your payment for ' || v_billing_period || ' has been marked as paid ✓', 'payment'
    FROM public.students s
    JOIN public.profiles p ON p.id = s.profile_id
    WHERE s.id = v_student_id;
END;
$$;

-- record_student_payment RPC
CREATE OR REPLACE FUNCTION public.record_student_payment(
    p_student_fees_id uuid,
    p_reference_number text,
    p_proof_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_student_id uuid;
    v_hostel_id uuid;
    v_amount numeric;
    v_billing_period text;
    v_owner_user_id uuid;
    v_student_name text;
BEGIN
    -- Get fee details
    SELECT student_id, hostel_id, amount, billing_period 
    INTO v_student_id, v_hostel_id, v_amount, v_billing_period
    FROM public.student_fees
    WHERE id = p_student_fees_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Fee record not found.';
    END IF;

    -- Get student name for the notification
    SELECT p.full_name INTO v_student_name
    FROM public.students s
    JOIN public.profiles p ON p.id = s.profile_id
    WHERE s.id = v_student_id;

    -- Get owner user_id
    SELECT owner_id INTO v_owner_user_id
    FROM public.hostels
    WHERE id = v_hostel_id;

    -- Update fee status
    UPDATE public.student_fees
    SET status = 'pending_verification',
        updated_at = now()
    WHERE id = p_student_fees_id;

    -- Create or update payment record
    INSERT INTO public.payments (
        fee_id,
        student_id,
        amount,
        payment_method,
        reference_number,
        proof_url,
        status,
        paid_at
    )
    VALUES (
        p_student_fees_id,
        v_student_id,
        v_amount,
        'upi',
        p_reference_number,
        p_proof_url,
        'pending_verification',
        now()
    )
    ON CONFLICT (id) DO UPDATE
    SET reference_number = p_reference_number,
        proof_url = p_proof_url,
        status = 'pending_verification',
        paid_at = now();

    -- Notify owner
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
        v_owner_user_id,
        'Payment Proof Submitted',
        COALESCE(v_student_name, 'A student') || ' has submitted payment proof for ' || v_billing_period,
        'payment'
    );
END;
$$;

-- get_student_fees RPC
CREATE OR REPLACE FUNCTION public.get_student_fees(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fees jsonb;
    v_total_due numeric := 0;
    v_total_paid numeric := 0;
    v_total_overdue numeric := 0;
BEGIN
    -- Overdue check (set pending to overdue if due_date is in past)
    UPDATE public.student_fees
    SET status = 'overdue'
    WHERE student_id = p_student_id AND status = 'pending' AND due_date < CURRENT_DATE;

    -- Calculate totals
    SELECT COALESCE(SUM(amount), 0) INTO v_total_due
    FROM public.student_fees
    WHERE student_id = p_student_id AND status IN ('pending', 'overdue');

    SELECT COALESCE(SUM(amount), 0) INTO v_total_overdue
    FROM public.student_fees
    WHERE student_id = p_student_id AND status = 'overdue';

    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM public.student_fees
    WHERE student_id = p_student_id AND status = 'paid';

    -- Build fees array
    SELECT jsonb_agg(f ORDER BY f.due_date ASC) INTO v_fees
    FROM (
        SELECT sf.*, 
               p.reference_number, p.proof_url, p.payment_method, p.paid_at, p.status as payment_status
        FROM public.student_fees sf
        LEFT JOIN public.payments p ON p.fee_id = sf.id
        WHERE sf.student_id = p_student_id
    ) f;

    RETURN jsonb_build_object(
        'fees', COALESCE(v_fees, '[]'::jsonb),
        'total_due', v_total_due,
        'total_paid', v_total_paid,
        'total_overdue', v_total_overdue
    );
END;
$$;

-- Create payments and payment-methods storage buckets if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('payments', 'payments', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-methods', 'payment-methods', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for payments and payment-methods buckets
DROP POLICY IF EXISTS "Public Read Access for Payments" ON storage.objects;
CREATE POLICY "Public Read Access for Payments" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'payments');

DROP POLICY IF EXISTS "Auth Insert Access for Payments" ON storage.objects;
CREATE POLICY "Auth Insert Access for Payments" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payments');

DROP POLICY IF EXISTS "Public Read Access for Payment Methods" ON storage.objects;
CREATE POLICY "Public Read Access for Payment Methods" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'payment-methods');

DROP POLICY IF EXISTS "Auth Insert Access for Payment Methods" ON storage.objects;
CREATE POLICY "Auth Insert Access for Payment Methods" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-methods');
