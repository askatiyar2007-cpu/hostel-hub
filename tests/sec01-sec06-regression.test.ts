import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Mocks for OAuth Callback
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
    from: vi.fn(),
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
const TEST_EMAIL = 'student@example.com';

describe('SEC-01: OAuth Transaction & Mobile Bridge Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Valid Web OAuth on desktop browser: exchanges code, validates transaction + cookie, routes to dashboard', async () => {
    const { GET } = await import('@/app/auth/callback/route');

    verifyOAuthIntentTransactionMock.mockReturnValue('login');
    exchangeCodeForSessionMock.mockResolvedValue({
      data: {
        session: { access_token: 'valid-web-access-token', refresh_token: 'valid-web-refresh-token' },
        user: { id: TEST_USER_ID, email: TEST_EMAIL },
      },
      error: null,
    });
    getUserMock.mockResolvedValue({
      data: { user: { id: TEST_USER_ID, email: TEST_EMAIL } },
      error: null,
    });
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'get_account_state') {
        return Promise.resolve({
          data: {
            user_id: TEST_USER_ID,
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

    const request = new NextRequest(
      'http://localhost/auth/callback?transaction=valid-tx&code=valid-code',
      {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
          cookie: 'oauth_callback_transaction=valid-tx',
        },
      }
    );

    const response = await GET(request);
    expect(response.status).toBe(307);
    const location = response.headers.get('location') || '';
    expect(location).toContain('/student/dashboard');
    expect(location).not.toContain('hostelhubmobile://');
  });

  it('Mobile browser with valid web transaction + cookie: executes web login, NEVER triggers hostelhubmobile://', async () => {
    const { GET } = await import('@/app/auth/callback/route');

    verifyOAuthIntentTransactionMock.mockReturnValue('login');
    exchangeCodeForSessionMock.mockResolvedValue({
      data: {
        session: { access_token: 'mobile-web-access-token', refresh_token: 'mobile-web-refresh-token' },
        user: { id: TEST_USER_ID, email: TEST_EMAIL },
      },
      error: null,
    });
    getUserMock.mockResolvedValue({
      data: { user: { id: TEST_USER_ID, email: TEST_EMAIL } },
      error: null,
    });
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'get_account_state') {
        return Promise.resolve({
          data: {
            user_id: TEST_USER_ID,
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

    // Mobile Safari User Agent
    const request = new NextRequest(
      'http://localhost/auth/callback?transaction=valid-tx&code=valid-code',
      {
        headers: {
          'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
          cookie: 'oauth_callback_transaction=valid-tx',
        },
      }
    );

    const response = await GET(request);
    expect(response.status).toBe(307);
    const location = response.headers.get('location') || '';
    expect(location).toContain('/student/dashboard');
    expect(location).not.toContain('hostelhubmobile://');
  });

  it('Mobile browser arriving without transaction/cookie: rejected by web flow, NEVER triggers hostelhubmobile://', async () => {
    const { GET } = await import('@/app/auth/callback/route');

    // Android Chrome User Agent without transaction
    const request = new NextRequest(
      'http://localhost/auth/callback?code=some-code',
      {
        headers: {
          'user-agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
        },
      }
    );

    const response = await GET(request);
    expect(response.status).toBe(307);
    const location = response.headers.get('location') || '';
    expect(location).toContain('/auth/login?error=oauth');
    expect(location).not.toContain('hostelhubmobile://');
  });

  it('Spoofed mobile User-Agent CSRF attack: rejected by web flow without calling mobile code exchange', async () => {
    const { GET } = await import('@/app/auth/callback/route');

    const request = new NextRequest(
      'http://localhost/auth/callback?code=attacker-code',
      {
        headers: {
          'user-agent': 'Mozilla/5.0 (Linux; Android 13; SM-S908B) Mobile Safari/537.36',
        },
      }
    );

    const response = await GET(request);
    expect(response.status).toBe(307);
    const location = response.headers.get('location') || '';
    expect(location).toContain('/auth/login?error=oauth');
    expect(location).not.toContain('hostelhubmobile://');
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
  });

  it('Explicit mobile callback (?source=mobile) with complete account: emits tokens to hostelhubmobile://', async () => {
    const { GET } = await import('@/app/auth/callback/route');

    exchangeCodeForSessionMock.mockResolvedValue({
      data: {
        session: { access_token: 'secret-mobile-access', refresh_token: 'secret-mobile-refresh' },
        user: { id: TEST_USER_ID, email: TEST_EMAIL },
      },
      error: null,
    });
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'get_account_state') {
        return Promise.resolve({
          data: {
            user_id: TEST_USER_ID,
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

    const request = new NextRequest(
      'http://localhost/auth/callback?source=mobile&code=valid-mobile-code'
    );

    const response = await GET(request);
    expect(response.status).toBe(307);
    const location = response.headers.get('location') || '';
    expect(location).toContain('hostelhubmobile://auth/callback#access_token=secret-mobile-access&refresh_token=secret-mobile-refresh');
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('Explicit mobile callback with incomplete account: signs out and redirects to mobile scheme with error=account_incomplete', async () => {
    const { GET } = await import('@/app/auth/callback/route');

    exchangeCodeForSessionMock.mockResolvedValue({
      data: {
        session: { access_token: 'incomplete-access', refresh_token: 'incomplete-refresh' },
        user: { id: TEST_USER_ID, email: TEST_EMAIL },
      },
      error: null,
    });
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'get_account_state') {
        return Promise.resolve({
          data: {
            user_id: TEST_USER_ID,
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
    signOutMock.mockResolvedValue({ error: null });

    const request = new NextRequest(
      'http://localhost/auth/callback?source=mobile&code=valid-code-incomplete-user'
    );

    const response = await GET(request);
    expect(response.status).toBe(307);
    const location = response.headers.get('location') || '';
    expect(location).toBe('hostelhubmobile://auth/callback?error=account_incomplete');
    expect(location).not.toContain('access_token=');
    expect(signOutMock).toHaveBeenCalled();
  });

  it('Explicit mobile callback with unassociated account: signs out and redirects to mobile scheme with error=account_invalid', async () => {
    const { GET } = await import('@/app/auth/callback/route');

    exchangeCodeForSessionMock.mockResolvedValue({
      data: {
        session: { access_token: 'unassociated-access', refresh_token: 'unassociated-refresh' },
        user: { id: TEST_USER_ID, email: TEST_EMAIL },
      },
      error: null,
    });
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'get_account_state') {
        // Mismatched user_id
        return Promise.resolve({
          data: {
            user_id: 'other-user-999',
            role: null,
            missing_step: 'profile',
            is_complete: false,
            password_set: false,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
    signOutMock.mockResolvedValue({ error: null });

    const request = new NextRequest(
      'http://localhost/auth/callback?mobile=true&code=valid-code-unassociated-user'
    );

    const response = await GET(request);
    expect(response.status).toBe(307);
    const location = response.headers.get('location') || '';
    expect(location).toBe('hostelhubmobile://auth/callback?error=account_invalid');
    expect(location).not.toContain('access_token=');
    expect(signOutMock).toHaveBeenCalled();
  });

  it('Explicit mobile callback with exchange error: redirects to mobile scheme with error=oauth_failed', async () => {
    const { GET } = await import('@/app/auth/callback/route');

    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid authorization code' },
    });

    const request = new NextRequest(
      'http://localhost/auth/callback?source=mobile&code=expired-code'
    );

    const response = await GET(request);
    expect(response.status).toBe(307);
    const location = response.headers.get('location') || '';
    expect(location).toBe('hostelhubmobile://auth/callback?error=oauth_failed');
  });
});

describe('SEC-06: Room-to-Hostel Relational Integrity in APIs & RPC Migration', () => {
  it('Additive migration file exists and enforces room-to-hostel validation', () => {
    const migrationPath = path.resolve(
      __dirname,
      '..',
      'supabase',
      'migrations',
      '20261028000000_sec06_approve_room_request_hostel_validation.sql'
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const content = fs.readFileSync(migrationPath, 'utf-8');

    // 1. Enforces room_id AND hostel_id lock
    expect(content).toMatch(/WHERE\s+id\s*=\s*request_record\.room_id\s+AND\s+hostel_id\s*=\s*request_record\.hostel_id\s+FOR\s+UPDATE;/);
    expect(content).toContain('Associated room does not belong to this hostel or does not exist');

    // 2. Preserves authorization check
    expect(content).toContain('owner_id = auth.uid()');
    expect(content).toContain('Access denied. You are not authorized to approve requests for this hostel.');

    // 3. Preserves pending status check
    expect(content).toContain("request_record.status != 'pending'");

    // 4. Preserves active allocation check
    expect(content).toContain('Student already has an active room allocation');

    // 5. Preserves capacity and occupancy logic
    expect(content).toContain('public.get_room_actual_occupancy');
    expect(content).toContain("'Room is full'");
    expect(content).toContain("'Entire room is not available (already occupied)'");

    // 6. Preserves JSON return structure
    expect(content).toContain("'success', true");
    expect(content).toContain("'allocation_id', v_allocation_id");
    expect(content).toContain("'room_id', request_record.room_id");
    expect(content).toContain("'student_id', request_record.student_id");
    expect(content).toContain("'booking_type', v_final_booking_type");
    expect(content).toContain("'fees_count', v_fees_count");

    // 7. Preserves EXCEPTION WHEN OTHERS THEN handler
    expect(content).toContain('EXCEPTION');
    expect(content).toContain('WHEN OTHERS THEN');
    expect(content).toContain('GET STACKED DIAGNOSTICS');
    expect(content).toContain("'success', false");

    // 8. Preserves permissions
    expect(content).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.approve_room_request\(UUID\)\s+FROM\s+anon;/);
    expect(content).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.approve_room_request\(UUID\)\s+FROM\s+public;/);
    expect(content).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.approve_room_request\(UUID\)\s+TO\s+authenticated;/);
    expect(content).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.approve_room_request\(UUID\)\s+TO\s+service_role;/);
  });

  it('request-otp route file verifies room belongs to hostel before sending OTP', () => {
    const routePath = path.resolve(
      __dirname,
      '..',
      'app',
      'api',
      'room-request',
      'request-otp',
      'route.ts'
    );
    const content = fs.readFileSync(routePath, 'utf-8');

    // Checks hostelId and roomId presence
    expect(content).toContain('if (!hostelId || !roomId)');
    expect(content).toContain('Hostel ID and Room ID are required');

    // Validates room.hostel_id == hostelId
    expect(content).toContain(".eq('id', roomId)");
    expect(content).toContain(".eq('hostel_id', hostelId)");
    expect(content).toContain('Selected room does not belong to the specified hostel');
  });

  it('verify-otp route file verifies room belongs to hostel before creating request', () => {
    const routePath = path.resolve(
      __dirname,
      '..',
      'app',
      'api',
      'room-request',
      'verify-otp',
      'route.ts'
    );
    const content = fs.readFileSync(routePath, 'utf-8');

    // Validates room.hostel_id == hostelId
    expect(content).toContain(".eq('id', roomId)");
    expect(content).toContain(".eq('hostel_id', hostelId)");
    expect(content).toContain('Selected room does not belong to the specified hostel');
  });
});
