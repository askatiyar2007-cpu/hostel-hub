-- ============================================================================
-- Migration: Phase 1A - Student Fees Deduplication & Dedicated Room Vacation RPC
-- Version: 20261001000000
-- Date: 2026-10-01
-- Description:
--   1. Enforces uniqueness on student_fees(allocation_id, month_year).
--   2. Updates create_student_fees() to be strictly idempotent.
--   3. Introduces vacate_room_allocation() RPC separating room vacation from payments.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. DETECT DUPLICATES & ENFORCE UNIQUE CONSTRAINT ON student_fees
-- ============================================================================

DO $$
DECLARE
    v_dup_count INTEGER;
BEGIN
    -- Check for any existing duplicate fee records by (allocation_id, month_year)
    SELECT COUNT(*) INTO v_dup_count
    FROM (
        SELECT allocation_id, month_year, COUNT(*)
        FROM public.student_fees
        GROUP BY allocation_id, month_year
        HAVING COUNT(*) > 1
    ) dupes;

    IF v_dup_count > 0 THEN
        RAISE EXCEPTION 'MIGRATION STOPPED: Found % duplicate (allocation_id, month_year) groups in public.student_fees. Manual review required.', v_dup_count;
    END IF;
END;
$$;

-- Add unique constraint if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_student_fees_allocation_month'
    ) THEN
        ALTER TABLE public.student_fees
        ADD CONSTRAINT uq_student_fees_allocation_month UNIQUE (allocation_id, month_year);
    END IF;
END;
$$;


-- ============================================================================
-- 2. MAKE create_student_fees() STRICTLY IDEMPOTENT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_student_fees(p_allocation_id UUID)
RETURNS TABLE(fee_id UUID, month_year TEXT, amount_due NUMERIC, due_date DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    -- 1. Retrieve allocation details
    SELECT student_id, hostel_id, room_id, COALESCE(start_date, CURRENT_DATE)
    INTO v_student_id, v_hostel_id, v_room_id, v_start_date
    FROM public.room_allocations
    WHERE id = p_allocation_id;

    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Allocation not found for ID %', p_allocation_id;
    END IF;

    -- 2. Retrieve room rent
    SELECT rent INTO v_rent FROM public.rooms WHERE id = v_room_id;
    v_rent := COALESCE(v_rent, 5000);

    -- 3. Start from the first day of the start_date month
    v_month := DATE_TRUNC('month', v_start_date)::DATE;

    -- 4. Generate 12 consecutive months idempotently
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

GRANT EXECUTE ON FUNCTION public.create_student_fees(UUID) TO authenticated, service_role;


-- ============================================================================
-- 3. DEDICATED ROOM VACATION RPC: vacate_room_allocation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.vacate_room_allocation(p_alloc_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    r_alloc RECORD;
    v_is_authorized BOOLEAN;
    v_cancelled_fees_count INTEGER := 0;
BEGIN
    v_caller_id := auth.uid();
    
    -- 1. Require authentication
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to vacate room allocation';
    END IF;

    -- 2. Lock and retrieve allocation record with ownership details
    SELECT 
        ra.id,
        ra.room_id,
        ra.hostel_id,
        ra.student_id,
        ra.active,
        h.owner_id AS hostel_owner_id,
        p.user_id AS student_user_id
    INTO r_alloc
    FROM public.room_allocations ra
    JOIN public.hostels h ON h.id = ra.hostel_id
    LEFT JOIN public.students s ON s.id = ra.student_id
    LEFT JOIN public.profiles p ON p.id = s.profile_id
    WHERE ra.id = p_alloc_id
    FOR UPDATE OF ra;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Allocation % not found', p_alloc_id;
    END IF;

    -- 3. Verify caller authorization:
    -- Caller must be the owner of the hostel, the student themselves, or super_admin
    v_is_authorized := (r_alloc.hostel_owner_id = v_caller_id)
                    OR (r_alloc.student_user_id = v_caller_id)
                    OR public.has_role(v_caller_id, 'super_admin'::public.app_role);

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Forbidden: You are not authorized to vacate this room allocation';
    END IF;

    -- 4. If already inactive, return idempotent status
    IF NOT r_alloc.active THEN
        RETURN json_build_object(
            'success', true,
            'allocation_id', p_alloc_id::TEXT,
            'message', 'Allocation is already inactive',
            'active', false
        );
    END IF;

    -- 5. Deactivate allocation
    UPDATE public.room_allocations
    SET 
        active = false,
        end_date = CURRENT_DATE,
        status = 'checked_out'
    WHERE id = p_alloc_id;

    -- 6. Synchronize room occupancy
    PERFORM public.sync_room_occupancy(r_alloc.room_id);

    -- 7. Minimum safe future fee handling:
    -- Cancel ONLY unstayed future pending fees (due_date in the future)
    -- Preserve all already-paid fees and past dues
    UPDATE public.student_fees
    SET status = 'cancelled'
    WHERE allocation_id = p_alloc_id
      AND status = 'pending'
      AND due_date > CURRENT_DATE;

    GET DIAGNOSTICS v_cancelled_fees_count = ROW_COUNT;

    RETURN json_build_object(
        'success', true,
        'allocation_id', p_alloc_id::TEXT,
        'room_id', r_alloc.room_id::TEXT,
        'hostel_id', r_alloc.hostel_id::TEXT,
        'active', false,
        'end_date', CURRENT_DATE::TEXT,
        'cancelled_future_fees', v_cancelled_fees_count,
        'message', 'Room allocation vacated successfully'
    );
END;
$$;

-- Revoke dangerous anon execution
REVOKE ALL ON FUNCTION public.vacate_room_allocation(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.vacate_room_allocation(UUID) TO authenticated, service_role;

-- ============================================================================
-- 4. HARDEN LEGACY checkout_student FUNCTIONS (REVOKE ACCESS)
-- ============================================================================

-- Revoke execution permissions for both legacy overloads from public, anon, and authenticated
REVOKE ALL ON FUNCTION public.checkout_student(UUID) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.checkout_student(UUID, UUID, NUMERIC) FROM anon, authenticated, public;

COMMIT;
