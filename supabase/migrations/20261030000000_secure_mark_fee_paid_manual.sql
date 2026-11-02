-- ============================================================================
-- Migration: 20261030000000_secure_mark_fee_paid_manual.sql
-- Status: UNAPPLIED — PROPOSED FOR REVIEW ONLY
-- Purpose: P0 Security, Idempotency & Full Settlement Reconciliation for mark_fee_paid_manual
--          and Service-Role Coordinated Payment Gateway RPCs
--
-- Security Controls:
--   1. SECURITY DEFINER with hardened search_path = public, pg_temp across all functions.
--   2. Explicit authorization check in mark_fee_paid_manual: requires authenticated hostel owner
--      (hostels.owner_id = auth.uid()) or super_admin (profiles.role or user_roles).
--   3. Service-role bypass support in mark_fee_paid_manual with verified_by = NULL.
--   4. Ignores client-supplied p_verified_by; derives verifier strictly from auth.uid().
--   5. Internal gateway RPCs (create_gateway_payment_order, confirm_gateway_payment, fail_gateway_payment)
--      are restricted strictly to service_role with explicit execution revokes from PUBLIC, anon,
--      and authenticated, plus runtime service_role claim validation.
--
-- Financial & Settlement Hardening:
--   1. Strict Hierarchical Lock Order: all settlement and gateway functions lock student_fees FIRST,
--      then payments row SECOND, mathematically eliminating deadlock cycles.
--   2. Full settlement calculation: calculates authoritative remaining balance from invoice total
--      minus all genuine completed, verified, and partial payments.
--   3. Rejection of overpayments and underpayments: requires recording exact remaining balance
--      for complete settlement; rejects negative balance / ledger over-collection.
--   4. Zero-remaining-balance safety: reconciles already-covered fees to paid without inserting
--      duplicate payment records; rejects further collections on settled fees.
--   5. Dual-Path Completed-Payment Detection (Step 7):
--      - Path A: Standard completed or verified payment records.
--      - Path B: Gateway-captured payments with verified proof (auto_verified = true
--        or gateway_payment_id IS NOT NULL), even if legacy status indicates pending.
--   6. Pending-Proof Selection Hardening (Step 8):
--      - Positive whitelist: NULL, pending, pending_verification, manual_pending.
--      - Strictly excludes completed, partial, failed, rejected, and unknown non-NULL values.
--      - Excludes any records with gateway proof (auto_verified = true or gateway_payment_id IS NOT NULL).
--   7. Superseded Proof Cancellation Hardening (Step 10):
--      - Cancellation queries explicitly target only genuine superseded pending proofs.
--      - Gateway-completed payments, partial payments, failed/rejected records, and unknown records
--        are never mutated or cancelled.
--   8. Atomic Gateway Order Reservation & Reconciliation:
--      - create_gateway_payment_order locks student_fees FOR UPDATE and enforces that only ONE
--        active gateway order can exist per fee, preventing concurrent double-reservations.
--      - Reservation lifecycle is tied strictly to explicit gateway events (confirmation, definitive
--        rejection) or authenticated administrative intervention, not an arbitrary local 30-minute timer.
--      - Ambiguous network failures retain reservations in a non-reusable state for reconciliation.
--   9. Hardened Confirmation:
--      - confirm_gateway_payment requires non-null positive p_amount, rejects missing fee records,
--        and verifies consistency between student_fees_id and fee_id.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_fee_paid_manual(
    p_student_fees_id UUID,
    p_amount NUMERIC,
    p_payment_method TEXT,
    p_date DATE,
    p_notes TEXT,
    p_verified_by UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_is_authorized BOOLEAN := FALSE;
    v_is_service_role BOOLEAN := FALSE;
    
    -- Fee and hostel record
    v_fee_id UUID;
    v_student_id UUID;
    v_hostel_id UUID;
    v_month_year TEXT;
    v_hostel_owner_id UUID;
    v_original_fee_status TEXT;
    v_fee_amount_due NUMERIC;
    v_fee_amount NUMERIC;
    v_fee_paid_date TIMESTAMPTZ;
    
    -- Settlement and ledger balance
    v_authoritative_total NUMERIC;
    v_already_paid NUMERIC := 0;
    v_remaining_balance NUMERIC;
    
    -- Sanitized inputs
    v_payment_amount NUMERIC;
    v_payment_method TEXT;
    v_resolved_paid_date TIMESTAMPTZ;
    v_payment_notes TEXT;
    
    -- Verifier and payment resolution
    v_verifier_profile_id UUID := NULL;
    v_existing_completed_id UUID := NULL;
    v_existing_payment_paid_at TIMESTAMPTZ := NULL;
    v_existing_payment_paid_date TIMESTAMPTZ := NULL;
    v_pending_payment_id UUID := NULL;
    v_student_user_id UUID := NULL;
    v_should_notify_student BOOLEAN := FALSE;
BEGIN
    -- 1. Identify caller authentication context
    v_caller_id := auth.uid();
    v_is_service_role := (COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role');

    IF v_caller_id IS NULL AND NOT v_is_service_role THEN
        RAISE EXCEPTION 'Authentication required to mark fee as paid';
    END IF;

    -- 2. Validate input constraints
    IF p_student_fees_id IS NULL THEN
        RAISE EXCEPTION 'Fee ID is required';
    END IF;

    IF p_amount IS NOT NULL AND p_amount <= 0 THEN
        RAISE EXCEPTION 'Invalid payment amount: amount must be greater than zero';
    END IF;

    -- 3. Hierarchical Lock 1: Atomically lock target fee and retrieve hostel ownership FIRST
    SELECT 
        sf.id,
        sf.student_id,
        sf.hostel_id,
        sf.month_year,
        sf.status,
        sf.amount_due,
        sf.amount,
        sf.paid_date,
        h.owner_id
    INTO 
        v_fee_id,
        v_student_id,
        v_hostel_id,
        v_month_year,
        v_original_fee_status,
        v_fee_amount_due,
        v_fee_amount,
        v_fee_paid_date,
        v_hostel_owner_id
    FROM public.student_fees sf
    JOIN public.hostels h ON h.id = sf.hostel_id
    WHERE sf.id = p_student_fees_id
    FOR UPDATE OF sf;

    IF v_fee_id IS NULL THEN
        RAISE EXCEPTION 'Fee record not found or has no associated hostel.';
    END IF;

    -- 4. Enforce strict authorization
    IF v_is_service_role THEN
        v_is_authorized := TRUE;
    ELSE
        v_is_authorized := (v_hostel_owner_id = v_caller_id)
                        OR EXISTS (
                            SELECT 1 FROM public.profiles p
                            WHERE p.user_id = v_caller_id AND p.role = 'super_admin'
                        )
                        OR public.has_role(v_caller_id, 'super_admin'::public.app_role);
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Forbidden: You are not authorized to mark this fee as paid';
    END IF;

    -- 5. Prepare sanitized payment parameters, ledger balance & deterministic date
    -- Authoritative Total Resolution:
    v_authoritative_total := COALESCE(v_fee_amount_due, v_fee_amount);

    IF v_authoritative_total IS NULL OR v_authoritative_total <= 0 THEN
        RAISE EXCEPTION 'Invalid fee ledger: invoice total amount must be greater than zero';
    END IF;

    -- Aggregate genuine collected payments:
    -- Matches Path A, Path B, and genuine partial collections
    SELECT COALESCE(SUM(COALESCE(NULLIF(amount_paid, 0), NULLIF(amount, 0), 0)), 0)
    INTO v_already_paid
    FROM public.payments
    WHERE (student_fees_id = v_fee_id OR fee_id = v_fee_id)
      AND (
          -- Path A: Standard completed or verified payments
          (
              status IN ('completed', 'verified')
              AND (payment_status IS NULL OR payment_status IN ('completed', 'verified'))
              AND status NOT IN ('pending', 'manual_pending', 'failed', 'rejected')
              AND (payment_status IS NULL OR payment_status NOT IN ('pending', 'pending_verification', 'manual_pending', 'failed', 'rejected', 'partial'))
          )
          OR
          -- Path B: Gateway-captured payments with verified proof
          (
              payment_status IN ('completed', 'verified')
              AND (auto_verified = TRUE OR gateway_payment_id IS NOT NULL)
              AND (status IS NULL OR status NOT IN ('failed', 'rejected'))
              AND payment_status NOT IN ('failed', 'rejected', 'partial')
          )
          OR
          -- Category 2: Genuine partial collections
          (
              payment_status = 'partial'
              AND status NOT IN ('failed', 'rejected')
          )
          OR
          -- Category 3: Overpaid captured payments (genuine captured funds requiring/pending reconciliation)
          (
              status IN ('completed', 'verified')
              AND payment_status = 'overpaid'
          )
      );

    v_remaining_balance := v_authoritative_total - v_already_paid;

    -- Financial & Ledger Validation:
    IF v_remaining_balance < 0 THEN
        RAISE EXCEPTION 'Invalid fee ledger: total payments exceed invoice balance';
    END IF;

    -- If fee is already fully settled, prevent further payment collection
    IF v_remaining_balance = 0 AND p_amount IS NOT NULL AND p_amount > 0 THEN
        RAISE EXCEPTION 'Fee is already fully settled';
    END IF;

    -- Full settlement amount validation:
    -- When p_amount is explicitly provided, it must match the remaining balance
    IF p_amount IS NOT NULL AND v_remaining_balance > 0 AND p_amount != v_remaining_balance THEN
        IF p_amount > v_remaining_balance THEN
            RAISE EXCEPTION 'Overpayment rejected: payment amount (%) exceeds remaining balance (%)', p_amount, v_remaining_balance;
        ELSE
            RAISE EXCEPTION 'Underpayment rejected: full settlement requires recording exact remaining balance (%)', v_remaining_balance;
        END IF;
    END IF;

    v_payment_amount := COALESCE(p_amount, NULLIF(v_remaining_balance, 0), v_authoritative_total);

    IF v_payment_amount IS NULL OR v_payment_amount <= 0 THEN
        IF v_remaining_balance > 0 THEN
            RAISE EXCEPTION 'Invalid payment amount: payment amount must be greater than zero';
        END IF;
    END IF;

    v_payment_method := NULLIF(TRIM(p_payment_method), '');
    IF v_payment_method IS NULL THEN
        v_payment_method := 'cash';
    END IF;

    -- Deterministic payment date resolution:
    -- If fee was already 'paid' and has an existing paid_date, preserve that historical date!
    -- Otherwise, convert p_date explicitly to UTC midnight (or default to NOW())
    IF v_original_fee_status = 'paid' AND v_fee_paid_date IS NOT NULL THEN
        v_resolved_paid_date := v_fee_paid_date;
    ELSIF p_date IS NOT NULL THEN
        v_resolved_paid_date := timezone('UTC', p_date::timestamp);
    ELSE
        v_resolved_paid_date := NOW();
    END IF;

    v_payment_notes := NULLIF(TRIM(p_notes), '');

    -- 6. Resolve trusted verifier identity
    IF v_is_service_role THEN
        v_verifier_profile_id := NULL;
        v_payment_notes := COALESCE(v_payment_notes, 'Marked paid via service_role') || ' [Processed via service_role]';
    ELSE
        SELECT p.id INTO v_verifier_profile_id
        FROM public.profiles p
        WHERE p.user_id = v_caller_id
        LIMIT 1;

        v_payment_notes := COALESCE(v_payment_notes, 'Payment approved by owner');
    END IF;

    -- 7. Hierarchical Lock 2: Inspect existing completed payments
    -- Dual-Path Reconciliation:
    -- Path A: Standard completed or verified payments
    -- Path B: Gateway-captured payments with verified proof (auto_verified = true or gateway_payment_id IS NOT NULL)
    SELECT id, paid_at, paid_date 
    INTO v_existing_completed_id, v_existing_payment_paid_at, v_existing_payment_paid_date
    FROM public.payments
    WHERE (student_fees_id = v_fee_id OR fee_id = v_fee_id)
      AND (
          -- Path A: Standard completed / verified payments
          (
              status IN ('completed', 'verified')
              AND (payment_status IS NULL OR payment_status IN ('completed', 'verified'))
              AND status NOT IN ('pending', 'manual_pending', 'failed', 'rejected')
              AND (payment_status IS NULL OR payment_status NOT IN ('pending', 'pending_verification', 'manual_pending', 'failed', 'rejected', 'partial'))
          )
          OR
          -- Path B: Gateway-captured payments with verified gateway evidence
          (
              payment_status IN ('completed', 'verified')
              AND (auto_verified = TRUE OR gateway_payment_id IS NOT NULL)
              AND (status IS NULL OR status NOT IN ('failed', 'rejected'))
              AND payment_status NOT IN ('failed', 'rejected', 'partial')
          )
      )
    ORDER BY created_at DESC, id DESC
    LIMIT 1
    FOR UPDATE;

    -- 8. Hierarchical Lock 2: Inspect latest pending proof (if any)
    -- Eligible pending proofs must indicate pending in at least one status field,
    -- must NOT be failed, rejected, or partial, and must match the positive whitelist
    -- for payment_status (NULL, pending, pending_verification, manual_pending).
    -- Strictly excludes completed, partial, failed, rejected, unknown non-NULL values,
    -- and any records carrying gateway verification proof.
    SELECT id INTO v_pending_payment_id
    FROM public.payments
    WHERE (student_fees_id = v_fee_id OR fee_id = v_fee_id)
      AND (status IN ('pending', 'manual_pending') OR payment_status IN ('pending', 'pending_verification', 'manual_pending'))
      AND status NOT IN ('failed', 'rejected')
      AND (payment_status IS NULL OR payment_status IN ('pending', 'pending_verification', 'manual_pending'))
      AND (payment_status IS NULL OR payment_status NOT IN ('failed', 'rejected', 'partial', 'completed', 'verified'))
      AND auto_verified IS NOT TRUE
      AND gateway_payment_id IS NULL
    ORDER BY created_at DESC, id DESC
    LIMIT 1
    FOR UPDATE;

    -- 9. Determine notification eligibility (only genuine unpaid-to-paid transitions)
    v_should_notify_student := (v_original_fee_status IS NULL OR v_original_fee_status != 'paid') 
                            AND (v_existing_completed_id IS NULL);

    -- 10. Execute State Reconciliation
    IF v_existing_completed_id IS NOT NULL THEN
        -- Case: A completed payment ALREADY exists (State B, State C, or Idempotent Repeat)
        -- a) Never insert a duplicate payment record
        -- b) Never overwrite existing completed payment's financial audit fields
        -- c) Fix fee status to paid if inconsistent, and backfill missing paid_date safely
        IF v_original_fee_status IS NULL 
           OR v_original_fee_status != 'paid' 
           OR v_fee_paid_date IS NULL THEN
            UPDATE public.student_fees
            SET 
                status = 'paid',
                paid_date = COALESCE(v_fee_paid_date, v_existing_payment_paid_date, v_existing_payment_paid_at, v_resolved_paid_date),
                updated_at = NOW()
            WHERE id = v_fee_id;
        END IF;

        -- d) Cancel any lingering pending proofs that were superseded (excluding gateway & partial records)
        IF v_pending_payment_id IS NOT NULL THEN
            UPDATE public.payments
            SET 
                status = 'failed',
                payment_status = 'rejected',
                notes = COALESCE(notes, '') || ' [Superseded by existing completed payment ' || v_existing_completed_id::TEXT || ']'
            WHERE (student_fees_id = v_fee_id OR fee_id = v_fee_id)
              AND id != v_existing_completed_id
              AND (
                  payment_status IN ('pending', 'pending_verification', 'manual_pending')
                  OR (payment_status IS NULL AND status IN ('pending', 'manual_pending'))
              )
              AND auto_verified IS NOT TRUE
              AND gateway_payment_id IS NULL
              AND (payment_status IS NULL OR payment_status NOT IN ('completed', 'verified', 'partial', 'failed', 'rejected'))
              AND status NOT IN ('failed', 'rejected');
        END IF;

        -- Exit cleanly without duplicate payments or notifications
        RETURN;
    ELSIF v_remaining_balance = 0 THEN
        -- Case: Fee is already fully covered by recorded partial or legacy payments
        IF v_original_fee_status IS NULL OR v_original_fee_status != 'paid' OR v_fee_paid_date IS NULL THEN
            UPDATE public.student_fees
            SET 
                status = 'paid',
                paid_date = COALESCE(v_fee_paid_date, v_resolved_paid_date),
                updated_at = NOW()
            WHERE id = v_fee_id;
        END IF;

        -- Cancel lingering pending proofs safely
        UPDATE public.payments
        SET 
            status = 'failed',
            payment_status = 'rejected',
            notes = COALESCE(notes, '') || ' [Superseded by fee settlement]'
        WHERE (student_fees_id = v_fee_id OR fee_id = v_fee_id)
          AND (
              payment_status IN ('pending', 'pending_verification', 'manual_pending')
              OR (payment_status IS NULL AND status IN ('pending', 'manual_pending'))
          )
          AND auto_verified IS NOT TRUE
          AND gateway_payment_id IS NULL
          AND (payment_status IS NULL OR payment_status NOT IN ('completed', 'verified', 'partial', 'failed', 'rejected'))
          AND status NOT IN ('failed', 'rejected');

        RETURN;
    ELSIF v_pending_payment_id IS NOT NULL THEN
        -- Case: No completed payment exists, but pending proof(s) exist (State D or Standard Verification)
        UPDATE public.student_fees
        SET 
            status = 'paid',
            paid_date = v_resolved_paid_date,
            payment_method = COALESCE(payment_method, v_payment_method),
            updated_at = NOW()
        WHERE id = v_fee_id;

        -- Complete the single latest pending proof
        UPDATE public.payments
        SET 
            status = 'completed',
            payment_status = 'completed',
            amount = v_payment_amount,
            amount_paid = v_payment_amount,
            payment_method = v_payment_method,
            verified_at = NOW(),
            verified_by = v_verifier_profile_id,
            notes = v_payment_notes,
            paid_at = v_resolved_paid_date,
            paid_date = v_resolved_paid_date
        WHERE id = v_pending_payment_id;

        -- Cancel any older redundant pending proofs (never touching gateway or partial payments)
        UPDATE public.payments
        SET 
            status = 'failed',
            payment_status = 'rejected',
            notes = COALESCE(notes, '') || ' [Superseded by verified payment ' || v_pending_payment_id::TEXT || ']'
        WHERE (student_fees_id = v_fee_id OR fee_id = v_fee_id)
          AND id != v_pending_payment_id
          AND (
              payment_status IN ('pending', 'pending_verification', 'manual_pending')
              OR (payment_status IS NULL AND status IN ('pending', 'manual_pending'))
          )
          AND auto_verified IS NOT TRUE
          AND gateway_payment_id IS NULL
          AND (payment_status IS NULL OR payment_status NOT IN ('completed', 'verified', 'partial', 'failed', 'rejected'))
          AND status NOT IN ('failed', 'rejected');
    ELSE
        -- Case: Neither completed payment nor pending proof exists (State A or Manual Settlement)
        UPDATE public.student_fees
        SET 
            status = 'paid',
            paid_date = v_resolved_paid_date,
            payment_method = COALESCE(payment_method, v_payment_method),
            updated_at = NOW()
        WHERE id = v_fee_id;

        INSERT INTO public.payments (
            student_fees_id,
            fee_id,
            student_id,
            hostel_id,
            amount,
            amount_paid,
            payment_method,
            status,
            payment_status,
            verified_at,
            verified_by,
            notes,
            paid_at,
            paid_date
        ) VALUES (
            v_fee_id,
            v_fee_id,
            v_student_id,
            v_hostel_id,
            v_payment_amount,
            v_payment_amount,
            v_payment_method,
            'completed',
            'completed',
            NOW(),
            v_verifier_profile_id,
            v_payment_notes,
            v_resolved_paid_date,
            v_resolved_paid_date
        );
    END IF;

    -- 11. Notify student (only on genuine initial unpaid -> paid transition)
    IF v_should_notify_student AND v_student_id IS NOT NULL THEN
        SELECT p.user_id INTO v_student_user_id
        FROM public.students s
        JOIN public.profiles p ON p.id = s.profile_id
        WHERE s.id = v_student_id;

        IF v_student_user_id IS NOT NULL THEN
            INSERT INTO public.notifications (
                user_id,
                title,
                message,
                type
            ) VALUES (
                v_student_user_id,
                'Fee Payment Confirmed',
                'Your payment for ' || COALESCE(v_month_year, 'current period') || ' has been confirmed by the hostel owner.',
                'payment'
            );
        END IF;
    END IF;
END;
$$;

-- Revoke dangerous anon and public execution
REVOKE ALL ON FUNCTION public.mark_fee_paid_manual(UUID, NUMERIC, TEXT, DATE, TEXT, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mark_fee_paid_manual(UUID, NUMERIC, TEXT, DATE, TEXT, UUID) TO authenticated, service_role;


-- ============================================================================
-- Coordinated Payment Gateway RPC: create_gateway_payment_order
-- Atomic Reservation Policy: Restricts execution strictly to service_role,
-- enforces remaining balance validation, and prevents duplicate active orders.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_gateway_payment_order(
    p_fee_id UUID,
    p_gateway_order_id TEXT,
    p_amount NUMERIC,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_service_role BOOLEAN := FALSE;
    v_fee RECORD;
    v_already_paid NUMERIC := 0;
    v_remaining_balance NUMERIC := 0;
    v_active_order RECORD;
    v_new_payment_id UUID;
BEGIN
    -- Strict security: execution permitted ONLY by service_role
    v_is_service_role := (COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role');
    IF NOT v_is_service_role THEN
        RAISE EXCEPTION 'Forbidden: Only service_role can execute create_gateway_payment_order';
    END IF;

    IF p_fee_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Fee ID is required');
    END IF;

    IF p_gateway_order_id IS NULL OR TRIM(p_gateway_order_id) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Gateway order tracking ID is required');
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid order amount: positive amount required');
    END IF;

    -- 1. Hierarchical Lock 1: Atomically lock student_fees row FIRST
    SELECT id, student_id, allocation_id, hostel_id, amount, amount_due, status
    INTO v_fee
    FROM public.student_fees
    WHERE id = p_fee_id
    FOR UPDATE;

    IF v_fee.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Fee record not found');
    END IF;

    IF v_fee.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'This fee has already been paid');
    END IF;

    -- 2. Check remaining balance to prevent over-collection
    SELECT COALESCE(SUM(COALESCE(NULLIF(amount_paid, 0), NULLIF(amount, 0), 0)), 0)
    INTO v_already_paid
    FROM public.payments
    WHERE (student_fees_id = p_fee_id OR fee_id = p_fee_id)
      AND (
          (status IN ('completed', 'verified') AND (payment_status IS NULL OR payment_status IN ('completed', 'verified')))
          OR (payment_status IN ('completed', 'verified') AND (auto_verified = TRUE OR gateway_payment_id IS NOT NULL))
          OR (payment_status = 'partial' AND status NOT IN ('failed', 'rejected'))
          OR (status IN ('completed', 'verified') AND payment_status = 'overpaid')
      );

    v_remaining_balance := COALESCE(v_fee.amount_due, v_fee.amount) - v_already_paid;
    IF v_remaining_balance <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Fee is already fully covered by recorded payments');
    END IF;

    -- Validate that requested order amount matches authoritative remaining balance
    IF p_amount != v_remaining_balance THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Order amount mismatch: requested ' || p_amount::TEXT || ' but remaining balance is ' || v_remaining_balance::TEXT
        );
    END IF;

    -- 3. Atomic Order Reservation Policy: Check for active outstanding gateway orders
    -- Pending gateway orders remain active reservations until confirmed completed,
    -- or definitively rejected/cancelled by provider or owner via fail_gateway_payment.
    SELECT id, gateway_order_id, amount_paid, created_at
    INTO v_active_order
    FROM public.payments
    WHERE (student_fees_id = p_fee_id OR fee_id = p_fee_id)
      AND (status IN ('pending', 'manual_pending') OR payment_status IN ('pending', 'pending_verification', 'manual_pending'))
      AND payment_status NOT IN ('failed', 'rejected', 'completed', 'verified')
      AND status NOT IN ('failed', 'rejected', 'completed', 'verified')
      AND auto_verified IS NOT TRUE
      AND gateway_payment_id IS NULL
    ORDER BY created_at DESC, id DESC
    LIMIT 1
    FOR UPDATE;

    IF v_active_order.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'An active payment session is already in progress for this fee. Please complete the existing order or wait for confirmed provider cancellation.',
            'active_order_id', v_active_order.gateway_order_id,
            'amount', v_active_order.amount_paid
        );
    END IF;

    -- 4. Insert atomic pending reservation row (explicitly setting payment timestamps to NULL)
    INSERT INTO public.payments (
        student_fees_id,
        fee_id,
        student_id,
        allocation_id,
        hostel_id,
        amount,
        amount_paid,
        payment_method,
        payment_type,
        status,
        payment_status,
        gateway_order_id,
        reference_number,
        notes,
        paid_date,
        paid_at
    ) VALUES (
        v_fee.id,
        v_fee.id,
        v_fee.student_id,
        v_fee.allocation_id,
        v_fee.hostel_id,
        v_remaining_balance,
        v_remaining_balance,
        'knitpay',
        'rent',
        'pending',
        'pending',
        p_gateway_order_id,
        p_gateway_order_id,
        p_notes,
        NULL,
        NULL
    )
    RETURNING id INTO v_new_payment_id;

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_new_payment_id,
        'fee_id', v_fee.id,
        'amount', v_remaining_balance
    );
END;
$$;

-- Restrict execution strictly to service_role only
REVOKE ALL ON FUNCTION public.create_gateway_payment_order(UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_gateway_payment_order(UUID, TEXT, NUMERIC, TEXT) TO service_role;


-- ============================================================================
-- Coordinated Payment Gateway RPC: confirm_gateway_payment
-- Atomic verification, amount match, and settlement with strict hierarchical locking
-- (student_fees FIRST, payments SECOND) to prevent deadlocks.
-- Restricted strictly to service_role.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.confirm_gateway_payment(
    p_order_id TEXT,
    p_gateway_payment_id TEXT,
    p_amount NUMERIC,
    p_gateway_signature TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_service_role BOOLEAN := FALSE;
    v_payment_id UUID;
    v_fee_id UUID;
    v_legacy_fee_id UUID;
    v_student_id UUID;
    v_amount_paid NUMERIC;
    v_payment_status TEXT;
    v_status TEXT;
    v_target_fee_id UUID;
    v_locked_fee_id UUID;
    v_fee_current_status TEXT;
    v_other_collected NUMERIC := 0;
    v_fee_total NUMERIC;
    v_remaining_due NUMERIC := 0;
    v_excess_amount NUMERIC := 0;
BEGIN
    -- Strict security: execution permitted ONLY by service_role
    v_is_service_role := (COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role');
    IF NOT v_is_service_role THEN
        RAISE EXCEPTION 'Forbidden: Only service_role can execute confirm_gateway_payment';
    END IF;

    -- Validate input parameters: p_amount must be non-null and positive
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid captured amount: non-null positive amount is required');
    END IF;

    IF p_order_id IS NULL OR TRIM(p_order_id) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order ID is required');
    END IF;

    -- Preliminary non-locking lookup to determine target fee ID
    -- Supports lookup by external gateway_order_id, local reference_number (tracking ID), or primary key UUID
    SELECT id, student_fees_id, fee_id
    INTO v_payment_id, v_fee_id, v_legacy_fee_id
    FROM public.payments
    WHERE gateway_order_id = p_order_id
       OR reference_number = p_order_id
       OR id::TEXT = p_order_id;

    IF v_payment_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment transaction record not found');
    END IF;

    -- Consistency check: if both student_fees_id and fee_id are populated, they must match
    IF v_fee_id IS NOT NULL AND v_legacy_fee_id IS NOT NULL AND v_fee_id != v_legacy_fee_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Inconsistent payment record: student_fees_id (' || v_fee_id::TEXT || ') does not match fee_id (' || v_legacy_fee_id::TEXT || ')'
        );
    END IF;

    v_target_fee_id := COALESCE(v_fee_id, v_legacy_fee_id);
    IF v_target_fee_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment has no associated student fee record');
    END IF;

    -- 1. Hierarchical Lock 1: Lock associated student_fees row FIRST (eliminating deadlocks)
    SELECT id, status INTO v_locked_fee_id, v_fee_current_status
    FROM public.student_fees
    WHERE id = v_target_fee_id
    FOR UPDATE;

    IF v_locked_fee_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Associated student fee record not found');
    END IF;

    -- 2. Hierarchical Lock 2: Lock payment row SECOND
    SELECT id, student_id, amount_paid, payment_status, status
    INTO v_payment_id, v_student_id, v_amount_paid, v_payment_status, v_status
    FROM public.payments
    WHERE id = v_payment_id
    FOR UPDATE;

    -- 3. Idempotency Check: if already completed and verified, preserve audit fields and return
    IF v_payment_status IN ('completed', 'verified') AND v_status IN ('completed', 'verified') THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_processed', true,
            'payment_id', v_payment_id,
            'fee_id', v_target_fee_id,
            'student_id', v_student_id,
            'amount_paid', v_amount_paid
        );
    END IF;

    -- 4. Captured Amount Verification: validate captured amount against stored payment amount
    IF p_amount != v_amount_paid THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Captured amount mismatch: stored order is ' || v_amount_paid::TEXT || ' but gateway reported ' || p_amount::TEXT
        );
    END IF;

    -- 5. Late Callback & Overpayment Detection
    -- Calculate total collected payments by other records for this fee
    SELECT COALESCE(SUM(COALESCE(NULLIF(amount_paid, 0), NULLIF(amount, 0), 0)), 0)
    INTO v_other_collected
    FROM public.payments
    WHERE (student_fees_id = v_target_fee_id OR fee_id = v_target_fee_id)
      AND id != v_payment_id
      AND (
          (status IN ('completed', 'verified') AND (payment_status IS NULL OR payment_status IN ('completed', 'verified')))
          OR (payment_status IN ('completed', 'verified') AND (auto_verified = TRUE OR gateway_payment_id IS NOT NULL))
          OR (payment_status = 'partial' AND status NOT IN ('failed', 'rejected'))
          OR (status IN ('completed', 'verified') AND payment_status = 'overpaid')
      );

    SELECT COALESCE(amount_due, amount) INTO v_fee_total
    FROM public.student_fees
    WHERE id = v_target_fee_id;

    v_remaining_due := GREATEST(v_fee_total - v_other_collected, 0);

    IF (v_other_collected + p_amount) > v_fee_total THEN
        -- Overpayment detected! Calculate exact excess amount requiring refund/reconciliation
        v_excess_amount := (v_other_collected + p_amount) - v_fee_total;

        IF v_other_collected >= v_fee_total THEN
            -- Subcase A: Fee was already 100% settled by prior collections before this capture arrived.
            -- Entire captured amount is excess overpayment. Student fee was already paid.
            UPDATE public.payments
            SET 
                status = 'completed',
                payment_status = 'overpaid',
                gateway_payment_id = COALESCE(p_gateway_payment_id, gateway_payment_id),
                gateway_signature = COALESCE(p_gateway_signature, gateway_signature),
                auto_verified = TRUE,
                verified_at = COALESCE(verified_at, NOW()),
                paid_at = COALESCE(paid_at, NOW()),
                paid_date = COALESCE(paid_date, NOW()),
                notes = COALESCE(p_notes, notes) || ' [LATE CAPTURE OVERPAYMENT: fee was already fully settled by other payments (prior collected: ₹' || v_other_collected::TEXT || ', fee total: ₹' || v_fee_total::TEXT || '). Entire captured amount ₹' || p_amount::TEXT || ' flagged as overpayment requiring refund/reconciliation]'
            WHERE id = v_payment_id;

            RETURN jsonb_build_object(
                'success', true,
                'already_processed', false,
                'overpayment_detected', true,
                'payment_id', v_payment_id,
                'fee_id', v_target_fee_id,
                'student_id', v_student_id,
                'amount_paid', v_amount_paid,
                'captured_amount', p_amount,
                'fee_total', v_fee_total,
                'prior_collected', v_other_collected,
                'remaining_due_prior', 0,
                'excess_amount', v_excess_amount,
                'fee_status_mutated', false,
                'message', 'Fee was already fully settled. Entire payment captured as overpayment for reconciliation.'
            );
        ELSE
            -- Subcase B: Fee had partial collections (v_other_collected < v_fee_total), and this capture exceeds remaining due.
            -- Example: Fee ₹10,000, prior collected ₹7,000, remaining due ₹3,000, captured ₹10,000 -> excess ₹7,000.
            -- 1. Preserve actual captured amount (p_amount = ₹10,000) on payment record (never understate captured funds).
            -- 2. Explicitly classify payment_status = 'overpaid'.
            -- 3. Document remaining due ₹3,000 and excess ₹7,000 requiring refund/reconciliation.
            UPDATE public.payments
            SET 
                status = 'completed',
                payment_status = 'overpaid',
                gateway_payment_id = COALESCE(p_gateway_payment_id, gateway_payment_id),
                gateway_signature = COALESCE(p_gateway_signature, gateway_signature),
                auto_verified = TRUE,
                verified_at = COALESCE(verified_at, NOW()),
                paid_at = COALESCE(paid_at, NOW()),
                paid_date = COALESCE(paid_date, NOW()),
                notes = COALESCE(p_notes, notes) || ' [PARTIAL-SETTLEMENT OVERPAYMENT: fee total ₹' || v_fee_total::TEXT || ', previously collected ₹' || v_other_collected::TEXT || ', captured ₹' || p_amount::TEXT || '. Remaining due was ₹' || v_remaining_due::TEXT || '; excess ₹' || v_excess_amount::TEXT || ' flagged for refund/reconciliation]'
            WHERE id = v_payment_id;

            -- 4. Mark student fee as paid since prior (7000) + current capture (10000) >= total (10000)
            --    without treating the entire ₹10,000 capture as ordinary due revenue.
            UPDATE public.student_fees
            SET 
                status = 'paid',
                paid_date = COALESCE(paid_date, NOW()),
                payment_method = 'knitpay'
            WHERE id = v_target_fee_id;

            RETURN jsonb_build_object(
                'success', true,
                'already_processed', false,
                'overpayment_detected', true,
                'payment_id', v_payment_id,
                'fee_id', v_target_fee_id,
                'student_id', v_student_id,
                'amount_paid', v_amount_paid,
                'captured_amount', p_amount,
                'fee_total', v_fee_total,
                'prior_collected', v_other_collected,
                'remaining_due_prior', v_remaining_due,
                'excess_amount', v_excess_amount,
                'fee_status_mutated', true,
                'message', 'Fee settled with partial-settlement overpayment. Captured full amount but excess ₹' || v_excess_amount::TEXT || ' flagged for reconciliation/refund.'
            );
        END IF;
    END IF;

    -- 6. Normalize BOTH status columns on payments to completed
    UPDATE public.payments
    SET 
        status = 'completed',
        payment_status = 'completed',
        gateway_payment_id = COALESCE(p_gateway_payment_id, gateway_payment_id),
        gateway_signature = COALESCE(p_gateway_signature, gateway_signature),
        auto_verified = TRUE,
        verified_at = COALESCE(verified_at, NOW()),
        paid_at = COALESCE(paid_at, NOW()),
        paid_date = COALESCE(paid_date, NOW()),
        notes = COALESCE(p_notes, notes)
    WHERE id = v_payment_id;

    -- 7. Update student fee status to paid
    UPDATE public.student_fees
    SET 
        status = 'paid',
        paid_date = COALESCE(paid_date, NOW()),
        payment_method = 'knitpay'
    WHERE id = v_target_fee_id;

    RETURN jsonb_build_object(
        'success', true,
        'already_processed', false,
        'overpayment_detected', false,
        'payment_id', v_payment_id,
        'fee_id', v_target_fee_id,
        'student_id', v_student_id,
        'amount_paid', v_amount_paid,
        'excess_amount', 0
    );
END;
$$;

-- Restrict execution strictly to service_role only
REVOKE ALL ON FUNCTION public.confirm_gateway_payment(TEXT, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_gateway_payment(TEXT, TEXT, NUMERIC, TEXT, TEXT) TO service_role;


-- ============================================================================
-- Coordinated Payment Gateway RPC: fail_gateway_payment
-- Atomic failure marking with hierarchical row locking (student_fees FIRST, payments SECOND).
-- Restricted strictly to service_role.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fail_gateway_payment(
    p_order_id TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_service_role BOOLEAN := FALSE;
    v_payment_id UUID;
    v_fee_id UUID;
    v_legacy_fee_id UUID;
    v_target_fee_id UUID;
    v_payment_status TEXT;
    v_status TEXT;
BEGIN
    -- Strict security: execution permitted ONLY by service_role
    v_is_service_role := (COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role');
    IF NOT v_is_service_role THEN
        RAISE EXCEPTION 'Forbidden: Only service_role can execute fail_gateway_payment';
    END IF;

    -- Preliminary non-locking lookup to determine target fee ID
    -- Supports lookup by external gateway_order_id, local reference_number (tracking ID), or primary key UUID
    SELECT id, student_fees_id, fee_id
    INTO v_payment_id, v_fee_id, v_legacy_fee_id
    FROM public.payments
    WHERE gateway_order_id = p_order_id
       OR reference_number = p_order_id
       OR id::TEXT = p_order_id;

    IF v_payment_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment transaction record not found');
    END IF;

    v_target_fee_id := COALESCE(v_fee_id, v_legacy_fee_id);

    -- 1. Hierarchical Lock 1: Lock associated student_fees row FIRST
    IF v_target_fee_id IS NOT NULL THEN
        PERFORM 1 FROM public.student_fees WHERE id = v_target_fee_id FOR UPDATE;
    END IF;

    -- 2. Hierarchical Lock 2: Lock payment row SECOND
    SELECT id, payment_status, status
    INTO v_payment_id, v_payment_status, v_status
    FROM public.payments
    WHERE id = v_payment_id
    FOR UPDATE;

    -- 3. Never overwrite an already completed payment
    IF v_payment_status IN ('completed', 'verified') OR v_status IN ('completed', 'verified') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot fail an already completed payment');
    END IF;

    UPDATE public.payments
    SET 
        status = 'failed',
        payment_status = 'failed',
        notes = COALESCE(p_notes, notes)
    WHERE id = v_payment_id;

    RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id);
END;
$$;

-- Restrict execution strictly to service_role only
REVOKE ALL ON FUNCTION public.fail_gateway_payment(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_gateway_payment(TEXT, TEXT) TO service_role;
