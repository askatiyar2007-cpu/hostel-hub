import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

const UnmeteredRoomsQuerySchema = z.object({
  hostel_id: z.string().uuid('Invalid hostel ID format')
});

export interface UnmeteredRoom {
  id: string;
  room_number: string;
  floor: number;
  room_type: string;
  capacity: number;
  occupancy: number;
  rent: number;
  status: string;
  hostel_id: string;
}

/**
 * GET /api/meters/unmetered-rooms?hostel_id={hostelId}
 * 
 * Returns all rooms in a hostel that do NOT currently have an active electricity meter.
 * 
 * Rules:
 * - Validate hostel ownership server-side.
 * - Only return rooms that do not currently have an active meter.
 * - Return room details (floor, room_type, capacity, occupancy, rent, status).
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[Unmetered Rooms API] Authentication failed:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify user role is owner
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('id, role, user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 403 }
      );
    }

    if (profile.role !== 'owner' && profile.role !== 'hostel_owner') {
      return NextResponse.json(
        { error: 'Forbidden: Only hostel owners can view unmetered rooms' },
        { status: 403 }
      );
    }

    // 3. Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const hostelId = searchParams.get('hostel_id');

    if (!hostelId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: hostel_id' },
        { status: 400 }
      );
    }

    const validated = UnmeteredRoomsQuerySchema.parse({ hostel_id: hostelId });

    // 4. Verify hostel ownership
    const { data: hostel, error: hostelError } = await supabaseServer
      .from('hostels')
      .select('id, owner_id, name')
      .eq('id', validated.hostel_id)
      .single();

    if (hostelError || !hostel) {
      return NextResponse.json({ error: 'Hostel not found' }, { status: 404 });
    }

    if (hostel.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this hostel' },
        { status: 403 }
      );
    }

    // 5. Fetch all rooms for this hostel
    const { data: allRooms, error: roomsError } = await supabaseServer
      .from('rooms')
      .select('id, room_number, floor, room_type, capacity, occupancy, rent, status, hostel_id')
      .eq('hostel_id', validated.hostel_id)
      .order('room_number', { ascending: true });

    if (roomsError) {
      console.error('[Unmetered Rooms API] Error fetching rooms:', roomsError);
      return NextResponse.json(
        { error: 'Failed to fetch rooms', details: roomsError.message },
        { status: 500 }
      );
    }

    // 6. Fetch active meters for this hostel
    const { data: activeMeters, error: metersError } = await supabaseServer
      .from('electricity_meters')
      .select('room_id')
      .eq('hostel_id', validated.hostel_id)
      .eq('status', 'active');

    if (metersError) {
      console.error('[Unmetered Rooms API] Error fetching active meters:', metersError);
      return NextResponse.json(
        { error: 'Failed to fetch active meters', details: metersError.message },
        { status: 500 }
      );
    }

    const meteredRoomIds = new Set((activeMeters || []).map(m => m.room_id));

    // 7. Filter rooms that do NOT have an active meter
    const unmeteredRooms: UnmeteredRoom[] = (allRooms || [])
      .filter(r => !meteredRoomIds.has(r.id))
      .map(r => ({
        id: r.id,
        room_number: r.room_number,
        floor: r.floor ?? 0,
        room_type: r.room_type || 'double',
        capacity: r.capacity || 1,
        occupancy: r.occupancy || 0,
        rent: Number(r.rent || 0),
        status: r.status || 'available',
        hostel_id: r.hostel_id
      }));

    return NextResponse.json({
      rooms: unmeteredRooms,
      total_count: unmeteredRooms.length
    }, { status: 200 });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Unmetered Rooms API] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
