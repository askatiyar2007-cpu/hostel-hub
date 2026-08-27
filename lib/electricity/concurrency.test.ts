/**
 * Concurrency and Idempotency tests
 * Tests for Task 12 implementation
 * Design reference: Sections 8.4.1, 8.4.2
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabaseServer } from '@/lib/supabase/server';
import {
  recordMeterReadingWithLock,
  recordReadingIdempotent,
  checkReadingSafety
} from './concurrency';

describe('Concurrency Control and Idempotency', () => {
  
  let hostelId: string;
  let roomId: string;
  let meterId: string;
  let ownerId: string;
  
  beforeEach(async () => {
    ownerId = '00000000-0000-0000-0000-000000000020';
    
    // Create test hostel
    const { data: hostel } = await supabaseServer
      .from('hostels')
      .insert({
        name: 'Test Hostel for Concurrency',
        address: 'Test Address',
        owner_id: ownerId,
        timezone: 'UTC'
      })
      .select('id')
      .single();
      
    hostelId = hostel!.id;
    
    // Create test room
    const { data: room } = await supabaseServer
      .from('rooms')
      .insert({
        hostel_id: hostelId,
        room_number: '301',
        capacity: 2,
        floor: 3
      })
      .select('id')
      .single();
      
    roomId = room!.id;
    
    // Create electricity rate
    await supabaseServer
      .from('electricity_rate_history')
      .insert({
        hostel_id: hostelId,
        rate_per_unit: 10.0,
        effective_from: new Date().toISOString(),
        created_by: ownerId
      });
    
    // Create test meter
    const { data: meter } = await supabaseServer
      .from('electricity_meters')
      .insert({
        hostel_id: hostelId,
        room_id: roomId,
        meter_number: 'METER-CONC-001',
        status: 'active',
        created_by: ownerId
      })
      .select('id')
      .single();
      
    meterId = meter!.id;
    
    // Record initial reading
    await supabaseServer
      .from('meter_readings')
      .insert({
        meter_id: meterId,
        room_id: roomId,
        hostel_id: hostelId,
        reading_value: 3000,
        reading_timestamp: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        recorded_by: ownerId,
        reason: 'initial',
        notes: 'Initial reading for concurrency tests'
      });
  });
  
  afterEach(async () => {
    // Cleanup
    if (roomId) {
      await supabaseServer.from('student_electricity_charges').delete().eq('room_id', roomId);
      const { data: segments } = await supabaseServer
        .from('billing_segments')
        .select('id')
        .eq('room_id', roomId);
      if (segments) {
        await supabaseServer
          .from('segment_occupants')
          .delete()
          .in('segment_id', segments.map(s => s.id));
      }
      await supabaseServer.from('billing_segments').delete().eq('room_id', roomId);
    }
    if (meterId) {
      await supabaseServer.from('meter_readings').delete().eq('meter_id', meterId);
      await supabaseServer.from('electricity_meters').delete().eq('id', meterId);
    }
    if (hostelId) {
      await supabaseServer.from('electricity_rate_history').delete().eq('hostel_id', hostelId);
      await supabaseServer.from('rooms').delete().eq('hostel_id', hostelId);
      await supabaseServer.from('hostels').delete().eq('id', hostelId);
    }
  });
  
  describe('recordMeterReadingWithLock', () => {
    
    it('should record reading successfully', async () => {
      const result = await recordMeterReadingWithLock(
        meterId,
        3100,
        'manual_check',
        ownerId,
        'Test reading with lock'
      );
      
      expect(result.readingId).toBeDefined();
      expect(result.segmentsAffected).toBeDefined();
      
      // Verify reading was created
      const { data: reading } = await supabaseServer
        .from('meter_readings')
        .select('*')
        .eq('id', result.readingId)
        .single();
        
      expect(reading).toBeDefined();
      expect(reading!.reading_value).toBe(3100);
      expect(reading!.reason).toBe('manual_check');
    });
    
    it('should prevent duplicate readings within 60 seconds', async () => {
      // Record first reading
      await recordMeterReadingWithLock(
        meterId,
        3150,
        'manual_check',
        ownerId,
        'First reading'
      );
      
      // Try to record duplicate within 60 seconds
      await expect(
        recordMeterReadingWithLock(
          meterId,
          3150, // Same value
          'manual_check',
          ownerId,
          'Duplicate reading'
        )
      ).rejects.toThrow(/Duplicate reading detected/);
    });
    
    it('should allow same reading after 60 seconds', async () => {
      // Record first reading with timestamp 2 minutes ago
      await supabaseServer
        .from('meter_readings')
        .insert({
          meter_id: meterId,
          room_id: roomId,
          hostel_id: hostelId,
          reading_value: 3200,
          reading_timestamp: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
          recorded_by: ownerId,
          reason: 'manual_check',
          notes: 'Old reading'
        });
      
      // Should allow same value after 60 seconds
      const result = await recordMeterReadingWithLock(
        meterId,
        3200,
        'manual_check',
        ownerId,
        'New reading with same value'
      );
      
      expect(result.readingId).toBeDefined();
    });
    
    it('should handle concurrent different readings sequentially', async () => {
      // These should both succeed as they have different values
      const promise1 = recordMeterReadingWithLock(
        meterId,
        3250,
        'manual_check',
        ownerId,
        'Reading 1'
      );
      
      const promise2 = recordMeterReadingWithLock(
        meterId,
        3260,
        'manual_check',
        ownerId,
        'Reading 2'
      );
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      expect(result1.readingId).toBeDefined();
      expect(result2.readingId).toBeDefined();
      expect(result1.readingId).not.toBe(result2.readingId);
    });
    
  });
  
  describe('recordReadingIdempotent', () => {
    
    it('should create new reading on first call', async () => {
      const idempotencyKey = 'test-key-001';
      
      const result = await recordReadingIdempotent(
        meterId,
        3300,
        'manual_check',
        ownerId,
        idempotencyKey,
        'First call'
      );
      
      expect(result.readingId).toBeDefined();
      expect(result.isNew).toBe(true);
    });
    
    it('should return cached result on duplicate call', async () => {
      const idempotencyKey = 'test-key-002';
      
      // First call
      const result1 = await recordReadingIdempotent(
        meterId,
        3350,
        'manual_check',
        ownerId,
        idempotencyKey,
        'First call'
      );
      
      expect(result1.isNew).toBe(true);
      
      // Second call with same key
      const result2 = await recordReadingIdempotent(
        meterId,
        3350,
        'manual_check',
        ownerId,
        idempotencyKey,
        'Second call'
      );
      
      expect(result2.isNew).toBe(false);
      expect(result2.readingId).toBe(result1.readingId);
    });
    
    it('should create new reading with different idempotency key', async () => {
      const key1 = 'test-key-003a';
      const key2 = 'test-key-003b';
      
      const result1 = await recordReadingIdempotent(
        meterId,
        3400,
        'manual_check',
        ownerId,
        key1,
        'First key'
      );
      
      const result2 = await recordReadingIdempotent(
        meterId,
        3450,
        'manual_check',
        ownerId,
        key2,
        'Second key'
      );
      
      expect(result1.isNew).toBe(true);
      expect(result2.isNew).toBe(true);
      expect(result1.readingId).not.toBe(result2.readingId);
    });
    
    it('should detect existing reading in database', async () => {
      // Create a reading directly in database
      const { data: existingReading } = await supabaseServer
        .from('meter_readings')
        .insert({
          meter_id: meterId,
          room_id: roomId,
          hostel_id: hostelId,
          reading_value: 3500,
          reading_timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
          recorded_by: ownerId,
          reason: 'manual_check',
          notes: 'Existing reading'
        })
        .select('id')
        .single();
      
      // Try to record same reading with idempotency key
      const result = await recordReadingIdempotent(
        meterId,
        3500,
        'manual_check',
        ownerId,
        'test-key-004',
        'Duplicate attempt'
      );
      
      expect(result.isNew).toBe(false);
      expect(result.readingId).toBe(existingReading!.id);
    });
    
  });
  
  describe('checkReadingSafety', () => {
    
    it('should return safe for active meter with no recent readings', async () => {
      const result = await checkReadingSafety(meterId);
      
      expect(result.safe).toBe(true);
      expect(result.reason).toBeUndefined();
    });
    
    it('should return unsafe for inactive meter', async () => {
      // Deactivate meter
      await supabaseServer
        .from('electricity_meters')
        .update({ status: 'inactive' })
        .eq('id', meterId);
      
      const result = await checkReadingSafety(meterId);
      
      expect(result.safe).toBe(false);
      expect(result.reason).toContain('not active');
      
      // Reactivate for cleanup
      await supabaseServer
        .from('electricity_meters')
        .update({ status: 'active' })
        .eq('id', meterId);
    });
    
    it('should return unsafe for non-existent meter', async () => {
      const result = await checkReadingSafety('00000000-0000-0000-0000-999999999999');
      
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Meter not found');
    });
    
    it('should return unsafe if recent reading exists', async () => {
      // Record a very recent reading
      await supabaseServer
        .from('meter_readings')
        .insert({
          meter_id: meterId,
          room_id: roomId,
          hostel_id: hostelId,
          reading_value: 3600,
          reading_timestamp: new Date(Date.now() - 5000).toISOString(), // 5 seconds ago
          recorded_by: ownerId,
          reason: 'manual_check',
          notes: 'Very recent reading'
        });
      
      const result = await checkReadingSafety(meterId);
      
      expect(result.safe).toBe(false);
      expect(result.reason).toContain('Recent reading recorded');
    });
    
    it('should return safe if reading is older than 10 seconds', async () => {
      // Record a reading 15 seconds ago
      await supabaseServer
        .from('meter_readings')
        .insert({
          meter_id: meterId,
          room_id: roomId,
          hostel_id: hostelId,
          reading_value: 3650,
          reading_timestamp: new Date(Date.now() - 15000).toISOString(), // 15 seconds ago
          recorded_by: ownerId,
          reason: 'manual_check',
          notes: 'Old enough reading'
        });
      
      const result = await checkReadingSafety(meterId);
      
      expect(result.safe).toBe(true);
    });
    
  });
  
  describe('Concurrency edge cases', () => {
    
    it('should handle rapid successive readings with validation', async () => {
      // First reading should succeed
      const result1 = await recordMeterReadingWithLock(
        meterId,
        3700,
        'manual_check',
        ownerId
      );
      expect(result1.readingId).toBeDefined();
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Second reading with higher value should succeed
      const result2 = await recordMeterReadingWithLock(
        meterId,
        3710,
        'manual_check',
        ownerId
      );
      expect(result2.readingId).toBeDefined();
      
      // Third reading with lower value should fail (reading validation)
      await expect(
        recordMeterReadingWithLock(
          meterId,
          3650,
          'manual_check',
          ownerId
        )
      ).rejects.toThrow();
    });
    
  });
  
});
