import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Create mock functions at module level to avoid hoisting issues
const mockAuthGetUser = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: (...args: unknown[]) => mockAuthGetUser(...args)
    }
  })),
  supabaseServer: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args)
  }
}));

// Import after mocking
const { GET } = await import('./route');

describe('GET /api/notifications/pending-readings', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockHostelId = '123e4567-e89b-12d3-a456-426614174001';
  const mockRoomId = '123e4567-e89b-12d3-a456-426614174002';
  const mockMeterId = '123e4567-e89b-12d3-a456-426614174003';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockRequest = (hostelId?: string) => {
    const url = hostelId 
      ? `http://localhost:3000/api/notifications/pending-readings?hostel_id=${hostelId}`
      : 'http://localhost:3000/api/notifications/pending-readings';
    
    return new NextRequest(url);
  };

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      });

      const req = createMockRequest(mockHostelId);
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 if user profile is not found', async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null
      });

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      });

      const req = createMockRequest(mockHostelId);
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('User profile not found');
    });

    it('should return 403 if user is not an owner', async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: mockUserId, role: 'student', user_id: mockUserId },
                  error: null
                })
              })
            })
          };
        }
        return {
          select: vi.fn(),
          eq: vi.fn(),
          rpc: vi.fn()
        };
      });

      const req = createMockRequest(mockHostelId);
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden: Only hostel owners can view pending readings');
    });
  });

  describe('Validation', () => {
    beforeEach(() => {
      // Setup valid authentication
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null
      });
    });

    it('should return 400 if hostel_id is missing', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: mockUserId, role: 'owner', user_id: mockUserId },
                  error: null
                })
              })
            })
          };
        }
        return { select: vi.fn(), eq: vi.fn() };
      });

      const req = createMockRequest(); // No hostel_id
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required query parameter: hostel_id');
    });

    it('should return 400 if hostel_id is not a valid UUID', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: mockUserId, role: 'owner', user_id: mockUserId },
                  error: null
                })
              })
            })
          };
        }
        return { select: vi.fn(), eq: vi.fn() };
      });

      const req = createMockRequest('invalid-uuid');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid query parameters');
    });
  });

  describe('Authorization', () => {
    beforeEach(() => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null
      });
    });

    it('should return 404 if hostel does not exist', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: mockUserId, role: 'owner', user_id: mockUserId },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'hostels') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Not found' }
                })
              })
            })
          };
        }
        return { select: vi.fn(), eq: vi.fn() };
      });

      const req = createMockRequest(mockHostelId);
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Hostel not found');
    });

    it('should return 403 if user does not own the hostel', async () => {
      const otherUserId = '123e4567-e89b-12d3-a456-426614174099';

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: mockUserId, role: 'owner', user_id: mockUserId },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'hostels') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockHostelId, owner_id: otherUserId, name: 'Other Hostel' },
                  error: null
                })
              })
            })
          };
        }
        return { select: vi.fn(), eq: vi.fn() };
      });

      const req = createMockRequest(mockHostelId);
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden: You do not own this hostel');
    });
  });

  describe('Success Cases', () => {
    beforeEach(() => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null
      });
    });

    it('should return empty list when no pending readings exist', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: mockUserId, role: 'owner', user_id: mockUserId },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'hostels') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockHostelId, owner_id: mockUserId, name: 'Test Hostel' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'occupancy_change_events') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation(() => ({
                eq: vi.fn().mockImplementation(() => ({
                  eq: vi.fn().mockResolvedValue({
                    data: [],
                    error: null
                  })
                }))
              }))
            })
          };
        }
        return { select: vi.fn(), eq: vi.fn() };
      });

      mockRpc.mockResolvedValue({
        data: [],
        error: null
      });

      const req = createMockRequest(mockHostelId);
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hostel_id).toBe(mockHostelId);
      expect(data.pending_count).toBe(0);
      expect(data.readings).toEqual([]);
    });

    it('should return occupancy change pending readings with high priority', async () => {
      const mockOccupancyData = [
        {
          room_id: mockRoomId,
          reading_deadline: '2024-01-15T10:00:00Z',
          change_type: 'student_join',
          rooms: { room_number: '101' },
          electricity_meters: { id: mockMeterId, meter_number: 'MTR001' },
          profiles: { full_name: 'John Doe' }
        }
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: mockUserId, role: 'owner', user_id: mockUserId },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'hostels') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockHostelId, owner_id: mockUserId, name: 'Test Hostel' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'occupancy_change_events') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation(() => ({
                eq: vi.fn().mockImplementation(() => ({
                  eq: vi.fn().mockResolvedValue({
                    data: mockOccupancyData,
                    error: null
                  })
                }))
              }))
            })
          };
        }
        return { select: vi.fn(), eq: vi.fn() };
      });

      mockRpc.mockResolvedValue({
        data: [],
        error: null
      });

      const req = createMockRequest(mockHostelId);
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hostel_id).toBe(mockHostelId);
      expect(data.pending_count).toBe(1);
      expect(data.readings).toHaveLength(1);
      expect(data.readings[0]).toMatchObject({
        room_id: mockRoomId,
        room_number: '101',
        meter_id: mockMeterId,
        meter_number: 'MTR001',
        reason: 'occupancy_change',
        priority: 'high',
        event_details: {
          change_type: 'student_join',
          student_name: 'John Doe'
        }
      });
    });

    it('should return month-end pending readings with medium priority', async () => {
      const mockMonthEndData = [
        {
          room_id: mockRoomId,
          room_number: '102',
          meter_id: mockMeterId,
          meter_number: 'MTR002',
          deadline: '2024-01-31T23:59:59Z'
        }
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: mockUserId, role: 'owner', user_id: mockUserId },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'hostels') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockHostelId, owner_id: mockUserId, name: 'Test Hostel' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'occupancy_change_events') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation(() => ({
                eq: vi.fn().mockImplementation(() => ({
                  eq: vi.fn().mockResolvedValue({
                    data: [],
                    error: null
                  })
                }))
              }))
            })
          };
        }
        return { select: vi.fn(), eq: vi.fn() };
      });

      mockRpc.mockResolvedValue({
        data: mockMonthEndData,
        error: null
      });

      const req = createMockRequest(mockHostelId);
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hostel_id).toBe(mockHostelId);
      expect(data.pending_count).toBe(1);
      expect(data.readings).toHaveLength(1);
      expect(data.readings[0]).toMatchObject({
        room_id: mockRoomId,
        room_number: '102',
        meter_id: mockMeterId,
        meter_number: 'MTR002',
        reason: 'month_end',
        priority: 'medium'
      });
    });

    it('should combine and sort readings by priority (high before medium)', async () => {
      const mockOccupancyData = [
        {
          room_id: mockRoomId,
          reading_deadline: '2024-01-20T10:00:00Z',
          change_type: 'student_leave',
          rooms: { room_number: '101' },
          electricity_meters: { id: mockMeterId, meter_number: 'MTR001' },
          profiles: { full_name: 'Jane Smith' }
        }
      ];

      const mockMonthEndData = [
        {
          room_id: '123e4567-e89b-12d3-a456-426614174005',
          room_number: '102',
          meter_id: '123e4567-e89b-12d3-a456-426614174006',
          meter_number: 'MTR002',
          deadline: '2024-01-15T23:59:59Z' // Earlier deadline but lower priority
        }
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: mockUserId, role: 'owner', user_id: mockUserId },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'hostels') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockHostelId, owner_id: mockUserId, name: 'Test Hostel' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'occupancy_change_events') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation(() => ({
                eq: vi.fn().mockImplementation(() => ({
                  eq: vi.fn().mockResolvedValue({
                    data: mockOccupancyData,
                    error: null
                  })
                }))
              }))
            })
          };
        }
        return { select: vi.fn(), eq: vi.fn() };
      });

      mockRpc.mockResolvedValue({
        data: mockMonthEndData,
        error: null
      });

      const req = createMockRequest(mockHostelId);
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pending_count).toBe(2);
      expect(data.readings).toHaveLength(2);
      
      // High priority (occupancy_change) should come first
      expect(data.readings[0].priority).toBe('high');
      expect(data.readings[0].reason).toBe('occupancy_change');
      
      // Medium priority (month_end) should come second
      expect(data.readings[1].priority).toBe('medium');
      expect(data.readings[1].reason).toBe('month_end');
    });

    it('should sort by deadline within same priority level', async () => {
      const mockOccupancyData = [
        {
          room_id: mockRoomId,
          reading_deadline: '2024-01-20T10:00:00Z',
          change_type: 'student_join',
          rooms: { room_number: '101' },
          electricity_meters: { id: mockMeterId, meter_number: 'MTR001' },
          profiles: { full_name: 'John Doe' }
        },
        {
          room_id: '123e4567-e89b-12d3-a456-426614174005',
          reading_deadline: '2024-01-15T10:00:00Z', // Earlier deadline
          change_type: 'student_leave',
          rooms: { room_number: '102' },
          electricity_meters: { id: '123e4567-e89b-12d3-a456-426614174006', meter_number: 'MTR002' },
          profiles: { full_name: 'Jane Smith' }
        }
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: mockUserId, role: 'owner', user_id: mockUserId },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'hostels') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockHostelId, owner_id: mockUserId, name: 'Test Hostel' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'occupancy_change_events') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation(() => ({
                eq: vi.fn().mockImplementation(() => ({
                  eq: vi.fn().mockResolvedValue({
                    data: mockOccupancyData,
                    error: null
                  })
                }))
              }))
            })
          };
        }
        return { select: vi.fn(), eq: vi.fn() };
      });

      mockRpc.mockResolvedValue({
        data: [],
        error: null
      });

      const req = createMockRequest(mockHostelId);
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pending_count).toBe(2);
      
      // Earlier deadline should come first within same priority
      expect(data.readings[0].deadline).toBe('2024-01-15T10:00:00Z');
      expect(data.readings[1].deadline).toBe('2024-01-20T10:00:00Z');
    });

    it('should handle month-end RPC function not existing gracefully', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: mockUserId, role: 'owner', user_id: mockUserId },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'hostels') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockHostelId, owner_id: mockUserId, name: 'Test Hostel' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'occupancy_change_events') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation(() => ({
                eq: vi.fn().mockImplementation(() => ({
                  eq: vi.fn().mockResolvedValue({
                    data: [],
                    error: null
                  })
                }))
              }))
            })
          };
        }
        return { select: vi.fn(), eq: vi.fn() };
      });

      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Function not found' }
      });

      const req = createMockRequest(mockHostelId);
      const response = await GET(req);
      const data = await response.json();

      // Should succeed with just empty month-end data
      expect(response.status).toBe(200);
      expect(data.pending_count).toBe(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null
      });
    });

    it('should return 500 if occupancy change query fails', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: mockUserId, role: 'owner', user_id: mockUserId },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'hostels') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockHostelId, owner_id: mockUserId, name: 'Test Hostel' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'occupancy_change_events') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation(() => ({
                eq: vi.fn().mockImplementation(() => ({
                  eq: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Database error' }
                  })
                }))
              }))
            })
          };
        }
        return { select: vi.fn(), eq: vi.fn() };
      });

      const req = createMockRequest(mockHostelId);
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch occupancy change events');
    });
  });
});
