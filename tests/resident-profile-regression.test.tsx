import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocks
const mockPush = vi.fn();
const mockUseSearchParams = vi.fn(() => ({
  get: vi.fn().mockReturnValue(null),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useSearchParams: () => mockUseSearchParams(),
}));

const mockUser = { id: 'owner-uuid-123' };
vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({
    user: mockUser,
    profile: { id: 'owner-profile-123', role: 'hostel_owner' },
    loading: false,
  }),
}));

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    rpc: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import StudentProfilePage from '@/app/owner/students/[id]/page';

describe('StudentProfilePage Regression Tests (React Error #310 Guard)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ signedUrl: 'https://example.com/signed-photo.jpg' }),
    } as any);
  });

  it('renders loading state on initial mount without hook order violation', () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnValue(new Promise(() => {})), // Never resolves (stays loading)
    });

    render(<StudentProfilePage params={{ id: 'alloc-123' }} />);

    expect(screen.getByText('Resident Profile')).toBeDefined();
    expect(screen.getByText('Loading student database...')).toBeDefined();
  });

  it('renders error state when allocation is not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Allocation not found' } }),
    });

    render(<StudentProfilePage params={{ id: 'alloc-not-found' }} />);

    await waitFor(() => {
      expect(screen.getByText(/Allocation not found/i)).toBeDefined();
    });
  });

  it('renders successful resident profile transitioning from loading without error #310', async () => {
    const mockAlloc = {
      id: 'alloc-123',
      student_id: 'student-456',
      hostel_id: 'hostel-789',
      student_name: 'John Doe',
      student_email: 'john@example.com',
      student_phone: '9876543210',
      active: true,
      start_date: '2026-01-01',
      booking_type: 'entire_room',
      deposit_status: 'paid',
      hostels: {
        id: 'hostel-789',
        name: 'Grand Hostel',
        owner_id: 'owner-uuid-123',
      },
      rooms: {
        id: 'room-101',
        room_number: '101',
        rent: 8000,
        security_deposit: 16000,
      },
    };

    const mockStudent = {
      id: 'student-456',
      college: 'Test College',
      course: 'B.Tech',
      year: '3rd Year',
      profiles: {
        id: 'prof-456',
        user_id: 'user-456',
        full_name: 'John Doe',
        email: 'john@example.com',
        phone_number: '9876543210',
        gender: 'Male',
        date_of_birth: '2002-05-15',
      },
    };

    const mockFees = [
      { id: 'fee-1', amount: 8000, status: 'pending', due_date: '2026-10-01' },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'room_allocations') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockAlloc, error: null }),
        };
      }
      if (table === 'students') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockStudent, error: null }),
        };
      }
      if (table === 'room_requests') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === 'student_fees') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockFees, error: null }),
        };
      }
      if (table === 'student_electricity_charges') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: [{ charge_amount_paise: 50000 }], error: null }),
        };
      }
      if (table === 'complaints') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    render(<StudentProfilePage params={{ id: 'alloc-123' }} />);

    // Initially displays loading
    expect(screen.getByText('Loading student database...')).toBeDefined();

    // Successfully renders profile content without crashing
    await waitFor(() => {
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
      expect(screen.getByText(/Grand Hostel/)).toBeDefined();
      expect(screen.getByText('Active Resident')).toBeDefined();
      expect(screen.getByText('Personal Information')).toBeDefined();
      expect(screen.getByText('Financial Information')).toBeDefined();
    });
  });
});
