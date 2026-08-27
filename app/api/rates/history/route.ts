/**
 * API Endpoint: GET /api/rates/history
 * Get complete electricity rate history for a hostel
 * 
 * Requirements: REQ-14.5, REQ-11.7
 * Design: Section 6.5.2
 * Auth: Hostel owner only
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRateHistory, getCurrentRate } from '@/lib/electricity';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get hostel_id from query parameters
    const searchParams = request.nextUrl.searchParams;
    const hostelId = searchParams.get('hostel_id');
    
    if (!hostelId) {
      return NextResponse.json(
        { error: 'Missing required parameter: hostel_id' },
        { status: 400 }
      );
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(hostelId)) {
      return NextResponse.json(
        { error: 'Invalid hostel_id format' },
        { status: 400 }
      );
    }
    
    // Verify hostel ownership (REQ-19.1, Defense in depth - RLS also enforces)
    const { data: hostel, error: hostelError } = await supabase
      .from('hostels')
      .select('owner_id')
      .eq('id', hostelId)
      .single();
      
    if (hostelError || !hostel) {
      return NextResponse.json(
        { error: 'Hostel not found' },
        { status: 404 }
      );
    }
    
    if (hostel.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not own this hostel' },
        { status: 403 }
      );
    }
    
    // Get current rate (REQ-14.1, REQ-14.7)
    const currentRate = await getCurrentRate(hostelId);
    
    // Get complete rate history (REQ-14.5, REQ-11.8)
    const history = await getRateHistory(hostelId);
    
    // Format response
    return NextResponse.json({
      success: true,
      hostel_id: hostelId,
      current_rate: currentRate,
      history: history,
      total_changes: history.length
    });
    
  } catch (error) {
    console.error('Error fetching rate history:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Failed to fetch rate history', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
