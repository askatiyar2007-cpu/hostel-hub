import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock functions
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args)
    }
  })),
  supabaseServer: {
    from: (...args: unknown[]) => mockFrom(...args)
  }
}));

const { GET } = await import('./route');

describe('GET /api/meters/unmetered-rooms', () => {
  const mockUserId = '11111111-1111-4111-a111-111111111111';
  const mockHostelId = '22222222-2222-4222-a222-222222222222';
  const mockRoom1Id = '33333333-3333-4333-a333-333333333331';
  const mockRoom2Id = '33333333-3333-4333-a333-333333333332';
  const mockRoom3Id = '33333333-3333-4333-a333-333333333333';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockRequest(hostelId?: string): NextRequest {
    const url = hostelId
      ? `http://localhost:3000/api/meters/unmetered-rooms?hostel_id=${hostelId}`
      : 'http://localhost:3000/api/meters/unmetered-rooms';
    return new NextRequest(url, { method: 'GET' });
  }

  function mockAuth(userId: string | null) {
    mockGetUser.mockResolvedValue({
      data: { user: userId ? { id: userId, email: `${userId}@test.com` } : null },
      error: null
    });
  }

  function setupMocks(options: {
    role?: string;
    hostelOwnerId?: string;
    allRooms?: any[];
    activeMeters?: any[];
  } = {}) {
    const role = options.role ?? 'owner';
    const hostelOwnerId = options.hostelOwnerId ?? mockUserId;
    const allRooms = options.allRooms ?? [
      { id: mockRoom1Id, room_number: '101', floor: 1, room_type: 'double', capacity: 2, occupancy: 1, rent: 5000, status: 'available', hostel_id: mockHostelId },
      { id: mockRoom2Id, room_number: '102', floor: 1, room_type: 'single', capacity: 1, occupancy: 0, rent: 7000, status: 'available', hostel_id: mockHostelId },
      { id: mockRoom3Id, room_number: '103', floor: 1, room_type: 'triple', capacity: 3, occupancy: 2, rent: 4000, status: 'available', hostel_id: mockHostelId }
    ];
    const activeMeters = options.activeMeters ?? [
      { room_id: mockRoom2Id } // Room 102 already has an active meter
    ];

    mockAuth(mockUserId);

    const tables: Record<string, any> = {
      profiles: {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'prof-1', user_id: mockUserId, role },
          error: null
        })
      },
      hostels: {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: mockHostelId, owner_id: hostelOwnerId, name: 'Sunrise Hostel' },
          error: null
        })
      },
      rooms: {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: allRooms,
          error: null
        })
      },
      electricity_meters: {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((_col: string, _val: string) => {
          return {
            eq: vi.fn().mockResolvedValue({
              data: activeMeters,
              error: null
            })
          };
        })
      }
    };

    mockFrom.mockImplementation((table: string) => tables[table] || null);
  }

  it('should return 401 when not authenticated', async () => {
    mockAuth(null);
    const req = createMockRequest(mockHostelId);
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('should return 403 when user is not an owner', async () => {
    setupMocks({ role: 'student' });
    const req = createMockRequest(mockHostelId);
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('should return 403 when user does not own the hostel', async () => {
    setupMocks({ hostelOwnerId: 'other-owner-123' });
    const req = createMockRequest(mockHostelId);
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('should return 400 when hostel_id is missing', async () => {
    setupMocks();
    const req = createMockRequest();
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('should return only rooms that do NOT currently have an active electricity meter', async () => {
    setupMocks();
    const req = createMockRequest(mockHostelId);
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.total_count).toBe(2);
    expect(data.rooms.length).toBe(2);

    // Room 101 and 103 should be included
    const roomNumbers = data.rooms.map((r: any) => r.room_number);
    expect(roomNumbers).toContain('101');
    expect(roomNumbers).toContain('103');
    // Room 102 has an active meter so must NOT be included
    expect(roomNumbers).not.toContain('102');

    // Details should be preserved
    const room101 = data.rooms.find((r: any) => r.room_number === '101');
    expect(room101.floor).toBe(1);
    expect(room101.room_type).toBe('double');
    expect(room101.capacity).toBe(2);
    expect(room101.occupancy).toBe(1);
    expect(room101.rent).toBe(5000);
  });

  it('should return empty list when all rooms have active meters', async () => {
    setupMocks({
      activeMeters: [
        { room_id: mockRoom1Id },
        { room_id: mockRoom2Id },
        { room_id: mockRoom3Id }
      ]
    });
    const req = createMockRequest(mockHostelId);
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.total_count).toBe(0);
    expect(data.rooms).toEqual([]);
  });
});
