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
  profile_id?: string | null;
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
    profile_id: typeof record.profile_id === 'string' ? record.profile_id : null,
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

    // 1. COMPLETED ACCOUNT trying to signup → return to signup context with existing account indicator
    if (intent === 'signup' && accountState.is_complete && accountState.password_set) {
      const { error: signOutError } = await sessionClient.auth.signOut();
      if (signOutError) {
        console.error('OAuth callback could not clear rejected signup session.', signOutError);
      }

      return redirect(request, '/auth/login?tab=signup&existing_account=google');
    }

    // 2. COMPLETED ACCOUNT logging in → direct to role dashboard
    if (accountState.is_complete && accountState.password_set) {
      const destination = accountState.role ? dashboardPathForRole(accountState.role) : undefined;
      return destination ? redirect(request, destination) : genericLoginError(request);
    }

    // 3. LOGIN intent but no profile exists → show "no account" message
    if (intent === 'login' && accountState.missing_step === 'profile') {
      const { error: signOutError } = await sessionClient.auth.signOut();
      if (signOutError) {
        console.error('OAuth callback could not clear session for missing account.', signOutError);
      }

      return redirect(request, '/auth/login?reason=no-account');
    }

    // 4. INCOMPLETE GOOGLE SIGNUP (password_set=false OR !accountState.is_complete)
    // CRITICAL REQUIREMENT (Issue B):
    // When a user selects Continue with Google, chooses a role, and leaves before finishing password setup,
    // returning with the same Google identity (via login or signup) MUST restart the incomplete signup flow
    // correctly: Google identity -> Role selection -> Password setup -> Account completion -> Dashboard.
    // It must NOT skip role selection just because a role was selected in a previous incomplete attempt.
    // An incomplete account must never enter dashboards.
    if (!accountState.is_complete || accountState.password_set === false) {
      console.log('[OAuth Callback] Incomplete Google signup resuming. Resetting role data to restart at Role Selection for user:', user.id);

      // Attempt the SQL reset RPC
      try {
        const { data: resetResult, error: resetErr } = await supabaseServer
          .rpc('reset_incomplete_google_signup', { p_user_id: user.id });
        if (resetErr) {
          console.warn('[OAuth Callback] reset_incomplete_google_signup RPC warning:', resetErr.message);
        } else {
          console.log('[OAuth Callback] reset_incomplete_google_signup RPC result:', resetResult);
        }
      } catch (rpcErr) {
        console.warn('[OAuth Callback] reset_incomplete_google_signup RPC exception:', rpcErr);
      }

      // Defensive service-role fallback: clear incomplete user_roles and student assignments
      // so complete_onboarding_role and get_account_state cleanly return missing_step = 'role'
      try {
        if (accountState.profile_id) {
          await supabaseServer.from('students').delete().eq('profile_id', accountState.profile_id);
        }
        await supabaseServer.from('user_roles').delete().eq('user_id', user.id);
      } catch (cleanErr) {
        console.warn('[OAuth Callback] Defensive role cleanup warning:', cleanErr);
      }

      // Always restart at role selection
      return redirect(request, '/auth/select-role');
    }

    // Fallback active onboarding destination
    const onboardingDestination = onboardingDestinationForStep[accountState.missing_step] || '/auth/select-role';
    return redirect(request, onboardingDestination);
  } catch (error) {
    console.error('OAuth callback failed unexpectedly.', error);
    return genericLoginError(request);
  }
}
