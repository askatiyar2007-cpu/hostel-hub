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


function readAccountState(value: unknown): AccountState | null {
  const state = Array.isArray(value) ? value[0] : value;
  if (!state || typeof state !== 'object') return null;

  const record = state as Record<string, unknown>;
  if ((typeof record.user_id !== 'string' && record.user_id !== null)
    || (typeof record.role !== 'string' && record.role !== null)
    || typeof record.missing_step !== 'string'
    || typeof record.is_complete !== 'boolean'
    || (typeof record.password_set !== 'boolean' && record.password_set !== undefined)) {
    return null;
  }

  return {
    user_id: record.user_id,
    profile_id: typeof record.profile_id === 'string' ? record.profile_id : null,
    role: record.role,
    missing_step: record.missing_step,
    is_complete: record.is_complete,
    password_set: typeof record.password_set === 'boolean' ? record.password_set : false,
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

  // Mobile App OAuth Bridge: If request originated from mobile app, exchange code and deep-link back to app
  const userAgent = request.headers.get('user-agent') || '';
  const isMobileUserAgent = /Android|iPhone|iPad|iPod/i.test(userAgent);
  const isExplicitMobile = requestUrl.searchParams.get('source') === 'mobile' || requestUrl.searchParams.get('mobile') === 'true';
  const hasTransaction = Boolean(requestUrl.searchParams.get('transaction'));
  const isMobile = isExplicitMobile || (!hasTransaction && isMobileUserAgent);
  const mobileCode = requestUrl.searchParams.get('code');
  if (isMobile && mobileCode) {
    try {
      const sessionClient = createClient();
      const { data: exchangeData, error: exchangeError } = await sessionClient.auth.exchangeCodeForSession(mobileCode);
      if (!exchangeError && exchangeData?.session) {
        const returnUrl = `hostelhubmobile://auth/callback#access_token=${exchangeData.session.access_token}&refresh_token=${exchangeData.session.refresh_token}`;
        return NextResponse.redirect(new URL(returnUrl));
      }
    } catch (e) {
      console.error('Mobile OAuth bridge error:', e);
    }
    return NextResponse.redirect(new URL('hostelhubmobile://auth/callback?error=oauth_failed'));
  }

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
    if (intent === 'login' && accountState.is_complete && accountState.password_set) {
      const destination = accountState.role ? dashboardPathForRole(accountState.role) : undefined;
      return destination ? redirect(request, destination) : genericLoginError(request);
    }

    // 3. LOGIN intent but unassociated or incomplete account → reject with clear notice, do NOT start signup
    if (intent === 'login') {
      const { error: signOutError } = await sessionClient.auth.signOut();
      if (signOutError) {
        console.error('OAuth callback could not clear session for unassociated account.', signOutError);
      }

      return redirect(request, '/auth/login?reason=no-account');
    }

    // 4. SIGNUP intent with new or incomplete account → allow user to select role and onboard
    return redirect(request, '/auth/select-role');
  } catch (error) {
    console.error('OAuth callback failed unexpectedly.', error);
    return genericLoginError(request);
  }
}
