import React from 'react';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let currentSearch = 'tab=login';
const mockRouterReplace = vi.fn();
const mockRouterPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
    push: mockRouterPush,
  }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

let mockAuthState: {
  isAuthenticated: boolean;
  profile: { role: string; full_name?: string } | null;
  accountCompletionStep: string | null;
  password_set: boolean | null;
  refreshAuthState: () => Promise<void>;
} = {
  isAuthenticated: false,
  profile: null,
  accountCompletionStep: null,
  password_set: null,
  refreshAuthState: vi.fn(),
};

vi.mock('@/lib/auth/context', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(),
  },
}));

import LoginPage from '@/app/auth/login/page';

describe('LoginPage Routing Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearch = 'tab=login';
    mockAuthState = {
      isAuthenticated: false,
      profile: null,
      accountCompletionStep: null,
      password_set: null,
      refreshAuthState: vi.fn(),
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('routes completed hostel owner directly to /owner/dashboard', () => {
    mockAuthState = {
      isAuthenticated: true,
      profile: { role: 'hostel_owner', full_name: 'Owner Name' },
      accountCompletionStep: 'complete',
      password_set: true,
      refreshAuthState: vi.fn(),
    };

    render(<LoginPage />);
    expect(mockRouterPush).toHaveBeenCalledWith('/owner/dashboard');
  });

  it('routes completed student directly to /student/dashboard', () => {
    mockAuthState = {
      isAuthenticated: true,
      profile: { role: 'student', full_name: 'Student Name' },
      accountCompletionStep: 'complete',
      password_set: true,
      refreshAuthState: vi.fn(),
    };

    render(<LoginPage />);
    expect(mockRouterPush).toHaveBeenCalledWith('/student/dashboard');
  });

  it('does NOT redirect logged-out visitor to /auth/select-role on login or signup tab', () => {
    mockAuthState = {
      isAuthenticated: false,
      profile: null,
      accountCompletionStep: null,
      password_set: null,
      refreshAuthState: vi.fn(),
    };

    render(<LoginPage />);
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('does NOT redirect to /auth/select-role when opening /auth/login?tab=signup', () => {
    currentSearch = 'tab=signup';
    mockAuthState = {
      isAuthenticated: false,
      profile: null,
      accountCompletionStep: null,
      password_set: null,
      refreshAuthState: vi.fn(),
    };

    render(<LoginPage />);
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('does NOT route incomplete account to /auth/select-role on login page mount, but purges incomplete session', () => {

    mockAuthState = {
      isAuthenticated: true,
      profile: { role: '', full_name: 'User Without Role' },
      accountCompletionStep: 'role',
      password_set: false,
      refreshAuthState: vi.fn(),
    };

    render(<LoginPage />);
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('does NOT route incomplete account missing password to /auth/setup-password on login page mount', () => {
    mockAuthState = {
      isAuthenticated: true,
      profile: { role: 'student', full_name: 'Student User' },
      accountCompletionStep: 'password',
      password_set: false,
      refreshAuthState: vi.fn(),
    };

    render(<LoginPage />);
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('waits and does not redirect prematurely when account completion state is still resolving (null)', () => {
    mockAuthState = {
      isAuthenticated: true,
      profile: { role: 'hostel_owner', full_name: 'Owner Resolving' },
      accountCompletionStep: null,
      password_set: null,
      refreshAuthState: vi.fn(),
    };

    render(<LoginPage />);
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('clicking Sign Up tab on login card switches active tab and never redirects to /auth/select-role', () => {
    mockAuthState = {
      isAuthenticated: false,
      profile: null,
      accountCompletionStep: null,
      password_set: null,
      refreshAuthState: vi.fn(),
    };

    render(<LoginPage />);
    const signupTab = screen.getByRole('tab', { name: /sign up/i });
    fireEvent.click(signupTab);

    expect(mockRouterReplace).toHaveBeenCalledWith('/auth/login?tab=signup');
    expect(mockRouterPush).not.toHaveBeenCalledWith('/auth/select-role');
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('allows toggling between Sign In and Sign Up tabs without entering redirect loops', () => {
    mockAuthState = {
      isAuthenticated: false,
      profile: null,
      accountCompletionStep: null,
      password_set: null,
      refreshAuthState: vi.fn(),
    };

    render(<LoginPage />);
    const signupTab = screen.getByRole('tab', { name: /sign up/i });
    fireEvent.click(signupTab);
    expect(mockRouterReplace).toHaveBeenCalledWith('/auth/login?tab=signup');

    const signinTab = screen.getByRole('tab', { name: /sign in/i });
    fireEvent.click(signinTab);
    expect(mockRouterReplace).toHaveBeenCalledWith('/auth/login?tab=login');

    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});
