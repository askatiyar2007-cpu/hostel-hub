import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock functions
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args)
    }
  })),
  supabaseServer: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args)
  }
}));

const { POST } = await import('./route');

describe('POST /api/meters/bulk-create', () => {
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

  function createMockRequest(body: any): NextRequest {
    return new NextRequest('http://localhost:3000/api/meters/bulk-create', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    });
  }

  function mockAuth(userId: string | null) {
    mockGetUser.mockResolvedValue({
      data: { user: userId ? { id: userId, email: `${userId}@test.com` } : null },
      error: null
    });
  }

  function setupDefaultMocks(overrides: {
    role?: string;
    hostelOwnerId?: string;
    rooms?: any[];
    existingActiveMeters?: any[];
    existingHostelMeters?: any[];
    rpcData?: any;
    rpcError?: any;
  } = {}) {
    const role = overrides.role ?? 'owner';
    const hostelOwnerId = overrides.hostelOwnerId ?? mockUserId;
    const rooms = overrides.rooms ?? [
      { id: mockRoom1Id, hostel_id: mockHostelId, room_number: '101' },
      { id: mockRoom2Id, hostel_id: mockHostelId, room_number: '102' },
      { id: mockRoom3Id, hostel_id: mockHostelId, room_number: '103' }
    ];
    const existingActiveMeters = overrides.existingActiveMeters ?? [];
    const existingHostelMeters = overrides.existingHostelMeters ?? [];

    mockAuth(mockUserId);

    const meterReadingsInsertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'r-1' }, error: null })
      })
    });

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
        in: vi.fn().mockResolvedValue({
          data: rooms,
          error: null
        })
      },
      electricity_meters: {
        select: vi.fn().mockImplementation((_cols: string) => {
          return {
            in: vi.fn().mockImplementation((_field: string, _values: any[]) => {
              return {
                eq: vi.fn().mockImplementation((_statusField: string, _statusVal: string) => {
                  return Promise.resolve({
                    data: existingActiveMeters,
                    error: null
                  });
                })
              };
            }),
            eq: vi.fn().mockImplementation((_hostelField: string, _hostelVal: string) => {
              return {
                in: vi.fn().mockImplementation((_mNumField: string, _mNums: string[]) => {
                  return Promise.resolve({
                    data: existingHostelMeters,
                    error: null
                  });
                })
              };
            })
          };
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [
              { id: 'm-1', meter_number: 'M-101', room_id: mockRoom1Id },
              { id: 'm-2', meter_number: 'M-102', room_id: mockRoom2Id }
            ],
            error: null
          })
        })
      },
      meter_readings: {
        insert: meterReadingsInsertSpy
      }
    };

    mockFrom.mockImplementation((table: string) => tables[table] || null);

    if (overrides.rpcData !== undefined || overrides.rpcError !== undefined) {
      mockRpc.mockResolvedValue({
        data: overrides.rpcData ?? null,
        error: overrides.rpcError ?? null
      });
    } else {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          message: 'Created 2 meters successfully',
          meters_created: 2,
          meters: [
            { meter_id: 'm-1', meter_number: 'M-101', room_id: mockRoom1Id, room_number: '101' },
            { meter_id: 'm-2', meter_number: 'M-102', room_id: mockRoom2Id, room_number: '102' }
          ]
        },
        error: null
      });
    }

    return { meterReadingsInsertSpy };
  }

  describe('Authentication & Authorization', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockAuth(null);

      const req = createMockRequest({
        hostel_id: mockHostelId,
        meters: [{ room_id: mockRoom1Id, meter_number: 'M-101' }]
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user role is not owner', async () => {
      setupDefaultMocks({ role: 'student' });

      const req = createMockRequest({
        hostel_id: mockHostelId,
        meters: [{ room_id: mockRoom1Id, meter_number: 'M-101' }]
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toContain('Only hostel owners can create meters');
    });

    it('should return 403 when user does not own the hostel', async () => {
      setupDefaultMocks({ hostelOwnerId: 'other-user-999' });

      const req = createMockRequest({
        hostel_id: mockHostelId,
        meters: [{ room_id: mockRoom1Id, meter_number: 'M-101' }]
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toContain('You do not own this hostel');
    });
  });

  describe('Request Payload Validation', () => {
    it('should reject invalid hostel_id format', async () => {
      setupDefaultMocks();

      const req = createMockRequest({
        hostel_id: 'not-a-valid-uuid',
        meters: [{ room_id: mockRoom1Id, meter_number: 'M-101' }]
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
    });

    it('should reject empty meters array', async () => {
      setupDefaultMocks();

      const req = createMockRequest({
        hostel_id: mockHostelId,
        meters: []
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
    });

    it('should reject empty meter_number', async () => {
      setupDefaultMocks();

      const req = createMockRequest({
        hostel_id: mockHostelId,
        meters: [{ room_id: mockRoom1Id, meter_number: '   ' }]
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
    });
  });

  describe('Duplicate Validation (Intra-batch & Database)', () => {
    it('should reject duplicate room selections in the same batch', async () => {
      setupDefaultMocks();

      const req = createMockRequest({
        hostel_id: mockHostelId,
        meters: [
          { room_id: mockRoom1Id, meter_number: 'M-101' },
          { room_id: mockRoom1Id, meter_number: 'M-102' }
        ]
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('Duplicate room selections in batch');
    });

    it('should reject duplicate meter numbers in the same batch (case-insensitive)', async () => {
      setupDefaultMocks();

      const req = createMockRequest({
        hostel_id: mockHostelId,
        meters: [
          { room_id: mockRoom1Id, meter_number: 'M-101' },
          { room_id: mockRoom2Id, meter_number: 'm-101' }
        ]
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('Duplicate meter numbers in batch');
    });

    it('should reject when a room already has an active meter in database', async () => {
      setupDefaultMocks({
        existingActiveMeters: [
          { id: 'exist-m-1', room_id: mockRoom1Id, meter_number: 'M-OLD-1' }
        ]
      });

      const req = createMockRequest({
        hostel_id: mockHostelId,
        meters: [
          { room_id: mockRoom1Id, meter_number: 'M-101' },
          { room_id: mockRoom2Id, meter_number: 'M-102' }
        ]
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error).toContain('already has an active meter');
      expect(data.error).toContain('Room 101');
    });

    it('should reject when a meter number already exists in this hostel in database', async () => {
      setupDefaultMocks({
        existingHostelMeters: [
          { id: 'exist-m-9', meter_number: 'M-101' }
        ]
      });

      const req = createMockRequest({
        hostel_id: mockHostelId,
        meters: [
          { room_id: mockRoom1Id, meter_number: 'M-101' },
          { room_id: mockRoom2Id, meter_number: 'M-102' }
        ]
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error).toContain('Meter number already exists in this hostel');
      expect(data.error).toContain('M-101');
    });
  });

  describe('Room Ownership & Existence Validation', () => {
    it('should reject when a room does not exist', async () => {
      setupDefaultMocks({
        rooms: [
          { id: mockRoom1Id, hostel_id: mockHostelId, room_number: '101' }
          // Room 2 missing
        ]
      });

      const req = createMockRequest({
        hostel_id: mockHostelId,
        meters: [
          { room_id: mockRoom1Id, meter_number: 'M-101' },
          { room_id: mockRoom2Id, meter_number: 'M-102' }
        ]
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('should reject when a room belongs to a different hostel', async () => {
      setupDefaultMocks({
        rooms: [
          { id: mockRoom1Id, hostel_id: mockHostelId, room_number: '101' },
          { id: mockRoom2Id, hostel_id: 'other-hostel-999', room_number: '102' }
        ]
      });

      const req = createMockRequest({
        hostel_id: mockHostelId,
        meters: [
          { room_id: mockRoom1Id, meter_number: 'M-101' },
          { room_id: mockRoom2Id, meter_number: 'M-102' }
        ]
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('does not belong to this hostel');
    });
  });

  describe('Atomic Execution & Never Create Readings Rule', () => {
    it('should successfully create multiple meters atomically via RPC', async () => {
      const { meterReadingsInsertSpy } = setupDefaultMocks({
        rpcData: {
          success: true,
          message: 'Created 2 meters successfully',
          meters_created: 2,
          meters: [
            { meter_id: 'm-1', meter_number: 'M-101', room_id: mockRoom1Id, room_number: '101' },
            { meter_id: 'm-2', meter_number: 'M-102', room_id: mockRoom2Id, room_number: '102' }
          ]
        }
      });

      const req = createMockRequest({
        hostel_id: mockHostelId,
        meters: [
          { room_id: mockRoom1Id, meter_number: 'M-101', notes: 'First floor' },
          { room_id: mockRoom2Id, meter_number: 'M-102' }
        ]
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.meters_created).toBe(2);
      expect(data.meters.length).toBe(2);

      // CRITICAL RULE: Never create electricity readings during meter creation
      expect(meterReadingsInsertSpy).not.toHaveBeenCalled();
    });

    it('should handle RPC failure and confirm atomic rejection', async () => {
      const { meterReadingsInsertSpy } = setupDefaultMocks({
        rpcData: {
          success: false,
          message: 'Room 101 already has an active meter',
          detail: 'Unique constraint violated'
        }
      });

      const req = createMockRequest({
        hostel_id: mockHostelId,
        meters: [
          { room_id: mockRoom1Id, meter_number: 'M-101' },
          { room_id: mockRoom2Id, meter_number: 'M-102' }
        ]
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('Room 101 already has an active meter');
      expect(meterReadingsInsertSpy).not.toHaveBeenCalled();
    });

    it('should fallback to atomic multi-row insert when RPC is not deployed', async () => {
      const { meterReadingsInsertSpy } = setupDefaultMocks({
        rpcError: { code: 'PGRST202', message: 'Could not find the function bulk_create_meters' }
      });

      const req = createMockRequest({
        hostel_id: mockHostelId,
        meters: [
          { room_id: mockRoom1Id, meter_number: 'M-101' },
          { room_id: mockRoom2Id, meter_number: 'M-102' }
        ]
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.meters_created).toBe(2);

      // CRITICAL RULE: Never create electricity readings during meter creation
      expect(meterReadingsInsertSpy).not.toHaveBeenCalled();
    });
  });
});
