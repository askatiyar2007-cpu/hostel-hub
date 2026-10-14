import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mocks for Next.js cookies and Supabase server
const mockCookieStore = {
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: () => mockCookieStore,
}));

const mockRpc = vi.fn();
const mockUpdateUserById = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: {
      admin: {
        updateUserById: (...args: unknown[]) => mockUpdateUserById(...args),
      },
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { POST } from '@/app/api/auth/reset-password/route';

const TEST_USER_ID = '12345678-1234-1234-1234-123456789abc';
const TEST_EMAIL = 'owner@example.com';
const VALID_RESET_TOKEN = 'valid-reset-token-hex-123456';

function buildRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieStore.get.mockReturnValue({ value: VALID_RESET_TOKEN });
  });

  it('rejects requests with missing or empty password', async () => {
    const res = await POST(buildRequest({ newPassword: '' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('New password is required');
  });

  it('rejects passwords shorter than 8 characters', async () => {
    const res = await POST(buildRequest({ newPassword: 'short' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Password must be at least 8 characters long');
  });

  it('rejects when reset_token cookie is missing', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await POST(buildRequest({ newPassword: 'StrongPassword123!' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Reset session expired or invalid');
  });

  it('rejects when reset token is invalid, expired, or already used', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: false, error: 'Invalid or expired reset token' },
      error: null,
    });

    const res = await POST(buildRequest({ newPassword: 'StrongPassword123!' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid or expired reset token');
  });

  it('successfully updates Auth password and synchronizes profiles.password_set when false', async () => {
    // 1. RPC authorizes reset
    mockRpc.mockResolvedValueOnce({
      data: { success: true, user_id: TEST_USER_ID, email: TEST_EMAIL },
      error: null,
    });

    // 2. Auth password updated
    mockUpdateUserById.mockResolvedValueOnce({ data: { user: { id: TEST_USER_ID } }, error: null });

    // 3. Profile query
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValueOnce({
          data: { id: 'prof-1', user_id: TEST_USER_ID, email: TEST_EMAIL, role: 'hostel_owner', password_set: false },
          error: null,
        }),
      }),
    });

    // 4. Profile update
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValueOnce({
          data: [{ id: 'prof-1', password_set: true }],
          error: null,
        }),
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: mockSelect,
          update: mockUpdate,
        };
      }
      return {};
    });

    const res = await POST(buildRequest({ newPassword: 'NewSecurePassword123!' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe('Password reset successfully');

    expect(mockUpdateUserById).toHaveBeenCalledWith(TEST_USER_ID, { password: 'NewSecurePassword123!' });
    expect(mockUpdate).toHaveBeenCalledWith({ password_set: true });
    expect(mockCookieStore.delete).toHaveBeenCalledWith('reset_token');
  });

  it('succeeds idempotently without re-updating when profiles.password_set is already true', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, user_id: TEST_USER_ID, email: TEST_EMAIL },
      error: null,
    });

    mockUpdateUserById.mockResolvedValueOnce({ data: { user: { id: TEST_USER_ID } }, error: null });

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValueOnce({
          data: { id: 'prof-1', user_id: TEST_USER_ID, email: TEST_EMAIL, role: 'hostel_owner', password_set: true },
          error: null,
        }),
      }),
    });

    const mockUpdate = vi.fn();

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: mockSelect,
          update: mockUpdate,
        };
      }
      return {};
    });

    const res = await POST(buildRequest({ newPassword: 'NewSecurePassword123!' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    // Profile was already true, so no redundant update call
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCookieStore.delete).toHaveBeenCalledWith('reset_token');
  });

  it('handles partial failure: reports error if profile synchronization fails after Auth password update', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, user_id: TEST_USER_ID, email: TEST_EMAIL },
      error: null,
    });

    mockUpdateUserById.mockResolvedValueOnce({ data: { user: { id: TEST_USER_ID } }, error: null });

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValueOnce({
          data: { id: 'prof-1', user_id: TEST_USER_ID, email: TEST_EMAIL, role: 'hostel_owner', password_set: false },
          error: null,
        }),
      }),
    });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Database connection error' },
        }),
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: mockSelect,
          update: mockUpdate,
        };
      }
      return {};
    });

    const res = await POST(buildRequest({ newPassword: 'NewSecurePassword123!' }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('profile state synchronization failed');
    // Cookie is cleaned up because Auth password was changed and the token was consumed in DB
    expect(mockCookieStore.delete).toHaveBeenCalledWith('reset_token');
  });

  it('rejects and reports error if profile record does not exist for verified user ID', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, user_id: TEST_USER_ID, email: TEST_EMAIL },
      error: null,
    });

    mockUpdateUserById.mockResolvedValueOnce({ data: { user: { id: TEST_USER_ID } }, error: null });

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValueOnce({
          data: null,
          error: null,
        }),
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: mockSelect,
        };
      }
      return {};
    });

    const res = await POST(buildRequest({ newPassword: 'NewSecurePassword123!' }));
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error).toBe('Account profile not found. Please contact support.');
  });
});
