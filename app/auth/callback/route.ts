import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  OAUTH_CALLBACK_TRANSACTION_COOKIE,
  verifyOAuthIntentTransaction,
} from '@/lib/auth/oauth-intent';
import { dashboardPathForRole } from '@/lib/auth/dashboard';
import { createClient, supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type AccountState = {
  user_id: string | null;
  role: string | null;
  missing_step: string;
  is_complete: boolean;
  password_set: boolean;
};

const onboardingDestinationForStep: Record<string, string> = {
  profile: '/auth/select-role',
  role: '/auth/select-role',
  password: '/auth/setup-password',
  student_onboarding: '/auth/setup-password',
};

function readAccountState(value: unknown): AccountState | null {
  const state = Array.isArray(value) ? value[0] : value;
  if (!state || typeof state !== 'object') return null;

  const record = state as Record<string, unknown>;
  if ((typeof record.user_id !== 'string' && record.user_id !== null)
    || (typeof record.role !== 'string' && record.role !== null)
    || typeof record.missing_step !== 'string'
    || typeof record.is_complete !== 'boolean'
    || typeof record.password_set !== 'boolean') {
    return null;
  }

  return {
    user_id: record.user_id,
    role: record.role,
    missing_step: record.missing_step,
    is_complete: record.is_complete,
    password_set: record.password_set,
  };
}

function clearCallbackTransaction(response: NextResponse): NextResponse {
  response.cookies.set({
    name: OAUTH_CALLBACK_TRANSACTION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/auth/callback',
    maxAge: 0,
  });
  return response;
}

function redirect(request: NextRequest, path: string): NextResponse {
  return clearCallbackTransaction(NextResponse.redirect(new URL(path, request.url)));
}

function genericLoginError(request: NextRequest): NextResponse {
  return redirect(request, '/auth/login?error=oauth');
}

/**
 * The sole authoritative Google completion handler. It consumes a server-issued
 * transaction, exchanges the authorization code, obtains the canonical account
 * state, and redirects only from that server-derived state.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const transaction = requestUrl.searchParams.get('transaction');
  const transactionCookie = request.cookies.get(OAUTH_CALLBACK_TRANSACTION_COOKIE)?.value;
  const intent = verifyOAuthIntentTransaction(transaction);

  // The signed URL alone is insufficient: the HttpOnly cookie binds this
  // callback to the browser that initiated it and is cleared on every exit.
  if (!intent || !transactionCookie || transactionCookie !== transaction) {
    return genericLoginError(request);
  }

  const code = requestUrl.searchParams.get('code');
  if (!code || requestUrl.searchParams.has('error')) {
    return genericLoginError(request);
  }

  try {
    const sessionClient = createClient();
    const { data: exchangeData, error: exchangeError } = await sessionClient.auth.exchangeCodeForSession(code);
    if (exchangeError || !exchangeData.user?.email) {
      console.error('OAuth callback code exchange failed.', exchangeError);
      return genericLoginError(request);
    }

    const { data: userData, error: userError } = await sessionClient.auth.getUser();
    const user = userData.user ?? exchangeData.user;
    if (userError || !user?.email) {
      console.error('OAuth callback could not load the authenticated user.', userError);
      return genericLoginError(request);
    }

    const { data, error: stateError } = await supabaseServer
      .rpc('get_account_state', { p_email: user.email });
    const accountState = readAccountState(data);

    // The state must belong to the exchanged identity. A mismatched or malformed
    // result is handled as a generic callback failure and is never routed by UI data.
    if (stateError || !accountState || accountState.user_id !== user.id) {
      console.error('OAuth callback account-state lookup failed.', stateError);
      return genericLoginError(request);
    }

    if (intent === 'signup' && accountState.is_complete) {
      const { error: signOutError } = await sessionClient.auth.signOut();
      if (signOutError) {
        console.error('OAuth callback could not clear rejected signup session.', signOutError);
      }

      return redirect(request, '/auth/login?reason=signin');
    }

    if (intent === 'login' && accountState.missing_step === 'profile') {
      const { error: signOutError } = await sessionClient.auth.signOut();
      if (signOutError) {
        console.error('OAuth callback could not clear session for missing account.', signOutError);
      }

      return redirect(request, '/auth/login?reason=no-account');
    }

    // CRITICAL BUSINESS RULE: An abandoned Google signup (password_set=false)
    // that is retried via "Create Account" must NOT show "Account already exists"
    // or silently resume at the password page. Instead, the stale onboarding
    // progress must be cleared and the user must start fresh at role selection.
    //
    // This ensures that:
    // 1. Role data from a previous abandoned signup doesn't lock the user into that role
    // 2. The user can select a different role on retry
    // 3. password_set=false accounts are never treated as "existing users"
    //
    // The reset_incomplete_google_signup() SQL function clears user_roles and
    // students table rows for Google accounts with password_set=false, while
    // preserving the profile and auth identity. This is safe because:
    // - Only incomplete signups (password_set=false) are reset
    // - Completed accounts (password_set=true) are protected by the function
    // - The profile remains intact so email/name don't need to be re-entered
    if (
      intent === 'signup'
      && !accountState.is_complete
      && accountState.password_set === false
      && (accountState.missing_step === 'password' || accountState.missing_step === 'student_onboarding')
      && accountState.user_id
    ) {
      console.log('[OAuth Callback] Detected incomplete signup retry (password_set=false), resetting role data for user:', accountState.user_id);
      
      const { data: resetData, error: resetError } = await supabaseServer
        .rpc('reset_incomplete_google_signup', { p_user_id: accountState.user_id });

      if (resetError || !resetData?.success) {
        console.error('[OAuth Callback] Could not reset abandoned Google signup:', resetError, resetData);
        return genericLoginError(request);
      }

      console.log('[OAuth Callback] Successfully reset incomplete signup, redirecting to role selection');
      return redirect(request, '/auth/select-role');
    }

    if (accountState.is_complete) {
      const destination = accountState.role ? dashboardPathForRole(accountState.role) : undefined;
      return destination ? redirect(request, destination) : genericLoginError(request);
    }

    const onboardingDestination = onboardingDestinationForStep[accountState.missing_step];
    return onboardingDestination ? redirect(request, onboardingDestination) : genericLoginError(request);
  } catch (error) {
    console.error('OAuth callback failed unexpectedly.', error);
    return genericLoginError(request);
  }
}