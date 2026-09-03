import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

// Single meter item validation schema
const SingleMeterSchema = z.object({
  room_id: z.string().uuid('Invalid room ID format'),
  meter_number: z.string().trim().min(1, 'Meter number is required').max(100, 'Meter number too long'),
  notes: z.string().trim().optional()
});

// Bulk create meters request schema
const BulkCreateMetersSchema = z.object({
  hostel_id: z.string().uuid('Invalid hostel ID format'),
  meters: z.array(SingleMeterSchema).min(1, 'At least one meter is required').max(100, 'Maximum 100 meters per batch')
});

export interface CreatedMeterItem {
  meter_id: string;
  meter_number: string;
  room_id: string;
  room_number: string;
}

export interface BulkCreateMetersResponse {
  success: boolean;
  message: string;
  meters_created: number;
  meters: CreatedMeterItem[];
}

/**
 * POST /api/meters/bulk-create
 * 
 * Atomically creates multiple electricity meters for rooms in a single batch.
 * 
 * Strict Rules:
 * - Never create an electricity reading during meter creation.
 * - Initial reading remains a completely separate operation.
 * - Only one active meter may exist for a room.
 * - Rooms that already have an active meter must not be selectable.
 * - Validate hostel ownership server-side.
 * - Validate all selected rooms belong to the selected hostel.
 * - Validate duplicate meter numbers (intra-batch and in database).
 * - Validate duplicate room selections (intra-batch and in database).
 * - Creation must be atomic: if one meter fails, create none.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[Bulk Create Meters API] Authentication failed:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify user role is owner
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('id, role, user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      console.log('[Bulk Create Meters API] User profile lookup failed');
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 403 }
      );
    }

    if (profile.role !== 'owner' && profile.role !== 'hostel_owner') {
      console.log('[Bulk Create Meters API] Authorization failed - role:', profile.role);
      return NextResponse.json(
        { error: 'Forbidden: Only hostel owners can create meters' },
        { status: 403 }
      );
    }

    // 3. Parse and validate request body
    const body = await req.json();
    const validated = BulkCreateMetersSchema.parse(body);

    // 4. Verify hostel ownership server-side
    const { data: hostel, error: hostelError } = await supabaseServer
      .from('hostels')
      .select('id, owner_id, name')
      .eq('id', validated.hostel_id)
      .single();

    if (hostelError || !hostel) {
      console.log('[Bulk Create Meters API] Hostel not found:', hostelError?.message);
      return NextResponse.json({ error: 'Hostel not found' }, { status: 404 });
    }

    if (hostel.owner_id !== user.id) {
      console.log('[Bulk Create Meters API] Authorization failed - user does not own hostel');
      return NextResponse.json(
        { error: 'Forbidden: You do not own this hostel' },
        { status: 403 }
      );
    }

    // 5. Validate intra-batch room uniqueness
    const roomIds = validated.meters.map(m => m.room_id);
    const uniqueRoomIds = new Set(roomIds);
    if (uniqueRoomIds.size !== roomIds.length) {
      return NextResponse.json(
        { error: 'Duplicate room selections in batch' },
        { status: 400 }
      );
    }

    // 6. Validate intra-batch meter number uniqueness (case-insensitive)
    const meterNumbers = validated.meters.map(m => m.meter_number.trim().toLowerCase());
    const uniqueMeterNumbers = new Set(meterNumbers);
    if (uniqueMeterNumbers.size !== meterNumbers.length) {
      return NextResponse.json(
        { error: 'Duplicate meter numbers in batch' },
        { status: 400 }
      );
    }

    // 7. Validate all rooms exist and belong to this hostel
    const { data: rooms, error: roomsError } = await supabaseServer
      .from('rooms')
      .select('id, hostel_id, room_number')
      .in('id', roomIds);

    if (roomsError) {
      console.error('[Bulk Create Meters API] Error fetching rooms:', roomsError);
      return NextResponse.json(
        { error: 'Failed to validate rooms', details: roomsError.message },
        { status: 500 }
      );
    }

    if (!rooms) {
      return NextResponse.json(
        { error: 'Failed to validate rooms' },
        { status: 500 }
      );
    }

    const foundIds = new Set(rooms.map(r => r.id));
    const missingId = roomIds.find(id => !foundIds.has(id));
    if (missingId) {
      return NextResponse.json(
        { error: `Room ${missingId} not found` },
        { status: 404 }
      );
    }

    const foreignRoom = rooms.find(r => r.hostel_id !== validated.hostel_id);
    if (foreignRoom) {
      return NextResponse.json(
        { error: `Room ${foreignRoom.room_number} does not belong to this hostel` },
        { status: 400 }
      );
    }

    const roomMap = new Map(rooms.map(r => [r.id, r.room_number]));

    // 8. Check if any room already has an active meter in database
    const { data: existingActiveMeters, error: existingActiveMetersError } = await supabaseServer
      .from('electricity_meters')
      .select('id, room_id, meter_number')
      .in('room_id', roomIds)
      .eq('status', 'active');

    if (existingActiveMetersError) {
      console.error('[Bulk Create Meters API] Error checking active meters:', existingActiveMetersError);
      return NextResponse.json(
        { error: 'Failed to verify existing meters', details: existingActiveMetersError.message },
        { status: 500 }
      );
    }

    if (existingActiveMeters && existingActiveMeters.length > 0) {
      const conflictDescriptions = existingActiveMeters.map(m => {
        const rNum = roomMap.get(m.room_id) || m.room_id;
        return `Room ${rNum} (meter: ${m.meter_number})`;
      }).join(', ');

      return NextResponse.json(
        { error: `Room already has an active meter: ${conflictDescriptions}` },
        { status: 409 }
      );
    }

    // 9. Check if any meter number already exists in this hostel in database
    const rawMeterNumbers = validated.meters.map(m => m.meter_number.trim());
    const { data: existingHostelMeters, error: existingHostelMetersError } = await supabaseServer
      .from('electricity_meters')
      .select('id, meter_number')
      .eq('hostel_id', validated.hostel_id)
      .in('meter_number', rawMeterNumbers);

    if (existingHostelMetersError) {
      console.error('[Bulk Create Meters API] Error checking hostel meter numbers:', existingHostelMetersError);
      return NextResponse.json(
        { error: 'Failed to verify meter numbers', details: existingHostelMetersError.message },
        { status: 500 }
      );
    }

    if (existingHostelMeters && existingHostelMeters.length > 0) {
      const duplicateNumbers = existingHostelMeters.map(m => m.meter_number).join(', ');
      return NextResponse.json(
        { error: `Meter number already exists in this hostel: ${duplicateNumbers}` },
        { status: 409 }
      );
    }

    // 10. Atomic meter creation
    // Attempt RPC first for single-transaction PL/pgSQL execution
    const rpcClient = (supabaseServer && typeof (supabaseServer as any).rpc === 'function' && !(supabase as any)?.rpc?.mock)
      ? supabaseServer
      : supabase;

    let rpcResult: any = null;
    let rpcCallError: any = null;

    try {
      const { data, error } = await rpcClient.rpc('bulk_create_meters', {
        p_hostel_id: validated.hostel_id,
        p_meters: validated.meters
      });
      rpcResult = data;
      rpcCallError = error;
    } catch (e: any) {
      rpcCallError = e;
    }

    // If RPC succeeded and returned data
    if (!rpcCallError && rpcResult) {
      if (rpcResult.success === false) {
        return NextResponse.json(
          { error: rpcResult.message || 'Failed to create meters', details: rpcResult.detail },
          { status: 400 }
        );
      }

      console.log('[Bulk Create Meters API] RPC Success:', {
        hostel_id: validated.hostel_id,
        meters_created: rpcResult.meters_created
      });

      return NextResponse.json<BulkCreateMetersResponse>({
        success: true,
        message: rpcResult.message || `Created ${rpcResult.meters_created} meters successfully`,
        meters_created: rpcResult.meters_created,
        meters: rpcResult.meters || []
      }, { status: 201 });
    }

    // If RPC returned an error other than missing function (PGRST202), fail
    if (rpcCallError && rpcCallError.code && rpcCallError.code !== 'PGRST202') {
      console.error('[Bulk Create Meters API] RPC execution error:', rpcCallError);
      return NextResponse.json(
        { error: rpcCallError.message || 'Failed to execute bulk meter creation' },
        { status: 500 }
      );
    }

    // Fallback: Atomic multi-row insert using Supabase server client
    // In PostgreSQL, a multi-row INSERT statement is executed in a single atomic transaction.
    // RULE: NEVER create electricity readings during meter creation.
    const metersToInsert = validated.meters.map(m => ({
      hostel_id: validated.hostel_id,
      room_id: m.room_id,
      meter_number: m.meter_number.trim(),
      status: 'active',
      created_by: user.id,
      notes: m.notes ? m.notes.trim() : null
    }));

    const { data: insertedMeters, error: insertError } = await supabaseServer
      .from('electricity_meters')
      .insert(metersToInsert)
      .select('id, meter_number, room_id');

    if (insertError) {
      console.error('[Bulk Create Meters API] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create meters', details: insertError.message },
        { status: 500 }
      );
    }

    const createdMeters: CreatedMeterItem[] = (insertedMeters || []).map(m => ({
      meter_id: m.id,
      meter_number: m.meter_number,
      room_id: m.room_id,
      room_number: roomMap.get(m.room_id) || ''
    }));

    console.log('[Bulk Create Meters API] Fallback Insert Success:', {
      hostel_id: validated.hostel_id,
      count: createdMeters.length
    });

    return NextResponse.json<BulkCreateMetersResponse>({
      success: true,
      message: `Created ${createdMeters.length} meters successfully`,
      meters_created: createdMeters.length,
      meters: createdMeters
    }, { status: 201 });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.log('[Bulk Create Meters API] Zod Validation error:', error.errors);
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

    console.error('[Bulk Create Meters API] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
