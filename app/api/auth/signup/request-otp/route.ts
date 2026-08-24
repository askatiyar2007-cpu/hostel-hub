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

// Response when account already exists (completed user)
const ACCOUNT_EXISTS_RESPONSE = {
  status: 'account_exists',
  message: 'An account with this email already exists. Please sign in instead.'
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

  // CRITICAL BUSINESS RULE ENFORCEMENT:
  // Before sending OTP, check if email belongs to a COMPLETED HostelHub user.
  //
  // Account State Decision Table:
  // ┌──────────────────────┬──────────────┬────────────────────────────────┐
  // │ Email Status         │ password_set │ Action                         │
  // ├──────────────────────┼──────────────┼────────────────────────────────┤
  // │ New (no account)     │ N/A          │ Send OTP                       │
  // │ Incomplete signup    │ false        │ Send OTP (allow retry)         │
  // │ Completed user       │ true         │ DO NOT send OTP, return error  │
  // └──────────────────────┴──────────────┴────────────────────────────────┘
  //
  // This ensures:
  // 1. Completed users don't receive misleading "OTP sent" messages
  // 2. Incomplete signups can restart (same behavior as Google OAuth)
  // 3. New users can sign up normally
  //
  // The request_signup_otp() SQL function already rejects completed accounts
  // (lines 354-360 of migration), but returns generic 'rejected' status.
  // We need to distinguish "rejected because completed" from other rejections.
  try {
    const { data, error } = await supabaseServer.rpc('request_signup_otp', {
      p_email: normalizedEmail
    });

    // If the RPC returns success=false with status='rejected', it could be:
    // 1. Completed account (password_set=true)
    // 2. Rate limit exceeded
    // 3. Cooldown not met
    // 
    // To distinguish, we need to check account state explicitly.
    // Note: This adds an extra RPC call, but it's necessary for correct UX.
    if (error || !isIssuedSignupOtp(data)) {
      // Check if rejection was due to completed account
      const { data: accountState, error: stateError } = await supabaseServer.rpc('get_account_state', {
        p_email: normalizedEmail
      });

      if (!stateError && accountState) {
        const state = Array.isArray(accountState) ? accountState[0] : accountState;
        
        // If account is complete (password_set=true), return specific error
        // This matches the "Account already exists" behavior for Google OAuth
        if (state && state.is_complete === true && state.password_set === true) {
          console.log('[Request OTP] Rejected signup OTP for completed account:', normalizedEmail);
          return NextResponse.json(ACCOUNT_EXISTS_RESPONSE, { status: 409 });
        }
      }

      // For all other rejections (rate limit, incomplete accounts, etc.),
      // return the generic accepted response to avoid revealing account state
      if (error) {
        console.error('Signup OTP issuance failed:', error);
      }
      return NextResponse.json(ACCEPTED_RESPONSE, { status: 202 });
    }

    // OTP was successfully issued - send email
    try {
      const delivery = await sendSignupOtpEmail({
        email: data.email,
        otp: data.otp
      });

      if (delivery.success) {
        console.log('Signup OTP delivery accepted', {
          challengeId: data.challenge_id,
          messageId: delivery.messageId
        });
      } else {
        await invalidateUndeliveredChallenge(data.challenge_id);
      }
    } catch {
      await invalidateUndeliveredChallenge(data.challenge_id);
    }
  } catch (err) {
    console.error('Unexpected signup OTP request failure:', err);
  }

  return NextResponse.json(ACCEPTED_RESPONSE, { status: 202 });
}
