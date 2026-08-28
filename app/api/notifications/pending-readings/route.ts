import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

// Query parameter validation schema (Design Section 6.6.1)
const PendingReadingsQuerySchema = z.object({
  hostel_id: z.string().uuid('Invalid hostel ID format')
});

// Response types based on Design Section 6.6.1
interface PendingReadingItem {
  room_id: string;
  room_number: string;
  meter_id: string;
  meter_number: string;
  reason: 'occupancy_change' | 'month_end';
  deadline: string | null;
  priority: 'high' | 'medium';
  event_details?: {
    change_type: 'student_join' | 'student_leave';
    student_name: string;
  };
}

interface PendingReadingsResponse {
  hostel_id: string;
  pending_count: number;
  readings: PendingReadingItem[];
}

/**
 * GET /api/notifications/pending-readings?hostel_id={hostelId}
 * 
 * Retrieves list of pending meter readings that require owner attention.
 * Includes both occupancy change events and month-end reminders.
 * 
 * Requirements:
 * - REQ-15.2: Lists rooms requiring readings due to pending occupancy changes and month-end
 * - REQ-15.3: Sorts by priority (occupancy_change before month_end)
 * - REQ-25.1: High-priority notifications for occupancy changes
 * 
 * Design: Section 6.6.1
 * 
 * @param req - Request with query param hostel_id (required)
 * @returns List of pending readings sorted by priority and deadline
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate the owner using cookie-based client
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[Pending Readings API] Authentication failed:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify user role is 'owner' using service role to bypass RLS
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('id, role, user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.log('[Pending Readings API] Profile lookup failed:', profileError.message);
      return NextResponse.json(
        { error: 'Failed to verify user profile' },
        { status: 403 }
      );
    }

    if (!profile) {
      console.log('[Pending Readings API] No profile found for user');
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 403 }
      );
    }

    if (profile.role !== 'owner' && profile.role !== 'hostel_owner') {
      console.log('[Pending Readings API] Authorization failed - not an owner. Actual role:', profile.role);
      return NextResponse.json(
        { error: 'Forbidden: Only hostel owners can view pending readings' },
        { status: 403 }
      );
    }

    // 3. Parse and validate query parameters
    const searchParams = req.nextUrl.searchParams;
    const hostelId = searchParams.get('hostel_id');

    if (!hostelId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: hostel_id' },
        { status: 400 }
      );
    }

    const validated = PendingReadingsQuerySchema.parse({
      hostel_id: hostelId
    });

    // 4. Verify hostel ownership (REQ-19.1)
    const { data: hostel, error: hostelError } = await supabaseServer
      .from('hostels')
      .select('id, owner_id, name')
      .eq('id', validated.hostel_id)
      .single();

    if (hostelError || !hostel) {
      console.log('[Pending Readings API] Hostel not found:', hostelError?.message);
      return NextResponse.json({ error: 'Hostel not found' }, { status: 404 });
    }

    if (hostel.owner_id !== user.id) {
      console.log('[Pending Readings API] Authorization failed - user does not own this hostel');
      return NextResponse.json(
        { error: 'Forbidden: You do not own this hostel' },
        { status: 403 }
      );
    }

    // 5. Query occupancy change pending readings (REQ-25.1: high priority)
    const { data: occupancyChangeData, error: occupancyError } = await supabaseServer
      .from('occupancy_change_events')
      .select(`
        room_id,
        reading_deadline,
        change_type,
        rooms!inner (
          room_number
        ),
        electricity_meters!inner (
          id,
          meter_number
        ),
        profiles!inner (
          full_name
        )
      `)
      .eq('hostel_id', validated.hostel_id)
      .eq('status', 'pending_reading')
      .eq('electricity_meters.status', 'active');

    if (occupancyError) {
      console.error('[Pending Readings API] Failed to fetch occupancy changes:', occupancyError);
      return NextResponse.json(
        { error: 'Failed to fetch occupancy change events', details: occupancyError.message },
        { status: 500 }
      );
    }

    // 6. Query month-end pending readings (medium priority)
    // Month-end readings are needed for rooms with active meters where:
    // - Last reading was before the current month
    // - No occupancy change is pending
    const { data: monthEndData, error: monthEndError } = await supabaseServer.rpc(
      'get_month_end_pending_readings',
      { p_hostel_id: validated.hostel_id }
    );

    if (monthEndError) {
      // If function doesn't exist yet, log warning and continue with empty array
      console.warn('[Pending Readings API] Month-end readings function not available:', monthEndError.message);
    }

    // 7. Transform occupancy change events to PendingReadingItem format
    const occupancyReadings: PendingReadingItem[] = (occupancyChangeData || []).map((event: any) => ({
      room_id: event.room_id,
      room_number: event.rooms.room_number,
      meter_id: event.electricity_meters.id,
      meter_number: event.electricity_meters.meter_number,
      reason: 'occupancy_change' as const,
      deadline: event.reading_deadline,
      priority: 'high' as const,
      event_details: {
        change_type: event.change_type,
        student_name: event.profiles.full_name
      }
    }));

    // 8. Transform month-end data to PendingReadingItem format
    const monthEndReadings: PendingReadingItem[] = (monthEndData || []).map((item: any) => ({
      room_id: item.room_id,
      room_number: item.room_number,
      meter_id: item.meter_id,
      meter_number: item.meter_number,
      reason: 'month_end' as const,
      deadline: item.deadline,
      priority: 'medium' as const
    }));

    // 9. Combine and sort by priority (high first) and deadline (REQ-15.3)
    const allReadings = [...occupancyReadings, ...monthEndReadings];
    
    allReadings.sort((a, b) => {
      // First sort by priority: high before medium
      if (a.priority !== b.priority) {
        return a.priority === 'high' ? -1 : 1;
      }
      
      // Then sort by deadline (earliest first)
      if (a.deadline && b.deadline) {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      
      // If one has deadline and other doesn't, prioritize the one with deadline
      if (a.deadline && !b.deadline) return -1;
      if (!a.deadline && b.deadline) return 1;
      
      return 0;
    });

    const response: PendingReadingsResponse = {
      hostel_id: validated.hostel_id,
      pending_count: allReadings.length,
      readings: allReadings
    };

    console.log('[Pending Readings API] Success:', {
      hostel_id: validated.hostel_id,
      occupancy_changes: occupancyReadings.length,
      month_end: monthEndReadings.length,
      total: allReadings.length
    });

    return NextResponse.json(response, { status: 200 });

  } catch (error: any) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      console.log('[Pending Readings API] Validation error:', error.errors);
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
    console.error('[Pending Readings API] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
