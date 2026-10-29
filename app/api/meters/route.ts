import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

// Query parameter validation schema (Design Section 6.2.3)
const ListMetersQuerySchema = z.object({
  hostel_id: z.string().uuid('Invalid hostel ID format'),
  status: z.enum(['active', 'inactive']).optional()
});

interface LastReading {
  value: number;
  timestamp: string;
}

interface MeterListItem {
  id: string;
  room_id: string;
  room_number: string;
  meter_number: string;
  status: 'active' | 'inactive';
  last_reading: LastReading | null;
  open_segment_id: string | null;
  pending_reading: boolean;
}

interface ListMetersResponse {
  meters: MeterListItem[];
  total_count: number;
}

/**
 * GET /api/meters?hostel_id={hostelId}&status={status}
 * 
 * Retrieves list of electricity meters with enriched data for owner dashboard.
 * 
 * Requirements:
 * - REQ-12.1: Display all rooms with meter status
 * - REQ-12.3: Display meter_number, status, and last_reading_date
 * - REQ-12.6: Display rooms requiring meter readings with visual indicator
 * 
 * Design: Section 6.2.3
 * 
 * @param req - Request with query params hostel_id (required) and status (optional)
 * @returns List of meters with last reading, open segment, and pending reading indicators
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate the owner using request-based client (Bearer or cookies)
    const supabase = createClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[List Meters API] Authentication failed:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify user role is 'owner' using service role to bypass RLS
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('id, role, user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.log('[List Meters API] Profile lookup failed:', profileError.message);
      return NextResponse.json(
        { error: 'Failed to verify user profile' },
        { status: 403 }
      );
    }

    if (!profile) {
      console.log('[List Meters API] No profile found for user');
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 403 }
      );
    }

    if (profile.role !== 'owner' && profile.role !== 'hostel_owner') {
      console.log('[List Meters API] Authorization failed - not an owner. Actual role:', profile.role);
      return NextResponse.json(
        { error: 'Forbidden: Only hostel owners can list meters' },
        { status: 403 }
      );
    }

    // 3. Parse and validate query parameters
    const searchParams = req.nextUrl.searchParams;
    const hostelId = searchParams.get('hostel_id');
    const status = searchParams.get('status');

    if (!hostelId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: hostel_id' },
        { status: 400 }
      );
    }

    const validated = ListMetersQuerySchema.parse({
      hostel_id: hostelId,
      status: status || undefined
    });

    // 4. Verify hostel ownership (REQ-19.1)
    const { data: hostel, error: hostelError } = await supabaseServer
      .from('hostels')
      .select('id, owner_id, name')
      .eq('id', validated.hostel_id)
      .single();

    if (hostelError || !hostel) {
      console.log('[List Meters API] Hostel not found:', hostelError?.message);
      return NextResponse.json({ error: 'Hostel not found' }, { status: 404 });
    }

    if (hostel.owner_id !== user.id) {
      console.log('[List Meters API] Authorization failed - user does not own this hostel');
      return NextResponse.json(
        { error: 'Forbidden: You do not own this hostel' },
        { status: 403 }
      );
    }

    // 5. Query meters with enriched data (Design Section 6.2.3)
    const { data: metersData, error: metersError } = await supabaseServer.rpc(
      'get_meters_list',
      {
        p_hostel_id: validated.hostel_id,
        p_status: validated.status || null
      }
    );

    if (metersError) {
      console.error('[List Meters API] Failed to fetch meters:', metersError);
      return NextResponse.json(
        { error: 'Failed to fetch meters', details: metersError.message },
        { status: 500 }
      );
    }

    // 6. Enrich and validate pending_reading flags
    // A meter only genuinely requires an occupancy-change reading if an occupancy change (join/leave)
    // occurred strictly AFTER the latest recorded meter reading.
    const meters: MeterListItem[] = await Promise.all((metersData || []).map(async (meter: any) => {
      let isPending = Boolean(meter.pending_reading);

      // If no reading exists at all, it needs an initial baseline, not an occupancy change alert
      if (!meter.last_reading) {
        isPending = false;
      } else if (isPending && meter.last_reading.timestamp) {
        const lastReadingTs = new Date(meter.last_reading.timestamp).getTime();

        try {
          // Fetch pending occupancy change events for this room
          const { data: events } = await supabaseServer
            .from('occupancy_change_events')
            .select('id, change_timestamp, status')
            .eq('room_id', meter.room_id)
            .eq('status', 'pending_reading');

          if (events && events.length > 0) {
            // Find any event that happened strictly AFTER the last reading
            const newerEvents = events.filter((ev: any) => {
              const evTs = new Date(ev.change_timestamp).getTime();
              return evTs > lastReadingTs;
            });

            // Auto-complete stale events that occurred on or before last reading
            const staleEventIds = events
              .filter((ev: any) => new Date(ev.change_timestamp).getTime() <= lastReadingTs)
              .map((ev: any) => ev.id);

            if (staleEventIds.length > 0) {
              await supabaseServer
                .from('occupancy_change_events')
                .update({ 
                  status: 'completed', 
                  completed_at: new Date().toISOString() 
                })
                .in('id', staleEventIds);
            }

            isPending = newerEvents.length > 0;
          } else {
            isPending = false;
          }

          // Cross-verify with active room allocations:
          // If all active allocations for the room were created on or before the last reading, no new allocation exists
          if (isPending) {
            const { data: allocations } = await supabaseServer
              .from('room_allocations')
              .select('id, created_at, start_date')
              .eq('room_id', meter.room_id)
              .eq('active', true);

            if (allocations && allocations.length > 0) {
              const hasNewAllocation = allocations.some((al: any) => {
                const alTs = new Date(al.created_at || al.start_date).getTime();
                return alTs > lastReadingTs;
              });
              if (!hasNewAllocation) {
                isPending = false;
              }
            }
          }
        } catch (enrichErr) {
          console.warn('[List Meters API] Non-fatal error validating pending_reading:', enrichErr);
        }
      }

      return {
        id: meter.id,
        room_id: meter.room_id,
        room_number: meter.room_number,
        meter_number: meter.meter_number,
        status: meter.status,
        last_reading: meter.last_reading ? {
          value: parseFloat(meter.last_reading.value),
          timestamp: meter.last_reading.timestamp
        } : null,
        open_segment_id: meter.open_segment_id,
        pending_reading: isPending
      };
    }));

    const response: ListMetersResponse = {
      meters,
      total_count: meters.length
    };

    console.log('[List Meters API] Success:', {
      hostel_id: validated.hostel_id,
      status_filter: validated.status,
      count: meters.length
    });

    return NextResponse.json(response, { status: 200 });

  } catch (error: any) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      console.log('[List Meters API] Validation error:', error.errors);
      return NextResponse.json(
        { 
          error: 'Invalid query parameters',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }

    // Handle all other errors
    console.error('[List Meters API] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
