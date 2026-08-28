import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/readings/history
 * 
 * Retrieves reading history for a meter with consumption calculations
 * 
 * Query Parameters:
 * - meter_id (required): UUID of the meter
 * - start_date (optional): Start date for filtering (ISO 8601)
 * - end_date (optional): End date for filtering (ISO 8601)
 * 
 * Requirements: REQ-22.2, REQ-22.3
 * Design: Section 6.3.2
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseServer = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const meterId = searchParams.get('meter_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    
    // Validate required parameters
    if (!meterId) {
      return NextResponse.json(
        { error: 'meter_id is required' },
        { status: 400 }
      );
    }
    
    // Verify meter exists and user has access
    const { data: meter, error: meterError } = await supabaseServer
      .from('electricity_meters')
      .select('id, hostel_id, room_id')
      .eq('id', meterId)
      .single();
      
    if (meterError || !meter) {
      return NextResponse.json(
        { error: 'Meter not found' },
        { status: 404 }
      );
    }
    
    // Check authorization - owner must own the hostel OR student must have allocation in the room
    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('role, user_id')
      .eq('user_id', user.id)
      .single();
      
    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }
    
    // Check ownership for owners
    if (profile.role === 'hostel_owner' || profile.role === 'owner') {
      const { data: hostel } = await supabaseServer
        .from('hostels')
        .select('owner_id')
        .eq('id', meter.hostel_id)
        .single();
        
      if (!hostel || hostel.owner_id !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized: You do not own this hostel' },
          { status: 403 }
        );
      }
    } else if (profile.role === 'student') {
      // Students can only view readings for rooms they currently occupy
      const { data: allocation } = await supabaseServer
        .from('room_allocations')
        .select('id')
        .eq('student_id', user.id)
        .eq('room_id', meter.room_id)
        .eq('status', 'active')
        .single();
        
      if (!allocation) {
        return NextResponse.json(
          { error: 'Unauthorized: You do not have access to this room' },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid role' },
        { status: 403 }
      );
    }
    
    // Build query for readings with consumption calculation
    // Using window function LAG to calculate consumption since previous reading
    const query = supabaseServer.rpc('get_reading_history', {
      p_meter_id: meterId,
      p_start_date: startDate || null,
      p_end_date: endDate || null
    });
    
    const { data: readings, error: readingsError } = await query;
    
    // If RPC function doesn't exist, fall back to manual query
    if (readingsError && readingsError.message?.includes('function')) {
      // Manual query with LAG window function
      let baseQuery = supabaseServer
        .from('meter_readings')
        .select(`
          id,
          reading_value,
          reading_timestamp,
          reason,
          notes,
          recorded_by,
          profiles:recorded_by (
            full_name
          )
        `)
        .eq('meter_id', meterId)
        .order('reading_timestamp', { ascending: false });
        
      // Add date filters if provided
      if (startDate) {
        baseQuery = baseQuery.gte('reading_timestamp', startDate);
      }
      if (endDate) {
        baseQuery = baseQuery.lte('reading_timestamp', endDate);
      }
      
      const { data: rawReadings, error: rawError } = await baseQuery;
      
      if (rawError) {
        console.error('Error fetching readings:', rawError);
        return NextResponse.json(
          { error: 'Failed to fetch readings' },
          { status: 500 }
        );
      }
      
      if (!rawReadings || rawReadings.length === 0) {
        return NextResponse.json({
          readings: [],
          total_count: 0
        });
      }
      
      // Calculate consumption manually (since readings are DESC, we need to reverse for calculation)
      const sortedReadings = [...rawReadings].reverse();
      const readingsWithConsumption = sortedReadings.map((reading, index) => {
        const previousReading = index > 0 ? sortedReadings[index - 1] : null;
        const consumptionSincePrevious = previousReading 
          ? reading.reading_value - previousReading.reading_value 
          : null;
          
        const profiles = reading.profiles;
        const profileObj = (Array.isArray(profiles) ? profiles[0] : profiles) as { full_name: string | null } | null;
        const recordedByName = profileObj?.full_name || 'Unknown';
        
        return {
          id: reading.id,
          reading_value: reading.reading_value,
          reading_timestamp: reading.reading_timestamp,
          reason: reading.reason,
          notes: reading.notes,
          recorded_by_name: recordedByName,
          consumption_since_previous: consumptionSincePrevious
        };
      });
      
      // Reverse back to DESC order
      const finalReadings = readingsWithConsumption.reverse();
      
      return NextResponse.json({
        readings: finalReadings,
        total_count: finalReadings.length
      });
    }
    
    if (readingsError) {
      console.error('Error fetching readings:', readingsError);
      return NextResponse.json(
        { error: 'Failed to fetch readings' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      readings: readings || [],
      total_count: readings?.length || 0
    });
    
  } catch (error) {
    console.error('Unexpected error in reading history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
