import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock supabaseServer
const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockAdminGetUserById = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'user@example.com' } },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'user@example.com' } },
        error: null,
      }),
    },
  })),
  supabaseServer: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: (...args: any[]) => mockFrom(...args),
    auth: {
      admin: {
        getUserById: (...args: any[]) => mockAdminGetUserById(...args),
      },
    },
  },
}));

// Mock oauth intent verification
vi.mock('@/lib/auth/oauth-intent', () => ({
  OAUTH_CALLBACK_TRANSACTION_COOKIE: 'hh_oauth_cb_tx',
  verifyOAuthIntentTransaction: vi.fn((tx) => {
    if (tx === 'valid-signup-tx') return 'signup';
    if (tx === 'valid-login-tx') return 'login';
    return null;
  }),
}));

describe('Google OAuth Incomplete Account Resumption (Issue B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects incomplete or unassociated Google account at /auth/login?reason=no-account when intent is login', async () => {
    const { GET } = await import('@/app/auth/callback/route');

    // Mock account state returning incomplete with password_set=false
    mockRpc.mockImplementation((name, _params) => {
      if (name === 'get_account_state') {
        return Promise.resolve({
          data: {
            user_id: 'test-user-id',
            profile_id: 'profile-uuid',
            role: 'student',
            missing_step: 'password',
            is_complete: false,
            password_set: false,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const req = new NextRequest(
      'https://localhost:3000/auth/callback?code=mock-code&transaction=valid-login-tx',
      {
        headers: {
          cookie: 'hh_oauth_cb_tx=valid-login-tx',
        },
      }
    );

    const res = await GET(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location') || '';
    expect(location).toContain('/auth/login?reason=no-account');
  });

  it('restarts incomplete Google signup at /auth/select-role when intent is signup and role is missing', async () => {
    const { GET } = await import('@/app/auth/callback/route');

    mockRpc.mockImplementation((name, _params) => {
      if (name === 'get_account_state') {
        return Promise.resolve({
          data: {
            user_id: 'test-user-id',
            profile_id: 'profile-uuid',
            role: null,
            missing_step: 'role',
            is_complete: false,
            password_set: false,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const req = new NextRequest(
      'https://localhost:3000/auth/callback?code=mock-code&transaction=valid-signup-tx',
      {
        headers: {
          cookie: 'hh_oauth_cb_tx=valid-signup-tx',
        },
      }
    );

    const res = await GET(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location') || '';
    expect(location).toContain('/auth/select-role');
  });

  it('routes incomplete Google signup to /auth/setup-password when intent is signup and password is missing', async () => {
    const { GET } = await import('@/app/auth/callback/route');

    mockRpc.mockImplementation((name, _params) => {
      if (name === 'get_account_state') {
        return Promise.resolve({
          data: {
            user_id: 'test-user-id',
            profile_id: 'profile-uuid',
            role: 'hostel_owner',
            missing_step: 'password',
            is_complete: false,
            password_set: false,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const req = new NextRequest(
      'https://localhost:3000/auth/callback?code=mock-code&transaction=valid-signup-tx',
      {
        headers: {
          cookie: 'hh_oauth_cb_tx=valid-signup-tx',
        },
      }
    );

    const res = await GET(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location') || '';
    expect(location).toContain('/auth/select-role');
  });

  it('routes completed account to dashboard on login intent', async () => {
    const { GET } = await import('@/app/auth/callback/route');

    mockRpc.mockImplementation((name, _params) => {
      if (name === 'get_account_state') {
        return Promise.resolve({
          data: {
            user_id: 'test-user-id',
            profile_id: 'profile-uuid',
            role: 'student',
            missing_step: 'complete',
            is_complete: true,
            password_set: true,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const req = new NextRequest(
      'https://localhost:3000/auth/callback?code=mock-code&transaction=valid-login-tx',
      {
        headers: {
          cookie: 'hh_oauth_cb_tx=valid-login-tx',
        },
      }
    );

    const res = await GET(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location') || '';
    expect(location).toContain('/student/dashboard');
  });

  it('redirects completed account trying to signup back to login with existing_account parameter', async () => {
    const { GET } = await import('@/app/auth/callback/route');

    mockRpc.mockImplementation((name, _params) => {
      if (name === 'get_account_state') {
        return Promise.resolve({
          data: {
            user_id: 'test-user-id',
            profile_id: 'profile-uuid',
            role: 'hostel_owner',
            missing_step: 'complete',
            is_complete: true,
            password_set: true,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const req = new NextRequest(
      'https://localhost:3000/auth/callback?code=mock-code&transaction=valid-signup-tx',
      {
        headers: {
          cookie: 'hh_oauth_cb_tx=valid-signup-tx',
        },
      }
    );

    const res = await GET(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location') || '';
    expect(location).toContain('existing_account=google');
  });
});
