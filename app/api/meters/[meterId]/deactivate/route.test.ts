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

describe('POST /api/meters/:meterId/deactivate', () => {
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
  function createMockRequest(body: any, meterId: string): NextRequest {
    const url = `http://localhost:3000/api/meters/${meterId}/deactivate`;
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
   * Helper to setup full successful flow mocks
   */
  function mockSuccessfulFlow(
    userId: string,
    hostelId: string,
    meterId: string,
    hasOpenSegments: boolean = false,
    meterStatus: string = 'active'
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
      electricity_meters: {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: meterId,
            hostel_id: hostelId,
            room_id: 'room-123',
            meter_number: 'M001',
            status: meterStatus
          },
          error: null
        }),
        update: vi.fn().mockReturnThis()
      },
      hostels: {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: hostelId, owner_id: userId, name: 'Test Hostel' },
          error: null
        })
      },
      billing_segments: {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({
          data: hasOpenSegments ? [{ id: 'segment-123' }] : [],
          error: null
        })
      }
    };

    // Setup update chain for electricity_meters
    if (!hasOpenSegments && meterStatus === 'active') {
      tables.electricity_meters.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: { id: meterId },
          error: null
        })
      });
    }

    mockFrom.mockImplementation((table: string) => tables[table] || null);
  }

  describe('Authentication & Authorization', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockAuth(null);

      const meterId = '550e8400-e29b-41d4-a716-446655440000';
      const req = createMockRequest({ notes: 'Deactivating meter' }, meterId);
      const response = await POST(req, { params: { meterId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when profile is not found', async () => {
      const userId = 'user-123';
      const meterId = '550e8400-e29b-41d4-a716-446655440000';
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

      const req = createMockRequest({ notes: 'Test' }, meterId);
      const response = await POST(req, { params: { meterId } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('profile not found');
    });

    it('should return 403 when user role is not owner', async () => {
      const userId = 'user-123';
      const meterId = '550e8400-e29b-41d4-a716-446655440000';
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

      const req = createMockRequest({}, meterId);
      const response = await POST(req, { params: { meterId } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Only hostel owners can deactivate meters');
    });
  });

  describe('Meter Validation', () => {
    it('should return 400 when meterId is invalid', async () => {
      const userId = 'user-123';
      const meterId = '';
      mockAuth(userId);

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: userId, role: 'owner', user_id: userId },
              error: null
            })
          };
        }
        return null;
      });

      const req = createMockRequest({}, meterId);
      const response = await POST(req, { params: { meterId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid meter ID');
    });

    it('should return 404 when meter does not exist', async () => {
      const userId = 'user-123';
      const meterId = '550e8400-e29b-41d4-a716-446655440000';
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
        electricity_meters: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Meter not found' }
          })
        }
      };

      mockFrom.mockImplementation((table: string) => tables[table] || null);

      const req = createMockRequest({}, meterId);
      const response = await POST(req, { params: { meterId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Meter not found');
    });
  });

  describe('Hostel Ownership Validation', () => {
    it('should return 404 when hostel does not exist', async () => {
      const userId = 'user-123';
      const hostelId = '550e8400-e29b-41d4-a716-446655440001';
      const meterId = '550e8400-e29b-41d4-a716-446655440000';
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
        electricity_meters: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: meterId,
              hostel_id: hostelId,
              room_id: 'room-123',
              meter_number: 'M001',
              status: 'active'
            },
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

      const req = createMockRequest({}, meterId);
      const response = await POST(req, { params: { meterId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Hostel not found');
    });

    it('should return 403 when user does not own the hostel', async () => {
      const userId = 'user-123';
      const otherUserId = 'other-user-456';
      const hostelId = '550e8400-e29b-41d4-a716-446655440001';
      const meterId = '550e8400-e29b-41d4-a716-446655440000';
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
        electricity_meters: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: meterId,
              hostel_id: hostelId,
              room_id: 'room-123',
              meter_number: 'M001',
              status: 'active'
            },
            error: null
          })
        },
        hostels: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: hostelId, owner_id: otherUserId, name: 'Other Hostel' },
            error: null
          })
        }
      };

      mockFrom.mockImplementation((table: string) => tables[table] || null);

      const req = createMockRequest({}, meterId);
      const response = await POST(req, { params: { meterId } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('You do not own this hostel');
    });
  });

  describe('Meter Status Validation', () => {
    it('should return 400 when meter is already inactive', async () => {
      const userId = 'user-123';
      const hostelId = '550e8400-e29b-41d4-a716-446655440001';
      const meterId = '550e8400-e29b-41d4-a716-446655440000';

      mockSuccessfulFlow(userId, hostelId, meterId, false, 'inactive');

      const req = createMockRequest({}, meterId);
      const response = await POST(req, { params: { meterId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Meter is already inactive');
    });
  });

  describe('Open Billing Segments Check (REQ-23.1)', () => {
    it('should return 409 when meter has open billing segments', async () => {
      const userId = 'user-123';
      const hostelId = '550e8400-e29b-41d4-a716-446655440001';
      const meterId = '550e8400-e29b-41d4-a716-446655440000';

      mockSuccessfulFlow(userId, hostelId, meterId, true, 'active');

      const req = createMockRequest({}, meterId);
      const response = await POST(req, { params: { meterId } });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('Cannot deactivate meter with open billing segments');
      expect(data.message).toContain('close all open billing segments');
      expect(data.open_segment_count).toBe(1);
    });

    it('should handle error when checking open segments', async () => {
      const userId = 'user-123';
      const hostelId = '550e8400-e29b-41d4-a716-446655440001';
      const meterId = '550e8400-e29b-41d4-a716-446655440000';
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
        electricity_meters: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: meterId,
              hostel_id: hostelId,
              room_id: 'room-123',
              meter_number: 'M001',
              status: 'active'
            },
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
        billing_segments: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error checking segments' }
          })
        }
      };

      mockFrom.mockImplementation((table: string) => tables[table] || null);

      const req = createMockRequest({}, meterId);
      const response = await POST(req, { params: { meterId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to check for open billing segments');
    });
  });

  describe('Successful Meter Deactivation (REQ-23.2)', () => {
    it('should deactivate meter successfully with notes', async () => {
      const userId = 'user-123';
      const hostelId = '550e8400-e29b-41d4-a716-446655440001';
      const meterId = '550e8400-e29b-41d4-a716-446655440000';

      mockSuccessfulFlow(userId, hostelId, meterId, false, 'active');

      const req = createMockRequest({ notes: 'Meter replaced due to malfunction' }, meterId);
      const response = await POST(req, { params: { meterId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('M001 has been deactivated');
      expect(data.message).toContain('historical data has been preserved');
    });

    it('should deactivate meter successfully without notes', async () => {
      const userId = 'user-123';
      const hostelId = '550e8400-e29b-41d4-a716-446655440001';
      const meterId = '550e8400-e29b-41d4-a716-446655440000';

      mockSuccessfulFlow(userId, hostelId, meterId, false, 'active');

      const req = createMockRequest({}, meterId);
      const response = await POST(req, { params: { meterId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('deactivated');
    });

    it('should deactivate meter when no open segments exist', async () => {
      const userId = 'user-123';
      const hostelId = '550e8400-e29b-41d4-a716-446655440001';
      const meterId = '550e8400-e29b-41d4-a716-446655440000';
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
        electricity_meters: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: meterId,
              hostel_id: hostelId,
              room_id: 'room-123',
              meter_number: 'M001',
              status: 'active'
            },
            error: null
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: { id: meterId },
              error: null
            })
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
        billing_segments: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockResolvedValue({
            data: [], // Empty array = no open segments
            error: null
          })
        }
      };

      mockFrom.mockImplementation((table: string) => tables[table] || null);

      const req = createMockRequest({}, meterId);
      const response = await POST(req, { params: { meterId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database error during deactivation', async () => {
      const userId = 'user-123';
      const hostelId = '550e8400-e29b-41d4-a716-446655440001';
      const meterId = '550e8400-e29b-41d4-a716-446655440000';
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
        electricity_meters: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: meterId,
              hostel_id: hostelId,
              room_id: 'room-123',
              meter_number: 'M001',
              status: 'active'
            },
            error: null
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database update failed' }
            })
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
        billing_segments: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        }
      };

      mockFrom.mockImplementation((table: string) => tables[table] || null);

      const req = createMockRequest({}, meterId);
      const response = await POST(req, { params: { meterId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to deactivate meter');
    });

    it('should handle Zod validation errors', async () => {
      const userId = 'user-123';
      const meterId = '550e8400-e29b-41d4-a716-446655440000';
      mockAuth(userId);

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: userId, role: 'owner', user_id: userId },
              error: null
            })
          };
        }
        return null;
      });

      // Create request with invalid body (notes should be string, not number)
      const url = `http://localhost:3000/api/meters/${meterId}/deactivate`;
      const req = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({ notes: 12345 }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(req, { params: { meterId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
      expect(data.details).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle meter with multiple closed segments', async () => {
      const userId = 'user-123';
      const hostelId = '550e8400-e29b-41d4-a716-446655440001';
      const meterId = '550e8400-e29b-41d4-a716-446655440000';

      mockSuccessfulFlow(userId, hostelId, meterId, false, 'active');

      const req = createMockRequest({}, meterId);
      const response = await POST(req, { params: { meterId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject deactivation when multiple open segments exist', async () => {
      const userId = 'user-123';
      const hostelId = '550e8400-e29b-41d4-a716-446655440001';
      const meterId = '550e8400-e29b-41d4-a716-446655440000';
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
        electricity_meters: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: meterId,
              hostel_id: hostelId,
              room_id: 'room-123',
              meter_number: 'M001',
              status: 'active'
            },
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
        billing_segments: {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockResolvedValue({
            data: [{ id: 'segment-1' }, { id: 'segment-2' }],
            error: null
          })
        }
      };

      mockFrom.mockImplementation((table: string) => tables[table] || null);

      const req = createMockRequest({}, meterId);
      const response = await POST(req, { params: { meterId } });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.open_segment_count).toBe(2);
    });

    it('should handle very long notes text', async () => {
      const userId = 'user-123';
      const hostelId = '550e8400-e29b-41d4-a716-446655440001';
      const meterId = '550e8400-e29b-41d4-a716-446655440000';

      mockSuccessfulFlow(userId, hostelId, meterId, false, 'active');

      const longNotes = 'A'.repeat(5000);
      const req = createMockRequest({ notes: longNotes }, meterId);
      const response = await POST(req, { params: { meterId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
