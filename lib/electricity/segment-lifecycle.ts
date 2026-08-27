/**
 * Billing Segment Lifecycle Management
 * Implementation of REQ-6, REQ-7, REQ-8 from requirements.md
 * Design reference: Sections 3.3.1, 3.3.2, 3.3.3
 */

import { supabaseServer } from '@/lib/supabase/server';
import type { SegmentType } from '@/types/electricity';

/**
 * Active occupant information for segment creation
 */
export interface ActiveOccupant {
  allocationId: string;
  studentId: string;
  studentName: string;
  studentEmail: string | null;
}

/**
 * Get active occupants for a room at a specific timestamp
 * 
 * Requirements:
 * - REQ-6.4: Determine occupancy at specific timestamp
 * 
 * Design reference: Section 3.3.1
 * 
 * Query logic:
 * - status = 'active'
 * - start_date <= reference_timestamp
 * - (end_date IS NULL OR end_date >= reference_timestamp)
 * - Ordered by student_id for deterministic remainder allocation
 * 
 * @param roomId - UUID of the room
 * @param referenceTimestamp - Timestamp to check occupancy at
 * @returns Array of active occupants (empty array if room is empty)
 */
export async function getActiveOccupants(
  roomId: string,
  referenceTimestamp: Date
): Promise<ActiveOccupant[]> {
  const timestampStr = referenceTimestamp.toISOString();
  
  const { data, error } = await supabaseServer
    .from('room_allocations')
    .select(`
      id,
      student_id,
      profiles:student_id (
        full_name,
        email
      )
    `)
    .eq('room_id', roomId)
    .eq('status', 'active')
    .lte('start_date', timestampStr)
    .or(`end_date.is.null,end_date.gte.${timestampStr}`)
    .order('student_id'); // Deterministic ordering for remainder allocation
    
  if (error) {
    throw new Error(`Failed to fetch active occupants: ${error.message}`);
  }
  
  // Handle case where data is null or empty
  if (!data || data.length === 0) {
    return [];
  }
  
  return data.map(alloc => ({
    allocationId: alloc.id,
    studentId: alloc.student_id,
    studentName: (alloc.profiles as any)?.full_name || 'Unknown',
    studentEmail: (alloc.profiles as any)?.email || null
  }));
}

/**
 * Get applicable electricity rate at segment creation time
 * 
 * Requirements:
 * - REQ-2.6, REQ-11.1: Select rate effective at segment creation
 * 
 * Design reference: Section 3.1.1
 * 
 * @param hostelId - UUID of the hostel
 * @param segmentCreationTimestamp - When the segment is being created
 * @returns Rate per unit in rupees
 */
async function getApplicableRate(
  hostelId: string,
  segmentCreationTimestamp: Date
): Promise<number> {
  const { data, error } = await supabaseServer
    .from('electricity_rate_history')
    .select('rate_per_unit')
    .eq('hostel_id', hostelId)
    .lte('effective_from', segmentCreationTimestamp.toISOString())
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();
    
  if (error) {
    throw new Error(`Failed to fetch electricity rate: ${error.message}`);
  }
  
  if (!data) {
    throw new Error(
      `No electricity rate found for hostel ${hostelId} effective at ${segmentCreationTimestamp.toISOString()}. ` +
      `Please configure an electricity rate before creating billing segments.`
    );
  }
  
  return data.rate_per_unit;
}

/**
 * Create a billing segment for a room
 * 
 * Requirements:
 * - REQ-6.1, REQ-6.7: Create segment with occupancy tracking
 * - REQ-6.8: Support multiple segments same day
 * - REQ-8.1: Handle empty rooms
 * 
 * Design reference: Section 3.3.2
 * 
 * @param hostelId - UUID of the hostel
 * @param roomId - UUID of the room
 * @param meterId - UUID of the electricity meter
 * @param startReadingId - UUID of the starting meter reading
 * @param startTimestamp - When the segment starts
 * @param updateOccupants - true for occupancy_change, false for month_end
 * @returns UUID of the created segment
 */
export async function createBillingSegment(
  hostelId: string,
  roomId: string,
  meterId: string,
  startReadingId: string,
  startTimestamp: Date,
  _updateOccupants: boolean
): Promise<string> {
  
  // Step 1: Get applicable rate
  const ratePerUnit = await getApplicableRate(hostelId, startTimestamp);
  
  // Step 2: Get active occupants
  const occupants = await getActiveOccupants(roomId, startTimestamp);
  const occupantCount = occupants.length;
  
  // Step 3: Determine segment type (REQ-8.1)
  const segmentType: SegmentType = occupantCount === 0 ? 'empty' : 'occupied';
  
  // Step 4: Determine billing month (YYYY-MM format)
  const billingMonth = startTimestamp.toISOString().substring(0, 7);
  
  // Step 5: Create billing segment (open)
  const { data: segment, error: segmentError } = await supabaseServer
    .from('billing_segments')
    .insert({
      hostel_id: hostelId,
      room_id: roomId,
      meter_id: meterId,
      start_reading_id: startReadingId,
      start_date: startTimestamp.toISOString(),
      rate_per_unit: ratePerUnit,
      occupant_count: occupantCount,
      segment_type: segmentType,
      billing_month: billingMonth
      // end_reading_id, end_date, consumption_units, total_cost_paise, closed_at remain NULL (open segment)
    })
    .select('id')
    .single();
    
  if (segmentError) {
    throw new Error(`Failed to create billing segment: ${segmentError.message}`);
  }
  
  // Step 6: Create segment_occupants records (only if occupied)
  if (segmentType === 'occupied' && occupants.length > 0) {
    const occupantRecords = occupants.map(occ => ({
      segment_id: segment.id,
      student_id: occ.studentId,
      allocation_id: occ.allocationId,
      student_name: occ.studentName,
      student_email: occ.studentEmail
    }));
    
    const { error: occupantsError } = await supabaseServer
      .from('segment_occupants')
      .insert(occupantRecords);
      
    if (occupantsError) {
      throw new Error(`Failed to create segment occupants: ${occupantsError.message}`);
    }
  }
  
  console.log(`Created ${segmentType} segment ${segment.id} with ${occupantCount} occupants`);
  return segment.id;
}

/**
 * Calculate student charges for a closed segment
 * 
 * Requirements:
 * - REQ-10.1, REQ-10.2: Divide cost with deterministic remainder allocation
 * - REQ-20.1-20.3: Paise precision and exact sum
 * 
 * Design reference: Section 3.3.4
 * 
 * Algorithm:
 * - Uses integer division to calculate base charge per student
 * - Remainder paise allocated deterministically to first N students (ordered by student_id)
 * - Ensures sum of all charges equals total_cost_paise exactly (no rounding errors)
 * 
 * Example:
 * - Total: 1000 paise, Occupants: 3
 * - Base: 1000 ÷ 3 = 333 paise
 * - Remainder: 1000 % 3 = 1 paise
 * - Allocation: [334, 333, 333] (first student gets +1 from remainder)
 * 
 * @param segmentId - UUID of the closed segment
 * @param totalCostPaise - Total cost in paise (must be non-negative integer)
 * @param occupantCount - Number of occupants (must be positive integer)
 */
async function calculateStudentCharges(
  segmentId: string,
  totalCostPaise: number,
  occupantCount: number
): Promise<void> {
  
  // Validation: occupantCount must be positive
  if (occupantCount <= 0) {
    throw new Error(`Cannot calculate charges for segment ${segmentId}: occupantCount must be positive (got ${occupantCount})`);
  }
  
  // Step 1: Get segment occupants ordered by student_id (deterministic ordering for remainder allocation)
  const { data: occupants, error: fetchError } = await supabaseServer
    .from('segment_occupants')
    .select('student_id')
    .eq('segment_id', segmentId)
    .order('student_id');  // CRITICAL: Deterministic ordering for remainder allocation
    
  if (fetchError) {
    throw new Error(`Failed to fetch segment occupants: ${fetchError.message}`);
  }
  
  if (!occupants || occupants.length === 0) {
    throw new Error(`No occupants found for segment ${segmentId}`);
  }
  
  if (occupants.length !== occupantCount) {
    throw new Error(
      `Occupant count mismatch for segment ${segmentId}: ` +
      `expected ${occupantCount}, found ${occupants.length}`
    );
  }
  
  // Step 2: Calculate base charge and remainder using INTEGER division
  const baseCharge = Math.floor(totalCostPaise / occupantCount);  // Integer division
  const remainder = totalCostPaise % occupantCount;  // Remainder paise
  
  // Step 3: Get segment metadata for charges
  const { data: segment, error: segmentError } = await supabaseServer
    .from('billing_segments')
    .select('hostel_id, room_id, billing_month')
    .eq('id', segmentId)
    .single();
    
  if (segmentError || !segment) {
    throw new Error(`Segment ${segmentId} not found: ${segmentError?.message || 'Unknown error'}`);
  }
  
  // Step 4: Create charge records with deterministic remainder allocation
  // First 'remainder' students get baseCharge + 1, rest get baseCharge
  const chargeRecords = occupants.map((occ, index) => ({
    segment_id: segmentId,
    student_id: occ.student_id,
    hostel_id: segment.hostel_id,
    room_id: segment.room_id,
    billing_month: segment.billing_month,
    // First 'remainder' students get extra 1 paise
    charge_amount_paise: baseCharge + (index < remainder ? 1 : 0)
  }));
  
  // Step 5: Verify sum equals total (CRITICAL: must be exact)
  const calculatedTotal = chargeRecords.reduce((sum, charge) => sum + charge.charge_amount_paise, 0);
  if (calculatedTotal !== totalCostPaise) {
    throw new Error(
      `Charge calculation error for segment ${segmentId}: ` +
      `sum of charges (${calculatedTotal} paise) != total cost (${totalCostPaise} paise)`
    );
  }
  
  // Step 6: Insert charge records
  const { error: insertError } = await supabaseServer
    .from('student_electricity_charges')
    .insert(chargeRecords);
    
  if (insertError) {
    throw new Error(`Failed to insert student charges: ${insertError.message}`);
  }
  
  console.log(
    `Created ${occupantCount} student charges for segment ${segmentId}: ` +
    `${totalCostPaise} paise total (base: ${baseCharge}, remainder: ${remainder})`
  );
}

/**
 * Close an open billing segment
 * 
 * Requirements:
 * - REQ-7.1, REQ-7.5: Close segment and calculate charges
 * - REQ-7.8: Calculate consumption and costs
 * - REQ-8.2, REQ-8.4: Handle empty rooms (no student charges)
 * 
 * Design reference: Section 3.3.3
 * 
 * @param roomId - UUID of the room
 * @param endReadingId - UUID of the ending meter reading
 * @param endReadingValue - Value of the ending reading
 * @param endTimestamp - When the segment ends
 * @returns UUID of the closed segment, or null if no open segment
 */
export async function closeOpenSegment(
  roomId: string,
  endReadingId: string,
  endReadingValue: number,
  endTimestamp: Date
): Promise<string | null> {
  
  // Step 1: Find open segment for room
  const { data: openSegment, error: fetchError } = await supabaseServer
    .from('billing_segments')
    .select('id, start_reading_id, rate_per_unit, occupant_count, segment_type')
    .eq('room_id', roomId)
    .is('end_date', null)
    .maybeSingle();
    
  if (fetchError) {
    throw new Error(`Failed to fetch open segment: ${fetchError.message}`);
  }
  
  if (!openSegment) {
    console.log('No open segment to close');
    return null;
  }
  
  // Step 2: Get start reading value
  const { data: startReading, error: startReadingError } = await supabaseServer
    .from('meter_readings')
    .select('reading_value')
    .eq('id', openSegment.start_reading_id)
    .single();
    
  if (startReadingError || !startReading) {
    throw new Error(`Start reading not found: ${startReadingError?.message || 'Unknown error'}`);
  }
  
  // Step 3: Calculate consumption and cost
  const consumptionUnits = endReadingValue - startReading.reading_value;
  const totalCostRupees = consumptionUnits * openSegment.rate_per_unit;
  const totalCostPaise = Math.round(totalCostRupees * 100);  // Convert to paise
  
  // Step 4: Close segment
  const { error: updateError } = await supabaseServer
    .from('billing_segments')
    .update({
      end_reading_id: endReadingId,
      end_date: endTimestamp.toISOString(),
      consumption_units: consumptionUnits,
      total_cost_paise: totalCostPaise,
      closed_at: new Date().toISOString()
    })
    .eq('id', openSegment.id);
    
  if (updateError) {
    throw new Error(`Failed to close segment: ${updateError.message}`);
  }
  
  // Step 5: Calculate student charges (only if occupied)
  if (openSegment.segment_type === 'occupied' && openSegment.occupant_count > 0) {
    await calculateStudentCharges(openSegment.id, totalCostPaise, openSegment.occupant_count);
  }
  // Empty segments: no student charges created (REQ-8.4)
  
  console.log(
    `Closed segment ${openSegment.id}: ${consumptionUnits} units, ` +
    `₹${totalCostRupees.toFixed(2)} (${totalCostPaise} paise), ` +
    `type: ${openSegment.segment_type}`
  );
  
  return openSegment.id;
}
