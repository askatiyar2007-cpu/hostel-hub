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
  consumption_calculable: boolean;
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
  consumption_calculable: boolean;
  status: 'occupied' | 'empty' | 'mixed' | 'unmetered' | 'awaiting_reading' | 'zero_consumption';
  detailed_status: ElectricityBillingStatus;
  status_label: string;
  initial_reading?: {
    id: string;
    value: number;
    timestamp: string;
    reason: string;
  } | null;
  latest_reading?: {
    id: string;
    value: number;
    timestamp: string;
    reason: string;
  } | null;
  current_occupants: {
    student_id: string;
    student_name: string;
    student_email?: string | null;
  }[];
  student_charges_paise: number;
  student_charges_rupees: number;
  closed_segments_count?: number;
  open_segments_count?: number;
  is_cycle_in_progress?: boolean;
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
    rooms_awaiting_reading: number;
    rooms_with_calculable_consumption: number;
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

    // 10b. Fetch payments recorded against these fees to verify true payment coverage
    const feeIds = fees.map(f => f.id);
    const paymentsByFeeId = new Map<string, any[]>();
    if (feeIds.length > 0) {
      const { data: paymentsData } = await supabaseServer
        .from('payments')
        .select('id, fee_id, amount, status')
        .in('fee_id', feeIds);
      for (const p of (paymentsData || [])) {
        if (!p.fee_id) continue;
        const arr = paymentsByFeeId.get(p.fee_id) || [];
        arr.push(p);
        paymentsByFeeId.set(p.fee_id, arr);
      }
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

        const feePayments = matchedFee ? (paymentsByFeeId.get(matchedFee.id) || []) : [];
        const completedPaidAmount = feePayments
          .filter(p => p.status === 'completed')
          .reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const pendingVerificationAmount = feePayments
          .filter(p => p.status === 'pending_verification')
          .reduce((sum, p) => sum + Number(p.amount || 0), 0);

        const rentAmount = matchedFee ? Number(matchedFee.amount || 0) : 0;
        const electricityAmountRupees = charge_amount_paise / 100;
        const totalDueRupees = rentAmount + electricityAmountRupees;

        // Accurate payment attribution:
        // Rent being paid does NOT mark electricity paid unless total verified payments cover both rent + electricity.
        if (completedPaidAmount >= totalDueRupees - 0.01 && totalDueRupees > 0) {
          status = 'paid';
          status_label = 'Billed (Paid)';
        } else if (completedPaidAmount + pendingVerificationAmount >= totalDueRupees - 0.01 && totalDueRupees > 0) {
          status = 'pending_verification';
          status_label = 'Billed (Pending Verification)';
        } else if (matchedFee?.status === 'pending_verification' || pendingVerificationAmount > 0) {
          status = 'pending_verification';
          status_label = 'Billed (Pending Verification)';
        } else {
          status = 'payment_due';
          status_label = 'Billed (Payment Due)';
        }
      } else if (roomSegments.length > 0) {
        // Room segments exist for this month but no charges generated for student yet
        const closedSegs = roomSegments.filter(s => s.end_date !== null);
        const openSegs = roomSegments.filter(s => s.end_date === null);
        segments_count = roomSegments.length;

        if (closedSegs.length === 0 && openSegs.length > 0) {
          // All segments for this month are open - active cycle in progress!
          status = 'awaiting_month_end_reading';
          status_label = 'Awaiting Month-End Reading';
        } else {
          let totalRoomUnits = 0;
          for (const seg of closedSegs) {
            const segUnits = parseFloat(seg.consumption_units || 0);
            totalRoomUnits += segUnits;
            const occupants = Math.max(1, seg.occupant_count || 1);
            consumption_units += segUnits / occupants;
          }

          if (totalRoomUnits === 0 && openSegs.length === 0) {
            status = 'zero_consumption';
            status_label = 'Zero Consumption';
          } else if (openSegs.length > 0) {
            status = 'recorded_unbilled';
            status_label = 'Cycle in Progress';
          } else {
            status = 'recorded_unbilled';
            status_label = 'Recorded (Unbilled)';
          }
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
        consumption_calculable: (status !== 'unmetered' && !status.startsWith('awaiting_')),
        charge_amount_paise,
        charge_amount_rupees: charge_amount_paise / 100,
        status,
        status_label,
        fee_id: matchedFee?.id || null,
        fee_status: matchedFee?.status || null,
        segments_count
      });
    }

    // Index charges and occupants by room_id
    const chargesByRoomId = new Map<string, number>();
    for (const c of (chargesData || [])) {
      const current = chargesByRoomId.get(c.room_id) || 0;
      chargesByRoomId.set(c.room_id, current + (c.charge_amount_paise || 0));
    }

    const occupantsByRoomId = new Map<string, Array<{ student_id: string; student_name: string; student_email?: string | null }>>();
    for (const alloc of allocations) {
      const studentProfile = (alloc.students as any)?.profiles;
      const studentName = alloc.student_name || studentProfile?.full_name || 'Allocated Student';
      const studentEmail = alloc.student_email || studentProfile?.email || null;
      const arr = occupantsByRoomId.get(alloc.room_id) || [];
      arr.push({
        student_id: alloc.student_id,
        student_name: studentName,
        student_email: studentEmail
      });
      occupantsByRoomId.set(alloc.room_id, arr);
    }

    // 13. Build room-level aggregations (including rooms without segments)
    const roomsList: BillingOverviewRoom[] = [];

    for (const room of allRooms) {
      const meter = meterByRoomId.get(room.id);
      const roomSegments = segmentsByRoomId.get(room.id) || [];
      const meterReadings = meter ? (readingsByMeterId.get(meter.id) || []) : [];
      const roomOccupants = occupantsByRoomId.get(room.id) || [];
      const roomAllocations = allocations.filter(a => a.room_id === room.id);

      const closedRoomSegments = roomSegments.filter(s => s.end_date !== null);
      const openRoomSegments = roomSegments.filter(s => s.end_date === null);
      const hasOpenSegment = openRoomSegments.length > 0;

      let total_consumption = 0;
      let total_revenue_paise = 0;
      let empty_room_consumption = 0;

      for (const seg of closedRoomSegments) {
        const consumption = parseFloat(seg.consumption_units || 0);
        total_consumption += consumption;

        if (seg.segment_type === 'occupied') {
          total_revenue_paise += seg.total_cost_paise || 0;
        } else if (seg.segment_type === 'empty') {
          empty_room_consumption += consumption;
        }
      }

      // Initial reading: reason = initial or oldest recorded reading
      let initialReadingObj: BillingOverviewRoom['initial_reading'] = null;
      if (meter && meterReadings.length > 0) {
        const initR = meterReadings.slice().reverse().find(r => r.reason === 'initial') || meterReadings[meterReadings.length - 1];
        if (initR) {
          initialReadingObj = {
            id: initR.id,
            value: parseFloat(initR.reading_value || 0),
            timestamp: initR.reading_timestamp,
            reason: initR.reason
          };
        }
      }

      // Latest reading: newest recorded reading
      let latestReadingObj: BillingOverviewRoom['latest_reading'] = null;
      if (meter && meterReadings.length > 0) {
        const latR = meterReadings[0];
        latestReadingObj = {
          id: latR.id,
          value: parseFloat(latR.reading_value || 0),
          timestamp: latR.reading_timestamp,
          reason: latR.reason
        };
      }

      let roomStatus: BillingOverviewRoom['status'] = 'occupied';
      let detailedStatus: ElectricityBillingStatus = 'recorded_unbilled';
      let statusLabel = 'Billed';
      let consumptionCalculable = false;

      if (!meter) {
        roomStatus = 'unmetered';
        detailedStatus = 'unmetered';
        statusLabel = 'Unmetered';
        consumptionCalculable = false;
      } else if (meterReadings.length === 0) {
        roomStatus = 'awaiting_reading';
        detailedStatus = 'awaiting_initial_reading';
        statusLabel = 'Initial Reading Required';
        consumptionCalculable = false;
      } else if (closedRoomSegments.length === 0 && !hasOpenSegment) {
        consumptionCalculable = false;
        roomStatus = 'awaiting_reading';

        const latestReadingTime = meterReadings.length > 0 ? new Date(meterReadings[0].reading_timestamp).getTime() : 0;
        const hasPendingAllocation = roomAllocations.some(a => new Date(a.start_date).getTime() > latestReadingTime);

        if (hasPendingAllocation) {
          detailedStatus = 'awaiting_allocation_reading';
          statusLabel = 'Allocation Reading Required';
        } else {
          detailedStatus = 'awaiting_month_end_reading';
          statusLabel = 'Awaiting Month-End Reading';
        }
      } else if (closedRoomSegments.length === 0 && hasOpenSegment) {
        // Room has an open segment in progress! Consumption cannot yet be calculated!
        consumptionCalculable = false;
        roomStatus = 'awaiting_reading';
        detailedStatus = 'awaiting_month_end_reading';
        statusLabel = 'Cycle in Progress';
      } else {
        // At least one closed segment exists
        consumptionCalculable = true;
        if (total_consumption === 0 && !hasOpenSegment) {
          roomStatus = 'zero_consumption';
          detailedStatus = 'zero_consumption';
          statusLabel = 'Zero Measured Consumption';
        } else if (hasOpenSegment) {
          roomStatus = 'occupied';
          detailedStatus = 'recorded_unbilled';
          statusLabel = 'Cycle in Progress';
        } else if (empty_room_consumption > 0 && total_consumption > empty_room_consumption) {
          roomStatus = 'mixed';
          detailedStatus = 'recorded_unbilled';
          statusLabel = 'Mixed Consumption';
        } else if (empty_room_consumption > 0 || (room.occupancy === 0 && closedRoomSegments.length === 0)) {
          roomStatus = 'empty';
          detailedStatus = 'zero_consumption';
          statusLabel = 'Empty Room Consumption';
        } else {
          roomStatus = 'occupied';
          detailedStatus = 'recorded_unbilled';
          statusLabel = 'Billed';
        }
      }

      const studentChargesPaise = chargesByRoomId.get(room.id) || 0;

      roomsList.push({
        room_id: room.id,
        room_number: room.room_number,
        floor: room.floor,
        capacity: room.capacity,
        occupancy: room.occupancy,
        meter_id: meter?.id || null,
        meter_number: meter?.meter_number || null,
        segments_count: roomSegments.length,
        closed_segments_count: closedRoomSegments.length,
        open_segments_count: openRoomSegments.length,
        is_cycle_in_progress: hasOpenSegment,
        total_consumption: Math.round(total_consumption * 100) / 100,
        total_revenue_paise,
        total_revenue_rupees: total_revenue_paise / 100,
        empty_room_consumption: Math.round(empty_room_consumption * 100) / 100,
        consumption_calculable: consumptionCalculable,
        status: roomStatus,
        detailed_status: detailedStatus,
        status_label: statusLabel,
        initial_reading: initialReadingObj,
        latest_reading: latestReadingObj,
        current_occupants: roomOccupants,
        student_charges_paise: studentChargesPaise,
        student_charges_rupees: studentChargesPaise / 100
      });
    }

    // 14. Calculate summary totals
    const calculableRooms = roomsList.filter(r => r.consumption_calculable);
    const total_revenue_paise = roomsList.reduce((sum, r) => sum + r.total_revenue_paise, 0);
    const total_consumption_all = calculableRooms.reduce((sum, r) => sum + r.total_consumption, 0);
    const total_consumption_empty = calculableRooms.reduce((sum, r) => sum + r.empty_room_consumption, 0);
    const total_consumption_occupied = Math.max(0, total_consumption_all - total_consumption_empty);
    const rooms_awaiting_reading = roomsList.filter(r => r.meter_id && !r.consumption_calculable).length;
    const rooms_with_calculable_consumption = calculableRooms.length;

    const summary = {
      total_consumption_all: Math.round(total_consumption_all * 100) / 100,
      total_consumption_occupied: Math.round(total_consumption_occupied * 100) / 100,
      total_consumption_empty: Math.round(total_consumption_empty * 100) / 100,
      total_revenue_paise,
      total_revenue_rupees: total_revenue_paise / 100,
      total_students: studentsList.length,
      total_metered_rooms: activeMeters.length,
      rooms_awaiting_reading,
      rooms_with_calculable_consumption
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
