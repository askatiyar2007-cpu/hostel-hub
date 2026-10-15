import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'owner-user-id', email: 'owner@example.com' } },
        error: null,
      }),
    },
  })),
  supabaseServer: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: (...args: any[]) => mockFrom(...args),
  },
}));

describe('Billing Overview API — Allocated Students & Rooms (Issue A)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns HTTP 400 when hostel_id or billing_month is missing', async () => {
    const { GET } = await import('@/app/api/billing/overview/route');

    const reqMissingHostel = new NextRequest('http://localhost:3000/api/billing/overview?billing_month=2026-10');
    const resMissingHostel = await GET(reqMissingHostel);
    expect(resMissingHostel.status).toBe(400);

    const reqMissingMonth = new NextRequest('http://localhost:3000/api/billing/overview?hostel_id=123e4567-e89b-12d3-a456-426614174000');
    const resMissingMonth = await GET(reqMissingMonth);
    expect(resMissingMonth.status).toBe(400);
  });

  it('returns both rooms and allocated students with authoritative states', async () => {
    const { GET } = await import('@/app/api/billing/overview/route');

    const mockProfile = { id: 'owner-profile-id', role: 'hostel_owner', user_id: 'owner-user-id' };
    const mockHostel = { id: '123e4567-e89b-12d3-a456-426614174000', owner_id: 'owner-user-id' };
    const mockRooms = [
      { id: 'room-1', room_number: '101', floor: 1, capacity: 2, occupancy: 2 },
      { id: 'room-2', room_number: '102', floor: 1, capacity: 1, occupancy: 0 },
    ];
    const mockMeters = [
      { id: 'meter-1', room_id: 'room-1', meter_number: 'MTR-101', status: 'active' },
    ];
    const mockReadings = [
      { id: 'read-1', meter_id: 'meter-1', room_id: 'room-1', reading_value: 200, reading_timestamp: '2026-10-31T00:00:00Z', reason: 'month_end' },
      { id: 'read-0', meter_id: 'meter-1', room_id: 'room-1', reading_value: 100, reading_timestamp: '2026-10-01T00:00:00Z', reason: 'initial' },
    ];
    const mockSegments = [
      {
        id: 'seg-1',
        room_id: 'room-1',
        meter_id: 'meter-1',
        start_date: '2026-10-01T00:00:00Z',
        end_date: '2026-10-31T00:00:00Z',
        consumption_units: 100,
        total_cost_paise: 100000,
        segment_type: 'occupied',
        occupant_count: 2,
        rate_per_unit: 10,
      },
    ];
    const mockCharges = [
      {
        id: 'charge-1',
        segment_id: 'seg-1',
        student_id: 'student-1',
        room_id: 'room-1',
        charge_amount_paise: 50000,
        billing_month: '2026-10',
      },
    ];
    const mockFees = [
      {
        id: 'fee-1',
        student_id: 'student-1',
        room_id: 'room-1',
        amount: 500,
        status: 'paid',
        due_date: '2026-11-05',
        billing_period: '2026-10',
      },
    ];
    const mockAllocations = [
      {
        id: 'alloc-1',
        room_id: 'room-1',
        student_id: 'student-1',
        student_name: 'John Doe',
        student_email: 'john@example.com',
        start_date: '2026-10-01',
        end_date: null,
        active: true,
        students: null,
      },
      {
        id: 'alloc-2',
        room_id: 'room-1',
        student_id: 'student-2',
        student_name: 'Jane Smith',
        student_email: 'jane@example.com',
        start_date: '2026-10-01',
        end_date: null,
        active: true,
        students: null,
      },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: mockProfile, error: null }),
            }),
          }),
        };
      }
      if (table === 'hostels') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: mockHostel, error: null }),
            }),
          }),
        };
      }
      if (table === 'rooms') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: mockRooms, error: null }),
            }),
          }),
        };
      }
      if (table === 'electricity_meters') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: mockMeters, error: null }),
            }),
          }),
        };
      }
      if (table === 'meter_readings') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: mockReadings, error: null }),
            }),
          }),
        };
      }
      if (table === 'billing_segments') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: mockSegments, error: null }),
            }),
          }),
        };
      }
      if (table === 'student_electricity_charges') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: mockCharges, error: null }),
            }),
          }),
        };
      }
      if (table === 'student_fees') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: mockFees, error: null }),
            }),
          }),
        };
      }
      if (table === 'room_allocations') {
        return {
          select: () => ({
            eq: () => ({
              lte: () => ({
                or: () => Promise.resolve({ data: mockAllocations, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => Promise.resolve({ data: [], error: null }),
      };
    });

    const req = new NextRequest(
      'http://localhost:3000/api/billing/overview?hostel_id=123e4567-e89b-12d3-a456-426614174000&billing_month=2026-10'
    );
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.rooms).toHaveLength(2); // Never drops unmetered or empty rooms
    expect(body.students).toHaveLength(2); // Displays allocated students!

    // Student 1 has paid fee and valid charges
    const student1 = body.students.find((s: any) => s.student_id === 'student-1');
    expect(student1).toBeDefined();
    expect(student1.status).toBe('paid');
    expect(student1.charge_amount_rupees).toBe(500);

    // Student 2 has recorded unbilled segments (seg-1 exists for room-1, but charges not generated)
    const student2 = body.students.find((s: any) => s.student_id === 'student-2');
    expect(student2).toBeDefined();
    expect(student2.status).toBe('recorded_unbilled');

    // Summary totals
    expect(body.summary.total_students).toBe(2);
    expect(body.summary.total_metered_rooms).toBe(1);
  });
});
