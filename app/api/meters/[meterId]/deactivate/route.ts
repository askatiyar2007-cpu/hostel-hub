import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

// Request validation schema (Design Section 6.2.2)
const DeactivateMeterSchema = z.object({
  notes: z.string().optional()
});

interface DeactivateMeterResponse {
  success: boolean;
  message: string;
}

/**
 * POST /api/meters/:meterId/deactivate
 * 
 * Deactivates an electricity meter, preserving all historical data.
 * Blocks deactivation if open billing segments exist.
 * 
 * Requirements:
 * - REQ-1.5: Allow deactivation and creation of new meter for same room
 * - REQ-23.1: Prevent deactivating meter with open billing segments
 * - REQ-23.2: Preserve all historical meter data when deactivated
 * 
 * @param req - Request containing optional notes
 * @param params - Route params containing meterId
 * @returns Success status and message
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { meterId: string } }
) {
  try {
    const { meterId } = params;

    // Validate meterId format
    if (!meterId || typeof meterId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid meter ID' },
        { status: 400 }
      );
    }

    // 1. Authenticate the owner using cookie-based client
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[Deactivate Meter API] Authentication failed:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify user role is 'owner' using service role to bypass RLS
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('id, role, user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.log('[Deactivate Meter API] Profile lookup failed:', profileError.message);
      return NextResponse.json(
        { error: 'Failed to verify user profile' },
        { status: 403 }
      );
    }

    if (!profile) {
      console.log('[Deactivate Meter API] No profile found for user');
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 403 }
      );
    }

    if (profile.role !== 'owner' && profile.role !== 'hostel_owner') {
      console.log('[Deactivate Meter API] Authorization failed - not an owner. Actual role:', profile.role);
      return NextResponse.json(
        { error: 'Forbidden: Only hostel owners can deactivate meters' },
        { status: 403 }
      );
    }

    // 3. Parse and validate request body
    const body = await req.json();
    const validated = DeactivateMeterSchema.parse(body);

    // 4. Fetch meter and verify it exists
    const { data: meter, error: meterError } = await supabaseServer
      .from('electricity_meters')
      .select('id, hostel_id, room_id, meter_number, status')
      .eq('id', meterId)
      .single();

    if (meterError || !meter) {
      console.log('[Deactivate Meter API] Meter not found:', meterError?.message);
      return NextResponse.json({ error: 'Meter not found' }, { status: 404 });
    }

    // 5. Verify hostel ownership
    const { data: hostel, error: hostelError } = await supabaseServer
      .from('hostels')
      .select('id, owner_id, name')
      .eq('id', meter.hostel_id)
      .single();

    if (hostelError || !hostel) {
      console.log('[Deactivate Meter API] Hostel not found:', hostelError?.message);
      return NextResponse.json({ error: 'Hostel not found' }, { status: 404 });
    }

    if (hostel.owner_id !== user.id) {
      console.log('[Deactivate Meter API] Authorization failed - user does not own this hostel');
      return NextResponse.json(
        { error: 'Forbidden: You do not own this hostel' },
        { status: 403 }
      );
    }

    // 6. Check if meter is already inactive
    if (meter.status === 'inactive') {
      console.log('[Deactivate Meter API] Meter already inactive:', meterId);
      return NextResponse.json(
        { error: 'Meter is already inactive' },
        { status: 400 }
      );
    }

    // 7. Check for open billing segments (REQ-23.1)
    const { data: openSegments, error: segmentError } = await supabaseServer
      .from('billing_segments')
      .select('id')
      .eq('meter_id', meterId)
      .is('end_date', null);

    if (segmentError) {
      console.error('[Deactivate Meter API] Error checking open segments:', segmentError);
      return NextResponse.json(
        { error: 'Failed to check for open billing segments', details: segmentError.message },
        { status: 500 }
      );
    }

    if (openSegments && openSegments.length > 0) {
      console.log('[Deactivate Meter API] Cannot deactivate - open segments exist:', openSegments);
      return NextResponse.json(
        { 
          error: 'Cannot deactivate meter with open billing segments',
          message: 'Please close all open billing segments by recording a meter reading before deactivating this meter.',
          open_segment_count: openSegments.length
        },
        { status: 409 }
      );
    }

    // 8. Deactivate the meter (REQ-23.2 - preserves all historical data)
    const { error: updateError } = await supabaseServer
      .from('electricity_meters')
      .update({
        status: 'inactive',
        deactivated_at: new Date().toISOString(),
        deactivated_by: user.id,
        notes: validated.notes || null
      })
      .eq('id', meterId);

    if (updateError) {
      console.error('[Deactivate Meter API] Failed to deactivate meter:', updateError);
      return NextResponse.json(
        { error: 'Failed to deactivate meter', details: updateError.message },
        { status: 500 }
      );
    }

    // 9. Return success response
    const successMessage = `Meter ${meter.meter_number} has been deactivated. All historical data has been preserved.`;
    
    console.log('[Deactivate Meter API] Success:', {
      meter_id: meterId,
      hostel_id: meter.hostel_id,
      room_id: meter.room_id,
      deactivated_by: user.id
    });

    return NextResponse.json<DeactivateMeterResponse>({
      success: true,
      message: successMessage
    }, { status: 200 });

  } catch (error: any) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      console.log('[Deactivate Meter API] Validation error:', error.errors);
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
    console.error('[Deactivate Meter API] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
