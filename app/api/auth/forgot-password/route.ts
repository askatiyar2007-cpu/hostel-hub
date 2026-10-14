import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { sendPasswordResetOtpEmail } from '@/lib/email/brevo';

const GENERIC_SUCCESS_RESPONSE = {
  success: true,
  message: 'If an account is associated with this email, we have sent a verification code.'
};

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Pre-flight Account-Eligibility Gate:
    // Determine whether the submitted email belongs to an account eligible for password-based recovery.
    // Query public.get_account_state(p_email) via service-role client.
    const { data: accountStateData, error: stateError } = await supabaseServer.rpc('get_account_state', {
      p_email: normalizedEmail
    });

    if (stateError) {
      console.error('[forgot-password] Account state lookup failed for email:', stateError);
      // Fail closed: Do NOT generate or send OTP on lookup error; return generic success to prevent enumeration
      return NextResponse.json(GENERIC_SUCCESS_RESPONSE);
    }

    const state = Array.isArray(accountStateData) ? accountStateData[0] : accountStateData;

    // Validate account eligibility:
    // 1. Must have a valid user identity (user_id is UUID string)
    // 2. Must have an associated profile (profile_id is UUID string and missing_step != 'profile')
    // 3. Must have a confirmed, supported application role ('hostel_owner' or 'student')
    // 4. Must not have missing or conflicting role state (missing_step != 'role')
    // 5. Must not be stuck at missing_step = 'identity'
    //
    // CRITICAL PRESERVATION RULE:
    // Legitimate accounts with stale password_set = false (missing_step = 'password')
    // or pending student onboarding (missing_step = 'student_onboarding')
    // MUST remain eligible for password recovery!
    const isIdentityValid = typeof state?.user_id === 'string' && state.user_id.length > 0;
    const isProfileValid = typeof state?.profile_id === 'string' && state.profile_id.length > 0 && state?.missing_step !== 'profile';
    const isRoleConfirmed = (state?.role === 'hostel_owner' || state?.role === 'student') && state?.missing_step !== 'role';
    const isNotMissingIdentity = state?.missing_step !== 'identity';

    const isEligible = isIdentityValid && isProfileValid && isRoleConfirmed && isNotMissingIdentity;

    if (!isEligible) {
      // Ineligible account (e.g. non-existent identity, missing profile, missing/conflicting role).
      // Return generic success to prevent email enumeration, but do NOT call request_otp or send email.
      return NextResponse.json(GENERIC_SUCCESS_RESPONSE);
    }

    // Call RPC to request OTP for eligible account using service role
    const { data, error } = await supabaseServer.rpc('request_otp', {
      p_email: normalizedEmail,
      p_purpose: 'password_reset',
      p_user_id: state.user_id
    });

    if (error) {
      console.error('OTP request error:', error);
      // Return generic success anyway to prevent enumeration
      return NextResponse.json(GENERIC_SUCCESS_RESPONSE);
    }

    // If OTP was generated (not rate limited or blocked), dispatch email
    if (data?.otp) {
      const emailResult = await sendPasswordResetOtpEmail({
        email: normalizedEmail,
        otp: data.otp
      });

      if (!emailResult.success) {
        console.error('Failed to send password reset email:', emailResult.error);
        // Still return generic success to prevent enumeration
      }
    }

    // Always return generic response (prevents email enumeration)
    return NextResponse.json(GENERIC_SUCCESS_RESPONSE);

  } catch (error: any) {
    console.error('Forgot password error:', error);
    // Return generic success even on error to prevent enumeration
    return NextResponse.json(GENERIC_SUCCESS_RESPONSE);
  }
}
