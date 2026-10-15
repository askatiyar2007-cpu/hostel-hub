import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetUser = vi.fn();
const mockFromAuthClient = vi.fn();
const mockFromSupabaseServer = vi.fn();
const mockRecordMeterReadingWithLock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (...args: any[]) => mockFromAuthClient(...args),
  })),
  supabaseServer: {
    from: (...args: any[]) => mockFromSupabaseServer(...args),
  },
}));

vi.mock('@/lib/electricity', () => ({
  recordMeterReadingWithLock: (...args: any[]) => mockRecordMeterReadingWithLock(...args),
}));

describe('POST /api/readings/record API Route Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'owner-uuid-1', email: 'owner@example.com' } },
      error: null,
    });
  });

  const validMeterId = '123e4567-e89b-12d3-a456-426614174000';

  it('successfully records an "initial" reading with 201', async () => {
    const { POST } = await import('@/app/api/readings/record/route');

    // Mock meter query on authClient
    mockFromAuthClient.mockImplementation((table: string) => {
      if (table === 'electricity_meters') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: validMeterId,
                  hostel_id: 'hostel-uuid-1',
                  room_id: 'room-uuid-1',
                  meter_number: 'MTR-101',
                  status: 'active',
                  hostels: { id: 'hostel-uuid-1', owner_id: 'owner-uuid-1' },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'meter_readings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null, // First reading
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    mockRecordMeterReadingWithLock.mockResolvedValue({
      readingId: 'reading-uuid-init',
      segmentsAffected: ['segment-uuid-1'],
    });

    const request = new NextRequest('http://localhost:3000/api/readings/record', {
      method: 'POST',
      body: JSON.stringify({
        meter_id: validMeterId,
        reading_value: 1250,
        reason: 'initial',
        notes: 'Initial sub-meter installation',
      }),
    });

    const res = await POST(request);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.reading_id).toBe('reading-uuid-init');
    expect(data.segments_affected).toContain('segment-uuid-1');
    expect(mockRecordMeterReadingWithLock).toHaveBeenCalledWith(
      validMeterId,
      1250,
      'initial',
      'owner-uuid-1',
      'Initial sub-meter installation',
      expect.anything()
    );
  });

  it('successfully records an "occupancy_change" reading with 201', async () => {
    const { POST } = await import('@/app/api/readings/record/route');

    mockFromAuthClient.mockImplementation((table: string) => {
      if (table === 'electricity_meters') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: validMeterId,
                  hostel_id: 'hostel-uuid-1',
                  room_id: 'room-uuid-1',
                  meter_number: 'MTR-101',
                  status: 'active',
                  hostels: { id: 'hostel-uuid-1', owner_id: 'owner-uuid-1' },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'meter_readings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { reading_value: 1250, reading_timestamp: '2026-10-01T00:00:00Z' },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    mockRecordMeterReadingWithLock.mockResolvedValue({
      readingId: 'reading-uuid-occ',
      segmentsAffected: ['seg-closed-1', 'seg-new-2'],
    });

    const request = new NextRequest('http://localhost:3000/api/readings/record', {
      method: 'POST',
      body: JSON.stringify({
        meter_id: validMeterId,
        reading_value: 1350,
        reason: 'occupancy_change',
        notes: 'Student checked in',
      }),
    });

    const res = await POST(request);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.consumption).toBe(100);
    expect(mockRecordMeterReadingWithLock).toHaveBeenCalledWith(
      validMeterId,
      1350,
      'occupancy_change',
      'owner-uuid-1',
      'Student checked in',
      expect.anything()
    );
  });

  it('successfully records a "month_end" reading with 201', async () => {
    const { POST } = await import('@/app/api/readings/record/route');

    mockFromAuthClient.mockImplementation((table: string) => {
      if (table === 'electricity_meters') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: validMeterId,
                  hostel_id: 'hostel-uuid-1',
                  room_id: 'room-uuid-1',
                  meter_number: 'MTR-101',
                  status: 'active',
                  hostels: { id: 'hostel-uuid-1', owner_id: 'owner-uuid-1' },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'meter_readings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { reading_value: 1350, reading_timestamp: '2026-10-15T00:00:00Z' },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    mockRecordMeterReadingWithLock.mockResolvedValue({
      readingId: 'reading-uuid-me',
      segmentsAffected: ['seg-closed-2', 'seg-new-3'],
    });

    const request = new NextRequest('http://localhost:3000/api/readings/record', {
      method: 'POST',
      body: JSON.stringify({
        meter_id: validMeterId,
        reading_value: 1500,
        reason: 'month_end',
        notes: 'Month end reading October 2026',
      }),
    });

    const res = await POST(request);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.consumption).toBe(150);
  });

  it('rejects unauthorized owner with 403 Forbidden', async () => {
    const { POST } = await import('@/app/api/readings/record/route');

    mockFromAuthClient.mockImplementation((table: string) => {
      if (table === 'electricity_meters') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: validMeterId,
                  hostel_id: 'hostel-uuid-1',
                  room_id: 'room-uuid-1',
                  meter_number: 'MTR-101',
                  status: 'active',
                  hostels: { id: 'hostel-uuid-1', owner_id: 'DIFFERENT-OWNER' },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const request = new NextRequest('http://localhost:3000/api/readings/record', {
      method: 'POST',
      body: JSON.stringify({
        meter_id: validMeterId,
        reading_value: 1500,
        reason: 'month_end',
      }),
    });

    const res = await POST(request);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('permission');
  });

  it('rejects invalid payload (non-UUID meter_id) with 400 Bad Request', async () => {
    const { POST } = await import('@/app/api/readings/record/route');

    const request = new NextRequest('http://localhost:3000/api/readings/record', {
      method: 'POST',
      body: JSON.stringify({
        meter_id: 'invalid-not-uuid',
        reading_value: 1500,
        reason: 'month_end',
      }),
    });

    const res = await POST(request);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Validation failed');
  });

  it('returns 409 Conflict when a duplicate reading error is caught', async () => {
    const { POST } = await import('@/app/api/readings/record/route');

    mockFromAuthClient.mockImplementation((table: string) => {
      if (table === 'electricity_meters') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: validMeterId,
                  hostel_id: 'hostel-uuid-1',
                  room_id: 'room-uuid-1',
                  meter_number: 'MTR-101',
                  status: 'active',
                  hostels: { id: 'hostel-uuid-1', owner_id: 'owner-uuid-1' },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'meter_readings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    mockRecordMeterReadingWithLock.mockRejectedValue(
      new Error('Duplicate reading detected within 60 seconds.')
    );

    const request = new NextRequest('http://localhost:3000/api/readings/record', {
      method: 'POST',
      body: JSON.stringify({
        meter_id: validMeterId,
        reading_value: 1500,
        reason: 'month_end',
      }),
    });

    const res = await POST(request);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe('Duplicate reading');
  });
});
