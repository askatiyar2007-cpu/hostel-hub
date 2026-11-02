import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import { replacePhysicalMeter } from '@/lib/electricity/meter-replacement';
import { z } from 'zod';

const ReplaceMeterParamSchema = z.object({
  new_meter_number: z.string().min(1, 'New meter number is required').max(100, 'Meter number too long'),
  initial_reading: z.number().nonnegative('Initial reading must be non-negative'),
  final_reading: z.number().nonnegative('Final reading must be non-negative').optional().nullable(),
  final_reading_unavailable: z.boolean().optional(),
  notes: z.string().optional()
});

/**
 * POST /api/meters/:meterId/replace
 * Atomically replaces physical meter specified by route parameter
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { meterId: string } }
) {
  try {
    const supabase = createClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('id, role, user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile || (profile.role !== 'owner' && profile.role !== 'hostel_owner')) {
      return NextResponse.json(
        { error: 'Forbidden: Only hostel owners can replace electricity meters' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = ReplaceMeterParamSchema.parse(body);

    const { data: oldMeter } = await supabaseServer
      .from('electricity_meters')
      .select(`
        id,
        hostel_id,
        room_id,
        meter_number,
        hostels!inner (
          id,
          owner_id
        )
      `)
      .eq('id', params.meterId)
      .single();

    if (!oldMeter) {
      return NextResponse.json({ error: 'Old meter not found' }, { status: 404 });
    }

    const hostel = oldMeter.hostels as any;
    if (hostel.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this hostel' }, { status: 403 });
    }

    const result = await replacePhysicalMeter({
      hostelId: oldMeter.hostel_id,
      roomId: oldMeter.room_id,
      oldMeterId: params.meterId,
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

    return NextResponse.json(
      { error: error.message || 'Failed to replace meter' },
      { status: error.message?.includes('already in use') ? 409 : 500 }
    );
  }
}
