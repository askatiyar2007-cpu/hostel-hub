import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = /^\d{6}$/;
const COMPLETION_SECRET_PATTERN = /^[a-f\d]{64}$/i;
const FAILURE_RESPONSE = {
  error: 'The code is invalid, expired, or cannot be used.'
};

type SignupOtpVerification = {
  success?: unknown;
  completion_secret?: unknown;
  completion_expires_at?: unknown;
};

type VerifiedSignupOtp = {
  success: true;
  completion_secret: string;
  completion_expires_at: string;
};

function isVerifiedSignupOtp(value: unknown): value is VerifiedSignupOtp {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const verification = value as SignupOtpVerification;
  return verification.success === true
    && typeof verification.completion_secret === 'string'
    && COMPLETION_SECRET_PATTERN.test(verification.completion_secret)
    && typeof verification.completion_expires_at === 'string';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(FAILURE_RESPONSE, { status: 400 });
  }

  const email = typeof body === 'object' && body !== null && 'email' in body
    ? body.email
    : undefined;
  const otp = typeof body === 'object' && body !== null && 'otp' in body
    ? body.otp
    : undefined;

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!EMAIL_PATTERN.test(normalizedEmail) || typeof otp !== 'string' || !OTP_PATTERN.test(otp)) {
    return NextResponse.json(FAILURE_RESPONSE, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Signup OTP verification rejected because the service role key is unavailable');
    return NextResponse.json(FAILURE_RESPONSE, { status: 400 });
  }

  try {
    const { data, error } = await supabaseServer.rpc('verify_signup_otp', {
      p_email: normalizedEmail,
      p_otp: otp
    });

    if (error || !isVerifiedSignupOtp(data)) {
      if (error) {
        console.error('Signup OTP verification failed', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
      }
      return NextResponse.json(FAILURE_RESPONSE, { status: 400 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: 'signup_completion',
      value: data.completion_secret,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/auth/signup/complete',
      maxAge: 10 * 60
    });

    return response;
  } catch (error) {
    console.error('Unexpected signup OTP verification failure', error instanceof Error ? { message: error.message } : {});
    return NextResponse.json(FAILURE_RESPONSE, { status: 400 });
  }
}
