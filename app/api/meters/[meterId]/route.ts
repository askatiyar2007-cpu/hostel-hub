import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { meterId: string } }
) {
  try {
    const supabase = createClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { meterId } = params;

    const { data: meter, error: meterError } = await supabaseServer
      .from('electricity_meters')
      .select(`
        id,
        meter_number,
        status,
        room_id,
        hostel_id,
        rooms!inner (
          room_number,
          hostels!inner (
            name,
            owner_id
          )
        )
      `)
      .eq('id', meterId)
      .single();

    if (meterError || !meter) {
      return NextResponse.json({ error: 'Meter not found' }, { status: 404 });
    }

    const hostelOwner = (meter.rooms as any)?.hostels?.owner_id;
    if (hostelOwner !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Fetch most recent meter reading
    const { data: lastReading } = await supabaseServer
      .from('meter_readings')
      .select('id, reading_value, reading_timestamp, reason')
      .eq('meter_id', meterId)
      .order('reading_timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Fetch currently open billing segment (if any)
    const { data: openSegment } = await supabaseServer
      .from('billing_segments')
      .select(`
        id,
        start_date,
        start_reading_id,
        rate_per_unit,
        occupant_count,
        segment_type,
        billing_month,
        segment_occupants (
          id,
          student_id,
          allocation_id,
          student_name,
          student_email
        )
      `)
      .eq('room_id', meter.room_id)
      .is('end_date', null)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Fetch authoritative active room allocations
    const { data: activeAllocations } = await supabaseServer
      .from('room_allocations')
      .select(`
        id,
        student_id,
        student_name,
        student_email,
        student_phone,
        start_date,
        end_date,
        status,
        active
      `)
      .eq('room_id', meter.room_id)
      .eq('active', true)
      .order('student_name');

    // 4. Fetch pending occupancy change events
    const { data: pendingEvents } = await supabaseServer
      .from('occupancy_change_events')
      .select('id, change_type, change_timestamp, allocation_id, student_id, status')
      .eq('room_id', meter.room_id)
      .eq('status', 'pending_reading');

    // 5. Compute automatic allocation and reading state detection
    const isNewMeter = !lastReading;
    const openOccupants = (openSegment?.segment_occupants as any[]) || [];
    const openAllocIds = new Set(openOccupants.map((o) => o.allocation_id).filter(Boolean));
    const currentAllocations = activeAllocations || [];
    const currentAllocIds = new Set(currentAllocations.map((a) => a.id));

    // Detect incoming allocations: active allocations not in open segment
    const joiningAllocations = currentAllocations.filter((a) => !openAllocIds.has(a.id));
    // Detect leaving occupants: open segment occupants whose allocation is no longer active
    const leavingOccupants = openOccupants.filter((o) => !currentAllocIds.has(o.allocation_id));

    const hasOccupancyChange =
      joiningAllocations.length > 0 ||
      leavingOccupants.length > 0 ||
      Boolean(pendingEvents && pendingEvents.length > 0) ||
      (!openSegment && currentAllocations.length > 0 && !isNewMeter);

    let detectedReason: 'initial' | 'occupancy_change' | 'month_end' = 'month_end';
    let explanation = '';

    if (isNewMeter) {
      detectedReason = 'initial';
      explanation = 'Physical meter has no prior readings. Recording will establish the initial starting benchmark.';
    } else if (hasOccupancyChange) {
      detectedReason = 'occupancy_change';
      const parts: string[] = [];
      if (joiningAllocations.length > 0) {
        parts.push(`Incoming: ${joiningAllocations.map((a) => a.student_name || 'Student').join(', ')}`);
      }
      if (leavingOccupants.length > 0) {
        parts.push(`Departing/Checked out: ${leavingOccupants.map((o) => o.student_name || 'Resident').join(', ')}`);
      }
      if (parts.length === 0 && pendingEvents && pendingEvents.length > 0) {
        parts.push('Pending allocation change recorded in system');
      }
      explanation = `Occupancy change detected (${parts.join('; ')}). Recording will finalize consumption for prior occupants and open a new segment starting at this reading.`;
    } else {
      detectedReason = 'month_end';
      const occupantNames = currentAllocations.map((a) => a.student_name || 'Resident').join(', ');
      explanation = occupantNames
        ? `Active occupants match the current segment (${occupantNames}). Recording will close the monthly billing segment and start the next cycle.`
        : 'Room currently empty. Recording will track consumption as empty-room usage without student charges.';
    }

    return NextResponse.json({
      meter: {
        id: meter.id,
        meter_number: meter.meter_number,
        status: meter.status,
        room_id: meter.room_id,
        hostel_id: meter.hostel_id,
        room_number: (meter.rooms as any)?.room_number,
        hostel_name: (meter.rooms as any)?.hostels?.name,
        last_reading: lastReading ? {
          id: lastReading.id,
          value: parseFloat(lastReading.reading_value as any),
          timestamp: lastReading.reading_timestamp,
          reason: lastReading.reason
        } : null,
        open_segment: openSegment ? {
          id: openSegment.id,
          start_date: openSegment.start_date,
          occupant_count: openSegment.occupant_count,
          rate_per_unit: openSegment.rate_per_unit,
          occupants: openOccupants.map((o) => ({
            student_id: o.student_id,
            allocation_id: o.allocation_id,
            name: o.student_name
          }))
        } : null,
        active_allocations: currentAllocations.map((a) => ({
          allocation_id: a.id,
          student_id: a.student_id,
          name: a.student_name,
          email: a.student_email,
          start_date: a.start_date,
          end_date: a.end_date
        })),
        detection: {
          detected_reason: detectedReason,
          is_new_meter: isNewMeter,
          has_occupancy_change: hasOccupancyChange,
          joining_students: joiningAllocations.map((a) => ({
            student_id: a.student_id,
            allocation_id: a.id,
            name: a.student_name
          })),
          leaving_students: leavingOccupants.map((o) => ({
            student_id: o.student_id,
            allocation_id: o.allocation_id,
            name: o.student_name
          })),
          explanation
        }
      }
    }, { status: 200 });
  } catch (error: any) {
    console.error('[Meter Detail API]:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
