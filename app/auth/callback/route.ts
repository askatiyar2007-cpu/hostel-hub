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

    // COMPLETED ACCOUNT trying to signup → return to signup context with existing account indicator
    if (intent === 'signup' && accountState.is_complete) {
      const { error: signOutError } = await sessionClient.auth.signOut();
      if (signOutError) {
        console.error('OAuth callback could not clear rejected signup session.', signOutError);
      }

      return redirect(request, '/auth/login?tab=signup&existing_account=google');
    }

    // LOGIN intent but no profile exists → show "no account" message
    if (intent === 'login' && accountState.missing_step === 'profile') {
      const { error: signOutError } = await sessionClient.auth.signOut();
      if (signOutError) {
        console.error('OAuth callback could not clear session for missing account.', signOutError);
      }

      return redirect(request, '/auth/login?reason=no-account');
    }

    // CRITICAL BUSINESS RULE: password_set=false means INCOMPLETE SIGNUP.
    // An abandoned Google signup retried via "Create Account" must NOT:
    // - Show "Account already exists"
    // - Resume at the old missing_step (e.g., /auth/setup-password)
    // - Use the previously saved role
    // - Grant dashboard access
    //
    // Instead, the ENTIRE abandoned onboarding progress must be cleared and
    // the user must start fresh at role selection. This ensures:
    // 1. Role data from a previous abandoned signup doesn't lock the user
    // 2. The user can select a different role on retry
    // 3. password_set=false accounts are NEVER treated as "existing users"
    // 4. A saved user_roles row does NOT grant active role access
    //
    // The condition is: intent=signup + password_set=false (regardless of missing_step).
    // We check password_set BEFORE checking missing_step because password_set is
    // the authoritative boundary between incomplete and complete accounts.
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
      && accountState.user_id
    ) {
      console.log('[OAuth Callback] Detected incomplete signup retry (password_set=false), resetting role data for user:', accountState.user_id);
      console.log('[OAuth Callback] Account state before reset:', JSON.stringify(accountState));
      
      // DIAGNOSTIC LOGGING: Fetch complete auth.users record to diagnose reset rejection
      const { data: adminUserData, error: adminUserError } = await supabaseServer.auth.admin.getUserById(accountState.user_id);
      if (adminUserError) {
        console.error('[OAuth Callback] Could not fetch admin user data for diagnostics:', adminUserError);
      } else if (adminUserData?.user) {
        const rawMetadata = adminUserData.user.app_metadata;
        console.log('[OAuth Callback] Provider metadata diagnostics:');
        console.log('  - Full raw_app_meta_data:', JSON.stringify(rawMetadata, null, 2));
        console.log('  - provider field:', rawMetadata?.provider);
        console.log('  - providers array:', rawMetadata?.providers);
        console.log('  - user.app_metadata.provider type:', typeof rawMetadata?.provider);
        console.log('  - user.app_metadata.providers type:', typeof rawMetadata?.providers);
        console.log('  - Is providers an array?', Array.isArray(rawMetadata?.providers));
      }
      
      const { data: resetData, error: resetError } = await supabaseServer
        .rpc('reset_incomplete_google_signup', { p_user_id: accountState.user_id });

      if (resetError || !resetData?.success) {
        console.error('[OAuth Callback] Reset failed:', {
          error: resetError,
          result: resetData
        });
        
        // Log the specific rejection reason for diagnosis
        if (resetData?.reason) {
          console.error('[OAuth Callback] Reset rejection reason:', resetData.reason);
          
          // Provide context for each rejection type
          switch (resetData.reason) {
            case 'null_user_id':
              console.error('[OAuth Callback] User ID was null');
              break;
            case 'user_not_found':
              console.error('[OAuth Callback] User does not exist in auth.users');
              break;
            case 'not_google_provider':
              console.error('[OAuth Callback] Account is not authenticated via Google OAuth');
              break;
            case 'profile_not_found':
              console.error('[OAuth Callback] Profile does not exist in public.profiles');
              break;
            case 'password_already_set':
              console.error('[OAuth Callback] Account has password_set=true (safety protection - this is a completed account)');
              break;
            default:
              console.error('[OAuth Callback] Unknown rejection reason');
          }
        } else {
          console.error('[OAuth Callback] No diagnostic reason provided by reset function');
        }
        
        console.error('[OAuth Callback] Cannot proceed with incomplete signup retry - stale onboarding data still exists');
        
        // CRITICAL: Do NOT redirect to role selection with stale data.
        // Clear the session and send user back to login with error message.
        const { error: signOutError } = await sessionClient.auth.signOut();
        if (signOutError) {
          console.error('[OAuth Callback] Could not clear session after reset failure:', signOutError);
        }
        
        // Return to login with specific error indicating retry is needed
        return redirect(request, '/auth/login?error=signup-retry-failed');
      }

      console.log('[OAuth Callback] Successfully reset incomplete signup:', resetData);
      console.log('[OAuth Callback] Redirecting to role selection');
      // Always redirect to /auth/select-role after reset, regardless of previous missing_step
      return redirect(request, '/auth/select-role');
    }

    // COMPLETED ACCOUNT (password_set=true) → go to dashboard
    if (accountState.is_complete) {
      const destination = accountState.role ? dashboardPathForRole(accountState.role) : undefined;
      return destination ? redirect(request, destination) : genericLoginError(request);
    }

    // ACTIVE ONBOARDING (first-time signup or legitimate mid-onboarding state)
    // This handles:
    // - Brand new Google signup (missing_step='profile')
    // - User who just selected role, moving to password page (missing_step='password')
    // - User who set password, moving to student onboarding (missing_step='student_onboarding')
    //
    // NOTE: This fallback should NEVER be reached by an abandoned signup with
    // password_set=false + intent=signup because that should be caught by the
    // reset block above. If this fallback routes to /auth/setup-password for
    // an abandoned signup, the reset conditions are too narrow.
    const onboardingDestination = onboardingDestinationForStep[accountState.missing_step];
    return onboardingDestination ? redirect(request, onboardingDestination) : genericLoginError(request);
  } catch (error) {
    console.error('OAuth callback failed unexpectedly.', error);
    return genericLoginError(request);
  }
}
