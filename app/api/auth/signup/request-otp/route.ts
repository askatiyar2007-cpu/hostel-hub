import { NextRequest, NextResponse } from 'next/server';
import { sendSignupOtpEmail } from '@/lib/email/brevo';
import { supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCEPTED_RESPONSE = {
  status: 'accepted',
  message: 'If signup can continue, a verification code will be sent.'
};

type SignupOtpIssue = {
  success?: unknown;
  challenge_id?: unknown;
  email?: unknown;
  otp?: unknown;
};

type IssuedSignupOtp = {
  success: true;
  challenge_id: string;
  email: string;
  otp: string;
};

function isIssuedSignupOtp(value: unknown): value is IssuedSignupOtp {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const issue = value as SignupOtpIssue;
  return issue.success === true
    && typeof issue.challenge_id === 'string'
    && typeof issue.email === 'string'
    && typeof issue.otp === 'string'
    && issue.email === issue.email.trim().toLowerCase()
    && EMAIL_PATTERN.test(issue.email)
    && /^\d{6}$/.test(issue.otp);
}

async function invalidateUndeliveredChallenge(challengeId: string): Promise<void> {
  const { error } = await supabaseServer.rpc('invalidate_signup_challenge', {
    p_challenge_id: challengeId
  });

  if (error) {
    console.error('Unable to invalidate undelivered signup OTP challenge:', {
      challengeId
    });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  const email = typeof body === 'object' && body !== null && 'email' in body
    ? body.email
    : undefined;

  if (typeof email !== 'string') {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Signup OTP request rejected because the service role key is unavailable');
    return NextResponse.json(ACCEPTED_RESPONSE, { status: 202 });
  }

  try {
    const { data, error } = await supabaseServer.rpc('request_signup_otp', {
      p_email: normalizedEmail
    });

    if (error || !isIssuedSignupOtp(data)) {
      if (error) {
        console.error('Signup OTP issuance failed');
      }
      return NextResponse.json(ACCEPTED_RESPONSE, { status: 202 });
    }

    try {
      const delivery = await sendSignupOtpEmail({
        email: data.email,
        otp: data.otp
      });

      if (!delivery.success) {
        await invalidateUndeliveredChallenge(data.challenge_id);
      }
    } catch {
      await invalidateUndeliveredChallenge(data.challenge_id);
    }
  } catch {
    console.error('Unexpected signup OTP request failure');
  }

  return NextResponse.json(ACCEPTED_RESPONSE, { status: 202 });
}
