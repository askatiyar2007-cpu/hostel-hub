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
  billing_month: string;
  meter_id: string | null;
  segments: (BillingSegment & { occupants: SegmentOccupant[] })[];
  student_charges: StudentCharge[];
  total_consumption: number;
  total_cost_paise: number;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
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

    // Verify ownership
    const { data: room, error: roomError } = await supabaseServer
      .from('rooms')
      .select('id, room_number, hostel_id')
      .eq('id', validated.room_id)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const { data: hostel, error: hostelError } = await supabaseServer
      .from('hostels')
      .select('owner_id')
      .eq('id', room.hostel_id)
      .single();

    if (hostelError || !hostel || hostel.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
      // Continue without charges if error
    }

    // Resolve student names using segment_occupants data (already has student_name)
    let studentCharges: StudentCharge[] = [];
    if (charges && charges.length > 0) {
      // Build student name map from segment occupants
      const studentNameMap = new Map<string, string>();
      segmentsWithReadings.forEach(segment => {
        segment.occupants.forEach((occupant: any) => {
          if (occupant.student_name && !studentNameMap.has(occupant.student_id)) {
            studentNameMap.set(occupant.student_id, occupant.student_name);
          }
        });
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

    const response: RoomBillingDetails = {
      room_id: validated.room_id,
      room_number: room.room_number,
      billing_month: validated.billing_month,
      meter_id: segmentsWithReadings[0]?.meter_id || null,
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
