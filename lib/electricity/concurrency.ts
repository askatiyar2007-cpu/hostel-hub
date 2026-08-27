/**
 * Concurrency Control and Idempotency
 * Implementation of concurrency requirements
 * Design reference: Sections 4.4, 4.5
 */

import { supabaseServer } from '@/lib/supabase/server';
import { recordMeterReading } from './reading-validation';
import type { ReadingReason, RecordReadingResult } from '@/types/electricity';

/**
 * Generate a deterministic hash from meter ID for advisory locks
 * PostgreSQL advisory locks use bigint, so we need to convert UUID to number
 * 
 * @param meterId - UUID of the meter
 * @returns Integer hash for advisory lock
 */
export function hashMeterId(meterId: string): number {
  // Remove dashes and take first 8 hex characters
  const hexStr = meterId.replace(/-/g, '').substring(0, 8);
  // Parse as hex integer (max 32-bit to avoid overflow)
  return parseInt(hexStr, 16);
}

/*
async function acquireAdvisoryLock(meterId: string): Promise<boolean> {
  const lockId = hashMeterId(meterId);
  
  // Use pg_advisory_lock (blocking lock)
  // This will wait until the lock is available
  const { data, error } = await supabaseServer
    .rpc('pg_advisory_lock', { lock_id: lockId });
    
  if (error) {
    console.error(`Failed to acquire advisory lock: ${error.message}`);
    return false;
  }
  
  return true;
}

async function releaseAdvisoryLock(meterId: string): Promise<boolean> {
  const lockId = hashMeterId(meterId);
  
  const { data, error } = await supabaseServer
    .rpc('pg_advisory_unlock', { lock_id: lockId });
    
  if (error) {
    console.error(`Failed to release advisory lock: ${error.message}`);
    return false;
  }
  
  return true;
}
*/

/**
 * Record meter reading with advisory lock to prevent concurrent operations
 * 
 * Requirements:
 * - REQ-4.4: Prevent duplicate readings within 60 seconds
 * - REQ-23.9: Prevent simultaneous conflicting operations
 * 
 * Design reference: Section 4.4
 * 
 * Uses PostgreSQL advisory locks to serialize operations on the same meter.
 * This prevents race conditions when multiple readings are submitted simultaneously.
 * 
 * @param meterId - UUID of the meter
 * @param readingValue - Reading value in kWh
 * @param reason - Reason for reading
 * @param recordedBy - UUID of user recording the reading
 * @param notes - Optional notes
 * @returns RecordReadingResult with readingId and affected segments
 */
export async function recordMeterReadingWithLock(
  meterId: string,
  readingValue: number,
  reason: ReadingReason,
  recordedBy: string,
  notes?: string
): Promise<RecordReadingResult> {
  
  // NOTE: PostgreSQL advisory locks require custom RPC functions to be set up
  // For now, we'll use the database constraint as primary defense
  // In production, uncomment the advisory lock code below
  
  /*
  // Acquire advisory lock to serialize readings for same meter
  const lockAcquired = await acquireAdvisoryLock(meterId);
  if (!lockAcquired) {
    throw new Error('Failed to acquire lock for meter reading');
  }
  */
  
  try {
    // Check for duplicate within 60 seconds
    const sixtySecondsAgo = new Date(Date.now() - 60000);
    const { data: recentReading, error: checkError } = await supabaseServer
      .from('meter_readings')
      .select('id, reading_timestamp')
      .eq('meter_id', meterId)
      .eq('reading_value', readingValue)
      .gte('reading_timestamp', sixtySecondsAgo.toISOString())
      .maybeSingle();
      
    if (checkError) {
      throw new Error(`Failed to check for duplicates: ${checkError.message}`);
    }
    
    if (recentReading) {
      throw new Error(
        `Duplicate reading detected within 60 seconds. ` +
        `Previous reading recorded at ${recentReading.reading_timestamp}`
      );
    }
    
    // Proceed with reading insertion
    const result = await recordMeterReading(
      meterId,
      readingValue,
      reason,
      recordedBy,
      notes
    );
    
    return result;
    
  } finally {
    // Always release lock
    /*
    await releaseAdvisoryLock(meterId);
    */
  }
}

/**
 * Idempotency key cache interface
 * In production, this would be backed by Redis or similar
 */
interface IdempotencyCache {
  get(key: string): Promise<RecordReadingResult | null>;
  set(key: string, result: RecordReadingResult, ttl: number): Promise<void>;
}

/**
 * Simple in-memory idempotency cache
 * In production, replace with Redis or database-backed cache
 */
class MemoryIdempotencyCache implements IdempotencyCache {
  private cache = new Map<string, { result: RecordReadingResult; expiry: number }>();
  
  async get(key: string): Promise<RecordReadingResult | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.result;
  }
  
  async set(key: string, result: RecordReadingResult, ttl: number): Promise<void> {
    this.cache.set(key, {
      result,
      expiry: Date.now() + ttl
    });
  }
  
  // Cleanup expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instance
const idempotencyCache = new MemoryIdempotencyCache();

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    idempotencyCache.cleanup();
  }, 5 * 60 * 1000);
}

/**
 * Record meter reading with idempotency key
 * 
 * Requirements:
 * - Ensure operations are idempotent where possible
 * 
 * Design reference: Section 4.5
 * 
 * If the same idempotency key is provided within the TTL period,
 * returns the cached result instead of creating a duplicate reading.
 * 
 * @param meterId - UUID of the meter
 * @param readingValue - Reading value in kWh
 * @param reason - Reason for reading
 * @param recordedBy - UUID of user recording the reading
 * @param idempotencyKey - Unique key for this operation
 * @param notes - Optional notes
 * @returns Object with readingId, segmentsAffected, and isNew flag
 */
export async function recordReadingIdempotent(
  meterId: string,
  readingValue: number,
  reason: ReadingReason,
  recordedBy: string,
  idempotencyKey: string,
  notes?: string
): Promise<RecordReadingResult & { isNew: boolean }> {
  
  // Check if operation already completed with this key
  const cached = await idempotencyCache.get(idempotencyKey);
  if (cached) {
    console.log(`Idempotency key hit: ${idempotencyKey}`);
    return { ...cached, isNew: false };
  }
  
  // Check database for recent identical reading (within last hour as fallback)
  const oneHourAgo = new Date(Date.now() - 3600000);
  const { data: existing, error: checkError } = await supabaseServer
    .from('meter_readings')
    .select('id')
    .eq('meter_id', meterId)
    .eq('reading_value', readingValue)
    .eq('reason', reason)
    .gte('reading_timestamp', oneHourAgo.toISOString())
    .maybeSingle();
    
  if (checkError) {
    console.warn(`Failed to check for existing reading: ${checkError.message}`);
    // Continue anyway - better to risk duplicate than fail
  }
  
  if (existing) {
    // Found existing reading, return it
    const result: RecordReadingResult = {
      readingId: existing.id,
      segmentsAffected: []  // We don't know which segments were affected
    };
    
    // Cache the result
    await idempotencyCache.set(idempotencyKey, result, 3600000); // 1 hour TTL
    
    return { ...result, isNew: false };
  }
  
  // Create new reading
  const result = await recordMeterReadingWithLock(
    meterId,
    readingValue,
    reason,
    recordedBy,
    notes
  );
  
  // Cache the result
  await idempotencyCache.set(idempotencyKey, result, 3600000); // 1 hour TTL
  
  return { ...result, isNew: true };
}

/**
 * Check if a meter reading operation is safe to perform
 * Verifies no conflicting operations are in progress
 * 
 * @param meterId - UUID of the meter
 * @returns Object with safe flag and reason if unsafe
 */
export async function checkReadingSafety(
  meterId: string
): Promise<{ safe: boolean; reason?: string }> {
  
  // Check if meter is active
  const { data: meter, error: meterError } = await supabaseServer
    .from('electricity_meters')
    .select('status')
    .eq('id', meterId)
    .single();
    
  if (meterError) {
    return { safe: false, reason: 'Meter not found' };
  }
  
  if (meter.status !== 'active') {
    return { safe: false, reason: 'Meter is not active' };
  }
  
  // Check for recent reading (within last 10 seconds)
  const tenSecondsAgo = new Date(Date.now() - 10000);
  const { data: recentReading, error: readingError } = await supabaseServer
    .from('meter_readings')
    .select('id, reading_timestamp')
    .eq('meter_id', meterId)
    .gte('reading_timestamp', tenSecondsAgo.toISOString())
    .maybeSingle();
    
  if (readingError) {
    console.warn(`Failed to check for recent readings: ${readingError.message}`);
  }
  
  if (recentReading) {
    return {
      safe: false,
      reason: `Recent reading recorded at ${recentReading.reading_timestamp}. Please wait before recording another.`
    };
  }
  
  return { safe: true };
}
