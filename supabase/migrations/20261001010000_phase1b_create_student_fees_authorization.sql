-- ============================================================================
-- Migration: 20261001010000_phase1b_create_student_fees_authorization.sql
-- Description: Phase 1B Security Fix — create_student_fees authorization hardening
--
-- 1. Adds strict caller authorization check to create_student_fees(uuid):
--    - Requires authentication (auth.uid() NOT NULL or service_role context)
--    - Verifies caller is the hostel owner for the allocation's hostel_id (hostels.owner_id = auth.uid())
--      or super_admin (profiles.user_id = auth.uid() with role = 'super_admin' or has_role)
--    - Rejects unauthorized callers before any fee creation
--    - Uses canonical identity chain: auth.uid() -> profiles.user_id and hostels.owner_id = auth.uid()
--    - Never uses profiles.id as the authenticated identity
-- 2. Preserves existing signature, return table, 12-month generation, idempotency, and error formatting
-- 3. Revokes execution from anon and public
-- 4. Grants execution exclusively to authenticated users and service_role
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_student_fees(p_allocation_id UUID)
RETURNS TABLE(fee_id UUID, month_year TEXT, amount_due NUMERIC, due_date DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_student_id UUID;
    v_hostel_id UUID;
    v_room_id UUID;
    v_hostel_owner_id UUID;
    v_is_authorized BOOLEAN := FALSE;
    v_rent NUMERIC;
    v_start_date DATE;
    v_month DATE;
    v_month_year TEXT;
    v_due_date DATE;
    v_new_fee_id UUID;
    i INTEGER;
BEGIN
    -- 1. Retrieve allocation details and hostel owner
    SELECT 
        ra.student_id, 
        ra.hostel_id, 
        ra.room_id, 
        COALESCE(ra.start_date, CURRENT_DATE),
        h.owner_id
    INTO 
        v_student_id, 
        v_hostel_id, 
        v_room_id, 
        v_start_date,
        v_hostel_owner_id
    FROM public.room_allocations ra
    LEFT JOIN public.hostels h ON h.id = ra.hostel_id
    WHERE ra.id = p_allocation_id;

    -- If allocation does not exist, maintain existing behavior
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Allocation not found for ID %', p_allocation_id;
    END IF;

    -- 2. Caller Authentication & Authorization Check
    v_caller_id := auth.uid();

    -- Check if called in a server/service_role context (auth.uid() is null but role is service_role)
    IF v_caller_id IS NULL THEN
        IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
            v_is_authorized := TRUE;
        ELSE
            RAISE EXCEPTION 'Authentication required to create student fees';
        END IF;
    ELSE
        -- Authorized if:
        -- a) Caller is the hostel owner for this allocation (hostels.owner_id = auth.uid())
        -- b) Caller is super_admin via profiles.user_id = auth.uid() or user_roles
        v_is_authorized := (v_hostel_owner_id = v_caller_id)
                        OR EXISTS (
                            SELECT 1 FROM public.profiles p 
                            WHERE p.user_id = v_caller_id 
                              AND p.role = 'super_admin'
                        )
                        OR public.has_role(v_caller_id, 'super_admin'::public.app_role);
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Forbidden: You are not authorized to create fees for this allocation';
    END IF;

    -- 3. Retrieve room rent
    SELECT rent INTO v_rent FROM public.rooms WHERE id = v_room_id;
    v_rent := COALESCE(v_rent, 5000);

    -- 4. Start from the first day of the start_date month
    v_month := DATE_TRUNC('month', v_start_date)::DATE;

    -- 5. Generate 12 consecutive months idempotently
    FOR i IN 0..11 LOOP
        v_month_year := TO_CHAR(v_month, 'YYYY-MM');
        v_due_date := v_month + INTERVAL '14 days';

        -- Insert with explicit conflict target on (allocation_id, month_year)
        INSERT INTO public.student_fees (
            student_id, allocation_id, room_id, hostel_id,
            month_year, amount_due, amount, due_date, status, created_at
        )
        VALUES (
            v_student_id, p_allocation_id, v_room_id, v_hostel_id,
            v_month_year, v_rent, v_rent, v_due_date, 'pending', NOW()
        )
        ON CONFLICT (allocation_id, month_year) DO NOTHING
        RETURNING id INTO v_new_fee_id;

        -- If row already existed, fetch existing fee ID
        IF v_new_fee_id IS NULL THEN
            SELECT id INTO v_new_fee_id
            FROM public.student_fees
            WHERE allocation_id = p_allocation_id
              AND month_year = v_month_year;
        END IF;

        fee_id := v_new_fee_id;
        month_year := v_month_year;
        amount_due := v_rent;
        due_date := v_due_date;
        RETURN NEXT;

        v_month := v_month + INTERVAL '1 month';
    END LOOP;
END;
$$;

-- Revoke execute from public and anon
REVOKE ALL ON FUNCTION public.create_student_fees(UUID) FROM anon, public;

-- Grant execute exclusively to authenticated users and service_role
GRANT EXECUTE ON FUNCTION public.create_student_fees(UUID) TO authenticated, service_role;
