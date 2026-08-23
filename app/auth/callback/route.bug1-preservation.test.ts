import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import fc from 'fast-check';

/**
 * Bug 1 preservation property tests — Property 2 (Preservation): Login
 * Intent Still Resumes at Setup Password.
 *
 * **Validates: Requirements 2.2, 3.1**
 *
 * Methodology: observation-first. These tests run against the CURRENT,
 * UNFIXED `app/auth/callback/route.ts` and are written BEFORE the Bug 1
 * migration is deployed and BEFORE any callback code is touched. They
 * establish the baseline behavior that Bug 1's fix (an operational
 * deployment action only, per design.md) must not disturb:
 *
 *   - `intent === 'login'` on an incomplete-but-role-selected account
 *     (`missing_step` of 'password' or 'student_onboarding') must NEVER
 *     invoke `reset_incomplete_google_signup` and must resume directly at
 *     `/auth/setup-password`.
 *   - A completed account (`is_complete === true`) attempting SIGNUP intent
 *     must continue to be rejected with `reason=signin`, independent of the
 *     `tab=` param (which Bug 2's fix changes later; this test only pins the
 *     rejection + reason behavior, not the tab param).
 *
 * The property below generalizes this to: for every `(intent, accountState)`
 * combination that does NOT satisfy the Bug 1 condition
 * (`intent==='signup' && !is_complete && missing_step IN ('password','student_onboarding')`),
 * the reset RPC is never invoked and the redirect matches the route's
 * current, documented branching exactly.
 *
 * EXPECTED OUTCOME: all tests PASS on current/unfixed code.
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

const TEST_USER_ID = '22222222-2222-2222-2222-222222222222';
const TEST_EMAIL = 'preservation-test@example.com';

type Intent = 'login' | 'signup';
type MissingStep = 'profile' | 'role' | 'password' | 'student_onboarding';
type Role = 'owner' | 'hostel_owner' | 'student' | 'parent' | 'super_admin' | 'unrecognized_role' | null;

interface GeneratedAccountState {
  is_complete: boolean;
  missing_step: MissingStep;
  role: Role;
}

/** Mirrors `dashboardPathForRole` in `lib/auth/dashboard.ts` (imported, not duplicated logic-wise). */
import { dashboardPathForRole } from '@/lib/auth/dashboard';

const onboardingDestinationForStep: Record<MissingStep, string> = {
  profile: '/auth/select-role',
  role: '/auth/select-role',
  password: '/auth/setup-password',
  student_onboarding: '/auth/setup-password',
};

/**
 * The Bug 1 bug condition, exactly as defined in design.md's
 * `isBugCondition_Bug1` (with `rpcDeployed` fixed at `false`, since these
 * tests run pre-deployment): the ONLY case the reset RPC is invoked for.
 */
function isBug1Condition(intent: Intent, accountState: GeneratedAccountState): boolean {
  return intent === 'signup'
    && accountState.is_complete === false
    && (accountState.missing_step === 'password' || accountState.missing_step === 'student_onboarding');
}

/**
 * A reference model of the CURRENT callback's redirect decision, replicating
 * every branch in `app/auth/callback/route.ts` in the same order, EXCLUDING
 * the Bug 1 reset-RPC branch (which is out of scope for this file — inputs
 * satisfying `isBug1Condition` are filtered out of the generated domain
 * below, since that branch is covered by the Bug 1 exploration test).
 */
function expectedRedirectForNonBugCondition(intent: Intent, accountState: GeneratedAccountState): string {
  if (intent === 'signup' && accountState.is_complete) {
    return '/auth/login?tab=login&reason=signin';
  }

  if (intent === 'login' && accountState.missing_step === 'profile') {
    return '/auth/login?tab=signup&reason=no-account';
  }

  // isBug1Condition branch intentionally omitted (filtered out of the domain).

  if (accountState.is_complete) {
    const destination = accountState.role ? dashboardPathForRole(accountState.role) : undefined;
    return destination ?? '/auth/login?error=oauth';
  }

  return onboardingDestinationForStep[accountState.missing_step] ?? '/auth/login?error=oauth';
}

function buildCallbackRequest(): NextRequest {
  const url = 'http://localhost/auth/callback?transaction=signed-transaction&code=auth-code';
  return new NextRequest(url, {
    headers: {
      cookie: 'oauth_callback_transaction=signed-transaction',
    },
  });
}

async function runCallback(intent: Intent, accountState: GeneratedAccountState) {
  vi.clearAllMocks();
  vi.resetModules();

  verifyOAuthIntentTransactionMock.mockReturnValue(intent);
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
      return Promise.resolve({
        data: {
          user_id: TEST_USER_ID,
          role: accountState.role,
          missing_step: accountState.missing_step,
          is_complete: accountState.is_complete,
        },
        error: null,
      });
    }

    if (fn === 'reset_incomplete_google_signup') {
      // Should never be reached for the non-bug-condition domain this file
      // covers, but return a well-formed response defensively so an
      // unexpected call fails on the assertion, not on an unhandled
      // rejection.
      return Promise.resolve({ data: { success: true }, error: null });
    }

    throw new Error(`Unexpected RPC call in test: ${fn}`);
  });

  const { GET } = await import('./route');
  const response = await GET(buildCallbackRequest());
  const url = new URL(response.headers.get('location') ?? '', 'http://localhost');
  return `${url.pathname}${url.search}`;
}

const missingStepArb = fc.constantFrom<MissingStep>('profile', 'role', 'password', 'student_onboarding');
const roleArb = fc.constantFrom<Role>('owner', 'hostel_owner', 'student', 'parent', 'super_admin', 'unrecognized_role', null);

const accountStateArb: fc.Arbitrary<GeneratedAccountState> = fc.record({
  is_complete: fc.boolean(),
  missing_step: missingStepArb,
  role: roleArb,
});

const intentArb: fc.Arbitrary<Intent> = fc.constantFrom<Intent>('login', 'signup');

describe('Bug 1 preservation: login intent still resumes at setup-password (observed on unfixed code)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('OBSERVED on current code: intent=login, missing_step=password does NOT call reset_incomplete_google_signup and redirects to /auth/setup-password', async () => {
    const redirect = await runCallback('login', { is_complete: false, missing_step: 'password', role: 'student' });

    expect(redirect).toBe('/auth/setup-password');
    expect(rpcMock).not.toHaveBeenCalledWith('reset_incomplete_google_signup', expect.anything());
  });

  it('OBSERVED on current code: intent=login, missing_step=student_onboarding does NOT call reset_incomplete_google_signup and redirects to /auth/setup-password', async () => {
    const redirect = await runCallback('login', { is_complete: false, missing_step: 'student_onboarding', role: 'student' });

    expect(redirect).toBe('/auth/setup-password');
    expect(rpcMock).not.toHaveBeenCalledWith('reset_incomplete_google_signup', expect.anything());
  });

  it('OBSERVED on current code: intent=signup, is_complete=true redirects with reason=signin and does NOT call reset_incomplete_google_signup', async () => {
    const redirect = await runCallback('signup', { is_complete: true, missing_step: 'password', role: 'student' });

    expect(redirect).toBe('/auth/login?tab=login&reason=signin');
    expect(rpcMock).not.toHaveBeenCalledWith('reset_incomplete_google_signup', expect.anything());
  });

  it(
    'PROPERTY: for all (intent, accountState) NOT satisfying the Bug 1 condition, reset_incomplete_google_signup is never invoked and the redirect matches the current implemented branching',
    async () => {
      await fc.assert(
        fc.asyncProperty(intentArb, accountStateArb, async (intent, accountState) => {
          fc.pre(!isBug1Condition(intent, accountState));

          const redirect = await runCallback(intent, accountState);
          const expected = expectedRedirectForNonBugCondition(intent, accountState);

          expect(redirect).toBe(expected);
          expect(rpcMock).not.toHaveBeenCalledWith('reset_incomplete_google_signup', expect.anything());
        }),
        { numRuns: 200 },
      );
    },
  );
});
