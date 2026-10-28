import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { sendPasswordResetOtpEmail } from '@/lib/email/brevo';

const NON_EXISTENT_ACCOUNT_MESSAGE = 'No StayKosh account exists with this email address. Please check the email or create an account.';

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
    // Query public.get_account_state(p_email) via service-role client.
    const { data: accountStateData, error: stateError } = await supabaseServer.rpc('get_account_state', {
      p_email: normalizedEmail
    });

    if (stateError) {
      console.error('[forgot-password] Account state lookup failed for email:', stateError);
      return NextResponse.json(
        { error: 'Failed to verify account state. Please try again.' },
        { status: 500 }
      );
    }

    const state = Array.isArray(accountStateData) ? accountStateData[0] : accountStateData;

    // 1. Check if identity exists in auth.users
    const hasAuthIdentity = typeof state?.user_id === 'string' && state.user_id.length > 0 && state?.missing_step !== 'identity';
    if (!hasAuthIdentity) {
      return NextResponse.json(
        { error: NON_EXISTENT_ACCOUNT_MESSAGE },
        { status: 404 }
      );
    }

    // 2. Validate profile and confirmed role eligibility:
    // Must have an associated profile and a confirmed application role ('hostel_owner' or 'student')
    // CRITICAL: Accounts with stale password_set = false (missing_step = 'password') or student_onboarding
    // MUST remain eligible for password recovery!
    const isProfileValid = typeof state?.profile_id === 'string' && state.profile_id.length > 0 && state?.missing_step !== 'profile';
    const isRoleConfirmed = (state?.role === 'hostel_owner' || state?.role === 'student') && state?.missing_step !== 'role';

    if (!isProfileValid || !isRoleConfirmed) {
      return NextResponse.json(
        { error: 'This account cannot use password recovery at this time. Please contact support for assistance.' },
        { status: 400 }
      );
    }

    // Incomplete Google signup protection:
    // Accounts that have not completed required registration steps (e.g. incomplete Google signups)
    // must not be treated as eligible completed accounts.
    if (!state.is_complete && state.password_set === false) {
      try {
        const { data: authUser } = await supabaseServer.auth.admin.getUserById(state.user_id);
        const appMeta = authUser?.user?.app_metadata;
        const isGoogle = appMeta?.provider === 'google' || (Array.isArray(appMeta?.providers) && appMeta.providers.includes('google'));
        if (isGoogle) {
          return NextResponse.json(
            { error: 'This account registration is incomplete. Please sign in with Google to complete your account setup.' },
            { status: 400 }
          );
        }
      } catch (authErr) {
        console.warn('[forgot-password] Warning checking auth user provider:', authErr);
      }
    }

    // 3. Call RPC to request OTP for eligible account using service role
    const { data, error } = await supabaseServer.rpc('request_otp', {
      p_email: normalizedEmail,
      p_purpose: 'password_reset',
      p_user_id: state.user_id
    });

    if (error) {
      console.error('OTP request error:', error);
      return NextResponse.json(
        { error: 'Failed to request verification code. Please try again.' },
        { status: 500 }
      );
    }

    if (data?.rate_limited) {
      return NextResponse.json(
        { error: 'Too many reset requests. Please wait a few minutes before trying again.' },
        { status: 429 }
      );
    }

    // If OTP was generated, dispatch email via Brevo
    if (data?.otp) {
      const emailResult = await sendPasswordResetOtpEmail({
        email: normalizedEmail,
        otp: data.otp
      });

      if (!emailResult.success) {
        console.error('Failed to send password reset email:', emailResult.error);
        return NextResponse.json(
          { error: 'Failed to deliver verification email. Please try again later.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email.'
    });

  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
