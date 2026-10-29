import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

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
import { middleware } from '@/middleware';

function TestConsumer() {
  const { user, profile, accountCompletionStep, password_set, loading } = useAuth();
  return (
    <div>
      <div data-testid="loading">{loading ? 'true' : 'false'}</div>
      <div data-testid="user">{user?.email || 'none'}</div>
      <div data-testid="role">{profile?.role || 'none'}</div>
      <div data-testid="step">{accountCompletionStep || 'none'}</div>
      <div data-testid="password-set">{password_set === null ? 'null' : String(password_set)}</div>
    </div>
  );
}

describe('Electricity Record Auth & Navigation Resilience Regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockOnAuthStateChange.mockImplementation(() => ({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    }));

    global.fetch = vi.fn();
  });

  describe('AuthProvider account-state authorization and fallback resilience', () => {
    it('passes Authorization Bearer token header to /api/auth/account-state when active session exists', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'secret-bearer-token-123',
            user: { id: 'owner-uuid-1', email: 'owner@example.com' },
          },
        },
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValueOnce({
            data: { id: 'p-1', user_id: 'owner-uuid-1', email: 'owner@example.com', role: 'owner', password_set: true },
            error: null,
          }),
        }),
      });
      mockFrom.mockReturnValue({ select: mockSelect });

      let capturedHeaders: Record<string, string> | undefined;
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(async (url: string, init?: RequestInit) => {
        if (url === '/api/auth/account-state') {
          capturedHeaders = init?.headers as Record<string, string>;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              missing_step: 'complete',
              is_complete: true,
              role: 'owner',
              password_set: true,
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(capturedHeaders).toBeDefined();
      expect(capturedHeaders?.['Authorization']).toBe('Bearer secret-bearer-token-123');
      expect(screen.getByTestId('step').textContent).toBe('complete');
      expect(screen.getByTestId('password-set').textContent).toBe('true');
    });

    it('gracefully retains authenticated profile state when /api/auth/account-state returns 401', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'token-401-test',
            user: { id: 'owner-uuid-2', email: 'owner@example.com' },
          },
        },
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValueOnce({
            data: { id: 'p-2', user_id: 'owner-uuid-2', email: 'owner@example.com', role: 'owner', password_set: true },
            error: null,
          }),
        }),
      });
      mockFrom.mockReturnValue({ select: mockSelect });

      // Simulate /api/auth/account-state returning 401 (e.g. cookie mismatch)
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      // Crucial: step must NOT be null (which would trigger incomplete account redirect/signout)
      expect(screen.getByTestId('user').textContent).toBe('owner@example.com');
      expect(screen.getByTestId('role').textContent).toBe('owner');
      expect(screen.getByTestId('step').textContent).toBe('complete');
      expect(screen.getByTestId('password-set').textContent).toBe('true');
    });

    it('clears state cleanly when session is genuinely absent', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('user').textContent).toBe('none');
      expect(screen.getByTestId('role').textContent).toBe('none');
      expect(screen.getByTestId('step').textContent).toBe('none');
      expect(screen.getByTestId('password-set').textContent).toBe('null');
    });
  });

  describe('Middleware redirect sanitization', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock-supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';
    });

    it('redirects unauthenticated protected requests to clean /auth/login without leaking internal query parameters', async () => {
      const headers = new Headers();
      const req = new NextRequest('http://localhost:3000/owner/electricity/readings/record?meter_id=abc-123&reading_reason=initial', {
        headers,
      });
      
      const res = await middleware(req);
      
      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toBeDefined();
      const parsedUrl = new URL(location!);
      expect(parsedUrl.pathname).toBe('/auth/login');
      // Must not leak ?meter_id=abc-123&reading_reason=initial
      expect(parsedUrl.search).toBe('');
      expect(parsedUrl.searchParams.get('meter_id')).toBeNull();
      expect(parsedUrl.searchParams.get('reading_reason')).toBeNull();
      expect(parsedUrl.searchParams.get('reason')).toBeNull();
    });
  });

  describe('Electricity Billing and Readings integration contracts', () => {
    it('app/owner/electricity/billing/page.tsx uses reading_reason to avoid auth query parameter collision', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const billingPath = path.join(process.cwd(), 'app', 'owner', 'electricity', 'billing', 'page.tsx');
      const content = fs.readFileSync(billingPath, 'utf-8');
      expect(content).toContain('reading_reason=');
      expect(content).not.toMatch(/readings\/record\?meter_id=[^&]+&reason=/);
    });

    it('app/owner/electricity/readings/record/page.tsx accepts reading_reason with fallback to reason', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const recordPagePath = path.join(process.cwd(), 'app', 'owner', 'electricity', 'readings', 'record', 'page.tsx');
      const content = fs.readFileSync(recordPagePath, 'utf-8');
      expect(content).toContain("searchParams.get('reading_reason')");
      expect(content).toContain('getAuthHeaders');
    });

    it('all electricity API routes pass request to createClient for Bearer authorization', async () => {
      const fs = await import('fs');
      const path = await import('path');
      
      const hostelsOwnerPath = path.join(process.cwd(), 'app', 'api', 'hostels', 'owner', 'route.ts');
      const metersPath = path.join(process.cwd(), 'app', 'api', 'meters', 'route.ts');
      const meterIdPath = path.join(process.cwd(), 'app', 'api', 'meters', '[meterId]', 'route.ts');
      const readingsRecordPath = path.join(process.cwd(), 'app', 'api', 'readings', 'record', 'route.ts');

      expect(fs.readFileSync(hostelsOwnerPath, 'utf-8')).toMatch(/createClient\s*\(\s*req\s*\)/);
      expect(fs.readFileSync(metersPath, 'utf-8')).toMatch(/createClient\s*\(\s*req\s*\)/);
      expect(fs.readFileSync(meterIdPath, 'utf-8')).toMatch(/createClient\s*\(\s*req\s*\)/);
      expect(fs.readFileSync(readingsRecordPath, 'utf-8')).toMatch(/createClient\s*\(\s*request\s*\)/);
    });
  });
});
