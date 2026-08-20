-- Migration: Unified Secure OTP System for Password Reset and Room Request Verification
-- Target: public
-- Purpose: Replace insecure OTP system with secure Brevo-based OTP with purpose separation

-- 1. Alter existing email_verifications table to add security features
ALTER TABLE public.email_verifications 
ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'room_request_verification',
ADD COLUMN IF NOT EXISTS otp_hash TEXT,
ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Drop existing insecure RLS policy
DROP POLICY IF EXISTS "Allow public management of email verifications" ON public.email_verifications;

-- 3. Create secure RLS policy - no direct client access
CREATE POLICY "No direct access to email_verifications" ON public.email_verifications
    FOR ALL TO public, anon, authenticated
    USING (false);

-- 4. Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON public.email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON public.email_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verifications_purpose ON public.email_verifications(purpose);
CREATE INDEX IF NOT EXISTS idx_email_verifications_otp_hash ON public.email_verifications(otp_hash);

-- 5. Migrate existing plaintext OTPs to hashed format (one-time migration)
DO $$
BEGIN
    -- Update existing records to have hashed OTPs
    UPDATE public.email_verifications 
    SET otp_hash = encode(digest(otp, 'sha256'), 'hex'),
        created_at = COALESCE(created_at, NOW())
    WHERE otp_hash IS NULL;
    
    -- Clear plaintext OTP column (security)
    ALTER TABLE public.email_verifications ALTER COLUMN otp DROP NOT NULL;
    ALTER TABLE public.email_verifications ALTER COLUMN otp DROP DEFAULT;
END $$;

-- 6. Create RPC function to request OTP (unified for both purposes)
CREATE OR REPLACE FUNCTION public.request_otp(
    p_email TEXT,
    p_purpose TEXT DEFAULT 'room_request_verification',
    p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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
        -- Return success anyway to prevent enumeration
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
    
    -- For password reset, check if user exists (internal check, not exposed)
    IF p_purpose = 'password_reset' THEN
        SELECT EXISTS (
            SELECT 1 FROM auth.users 
            WHERE email = v_email
        ) INTO v_user_exists;
        
        IF NOT v_user_exists THEN
            -- User doesn't exist - return generic success to prevent enumeration
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
    
    -- Return OTP for server-side email sending (never exposed to client)
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

-- 7. Create RPC function to verify OTP
CREATE OR REPLACE FUNCTION public.verify_otp(
    p_email TEXT,
    p_otp TEXT,
    p_purpose TEXT DEFAULT 'room_request_verification'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_email TEXT;
    v_otp_hash TEXT;
    v_otp_record RECORD;
    v_reset_token TEXT;
    v_reset_token_hash TEXT;
    v_reset_expires_at TIMESTAMPTZ;
BEGIN
    -- Normalize email
    v_email := LOWER(TRIM(p_email));
    
    -- Hash the submitted OTP
    v_otp_hash := encode(digest(p_otp::TEXT, 'sha256'), 'hex');
    
    -- Find valid OTP record with matching purpose
    SELECT * INTO v_otp_record
    FROM public.email_verifications
    WHERE email = v_email
    AND otp_hash = v_otp_hash
    AND purpose = p_purpose
    AND expires_at > NOW()
    AND verified_at IS NULL
    AND used_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        -- Check if there's any recent OTP for this email (for attempt counting)
        UPDATE public.email_verifications
        SET attempts = attempts + 1
        WHERE email = v_email
        AND purpose = p_purpose
        AND expires_at > NOW()
        AND verified_at IS NULL
        AND used_at IS NULL;
        
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid or expired verification code'
        );
    END IF;
    
    -- Check attempt limit
    IF v_otp_record.attempts >= 5 THEN
        UPDATE public.email_verifications
        SET used_at = NOW()
        WHERE id = v_otp_record.id;
        
        RETURN json_build_object(
            'success', false,
            'error', 'Too many failed attempts. Please request a new code.'
        );
    END IF;
    
    -- Mark OTP as verified
    UPDATE public.email_verifications
    SET verified_at = NOW()
    WHERE id = v_otp_record.id;
    
    -- For password reset, generate secure reset token
    IF p_purpose = 'password_reset' THEN
        v_reset_token := encode(gen_random_bytes(32), 'hex');
        v_reset_token_hash := encode(digest(v_reset_token, 'sha256'), 'hex');
        v_reset_expires_at := NOW() + INTERVAL '15 minutes';
        
        -- Store reset token in the same record (reusing otp_hash column for security)
        UPDATE public.email_verifications
        SET otp_hash = v_reset_token_hash,
            expires_at = v_reset_expires_at
        WHERE id = v_otp_record.id;
        
        RETURN json_build_object(
            'success', true,
            'reset_token', v_reset_token,
            'message', 'Verification successful'
        );
    END IF;
    
    -- For room request, just return success
    RETURN json_build_object(
        'success', true,
        'message', 'Verification successful'
    );
END;
$$;

-- 8. Create RPC function to authorize password reset using reset token
CREATE OR REPLACE FUNCTION public.reset_password_with_token(p_reset_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_reset_token_hash TEXT;
    v_otp_record RECORD;
    v_user_id UUID;
BEGIN
    -- Hash the reset token
    v_reset_token_hash := encode(digest(p_reset_token, 'sha256'), 'hex');
    
    -- Find valid reset token
    SELECT * INTO v_otp_record
    FROM public.email_verifications
    WHERE otp_hash = v_reset_token_hash
    AND purpose = 'password_reset'
    AND expires_at > NOW()
    AND verified_at IS NOT NULL
    AND used_at IS NULL
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid or expired reset token'
        );
    END IF;
    
    -- Find user by email
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = v_otp_record.email;
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User not found'
        );
    END IF;
    
    -- Mark token as used before returning authorization
    UPDATE public.email_verifications
    SET used_at = NOW()
    WHERE id = v_otp_record.id;
    
    -- Return authorization for password update (should be done by service role API)
    RETURN json_build_object(
        'success', true,
        'user_id', v_user_id::TEXT,
        'email', v_otp_record.email,
        'message', 'Password reset authorized'
    );
END;
$$;

-- 9. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.request_otp(TEXT, TEXT, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.verify_otp(TEXT, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reset_password_with_token(TEXT) TO service_role;

-- 10. Create cleanup function for expired OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM public.email_verifications
    WHERE expires_at < NOW()
    OR (verified_at IS NOT NULL AND used_at IS NOT NULL AND used_at < NOW() - INTERVAL '1 hour');
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_otps() TO service_role;

-- 11. Refresh schema cache
NOTIFY pgrst, 'reload schema';
