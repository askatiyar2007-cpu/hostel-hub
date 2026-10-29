import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthInput } from '@/components/auth/AuthInput';

// Router mock
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  usePathname: () => '/find-hostel',
  useSearchParams: () => new URLSearchParams(),
}));

// Link mock
vi.mock('next/link', () => ({
  default: ({ children, href, className, onClick }: { children: React.ReactNode; href: string; className?: string; onClick?: () => void }) => (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}));

// Sonner mock
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock auth state
let mockAuthState: {
  user: any;
  profile: { role: string; full_name?: string } | null;
  accountCompletionStep: string | null;
  password_set: boolean | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshAuthState: () => Promise<void>;
  isAuthenticated: boolean;
} = {
  user: null,
  profile: null,
  accountCompletionStep: null,
  password_set: null,
  loading: false,
  signOut: vi.fn(),
  refreshAuthState: vi.fn(),
  isAuthenticated: false,
};

vi.mock('@/lib/auth/context', () => ({
  useAuth: () => mockAuthState,
}));

// Mock Supabase
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
        ilike: vi.fn(() => Promise.resolve({ data: [], error: null })),
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  },
}));

import FindHostelPage from '@/app/find-hostel/page';
import { SiteHeader } from '@/components/site-header';
import PublicHomePage from '@/app/(public)/page';

describe('Browse Hostel Navigation and Theme Integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Scenario 1: Authenticated Student Navigation', () => {
    it('renders breadcrumb navigating directly to /student/dashboard with label "Back to Dashboard"', async () => {
      mockAuthState = {
        user: { id: 'student-123' },
        profile: { role: 'student', full_name: 'Alex Student' },
        accountCompletionStep: 'complete',
        password_set: true,
        loading: false,
        signOut: vi.fn(),
        refreshAuthState: vi.fn(),
        isAuthenticated: true,
      };

      render(<FindHostelPage />);

      await waitFor(() => {
        const breadcrumb = screen.getByRole('link', { name: /Back to Dashboard/i });
        expect(breadcrumb).toBeDefined();
        expect(breadcrumb.getAttribute('href')).toBe('/student/dashboard');
      });

      // Confirm it does NOT navigate to "/" and does not bounce
      const homeLink = screen.queryByRole('link', { name: /Back to Home/i });
      expect(homeLink).toBeNull();
    });

    it('updates SiteHeader logo to link to /student/dashboard for authenticated students', () => {
      mockAuthState = {
        user: { id: 'student-123' },
        profile: { role: 'student', full_name: 'Alex Student' },
        accountCompletionStep: 'complete',
        password_set: true,
        loading: false,
        signOut: vi.fn(),
        refreshAuthState: vi.fn(),
        isAuthenticated: true,
      };

      render(<SiteHeader />);

      const brandLogoLink = screen.getByRole('link', { name: /Stay\s*Kosh|HostelHub/i });
      expect(brandLogoLink.getAttribute('href')).toBe('/student/dashboard');
    });
  });

  describe('Scenario 2: Public Homepage Visitor Navigation', () => {
    it('renders breadcrumb navigating to / with label "Back to Home" for unauthenticated visitors', async () => {
      mockAuthState = {
        user: null,
        profile: null,
        accountCompletionStep: null,
        password_set: null,
        loading: false,
        signOut: vi.fn(),
        refreshAuthState: vi.fn(),
        isAuthenticated: false,
      };

      render(<FindHostelPage />);

      await waitFor(() => {
        const breadcrumb = screen.getByRole('link', { name: /Back to Home/i });
        expect(breadcrumb).toBeDefined();
        expect(breadcrumb.getAttribute('href')).toBe('/');
      });

      const dashboardLink = screen.queryByRole('link', { name: /Back to Dashboard/i });
      expect(dashboardLink).toBeNull();
    });

    it('keeps SiteHeader logo pointing to / for public visitors', () => {
      mockAuthState = {
        user: null,
        profile: null,
        accountCompletionStep: null,
        password_set: null,
        loading: false,
        signOut: vi.fn(),
        refreshAuthState: vi.fn(),
        isAuthenticated: false,
      };

      render(<SiteHeader />);

      const brandLogoLink = screen.getByRole('link', { name: /Stay\s*Kosh|HostelHub/i });
      expect(brandLogoLink.getAttribute('href')).toBe('/');
    });
  });

  describe('Scenario 3: Non-Student Authenticated Roles (No Hardcoded Student Route)', () => {
    it('renders breadcrumb navigating to /owner/dashboard for hostel owners', async () => {
      mockAuthState = {
        user: { id: 'owner-456' },
        profile: { role: 'owner', full_name: 'Hostel Owner' },
        accountCompletionStep: 'complete',
        password_set: true,
        loading: false,
        signOut: vi.fn(),
        refreshAuthState: vi.fn(),
        isAuthenticated: true,
      };

      render(<FindHostelPage />);

      await waitFor(() => {
        const breadcrumb = screen.getByRole('link', { name: /Back to Dashboard/i });
        expect(breadcrumb).toBeDefined();
        expect(breadcrumb.getAttribute('href')).toBe('/owner/dashboard');
      });
    });

    it('falls back to / for users with incomplete account setup', async () => {
      mockAuthState = {
        user: { id: 'student-789' },
        profile: { role: 'student', full_name: 'Incomplete Student' },
        accountCompletionStep: 'password', // onboarding not complete
        password_set: false,
        loading: false,
        signOut: vi.fn(),
        refreshAuthState: vi.fn(),
        isAuthenticated: true,
      };

      render(<FindHostelPage />);

      await waitFor(() => {
        const breadcrumb = screen.getByRole('link', { name: /Back to Home/i });
        expect(breadcrumb).toBeDefined();
        expect(breadcrumb.getAttribute('href')).toBe('/');
      });
    });
  });

  describe('Scenario 4: Dark & Light Theme Consistency', () => {
    it('has both light and dark mode classes on Browse Hostel outer container', () => {
      mockAuthState = {
        user: null,
        profile: null,
        accountCompletionStep: null,
        password_set: null,
        loading: false,
        signOut: vi.fn(),
        refreshAuthState: vi.fn(),
        isAuthenticated: false,
      };

      const { container } = render(<FindHostelPage />);
      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv.className).toContain('bg-[#FAFCFB]');
      expect(rootDiv.className).toContain('dark:bg-[#07131d]');
      expect(rootDiv.className).toContain('text-slate-900');
      expect(rootDiv.className).toContain('dark:text-slate-100');
    });

    it('ensures PublicHomePage loading screen includes dark mode background to eliminate theme flash during redirects', async () => {
      mockAuthState = {
        user: { id: 'student-123' },
        profile: { role: 'student', full_name: 'Alex Student' },
        accountCompletionStep: 'complete',
        password_set: true,
        loading: false,
        signOut: vi.fn(),
        refreshAuthState: vi.fn(),
        isAuthenticated: true,
      };

      const { container } = render(<PublicHomePage />);
      const loadingContainer = container.firstChild as HTMLElement;
      
      // Must contain dark:bg-[#07131d] so dark mode stays dark
      expect(loadingContainer.className).toContain('dark:bg-[#07131d]');
      expect(loadingContainer.className).toContain('bg-[#FAFCFB]');

      // Should initiate redirect to student dashboard
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/student/dashboard');
      });
    });
  });

  describe('Scenario 5: Directly Opening /find-hostel', () => {
    it('successfully renders search bar, QR scanning button, and helper text when opened directly', () => {
      mockAuthState = {
        user: null,
        profile: null,
        accountCompletionStep: null,
        password_set: null,
        loading: false,
        signOut: vi.fn(),
        refreshAuthState: vi.fn(),
        isAuthenticated: false,
      };

      render(<FindHostelPage />);

      expect(screen.getByPlaceholderText(/Hostel name, city, or Hostel ID…/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /Search/i })).toBeDefined();
      expect(screen.getByText(/Scan Hostel QR Code/i)).toBeDefined();
    });
  });

  describe('Scenario 6: Browser Back Navigation Preservation', () => {
    it('uses standard semantic links with valid href so browser history and back gestures are preserved', async () => {
      mockAuthState = {
        user: { id: 'student-123' },
        profile: { role: 'student', full_name: 'Alex Student' },
        accountCompletionStep: 'complete',
        password_set: true,
        loading: false,
        signOut: vi.fn(),
        refreshAuthState: vi.fn(),
        isAuthenticated: true,
      };

      render(<FindHostelPage />);

      await waitFor(() => {
        const breadcrumb = screen.getByRole('link', { name: /Back to Dashboard/i });
        // Must be a standard anchor with href for browser history stack compatibility
        expect(breadcrumb.tagName.toLowerCase()).toBe('a');
        expect(breadcrumb.getAttribute('href')).toBe('/student/dashboard');
      });
    });
  });

  describe('Scenario 7: Scoped Autofill for Dark Authentication Inputs', () => {
    it('renders AuthInput with the scoped auth-autofill-input class to prevent stark white browser autofill', () => {
      render(
        <AuthInput
          id="test-email"
          label="Email Address"
          type="email"
          required
        />
      );

      const input = screen.getByLabelText(/Email Address/i) as HTMLInputElement;
      expect(input.className).toContain('auth-autofill-input');
      expect(input.className).toContain('bg-[#032B28]');
    });

    it('defines scoped -webkit-autofill rules preserving deep teal and white text for auth cards in globals.css', () => {
      const globalsPath = path.join(process.cwd(), 'app/globals.css');
      const globalsCss = fs.readFileSync(globalsPath, 'utf-8');

      expect(globalsCss).toContain('.auth-autofill-input:-webkit-autofill');
      expect(globalsCss).toContain('-webkit-box-shadow: 0 0 0 1000px #032B28 inset !important;');
      expect(globalsCss).toContain('-webkit-text-fill-color: #ffffff !important;');

      // Confirms standard forms elsewhere still retain their respective light/dark rules
      expect(globalsCss).toContain('input:-webkit-autofill');
      expect(globalsCss).toContain('-webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;');
      expect(globalsCss).toContain('.dark input:-webkit-autofill');
      expect(globalsCss).toContain('-webkit-box-shadow: 0 0 0 1000px #122b3b inset !important;');
    });
  });
});
