/**
 * POST /api/readings/record
 * 
 * Records a meter reading with validation and segment operations
 * 
 * Requirements: REQ-3.1, REQ-13.1, REQ-13.3
 * Design: Section 6.3.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordMeterReadingWithLock } from '@/lib/electricity';
import { z } from 'zod';

// Request validation schema
const RecordReadingSchema = z.object({
  meter_id: z.string().uuid('Invalid meter ID format'),
  reading_value: z.number().nonnegative('Reading value must be non-negative'),
  reason: z.enum(['occupancy_change', 'month_end', 'manual_check'], {
    errorMap: () => ({ message: 'Invalid reading reason' })
  }),
  notes: z.string().optional(),
  idempotency_key: z.string().optional()
});

// Response types
interface RecordReadingResponse {
  success: boolean;
  reading_id: string;
  segments_affected: string[];
  previous_reading: {
    value: number;
    timestamp: string;
  } | null;
  consumption: number;
  warnings: string[];
}

interface ErrorResponse {
  error: string;
  details?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate request schema
    const validationResult = RecordReadingSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Validation failed',
          details: validationResult.error.errors.map(e => e.message).join(', ')
        },
        { status: 400 }
      );
    }
    
    const { meter_id, reading_value, reason, notes } = validationResult.data;
    
    // Initialize Supabase client
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Validate meter ownership (REQ-3.1)
    // Fetch meter with hostel relationship to verify ownership
    const { data: meter, error: meterError } = await supabase
      .from('electricity_meters')
      .select(`
        id,
        hostel_id,
        room_id,
        meter_number,
        status,
        hostels!inner (
          id,
          owner_id
        )
      `)
      .eq('id', meter_id)
      .single();
    
    if (meterError || !meter) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Meter not found' },
        { status: 404 }
      );
    }
    
    // Verify user owns the hostel (REQ-3.1)
    const hostel = meter.hostels as any;
    if (hostel.owner_id !== user.id) {
      return NextResponse.json<ErrorResponse>(
        { error: 'You do not have permission to record readings for this meter' },
        { status: 403 }
      );
    }
    
    // Verify meter is active
    if (meter.status !== 'active') {
      return NextResponse.json<ErrorResponse>(
        { error: 'Cannot record reading for inactive meter' },
        { status: 400 }
      );
    }
    
    // Get previous reading for validation and response (REQ-13.3)
    const { data: previousReading } = await supabase
      .from('meter_readings')
      .select('reading_value, reading_timestamp')
      .eq('meter_id', meter_id)
      .order('reading_timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    // Record the reading with locking and segment operations
    // This function handles:
    // - Reading validation (REQ-3.3)
    // - Segment closure/creation based on reason (REQ-3.7, REQ-3.8)
    // - Warnings for high consumption (REQ-4.8)
    const result = await recordMeterReadingWithLock(
      meter_id,
      reading_value,
      reason,
      user.id,
      notes
    );
    
    // Calculate consumption
    const consumption = previousReading 
      ? reading_value - previousReading.reading_value 
      : reading_value;
    
    // Compile warnings
    const warnings: string[] = [];
    if (consumption > 1000) {
      warnings.push(`High consumption detected: ${consumption.toFixed(2)} units since last reading`);
    }
    
    // Return successful response
    return NextResponse.json<RecordReadingResponse>(
      {
        success: true,
        reading_id: result.readingId,
        segments_affected: result.segmentsAffected,
        previous_reading: previousReading ? {
          value: previousReading.reading_value,
          timestamp: previousReading.reading_timestamp
        } : null,
        consumption,
        warnings
      },
      { status: 201 }
    );
    
  } catch (error: any) {
    console.error('Error recording meter reading:', error);
    
    // Handle specific error types
    if (error.message?.includes('less than previous reading')) {
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Invalid reading value',
          details: error.message
        },
        { status: 400 }
      );
    }
    
    if (error.message?.includes('Duplicate reading')) {
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Duplicate reading',
          details: 'A reading with the same value was recorded within the last 60 seconds'
        },
        { status: 409 }
      );
    }
    
    if (error.message?.includes('No electricity rate found')) {
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Configuration error',
          details: 'No electricity rate configured for this hostel. Please set a rate before recording readings.'
        },
        { status: 400 }
      );
    }
    
    // Generic error response
    return NextResponse.json<ErrorResponse>(
      {
        error: 'Failed to record meter reading',
        details: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}
