-- Migration: P0 and P1 Security Hardening
-- Date: 2026-09-30
-- Description:
--   1. Secure mark_payment_paid RPC with strict caller authentication and hostel ownership authorization.
--   2. Restrict request_otp, verify_otp, and reset_password_with_token execution permissions to service_role only.
--   3. Replace permissive UPDATE policy on public.students with scoped tenant/self-ownership policies.
--   4. Drop permissive 'Allow all operations' policy on public.email_verifications.
--   5. Fix notices RLS identity mismatch by resolving student_id through students and profiles.

BEGIN;

-- ============================================================================
-- 1. SECURE mark_payment_paid (P0-3)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_payment_paid(p_fee_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_hostel_owner_id UUID;
    v_caller_id UUID;
    v_is_authorized BOOLEAN;
BEGIN
    v_caller_id := auth.uid();
    
    -- 1. Require authentication
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to mark payment as paid';
    END IF;

    -- 2. Verify that the caller is the owner of the hostel associated with this fee, or super_admin
    SELECT h.owner_id INTO v_hostel_owner_id
    FROM public.student_fees sf
    JOIN public.hostels h ON h.id = sf.hostel_id
    WHERE sf.id = p_fee_id;

    IF v_hostel_owner_id IS NULL THEN
        RAISE EXCEPTION 'Student fee record not found or has no associated hostel';
    END IF;

    v_is_authorized := (v_hostel_owner_id = v_caller_id) OR public.has_role(v_caller_id, 'super_admin'::public.app_role);

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Forbidden: You are not authorized to mark this fee as paid';
    END IF;

    -- 3. Atomically update the fee to paid
    UPDATE public.student_fees
    SET status = 'paid', paid_date = NOW(), updated_at = NOW()
    WHERE id = p_fee_id;

    RETURN json_build_object(
        'fee_id', p_fee_id::TEXT,
        'status', 'paid',
        'message', 'Payment marked as paid successfully',
        'paid_date', NOW()::TEXT
    );
END;
$$;

-- Revoke dangerous anon execution permissions
REVOKE ALL ON FUNCTION public.mark_payment_paid(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mark_payment_paid(UUID) TO authenticated, service_role;


-- ============================================================================
-- 2. SECURE request_otp, verify_otp, reset_password_with_token (P0-2)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.request_otp(
    p_email TEXT,
    p_purpose TEXT DEFAULT 'room_request_verification',
    p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_email TEXT;
    v_otp INTEGER;
    v_otp_hash TEXT;
    v_expires_at TIMESTAMPTZ;
    v_recent_requests INTEGER;
    v_user_exists BOOLEAN;
    v_student_name TEXT;
BEGIN
    -- Defense-in-depth: Reject direct invocation by anonymous client role
    IF auth.role() = 'anon' THEN
        RAISE EXCEPTION 'Forbidden: Direct anonymous OTP generation is not permitted';
    END IF;

    -- Normalize email
    v_email := LOWER(TRIM(p_email));
    
    -- Validate purpose
    IF p_purpose NOT IN ('password_reset', 'room_request_verification') THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid OTP purpose'
        );
    END IF;
    
    -- Rate limiting: Check for recent OTP requests (max 5 in 15 minutes)
    SELECT COUNT(*) INTO v_recent_requests
    FROM public.email_verifications
    WHERE email = v_email
    AND purpose = p_purpose
    AND created_at > NOW() - INTERVAL '15 minutes';
    
    IF v_recent_requests >= 5 THEN
        RETURN json_build_object(
            'success', true,
            'message', 'If an account is associated with this email, we have sent a verification code.',
            'rate_limited', true
        );
    END IF;
    
    -- Invalidate any existing unverified OTPs for this email and purpose
    UPDATE public.email_verifications
    SET used_at = NOW()
    WHERE email = v_email
    AND purpose = p_purpose
    AND verified_at IS NULL
    AND used_at IS NULL;
    
    -- For password reset, check if user exists
    IF p_purpose = 'password_reset' THEN
        SELECT EXISTS (
            SELECT 1 FROM auth.users 
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
    
    -- Get student name for room request emails
    IF p_purpose = 'room_request_verification' AND p_user_id IS NOT NULL THEN
        SELECT full_name INTO v_student_name
        FROM public.profiles
        WHERE user_id = p_user_id;
    END IF;
    
    -- Generate cryptographically secure 6-digit OTP
    v_otp := (abs(('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::int) % 900000) + 100000;
    v_otp_hash := encode(digest(v_otp::TEXT, 'sha256'), 'hex');
    v_expires_at := NOW() + INTERVAL '10 minutes';
    
    -- Insert new OTP record
    INSERT INTO public.email_verifications (
        email,
        otp_hash,
        expires_at,
        purpose,
        verified,
        created_at
    ) VALUES (
        v_email,
        v_otp_hash,
        v_expires_at,
        p_purpose,
        false,
        NOW()
    );
    
    -- Return OTP internally to authorized server-side caller only (never accessible by anon)
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

-- Ensure request_otp cannot be invoked directly by unauthenticated clients over PostgREST
REVOKE ALL ON FUNCTION public.request_otp(TEXT, TEXT, UUID) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.request_otp(TEXT, TEXT, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.verify_otp(TEXT, TEXT, TEXT) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.verify_otp(TEXT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.reset_password_with_token(TEXT) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.reset_password_with_token(TEXT) TO service_role;


-- ============================================================================
-- 3. RESTRICT students UPDATE RLS (P0-6)
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can update their student records" ON public.students;

CREATE POLICY "Authenticated users can update their student records" ON public.students
  FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.room_allocations ra
      JOIN public.hostels h ON h.id = ra.hostel_id
      WHERE ra.student_id = students.id
        AND h.owner_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.room_allocations ra
      JOIN public.hostels h ON h.id = ra.hostel_id
      WHERE ra.student_id = students.id
        AND h.owner_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );


-- ============================================================================
-- 4. HARDEN email_verifications RLS (P1)
-- ============================================================================

DROP POLICY IF EXISTS "Allow all operations on email_verifications" ON public.email_verifications;
DROP POLICY IF EXISTS "Allow public management of email verifications" ON public.email_verifications;
DROP POLICY IF EXISTS "No direct access to email_verifications" ON public.email_verifications;

CREATE POLICY "No direct access to email_verifications" ON public.email_verifications
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);


-- ============================================================================
-- 5. FIX NOTICES RLS IDENTITY MISMATCH (P1)
-- ============================================================================

DROP POLICY IF EXISTS "View notices" ON public.notices;

CREATE POLICY "View notices" ON public.notices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.room_allocations ra
      WHERE ra.hostel_id = notices.hostel_id
        AND ra.student_id IN (
          SELECT s.id FROM public.students s
          JOIN public.profiles p ON s.profile_id = p.id
          WHERE p.user_id = auth.uid()
        )
        AND ra.active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.hostels h
      WHERE h.id = notices.hostel_id
        AND h.owner_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

COMMIT;
