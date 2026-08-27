import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

// Query parameter validation schema (Design Section 6.4.2)
const BillingOverviewQuerySchema = z.object({
  hostel_id: z.string().uuid('Invalid hostel ID format'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format')
});

interface BillingOverviewRoom {
  room_id: string;
  room_number: string;
  segments_count: number;
  total_consumption: number;
  total_revenue_paise: number;
  total_revenue_rupees: number;
  empty_room_consumption: number;
}

interface BillingOverviewResponse {
  hostel_id: string;
  billing_month: string;
  rooms: BillingOverviewRoom[];
  summary: {
    total_consumption_all: number;
    total_consumption_occupied: number;
    total_consumption_empty: number;
    total_revenue_paise: number;
    total_revenue_rupees: number;
  };
}

/**
 * GET /api/billing/overview?hostel_id={hostelId}&month={YYYY-MM}
 * 
 * Retrieves billing overview for a hostel, aggregated by room.
 * Separates occupied and empty room consumption.
 * 
 * Requirements:
 * - REQ-16.1: Display monthly electricity billing summaries per room
 * - REQ-16.2: Show total Consumption, total_cost, and occupant_count for each Billing_Segment
 * - REQ-16.5: Highlight Empty_Room segments with zero student charges
 * 
 * Design: Section 6.4.2
 * 
 * @param req - Request with query params hostel_id and month (YYYY-MM)
 * @returns Billing overview with room-level aggregations and summary totals
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate the user using cookie-based client
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[Billing Overview API] Authentication failed:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify user is a hostel owner using service role to bypass RLS
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('id, role, user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.log('[Billing Overview API] Profile lookup failed:', profileError.message);
      return NextResponse.json(
        { error: 'Failed to verify user profile' },
        { status: 403 }
      );
    }

    if (!profile) {
      console.log('[Billing Overview API] No profile found for user');
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 403 }
      );
    }

    if (profile.role !== 'owner') {
      console.log('[Billing Overview API] Authorization failed - not an owner:', profile.role);
      return NextResponse.json(
        { error: 'Forbidden: Only hostel owners can view billing overview' },
        { status: 403 }
      );
    }

    // 3. Parse and validate query parameters
    const searchParams = req.nextUrl.searchParams;
    const hostelId = searchParams.get('hostel_id');
    const month = searchParams.get('month');

    if (!hostelId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: hostel_id' },
        { status: 400 }
      );
    }

    if (!month) {
      return NextResponse.json(
        { error: 'Missing required query parameter: month' },
        { status: 400 }
      );
    }

    const validated = BillingOverviewQuerySchema.parse({
      hostel_id: hostelId,
      month: month
    });

    // 4. Verify hostel ownership (REQ-19.1)
    const { data: hostel, error: hostelError } = await supabaseServer
      .from('hostels')
      .select('id, owner_id')
      .eq('id', validated.hostel_id)
      .single();

    if (hostelError || !hostel) {
      console.log('[Billing Overview API] Hostel not found:', hostelError?.message);
      return NextResponse.json(
        { error: 'Hostel not found' },
        { status: 404 }
      );
    }

    if (hostel.owner_id !== user.id) {
      console.log('[Billing Overview API] Authorization failed - not hostel owner');
      return NextResponse.json(
        { error: 'Forbidden: You can only view billing overview for your own hostels' },
        { status: 403 }
      );
    }

    // 5. Query billing data aggregated by room (Design Section 6.4.2)
    const { data: roomData, error: roomError } = await supabaseServer
      .from('rooms')
      .select(`
        id,
        room_number,
        billing_segments!inner(
          id,
          consumption_units,
          total_cost_paise,
          segment_type
        )
      `)
      .eq('hostel_id', validated.hostel_id)
      .eq('billing_segments.billing_month', validated.month)
      .order('room_number', { ascending: true });

    if (roomError) {
      console.error('[Billing Overview API] Failed to fetch room data:', roomError);
      return NextResponse.json(
        { error: 'Failed to fetch billing data', details: roomError.message },
        { status: 500 }
      );
    }

    // 6. Transform and aggregate data per room
    const roomMap = new Map<string, BillingOverviewRoom>();

    for (const room of roomData || []) {
      const segments = room.billing_segments as any[];
      
      if (!roomMap.has(room.id)) {
        roomMap.set(room.id, {
          room_id: room.id,
          room_number: room.room_number,
          segments_count: 0,
          total_consumption: 0,
          total_revenue_paise: 0,
          total_revenue_rupees: 0,
          empty_room_consumption: 0
        });
      }

      const roomData = roomMap.get(room.id)!;

      for (const segment of segments) {
        roomData.segments_count++;
        const consumption = parseFloat(segment.consumption_units || 0);
        roomData.total_consumption += consumption;

        if (segment.segment_type === 'occupied') {
          roomData.total_revenue_paise += segment.total_cost_paise || 0;
        } else if (segment.segment_type === 'empty') {
          roomData.empty_room_consumption += consumption;
        }
      }

      roomData.total_revenue_rupees = roomData.total_revenue_paise / 100;
    }

    // 7. Calculate summary totals
    const rooms = Array.from(roomMap.values());
    const summary = {
      total_consumption_all: rooms.reduce((sum, r) => sum + r.total_consumption, 0),
      total_consumption_occupied: rooms.reduce((sum, r) => sum + (r.total_consumption - r.empty_room_consumption), 0),
      total_consumption_empty: rooms.reduce((sum, r) => sum + r.empty_room_consumption, 0),
      total_revenue_paise: rooms.reduce((sum, r) => sum + r.total_revenue_paise, 0),
      total_revenue_rupees: 0
    };
    summary.total_revenue_rupees = summary.total_revenue_paise / 100;

    const response: BillingOverviewResponse = {
      hostel_id: validated.hostel_id,
      billing_month: validated.month,
      rooms,
      summary
    };

    console.log('[Billing Overview API] Success:', {
      hostel_id: validated.hostel_id,
      billing_month: validated.month,
      rooms_count: rooms.length,
      total_revenue_rupees: summary.total_revenue_rupees
    });

    return NextResponse.json(response, { status: 200 });

  } catch (error: any) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      console.log('[Billing Overview API] Validation error:', error.errors);
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
    console.error('[Billing Overview API] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
