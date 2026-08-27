/**
 * Occupancy Change Detection and Processing
 * Implementation of REQ-5 from requirements.md
 * Design reference: Sections 3.4, 4.1
 */

import { supabaseServer } from '@/lib/supabase/server';
import { recordMeterReading } from './reading-validation';


/**
 * Process a pending occupancy change event
 * 
 * Requirements:
 * - REQ-5.3: Reading must be "immediately before" occupancy change
 * - REQ-5.7: Find qualifying reading and process segment operations
 * 
 * Design reference: Section 3.4.2
 * 
 * @param eventId - UUID of the occupancy_change_event
 * @returns void
 */
export async function processOccupancyChangeEvent(eventId: string): Promise<void> {
  // Step 1: Fetch pending event
  const { data: event, error: fetchError } = await supabaseServer
    .from('occupancy_change_events')
    .select('*')
    .eq('id', eventId)
    .eq('status', 'pending_reading')
    .single();
    
  if (fetchError) {
    throw new Error(`Failed to fetch occupancy change event: ${fetchError.message}`);
  }
  
  if (!event) {
    throw new Error('Event not found or already processed');
  }
  
  // Step 2: Find qualifying reading (immediately before)
  // Reading timestamp must be <= change_timestamp
  // Only occupancy_change and month_end reasons qualify (they close/create segments)
  const { data: qualifyingReading, error: readingError } = await supabaseServer
    .from('meter_readings')
    .select('id, reading_value, reading_timestamp, reason')
    .eq('room_id', event.room_id)
    .lte('reading_timestamp', event.change_timestamp)
    .in('reason', ['occupancy_change', 'month_end'])  // Only segment-closing reasons qualify
    .order('reading_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();
    
  if (readingError) {
    throw new Error(`Failed to fetch qualifying reading: ${readingError.message}`);
  }
  
  if (!qualifyingReading) {
    console.log(`No qualifying reading yet for event ${eventId}`);
    return;  // Event remains pending
  }
  
  // Step 3: Update event status to reading_recorded
  const { error: updateError } = await supabaseServer
    .from('occupancy_change_events')
    .update({
      status: 'reading_recorded',
      required_reading_id: qualifyingReading.id
    })
    .eq('id', eventId);
    
  if (updateError) {
    throw new Error(`Failed to update event status: ${updateError.message}`);
  }
  
  // Step 4: Segment operations already handled by recordMeterReading()
  // when the reading with reason='occupancy_change' was saved
  // Just mark event as completed
  const { error: completeError } = await supabaseServer
    .from('occupancy_change_events')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', eventId);
    
  if (completeError) {
    throw new Error(`Failed to mark event as completed: ${completeError.message}`);
  }
  
  console.log(`Processed occupancy change event ${eventId}`);
}

/**
 * Complete occupancy change workflow
 * 
 * Requirements:
 * - REQ-5 (all): End-to-end occupancy change handling
 * - REQ-6, REQ-7: Segment closure and creation
 * 
 * Design reference: Section 4.1
 * 
 * Transaction boundary: SERIALIZABLE isolation for segment operations
 * 
 * @param allocationId - UUID of the room_allocation
 * @param changeType - Type of change ('student_join' or 'student_leave')
 * @param readingValue - Meter reading value
 * @param recordedBy - UUID of user recording the reading
 * @param notes - Optional notes
 * @returns Object with readingId and segmentsAffected
 */
export async function handleOccupancyChange(
  allocationId: string,
  changeType: 'student_join' | 'student_leave',
  readingValue: number,
  recordedBy: string,
  notes?: string
): Promise<{ readingId: string; segmentsAffected: string[]; eventId?: string }> {
  
  // Step 1: Fetch allocation details
  const { data: allocation, error: allocError } = await supabaseServer
    .from('room_allocations')
    .select('room_id, hostel_id, student_id')
    .eq('id', allocationId)
    .single();
    
  if (allocError || !allocation) {
    throw new Error(`Allocation not found: ${allocError?.message || 'Unknown error'}`);
  }
  
  // Step 2: Get meter for room
  const { data: meter, error: meterError } = await supabaseServer
    .from('electricity_meters')
    .select('id')
    .eq('room_id', allocation.room_id)
    .eq('status', 'active')
    .maybeSingle();
    
  if (meterError) {
    throw new Error(`Failed to fetch meter: ${meterError.message}`);
  }
  
  if (!meter) {
    throw new Error(
      'No active meter for room - cannot process billable occupancy change. ' +
      'Please configure an active electricity meter for this room first.'
    );
  }
  
  // Step 3: Record meter reading with occupancy_change reason
  // This automatically closes open segment and creates new segment with updated occupants
  const { readingId, segmentsAffected } = await recordMeterReading(
    meter.id,
    readingValue,
    'occupancy_change',
    recordedBy,
    notes || `${changeType} for student ${allocation.student_id}`
  );
  
  // Step 4: Find and mark occupancy_change_event as completed (if exists)
  const { data: event } = await supabaseServer
    .from('occupancy_change_events')
    .select('id')
    .eq('allocation_id', allocationId)
    .eq('status', 'pending_reading')
    .maybeSingle();
    
  if (event) {
    const { error: updateError } = await supabaseServer
      .from('occupancy_change_events')
      .update({
        status: 'completed',
        required_reading_id: readingId,
        completed_at: new Date().toISOString()
      })
      .eq('id', event.id);
      
    if (updateError) {
      console.warn(`Failed to mark event as completed: ${updateError.message}`);
      // Don't throw - reading was successful, event update is secondary
    }
  }
  
  // Step 5: Note - Notification dismissal would happen here in full implementation
  // For now, we just log the successful processing
  console.log(
    `Occupancy change processed: ${changeType}, ` +
    `${segmentsAffected.length} segments affected, reading ${readingId}`
  );
  
  return {
    readingId,
    segmentsAffected,
    eventId: event?.id
  };
}

/**
 * Process multiple same-day occupancy changes chronologically
 * 
 * Requirements:
 * - REQ-5.6: Process multiple changes chronologically
 * - REQ-6.8: Support multiple segments same day
 * 
 * Design reference: Section 3.4.3
 * 
 * @param roomId - UUID of the room
 * @param date - Date to process changes for
 * @returns Array of processed event IDs
 */
export async function processMultipleSameDayChanges(
  roomId: string,
  date: Date
): Promise<string[]> {
  
  // Calculate start and end of day
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  // Fetch all pending events for room on date, ordered by timestamp
  const { data: events, error } = await supabaseServer
    .from('occupancy_change_events')
    .select('*')
    .eq('room_id', roomId)
    .gte('change_timestamp', startOfDay.toISOString())
    .lte('change_timestamp', endOfDay.toISOString())
    .eq('status', 'pending_reading')
    .order('change_timestamp');
    
  if (error) {
    throw new Error(`Failed to fetch same-day events: ${error.message}`);
  }
  
  if (!events || events.length === 0) {
    return [];
  }
  
  // Process each event in chronological order
  const processedEventIds: string[] = [];
  for (const event of events) {
    try {
      await processOccupancyChangeEvent(event.id);
      processedEventIds.push(event.id);
    } catch (error) {
      console.error(`Failed to process event ${event.id}:`, error);
      // Continue processing other events
    }
  }
  
  return processedEventIds;
}
