/**
 * API Endpoint: POST /api/rates/update
 * Update electricity rate for a hostel
 * 
 * Requirements: REQ-2.1, REQ-14.2, REQ-14.3
 * Design: Section 6.5.1
 * Auth: Hostel owner only
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateElectricityRate } from '@/lib/electricity';
import { z } from 'zod';

// Request validation schema (REQ-14.2, REQ-14.6)
const UpdateRateSchema = z.object({
  hostel_id: z.string().uuid('Invalid hostel ID format'),
  rate_per_unit: z.number().positive('Rate must be strictly greater than zero'),
  notes: z.string().optional()
});

export async function POST(request: NextRequest) {
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
    
    // Parse and validate request body
    const body = await request.json();
    const validationResult = UpdateRateSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }
    
    const { hostel_id, rate_per_unit, notes } = validationResult.data;
    
    // Verify hostel ownership (REQ-19.1, Defense in depth - RLS also enforces)
    const { data: hostel, error: hostelError } = await supabase
      .from('hostels')
      .select('owner_id')
      .eq('id', hostel_id)
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
    
    // Update electricity rate (REQ-2.4, REQ-11.4)
    const result = await updateElectricityRate(
      hostel_id,
      rate_per_unit,
      user.id,
      notes
    );
    
    // Format response (REQ-14.3, REQ-14.4)
    return NextResponse.json({
      success: true,
      rate_id: result.rate_id,
      effective_from: result.effective_from.toISOString(),
      open_segments_count: result.open_segments_count,
      message: `New rate ₹${rate_per_unit}/unit effective from ${result.effective_from.toISOString()}`,
      warning: result.open_segments_count > 0 
        ? `${result.open_segments_count} open segments will retain their original rates. New segments created on or after the effective date will use the new rate.`
        : undefined
    });
    
  } catch (error) {
    console.error('Error updating electricity rate:', error);
    
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('strictly greater than zero')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to update electricity rate', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
