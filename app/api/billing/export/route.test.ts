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

describe('GET /api/billing/export', () => {
  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockHostelId = '550e8400-e29b-41d4-a716-446655440001';
  const mockMonth = '2024-08';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockRequest(searchParams: Record<string, string> = {}): NextRequest {
    const url = new URL('http://localhost:3000/api/billing/export');
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

  function mockCompleteFlow(hostelName: string = 'Test Hostel', segments: any[] = []) {
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
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: mockHostelId, owner_id: mockUserId, hostel_name: hostelName },
            error: null
          })
        };
      }
      // Third call: billing_segments (export data)
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: segments,
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

    (supabaseServer.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'profile-1', role: 'owner', user_id: mockUserId },
        error: null
      })
    });

    const req = createMockRequest({ month: mockMonth });
    const response = await GET(req);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('hostel_id');
  });

  it('should return 400 if month is missing', async () => {
    mockAuthSuccess();

    (supabaseServer.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'profile-1', role: 'owner', user_id: mockUserId },
        error: null
      })
    });

    const req = createMockRequest({ hostel_id: mockHostelId });
    const response = await GET(req);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('month');
  });

  it('should return 400 if month format is invalid', async () => {
    mockAuthSuccess();

    (supabaseServer.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'profile-1', role: 'owner', user_id: mockUserId },
        error: null
      })
    });

    const req = createMockRequest({ hostel_id: mockHostelId, month: 'invalid' });
    const response = await GET(req);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid query parameters');
  });

  it('should return 403 if user does not own the hostel', async () => {
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
          data: { id: mockHostelId, owner_id: 'different-user-id' },
          error: null
        })
      };
    });

    const req = createMockRequest({ hostel_id: mockHostelId, month: mockMonth });
    const response = await GET(req);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('only export billing data for your own hostels');
  });

  it('should return CSV file with billing data', async () => {
    mockAuthSuccess();

    const mockSegments = [
      {
        id: 'seg-1',
        room_id: 'room-1',
        start_date: '2024-08-01T00:00:00Z',
        end_date: '2024-08-15T09:00:00Z',
        consumption_units: '150.50',
        rate_per_unit: '8.5',
        occupant_count: 2,
        total_cost_paise: 127500,
        segment_type: 'occupied',
        rooms: { room_number: '101' },
        student_electricity_charges: [
          {
            student_id: 'student-1',
            charge_amount_paise: 63750,
            profiles: { full_name: 'John Doe' }
          },
          {
            student_id: 'student-2',
            charge_amount_paise: 63750,
            profiles: { full_name: 'Jane Smith' }
          }
        ]
      }
    ];

    mockCompleteFlow('Test Hostel', mockSegments);

    const req = createMockRequest({ hostel_id: mockHostelId, month: mockMonth, format: 'csv' });
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toContain('billing_Test Hostel_2024-08.csv');

    const csvText = await response.text();
    const lines = csvText.split('\n');

    // Check header
    expect(lines[0]).toContain('Room Number');
    expect(lines[0]).toContain('Segment Start');
    expect(lines[0]).toContain('Student Name');

    // Check data rows (2 students)
    expect(lines).toHaveLength(3); // header + 2 data rows
    expect(lines[1]).toContain('101');
    expect(lines[1]).toContain('John Doe');
    expect(lines[1]).toContain('637.50');
    expect(lines[2]).toContain('Jane Smith');
  });

  it('should handle empty room segments correctly', async () => {
    mockAuthSuccess();

    const mockSegments = [
      {
        id: 'seg-1',
        room_id: 'room-1',
        start_date: '2024-08-01T00:00:00Z',
        end_date: '2024-08-31T23:59:59Z',
        consumption_units: '75.00',
        rate_per_unit: '8.5',
        occupant_count: 0,
        total_cost_paise: 0,
        segment_type: 'empty',
        rooms: { room_number: '102' },
        student_electricity_charges: []
      }
    ];

    mockCompleteFlow('Test Hostel', mockSegments);

    const req = createMockRequest({ hostel_id: mockHostelId, month: mockMonth });
    const response = await GET(req);

    expect(response.status).toBe(200);
    const csvText = await response.text();
    const lines = csvText.split('\n');

    expect(lines).toHaveLength(2); // header + 1 data row
    expect(lines[1]).toContain('102');
    expect(lines[1]).toContain('Empty Room');
    expect(lines[1]).toContain('0.00'); // Zero charge
  });

  it('should escape CSV values with special characters', async () => {
    mockAuthSuccess();

    const mockSegments = [
      {
        id: 'seg-1',
        room_id: 'room-1',
        start_date: '2024-08-01T00:00:00Z',
        end_date: '2024-08-15T09:00:00Z',
        consumption_units: '100.00',
        rate_per_unit: '8.5',
        occupant_count: 1,
        total_cost_paise: 85000,
        segment_type: 'occupied',
        rooms: { room_number: '101,A' }, // Contains comma
        student_electricity_charges: [
          {
            student_id: 'student-1',
            charge_amount_paise: 85000,
            profiles: { full_name: 'John "Johnny" Doe' } // Contains quotes
          }
        ]
      }
    ];

    mockCompleteFlow('Test Hostel', mockSegments);

    const req = createMockRequest({ hostel_id: mockHostelId, month: mockMonth });
    const response = await GET(req);

    expect(response.status).toBe(200);
    const csvText = await response.text();

    // Room number with comma should be quoted
    expect(csvText).toContain('"101,A"');
    // Student name with quotes should be escaped
    expect(csvText).toContain('"John ""Johnny"" Doe"');
  });

  it('should return empty CSV if no billing data exists', async () => {
    mockAuthSuccess();
    mockCompleteFlow('Test Hostel', []);

    const req = createMockRequest({ hostel_id: mockHostelId, month: mockMonth });
    const response = await GET(req);

    expect(response.status).toBe(200);
    const csvText = await response.text();
    const lines = csvText.split('\n');

    // Should only have header row
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Room Number');
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
            data: { id: mockHostelId, owner_id: mockUserId, hostel_name: 'Test' },
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

  it('should default format to csv if not specified', async () => {
    mockAuthSuccess();
    mockCompleteFlow('Test Hostel', []);

    const req = createMockRequest({ hostel_id: mockHostelId, month: mockMonth });
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
  });
});
