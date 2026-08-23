import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COMPLETION_COOKIE = 'signup_completion';
const COMPLETION_COOKIE_PATH = '/api/auth/signup/complete';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_256_PATTERN = /^[a-f\d]{64}$/i;
const RETRY_RESPONSE = { error: 'Signup could not be completed. Please try again or sign in.' };
const INVALID_DETAILS_RESPONSE = { error: 'Please provide valid signup details.' };

type SignupRole = 'student' | 'hostel_owner';
type SignupDetails = {
  fullName: string;
  phone: string;
  password: string;
  role: SignupRole;
};

type CompletionClaim = {
  success?: unknown;
  grant_id?: unknown;
  grant_nonce?: unknown;
  email?: unknown;
};

type ClaimedCompletion = {
  grantId: string;
  grantNonce: string;
  email: string;
};

type AccountState = {
  user_id?: unknown;
  missing_step?: unknown;
  is_complete?: unknown;
};

type ExistingCompletion = {
  success?: unknown;
  next?: unknown;
};

type CompletionNext = 'profile' | 'role' | 'password' | 'student_onboarding' | 'complete';

function parseSignupDetails(body: unknown): SignupDetails | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const value = body as Record<string, unknown>;
  const fullName = typeof value.fullName === 'string' ? value.fullName.trim() : '';
  const phone = typeof value.phone === 'string' ? value.phone.trim() : '';
  const password = typeof value.password === 'string' ? value.password : '';
  const submittedRole = value.role;
  const role = submittedRole === 'student'
    ? 'student'
    : submittedRole === 'owner' || submittedRole === 'hostel_owner'
      ? 'hostel_owner'
      : null;

  if (!fullName || fullName.length > 200 || phone.length > 50 || password.length < 6 || !role) {
    return null;
  }

  return { fullName, phone, password, role };
}

function parseClaim(value: unknown): ClaimedCompletion | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const claim = value as CompletionClaim;
  if (claim.success !== true
    || typeof claim.grant_id !== 'string'
    || !UUID_PATTERN.test(claim.grant_id)
    || typeof claim.grant_nonce !== 'string'
    || !HEX_256_PATTERN.test(claim.grant_nonce)
    || typeof claim.email !== 'string'
    || claim.email !== claim.email.trim().toLowerCase()
    || !EMAIL_PATTERN.test(claim.email)) {
    return null;
  }

  return {
    grantId: claim.grant_id,
    grantNonce: claim.grant_nonce,
    email: claim.email
  };
}

function isRejectedClaim(value: unknown): boolean {
  return typeof value === 'object'
    && value !== null
    && (value as CompletionClaim).success === false;
}

function getAccountState(value: unknown): AccountState | null {
  const state = Array.isArray(value) ? value[0] : value;
  if (typeof state !== 'object' || state === null) {
    return null;
  }

  const accountState = state as AccountState;
  const validSteps: readonly string[] = [
    'identity',
    'profile',
    'role',
    'password',
    'student_onboarding',
    'complete'
  ];

  if (typeof accountState.missing_step !== 'string'
    || !validSteps.includes(accountState.missing_step)
    || typeof accountState.is_complete !== 'boolean'
    || (accountState.user_id !== null
      && (typeof accountState.user_id !== 'string' || !UUID_PATTERN.test(accountState.user_id)))) {
    return null;
  }

  return accountState;
}

function getNext(value: unknown): CompletionNext | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const result = value as ExistingCompletion;
  const validSteps: readonly CompletionNext[] = [
    'profile',
    'role',
    'password',
    'student_onboarding',
    'complete'
  ];

  return result.success === true
    && typeof result.next === 'string'
    && validSteps.includes(result.next as CompletionNext)
    ? result.next as CompletionNext
    : null;
}

function clearCompletionCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: COMPLETION_COOKIE,
    value: '',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: COMPLETION_COOKIE_PATH,
    maxAge: 0
  });
  return response;
}

function terminalRejection(): NextResponse {
  return clearCompletionCookie(NextResponse.json(RETRY_RESPONSE, { status: 400 }));
}

function retryFailure(): NextResponse {
  return NextResponse.json(RETRY_RESPONSE, { status: 503 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(INVALID_DETAILS_RESPONSE, { status: 400 });
  }

  const details = parseSignupDetails(body);
  if (!details) {
    return NextResponse.json(INVALID_DETAILS_RESPONSE, { status: 400 });
  }

  const completionSecret = request.cookies.get(COMPLETION_COOKIE)?.value;
  if (!completionSecret || !HEX_256_PATTERN.test(completionSecret)) {
    return terminalRejection();
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Signup completion rejected because the service role key is unavailable');
    return retryFailure();
  }

  try {
    const { data: claimData, error: claimError } = await supabaseServer.rpc('claim_signup_completion', {
      p_completion_secret: completionSecret
    });

    if (claimError) {
      console.error('Signup completion claim failed', {
        code: claimError.code,
        message: claimError.message,
        details: claimError.details,
        hint: claimError.hint,
      });
      return retryFailure();
    }

    const claim = parseClaim(claimData);
    if (!claim) {
      return isRejectedClaim(claimData) ? terminalRejection() : retryFailure();
    }

    const { data: accountStateData, error: accountStateError } = await supabaseServer.rpc(
      'get_account_state',
      { p_email: claim.email }
    );

    const accountState = getAccountState(accountStateData);
    if (accountStateError || !accountState) {
      console.error('Signup completion account-state lookup failed');
      return retryFailure();
    }

    if (accountState.is_complete || accountState.missing_step === 'complete') {
      return terminalRejection();
    }

    if (accountState.missing_step === 'identity') {
      const { data: createdUser, error: createUserError } = await supabaseServer.auth.admin.createUser({
        email: claim.email,
        password: details.password,
        email_confirm: true,
        user_metadata: {
          full_name: details.fullName,
          phone: details.phone,
          role: details.role,
          signup_grant_id: claim.grantId,
          signup_grant_nonce: claim.grantNonce
        }
      });

      if (createUserError || !createdUser.user) {
        console.error('Signup completion identity creation failed', {
          message: createUserError?.message,
          status: createUserError?.status,
          code: createUserError?.code,
        });
        return retryFailure();
      }

      return clearCompletionCookie(NextResponse.json({ success: true, next: 'complete' }));
    }

    if (typeof accountState.user_id !== 'string') {
      return retryFailure();
    }

    // Password credentials are changed only after a verified challenge has
    // been consumed into this server-only grant. The RPC then fills the
    // canonical earliest missing public-account step without duplicating rows.
    const { error: passwordError } = await supabaseServer.auth.admin.updateUserById(
      accountState.user_id,
      { password: details.password }
    );

    if (passwordError) {
      console.error('Signup completion password update failed', {
        message: passwordError.message,
        status: passwordError.status,
        code: passwordError.code,
      });
      return retryFailure();
    }

    const { data: existingCompletionData, error: existingCompletionError } = await supabaseServer.rpc(
      'complete_existing_signup',
      {
        p_grant_id: claim.grantId,
        p_grant_nonce: claim.grantNonce,
        p_full_name: details.fullName,
        p_phone_number: details.phone || null,
        p_role: details.role
      }
    );

    if (existingCompletionError) {
      console.error('Signup completion resume failed');
      return retryFailure();
    }

    const next = getNext(existingCompletionData);
    if (!next) {
      return terminalRejection();
    }

    return clearCompletionCookie(NextResponse.json({ success: true, next }));
  } catch {
    console.error('Unexpected signup completion failure');
    return retryFailure();
  }
}
