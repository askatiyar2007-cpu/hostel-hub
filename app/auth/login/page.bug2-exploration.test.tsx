/**
 * Bug condition exploration test for Bug 2 (forced tab auto-switch on OAuth
 * reason mismatch).
 *
 * Validates: Requirements 1.2, 1.3 (bugfix.md)
 * Property 3: Bug Condition - No Forced Tab Switch on OAuth Reason Mismatch (design.md)
 *
 * IMPORTANT: These tests are EXPECTED TO FAIL on unfixed code. A failure here
 * confirms the bug described in bugfix.md 1.2/1.3 exists: the login page
 * forces a tab switch purely from the OAuth `reason` redirect, before the
 * user has clicked the AuthMessage action button.
 *
 * DO NOT "fix" these tests or the implementation when they fail - failure is
 * the expected/correct outcome for this exploration task. Task 6 (the actual
 * fix) is responsible for making the *corrected* assertions pass later.
 */
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---- next/navigation mock -------------------------------------------------
// Lets each test simulate "navigating" to a new /auth/login?... URL by
// mutating `currentSearch` and re-rendering, without needing a real Next.js
// router/app-router context.
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

// ---- next/link mock ---------------------------------------------------
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// ---- auth context mock -----------------------------------------------
vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    profile: null,
    accountCompletionStep: null,
    refreshAuthState: vi.fn(),
  }),
}));

// ---- supabase client mock ----------------------------------------------
// Not exercised by these tests (no Google button click, no form submit), but
// the module is imported at the top of page.tsx and reads env vars at import
// time, so it must be mocked to keep the test isolated and deterministic.
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
    from: vi.fn(),
  },
}));

import LoginPage from './page';

function currentTabTriggerState() {
  const signIn = screen.getByRole('tab', { name: 'Sign In' });
  const signUp = screen.getByRole('tab', { name: 'Sign Up' });
  return {
    signIn: signIn.getAttribute('aria-selected'),
    signUp: signUp.getAttribute('aria-selected'),
  };
}

describe('Bug 2 exploration: forced tab auto-switch on OAuth reason mismatch', () => {
  beforeEach(() => {
    mockRouterReplace.mockClear();
    mockRouterPush.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('BUG: navigating from Sign In to /auth/login?tab=signup&reason=no-account flips activeTab to signup without any click', () => {
    // Start on the Sign In tab, as if the user clicked "Continue with Google"
    // from there.
    currentSearch = 'tab=login';
    const { rerender } = render(<LoginPage />);

    const initial = currentTabTriggerState();
    expect(initial.signIn).toBe('true');
    expect(initial.signUp).toBe('false');

    // Simulate the callback's current (unfixed) redirect for a
    // login-intent / no-account mismatch.
    currentSearch = 'tab=signup&reason=no-account';
    rerender(<LoginPage />);

    // No click on the AuthMessage "Create account" action button happened
    // above - only a "navigation". On unfixed code this is expected to have
    // already flipped the tab to Sign Up.
    const afterNav = currentTabTriggerState();

    // EXPECTED (fixed) behavior would be signIn:'true' / signUp:'false' here
    // (starting tab preserved). Asserting the *fixed* expectation below is
    // intentional: this assertion is expected to FAIL on unfixed code,
    // which is the proof the bug exists.
    expect(afterNav.signIn).toBe('true');
    expect(afterNav.signUp).toBe('false');
  });

  it('BUG: navigating from Sign Up to /auth/login?tab=login&reason=signin flips activeTab to login without any click', () => {
    // Start on the Sign Up tab, as if the user clicked "Continue with
    // Google" from there.
    currentSearch = 'tab=signup';
    const { rerender } = render(<LoginPage />);

    const initial = currentTabTriggerState();
    expect(initial.signIn).toBe('false');
    expect(initial.signUp).toBe('true');

    // Simulate the callback's current (unfixed) redirect for a
    // signup-intent / already-complete-account mismatch.
    currentSearch = 'tab=login&reason=signin';
    rerender(<LoginPage />);

    const afterNav = currentTabTriggerState();

    // EXPECTED (fixed) behavior would be signIn:'false' / signUp:'true' here
    // (starting tab preserved). Asserting the *fixed* expectation below is
    // intentional: this assertion is expected to FAIL on unfixed code.
    expect(afterNav.signIn).toBe('false');
    expect(afterNav.signUp).toBe('true');
  });
});
