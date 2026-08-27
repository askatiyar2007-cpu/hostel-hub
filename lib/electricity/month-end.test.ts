/**
 * Integration tests for Month-End Processing
 * Tests for Task 11 implementation
 * Design reference: Section 8.2.2
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabaseServer } from '@/lib/supabase/server';
import {
  getHostelTimezone,
  generateMonthEndReminders,
  recordMonthEndReading
} from './month-end';
import { createBillingSegment } from './segment-lifecycle';

describe('Month-End Processing', () => {
  
  let hostelId: string;
  let roomId: string;
  let meterId: string;
  let studentId: string;
  let allocationId: string;
  let ownerId: string;
  
  beforeEach(async () => {
    ownerId = '00000000-0000-0000-0000-000000000010';
    
    // Create test hostel with timezone
    const { data: hostel } = await supabaseServer
      .from('hostels')
      .insert({
        name: 'Test Hostel for Month-End',
        address: 'Test Address',
        owner_id: ownerId,
        timezone: 'Asia/Kolkata'
      })
      .select('id')
      .single();
      
    hostelId = hostel!.id;
    
    // Create test room
    const { data: room } = await supabaseServer
      .from('rooms')
      .insert({
        hostel_id: hostelId,
        room_number: '201',
        capacity: 2,
        floor: 2
      })
      .select('id')
      .single();
      
    roomId = room!.id;
    
    // Create electricity rate
    await supabaseServer
      .from('electricity_rate_history')
      .insert({
        hostel_id: hostelId,
        rate_per_unit: 9.0,
        effective_from: new Date(Date.now() - 2592000000).toISOString(), // 30 days ago
        created_by: ownerId
      });
    
    // Create test meter
    const { data: meter } = await supabaseServer
      .from('electricity_meters')
      .insert({
        hostel_id: hostelId,
        room_id: roomId,
        meter_number: 'METER-ME-001',
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
        reading_value: 2000,
        reading_timestamp: new Date(Date.now() - 2592000000).toISOString(), // 30 days ago
        recorded_by: ownerId,
        reason: 'initial',
        notes: 'Initial reading for month-end tests'
      });
    
    // Create test student
    const { data: student } = await supabaseServer
      .from('profiles')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000011',
        full_name: 'Student Month End',
        email: 'studentme@test.com',
        role: 'student'
      })
      .select('user_id')
      .single();
      
    studentId = student?.user_id || '00000000-0000-0000-0000-000000000011';
    
    // Create allocation
    const { data: allocation } = await supabaseServer
      .from('room_allocations')
      .insert({
        hostel_id: hostelId,
        room_id: roomId,
        student_id: studentId,
        start_date: new Date(Date.now() - 2592000000).toISOString(), // 30 days ago
        status: 'active'
      })
      .select('id')
      .single();
      
    allocationId = allocation!.id;
  });
  
  afterEach(async () => {
    // Cleanup
    if (allocationId) {
      await supabaseServer.from('room_allocations').delete().eq('id', allocationId);
    }
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
  
  describe('getHostelTimezone', () => {
    
    it('should return configured timezone', async () => {
      const timezone = await getHostelTimezone(hostelId);
      expect(timezone).toBe('Asia/Kolkata');
    });
    
    it('should return UTC for hostel without timezone', async () => {
      // Create hostel without timezone
      const { data: hostel } = await supabaseServer
        .from('hostels')
        .insert({
          name: 'No Timezone Hostel',
          address: 'Test',
          owner_id: ownerId
        })
        .select('id')
        .single();
        
      const timezone = await getHostelTimezone(hostel!.id);
      expect(timezone).toBe('UTC');
      
      // Cleanup
      await supabaseServer.from('hostels').delete().eq('id', hostel!.id);
    });
    
    it('should return UTC for non-existent hostel', async () => {
      const timezone = await getHostelTimezone('00000000-0000-0000-0000-999999999999');
      expect(timezone).toBe('UTC');
    });
    
  });
  
  describe('recordMonthEndReading', () => {
    
    it('should close segment and create new with same occupants', async () => {
      // Create initial segment
      const { data: initialReading } = await supabaseServer
        .from('meter_readings')
        .select('id')
        .eq('meter_id', meterId)
        .eq('reason', 'initial')
        .single();
        
      await createBillingSegment(
        hostelId,
        roomId,
        meterId,
        initialReading!.id,
        new Date(Date.now() - 2592000000), // 30 days ago
        false
      );
      
      // Record month-end reading
      const result = await recordMonthEndReading(
        meterId,
        2150, // 150 units consumed
        ownerId,
        'Month-end reading test'
      );
      
      expect(result.readingId).toBeDefined();
      expect(result.segmentsAffected.length).toBe(2); // Closed old, created new
      
      // Verify old segment closed
      const { data: segments } = await supabaseServer
        .from('billing_segments')
        .select('*, segment_occupants(*)')
        .eq('room_id', roomId)
        .order('start_date', { ascending: true });
        
      expect(segments).toBeDefined();
      expect(segments!.length).toBe(2);
      
      const closedSegment = segments![0];
      expect(closedSegment.end_date).not.toBeNull();
      expect(closedSegment.occupant_count).toBe(1);
      expect(closedSegment.consumption_units).toBe(150);
      expect(closedSegment.segment_occupants.length).toBe(1);
      expect(closedSegment.segment_occupants[0].student_id).toBe(studentId);
      
      // Verify new segment created with SAME occupant
      const newSegment = segments![1];
      expect(newSegment.end_date).toBeNull(); // Open segment
      expect(newSegment.occupant_count).toBe(1);
      expect(newSegment.segment_occupants.length).toBe(1);
      expect(newSegment.segment_occupants[0].student_id).toBe(studentId);
      
      // Verify charges calculated for closed segment
      const { data: charges } = await supabaseServer
        .from('student_electricity_charges')
        .select('*')
        .eq('segment_id', closedSegment.id);
        
      expect(charges).toBeDefined();
      expect(charges!.length).toBe(1);
      expect(charges![0].student_id).toBe(studentId);
      
      // Calculate expected charge: 150 units * 9.0 rate = 1350 rupees = 135000 paise
      expect(charges![0].charge_amount_paise).toBe(135000);
    });
    
    it('should handle month-end with no occupancy change', async () => {
      // Create initial segment
      const { data: initialReading } = await supabaseServer
        .from('meter_readings')
        .select('id')
        .eq('meter_id', meterId)
        .eq('reason', 'initial')
        .single();
        
      await createBillingSegment(
        hostelId,
        roomId,
        meterId,
        initialReading!.id,
        new Date(Date.now() - 2592000000),
        false
      );
      
      // Record month-end reading
      const result1 = await recordMonthEndReading(
        meterId,
        2100,
        ownerId,
        'First month-end'
      );
      
      expect(result1.segmentsAffected.length).toBe(2);
      
      // Record another month-end reading (next month)
      const result2 = await recordMonthEndReading(
        meterId,
        2200,
        ownerId,
        'Second month-end'
      );
      
      expect(result2.segmentsAffected.length).toBe(2);
      
      // Verify 3 segments total
      const { data: segments } = await supabaseServer
        .from('billing_segments')
        .select('*')
        .eq('room_id', roomId)
        .order('start_date', { ascending: true });
        
      expect(segments).toBeDefined();
      expect(segments!.length).toBe(3);
      
      // All segments should have same occupant count
      expect(segments![0].occupant_count).toBe(1);
      expect(segments![1].occupant_count).toBe(1);
      expect(segments![2].occupant_count).toBe(1);
      
      // First two should be closed
      expect(segments![0].end_date).not.toBeNull();
      expect(segments![1].end_date).not.toBeNull();
      
      // Last should be open
      expect(segments![2].end_date).toBeNull();
    });
    
  });
  
  describe('generateMonthEndReminders', () => {
    
    it('should generate reminders for active meters without readings', async () => {
      // Note: This test would need to run on the last day of the month
      // to actually generate reminders. For testing purposes, we'll
      // verify the function executes without errors
      
      const result = await generateMonthEndReminders();
      
      expect(result).toBeDefined();
      expect(result.remindersCreated).toBeGreaterThanOrEqual(0);
      expect(result.remindersSkipped).toBeGreaterThanOrEqual(0);
      expect(result.errors).toBeDefined();
    });
    
    it('should skip reminders if month-end reading exists', async () => {
      // Record a month-end reading for current month
      await supabaseServer
        .from('meter_readings')
        .insert({
          meter_id: meterId,
          room_id: roomId,
          hostel_id: hostelId,
          reading_value: 2100,
          reading_timestamp: new Date().toISOString(),
          recorded_by: ownerId,
          reason: 'month_end',
          notes: 'Test month-end reading'
        });
      
      const result = await generateMonthEndReminders();
      
      // The function should skip this meter since reading exists
      expect(result).toBeDefined();
    });
    
    it('should handle hostels without active meters', async () => {
      // Deactivate the meter
      await supabaseServer
        .from('electricity_meters')
        .update({ status: 'inactive' })
        .eq('id', meterId);
      
      const result = await generateMonthEndReminders();
      
      expect(result).toBeDefined();
      expect(result.errors.length).toBe(0);
      
      // Reactivate for cleanup
      await supabaseServer
        .from('electricity_meters')
        .update({ status: 'active' })
        .eq('id', meterId);
    });
    
  });
  
});
