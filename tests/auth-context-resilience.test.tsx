import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
  }),
}));

import { AuthProvider, useAuth } from '@/lib/auth/context';

function TestConsumer() {
  const { user, profile, accountCompletionStep, password_set, loading, refreshAuthState } = useAuth();
  return (
    <div>
      <div data-testid="loading">{loading ? 'true' : 'false'}</div>
      <div data-testid="user">{user?.email || 'none'}</div>
      <div data-testid="role">{profile?.role || 'none'}</div>
      <div data-testid="step">{accountCompletionStep || 'none'}</div>
      <div data-testid="password-set">{password_set === null ? 'null' : String(password_set)}</div>
      <button onClick={() => void refreshAuthState()} data-testid="refresh-btn">
        Refresh
      </button>
    </div>
  );
}

describe('AuthContext Resilience & Recovery', () => {
  let authCallback: ((event: string, session: unknown) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    authCallback = null;

    mockOnAuthStateChange.mockImplementation((cb) => {
      authCallback = cb;
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      };
    });

    // Default global fetch mock
    global.fetch = vi.fn();
  });

  it('synchronizes and populates state cleanly on successful account-state response', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: 'user-1', email: 'owner@example.com' },
        },
      },
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValueOnce({
          data: { id: 'prof-1', user_id: 'user-1', email: 'owner@example.com', role: 'hostel_owner', password_set: true },
          error: null,
        }),
      }),
    });

    mockFrom.mockReturnValue({ select: mockSelect });

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        missing_step: 'complete',
        is_complete: true,
        role: 'hostel_owner',
        password_set: true,
      }),
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('user').textContent).toBe('owner@example.com');
    expect(screen.getByTestId('role').textContent).toBe('hostel_owner');
    expect(screen.getByTestId('step').textContent).toBe('complete');
    expect(screen.getByTestId('password-set').textContent).toBe('true');
  });

  it('recovers from transient account-state API failure on subsequent SIGNED_IN auth event', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-1', email: 'owner@example.com' },
        },
      },
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'prof-1', user_id: 'user-1', email: 'owner@example.com', role: 'hostel_owner', password_set: true },
          error: null,
        }),
      }),
    });

    mockFrom.mockReturnValue({ select: mockSelect });

    // First call fails with 500
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    // Now second call (on SIGNED_IN) succeeds with 200
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        missing_step: 'complete',
        is_complete: true,
        role: 'hostel_owner',
        password_set: true,
      }),
    });

    // Trigger auth state change event
    await act(async () => {
      authCallback?.('SIGNED_IN', { user: { id: 'user-1', email: 'owner@example.com' } });
    });

    await waitFor(() => {
      expect(screen.getByTestId('step').textContent).toBe('complete');
    });

    expect(screen.getByTestId('password-set').textContent).toBe('true');
  });

  it('clears state cleanly on SIGNED_OUT auth event', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: 'user-1', email: 'owner@example.com' },
        },
      },
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValueOnce({
          data: { id: 'prof-1', user_id: 'user-1', email: 'owner@example.com', role: 'hostel_owner', password_set: true },
          error: null,
        }),
      }),
    });

    mockFrom.mockReturnValue({ select: mockSelect });

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        missing_step: 'complete',
        is_complete: true,
        role: 'hostel_owner',
        password_set: true,
      }),
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('owner@example.com');
    });

    // Now trigger sign out
    await act(async () => {
      authCallback?.('SIGNED_OUT', null);
    });

    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(screen.getByTestId('role').textContent).toBe('none');
    expect(screen.getByTestId('step').textContent).toBe('none');
    expect(screen.getByTestId('password-set').textContent).toBe('null');
  });
});
