/**
 * Meter Reading Validation Logic
 * Implementation of REQ-3, REQ-4 from requirements.md
 * Design reference: Section 3.2.1
 */

import { supabaseServer } from '@/lib/supabase/server';
import type { ValidationResult, ReadingReason, RecordReadingResult } from '@/types/electricity';

/**
 * Validates a meter reading before insertion
 * 
 * Requirements:
 * - REQ-3.3, REQ-4.3: Validate reading_value >= previous reading
 * - REQ-4.7: Return previous reading for UI confirmation
 * - REQ-4.8: Warn if consumption > 1000 units
 * 
 * @param meterId - UUID of the electricity meter
 * @param newReadingValue - New reading value to validate
 * @param _newTimestamp - Timestamp of the new reading
 * @returns ValidationResult with isValid flag, previous reading, and warnings
 */
export async function validateMeterReading(
  meterId: string,
  newReadingValue: number,
  _newTimestamp: Date,
  authClient?: any
): Promise<ValidationResult> {
  const warnings: string[] = [];
  const db = authClient || supabaseServer;

  // Step 1: Fetch most recent previous reading
  const { data: previousReading, error: fetchError } = await db
    .from('meter_readings')
    .select('reading_value, reading_timestamp')
    .eq('meter_id', meterId)
    .order('reading_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch previous reading: ${fetchError.message}`);
  }

  // Step 2: If no previous reading exists, accept this as first reading
  if (!previousReading) {
    return {
      isValid: true,
      previousReading: undefined,
      warnings: []
    };
  }

  const prevValue = previousReading.reading_value;
  const prevTimestamp = new Date(previousReading.reading_timestamp);

  // Step 3: Validate reading value (REQ-3.3, REQ-4.3)
  if (newReadingValue < prevValue) {
    return {
      isValid: false,
      previousReading: {
        value: prevValue,
        timestamp: prevTimestamp
      },
      warnings: [
        `Reading value ${newReadingValue} is less than previous reading ${prevValue}`
      ]
    };
  }

  // Step 4: High consumption warning (REQ-4.8)
  const consumption = newReadingValue - prevValue;
  if (consumption > 1000) {
    warnings.push(
      `High consumption detected: ${consumption} units. Please confirm this is correct.`
    );
  }

  return {
    isValid: true,
    previousReading: {
      value: prevValue,
      timestamp: prevTimestamp
    },
    warnings
  };
}

/**
 * Check if a room has an active allocation at a specific timestamp
 * 
 * @param roomId - UUID of the room
 * @param timestamp - Timestamp to check occupancy at
 * @param client - Optional Supabase client (e.g. authClient)
 * @returns True if room is occupied, false otherwise
 */
async function isRoomOccupied(
  roomId: string,
  timestamp: Date,
  client?: any
): Promise<boolean> {
  const timestampStr = timestamp.toISOString();
  const db = client || supabaseServer;
  
  try {
    const { data, error } = await db
      .from('room_allocations')
      .select('id')
      .eq('room_id', roomId)
      .eq('active', true)
      .lte('start_date', timestampStr)
      .or(`end_date.is.null,end_date.gte.${timestampStr}`)
      .limit(1)
      .maybeSingle();
      
    if (error) {
      console.warn(`Failed to check room occupancy: ${error.message}`);
      return false;
    }
    
    return !!data;
  } catch (err: any) {
    console.warn(`Exception checking room occupancy: ${err?.message || err}`);
    return false;
  }
}

/**
 * Check if a room currently has an open billing segment (end_date IS NULL)
 * 
 * @param roomId - UUID of the room
 * @param client - Optional Supabase client
 * @returns True if open segment exists, false otherwise
 */
async function hasOpenSegmentForRoom(
  roomId: string,
  client?: any
): Promise<boolean> {
  const db = client || supabaseServer;
  try {
    const { data, error } = await db
      .from('billing_segments')
      .select('id')
      .eq('room_id', roomId)
      .is('end_date', null)
      .limit(1);
      
    if (error) {
      console.warn(`Failed to check for open segment: ${error.message}`);
      return false;
    }
    
    return !!(data && data.length > 0);
  } catch (err: any) {
    console.warn(`Exception checking for open segment: ${err?.message || err}`);
    return false;
  }
}

/**
 * Records a meter reading with reason-based segment operations
 * 
 * Requirements:
 * - REQ-3.1-3.8: Record meter readings with validation and reason tracking
 * - REQ-7.1-7.2: Trigger segment closure/creation based on reason
 * 
 * Design reference: Section 3.2.2
 * 
 * @param meterId - UUID of the electricity meter
 * @param readingValue - Reading value in kWh
 * @param reason - Reason for reading (occupancy_change, month_end, manual_check, initial)
 * @param recordedBy - UUID of user recording the reading
 * @param notes - Optional notes
 * @param authClient - Optional authenticated Supabase client
 * @returns RecordReadingResult with readingId and affected segment IDs
 */
export async function recordMeterReading(
  meterId: string,
  readingValue: number,
  reason: ReadingReason,
  recordedBy: string,
  notes?: string,
  authClient?: any
): Promise<RecordReadingResult> {
  const db = authClient || supabaseServer;
  
  // Step 1: Get meter details
  const { data: meter, error: meterError } = await db
    .from('electricity_meters')
    .select('id, room_id, hostel_id')
    .eq('id', meterId)
    .single();

  if (meterError || !meter) {
    throw new Error(`Meter not found: ${meterError?.message || 'Unknown error'}`);
  }

  // Step 2: Insert reading
  const readingTimestamp = new Date().toISOString();
  const { data: reading, error: readingError } = await db
    .from('meter_readings')
    .insert({
      meter_id: meterId,
      room_id: meter.room_id,
      hostel_id: meter.hostel_id,
      reading_value: readingValue,
      reading_timestamp: readingTimestamp,
      recorded_by: recordedBy,
      reason: reason,
      notes: notes || null
    })
    .select('id')
    .single();

  if (readingError || !reading) {
    throw new Error(`Failed to insert reading: ${readingError?.message || 'Unknown error'}`);
  }

  const segmentsAffected: string[] = [];

  // Step 3: Handle automatic opening segment creation for occupied rooms
  // This ONLY runs for 'initial' baseline readings!
  // For 'occupancy_change' and 'month_end', Step 4 handles closing and opening segments.
  if (reason === 'initial') {
    const readingDate = new Date(readingTimestamp);
    const isOccupied = await isRoomOccupied(meter.room_id, readingDate, db);
    const hasOpenSegment = await hasOpenSegmentForRoom(meter.room_id, db);
    
    if (isOccupied && !hasOpenSegment) {
      // Initial reading for occupied room - create opening segment
      const { createBillingSegment } = await import('./segment-lifecycle');
      
      const openingSegmentId = await createBillingSegment(
        meter.hostel_id,
        meter.room_id,
        meterId,
        reading.id,
        readingDate,
        true // update occupants for opening segment
      );
      
      segmentsAffected.push(openingSegmentId);
      console.log(`Initial reading created opening segment ${openingSegmentId} for occupied room ${meter.room_id}`);
    }
  }

  // Step 4: Handle segment operations based on reason (REQ-3.7, REQ-3.8, REQ-7.1, REQ-7.2)
  if (reason === 'occupancy_change' || reason === 'month_end') {
    // Import segment lifecycle functions dynamically to avoid circular dependencies
    const { closeOpenSegment, createBillingSegment } = await import('./segment-lifecycle');
    
    // Close open segment (if exists)
    const closedSegmentId = await closeOpenSegment(
      meter.room_id,
      reading.id,
      readingValue,
      new Date(readingTimestamp)
    );
    
    if (closedSegmentId) {
      segmentsAffected.push(closedSegmentId);
    }
    
    // Create new segment
    // updateOccupants: true for occupancy_change, false for month_end
    const newSegmentId = await createBillingSegment(
      meter.hostel_id,
      meter.room_id,
      meterId,
      reading.id,
      new Date(readingTimestamp),
      reason === 'occupancy_change'
    );
    
    segmentsAffected.push(newSegmentId);
  }
  
  // Step 5: Mark qualifying pending occupancy change events as completed
  try {
    const eventsTable = db.from('occupancy_change_events');
    if (eventsTable && typeof eventsTable.update === 'function') {
      const updateResult = eventsTable.update({
        status: 'completed',
        required_reading_id: reading.id,
        completed_at: readingTimestamp
      });
      if (updateResult && typeof updateResult.eq === 'function') {
        await updateResult
          .eq('room_id', meter.room_id)
          .eq('status', 'pending_reading')
          .lte('change_timestamp', readingTimestamp);
      }
    }
  } catch (eventErr: any) {
    console.warn(`[recordMeterReading] Non-fatal: failed to update occupancy_change_events: ${eventErr?.message || eventErr}`);
  }

  return {
    readingId: reading.id,
    segmentsAffected
  };
}
