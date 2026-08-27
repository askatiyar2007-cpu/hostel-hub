import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/rooms?hostel_id=<uuid>
 * Returns rooms for a specific hostel (owned by authenticated user)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const hostelId = searchParams.get('hostel_id');

    if (!hostelId) {
      return NextResponse.json(
        { error: 'hostel_id is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: hostel, error: hostelError } = await supabase
      .from('hostels')
      .select('id, owner_id')
      .eq('id', hostelId)
      .single();

    if (hostelError || !hostel) {
      return NextResponse.json({ error: 'Hostel not found' }, { status: 404 });
    }

    if (hostel.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch rooms
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('id, room_number, hostel_id')
      .eq('hostel_id', hostelId)
      .order('room_number');

    if (error) {
      console.error('[Rooms API] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch rooms' },
        { status: 500 }
      );
    }

    return NextResponse.json({ rooms }, { status: 200 });
  } catch (error: any) {
    console.error('[Rooms API] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
