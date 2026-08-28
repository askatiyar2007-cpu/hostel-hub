import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

// Request validation schema (Design Section 6.2.1)
const CreateMeterSchema = z.object({
  hostel_id: z.string().uuid('Invalid hostel ID format'),
  room_id: z.string().uuid('Invalid room ID format'),
  meter_number: z.string().min(1, 'Meter number is required').max(100, 'Meter number too long'),
  initial_reading: z.number().nonnegative('Initial reading must be non-negative'),
  notes: z.string().optional()
});

interface CreateMeterResponse {
  meter_id: string;
  reading_id: string;
  message: string;
}

/**
 * POST /api/meters/create
 * 
 * Creates a new electricity meter for a room with an initial reading.
 * 
 * Requirements:
 * - REQ-1.1: Owner configures meter with meter_number, room_id, hostel_id
 * - REQ-1.2: Prevent duplicate active meters per room
 * - REQ-1.3: Validate room belongs to owner's hostel
 * - REQ-4.5: Require initial reading at meter creation
 * 
 * @param req - Request containing hostel_id, room_id, meter_number, initial_reading
 * @returns Meter ID, reading ID, and success message
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the owner using cookie-based client
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[Create Meter API] Authentication failed:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify user role is 'owner' using service role to bypass RLS
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('id, role, user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.log('[Create Meter API] Profile lookup failed:', profileError.message);
      return NextResponse.json(
        { error: 'Failed to verify user profile' },
        { status: 403 }
      );
    }

    if (!profile) {
      console.log('[Create Meter API] No profile found for user');
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 403 }
      );
    }

    if (profile.role !== 'owner' && profile.role !== 'hostel_owner') {
      console.log('[Create Meter API] Authorization failed - not an owner. Actual role:', profile.role);
      return NextResponse.json(
        { error: 'Forbidden: Only hostel owners can create meters' },
        { status: 403 }
      );
    }

    // 3. Parse and validate request body
    const body = await req.json();
    const validated = CreateMeterSchema.parse(body);

    // 4. Verify hostel ownership (REQ-1.3)
    const { data: hostel, error: hostelError } = await supabaseServer
      .from('hostels')
      .select('id, owner_id, name')
      .eq('id', validated.hostel_id)
      .single();

    if (hostelError || !hostel) {
      console.log('[Create Meter API] Hostel not found:', hostelError?.message);
      return NextResponse.json({ error: 'Hostel not found' }, { status: 404 });
    }

    if (hostel.owner_id !== user.id) {
      console.log('[Create Meter API] Authorization failed - user does not own this hostel');
      return NextResponse.json(
        { error: 'Forbidden: You do not own this hostel' },
        { status: 403 }
      );
    }

    // 5. Validate room belongs to hostel (REQ-1.3)
    const { data: room, error: roomError } = await supabaseServer
      .from('rooms')
      .select('id, hostel_id, room_number')
      .eq('id', validated.room_id)
      .single();

    if (roomError || !room) {
      console.log('[Create Meter API] Room not found:', roomError?.message);
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (room.hostel_id !== validated.hostel_id) {
      console.log('[Create Meter API] Room does not belong to specified hostel');
      return NextResponse.json(
        { error: 'Room does not belong to this hostel' },
        { status: 400 }
      );
    }

    // 6. Check no active meter exists for room (REQ-1.2)
    const { data: existingMeter, error: existingMeterError } = await supabaseServer
      .from('electricity_meters')
      .select('id, meter_number')
      .eq('room_id', validated.room_id)
      .eq('status', 'active')
      .maybeSingle();

    if (existingMeterError) {
      console.log('[Create Meter API] Error checking existing meter:', existingMeterError.message);
      return NextResponse.json(
        { error: 'Failed to check existing meters' },
        { status: 500 }
      );
    }

    if (existingMeter) {
      console.log('[Create Meter API] Room already has active meter:', existingMeter.id);
      return NextResponse.json(
        { 
          error: `Room already has an active meter (${existingMeter.meter_number})`,
          existing_meter_id: existingMeter.id
        },
        { status: 409 }
      );
    }

    // 7. Create meter (REQ-1.1, REQ-1.7)
    const { data: meter, error: meterError } = await supabaseServer
      .from('electricity_meters')
      .insert({
        hostel_id: validated.hostel_id,
        room_id: validated.room_id,
        meter_number: validated.meter_number,
        status: 'active',
        created_by: user.id,
        notes: validated.notes || null
      })
      .select('id, meter_number')
      .single();

    if (meterError) {
      console.error('[Create Meter API] Failed to create meter:', meterError);
      return NextResponse.json(
        { error: 'Failed to create meter', details: meterError.message },
        { status: 500 }
      );
    }

    // 8. Record initial reading (REQ-4.5, REQ-4.6)
    const { data: reading, error: readingError } = await supabaseServer
      .from('meter_readings')
      .insert({
        meter_id: meter.id,
        room_id: validated.room_id,
        hostel_id: validated.hostel_id,
        reading_value: validated.initial_reading,
        reading_timestamp: new Date().toISOString(),
        recorded_by: user.id,
        reason: 'initial',
        notes: validated.notes ? `Initial meter reading - ${validated.notes}` : 'Initial meter reading at configuration'
      })
      .select('id')
      .single();

    if (readingError) {
      console.error('[Create Meter API] Failed to create initial reading:', readingError);
      
      // Rollback: Delete the meter we just created
      await supabaseServer
        .from('electricity_meters')
        .delete()
        .eq('id', meter.id);

      return NextResponse.json(
        { error: 'Failed to record initial reading', details: readingError.message },
        { status: 500 }
      );
    }

    // 9. Return success response
    const successMessage = `Meter ${validated.meter_number} configured for Room ${room.room_number} with initial reading ${validated.initial_reading} units`;
    
    console.log('[Create Meter API] Success:', {
      meter_id: meter.id,
      reading_id: reading.id,
      hostel_id: validated.hostel_id,
      room_id: validated.room_id
    });

    return NextResponse.json<CreateMeterResponse>({
      meter_id: meter.id,
      reading_id: reading.id,
      message: successMessage
    }, { status: 201 });

  } catch (error: any) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      console.log('[Create Meter API] Validation error:', error.errors);
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }

    // Handle all other errors
    console.error('[Create Meter API] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
