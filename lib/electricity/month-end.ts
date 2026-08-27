/**
 * Month-End Processing
 * Implementation of REQ-9 from requirements.md
 * Design reference: Section 3.5
 */

import { supabaseServer } from '@/lib/supabase/server';
import { recordMeterReading } from './reading-validation';

/**
 * Get hostel timezone configuration
 * 
 * Requirements:
 * - REQ-9.3, REQ-9.6: Calendar month in hostel's configured timezone
 * 
 * Design reference: Section 3.5.1
 * 
 * @param hostelId - UUID of the hostel
 * @returns Timezone string (e.g., 'Asia/Kolkata') or 'UTC' as default
 */
export async function getHostelTimezone(hostelId: string): Promise<string> {
  const { data, error } = await supabaseServer
    .from('hostels')
    .select('timezone')
    .eq('id', hostelId)
    .single();
    
  if (error) {
    console.warn(`Failed to fetch hostel timezone: ${error.message}, defaulting to UTC`);
    return 'UTC';
  }
  
  // Return configured timezone or default to UTC
  return data?.timezone || 'UTC';
}

/**
 * Check if a date is the last day of the month in a given timezone
 * 
 * @param date - Date to check
 * @param timezone - Timezone to use
 * @returns True if date is last day of month
 */
function isLastDayOfMonth(date: Date, timezone: string): boolean {
  try {
    // Format date in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const parts = formatter.formatToParts(date);
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0');
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
    
    // Get the last day of the month
    const lastDay = new Date(year, month, 0).getDate();
    
    return day === lastDay;
  } catch (error) {
    console.error(`Error checking last day of month: ${error}`);
    return false;
  }
}

/**
 * Check if date is within the target month in the given timezone
 * 
 * @param date - Date to check
 * @param timezone - Timezone to use
 * @returns Month string in 'YYYY-MM' format
 */
function getCurrentMonth(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit'
    });
    
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    
    return `${year}-${month}`;
  } catch (error) {
    console.error(`Error getting current month: ${error}`);
    // Fallback to UTC
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}

/**
 * Generate month-end reading reminders for all hostels
 * 
 * Requirements:
 * - REQ-9.6: Send reminders on last calendar day in hostel timezone
 * - REQ-9.7: Skip if qualifying reading exists
 * - REQ-25.2, REQ-25.3: Month-end notification generation
 * 
 * Design reference: Section 3.5.2
 * 
 * This is a scheduled job that should run daily at 9 AM
 * 
 * @returns Object with counts of reminders created and skipped
 */
export async function generateMonthEndReminders(): Promise<{
  remindersCreated: number;
  remindersSkipped: number;
  errors: Array<{ hostelId: string; error: string }>;
}> {
  
  let remindersCreated = 0;
  let remindersSkipped = 0;
  const errors: Array<{ hostelId: string; error: string }> = [];
  
  // Step 1: Get all hostels
  const { data: hostels, error: hostelsError } = await supabaseServer
    .from('hostels')
    .select('id, name, timezone');
    
  if (hostelsError) {
    throw new Error(`Failed to fetch hostels: ${hostelsError.message}`);
  }
  
  if (!hostels || hostels.length === 0) {
    return { remindersCreated, remindersSkipped, errors };
  }
  
  const today = new Date();
  
  for (const hostel of hostels) {
    try {
      const timezone = hostel.timezone || 'UTC';
      
      // Check if today is last day of month in hostel's timezone
      if (!isLastDayOfMonth(today, timezone)) {
        continue;  // Not last day of month for this hostel
      }
      
      const currentMonth = getCurrentMonth(today, timezone);
      
      // Step 2: Find active meters in this hostel
      const { data: meters, error: metersError } = await supabaseServer
        .from('electricity_meters')
        .select(`
          id,
          meter_number,
          room_id,
          rooms:room_id (
            room_number
          )
        `)
        .eq('hostel_id', hostel.id)
        .eq('status', 'active');
        
      if (metersError) {
        errors.push({ hostelId: hostel.id, error: metersError.message });
        continue;
      }
      
      if (!meters || meters.length === 0) {
        continue;
      }
      
      for (const meter of meters) {
        // Step 3: Check if month-end reading already exists
        // Look for readings with reason 'month_end' in current month
        const monthStart = `${currentMonth}-01T00:00:00Z`;
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const monthEnd = nextMonth.toISOString();
        
        const { data: existingReading, error: readingError } = await supabaseServer
          .from('meter_readings')
          .select('id')
          .eq('meter_id', meter.id)
          .eq('reason', 'month_end')
          .gte('reading_timestamp', monthStart)
          .lt('reading_timestamp', monthEnd)
          .maybeSingle();
          
        if (readingError) {
          console.error(`Error checking existing reading for meter ${meter.id}: ${readingError.message}`);
          continue;
        }
        
        if (existingReading) {
          console.log(`Skipping reminder for meter ${meter.id} - reading already exists`);
          remindersSkipped++;
          continue;  // Skip if qualifying reading exists (REQ-9.7, REQ-25.3)
        }
        
        // Step 4: Create reminder notification
        // In a full implementation, this would integrate with the notification system
        // For now, we'll insert into a notifications table or log
        const roomNumber = (meter.rooms as any)?.room_number || 'Unknown';
        
        console.log(
          `[MONTH-END REMINDER] Hostel: ${hostel.name}, ` +
          `Room: ${roomNumber}, Meter: ${meter.meter_number}, ` +
          `Deadline: End of ${currentMonth}`
        );
        
        // TODO: When notification system is implemented, create actual notification here
        // await createNotification({
        //   hostel_id: hostel.id,
        //   type: 'month_end_reading_required',
        //   priority: 'high',
        //   title: `Month-end meter reading required`,
        //   message: `Please enter month-end reading for Room ${roomNumber}, Meter ${meter.meter_number}`,
        //   action_url: `/dashboard/meters/${meter.id}/record-reading`,
        //   metadata: {
        //     meter_id: meter.id,
        //     room_id: meter.room_id,
        //     deadline: monthEnd
        //   }
        // });
        
        remindersCreated++;
      }
    } catch (error) {
      errors.push({
        hostelId: hostel.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  console.log(
    `Month-end reminders: ${remindersCreated} created, ${remindersSkipped} skipped, ` +
    `${errors.length} errors`
  );
  
  return { remindersCreated, remindersSkipped, errors };
}

/**
 * Record a month-end reading
 * 
 * Requirements:
 * - REQ-9.1: Close open segment and create new with same occupants
 * - REQ-9.5: New segment preserves occupant list
 * 
 * Design reference: Section 3.5.3
 * 
 * Note: The actual segment closure and creation logic is handled by
 * recordMeterReading() with reason='month_end', which triggers:
 * 1. closeOpenSegment() - closes current segment
 * 2. createBillingSegment() with updateOccupants=false
 *    - queries current occupants (same as closed segment)
 *    - creates new segment with same occupant list
 * 
 * This function is a convenience wrapper for month-end readings
 * 
 * @param meterId - UUID of the electricity meter
 * @param readingValue - Reading value in kWh
 * @param recordedBy - UUID of user recording the reading
 * @param notes - Optional notes
 * @returns RecordReadingResult with readingId and affected segments
 */
export async function recordMonthEndReading(
  meterId: string,
  readingValue: number,
  recordedBy: string,
  notes?: string
): Promise<{ readingId: string; segmentsAffected: string[] }> {
  
  // Record reading with reason='month_end'
  // This automatically:
  // 1. Closes open segment with current occupants
  // 2. Creates new segment with SAME occupants (updateOccupants=false)
  const result = await recordMeterReading(
    meterId,
    readingValue,
    'month_end',
    recordedBy,
    notes || 'Month-end reading'
  );
  
  console.log(
    `Month-end reading recorded: meter ${meterId}, ` +
    `reading ${result.readingId}, ${result.segmentsAffected.length} segments affected`
  );
  
  return result;
}
