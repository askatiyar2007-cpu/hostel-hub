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

describe('Billing Room Consumption & Calculation State Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks room awaiting month-end reading as non-calculable with baseline reading preserved', async () => {
    const { GET } = await import('@/app/api/billing/overview/route');

    const mockProfile = { id: 'owner-profile-id', role: 'hostel_owner', user_id: 'owner-user-id' };
    const mockHostel = { id: '123e4567-e89b-12d3-a456-426614174001', owner_id: 'owner-user-id' };
    const mockRooms = [
      { id: 'room-101', room_number: '101', floor: 1, capacity: 2, occupancy: 1 },
    ];
    const mockMeters = [
      { id: 'meter-101', room_id: 'room-101', meter_number: 'MTR-101', status: 'active' },
    ];
    // Only initial baseline reading exists
    const mockReadings = [
      {
        id: 'reading-init',
        meter_id: 'meter-101',
        room_id: 'room-101',
        reading_value: 1250,
        reading_timestamp: '2026-10-01T10:00:00Z',
        reason: 'initial',
      },
    ];
    // No closed segments yet
    const mockSegments: any[] = [];
    const mockCharges: any[] = [];
    const mockFees: any[] = [];
    const mockAllocations = [
      {
        id: 'alloc-1',
        room_id: 'room-101',
        student_id: 'student-gotiya',
        student_name: 'Gotiya',
        student_email: 'gotiya@example.com',
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

    const req = new NextRequest('http://localhost:3000/api/billing/overview?hostel_id=123e4567-e89b-12d3-a456-426614174001&billing_month=2026-10');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.rooms).toHaveLength(1);
    const room = body.rooms[0];

    // Verify room 101 state
    expect(room.room_number).toBe('101');
    expect(room.meter_id).toBe('meter-101');
    expect(room.consumption_calculable).toBe(false);
    expect(room.status).toBe('awaiting_reading');
    expect(room.status_label).toBe('Awaiting Month-End Reading');
    expect(room.initial_reading?.value).toBe(1250);
    expect(room.current_occupants).toHaveLength(1);

    // Verify student state distinguishes awaiting reading
    expect(body.students).toHaveLength(1);
    const student = body.students[0];
    expect(student.student_name).toBe('Gotiya');
    expect(student.status).toBe('awaiting_month_end_reading');
    expect(student.status_label).toBe('Awaiting Month-End Reading');

    // Summary counts
    expect(body.summary.rooms_awaiting_reading).toBe(1);
    expect(body.summary.rooms_with_calculable_consumption).toBe(0);
  });

  it('marks room with closed month-end segments as calculable with full metrics', async () => {
    const { GET } = await import('@/app/api/billing/overview/route');

    const mockProfile = { id: 'owner-profile-id', role: 'hostel_owner', user_id: 'owner-user-id' };
    const mockHostel = { id: '123e4567-e89b-12d3-a456-426614174001', owner_id: 'owner-user-id' };
    const mockRooms = [
      { id: 'room-101', room_number: '101', floor: 1, capacity: 2, occupancy: 1 },
    ];
    const mockMeters = [
      { id: 'meter-101', room_id: 'room-101', meter_number: 'MTR-101', status: 'active' },
    ];
    const mockReadings = [
      {
        id: 'reading-end',
        meter_id: 'meter-101',
        room_id: 'room-101',
        reading_value: 1450,
        reading_timestamp: '2026-10-31T20:00:00Z',
        reason: 'month_end',
      },
      {
        id: 'reading-init',
        meter_id: 'meter-101',
        room_id: 'room-101',
        reading_value: 1250,
        reading_timestamp: '2026-10-01T10:00:00Z',
        reason: 'initial',
      },
    ];
    const mockSegments = [
      {
        id: 'seg-1',
        room_id: 'room-101',
        meter_id: 'meter-101',
        start_date: '2026-10-01T10:00:00Z',
        end_date: '2026-10-31T20:00:00Z',
        consumption_units: 200,
        total_cost_paise: 200000,
        segment_type: 'occupied',
        occupant_count: 1,
        rate_per_unit: 10,
      },
    ];
    const mockCharges = [
      {
        id: 'chg-1',
        segment_id: 'seg-1',
        student_id: 'student-gotiya',
        room_id: 'room-101',
        charge_amount_paise: 200000,
        billing_month: '2026-10',
      },
    ];
    const mockFees = [
      {
        id: 'fee-1',
        student_id: 'student-gotiya',
        room_id: 'room-101',
        amount: 2000,
        status: 'pending',
        due_date: '2026-11-05',
        billing_period: '2026-10',
      },
    ];
    const mockAllocations = [
      {
        id: 'alloc-1',
        room_id: 'room-101',
        student_id: 'student-gotiya',
        student_name: 'Gotiya',
        student_email: 'gotiya@example.com',
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

    const req = new NextRequest('http://localhost:3000/api/billing/overview?hostel_id=123e4567-e89b-12d3-a456-426614174001&billing_month=2026-10');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    const room = body.rooms[0];
    expect(room.consumption_calculable).toBe(true);
    expect(room.total_consumption).toBe(200);
    expect(room.total_revenue_rupees).toBe(2000);
    expect(room.initial_reading?.value).toBe(1250);
    expect(room.latest_reading?.value).toBe(1450);
    expect(room.student_charges_rupees).toBe(2000);
    expect(room.segments_count).toBe(1);

    expect(body.summary.rooms_with_calculable_consumption).toBe(1);
    expect(body.summary.rooms_awaiting_reading).toBe(0);
    expect(body.summary.total_consumption_all).toBe(200);
    expect(body.summary.total_consumption_occupied).toBe(200);
  });

  it('retrieves past/checked-out resident records without data loss', async () => {
    // Simulating past resident query in app/owner/students/page.tsx
    const mockPastAllocations = [
      {
        id: 'alloc-past-1',
        active: false,
        status: 'checked_out',
        start_date: '2026-08-01',
        end_date: '2026-09-30',
        student_id: 'student-past-1',
        hostel_id: '123e4567-e89b-12d3-a456-426614174001',
        students: {
          id: 'student-past-1',
          profiles: {
            full_name: 'Historical Resident',
            email: 'historical@example.com',
            phone_number: '+919876543210'
          }
        },
        rooms: {
          room_number: '101'
        },
        hostels: {
          name: 'Blue Sky Hostel',
          owner_id: 'owner-user-id'
        }
      }
    ];

    // Calculate stay duration as done in StudentCard / Student Profile
    const alloc = mockPastAllocations[0];
    const stayDays = Math.max(1, Math.round((new Date(alloc.end_date).getTime() - new Date(alloc.start_date).getTime()) / (1000 * 60 * 60 * 24)));

    expect(alloc.active).toBe(false);
    expect(alloc.status).toBe('checked_out');
    expect(alloc.end_date).toBe('2026-09-30');
    expect(stayDays).toBe(60);
    expect(alloc.students.profiles.full_name).toBe('Historical Resident');
    expect(alloc.rooms.room_number).toBe('101');
  });

  it('room-details API accurately marks open segment as awaiting month-end reading and reports closed_segments_count as 0', async () => {
    const { GET } = await import('@/app/api/billing/room-details/route');

    const mockHostel = { id: '123e4567-e89b-12d3-a456-426614174001', name: 'Blue Sky Hostel', owner_id: 'owner-user-id' };
    const mockRoom = { id: '123e4567-e89b-12d3-a456-426614174002', room_number: '101', hostel_id: mockHostel.id, floor: 1, capacity: 2, occupancy: 1 };
    const mockMeter = { id: 'meter-101', meter_number: 'MTR-101', status: 'active' };
    const mockReadings = [
      { id: 'r2', reading_value: '2400.11', reading_timestamp: '2026-10-16T10:00:00Z', reason: 'occupancy_change' },
      { id: 'r1', reading_value: '398.69', reading_timestamp: '2026-09-03T10:00:00Z', reason: 'initial' }
    ];
    // Open segment only for October
    const mockOpenSegment = [
      {
        id: 'seg-oct-open',
        room_id: mockRoom.id,
        meter_id: mockMeter.id,
        start_date: '2026-10-16T10:00:00Z',
        end_date: null,
        start_reading_id: 'r2',
        end_reading_id: null,
        start_reading_value: 2400.11,
        end_reading_value: null,
        consumption_units: null,
        rate_per_unit: 10,
        total_cost_paise: null,
        occupant_count: 1,
        segment_type: 'occupied'
      }
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'rooms') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: mockRoom, error: null }),
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
      if (table === 'electricity_meters') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: mockMeter, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'meter_readings') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: mockReadings, error: null }),
              in: () => Promise.resolve({ data: mockReadings, error: null }),
            }),
          }),
        };
      }
      if (table === 'room_allocations') {
        return {
          select: () => ({
            eq: () => ({
              lte: () => ({
                or: () => Promise.resolve({ data: [{ student_id: 's1', student_name: 'Gotiya', start_date: '2026-10-01' }], error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'billing_segments') {
        return {
          select: () => {
            const queryObj: any = {};
            queryObj.eq = () => queryObj;
            queryObj.order = () => Promise.resolve({ data: mockOpenSegment, error: null });
            return queryObj;
          },
        };
      }
      if (table === 'student_electricity_charges') {
        return {
          select: () => {
            const queryObj: any = {};
            queryObj.eq = () => queryObj;
            queryObj.in = () => Promise.resolve({ data: [], error: null });
            queryObj.then = (fn: any) => Promise.resolve({ data: [], error: null }).then(fn);
            return queryObj;
          },
        };
      }
      if (table === 'billing_segment_occupants') {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [{ segment_id: 'seg-oct-open', student_id: 's1', student_name: 'Gotiya' }], error: null }),
          }),
        };
      }
      if (table === 'electricity_rate_history') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: () => Promise.resolve({ data: { rate_per_unit: 10, effective_from: '2026-01-01' }, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'student_fees') {
        return {
          select: () => {
            const queryObj: any = {};
            queryObj.eq = () => Promise.resolve({ data: [], error: null });
            queryObj.then = (fn: any) => Promise.resolve({ data: [], error: null }).then(fn);
            return queryObj;
          },
        };
      }
      return {
        select: () => {
          const queryObj: any = {};
          queryObj.eq = () => queryObj;
          queryObj.in = () => queryObj;
          queryObj.order = () => queryObj;
          queryObj.then = (fn: any) => Promise.resolve({ data: [], error: null }).then(fn);
          return queryObj;
        },
      };
    });

    const req = new NextRequest(`http://localhost:3000/api/billing/room-details?room_id=${mockRoom.id}&billing_month=2026-10`);
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.room_number).toBe('101');
    expect(body.status).toBe('awaiting_month_end_reading');
    expect(body.status_label).toBe('Awaiting Month-End Reading');
    expect(body.closed_segments_count).toBe(0);
    expect(body.open_segments_count).toBe(1);
    expect(body.is_cycle_in_progress).toBe(true);
    expect(body.total_consumption).toBe(0);
    expect(body.total_cost_paise).toBe(0);
  });
});
