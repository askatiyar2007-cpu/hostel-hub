import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

// Mock modules before import
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn()
    }
  })),
  supabaseServer: {
    from: vi.fn()
  }
}));

import { createClient, supabaseServer } from '@/lib/supabase/server';

describe('GET /api/billing/overview', () => {
  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockHostelId = '550e8400-e29b-41d4-a716-446655440001';
  const mockMonth = '2024-08';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockRequest(searchParams: Record<string, string> = {}): NextRequest {
    const url = new URL('http://localhost:3000/api/billing/overview');
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new NextRequest(url);
  }

  function mockAuthSuccess() {
    const mockCreateClient = createClient as any;
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null
        })
      }
    });
  }

  function mockProfileOwner() {
    const mockFrom = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'profile-1', role: 'owner', user_id: mockUserId },
      error: null
    });

    (supabaseServer.from as any).mockImplementation(() => ({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      single: vi.fn()
    }));

    return { mockFrom, mockSelect, mockEq, mockMaybeSingle };
  }

  function mockHostelOwnership(ownerId: string = mockUserId) {
    const mockFrom = vi.fn();
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: mockHostelId, owner_id: ownerId },
      error: null
    });

    let callCount = 0;
    (supabaseServer.from as any).mockImplementation((_table: string) => {
      callCount++;
      // First call: profiles (owner verification)
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'profile-1', role: 'owner', user_id: mockUserId },
            error: null
          })
        };
      }
      // Second call: hostels (ownership verification)
      if (callCount === 2) {
        return {
          select: mockSelect,
          eq: mockEq,
          single: mockSingle
        };
      }
      // Third call: rooms (billing data)
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      };
    });

    return { mockFrom, mockSelect, mockEq, mockSingle };
  }

  function mockBillingData(rooms: any[]) {
    let callCount = 0;
    (supabaseServer.from as any).mockImplementation((_table: string) => {
      callCount++;
      // First call: profiles
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'profile-1', role: 'owner', user_id: mockUserId },
            error: null
          })
        };
      }
      // Second call: hostels
      if (callCount === 2) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: mockHostelId, owner_id: mockUserId },
            error: null
          })
        };
      }
      // Third call: rooms
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: rooms,
          error: null
        })
      };
    });
  }

  it('should return 401 if user is not authenticated', async () => {
    const mockCreateClient = createClient as any;
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('Not authenticated')
        })
      }
    });

    const req = createMockRequest({ hostel_id: mockHostelId, month: mockMonth });
    const response = await GET(req);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 if user is not an owner', async () => {
    mockAuthSuccess();

    (supabaseServer.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'profile-1', role: 'student', user_id: mockUserId },
        error: null
      })
    });

    const req = createMockRequest({ hostel_id: mockHostelId, month: mockMonth });
    const response = await GET(req);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Only hostel owners');
  });

  it('should return 400 if hostel_id is missing', async () => {
    mockAuthSuccess();
    mockProfileOwner();

    const req = createMockRequest({ month: mockMonth });
    const response = await GET(req);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('hostel_id');
  });

  it('should return 400 if month is missing', async () => {
    mockAuthSuccess();
    mockProfileOwner();

    const req = createMockRequest({ hostel_id: mockHostelId });
    const response = await GET(req);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('month');
  });

  it('should return 400 if month format is invalid', async () => {
    mockAuthSuccess();
    mockProfileOwner();

    const req = createMockRequest({ hostel_id: mockHostelId, month: 'invalid-month' });
    const response = await GET(req);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid query parameters');
  });

  it('should return 403 if user does not own the hostel', async () => {
    mockAuthSuccess();
    mockHostelOwnership('different-user-id');

    const req = createMockRequest({ hostel_id: mockHostelId, month: mockMonth });
    const response = await GET(req);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('only view billing overview for your own hostels');
  });

  it('should return 404 if hostel does not exist', async () => {
    mockAuthSuccess();

    let callCount = 0;
    (supabaseServer.from as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'profile-1', role: 'owner', user_id: mockUserId },
            error: null
          })
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Hostel not found' }
        })
      };
    });

    const req = createMockRequest({ hostel_id: mockHostelId, month: mockMonth });
    const response = await GET(req);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Hostel not found');
  });

  it('should return billing overview with room aggregations', async () => {
    mockAuthSuccess();

    const mockRooms = [
      {
        id: 'room-1',
        room_number: '101',
        billing_segments: [
          {
            id: 'seg-1',
            consumption_units: '100.50',
            total_cost_paise: 85000,
            segment_type: 'occupied'
          },
          {
            id: 'seg-2',
            consumption_units: '50.25',
            total_cost_paise: 42500,
            segment_type: 'occupied'
          }
        ]
      },
      {
        id: 'room-2',
        room_number: '102',
        billing_segments: [
          {
            id: 'seg-3',
            consumption_units: '75.00',
            total_cost_paise: 0,
            segment_type: 'empty'
          }
        ]
      }
    ];

    mockBillingData(mockRooms);

    const req = createMockRequest({ hostel_id: mockHostelId, month: mockMonth });
    const response = await GET(req);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.hostel_id).toBe(mockHostelId);
    expect(data.billing_month).toBe(mockMonth);
    expect(data.rooms).toHaveLength(2);

    // Check Room 101
    const room1 = data.rooms.find((r: any) => r.room_number === '101');
    expect(room1.segments_count).toBe(2);
    expect(room1.total_consumption).toBe(150.75);
    expect(room1.total_revenue_paise).toBe(127500);
    expect(room1.total_revenue_rupees).toBe(1275);
    expect(room1.empty_room_consumption).toBe(0);

    // Check Room 102 (empty)
    const room2 = data.rooms.find((r: any) => r.room_number === '102');
    expect(room2.segments_count).toBe(1);
    expect(room2.total_consumption).toBe(75);
    expect(room2.total_revenue_paise).toBe(0);
    expect(room2.empty_room_consumption).toBe(75);

    // Check summary
    expect(data.summary.total_consumption_all).toBe(225.75);
    expect(data.summary.total_consumption_occupied).toBe(150.75);
    expect(data.summary.total_consumption_empty).toBe(75);
    expect(data.summary.total_revenue_paise).toBe(127500);
    expect(data.summary.total_revenue_rupees).toBe(1275);
  });

  it('should return empty rooms array if no billing data exists', async () => {
    mockAuthSuccess();
    mockBillingData([]);

    const req = createMockRequest({ hostel_id: mockHostelId, month: mockMonth });
    const response = await GET(req);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.rooms).toHaveLength(0);
    expect(data.summary.total_consumption_all).toBe(0);
    expect(data.summary.total_revenue_paise).toBe(0);
  });

  it('should handle database errors gracefully', async () => {
    mockAuthSuccess();

    let callCount = 0;
    (supabaseServer.from as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'profile-1', role: 'owner', user_id: mockUserId },
            error: null
          })
        };
      }
      if (callCount === 2) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: mockHostelId, owner_id: mockUserId },
            error: null
          })
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      };
    });

    const req = createMockRequest({ hostel_id: mockHostelId, month: mockMonth });
    const response = await GET(req);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('Failed to fetch billing data');
  });
});
