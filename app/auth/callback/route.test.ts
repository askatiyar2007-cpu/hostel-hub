import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Bug 1 exploration test — Property 1 (Bug Condition): Abandoned Google
 * Signup Restarts at Role Selection.
 *
 * This suite has NO live database connection. It mocks the Supabase RPC
 * layer to simulate the exact undeployed-migration failure mode observed
 * in production: `reset_incomplete_google_signup` responds with a
 * PGRST202 "function not found in schema cache" error, exactly what
 * PostgREST returns when a migration defining the function has never
 * been applied.
 *
 * **Validates: Requirements 1.1**
 *
 * CRITICAL: The assertions below encode the DESIRED/fixed behavior
 * (redirect to `/auth/select-role`). On the current, unfixed code (RPC
 * unreachable), the callback falls through to the generic error redirect
 * instead, so this test is EXPECTED TO FAIL. The failure itself is the
 * counterexample that proves Bug 1 exists.
 */

const verifyOAuthIntentTransactionMock = vi.fn();
const rpcMock = vi.fn();
const exchangeCodeForSessionMock = vi.fn();
const getUserMock = vi.fn();
const signOutMock = vi.fn();

vi.mock('@/lib/auth/oauth-intent', () => ({
  OAUTH_CALLBACK_TRANSACTION_COOKIE: 'oauth_callback_transaction',
  verifyOAuthIntentTransaction: (...args: unknown[]) => verifyOAuthIntentTransactionMock(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
  createClient: () => ({
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => exchangeCodeForSessionMock(...args),
      getUser: (...args: unknown[]) => getUserMock(...args),
      signOut: (...args: unknown[]) => signOutMock(...args),
    },
  }),
}));

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_EMAIL = 'abandoned-signup@example.com';

/** Shape returned by PostgREST when a function is missing from the schema cache. */
const PGRST202_ERROR = {
  code: 'PGRST202',
  message:
    'Could not find the function public.reset_incomplete_google_signup(p_user_id) in the schema cache',
};

function buildCallbackRequest(): NextRequest {
  const url = 'http://localhost/auth/callback?transaction=signed-transaction&code=auth-code';
  return new NextRequest(url, {
    headers: {
      cookie: 'oauth_callback_transaction=signed-transaction',
    },
  });
}

describe('Bug 1 exploration: abandoned Google signup restart (undeployed RPC)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    verifyOAuthIntentTransactionMock.mockReturnValue('signup');
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { user: { id: TEST_USER_ID, email: TEST_EMAIL } },
      error: null,
    });
    getUserMock.mockResolvedValue({
      data: { user: { id: TEST_USER_ID, email: TEST_EMAIL } },
      error: null,
    });
    signOutMock.mockResolvedValue({ error: null });

    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'get_account_state') {
        // Role was selected previously (missing_step = 'password'); this is
        // the account-state shape that should trigger the reset RPC under
        // SIGNUP intent.
        return Promise.resolve({
          data: {
            user_id: TEST_USER_ID,
            role: 'student',
            missing_step: 'password',
            is_complete: false,
          },
          error: null,
        });
      }

      if (fn === 'reset_incomplete_google_signup') {
        // Simulates the migration never having been deployed: PostgREST has
        // no record of this function in its schema cache.
        return Promise.resolve({ data: null, error: PGRST202_ERROR });
      }

      throw new Error(`Unexpected RPC call in test: ${fn}`);
    });
  });

  it('reset_incomplete_google_signup call returns a PGRST202 "function not found" error against an undeployed-migration snapshot', async () => {
    const { error } = await rpcMock('reset_incomplete_google_signup', { p_user_id: TEST_USER_ID });

    expect(error).toEqual(PGRST202_ERROR);
    expect(error.code).toBe('PGRST202');
  });

  it('[EXPECTED TO FAIL on unfixed/undeployed state] abandoned SIGNUP-intent restart redirects to /auth/select-role, not the generic oauth error', async () => {
    const { GET } = await import('./route');

    const response = await GET(buildCallbackRequest());
    const redirectLocation = response.headers.get('location') ?? '';

    // Desired/fixed behavior per Property 1 in design.md: the callback
    // should clear the stale role assignment and send the user back to
    // role selection.
    //
    // Actual behavior observed on current code: the RPC call errors with
    // PGRST202 (function not deployed), `resetError` is truthy, and the
    // callback's `if (resetError || !resetData?.success)` branch falls
    // through to `genericLoginError`, redirecting to
    // `/auth/login?error=oauth` instead.
    expect(redirectLocation).toContain('/auth/select-role');
    expect(redirectLocation).not.toContain('/auth/login?error=oauth');
  });
});
