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
    // 1. Authenticate the owner using cookie-based client
    const supabase = createClient();
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

    // 6. Transform database response to API response format
    const meters: MeterListItem[] = (metersData || []).map((meter: any) => ({
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
      pending_reading: meter.pending_reading
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
