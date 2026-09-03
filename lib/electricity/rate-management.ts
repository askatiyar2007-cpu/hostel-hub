/**
 * Rate Management Functions
 * Handles electricity rate updates and history retrieval
 * Based on design.md Section 3.1 and 6.5
 */

import { createClient, supabaseServer } from '@/lib/supabase/server';

/**
 * Get the applicable rate for a hostel at a specific timestamp
 * Requirements: REQ-2.6, REQ-11.1
 * Design: Section 3.1.1
 * 
 * @param hostelId - The hostel UUID
 * @param segmentCreationTimestamp - The timestamp when segment is created
 * @returns The applicable rate per unit
 * @throws Error if no rate found or database error
 */
export async function getApplicableRate(
  hostelId: string,
  segmentCreationTimestamp: Date
): Promise<number> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('electricity_rate_history')
    .select('rate_per_unit')
    .eq('hostel_id', hostelId)
    .lte('effective_from', segmentCreationTimestamp.toISOString())
    .order('effective_from', { ascending: false })
    .limit(1)
    .single();
    
  if (error || !data) {
    throw new Error(
      `No electricity rate found for hostel ${hostelId} effective at ${segmentCreationTimestamp.toISOString()}`
    );
  }
  
  return data.rate_per_unit;
}

/**
 * Update electricity rate for a hostel
 * Requirements: REQ-2.1, REQ-2.4, REQ-11.4, REQ-14.2, REQ-14.3
 * Design: Section 3.1.2
 * 
 * Creates a new rate history entry with effective_from = NOW()
 * Does NOT modify existing open segments (they retain their creation rate)
 * 
 * @param hostelId - The hostel UUID
 * @param newRatePerUnit - The new rate (must be > 0)
 * @param createdBy - User ID of the owner creating the rate
 * @param notes - Optional notes about the rate change
 * @returns Object with rate_id, effective_from, and count of open segments
 * @throws Error if rate <= 0 or database error
 */
export async function updateElectricityRate(
  hostelId: string,
  newRatePerUnit: number,
  createdBy: string,
  notes?: string
): Promise<{
  rate_id: string;
  effective_from: Date;
  open_segments_count: number;
}> {
  // Validate rate > 0 (REQ-2.2, REQ-14.2)
  if (newRatePerUnit <= 0) {
    throw new Error('Electricity rate must be strictly greater than zero');
  }
  
  const supabase = await createClient();
  const effectiveFrom = new Date();
  
  // Insert new rate (never UPDATE existing) (REQ-2.5, REQ-11.3)
  const { data: newRate, error: insertError } = await supabase
    .from('electricity_rate_history')
    .insert({
      hostel_id: hostelId,
      rate_per_unit: newRatePerUnit,
      effective_from: effectiveFrom.toISOString(),
      created_by: createdBy,
      notes: notes || null
    })
    .select('id')
    .single();
    
  if (insertError) {
    throw new Error(`Failed to update rate: ${insertError.message}`);
  }
  
  // Count open segments (informational - they retain their rate) (REQ-14.3, REQ-14.7)
  const { count, error: countError } = await supabase
    .from('billing_segments')
    .select('id', { count: 'exact', head: true })
    .eq('hostel_id', hostelId)
    .is('end_date', null);
    
  if (countError) {
    console.warn('Failed to count open segments:', countError.message || countError);
  }
  
  return {
    rate_id: newRate.id,
    effective_from: effectiveFrom,
    open_segments_count: count || 0
  };
}

/**
 * Get complete rate history for a hostel
 * Requirements: REQ-14.5, REQ-11.7, REQ-11.8
 * Design: Section 6.5.2
 * 
 * @param hostelId - The hostel UUID
 * @returns Array of rate history with creator info and current flag
 */
export async function getRateHistory(
  hostelId: string
): Promise<Array<{
  id: string;
  rate_per_unit: number;
  effective_from: string;
  created_at: string;
  created_by_name: string;
  notes: string | null;
  is_current: boolean;
}>> {
  const supabase = await createClient();
  
  // Query rate history without profile join (created_by references auth.users, not profiles)
  const { data, error } = await supabase
    .from('electricity_rate_history')
    .select(`
      id,
      rate_per_unit,
      effective_from,
      created_at,
      notes,
      created_by
    `)
    .eq('hostel_id', hostelId)
    .order('effective_from', { ascending: false });
    
  if (error) {
    throw new Error(`Failed to fetch rate history: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    return [];
  }
  
  // Collect unique created_by UUIDs
  const createdByUuids = [...new Set(data.map(rate => rate.created_by))];
  
  // Fetch profile names for these UUIDs using existing pattern
  let profileMap = new Map<string, string>();
  if (createdByUuids.length > 0) {
    const { data: profiles, error: profilesError } = await supabaseServer
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', createdByUuids);
      
    if (!profilesError && profiles) {
      profileMap = new Map(profiles.map(p => [p.user_id, p.full_name || 'Unknown']));
    }
  }
  
  // The most recent effective_from is the current rate
  const mostRecentEffectiveFrom = data[0].effective_from;
  
  // Map to response format
  return data.map(rate => ({
    id: rate.id,
    rate_per_unit: rate.rate_per_unit,
    effective_from: rate.effective_from,
    created_at: rate.created_at,
    created_by_name: profileMap.get(rate.created_by) || 'Unknown',
    notes: rate.notes,
    is_current: rate.effective_from === mostRecentEffectiveFrom
  }));
}

/**
 * Get current rate for a hostel
 * Convenience function that returns just the current rate
 * 
 * @param hostelId - The hostel UUID
 * @returns The current rate per unit or null if no rate configured
 */
export async function getCurrentRate(
  hostelId: string
): Promise<number | null> {
  try {
    const rate = await getApplicableRate(hostelId, new Date());
    return rate;
  } catch (error) {
    // No rate configured yet
    return null;
  }
}
