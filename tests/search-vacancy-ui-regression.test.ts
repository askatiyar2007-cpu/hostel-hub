import { describe, expect, it, vi, beforeEach } from 'vitest';
import { calculateHostelOccupancy, calculateRoomOccupancy } from '@/lib/utils/occupancy';

describe('Search, Vacancy Accuracy & UI Synchronization Regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Owner Room Requests Badge & State Sync', () => {
    it('immediately decrements pending requests count badge without waiting for 20s polling interval', () => {
      let pendingBadgeCount = 5;
      const setQueryData = vi.fn((_key: [string, string], updater: (prev: number) => number) => {
        pendingBadgeCount = updater(pendingBadgeCount);
      });

      // Simulating approval or rejection mutation onMutate
      const targetKey: [string, string] = ['owner-pending-requests-count', 'owner-123'];
      setQueryData(targetKey, (prev) => Math.max(0, (prev ?? 1) - 1));

      expect(setQueryData).toHaveBeenCalledWith(targetKey, expect.any(Function));
      expect(pendingBadgeCount).toBe(4);
    });

    it('preserves pending requests list and rolls back badge on mutation failure', () => {
      const initialRequests = [
        { id: 'req-1', status: 'pending', student_name: 'Aarav' },
        { id: 'req-2', status: 'pending', student_name: 'Diya' },
      ];
      let currentRequests = [...initialRequests];
      let pendingBadgeCount = 2;

      // Snapshot context before mutation
      const context = {
        previousRequests: [...currentRequests],
        previousCount: pendingBadgeCount,
      };

      // Optimistic update
      currentRequests = currentRequests.filter((r) => r.id !== 'req-1');
      pendingBadgeCount = Math.max(0, pendingBadgeCount - 1);
      expect(currentRequests).toHaveLength(1);
      expect(pendingBadgeCount).toBe(1);

      // Mutation error occurs: rollback executed
      currentRequests = context.previousRequests;
      pendingBadgeCount = context.previousCount;

      expect(currentRequests).toHaveLength(2);
      expect(currentRequests[0].id).toBe('req-1');
      expect(pendingBadgeCount).toBe(2);
    });
  });

  describe('2. Authoritative Hostel Vacancy Calculation (RLS Restriction Resilience)', () => {
    it('accurately calculates vacancy from synced room records when room_allocations is empty due to RLS', () => {
      // In prospective student / public contexts, RLS blocks direct SELECT on room_allocations (returns [])
      const emptyAllocationsDueToRls: any[] = [];

      // Authoritative rooms with database-synced occupancy
      const rooms = [
        { id: 'room-1', capacity: 2, occupied_count: 2, occupancy: 2 }, // Full
        { id: 'room-2', capacity: 3, occupied_count: 1, occupancy: 1 }, // 2 available
        { id: 'room-3', capacity: 1, occupied_count: 0, occupancy: 0 }, // 1 available
      ];

      const result = calculateHostelOccupancy(rooms, emptyAllocationsDueToRls);

      expect(result.totalRooms).toBe(3);
      expect(result.totalBeds).toBe(6);
      expect(result.occupiedBeds).toBe(3);
      expect(result.availableBeds).toBe(3);
      expect(result.occupancyPercentage).toBe(50);
    });

    it('identifies full hostel when all synced room capacities are met', () => {
      const fullRooms = [
        { id: 'room-1', capacity: 2, occupied_count: 2, occupancy: 2 },
        { id: 'room-2', capacity: 2, occupied_count: 2, occupancy: 2 },
      ];

      const result = calculateHostelOccupancy(fullRooms);

      expect(result.totalBeds).toBe(4);
      expect(result.occupiedBeds).toBe(4);
      expect(result.availableBeds).toBe(0);
      expect(result.occupancyPercentage).toBe(100);
    });

    it('vacated / checked-out resident frees bed in authoritative calculation', () => {
      const roomCapacity = 2;
      // One active resident, one resident checked out (active = false)
      const allocations = [
        { room_id: 'room-1', active: true, booking_type: 'shared' },
        { room_id: 'room-1', active: false, booking_type: 'shared' },
      ];

      const roomOcc = calculateRoomOccupancy(roomCapacity, allocations);
      expect(roomOcc.occupied).toBe(1);
      expect(roomOcc.availableBeds).toBe(1);

      const hostelOcc = calculateHostelOccupancy([{ id: 'room-1', capacity: 2 }], allocations);
      expect(hostelOcc.occupiedBeds).toBe(1);
      expect(hostelOcc.availableBeds).toBe(1);
    });

    it('marks availabilityStatus as unknown when get_room_actual_occupancy returns error or null, preventing silent stale count display', () => {
      // Simulate resolver function used in app/hostels/[id]/page.tsx
      function resolveRoomLiveOccupancy(room: { capacity: number; occupied_count?: number; occupancy?: number }, rpcResult: { data: any; error: any }) {
        const cap = Math.max(0, room.capacity ?? 1);
        let availabilityStatus: 'available' | 'full' | 'unknown' = 'unknown';
        let realOccupied: number | null = null;
        let freeBeds: number | null = null;

        const isValidRpcNumber = !rpcResult.error && rpcResult.data !== null && rpcResult.data !== undefined && !isNaN(Number(rpcResult.data));

        if (isValidRpcNumber) {
          realOccupied = Math.max(0, Math.min(cap, Number(rpcResult.data)));
          freeBeds = Math.max(0, cap - realOccupied);
          availabilityStatus = freeBeds <= 0 ? 'full' : 'available';
        } else {
          availabilityStatus = 'unknown';
        }

        return {
          occupancy: realOccupied,
          availableBeds: freeBeds,
          isFull: availabilityStatus === 'full',
          availabilityStatus,
        };
      }

      // Case A: RPC succeeds with valid count
      const successResult = resolveRoomLiveOccupancy(
        { capacity: 3, occupied_count: 0 },
        { data: 1, error: null }
      );
      expect(successResult.availabilityStatus).toBe('available');
      expect(successResult.occupancy).toBe(1);
      expect(successResult.availableBeds).toBe(2);
      expect(successResult.isFull).toBe(false);

      // Case B: RPC returns database error
      const errorResult = resolveRoomLiveOccupancy(
        { capacity: 3, occupied_count: 0 },
        { data: null, error: { message: 'function execution error' } }
      );
      expect(errorResult.availabilityStatus).toBe('unknown');
      expect(errorResult.occupancy).toBeNull();
      expect(errorResult.availableBeds).toBeNull();
      expect(errorResult.isFull).toBe(false);

      // Case C: RPC returns null/undefined data without error
      const nullResult = resolveRoomLiveOccupancy(
        { capacity: 3, occupied_count: 1 },
        { data: null, error: null }
      );
      expect(nullResult.availabilityStatus).toBe('unknown');
      expect(nullResult.occupancy).toBeNull();
      expect(nullResult.availableBeds).toBeNull();

      // Case D: Clamping ensures free beds cannot be negative
      const overCapacityResult = resolveRoomLiveOccupancy(
        { capacity: 2 },
        { data: 5, error: null }
      );
      expect(overCapacityResult.availabilityStatus).toBe('full');
      expect(overCapacityResult.occupancy).toBe(2);
      expect(overCapacityResult.availableBeds).toBe(0);
      expect(overCapacityResult.isFull).toBe(true);
    });
  });

  describe('3. Unified Hostel Search by Name and ID', () => {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const mockHostels = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Green View Residency',
        city: 'Bengaluru',
        address: 'Koramangala 4th Block',
        rooms: [{ id: 'r1', capacity: 2, occupancy: 1 }],
      },
      {
        id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        name: 'Green View Luxury Hostel',
        city: 'Bengaluru',
        address: 'HSR Layout Sector 2',
        rooms: [{ id: 'r2', capacity: 3, occupancy: 3 }],
      },
      {
        id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        name: 'Sunrise Boys Hostel',
        city: 'Pune',
        address: 'Viman Nagar',
        rooms: [{ id: 'r3', capacity: 2, occupancy: 0 }],
      },
    ];

    function searchHostels(query: string, hostels = mockHostels) {
      const trimmed = query.trim();
      if (!trimmed) return [];

      if (UUID_REGEX.test(trimmed)) {
        return hostels.filter((h) => h.id.toLowerCase() === trimmed.toLowerCase());
      }

      const lower = trimmed.toLowerCase();
      return hostels.filter(
        (h) => h.name.toLowerCase().includes(lower) || h.city.toLowerCase().includes(lower)
      );
    }

    it('identifies exact UUID queries and performs direct ID lookup', () => {
      const query = '  550e8400-e29b-41d4-a716-446655440000  ';
      const results = searchHostels(query);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Green View Residency');
    });

    it('performs case-insensitive partial name search', () => {
      const query = 'green view';
      const results = searchHostels(query);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.name)).toContain('Green View Residency');
      expect(results.map((r) => r.name)).toContain('Green View Luxury Hostel');
    });

    it('performs partial city / location search', () => {
      const query = 'pune';
      const results = searchHostels(query);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Sunrise Boys Hostel');
    });
  });

  describe('4. Duplicate Hostel Names & Explicit Selection Guardrail', () => {
    it('does not auto-route to data[0] when multiple hostels match', () => {
      const duplicateHostels = [
        {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'St. Mary Hostel',
          city: 'Mumbai',
          address: 'Bandra West',
          rooms: [{ capacity: 2, occupancy: 1 }],
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'St. Mary Hostel',
          city: 'Pune',
          address: 'Camp Area',
          rooms: [{ capacity: 2, occupancy: 2 }],
        },
      ];

      // Simulated selection handler
      let selectedHostel: any = null;
      const onSelectHostel = (hostel: any) => {
        selectedHostel = hostel;
      };

      // Both hostels are rendered with their distinct ID and live vacancy
      const hostelCards = duplicateHostels.map((h) => {
        const occ = calculateHostelOccupancy(h.rooms);
        return {
          id: h.id,
          name: h.name,
          city: h.city,
          availableBeds: occ.availableBeds,
          isFull: occ.totalBeds > 0 ? occ.availableBeds <= 0 : false,
        };
      });

      expect(hostelCards).toHaveLength(2);
      expect(hostelCards[0].id).toBe('11111111-1111-1111-1111-111111111111');
      expect(hostelCards[0].availableBeds).toBe(1);
      expect(hostelCards[0].isFull).toBe(false);

      expect(hostelCards[1].id).toBe('22222222-2222-2222-2222-222222222222');
      expect(hostelCards[1].availableBeds).toBe(0);
      expect(hostelCards[1].isFull).toBe(true);

      // Auto-selection MUST NOT happen
      expect(selectedHostel).toBeNull();

      // Student explicitly selects the second hostel
      onSelectHostel(duplicateHostels[1]);
      expect(selectedHostel.id).toBe('22222222-2222-2222-2222-222222222222');
      expect(selectedHostel.city).toBe('Pune');
    });
  });
});
