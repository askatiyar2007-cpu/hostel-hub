import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: { meterId: string } }
) {
  try {
    const supabase = createClient();
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

    const { data: lastReading } = await supabaseServer
      .from('meter_readings')
      .select('id, reading_value, reading_timestamp, reason')
      .eq('meter_id', meterId)
      .order('reading_timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      meter: {
        id: meter.id,
        meter_number: meter.meter_number,
        status: meter.status,
        room_number: (meter.rooms as any)?.room_number,
        hostel_name: (meter.rooms as any)?.hostels?.name,
        last_reading: lastReading ? {
          id: lastReading.id,
          value: parseFloat(lastReading.reading_value as any),
          timestamp: lastReading.reading_timestamp,
          reason: lastReading.reason
        } : null
      }
    }, { status: 200 });
  } catch (error: any) {
    console.error('[Meter Detail API]:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}