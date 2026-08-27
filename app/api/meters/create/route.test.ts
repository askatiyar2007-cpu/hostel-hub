import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Create mock functions
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

// Mock modules before import
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

// Import after mocking
const { POST } = await import('./route');

describe('POST /api/meters/create', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Helper to create a mock NextRequest
   */
  function createMockRequest(body: any): NextRequest {
    const url = 'http://localhost:3000/api/meters/create';
    return new NextRequest(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Helper to setup authentication mock
   */
  function mockAuth(userId: string | null, authError: Error | null = null) {
    const authResult = authError
      ? { data: { user: null }, error: authError }
      : { data: { user: userId ? { id: userId, email: `${userId}@test.com` } : null }, error: null };

    mockGetUser.mockResolvedValue(authResult);
  }

  /**
   * Helper to setup profile mock
   */
  function mockProfile(userId: string, role: string = 'owner') {
    const profileChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: userId, role, user_id: userId },
        error: null
      })
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return profileChain;
      }
      return null;
    });
  }

  /**
   * Helper to setup full successful flow mocks
   */
  function mockSuccessfulFlow(
    userId: string,
    hostelId: string,
    roomId: string,
    meterId: string,
    readingId: string
  ) {
    mockAuth(userId);
    
    const tables: Record<string, any> = {
      profiles: {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: userId, role: 'owner', user_id: userId },
          error: null
        })
      },
      hostels: {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: hostelId, owner_id: userId, name: 'Test Hostel' },
          error: null
        })
      },
      rooms: {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: roomId, hostel_id: hostelId, room_number: '101' },
          error: null
        })
      },
      electricity_meters: {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null, // No existing meter
          error: null
        }),
        insert: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis()
      },
      meter_readings: {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis()
      }
    };

    // Setup electricity_meters insert/select chain
    tables.electricity_meters.insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: meterId, meter_number: 'M001' },
          error: null
        })
      })
    });

    // Setup meter_readings insert/select chain
    tables.meter_readings.insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: readingId },
          error: null
        })
      })
    });

    mockFrom.mockImplementation((table: string) => tables[table] || null);
  }

  describe('Authentication & Authorization', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockAuth(null);

      const req = createMockRequest({
        hostel_id: '550e8400-e29b-41d4-a716-446655440000',
        room_id: '550e8400-e29b-41d4-a716-446655440001',
        meter_number: 'M001',
        initial_reading: 100
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when profile is not found', async () => {
      const userId = 'user-123';
      mockAuth(userId);

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null
            })
          };
        }
        return null;
      });

      const req = createMockRequest({
        hostel_id: '550e8400-e29b-41d4-a716-446655440000',
        room_id: '550e8400-e29b-41d4-a716-446655440001',
        meter_number: 'M001',
        initial_reading: 100
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('profile not found');
    });

    it('should return 403 when user role is not owner', async () => {
      const userId = 'user-123';
      mockAuth(userId);

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: userId, role: 'student', user_id: userId },
              error: null
            })
          };
        }
        return null;
      });

      const req = createMockRequest({
        hostel_id: '550e8400-e29b-41d4-a716-446655440000',
        room_id: '550e8400-e29b-41d4-a716-446655440001',
        meter_number: 'M001',
        initial_reading: 100
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Only hostel owners can create meters');
    });
  });

  describe('Request Validation', () => {
    it('should reject invalid hostel_id format', async () => {
      const userId = 'user-123';
      mockAuth(userId);
      mockProfile(userId);

      const req = createMockRequest({
        hostel_id: 'invalid-uuid',
        room_id: '550e8400-e29b-41d4-a716-446655440000',
        meter_number: 'M001',
        initial_reading: 100
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
      expect(data.details).toBeDefined();
    });

    it('should reject invalid room_id format', async () => {
      const userId = 'user-123';
      mockAuth(userId);
      mockProfile(userId);

      const req = createMockRequest({
        hostel_id: '550e8400-e29b-41d4-a716-446655440000',
        room_id: 'not-a-uuid',
        meter_number: 'M001',
        initial_reading: 100
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
    });

    it('should reject empty meter_number', async () => {
      const userId = 'user-123';
      mockAuth(userId);
      mockProfile(userId);

      const req = createMockRequest({
        hostel_id: '550e8400-e29b-41d4-a716-446655440000',
        room_id: '550e8400-e29b-41d4-a716-446655440001',
        meter_number: '',
        initial_reading: 100
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
    });

    it('should reject negative initial_reading', async () => {
      const userId = 'user-123';
      mockAuth(userId);
      mockProfile(userId);

      const req = createMockRequest({
        hostel_id: '550e8400-e29b-41d4-a716-446655440000',
        room_id: '550e8400-e29b-41d4-a716-446655440001',
        meter_number: 'M001',
        initial_reading: -50
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
    });
  });

  describe('Hostel Ownership Validation (REQ-1.3)', () => {
    it('should return 404 when hostel does not exist', async () => {
      const userId = 'user-123';
      mockAuth(userId);

      const tables: Record<string, any> = {
        profiles: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: userId, role: 'owner', user_id: userId },
            error: null
          })
        },
        hostels: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Hostel not found' }
          })
        }
      };

      mockFrom.mockImplementation((table: string) => tables[table] || null);

      const req = createMockRequest({
        hostel_id: '550e8400-e29b-41d4-a716-446655440000',
        room_id: '550e8400-e29b-41d4-a716-446655440001',
        meter_number: 'M001',
        initial_reading: 100
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Hostel not found');
    });

    it('should return 403 when user does not own the hostel', async () => {
      const userId = 'user-123';
      const otherUserId = 'other-user-456';
      mockAuth(userId);

      const tables: Record<string, any> = {
        profiles: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: userId, role: 'owner', user_id: userId },
            error: null
          })
        },
        hostels: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: '550e8400-e29b-41d4-a716-446655440000', owner_id: otherUserId, name: 'Other Hostel' },
            error: null
          })
        }
      };

      mockFrom.mockImplementation((table: string) => tables[table] || null);

      const req = createMockRequest({
        hostel_id: '550e8400-e29b-41d4-a716-446655440000',
        room_id: '550e8400-e29b-41d4-a716-446655440001',
        meter_number: 'M001',
        initial_reading: 100
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('You do not own this hostel');
    });
  });

  describe('Room Validation (REQ-1.3)', () => {
    it('should return 404 when room does not exist', async () => {
      const userId = 'user-123';
      const hostelId = '550e8400-e29b-41d4-a716-446655440000';
      mockAuth(userId);

      const tables: Record<string, any> = {
        profiles: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: userId, role: 'owner', user_id: userId },
            error: null
          })
        },
        hostels: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: hostelId, owner_id: userId, name: 'Test Hostel' },
            error: null
          })
        },
        rooms: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Room not found' }
          })
        }
      };

      mockFrom.mockImplementation((table: string) => tables[table] || null);

      const req = createMockRequest({
        hostel_id: hostelId,
        room_id: '550e8400-e29b-41d4-a716-446655440001',
        meter_number: 'M001',
        initial_reading: 100
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Room not found');
    });

    it('should return 400 when room does not belong to hostel', async () => {
      const userId = 'user-123';
      const hostelId = '550e8400-e29b-41d4-a716-446655440000';
      const roomId = '550e8400-e29b-41d4-a716-446655440001';
      const otherHostelId = '550e8400-e29b-41d4-a716-446655440002';
      mockAuth(userId);

      const tables: Record<string, any> = {
        profiles: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: userId, role: 'owner', user_id: userId },
            error: null
          })
        },
        hostels: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: hostelId, owner_id: userId, name: 'Test Hostel' },
            error: null
          })
        },
        rooms: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: roomId, hostel_id: otherHostelId, room_number: '101' },
            error: null
          })
        }
      };

      mockFrom.mockImplementation((table: string) => tables[table] || null);

      const req = createMockRequest({
        hostel_id: hostelId,
        room_id: roomId,
        meter_number: 'M001',
        initial_reading: 100
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Room does not belong to this hostel');
    });
  });

  describe('Duplicate Meter Check (REQ-1.2)', () => {
    it('should return 409 when room already has an active meter', async () => {
      const userId = 'user-123';
      const hostelId = '550e8400-e29b-41d4-a716-446655440000';
      const roomId = '550e8400-e29b-41d4-a716-446655440001';
      mockAuth(userId);

      const tables: Record<string, any> = {
        profiles: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: userId, role: 'owner', user_id: userId },
            error: null
          })
        },
        hostels: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: hostelId, owner_id: userId, name: 'Test Hostel' },
            error: null
          })
        },
        rooms: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: roomId, hostel_id: hostelId, room_number: '101' },
            error: null
          })
        },
        electricity_meters: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'existing-meter-123', meter_number: 'M999' },
            error: null
          })
        }
      };

      mockFrom.mockImplementation((table: string) => tables[table] || null);

      const req = createMockRequest({
        hostel_id: hostelId,
        room_id: roomId,
        meter_number: 'M001',
        initial_reading: 100
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('Room already has an active meter');
      expect(data.existing_meter_id).toBe('existing-meter-123');
    });
  });

  describe('Successful Meter Creation', () => {
    it('should create meter with initial reading successfully (REQ-1.1, REQ-4.5)', async () => {
      const userId = 'user-123';
      const hostelId = '550e8400-e29b-41d4-a716-446655440000';
      const roomId = '550e8400-e29b-41d4-a716-446655440001';
      const meterId = '550e8400-e29b-41d4-a716-446655440002';
      const readingId = '550e8400-e29b-41d4-a716-446655440003';

      mockSuccessfulFlow(userId, hostelId, roomId, meterId, readingId);

      const req = createMockRequest({
        hostel_id: hostelId,
        room_id: roomId,
        meter_number: 'M001',
        initial_reading: 100,
        notes: 'Test meter'
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.meter_id).toBe(meterId);
      expect(data.reading_id).toBe(readingId);
      expect(data.message).toContain('M001');
      expect(data.message).toContain('100 units');
    });

    it('should create meter with zero initial reading', async () => {
      const userId = 'user-123';
      const hostelId = '550e8400-e29b-41d4-a716-446655440000';
      const roomId = '550e8400-e29b-41d4-a716-446655440001';
      const meterId = '550e8400-e29b-41d4-a716-446655440002';
      const readingId = '550e8400-e29b-41d4-a716-446655440003';

      mockSuccessfulFlow(userId, hostelId, roomId, meterId, readingId);

      const req = createMockRequest({
        hostel_id: hostelId,
        room_id: roomId,
        meter_number: 'M001',
        initial_reading: 0
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.meter_id).toBe(meterId);
      expect(data.reading_id).toBe(readingId);
    });

    it('should create meter without optional notes', async () => {
      const userId = 'user-123';
      const hostelId = '550e8400-e29b-41d4-a716-446655440000';
      const roomId = '550e8400-e29b-41d4-a716-446655440001';
      const meterId = '550e8400-e29b-41d4-a716-446655440002';
      const readingId = '550e8400-e29b-41d4-a716-446655440003';

      mockSuccessfulFlow(userId, hostelId, roomId, meterId, readingId);

      const req = createMockRequest({
        hostel_id: hostelId,
        room_id: roomId,
        meter_number: 'M001',
        initial_reading: 250.5
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.meter_id).toBe(meterId);
      expect(data.reading_id).toBe(readingId);
    });
  });

  describe('Error Handling', () => {
    it('should rollback meter creation if initial reading fails', async () => {
      const userId = 'user-123';
      const hostelId = '550e8400-e29b-41d4-a716-446655440000';
      const roomId = '550e8400-e29b-41d4-a716-446655440001';
      const meterId = '550e8400-e29b-41d4-a716-446655440002';
      
      mockAuth(userId);

      const deleteMock = vi.fn().mockReturnThis();
      const deleteEqMock = vi.fn().mockResolvedValue({ data: null, error: null });

      const tables: Record<string, any> = {
        profiles: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: userId, role: 'owner', user_id: userId },
            error: null
          })
        },
        hostels: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: hostelId, owner_id: userId, name: 'Test Hostel' },
            error: null
          })
        },
        rooms: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: roomId, hostel_id: hostelId, room_number: '101' },
            error: null
          })
        },
        electricity_meters: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: meterId, meter_number: 'M001' },
                error: null
              })
            })
          }),
          delete: vi.fn(() => {
            deleteMock();
            return {
              eq: deleteEqMock
            };
          })
        },
        meter_readings: {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Reading insert failed' }
              })
            })
          })
        }
      };

      mockFrom.mockImplementation((table: string) => tables[table] || null);

      const req = createMockRequest({
        hostel_id: hostelId,
        room_id: roomId,
        meter_number: 'M001',
        initial_reading: 100
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to record initial reading');
      
      // Verify rollback was attempted
      expect(deleteMock).toHaveBeenCalled();
    });
  });
});
