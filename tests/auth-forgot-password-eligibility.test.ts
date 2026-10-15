import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockRpc = vi.fn();
const mockSendPasswordResetOtpEmail = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('@/lib/email/brevo', () => ({
  sendPasswordResetOtpEmail: (...args: unknown[]) => mockSendPasswordResetOtpEmail(...args),
}));

import { POST } from '@/app/api/auth/forgot-password/route';

const TEST_OWNER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TEST_STUDENT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const TEST_PROFILE_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const OWNER_EMAIL = 'owner@example.com';
const STUDENT_EMAIL = 'student@example.com';

const NON_EXISTENT_MESSAGE = 'No HostelHub account exists with this email address. Please check the email or create an account.';
const INELIGIBLE_ACCOUNT_MESSAGE = 'This account cannot use password recovery at this time. Please contact support for assistance.';
const EXPECTED_SUCCESS_RESPONSE = {
  success: true,
  message: 'Verification code sent to your email.',
};

function buildRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/forgot-password — Account-Eligibility Gate & Nonexistent UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendPasswordResetOtpEmail.mockResolvedValue({ success: true });
  });

  it('1. Completed hostel owner: OTP RPC and email dispatch occur', async () => {
    mockRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'get_account_state') {
        return Promise.resolve({
          data: {
            user_id: TEST_OWNER_ID,
            profile_id: TEST_PROFILE_ID,
            role: 'hostel_owner',
            password_set: true,
            missing_step: 'complete',
            is_complete: true,
          },
          error: null,
        });
      }
      if (rpcName === 'request_otp') {
        return Promise.resolve({
          data: { success: true, otp: '123456' },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const res = await POST(buildRequest({ email: OWNER_EMAIL }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(EXPECTED_SUCCESS_RESPONSE);

    expect(mockRpc).toHaveBeenCalledWith('get_account_state', { p_email: OWNER_EMAIL });
    expect(mockRpc).toHaveBeenCalledWith('request_otp', {
      p_email: OWNER_EMAIL,
      p_purpose: 'password_reset',
      p_user_id: TEST_OWNER_ID,
    });
    expect(mockSendPasswordResetOtpEmail).toHaveBeenCalledWith({
      email: OWNER_EMAIL,
      otp: '123456',
    });
  });

  it('2. Completed student: OTP RPC and email dispatch occur', async () => {
    mockRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'get_account_state') {
        return Promise.resolve({
          data: {
            user_id: TEST_STUDENT_ID,
            profile_id: TEST_PROFILE_ID,
            role: 'student',
            password_set: true,
            missing_step: 'complete',
            is_complete: true,
          },
          error: null,
        });
      }
      if (rpcName === 'request_otp') {
        return Promise.resolve({
          data: { success: true, otp: '654321' },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const res = await POST(buildRequest({ email: STUDENT_EMAIL }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(EXPECTED_SUCCESS_RESPONSE);

    expect(mockRpc).toHaveBeenCalledWith('request_otp', {
      p_email: STUDENT_EMAIL,
      p_purpose: 'password_reset',
      p_user_id: TEST_STUDENT_ID,
    });
    expect(mockSendPasswordResetOtpEmail).toHaveBeenCalledWith({
      email: STUDENT_EMAIL,
      otp: '654321',
    });
  });

  it('3. Valid account with stale password_set = false (missing_step = password): remains eligible', async () => {
    mockRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'get_account_state') {
        return Promise.resolve({
          data: {
            user_id: TEST_OWNER_ID,
            profile_id: TEST_PROFILE_ID,
            role: 'hostel_owner',
            password_set: false,
            missing_step: 'password',
            is_complete: false,
          },
          error: null,
        });
      }
      if (rpcName === 'request_otp') {
        return Promise.resolve({
          data: { success: true, otp: '789012' },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const res = await POST(buildRequest({ email: OWNER_EMAIL }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(EXPECTED_SUCCESS_RESPONSE);

    expect(mockRpc).toHaveBeenCalledWith('request_otp', {
      p_email: OWNER_EMAIL,
      p_purpose: 'password_reset',
      p_user_id: TEST_OWNER_ID,
    });
    expect(mockSendPasswordResetOtpEmail).toHaveBeenCalledWith({
      email: OWNER_EMAIL,
      otp: '789012',
    });
  });

  it('4. Auth identity without a profile (missing_step = profile): returns 400 support error, no OTP/email', async () => {
    mockRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'get_account_state') {
        return Promise.resolve({
          data: {
            user_id: TEST_OWNER_ID,
            profile_id: null,
            role: null,
            password_set: false,
            missing_step: 'profile',
            is_complete: false,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const res = await POST(buildRequest({ email: 'noprofile@example.com' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe(INELIGIBLE_ACCOUNT_MESSAGE);

    expect(mockRpc).toHaveBeenCalledWith('get_account_state', { p_email: 'noprofile@example.com' });
    expect(mockRpc).not.toHaveBeenCalledWith('request_otp', expect.anything());
    expect(mockSendPasswordResetOtpEmail).not.toHaveBeenCalled();
  });

  it('5. Profile without a valid confirmed role: returns 400 support error, no OTP/email', async () => {
    mockRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'get_account_state') {
        return Promise.resolve({
          data: {
            user_id: TEST_OWNER_ID,
            profile_id: TEST_PROFILE_ID,
            role: null,
            password_set: false,
            missing_step: 'role',
            is_complete: false,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const res = await POST(buildRequest({ email: 'norole@example.com' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe(INELIGIBLE_ACCOUNT_MESSAGE);

    expect(mockRpc).not.toHaveBeenCalledWith('request_otp', expect.anything());
    expect(mockSendPasswordResetOtpEmail).not.toHaveBeenCalled();
  });

  it('6. Missing or conflicting role state (missing_step = role): returns 400 support error', async () => {
    mockRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'get_account_state') {
        return Promise.resolve({
          data: {
            user_id: TEST_OWNER_ID,
            profile_id: TEST_PROFILE_ID,
            role: 'hostel_owner',
            password_set: false,
            missing_step: 'role',
            is_complete: false,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const res = await POST(buildRequest({ email: 'conflictingrole@example.com' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe(INELIGIBLE_ACCOUNT_MESSAGE);

    expect(mockRpc).not.toHaveBeenCalledWith('request_otp', expect.anything());
    expect(mockSendPasswordResetOtpEmail).not.toHaveBeenCalled();
  });

  it('7. Nonexistent email (missing_step = identity): returns explicit 404 nonexistent account error', async () => {
    mockRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'get_account_state') {
        return Promise.resolve({
          data: {
            user_id: null,
            profile_id: null,
            role: null,
            password_set: false,
            missing_step: 'identity',
            is_complete: false,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const res = await POST(buildRequest({ email: 'unregistered@example.com' }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe(NON_EXISTENT_MESSAGE);

    expect(mockRpc).toHaveBeenCalledWith('get_account_state', { p_email: 'unregistered@example.com' });
    expect(mockRpc).not.toHaveBeenCalledWith('request_otp', expect.anything());
    expect(mockSendPasswordResetOtpEmail).not.toHaveBeenCalled();
  });

  it('8. Account-state RPC error: returns 500 server error; no OTP or email dispatch', async () => {
    mockRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'get_account_state') {
        return Promise.resolve({
          data: null,
          error: { message: 'Database connection timeout' },
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const res = await POST(buildRequest({ email: 'error@example.com' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to verify account state. Please try again.');

    expect(mockRpc).not.toHaveBeenCalledWith('request_otp', expect.anything());
    expect(mockSendPasswordResetOtpEmail).not.toHaveBeenCalled();
  });

  it('9. Eligible request exceeding rate limit: returns 429 rate limit error', async () => {
    mockRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'get_account_state') {
        return Promise.resolve({
          data: {
            user_id: TEST_OWNER_ID,
            profile_id: TEST_PROFILE_ID,
            role: 'hostel_owner',
            password_set: true,
            missing_step: 'complete',
            is_complete: true,
          },
          error: null,
        });
      }
      if (rpcName === 'request_otp') {
        return Promise.resolve({
          data: { success: true, rate_limited: true },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const res = await POST(buildRequest({ email: OWNER_EMAIL }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('Too many reset requests. Please wait a few minutes before trying again.');

    expect(mockRpc).toHaveBeenCalledWith('request_otp', expect.anything());
    expect(mockSendPasswordResetOtpEmail).not.toHaveBeenCalled();
  });

  it('10. Email delivery failure: returns 500 error instead of false success claim', async () => {
    mockRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'get_account_state') {
        return Promise.resolve({
          data: {
            user_id: TEST_OWNER_ID,
            profile_id: TEST_PROFILE_ID,
            role: 'hostel_owner',
            password_set: true,
            missing_step: 'complete',
            is_complete: true,
          },
          error: null,
        });
      }
      if (rpcName === 'request_otp') {
        return Promise.resolve({
          data: { success: true, otp: '111222' },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockSendPasswordResetOtpEmail.mockResolvedValueOnce({
      success: false,
      error: 'Brevo API rate limit exceeded',
    });

    const res = await POST(buildRequest({ email: OWNER_EMAIL }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to deliver verification email. Please try again later.');
  });
});
