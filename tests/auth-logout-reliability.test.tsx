import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------
// Storage Mocks
// ---------------------------------------------------------
class MockStorage implements Storage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, val: string): void {
    this.store.set(key, String(val));
    (this as any)[key] = String(val);
  }
  removeItem(key: string): void {
    this.store.delete(key);
    delete (this as any)[key];
  }
  clear(): void {
    for (const key of this.store.keys()) {
      delete (this as any)[key];
    }
    this.store.clear();
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  get length(): number {
    return this.store.size;
  }
}

const mockLocalStorage = new MockStorage();
const mockSessionStorage = new MockStorage();

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true, configurable: true });
Object.defineProperty(global, 'localStorage', { value: mockLocalStorage, writable: true, configurable: true });
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage, writable: true, configurable: true });
Object.defineProperty(global, 'sessionStorage', { value: mockSessionStorage, writable: true, configurable: true });

// ---------------------------------------------------------
// Next.js & Supabase Mocks
// ---------------------------------------------------------
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockLocalSignOut = vi.fn();
const mockFrom = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    }),
  }),
});

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signOut: (...args: unknown[]) => mockLocalSignOut(...args),
      signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const mockRouterReplace = vi.fn();
const mockRouterPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
    push: mockRouterPush,
  }),
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock server client for route tests
const mockServerSignOut = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signOut: (...args: unknown[]) => mockServerSignOut(...args),
    },
  })),
}));

import { AuthProvider, useAuth } from '@/lib/auth/context';
import { POST as signoutApiHandler, resolveSupabaseProjectStorageKey } from '@/app/api/auth/signout/route';
import { AuthMessage } from '@/components/auth-message';

// Helper Test Component for AuthProvider
function LogoutConsumer() {
  const { user, loading, signOut, isAuthenticated } = useAuth();
  return (
    <div>
      <div data-testid="is-authenticated">{isAuthenticated ? 'yes' : 'no'}</div>
      <div data-testid="user-id">{user?.id || 'none'}</div>
      <div data-testid="user-email">{user?.email || 'none'}</div>
      <div data-testid="loading">{loading ? 'true' : 'false'}</div>
      <button data-testid="signout-btn" onClick={() => void signOut()}>
        Trigger SignOut
      </button>
    </div>
  );
}

describe('Auth Logout Reliability & Cross-Account Isolation', () => {
  let originalLocation: Location;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    mockSessionStorage.clear();

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-A-id', email: 'userA@example.com' },
          access_token: 'mock-access-token-A',
        },
      },
      error: null,
    });

    mockOnAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });

    mockLocalSignOut.mockResolvedValue({ error: null });

    originalLocation = window.location;
    // @ts-expect-error Mocking window.location
    delete window.location;
    (window as any).location = {
      ...originalLocation,
      replace: vi.fn(),
      assign: vi.fn(),
      href: 'http://localhost:3000/dashboard',
    };

    originalFetch = global.fetch;
  });

  afterEach(() => {
    (window as any).location = originalLocation;
    global.fetch = originalFetch;
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Server logout is dispatched BEFORE local signout removes cookies
  // ---------------------------------------------------------------------------
  it('1. dispatches server logout request before local signout removes cookies', async () => {
    const callOrder: string[] = [];

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/auth/signout') {
        callOrder.push('server-signout-fetch');
        expect(callOrder).not.toContain('local-supabase-signout');
        expect(init?.method).toBe('POST');
        expect(init?.credentials).toBe('same-origin');
        expect(init?.keepalive).toBe(true);
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, remoteRevoked: true }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    mockLocalSignOut.mockImplementation(async () => {
      callOrder.push('local-supabase-signout');
      return { error: null };
    });

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LogoutConsumer />
        </AuthProvider>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByTestId('signout-btn'));
    const confirmLogoutBtn = screen.getByRole('button', { name: /Logout/i });

    await act(async () => {
      fireEvent.click(confirmLogoutBtn);
    });

    expect(callOrder).toEqual(['server-signout-fetch', 'local-supabase-signout']);
    expect(mockLocalSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(window.location.replace).toHaveBeenCalledWith('/auth/login');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Server logout failure still clears local authentication
  // ---------------------------------------------------------------------------
  it('2. clears local authentication and redirects even if server logout endpoint fails', async () => {
    document.cookie = 'sb-test-auth-token=token123; path=/';
    mockLocalStorage.setItem('sb-test-token', 'token123');
    mockLocalStorage.setItem('hostelhub_session_key', 'session123');
    mockSessionStorage.setItem('active_tab', 'overview');

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/auth/signout') {
        throw new Error('Network failure or Server 500');
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LogoutConsumer />
        </AuthProvider>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByTestId('signout-btn'));
    const confirmLogoutBtn = screen.getByRole('button', { name: /Logout/i });

    await act(async () => {
      fireEvent.click(confirmLogoutBtn);
    });

    expect(mockLocalSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mockLocalStorage.getItem('sb-test-token')).toBeNull();
    expect(mockLocalStorage.getItem('hostelhub_session_key')).toBeNull();
    expect(mockSessionStorage.getItem('active_tab')).toBeNull();
    expect(window.location.replace).toHaveBeenCalledWith('/auth/login');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Slow server logout does not leave user trapped on protected screen
  // ---------------------------------------------------------------------------
  it('3. does not trap user on protected screen when server logout is slow or times out', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/auth/signout') {
        return new Promise<Response>((_resolve, reject) => {
          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }
        });
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    vi.useFakeTimers();

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LogoutConsumer />
        </AuthProvider>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByTestId('signout-btn'));
    const confirmLogoutBtn = screen.getByRole('button', { name: /Logout/i });

    fireEvent.click(confirmLogoutBtn);

    // Fast-forward past the 1500ms timeout
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    expect(mockLocalSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(window.location.replace).toHaveBeenCalledWith('/auth/login');

    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Account A logout followed by Account B login isolates data
  // ---------------------------------------------------------------------------
  it('4. purges React Query cache and dismissed notifications without deleting theme preference', async () => {
    const queryClient = new QueryClient();

    queryClient.setQueryData(['pending-readings', 'user-A-id'], { readings: [1, 2, 3] });
    queryClient.setQueryData(['profile', 'user-A-id'], { name: 'Account A Owner' });

    mockLocalStorage.setItem('hostelhub_dismissed_owner_notifs_user-A-id', JSON.stringify(['notif-1', 'notif-2']));
    mockLocalStorage.setItem('hostelhub_dismissed_student_notifs_user-A-id', JSON.stringify(['notif-s1']));
    mockLocalStorage.setItem('hostelhub_theme', 'dark');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, remoteRevoked: true }),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LogoutConsumer />
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(queryClient.getQueryData(['pending-readings', 'user-A-id'])).toBeDefined();

    fireEvent.click(screen.getByTestId('signout-btn'));
    const confirmLogoutBtn = screen.getByRole('button', { name: /Logout/i });

    await act(async () => {
      fireEvent.click(confirmLogoutBtn);
    });

    // 1. React Query cache must be emptied
    expect(queryClient.getQueryCache().getAll().length).toBe(0);
    expect(queryClient.getQueryData(['pending-readings', 'user-A-id'])).toBeUndefined();

    // 2. Dismissed notifications for Account A must be removed
    expect(mockLocalStorage.getItem('hostelhub_dismissed_owner_notifs_user-A-id')).toBeNull();
    expect(mockLocalStorage.getItem('hostelhub_dismissed_student_notifs_user-A-id')).toBeNull();

    // 3. User theme preference MUST be preserved
    expect(mockLocalStorage.getItem('hostelhub_theme')).toBe('dark');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Server revocation failure is not falsely reported as remote success
  // ---------------------------------------------------------------------------
  it('5. accurately reports remoteRevoked: false when Supabase server revocation fails', async () => {
    mockServerSignOut.mockResolvedValueOnce({
      error: { message: 'Invalid or expired session token' },
    });

    const mockReqA = new NextRequest('http://localhost:3000/api/auth/signout', {
      method: 'POST',
      headers: { cookie: 'sb-dummy-project-auth-token=tokenA' },
    });

    const resA = await signoutApiHandler(mockReqA);
    const bodyA = await resA.json();

    expect(resA.status).toBe(200);
    expect(bodyA.success).toBe(true);
    expect(bodyA.cookieCleared).toBe(true);
    expect(bodyA.remoteRevoked).toBe(false);
    expect(bodyA.revocationError).toBe('Invalid or expired session token');
    // Clear-Site-Data must NOT be present — broad cookie wiping is forbidden
    expect(resA.headers.get('Clear-Site-Data')).toBeNull();
    expect(resA.headers.get('Cache-Control')).toContain('no-store');

    mockServerSignOut.mockResolvedValueOnce({ error: null });

    const mockReqB = new NextRequest('http://localhost:3000/api/auth/signout', {
      method: 'POST',
      headers: { cookie: 'sb-dummy-project-auth-token=tokenB' },
    });

    const resB = await signoutApiHandler(mockReqB);
    const bodyB = await resB.json();

    expect(resB.status).toBe(200);
    expect(bodyB.success).toBe(true);
    expect(bodyB.cookieCleared).toBe(true);
    expect(bodyB.remoteRevoked).toBe(true);
    expect(bodyB.revocationError).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 6: Existing Google login/signup behavior remains unchanged
  // ---------------------------------------------------------------------------
  it('6. renders high-contrast Account Not Found error presentation and action button', () => {
    const mockActionClick = vi.fn();
    const mockDismiss = vi.fn();

    render(
      <AuthMessage
        variant="error"
        title="Account Not Found"
        description="This Google account is not associated with a StayKosh account. Please create an account from the Sign Up tab first."
        action={{
          label: 'Go to Sign Up',
          onClick: mockActionClick,
        }}
        onDismiss={mockDismiss}
      />
    );

    // Title and description rendered with appropriate role
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Account Not Found')).toBeDefined();
    expect(
      screen.getByText(
        'This Google account is not associated with a StayKosh account. Please create an account from the Sign Up tab first.'
      )
    ).toBeDefined();

    // High-contrast action button is present and clickable
    const actionBtn = screen.getByRole('button', { name: /Go to Sign Up/i });
    expect(actionBtn).toBeDefined();
    expect(actionBtn.className).toContain('text-[#07534C]');
    expect(actionBtn.className).toContain('bg-white');

    fireEvent.click(actionBtn);
    expect(mockActionClick).toHaveBeenCalledTimes(1);

    // Dismiss button is present and clickable
    const dismissBtn = screen.getByRole('button', { name: /Dismiss message/i });
    fireEvent.click(dismissBtn);
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Only configured project Supabase auth cookies are expired, another project & unrelated cookies are preserved
  // ---------------------------------------------------------------------------
  it('7. preserves another project cookies and unrelated cookies, expiring only configured project cookies and arbitrary chunks', async () => {
    mockServerSignOut.mockResolvedValueOnce({ error: null });

    // Request contains:
    // - Configured project cookies (base, chunk .0, chunk .5, chunk .8 beyond .4)
    // - Another Supabase project's auth cookies (sb-otherproject-auth-token, chunk .0)
    // - Unrelated cookies (analytics_session, csrf_token, theme_pref, sb-dummy-project-preference)
    const mockReq = new NextRequest('http://localhost:3000/api/auth/signout', {
      method: 'POST',
      headers: {
        cookie: [
          'sb-dummy-project-auth-token=tokenConfigured',
          'sb-dummy-project-auth-token.0=chunk0',
          'sb-dummy-project-auth-token.5=chunk5',
          'sb-dummy-project-auth-token.8=chunk8',
          'sb-dummy-project-auth-token.00=invalidLeadingZero',
          'sb-dummy-project-auth-token.nonnumeric=invalidChunk',
          'sb-otherproject-auth-token=tokenOtherProject',
          'sb-otherproject-auth-token.0=otherChunk0',
          'analytics_session=abc123analytics',
          'csrf_token=xyz987csrf',
          'theme_pref=dark',
          'sb-dummy-project-preference=persisted',
        ].join('; '),
      },
    });

    const res = await signoutApiHandler(mockReq);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.remoteRevoked).toBe(true);

    // 1. Configured project's base and all chunks (including high chunks .5 and .8) must be in expiredCookies
    expect(body.expiredCookies).toContain('sb-dummy-project-auth-token');
    expect(body.expiredCookies).toContain('sb-dummy-project-auth-token.0');
    expect(body.expiredCookies).toContain('sb-dummy-project-auth-token.5');
    expect(body.expiredCookies).toContain('sb-dummy-project-auth-token.8');

    // 2. Another Supabase project's cookies must NOT be expired
    expect(body.expiredCookies).not.toContain('sb-otherproject-auth-token');
    expect(body.expiredCookies).not.toContain('sb-otherproject-auth-token.0');

    // Canonical numeric index check: invalid non-canonical chunk names must NOT be expired
    expect(body.expiredCookies).not.toContain('sb-dummy-project-auth-token.00');
    expect(body.expiredCookies).not.toContain('sb-dummy-project-auth-token.nonnumeric');

    // 3. Unrelated cookies must NOT be expired
    expect(body.expiredCookies).not.toContain('analytics_session');
    expect(body.expiredCookies).not.toContain('csrf_token');
    expect(body.expiredCookies).not.toContain('theme_pref');
    // Non-auth cookie from same project must NOT be expired
    expect(body.expiredCookies).not.toContain('sb-dummy-project-preference');

    // 4. Verify ACTUAL Set-Cookie response headers on the response object
    const cookieMap = new Map(res.cookies.getAll().map(c => [c.name, c]));

    // Configured project cookies MUST have maxAge: 0 and path: '/'
    expect(cookieMap.has('sb-dummy-project-auth-token')).toBe(true);
    expect(cookieMap.get('sb-dummy-project-auth-token')?.maxAge).toBe(0);
    expect(cookieMap.get('sb-dummy-project-auth-token')?.path).toBe('/');

    expect(cookieMap.has('sb-dummy-project-auth-token.5')).toBe(true);
    expect(cookieMap.get('sb-dummy-project-auth-token.5')?.maxAge).toBe(0);
    expect(cookieMap.get('sb-dummy-project-auth-token.5')?.path).toBe('/');

    expect(cookieMap.has('sb-dummy-project-auth-token.8')).toBe(true);
    expect(cookieMap.get('sb-dummy-project-auth-token.8')?.maxAge).toBe(0);
    expect(cookieMap.get('sb-dummy-project-auth-token.8')?.path).toBe('/');

    // Unrelated cookies and other project cookies MUST NOT have Set-Cookie directives
    expect(cookieMap.has('sb-otherproject-auth-token')).toBe(false);
    expect(cookieMap.has('sb-otherproject-auth-token.0')).toBe(false);
    expect(cookieMap.has('analytics_session')).toBe(false);
    expect(cookieMap.has('csrf_token')).toBe(false);
    expect(cookieMap.has('theme_pref')).toBe(false);
    expect(cookieMap.has('sb-dummy-project-preference')).toBe(false);

    // Verify raw Set-Cookie header serialization
    const setCookieHeaders = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];
    const joinedSetCookie = setCookieHeaders.join(' | ');
    expect(joinedSetCookie).toContain('sb-dummy-project-auth-token=;');
    expect(joinedSetCookie).toContain('Max-Age=0');
    expect(joinedSetCookie).toContain('Path=/');
    expect(joinedSetCookie).not.toContain('sb-otherproject-auth-token');
    expect(joinedSetCookie).not.toContain('analytics_session');
    expect(joinedSetCookie).not.toContain('csrf_token');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Clear-Site-Data header is NOT sent (no broad cookie-clearing directive)
  // ---------------------------------------------------------------------------
  it('8. signout response does not send a broad cookie-clearing directive (Clear-Site-Data is omitted)', async () => {
    mockServerSignOut.mockResolvedValueOnce({ error: null });

    const mockReq = new NextRequest('http://localhost:3000/api/auth/signout', {
      method: 'POST',
      headers: { cookie: 'sb-dummy-project-auth-token=tokenA' },
    });

    const res = await signoutApiHandler(mockReq);

    const clearSiteData = res.headers.get('Clear-Site-Data');
    expect(clearSiteData).toBeNull();
    // Cache headers must strictly prevent caching
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Custom domain safety & fail-closed storageKey resolution
  // ---------------------------------------------------------------------------
  it('9. safely resolves storageKey for standard Supabase URLs and fails closed for custom domains, missing, or malformed URLs', () => {
    // 1. Standard verified Supabase URL
    expect(resolveSupabaseProjectStorageKey(null, 'https://test-project-123.supabase.co')).toBe(
      'sb-test-project-123-auth-token'
    );

    // 2. Custom domain: must return null (fail closed to avoid guessing or collateral deletion)
    expect(resolveSupabaseProjectStorageKey(null, 'https://auth.staykosh.com')).toBeNull();
    expect(resolveSupabaseProjectStorageKey(null, 'https://custom-auth.example.org')).toBeNull();

    // 3. Self-hosted IP or localhost URL: must return null
    expect(resolveSupabaseProjectStorageKey(null, 'http://127.0.0.1:54321')).toBeNull();
    expect(resolveSupabaseProjectStorageKey(null, 'http://localhost:54321')).toBeNull();

    // 4. Malformed URL: must return null
    expect(resolveSupabaseProjectStorageKey(null, 'not-a-valid-url')).toBeNull();
    expect(resolveSupabaseProjectStorageKey(null, 'https://')).toBeNull();

    // 5. Missing / empty URL: must return null
    expect(resolveSupabaseProjectStorageKey(null, '')).toBeNull();

    // 6. Primary source: initialized Supabase client with explicit storageKey is preserved even if URL is custom
    const mockClientWithStorageKey = {
      auth: {
        storageKey: 'sb-customclient-auth-token',
      },
    };
    expect(resolveSupabaseProjectStorageKey(mockClientWithStorageKey, 'https://custom.domain.com')).toBe(
      'sb-customclient-auth-token'
    );
  });
});
