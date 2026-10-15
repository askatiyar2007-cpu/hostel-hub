import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

// Query parameter validation schema (Design Section 6.4.2)
const BillingOverviewQuerySchema = z.object({
  hostel_id: z.string().uuid('Invalid hostel ID format'),
  billing_month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format')
});

export type ElectricityBillingStatus =
  | 'paid'
  | 'pending_verification'
  | 'payment_due'
  | 'recorded_unbilled'
  | 'awaiting_initial_reading'
  | 'awaiting_allocation_reading'
  | 'awaiting_month_end_reading'
  | 'zero_consumption'
  | 'unmetered';

export interface BillingOverviewStudent {
  student_id: string;
  student_name: string;
  student_email: string;
  room_id: string;
  room_number: string;
  allocation_id: string;
  allocation_start: string;
  allocation_end?: string | null;
  meter_id?: string | null;
  meter_number?: string | null;
  consumption_units: number;
  charge_amount_paise: number;
  charge_amount_rupees: number;
  status: ElectricityBillingStatus;
  status_label: string;
  fee_id?: string | null;
  fee_status?: string | null;
  segments_count: number;
}

export interface BillingOverviewRoom {
  room_id: string;
  room_number: string;
  floor?: number;
  capacity?: number;
  occupancy?: number;
  meter_id?: string | null;
  meter_number?: string | null;
  segments_count: number;
  total_consumption: number;
  total_revenue_paise: number;
  total_revenue_rupees: number;
  empty_room_consumption: number;
  status: 'occupied' | 'empty' | 'mixed' | 'unmetered' | 'awaiting_reading';
}

export interface BillingOverviewResponse {
  hostel_id: string;
  billing_month: string;
  rooms: BillingOverviewRoom[];
  students: BillingOverviewStudent[];
  summary: {
    total_consumption_all: number;
    total_consumption_occupied: number;
    total_consumption_empty: number;
    total_revenue_paise: number;
    total_revenue_rupees: number;
    total_students: number;
    total_metered_rooms: number;
  };
}

/**
 * GET /api/billing/overview?hostel_id={hostelId}&billing_month={YYYY-MM}
 * 
 * Retrieves billing overview for a hostel:
 * - Complete list of allocated students and their authoritative billing states
 * - Room-level sub-meter aggregations and consumption
 * - Summary totals
 * 
 * Authoritative States:
 * 1. Paid (valid charge, fee paid)
 * 2. Pending Verification (valid charge, fee payment proof submitted)
 * 3. Payment Due (valid charge, fee unpaid/overdue)
 * 4. Recorded Consumption Unbilled (segments/readings recorded, charges pending generation)
 * 5. Awaiting Initial Reading (room has meter, baseline reading required)
 * 6. Awaiting Allocation Reading (student allocated, allocation reading required)
 * 7. Awaiting Month-End Reading (active cycle, month-end reading required)
 * 8. Zero Consumption (meter reading recorded with 0 consumption)
 * 9. Unmetered (room has no active sub-meter)
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate the user (supports cookies and mobile Bearer JWT)
    const supabase = createClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[Billing Overview API] Authentication failed:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse and validate query parameters
    const searchParams = req.nextUrl.searchParams;
    const hostelId = searchParams.get('hostel_id');
    const billing_month = searchParams.get('billing_month');

    if (!hostelId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: hostel_id' },
        { status: 400 }
      );
    }

    if (!billing_month) {
      return NextResponse.json(
        { error: 'Missing required query parameter: billing_month' },
        { status: 400 }
      );
    }

    const validated = BillingOverviewQuerySchema.parse({
      hostel_id: hostelId,
      billing_month: billing_month
    });

    // 3. Verify user is a hostel owner using service role to bypass RLS
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

    if (profile.role !== 'owner' && profile.role !== 'hostel_owner') {
      console.log('[Billing Overview API] Authorization failed - not an owner:', profile.role);
      return NextResponse.json(
        { error: 'Forbidden: Only hostel owners can view billing overview' },
        { status: 403 }
      );
    }

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

    // 5. Fetch all rooms in this hostel (LEFT JOIN semantics - never drop rooms)
    const { data: roomsData, error: roomsError } = await supabaseServer
      .from('rooms')
      .select('id, room_number, floor, capacity, occupancy')
      .eq('hostel_id', validated.hostel_id)
      .order('room_number', { ascending: true });

    if (roomsError) {
      console.error('[Billing Overview API] Failed to fetch rooms:', roomsError);
      return NextResponse.json(
        { error: 'Failed to fetch rooms', details: roomsError.message },
        { status: 500 }
      );
    }

    const allRooms = roomsData || [];
    const roomById = new Map<string, typeof allRooms[0]>();
    for (const r of allRooms) {
      roomById.set(r.id, r);
    }

    // 6. Fetch active electricity meters for this hostel
    const { data: metersData } = await supabaseServer
      .from('electricity_meters')
      .select('id, room_id, meter_number, status')
      .eq('hostel_id', validated.hostel_id)
      .eq('status', 'active');

    const activeMeters = metersData || [];
    const meterByRoomId = new Map<string, typeof activeMeters[0]>();
    for (const m of activeMeters) {
      meterByRoomId.set(m.room_id, m);
    }

    // 7. Fetch meter readings for meters in this hostel
    const { data: readingsData } = await supabaseServer
      .from('meter_readings')
      .select('id, meter_id, room_id, reading_value, reading_timestamp, reason')
      .eq('hostel_id', validated.hostel_id)
      .order('reading_timestamp', { ascending: false });

    const readingsByMeterId = new Map<string, typeof readingsData>();
    for (const rd of (readingsData || [])) {
      const arr = readingsByMeterId.get(rd.meter_id) || [];
      arr.push(rd);
      readingsByMeterId.set(rd.meter_id, arr);
    }

    // 8. Fetch billing segments for this hostel and month
    const { data: segmentsData } = await supabaseServer
      .from('billing_segments')
      .select('id, room_id, meter_id, start_date, end_date, consumption_units, total_cost_paise, segment_type, occupant_count, rate_per_unit')
      .eq('hostel_id', validated.hostel_id)
      .eq('billing_month', validated.billing_month);

    const segmentsByRoomId = new Map<string, typeof segmentsData>();
    const segmentById = new Map<string, any>();
    for (const s of (segmentsData || [])) {
      segmentById.set(s.id, s);
      const arr = segmentsByRoomId.get(s.room_id) || [];
      arr.push(s);
      segmentsByRoomId.set(s.room_id, arr);
    }

    // 9. Fetch student electricity charges for this hostel and month
    const { data: chargesData } = await supabaseServer
      .from('student_electricity_charges')
      .select('id, segment_id, student_id, room_id, charge_amount_paise, billing_month')
      .eq('hostel_id', validated.hostel_id)
      .eq('billing_month', validated.billing_month);

    const chargesByStudentId = new Map<string, typeof chargesData>();
    for (const c of (chargesData || [])) {
      const arr = chargesByStudentId.get(c.student_id) || [];
      arr.push(c);
      chargesByStudentId.set(c.student_id, arr);
    }

    // 10. Fetch student fees for this hostel and month
    const { data: feesData } = await supabaseServer
      .from('student_fees')
      .select('id, student_id, room_id, amount, status, due_date, billing_period')
      .eq('hostel_id', validated.hostel_id)
      .eq('billing_period', validated.billing_month);

    const fees = feesData || [];
    const feesByStudentId = new Map<string, any>();
    for (const f of fees) {
      feesByStudentId.set(f.student_id, f);
    }

    // 11. Fetch room allocations overlapping this billing month
    const [year, monthNum] = validated.billing_month.split('-').map(Number);
    const startOfMonth = `${validated.billing_month}-01`;
    const lastDayOfMonth = new Date(year, monthNum, 0).getDate();
    const endOfMonth = `${validated.billing_month}-${String(lastDayOfMonth).padStart(2, '0')}`;

    const { data: allocationsData } = await supabaseServer
      .from('room_allocations')
      .select(`
        id,
        room_id,
        student_id,
        student_name,
        student_email,
        student_phone,
        start_date,
        end_date,
        active,
        students (
          id,
          profile_id,
          profiles (
            full_name,
            email,
            phone_number
          )
        )
      `)
      .eq('hostel_id', validated.hostel_id)
      .lte('start_date', endOfMonth)
      .or(`end_date.is.null,end_date.gte.${startOfMonth}`);

    const allocations = allocationsData || [];

    // 12. Build authoritative student billing entries
    const studentsList: BillingOverviewStudent[] = [];

    for (const alloc of allocations) {
      const room = roomById.get(alloc.room_id);
      const roomNumber = room?.room_number || 'Unknown';
      const meter = meterByRoomId.get(alloc.room_id);

      // Resolve student display details
      const studentProfile = (alloc.students as any)?.profiles;
      const studentName = alloc.student_name || studentProfile?.full_name || 'Allocated Student';
      const studentEmail = alloc.student_email || studentProfile?.email || '';

      // Match charges for this student
      // Match on either alloc.student_id or alloc.students?.id (depending on schema reference)
      const studentKeys = [alloc.student_id, (alloc.students as any)?.id].filter(Boolean);
      let matchedCharges: any[] = [];
      let matchedFee: any = null;

      for (const k of studentKeys) {
        if (chargesByStudentId.has(k)) {
          matchedCharges = chargesByStudentId.get(k)!;
          break;
        }
      }
      for (const k of studentKeys) {
        if (feesByStudentId.has(k)) {
          matchedFee = feesByStudentId.get(k);
          break;
        }
      }

      const roomSegments = segmentsByRoomId.get(alloc.room_id) || [];
      const meterReadings = meter ? (readingsByMeterId.get(meter.id) || []) : [];

      let status: ElectricityBillingStatus;
      let status_label: string;
      let consumption_units = 0;
      let charge_amount_paise = 0;
      let segments_count = 0;

      if (!meter) {
        status = 'unmetered';
        status_label = 'Unmetered';
      } else if (meterReadings.length === 0) {
        status = 'awaiting_initial_reading';
        status_label = 'Awaiting Initial Reading';
      } else if (matchedCharges.length > 0) {
        // Valid charges recorded
        segments_count = matchedCharges.length;
        for (const c of matchedCharges) {
          charge_amount_paise += c.charge_amount_paise || 0;
          const seg = segmentById.get(c.segment_id);
          if (seg) {
            const segUnits = parseFloat(seg.consumption_units || 0);
            const occupants = Math.max(1, seg.occupant_count || 1);
            consumption_units += segUnits / occupants;
          }
        }

        if (matchedFee?.status === 'paid') {
          status = 'paid';
          status_label = 'Billed (Paid)';
        } else if (matchedFee?.status === 'pending_verification') {
          status = 'pending_verification';
          status_label = 'Billed (Pending Verification)';
        } else {
          status = 'payment_due';
          status_label = 'Billed (Payment Due)';
        }
      } else if (roomSegments.length > 0) {
        // Room segments exist for this month but no charges generated for student yet
        segments_count = roomSegments.length;
        let totalRoomUnits = 0;
        for (const seg of roomSegments) {
          const segUnits = parseFloat(seg.consumption_units || 0);
          totalRoomUnits += segUnits;
          const occupants = Math.max(1, seg.occupant_count || 1);
          consumption_units += segUnits / occupants;
        }

        if (totalRoomUnits === 0) {
          status = 'zero_consumption';
          status_label = 'Zero Consumption';
        } else {
          status = 'recorded_unbilled';
          status_label = 'Recorded (Unbilled)';
        }
      } else {
        // No closed segments for this month yet
        // Check if allocation requires an allocation reading
        const allocStart = new Date(alloc.start_date).getTime();
        const latestReadingTime = meterReadings.length > 0 ? new Date(meterReadings[0].reading_timestamp).getTime() : 0;

        if (allocStart > latestReadingTime) {
          status = 'awaiting_allocation_reading';
          status_label = 'Awaiting Allocation Reading';
        } else {
          status = 'awaiting_month_end_reading';
          status_label = 'Awaiting Month-End Reading';
        }
      }

      studentsList.push({
        student_id: alloc.student_id,
        student_name: studentName,
        student_email: studentEmail,
        room_id: alloc.room_id,
        room_number: roomNumber,
        allocation_id: alloc.id,
        allocation_start: alloc.start_date,
        allocation_end: alloc.end_date,
        meter_id: meter?.id || null,
        meter_number: meter?.meter_number || null,
        consumption_units: Math.round(consumption_units * 100) / 100,
        charge_amount_paise,
        charge_amount_rupees: charge_amount_paise / 100,
        status,
        status_label,
        fee_id: matchedFee?.id || null,
        fee_status: matchedFee?.status || null,
        segments_count
      });
    }

    // 13. Build room-level aggregations (including rooms without segments)
    const roomsList: BillingOverviewRoom[] = [];

    for (const room of allRooms) {
      const meter = meterByRoomId.get(room.id);
      const roomSegments = segmentsByRoomId.get(room.id) || [];
      const meterReadings = meter ? (readingsByMeterId.get(meter.id) || []) : [];

      let total_consumption = 0;
      let total_revenue_paise = 0;
      let empty_room_consumption = 0;

      for (const seg of roomSegments) {
        const consumption = parseFloat(seg.consumption_units || 0);
        total_consumption += consumption;

        if (seg.segment_type === 'occupied') {
          total_revenue_paise += seg.total_cost_paise || 0;
        } else if (seg.segment_type === 'empty') {
          empty_room_consumption += consumption;
        }
      }

      let roomStatus: BillingOverviewRoom['status'] = 'occupied';
      if (!meter) {
        roomStatus = 'unmetered';
      } else if (meterReadings.length === 0) {
        roomStatus = 'awaiting_reading';
      } else if (empty_room_consumption > 0 && total_consumption > empty_room_consumption) {
        roomStatus = 'mixed';
      } else if (empty_room_consumption > 0 || (room.occupancy === 0 && roomSegments.length === 0)) {
        roomStatus = 'empty';
      }

      roomsList.push({
        room_id: room.id,
        room_number: room.room_number,
        floor: room.floor,
        capacity: room.capacity,
        occupancy: room.occupancy,
        meter_id: meter?.id || null,
        meter_number: meter?.meter_number || null,
        segments_count: roomSegments.length,
        total_consumption: Math.round(total_consumption * 100) / 100,
        total_revenue_paise,
        total_revenue_rupees: total_revenue_paise / 100,
        empty_room_consumption: Math.round(empty_room_consumption * 100) / 100,
        status: roomStatus
      });
    }

    // 14. Calculate summary totals
    const total_revenue_paise = roomsList.reduce((sum, r) => sum + r.total_revenue_paise, 0);
    const total_consumption_all = roomsList.reduce((sum, r) => sum + r.total_consumption, 0);
    const total_consumption_empty = roomsList.reduce((sum, r) => sum + r.empty_room_consumption, 0);
    const total_consumption_occupied = Math.max(0, total_consumption_all - total_consumption_empty);

    const summary = {
      total_consumption_all: Math.round(total_consumption_all * 100) / 100,
      total_consumption_occupied: Math.round(total_consumption_occupied * 100) / 100,
      total_consumption_empty: Math.round(total_consumption_empty * 100) / 100,
      total_revenue_paise,
      total_revenue_rupees: total_revenue_paise / 100,
      total_students: studentsList.length,
      total_metered_rooms: activeMeters.length
    };

    const response: BillingOverviewResponse = {
      hostel_id: validated.hostel_id,
      billing_month: validated.billing_month,
      rooms: roomsList,
      students: studentsList,
      summary
    };

    console.log('[Billing Overview API] Success:', {
      hostel_id: validated.hostel_id,
      billing_month: validated.billing_month,
      rooms_count: roomsList.length,
      students_count: studentsList.length,
      total_revenue_rupees: summary.total_revenue_rupees
    });

    return NextResponse.json(response, { status: 200 });

  } catch (error: any) {
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

    console.error('[Billing Overview API] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
