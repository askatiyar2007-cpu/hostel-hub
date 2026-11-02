import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import { replacePhysicalMeter } from '@/lib/electricity/meter-replacement';
import { z } from 'zod';

const ReplaceMeterSchema = z.object({
  old_meter_id: z.string().uuid('Invalid old meter ID format'),
  new_meter_number: z.string().min(1, 'New meter number is required').max(100, 'Meter number too long'),
  initial_reading: z.number().nonnegative('Initial reading must be non-negative'),
  final_reading: z.number().nonnegative('Final reading must be non-negative').optional().nullable(),
  final_reading_unavailable: z.boolean().optional(),
  notes: z.string().optional()
});

/**
 * POST /api/meters/replace
 * 
 * Atomically replaces a physical electricity meter for a room:
 * 1. Closes the old meter's open billing segment using its final reading.
 * 2. Deactivates the old physical meter (preserving all historical readings and charges).
 * 3. Creates the new physical meter with its new identifier.
 * 4. Records the new physical meter's initial benchmark reading (which may be lower than old meter's reading).
 * 5. Starts a new open billing segment for the new meter with current room occupants.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the owner (supports cookies and Bearer token)
    const supabase = createClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify user role is 'owner'
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('id, role, user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
    }

    if (profile.role !== 'owner' && profile.role !== 'hostel_owner') {
      return NextResponse.json(
        { error: 'Forbidden: Only hostel owners can replace electricity meters' },
        { status: 403 }
      );
    }

    // 3. Parse and validate request body
    const body = await req.json();
    const validated = ReplaceMeterSchema.parse(body);

    // 4. Fetch old meter to verify existence and get hostel_id / room_id
    const { data: oldMeter, error: oldMeterError } = await supabaseServer
      .from('electricity_meters')
      .select(`
        id,
        hostel_id,
        room_id,
        meter_number,
        status,
        hostels!inner (
          id,
          owner_id
        )
      `)
      .eq('id', validated.old_meter_id)
      .single();

    if (oldMeterError || !oldMeter) {
      return NextResponse.json({ error: 'Old meter not found' }, { status: 404 });
    }

    // 5. Verify hostel ownership
    const hostel = oldMeter.hostels as any;
    if (hostel.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this hostel' },
        { status: 403 }
      );
    }

    // 6. Execute replacement workflow
    const result = await replacePhysicalMeter({
      hostelId: oldMeter.hostel_id,
      roomId: oldMeter.room_id,
      oldMeterId: validated.old_meter_id,
      newMeterNumber: validated.new_meter_number,
      initialReading: validated.initial_reading,
      finalReading: validated.final_reading ?? undefined,
      finalReadingUnavailable: validated.final_reading_unavailable,
      notes: validated.notes,
      userId: user.id
    });

    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
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

    console.error('[Replace Meter API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to replace meter' },
      { status: error.message?.includes('already in use') ? 409 : 500 }
    );
  }
}
