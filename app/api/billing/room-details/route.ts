import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

const RoomDetailsQuerySchema = z.object({
  room_id: z.string().uuid('Invalid room ID format'),
  billing_month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format')
});

interface BillingSegment {
  id: string;
  start_date: string;
  end_date: string | null;
  start_reading_id: string | null;
  end_reading_id: string | null;
  meter_id: string | null;
  start_reading_value: number | null;
  end_reading_value: number | null;
  consumption_units: number | null;
  rate_per_unit: number;
  total_cost_paise: number | null;
  occupant_count: number;
  segment_type: 'occupied' | 'empty';
}

interface SegmentOccupant {
  student_id: string;
  student_name: string;
  student_email: string | null;
}

interface StudentCharge {
  student_id: string;
  student_name: string;
  charge_amount_paise: number;
  segment_id: string;
}

interface RoomBillingDetails {
  room_id: string;
  room_number: string;
  hostel_id: string;
  hostel_name: string;
  billing_month: string;
  meter_id: string | null;
  meter_number: string | null;
  meter_status: string | null;
  status: string;
  status_label: string;
  status_explanation: string;
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
  all_readings?: {
    id: string;
    value: number;
    timestamp: string;
    reason: string;
  }[];
  current_occupants: {
    student_id: string;
    student_name: string;
    student_email: string | null;
    start_date: string;
  }[];
  tariff_rate_rupees: number;
  segments: (BillingSegment & { occupants: SegmentOccupant[] })[];
  student_charges: StudentCharge[];
  total_consumption: number;
  total_cost_paise: number;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const roomId = searchParams.get('room_id');
    const billingMonth = searchParams.get('billing_month');

    if (!roomId || !billingMonth) {
      return NextResponse.json(
        { error: 'Missing required parameters: room_id and billing_month' },
        { status: 400 }
      );
    }

    const validated = RoomDetailsQuerySchema.parse({
      room_id: roomId,
      billing_month: billingMonth
    });

    // Verify room and hostel ownership
    const { data: room, error: roomError } = await supabaseServer
      .from('rooms')
      .select('id, room_number, hostel_id, floor, capacity, occupancy')
      .eq('id', validated.room_id)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const { data: hostel, error: hostelError } = await supabaseServer
      .from('hostels')
      .select('id, name, owner_id')
      .eq('id', room.hostel_id)
      .single();

    if (hostelError || !hostel || hostel.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch active meter for this room
    const { data: meter } = await supabaseServer
      .from('electricity_meters')
      .select('id, meter_number, status')
      .eq('room_id', validated.room_id)
      .eq('status', 'active')
      .maybeSingle();

    // Fetch all readings for this meter / room
    const { data: readingsData } = await supabaseServer
      .from('meter_readings')
      .select('id, reading_value, reading_timestamp, reason')
      .eq('room_id', validated.room_id)
      .order('reading_timestamp', { ascending: false });

    const meterReadings = readingsData || [];

    // Fetch room allocations overlapping this month
    const [year, monthNum] = validated.billing_month.split('-').map(Number);
    const startOfMonth = `${validated.billing_month}-01`;
    const lastDayOfMonth = new Date(year, monthNum, 0).getDate();
    const endOfMonth = `${validated.billing_month}-${String(lastDayOfMonth).padStart(2, '0')}`;

    const { data: roomAllocationsData } = await supabaseServer
      .from('room_allocations')
      .select(`
        id,
        student_id,
        student_name,
        student_email,
        start_date,
        end_date,
        active,
        students (
          id,
          profiles (
            full_name,
            email
          )
        )
      `)
      .eq('room_id', validated.room_id)
      .lte('start_date', endOfMonth)
      .or(`end_date.is.null,end_date.gte.${startOfMonth}`);

    const currentOccupants = (roomAllocationsData || []).map((alloc: any) => {
      const profile = alloc.students?.profiles;
      return {
        student_id: alloc.student_id,
        student_name: alloc.student_name || profile?.full_name || 'Resident Student',
        student_email: alloc.student_email || profile?.email || null,
        start_date: alloc.start_date
      };
    });

    // Fetch billing segments with occupants and both readings using explicit foreign keys
    const { data: segments, error: segmentsError } = await supabaseServer
      .from('billing_segments')
      .select(`
        id,
        start_date,
        end_date,
        rate_per_unit,
        consumption_units,
        total_cost_paise,
        occupant_count,
        segment_type,
        start_reading_id,
        end_reading_id,
        meter_id,
        start_reading:meter_readings!billing_segments_start_reading_id_fkey(
          reading_value
        ),
        end_reading:meter_readings!billing_segments_end_reading_id_fkey(
          reading_value
        ),
        segment_occupants (
          student_id,
          student_name,
          student_email
        )
      `)
      .eq('room_id', validated.room_id)
      .eq('billing_month', validated.billing_month)
      .order('start_date', { ascending: true });

    if (segmentsError) {
      console.error('Error fetching segments:', segmentsError);
      return NextResponse.json({ error: 'Failed to fetch billing segments' }, { status: 500 });
    }

    // Transform segments to clean structure
    const segmentsWithReadings = (segments || []).map((segment: any) => ({
      id: segment.id,
      start_date: segment.start_date,
      end_date: segment.end_date,
      start_reading_id: segment.start_reading_id,
      end_reading_id: segment.end_reading_id,
      meter_id: segment.meter_id,
      start_reading_value: segment.start_reading?.reading_value || null,
      end_reading_value: segment.end_reading?.reading_value || null,
      consumption_units: segment.consumption_units,
      rate_per_unit: segment.rate_per_unit,
      total_cost_paise: segment.total_cost_paise,
      occupant_count: segment.occupant_count,
      segment_type: segment.segment_type,
      occupants: segment.segment_occupants || []
    }));

    // Fetch student charges for this room and month
    const { data: charges, error: chargesError } = await supabaseServer
      .from('student_electricity_charges')
      .select(`
        student_id,
        charge_amount_paise,
        segment_id
      `)
      .eq('room_id', validated.room_id)
      .eq('billing_month', validated.billing_month);

    if (chargesError) {
      console.error('Error fetching charges:', chargesError);
    }

    // Resolve student names using segment_occupants or currentOccupants
    let studentCharges: StudentCharge[] = [];
    if (charges && charges.length > 0) {
      const studentNameMap = new Map<string, string>();
      segmentsWithReadings.forEach(segment => {
        segment.occupants.forEach((occupant: any) => {
          if (occupant.student_name && !studentNameMap.has(occupant.student_id)) {
            studentNameMap.set(occupant.student_id, occupant.student_name);
          }
        });
      });
      currentOccupants.forEach(occ => {
        if (!studentNameMap.has(occ.student_id)) {
          studentNameMap.set(occ.student_id, occ.student_name);
        }
      });
      
      studentCharges = charges.map((charge: any) => ({
        student_id: charge.student_id,
        student_name: studentNameMap.get(charge.student_id) || 'Unknown',
        charge_amount_paise: charge.charge_amount_paise,
        segment_id: charge.segment_id
      }));
    }

    // Calculate totals
    const totalConsumption = segmentsWithReadings.reduce(
      (sum, seg) => sum + (seg.consumption_units || 0),
      0
    );

    const totalCostPaise = segmentsWithReadings.reduce(
      (sum, seg) => sum + (seg.total_cost_paise || 0),
      0
    );

    // Initial reading and latest reading
    let initialReadingObj = null;
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

    let latestReadingObj = null;
    if (meter && meterReadings.length > 0) {
      const latR = meterReadings[0];
      latestReadingObj = {
        id: latR.id,
        value: parseFloat(latR.reading_value || 0),
        timestamp: latR.reading_timestamp,
        reason: latR.reason
      };
    }

    // Fetch active tariff
    const { data: tariffData } = await supabaseServer
      .from('electricity_tariffs')
      .select('rate_per_kwh, effective_from')
      .eq('hostel_id', room.hostel_id)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    const tariffRateRupees = tariffData?.rate_per_kwh ? Number(tariffData.rate_per_kwh) : (segmentsWithReadings[0]?.rate_per_unit || 10);

    // Determine status & explanation
    let status = 'billed';
    let statusLabel = 'Billed';
    let statusExplanation = 'Billing cycle finalized with all segments closed.';

    if (!meter) {
      status = 'unmetered';
      statusLabel = 'Unmetered';
      statusExplanation = 'No active electricity sub-meter is configured for this room.';
    } else if (meterReadings.length === 0) {
      status = 'awaiting_initial_reading';
      statusLabel = 'Initial Reading Required';
      statusExplanation = 'This meter requires an initial baseline reading to begin tracking electricity consumption.';
    } else if (segmentsWithReadings.length === 0) {
      const latestReadingTime = meterReadings.length > 0 ? new Date(meterReadings[0].reading_timestamp).getTime() : 0;
      const hasPendingAllocation = currentOccupants.some(a => new Date(a.start_date).getTime() > latestReadingTime);

      if (hasPendingAllocation) {
        status = 'awaiting_allocation_reading';
        statusLabel = 'Allocation Reading Required';
        statusExplanation = 'A student joined the room after the last recorded reading. A New Allocation reading is required to close the previous interval and begin a new segment.';
      } else {
        status = 'awaiting_month_end_reading';
        statusLabel = 'Awaiting Month-End Reading';
        statusExplanation = `The baseline or benchmark reading has been recorded, but the month-end reading for ${validated.billing_month} has not yet been submitted. Once recorded, consumption and student fee charges will be calculated.`;
      }
    } else if (totalConsumption === 0) {
      status = 'zero_consumption';
      statusLabel = 'Zero Measured Consumption';
      statusExplanation = 'The meter was read with no change in cumulative units during this period (0.00 kWh consumed).';
    }

    const response: RoomBillingDetails = {
      room_id: validated.room_id,
      room_number: room.room_number,
      hostel_id: room.hostel_id,
      hostel_name: hostel.name,
      billing_month: validated.billing_month,
      meter_id: meter?.id || segmentsWithReadings[0]?.meter_id || null,
      meter_number: meter?.meter_number || null,
      meter_status: meter?.status || null,
      status,
      status_label: statusLabel,
      status_explanation: statusExplanation,
      initial_reading: initialReadingObj,
      latest_reading: latestReadingObj,
      all_readings: meterReadings.map(r => ({
        id: r.id,
        value: parseFloat(r.reading_value || 0),
        timestamp: r.reading_timestamp,
        reason: r.reason
      })),
      current_occupants: currentOccupants,
      tariff_rate_rupees: tariffRateRupees,
      segments: segmentsWithReadings,
      student_charges: studentCharges,
      total_consumption: totalConsumption,
      total_cost_paise: totalCostPaise
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error in room details API:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
