-- Migration: P0 Manual Payment Hardening
-- Date: 2026-11-01
-- Scope: Manual payment workflow security, student submission hardening, atomic owner verification, RLS closure

-- ============================================================================
-- 1. PERMANENTLY DEPRECATE & DISABLE mark_payment_paid
-- ============================================================================

-- Revoke execute from public, anon, authenticated on legacy insecure function if it exists
DO $$
BEGIN
    IF to_regprocedure('public.mark_payment_paid(uuid)') IS NOT NULL THEN
        EXECUTE 'REVOKE ALL ON FUNCTION public.mark_payment_paid(uuid) FROM PUBLIC, anon, authenticated';
    END IF;
END $$;

-- Replace with an explicit deprecation failure to prevent any backdoor settlement path
CREATE OR REPLACE FUNCTION public.mark_payment_paid(p_fee_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'mark_payment_paid is permanently deprecated and disabled. Use mark_fee_paid_manual or verify_student_payment instead.';
END;
$$;

-- Keep execute strictly revoked from public, anon, authenticated; service_role only
REVOKE ALL ON FUNCTION public.mark_payment_paid(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_payment_paid(uuid) TO service_role;


-- ============================================================================
-- 2. HARDEN record_student_payment
-- ============================================================================

-- Clean up / migration guidance for duplicate pending submissions:
-- NOTE ON HISTORICAL DATA PRESERVATION:
-- Historical pending payment records are NOT silently overwritten or mutated to 'rejected' during migration.
-- All original submitted amounts, proof URLs, and status fields are preserved intact.
-- The partial unique index below enforces single active pending submission per fee going forward.

-- Precondition Checks: Ensure data integrity before creating the unique index or proceeding.
-- If pre-existing anomalies exist on staging/production, fail clearly and transactionally without mutating historical data.
DO $$
DECLARE
    v_dup_pending_count int;
    v_mismatched_fee_count int;
BEGIN
    -- Condition A: Duplicate active pending claims for the same fee
    SELECT count(*) INTO v_dup_pending_count
    FROM (
        SELECT COALESCE(student_fees_id, fee_id)
        FROM public.payments
        WHERE (status = 'pending_verification' OR payment_status = 'pending_verification')
          AND (student_fees_id IS NOT NULL OR fee_id IS NOT NULL)
        GROUP BY COALESCE(student_fees_id, fee_id)
        HAVING count(*) > 1
    ) dups;

    IF v_dup_pending_count > 0 THEN
        RAISE EXCEPTION 'Migration precondition A failed: Found % fee(s) with multiple active pending payments. Please run preflight reconciliation query A before applying idx_payments_single_pending_per_fee.', v_dup_pending_count;
    END IF;

    -- Condition B: Historical rows where both fee_id and student_fees_id are populated but differ
    SELECT count(*) INTO v_mismatched_fee_count
    FROM public.payments
    WHERE fee_id IS NOT NULL 
      AND student_fees_id IS NOT NULL 
      AND fee_id <> student_fees_id;

    IF v_mismatched_fee_count > 0 THEN
        RAISE EXCEPTION 'Migration precondition B failed: Found % historical payment row(s) with mismatched fee_id and student_fees_id. Please run preflight reconciliation query B before applying this migration.', v_mismatched_fee_count;
    END IF;
END $$;

-- Prevent concurrent duplicate pending submissions using a unique partial index on fee-linked payments
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_single_pending_per_fee 
ON public.payments (COALESCE(student_fees_id, fee_id)) 
WHERE (status = 'pending_verification' OR payment_status = 'pending_verification')
  AND (student_fees_id IS NOT NULL OR fee_id IS NOT NULL);

CREATE OR REPLACE FUNCTION public.record_student_payment(
    p_student_fees_id uuid,
    p_amount numeric,
    p_payment_method text,
    p_reference_number text,
    p_proof_url text DEFAULT NULL,
    p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id uuid := auth.uid();
    v_is_service_role boolean := (COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role');
    v_fee record;
    v_student_full_name text;
    v_already_paid numeric := 0;
    v_remaining_balance numeric;
    v_submitted_amount numeric;
    v_hostel_owner_id uuid;
    v_normalized_method text;
    v_trimmed_ref text;
    v_trimmed_proof text;
    v_effective_notes text;
BEGIN
    -- 1. Caller authentication
    IF v_caller_id IS NULL AND NOT v_is_service_role THEN
        RAISE EXCEPTION 'Authentication required to submit payment proof';
    END IF;

    IF p_student_fees_id IS NULL THEN
        RAISE EXCEPTION 'Fee ID is required';
    END IF;

    IF p_amount IS NOT NULL AND p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    -- 2. Payment method validation
    v_normalized_method := lower(trim(COALESCE(p_payment_method, 'upi')));
    IF v_normalized_method NOT IN ('upi', 'bank', 'cash', 'card') THEN
        RAISE EXCEPTION 'Invalid payment method: must be upi, bank, cash, or card';
    END IF;

    -- 3. Reference number validation
    v_trimmed_ref := trim(COALESCE(p_reference_number, ''));
    IF v_normalized_method IN ('upi', 'bank') AND v_trimmed_ref = '' THEN
        RAISE EXCEPTION 'Transaction reference number / UTR is required for % payments', v_normalized_method;
    END IF;

    IF length(v_trimmed_ref) > 120 THEN
        RAISE EXCEPTION 'Transaction reference number is too long (maximum 120 characters)';
    END IF;

    -- 4. Proof URL validation (format & storage boundary check)
    IF p_proof_url IS NOT NULL AND trim(p_proof_url) <> '' THEN
        v_trimmed_proof := trim(p_proof_url);
        -- Must be a valid HTTP/HTTPS URL or storage object path
        IF v_trimmed_proof !~* '^https?://[^\s/$.?#].[^\s]*$' AND v_trimmed_proof !~* '^/?(storage/v1/object/|payments/receipts/|receipts/)' THEN
            RAISE EXCEPTION 'Invalid proof URL format';
        END IF;
        -- Reject dangerous URI schemes
        IF v_trimmed_proof ~* '^(javascript|data|vbscript|file):' THEN
            RAISE EXCEPTION 'Disallowed URI scheme in proof URL';
        END IF;
        IF length(v_trimmed_proof) > 1000 THEN
            RAISE EXCEPTION 'Proof URL is too long (maximum 1000 characters)';
        END IF;
    END IF;

    -- 5. Lock target fee row (serializes concurrent submissions for the same fee)
    SELECT sf.id, sf.student_id, sf.hostel_id, sf.allocation_id, sf.status,
           COALESCE(sf.amount_due, sf.amount) as invoice_total, sf.month_year
    INTO v_fee
    FROM public.student_fees sf
    WHERE sf.id = p_student_fees_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Fee record not found';
    END IF;

    -- 6. Validate student ownership: Caller MUST be the student who owns the fee
    IF NOT v_is_service_role THEN
        SELECT p.full_name INTO v_student_full_name
        FROM public.students s
        JOIN public.profiles p ON p.id = s.profile_id
        WHERE s.id = v_fee.student_id
          AND (s.profile_id = v_caller_id OR p.user_id = v_caller_id);

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Forbidden: You are not authorized to submit payments for this fee';
        END IF;
    END IF;

    -- 7. Reject already-paid invoices
    IF v_fee.status = 'paid' THEN
        RAISE EXCEPTION 'Fee is already fully paid';
    END IF;

    -- 8. Data integrity check: Detect if any payment row for this fee has mismatched fee_id and student_fees_id
    IF EXISTS (
        SELECT 1 FROM public.payments
        WHERE (student_fees_id = v_fee.id OR fee_id = v_fee.id)
          AND fee_id IS NOT NULL 
          AND student_fees_id IS NOT NULL 
          AND fee_id <> student_fees_id
    ) THEN
        RAISE EXCEPTION 'Data integrity error: Payment record for fee % has mismatched fee_id and student_fees_id', v_fee.id;
    END IF;

    -- 9. Prevent duplicate pending submissions
    IF EXISTS (
        SELECT 1 FROM public.payments
        WHERE (student_fees_id = v_fee.id OR fee_id = v_fee.id)
          AND (
              status = 'pending_verification'
              OR payment_status = 'pending_verification'
          )
    ) THEN
        RAISE EXCEPTION 'A payment proof submission is already pending verification for this fee';
    END IF;

    -- 10. Aggregate genuine verified/completed collections using authoritative predicate
    SELECT COALESCE(SUM(COALESCE(NULLIF(amount_paid, 0), NULLIF(amount, 0), 0)), 0)
    INTO v_already_paid
    FROM public.payments
    WHERE (student_fees_id = v_fee.id OR fee_id = v_fee.id)
      AND status IN ('completed', 'verified')
      AND (payment_status IS NULL OR payment_status NOT IN ('pending', 'pending_verification', 'manual_pending', 'failed', 'rejected', 'superseded'))
      AND (payment_status IS NULL OR payment_status IN ('completed', 'verified', 'partial', 'overpaid'));

    v_remaining_balance := v_fee.invoice_total - v_already_paid;

    IF v_remaining_balance <= 0 THEN
        RAISE EXCEPTION 'Fee is already fully covered by recorded payments';
    END IF;

    v_submitted_amount := COALESCE(p_amount, v_remaining_balance);

    IF v_submitted_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    IF v_submitted_amount > v_remaining_balance THEN
        RAISE EXCEPTION 'Payment amount (%) exceeds remaining balance (%)', v_submitted_amount, v_remaining_balance;
    END IF;

    -- 10. Update fee state to pending_verification
    UPDATE public.student_fees
    SET status = 'pending_verification'
    WHERE id = p_student_fees_id;

    -- 11. Format effective notes preserving proof URL and student notes without inventing columns
    IF v_trimmed_proof IS NOT NULL AND v_trimmed_proof <> '' THEN
        IF p_notes IS NOT NULL AND trim(p_notes) <> '' THEN
            v_effective_notes := trim(p_notes) || ' [Receipt: ' || v_trimmed_proof || ']';
        ELSE
            v_effective_notes := '[Receipt: ' || v_trimmed_proof || ']';
        END IF;
    ELSE
        v_effective_notes := p_notes;
    END IF;

    -- 12. Insert new payment submission in pending_verification state ONLY
    -- Canonical fee identity: both student_fees_id and fee_id set identically.
    -- Explicitly insert paid_date = NULL because the live column defaults to now().
    INSERT INTO public.payments (
        student_fees_id,
        fee_id,
        student_id,
        allocation_id,
        hostel_id,
        amount_paid,
        amount,
        payment_method,
        reference_number,
        status,
        payment_status,
        verified_at,
        verified_by,
        notes,
        paid_date,
        created_at
    )
    VALUES (
        p_student_fees_id,
        p_student_fees_id,
        v_fee.student_id,
        v_fee.allocation_id,
        v_fee.hostel_id,
        v_submitted_amount,
        v_submitted_amount,
        v_normalized_method,
        v_trimmed_ref,
        'pending_verification',
        'pending_verification',
        NULL,
        NULL,
        v_effective_notes,
        NULL,
        now()
    );

    -- 12. Notify hostel owner
    SELECT owner_id INTO v_hostel_owner_id
    FROM public.hostels
    WHERE id = v_fee.hostel_id;

    IF v_hostel_owner_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
            v_hostel_owner_id,
            'Payment Proof Submitted',
            COALESCE(v_student_full_name, 'A student') || ' has submitted payment proof of ₹' || v_submitted_amount || ' for ' || COALESCE(v_fee.month_year, 'fee invoice'),
            'payment'
        );
    END IF;
END;
$$;

-- Backward-compatible overload for legacy 3-parameter invocations (delegates to identical logic)
CREATE OR REPLACE FUNCTION public.record_student_payment(
    p_student_fees_id uuid,
    p_reference_number text,
    p_proof_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM public.record_student_payment(
        p_student_fees_id => p_student_fees_id,
        p_amount => NULL,
        p_payment_method => 'upi',
        p_reference_number => p_reference_number,
        p_proof_url => p_proof_url,
        p_notes => NULL
    );
END;
$$;

REVOKE ALL ON FUNCTION public.record_student_payment(uuid, numeric, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_student_payment(uuid, numeric, text, text, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_student_payment(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_student_payment(uuid, text, text) TO authenticated, service_role;


-- ============================================================================
-- 3. IMPLEMENT ATOMIC OWNER VERIFICATION: verify_student_payment
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verify_student_payment(
    p_payment_id uuid,
    p_action text,
    p_verified_amount numeric DEFAULT NULL,
    p_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_auth_id uuid := auth.uid();
    v_is_service_role boolean := (COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role');
    v_verifier_profile_id uuid;
    v_normalized_action text;
    v_target_fee_id uuid;
    v_fee record;
    v_payment record;
    v_invoice_total numeric;
    v_other_paid numeric;
    v_remaining_before numeric;
    v_submitted_amount numeric;
    v_approved_amount numeric;
    v_new_total_paid numeric;
    v_new_fee_status text;
    v_new_payment_status text;
    v_student_user_id uuid;
BEGIN
    -- 1. Caller authentication
    IF v_caller_auth_id IS NULL AND NOT v_is_service_role THEN
        RAISE EXCEPTION 'Authentication required to verify payments';
    END IF;

    IF p_payment_id IS NULL THEN
        RAISE EXCEPTION 'Payment ID is required';
    END IF;

    v_normalized_action := lower(trim(COALESCE(p_action, '')));
    IF v_normalized_action NOT IN ('approve', 'verify', 'partial', 'reject') THEN
        RAISE EXCEPTION 'Invalid verification action: must be approve, verify, partial, or reject';
    END IF;

    -- 2. Identify associated fee record
    SELECT COALESCE(student_fees_id, fee_id) INTO v_target_fee_id
    FROM public.payments
    WHERE id = p_payment_id;

    IF v_target_fee_id IS NULL THEN
        RAISE EXCEPTION 'Associated fee record not found for payment %', p_payment_id;
    END IF;

    -- 3. Lock student_fees FIRST (Strict Lock Order: student_fees -> payments)
    SELECT sf.id, sf.student_id, sf.hostel_id, sf.month_year, sf.status,
           COALESCE(sf.amount_due, sf.amount) as invoice_total, sf.paid_date,
           h.owner_id as hostel_owner_id
    INTO v_fee
    FROM public.student_fees sf
    JOIN public.hostels h ON h.id = sf.hostel_id
    WHERE sf.id = v_target_fee_id
    FOR UPDATE OF sf;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Fee record not found';
    END IF;

    -- 4. Lock payments SECOND
    SELECT *
    INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record not found';
    END IF;

    -- Check for data integrity: detect if payment row has mismatched fee_id and student_fees_id
    IF v_payment.fee_id IS NOT NULL AND v_payment.student_fees_id IS NOT NULL AND v_payment.fee_id <> v_payment.student_fees_id THEN
        RAISE EXCEPTION 'Data integrity error: Payment record % has mismatched fee_id (%) and student_fees_id (%)',
            p_payment_id, v_payment.fee_id, v_payment.student_fees_id;
    END IF;

    -- 5. Ownership verification (NULL-safe IS DISTINCT FROM check + super_admin convention)
    IF NOT v_is_service_role 
       AND NOT public.has_role(v_caller_auth_id, 'super_admin'::public.app_role) 
       AND (v_fee.hostel_owner_id IS NULL OR v_fee.hostel_owner_id IS DISTINCT FROM v_caller_auth_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller does not own this hostel';
    END IF;

    -- 6. Terminal State & Transition Safeguards
    -- 6a. A payment already rejected CANNOT subsequently be approved, verified, or partially settled
    IF v_payment.status = 'rejected' OR v_payment.payment_status = 'rejected' THEN
        IF v_normalized_action = 'reject' THEN
            -- Idempotent reject retry
            RETURN json_build_object(
                'status', 'success',
                'message', 'Payment is already rejected',
                'payment_id', p_payment_id::text,
                'fee_status', v_fee.status
            );
        ELSE
            RAISE EXCEPTION 'Invalid payment transition: a payment already rejected cannot subsequently be verified or approved';
        END IF;
    END IF;

    -- 6b. A payment already verified/completed CANNOT be changed to rejected or approved again with a different amount
    IF v_payment.status IN ('verified', 'completed') OR v_payment.payment_status IN ('verified', 'completed', 'partial') THEN
        IF v_normalized_action = 'reject' THEN
            RAISE EXCEPTION 'Invalid payment transition: a verified payment cannot subsequently be rejected';
        END IF;

        IF v_normalized_action IN ('approve', 'verify', 'partial') THEN
            IF p_verified_amount IS NOT NULL AND p_verified_amount <> COALESCE(NULLIF(v_payment.amount_paid, 0), NULLIF(v_payment.amount, 0), 0) THEN
                RAISE EXCEPTION 'Cannot modify the approved amount (%) of an already verified payment (%)', p_verified_amount, COALESCE(NULLIF(v_payment.amount_paid, 0), NULLIF(v_payment.amount, 0));
            END IF;

            RETURN json_build_object(
                'status', 'success',
                'message', 'Payment is already verified',
                'payment_id', p_payment_id::text,
                'fee_status', v_fee.status
            );
        END IF;
    END IF;

    -- 7. Resolve verifier profile ID (correct profiles.id, not blindly auth.uid())
    SELECT id INTO v_verifier_profile_id
    FROM public.profiles
    WHERE user_id = v_caller_auth_id;

    IF v_verifier_profile_id IS NULL THEN
        SELECT id INTO v_verifier_profile_id
        FROM public.profiles
        WHERE id = v_caller_auth_id;
    END IF;

    -- 8. Authoritative payment aggregation: Compute prior genuine verified collections EXCLUDING current payment
    SELECT COALESCE(SUM(COALESCE(NULLIF(amount_paid, 0), NULLIF(amount, 0), 0)), 0)
    INTO v_other_paid
    FROM public.payments
    WHERE (student_fees_id = v_fee.id OR fee_id = v_fee.id)
      AND id <> p_payment_id
      AND status IN ('completed', 'verified')
      AND (payment_status IS NULL OR payment_status NOT IN ('pending', 'pending_verification', 'manual_pending', 'failed', 'rejected', 'superseded'))
      AND (payment_status IS NULL OR payment_status IN ('completed', 'verified', 'partial', 'overpaid'));

    v_invoice_total := v_fee.invoice_total;
    v_remaining_before := v_invoice_total - v_other_paid;
    v_submitted_amount := COALESCE(NULLIF(v_payment.amount_paid, 0), NULLIF(v_payment.amount, 0), 0);

    -- 9. Execute action
    IF v_normalized_action = 'reject' THEN
        UPDATE public.payments
        SET status = 'rejected',
            payment_status = 'rejected',
            verified_at = now(),
            verified_by = v_verifier_profile_id,
            notes = COALESCE(p_notes, notes)
        WHERE id = p_payment_id;

        -- Recalculate invoice status based on genuine verified payments remaining
        IF v_other_paid >= v_invoice_total THEN
            v_new_fee_status := 'paid';
        ELSIF v_other_paid > 0 THEN
            v_new_fee_status := 'partially_paid';
        ELSE
            v_new_fee_status := 'pending';
        END IF;

        UPDATE public.student_fees
        SET status = v_new_fee_status
        WHERE id = v_fee.id;

        v_new_payment_status := 'rejected';
        v_approved_amount := 0;

    ELSIF v_normalized_action IN ('approve', 'verify') THEN
        v_approved_amount := COALESCE(p_verified_amount, NULLIF(v_payment.amount_paid, 0), NULLIF(v_payment.amount, 0), v_remaining_before);

        IF v_approved_amount <= 0 THEN
            RAISE EXCEPTION 'Approved amount must be greater than zero';
        END IF;

        -- Approved amount cannot exceed the submitted payment claim
        IF v_submitted_amount > 0 AND v_approved_amount > v_submitted_amount THEN
            RAISE EXCEPTION 'Approved amount (%) cannot exceed the submitted payment amount (%)', v_approved_amount, v_submitted_amount;
        END IF;

        v_new_total_paid := v_other_paid + v_approved_amount;

        IF v_new_total_paid >= v_invoice_total THEN
            v_new_fee_status := 'paid';
            v_new_payment_status := CASE WHEN v_new_total_paid > v_invoice_total THEN 'overpaid' ELSE 'verified' END;
        ELSE
            v_new_fee_status := 'partially_paid';
            v_new_payment_status := 'partial';
        END IF;

        UPDATE public.payments
        SET status = 'verified',
            payment_status = v_new_payment_status,
            amount_paid = v_approved_amount,
            amount = v_approved_amount,
            verified_at = now(),
            verified_by = v_verifier_profile_id,
            paid_date = COALESCE(paid_date, now()),
            notes = COALESCE(p_notes, notes)
        WHERE id = p_payment_id;

        UPDATE public.student_fees
        SET status = v_new_fee_status,
            paid_date = CASE WHEN v_new_fee_status = 'paid' THEN COALESCE(v_fee.paid_date, now()) ELSE v_fee.paid_date END
        WHERE id = v_fee.id;

    ELSIF v_normalized_action = 'partial' THEN
        v_approved_amount := COALESCE(p_verified_amount, NULLIF(v_payment.amount_paid, 0), NULLIF(v_payment.amount, 0));

        IF v_approved_amount <= 0 THEN
            RAISE EXCEPTION 'Partial verified amount must be greater than zero';
        END IF;

        -- Approved partial amount cannot exceed submitted payment amount
        IF v_submitted_amount > 0 AND v_approved_amount > v_submitted_amount THEN
            RAISE EXCEPTION 'Partial approved amount (%) cannot exceed the submitted payment amount (%)', v_approved_amount, v_submitted_amount;
        END IF;

        -- Partial approval cannot exceed the remaining invoice balance
        IF v_approved_amount > v_remaining_before THEN
            RAISE EXCEPTION 'Partial approval amount (%) cannot exceed the remaining invoice balance (%)', v_approved_amount, v_remaining_before;
        END IF;

        v_new_total_paid := v_other_paid + v_approved_amount;

        IF v_new_total_paid >= v_invoice_total THEN
            v_new_fee_status := 'paid';
            v_new_payment_status := 'verified';
        ELSE
            v_new_fee_status := 'partially_paid';
            v_new_payment_status := 'partial';
        END IF;

        UPDATE public.payments
        SET status = 'verified',
            payment_status = v_new_payment_status,
            amount_paid = v_approved_amount,
            amount = v_approved_amount,
            verified_at = now(),
            verified_by = v_verifier_profile_id,
            paid_date = COALESCE(paid_date, now()),
            notes = COALESCE(p_notes, notes)
        WHERE id = p_payment_id;

        UPDATE public.student_fees
        SET status = v_new_fee_status,
            paid_date = CASE WHEN v_new_fee_status = 'paid' THEN COALESCE(v_fee.paid_date, now()) ELSE v_fee.paid_date END
        WHERE id = v_fee.id;
    END IF;

    -- 10. Student Notification
    SELECT p.user_id INTO v_student_user_id
    FROM public.students s
    JOIN public.profiles p ON p.id = s.profile_id
    WHERE s.id = v_fee.student_id;

    IF v_student_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
            v_student_user_id,
            CASE
                WHEN v_normalized_action = 'reject' THEN 'Payment Rejected'
                WHEN v_new_fee_status = 'paid' THEN 'Payment Verified'
                ELSE 'Partial Payment Recorded'
            END,
            CASE
                WHEN v_normalized_action = 'reject' THEN 'Your payment proof submission has been rejected by the owner.'
                WHEN v_new_fee_status = 'paid' THEN 'Your payment has been verified as PAID in full ✓.'
                ELSE 'Your partial payment of ₹' || v_approved_amount || ' has been verified. Remaining balance is still due.'
            END,
            'payment'
        );
    END IF;

    RETURN json_build_object(
        'status', 'success',
        'payment_id', p_payment_id::text,
        'fee_id', v_fee.id::text,
        'payment_status', v_new_payment_status,
        'fee_status', v_new_fee_status,
        'verified_amount', v_approved_amount
    );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_student_payment(uuid, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_student_payment(uuid, text, numeric, text) TO authenticated, service_role;


-- ============================================================================
-- 4. SECURE mark_deposit_paid (JOIN-REQUEST DEPOSIT WORKFLOW)
-- ============================================================================

-- Safely revoke and drop legacy overloads only if they exist, eliminating signature ambiguity and security bypass
-- Checks to_regprocedure without CASCADE
DO $$
BEGIN
    IF to_regprocedure('public.mark_deposit_paid(uuid, numeric, date, uuid)') IS NOT NULL THEN
        EXECUTE 'REVOKE ALL ON FUNCTION public.mark_deposit_paid(uuid, numeric, date, uuid) FROM PUBLIC, anon, authenticated';
        EXECUTE 'DROP FUNCTION public.mark_deposit_paid(uuid, numeric, date, uuid)';
    END IF;

    IF to_regprocedure('public.mark_deposit_paid(uuid, numeric, date, text, text)') IS NOT NULL THEN
        EXECUTE 'REVOKE ALL ON FUNCTION public.mark_deposit_paid(uuid, numeric, date, text, text) FROM PUBLIC, anon, authenticated';
        EXECUTE 'DROP FUNCTION public.mark_deposit_paid(uuid, numeric, date, text, text)';
    END IF;

    IF to_regprocedure('public.mark_deposit_paid(uuid, numeric, date)') IS NOT NULL THEN
        EXECUTE 'REVOKE ALL ON FUNCTION public.mark_deposit_paid(uuid, numeric, date) FROM PUBLIC, anon, authenticated';
        EXECUTE 'DROP FUNCTION public.mark_deposit_paid(uuid, numeric, date)';
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.mark_deposit_paid(
    p_allocation_id uuid,
    p_amount numeric DEFAULT NULL,
    p_date date DEFAULT CURRENT_DATE,
    p_payment_method text DEFAULT 'manual',
    p_notes text DEFAULT 'Security Deposit Paid',
    p_reference_number text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_auth_id uuid := auth.uid();
    v_is_service_role boolean := (COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role');
    v_student_id uuid;
    v_hostel_id uuid;
    v_room_id uuid;
    v_hostel_owner_id uuid;
    v_verifier_profile_id uuid;
    v_fee_id uuid := NULL;
    v_room_security_deposit numeric;
    v_room_rent numeric;
    v_deposit_obligation numeric;
    v_deposit_amount numeric;
    v_remaining_deposit numeric;
    v_exact_retry_payment_id uuid := NULL;
    v_prior_deposit_paid numeric := 0;
    v_total_deposit_paid numeric := 0;
    v_normalized_method text;
    v_effective_notes text;
BEGIN
    IF v_caller_auth_id IS NULL AND NOT v_is_service_role THEN
        RAISE EXCEPTION 'Authentication required to mark security deposit as paid';
    END IF;

    IF p_allocation_id IS NULL THEN
        RAISE EXCEPTION 'Allocation ID is required';
    END IF;

    -- Validate payment method
    v_normalized_method := lower(trim(COALESCE(p_payment_method, 'manual')));
    IF v_normalized_method NOT IN ('manual', 'cash', 'upi', 'bank', 'card') THEN
        RAISE EXCEPTION 'Invalid payment method for deposit: must be manual, cash, upi, bank, or card';
    END IF;

    -- Ensure reliable deposit evidence in notes to preserve application deposit semantics
    IF p_notes IS NULL OR trim(p_notes) = '' THEN
        v_effective_notes := 'Security Deposit Paid';
    ELSIF trim(p_notes) ILIKE '%deposit%' OR trim(p_notes) ILIKE '%security%' THEN
        v_effective_notes := trim(p_notes);
    ELSE
        v_effective_notes := trim(p_notes) || ' (Security Deposit)';
    END IF;

    -- Strict Hierarchical Lock Ordering:
    -- Lock 1: student_fees (deterministic selection of deposit fee if exists)
    -- Live student_fees.month_year contains only YYYY-MM values for rent.
    -- If a specific deposit fee row exists, lock it; otherwise v_fee_id remains NULL.
    SELECT id INTO v_fee_id
    FROM public.student_fees
    WHERE allocation_id = p_allocation_id
      AND (
          month_year = 'deposit'
          OR month_year ILIKE '%deposit%'
      )
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    IF v_fee_id IS NOT NULL THEN
        PERFORM 1 FROM public.student_fees WHERE id = v_fee_id FOR UPDATE;
    END IF;

    -- Lock 2: room_allocations
    SELECT ra.student_id, ra.hostel_id, ra.room_id, h.owner_id
    INTO v_student_id, v_hostel_id, v_room_id, v_hostel_owner_id
    FROM public.room_allocations ra
    JOIN public.hostels h ON h.id = ra.hostel_id
    WHERE ra.id = p_allocation_id
    FOR UPDATE OF ra;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Allocation not found';
    END IF;

    -- NULL-safe ownership verification (IS DISTINCT FROM check + super_admin convention)
    IF NOT v_is_service_role 
       AND NOT public.has_role(v_caller_auth_id, 'super_admin'::public.app_role) 
       AND (v_hostel_owner_id IS NULL OR v_hostel_owner_id IS DISTINCT FROM v_caller_auth_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller does not own this hostel';
    END IF;

    -- Resolve deposit obligation from rooms table
    SELECT r.security_deposit, r.rent
    INTO v_room_security_deposit, v_room_rent
    FROM public.rooms r
    WHERE r.id = v_room_id;

    v_deposit_obligation := COALESCE(NULLIF(v_room_security_deposit, 0), NULLIF(v_room_rent * 2, 0), 5000);

    -- Resolve verifier profile ID
    SELECT id INTO v_verifier_profile_id
    FROM public.profiles
    WHERE user_id = v_caller_auth_id;

    IF v_verifier_profile_id IS NULL THEN
        SELECT id INTO v_verifier_profile_id
        FROM public.profiles
        WHERE id = v_caller_auth_id;
    END IF;

    -- Calculate total deposit already paid towards this allocation using reliable evidence
    SELECT COALESCE(SUM(COALESCE(NULLIF(amount_paid, 0), NULLIF(amount, 0), 0)), 0)
    INTO v_prior_deposit_paid
    FROM public.payments
    WHERE allocation_id = p_allocation_id
      AND (
          (v_fee_id IS NOT NULL AND (student_fees_id = v_fee_id OR fee_id = v_fee_id))
          OR
          (
              student_fees_id IS NULL 
              AND fee_id IS NULL 
              AND (notes ILIKE '%deposit%' OR notes ILIKE '%security%')
          )
      )
      AND status IN ('completed', 'verified')
      AND (payment_status IS NULL OR payment_status NOT IN ('pending', 'pending_verification', 'manual_pending', 'failed', 'rejected', 'superseded'))
      AND (payment_status IS NULL OR payment_status IN ('completed', 'verified', 'partial', 'overpaid'));

    v_remaining_deposit := v_deposit_obligation - v_prior_deposit_paid;

    -- Lock 3: Check for exact duplicate retry using stable transaction reference if provided.
    -- Strict Idempotency Scoping (ALL 5 dimensions must match):
    --   1. Same room allocation (allocation_id = p_allocation_id) -> references for other allocations cannot suppress this payment
    --   2. Same deposit classification (matching deposit fee_id, or allocation deposit with reliable evidence where fee IDs are null)
    --   3. Same normalized payment method (payment_method = v_normalized_method)
    --   4. Same amount or NULL amount retry (p_amount IS NULL OR COALESCE(NULLIF(amount_paid, 0), NULLIF(amount, 0), 0) = p_amount)
    --   5. Same reference number (reference_number = trim(p_reference_number))
    --
    -- KNOWN LIMITATION & INSTALLMENT PRESERVATION:
    -- Automatic retry protection is available ONLY when a stable transaction reference number is supplied.
    -- If p_reference_number IS NULL or empty, deduplication is intentionally bypassed to ensure legitimate
    -- installments with identical amounts and methods (e.g. ₹4,000 cash + ₹4,000 cash) are preserved in the ledger
    -- and never incorrectly suppressed or dropped.
    IF p_reference_number IS NOT NULL AND trim(p_reference_number) <> '' THEN
        SELECT id INTO v_exact_retry_payment_id
        FROM public.payments
        WHERE allocation_id = p_allocation_id
          AND reference_number = trim(p_reference_number)
          AND payment_method = v_normalized_method
          AND (
              p_amount IS NULL
              OR COALESCE(NULLIF(amount_paid, 0), NULLIF(amount, 0), 0) = p_amount
          )
          AND (
              (v_fee_id IS NOT NULL AND (student_fees_id = v_fee_id OR fee_id = v_fee_id))
              OR
              (
                  student_fees_id IS NULL 
                  AND fee_id IS NULL 
                  AND (notes ILIKE '%deposit%' OR notes ILIKE '%security%')
              )
          )
          AND status IN ('completed', 'verified')
          AND (payment_status IS NULL OR payment_status NOT IN ('pending', 'pending_verification', 'manual_pending', 'failed', 'rejected', 'superseded'))
          AND (payment_status IS NULL OR payment_status IN ('completed', 'verified', 'partial', 'overpaid'))
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        FOR UPDATE;
    END IF;

    -- Handle Exact Retry vs New Installment:
    IF v_exact_retry_payment_id IS NOT NULL THEN
        -- Exact duplicate retry: do not insert duplicate row.
        -- Reconcile cumulative deposit and ensure state consistency
        IF v_prior_deposit_paid >= v_deposit_obligation THEN
            IF v_fee_id IS NOT NULL THEN
                UPDATE public.student_fees
                SET status = 'paid',
                    paid_date = COALESCE(paid_date, p_date, CURRENT_DATE)
                WHERE id = v_fee_id;
            END IF;
        ELSE
            IF v_fee_id IS NOT NULL THEN
                UPDATE public.student_fees
                SET status = 'partially_paid'
                WHERE id = v_fee_id;
            END IF;
        END IF;

        -- Idempotent return without duplicate insertion
        RETURN;
    END IF;

    -- Validate that deposit obligation is not already fully settled
    IF v_remaining_deposit <= 0 THEN
        RAISE EXCEPTION 'Security deposit is already fully paid (obligation: %, collected: %)', v_deposit_obligation, v_prior_deposit_paid;
    END IF;

    v_deposit_amount := COALESCE(p_amount, v_remaining_deposit);

    IF v_deposit_amount <= 0 THEN
        RAISE EXCEPTION 'Deposit amount must be greater than zero';
    END IF;

    -- Validate that deposit installments cannot exceed the remaining deposit obligation
    IF v_deposit_amount > v_remaining_deposit THEN
        RAISE EXCEPTION 'Deposit installment (%) exceeds remaining deposit obligation (%)', v_deposit_amount, v_remaining_deposit;
    END IF;

    -- Fresh deposit payment or legitimate installment:
    -- Insert payment record with manual owner verification
    -- Uses paid_date (timestamptz/date) matching the live payments schema
    INSERT INTO public.payments (
        allocation_id,
        student_fees_id,
        fee_id,
        student_id,
        hostel_id,
        amount_paid,
        amount,
        payment_method,
        reference_number,
        status,
        payment_status,
        verified_at,
        verified_by,
        notes,
        paid_date,
        created_at
    )
    VALUES (
        p_allocation_id,
        v_fee_id,
        v_fee_id,
        v_student_id,
        v_hostel_id,
        v_deposit_amount,
        v_deposit_amount,
        v_normalized_method,
        NULLIF(trim(p_reference_number), ''),
        'completed',
        'completed',
        now(),
        v_verifier_profile_id,
        v_effective_notes,
        COALESCE(p_date, CURRENT_DATE),
        now()
    );

    -- Calculate total deposit collected so far for this allocation using unified authoritative predicate
    SELECT COALESCE(SUM(COALESCE(NULLIF(amount_paid, 0), NULLIF(amount, 0), 0)), 0)
    INTO v_total_deposit_paid
    FROM public.payments
    WHERE allocation_id = p_allocation_id
      AND (
          (v_fee_id IS NOT NULL AND (student_fees_id = v_fee_id OR fee_id = v_fee_id))
          OR
          (
              student_fees_id IS NULL 
              AND fee_id IS NULL 
              AND (notes ILIKE '%deposit%' OR notes ILIKE '%security%')
          )
      )
      AND status IN ('completed', 'verified')
      AND (payment_status IS NULL OR payment_status NOT IN ('pending', 'pending_verification', 'manual_pending', 'failed', 'rejected', 'superseded'))
      AND (payment_status IS NULL OR payment_status IN ('completed', 'verified', 'partial', 'overpaid'));

    -- If an associated deposit fee invoice exists, update its status accordingly
    -- Note: room_allocations has no deposit_status column; deposit status is derived from payments in application code
    IF v_fee_id IS NOT NULL THEN
        IF v_total_deposit_paid >= v_deposit_obligation THEN
            UPDATE public.student_fees
            SET status = 'paid',
                paid_date = COALESCE(p_date, CURRENT_DATE)
            WHERE id = v_fee_id;
        ELSE
            UPDATE public.student_fees
            SET status = 'partially_paid'
            WHERE id = v_fee_id;
        END IF;
    END IF;

    -- Notify student
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT p.user_id, 'Security Deposit Paid', 'Your security deposit payment has been recorded ✓', 'payment'
    FROM public.students s
    JOIN public.profiles p ON p.id = s.profile_id
    WHERE s.id = v_student_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_deposit_paid(uuid, numeric, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_deposit_paid(uuid, numeric, date, text, text, text) TO authenticated, service_role;


-- ============================================================================
-- 5. HARDEN PAYMENTS ROW LEVEL SECURITY (RLS) & TABLE PRIVILEGES
-- ============================================================================

-- Ensure Row Level Security is enabled
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Dynamically drop EVERY existing policy on public.payments (known, legacy, or unexpected)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'payments'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.payments', r.policyname);
    END LOOP;
END $$;

-- Revoke all direct write table privileges from public, anon, and authenticated
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.payments TO authenticated;

-- Revoke any existing column-level write privileges across all columns from PUBLIC, anon, and authenticated
DO $$
DECLARE
    col RECORD;
BEGIN
    FOR col IN (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'payments'
    ) LOOP
        EXECUTE format('REVOKE INSERT (%I), UPDATE (%I) ON public.payments FROM PUBLIC, anon, authenticated', col.column_name, col.column_name);
    END LOOP;
END $$;

-- 1. Student Read-Only Policy: Students can SELECT only their own payment records
CREATE POLICY "Students can read own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
    student_id IN (
        SELECT s.id FROM public.students s
        WHERE s.profile_id = auth.uid()
           OR s.profile_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
    )
);

-- 2. Owner Read-Only Policy: Owners can SELECT only payments belonging to hostels they own
-- Direct payments.hostel_id lookup avoids RLS recursion
CREATE POLICY "Owners can read payments for their hostels"
ON public.payments
FOR SELECT
TO authenticated
USING (
    payments.hostel_id IN (
        SELECT id FROM public.hostels WHERE owner_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.student_fees sf
        JOIN public.hostels h ON h.id = sf.hostel_id
        WHERE (sf.id = payments.student_fees_id OR sf.id = payments.fee_id)
          AND h.owner_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.room_allocations ra
        JOIN public.hostels h ON h.id = ra.hostel_id
        WHERE ra.id = payments.allocation_id
          AND h.owner_id = auth.uid()
    )
    OR
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- Result: Zero INSERT, UPDATE, or DELETE policies for authenticated or anon.
-- Direct table mutations from browser clients via PostgREST are blocked by both RLS and table privileges.
-- Ledger updates must go through authorized SECURITY DEFINER RPCs.
