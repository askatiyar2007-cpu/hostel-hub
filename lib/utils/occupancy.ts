/**
 * Canonical occupancy calculation utility aligned with PostgreSQL get_room_actual_occupancy.
 *
 * Rules:
 * 1. If any active allocation for a room has booking_type = 'entire_room', occupied beds = room.capacity.
 * 2. Otherwise, occupied beds = min(count of active allocations, room.capacity).
 * 3. Room available beds = max(0, room.capacity - occupied beds).
 * 4. Hostel total beds = sum(room.capacity).
 * 5. Hostel occupied beds = sum(room occupied beds).
 * 6. Hostel available beds = max(0, total beds - occupied beds).
 * 7. Occupancy percentage = total beds > 0 ? round((occupied beds / total beds) * 100) : 0.
 */

export interface AllocationLike {
  room_id?: string;
  active?: boolean;
  booking_type?: string | null;
}

export interface RoomLike {
  id?: string;
  capacity?: number | null;
  occupancy?: number | null;
  occupied_count?: number | null;
  occupied_beds?: number | null;
}

export interface RoomOccupancyResult {
  occupied: number;
  remaining: number;
  occupancyPercentage: number;
  occupiedBeds: number;
  availableBeds: number;
  isEntireRoom: boolean;
}

export interface HostelOccupancyResult {
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyPercentage: number;
}

/**
 * Calculates occupied beds for a single room following the canonical database rule:
 * entire_room active allocation ? room.capacity : min(active allocation count, room.capacity)
 */
export function calculateRoomOccupancy(
  capacity: number | null | undefined,
  allocations?: AllocationLike[] | null
): RoomOccupancyResult {
  const cap = Math.max(0, capacity ?? 0);
  const activeAllocs = (allocations || []).filter(
    (a) => a.active === true || a.active === undefined
  );
  const hasEntireRoom = activeAllocs.some((a) => a.booking_type === 'entire_room');

  const occupied = hasEntireRoom ? cap : Math.min(cap, activeAllocs.length);
  const remaining = Math.max(0, cap - occupied);
  const occupancyPercentage = cap > 0 ? Math.round((occupied / cap) * 100) : 0;

  return {
    occupied,
    remaining,
    occupancyPercentage,
    occupiedBeds: occupied,
    availableBeds: remaining,
    isEntireRoom: hasEntireRoom,
  };
}

/**
 * Aggregates room-level occupancy across all rooms in a hostel.
 * When allocations are provided, aggregates via calculateRoomOccupancy.
 * When allocations are empty/omitted (e.g. prospective student/anon callers where
 * RLS restricts SELECT on room_allocations), falls back authoritatively to synced
 * room.occupancy / room.occupied_count / room.occupied_beds.
 */
export function calculateHostelOccupancy(
  rooms: RoomLike[],
  allocations?: AllocationLike[] | null
): HostelOccupancyResult {
  const totalRooms = rooms.length;
  let totalBeds = 0;
  let occupiedBeds = 0;

  const hasAllocations = Array.isArray(allocations) && allocations.length > 0;
  const activeAllocs = hasAllocations
    ? (allocations || []).filter(
        (a) => a.active === true || a.active === undefined
      )
    : [];

  for (const room of rooms) {
    const cap = Math.max(0, room.capacity ?? 0);
    totalBeds += cap;

    if (hasAllocations) {
      const roomAllocs = activeAllocs.filter((a) => a.room_id === room.id);
      const { occupied } = calculateRoomOccupancy(cap, roomAllocs);
      occupiedBeds += occupied;
    } else {
      const roomOcc = Math.max(
        0,
        room.occupied_beds ?? room.occupancy ?? room.occupied_count ?? 0
      );
      occupiedBeds += Math.min(cap, roomOcc);
    }
  }

  const availableBeds = Math.max(0, totalBeds - occupiedBeds);
  const occupancyPercentage =
    totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  return {
    totalRooms,
    totalBeds,
    occupiedBeds,
    availableBeds,
    occupancyPercentage,
  };
}
