/**
 * Integration tests for Occupancy Change Detection and Processing
 * Tests for Task 9 implementation
 * Design reference: Section 8.2.1
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabaseServer } from '@/lib/supabase/server';
import {
  processOccupancyChangeEvent,
  handleOccupancyChange
} from './occupancy-change';
import { createBillingSegment } from './segment-lifecycle';

describe('Occupancy Change Detection and Processing', () => {
  
  // Test data IDs (will be created in beforeEach)
  let hostelId: string;
  let roomId: string;
  let meterId: string;
  let studentAId: string;
  let studentBId: string;
  let allocationAId: string;
  let allocationBId: string;
  let ownerId: string;
  
  beforeEach(async () => {
    // Create test hostel
    const { data: hostel, error: hostelError } = await supabaseServer
      .from('hostels')
      .insert({
        name: 'Test Hostel for Occupancy',
        address: 'Test Address',
        owner_id: '00000000-0000-0000-0000-000000000001', // Mock owner ID
        timezone: 'Asia/Kolkata'
      })
      .select('id')
      .single();
      
    if (hostelError) throw hostelError;
    hostelId = hostel.id;
    ownerId = '00000000-0000-0000-0000-000000000001';
    
    // Create test room
    const { data: room, error: roomError } = await supabaseServer
      .from('rooms')
      .insert({
        hostel_id: hostelId,
        room_number: '101',
        capacity: 3,
        floor: 1
      })
      .select('id')
      .single();
      
    if (roomError) throw roomError;
    roomId = room.id;
    
    // Create electricity rate
    await supabaseServer
      .from('electricity_rate_history')
      .insert({
        hostel_id: hostelId,
        rate_per_unit: 8.5,
        effective_from: new Date().toISOString(),
        created_by: ownerId
      });
    
    // Create test meter
    const { data: meter, error: meterError } = await supabaseServer
      .from('electricity_meters')
      .insert({
        hostel_id: hostelId,
        room_id: roomId,
        meter_number: 'METER-OCC-001',
        status: 'active',
        created_by: ownerId
      })
      .select('id')
      .single();
      
    if (meterError) throw meterError;
    meterId = meter.id;
    
    // Record initial reading
    await supabaseServer
      .from('meter_readings')
      .insert({
        meter_id: meterId,
        room_id: roomId,
        hostel_id: hostelId,
        reading_value: 1000,
        reading_timestamp: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        recorded_by: ownerId,
        reason: 'initial',
        notes: 'Initial reading for occupancy tests'
      });
    
    // Create test students
    const { data: studentA, error: studentAError } = await supabaseServer
      .from('profiles')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000002',
        full_name: 'Student A',
        email: 'studenta@test.com',
        role: 'student'
      })
      .select('user_id')
      .single();
      
    if (studentAError && studentAError.code !== '23505') throw studentAError;
    studentAId = studentA?.user_id || '00000000-0000-0000-0000-000000000002';
    
    const { data: studentB, error: studentBError } = await supabaseServer
      .from('profiles')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000003',
        full_name: 'Student B',
        email: 'studentb@test.com',
        role: 'student'
      })
      .select('user_id')
      .single();
      
    if (studentBError && studentBError.code !== '23505') throw studentBError;
    studentBId = studentB?.user_id || '00000000-0000-0000-0000-000000000003';
    
    // Create initial allocation for Student A
    const { data: allocationA, error: allocAError } = await supabaseServer
      .from('room_allocations')
      .insert({
        hostel_id: hostelId,
        room_id: roomId,
        student_id: studentAId,
        start_date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        status: 'active'
      })
      .select('id')
      .single();
      
    if (allocAError) throw allocAError;
    allocationAId = allocationA.id;
  });
  
  afterEach(async () => {
    // Cleanup test data in reverse dependency order
    if (allocationAId) {
      await supabaseServer.from('room_allocations').delete().eq('id', allocationAId);
    }
    if (allocationBId) {
      await supabaseServer.from('room_allocations').delete().eq('id', allocationBId);
    }
    if (meterId) {
      await supabaseServer.from('student_electricity_charges').delete().eq('room_id', roomId);
      await supabaseServer.from('segment_occupants').delete().in('segment_id', 
        (await supabaseServer.from('billing_segments').select('id').eq('room_id', roomId)).data?.map(s => s.id) || []
      );
      await supabaseServer.from('billing_segments').delete().eq('room_id', roomId);
      await supabaseServer.from('meter_readings').delete().eq('meter_id', meterId);
      await supabaseServer.from('electricity_meters').delete().eq('id', meterId);
    }
    if (hostelId) {
      await supabaseServer.from('electricity_rate_history').delete().eq('hostel_id', hostelId);
      await supabaseServer.from('rooms').delete().eq('hostel_id', hostelId);
      await supabaseServer.from('hostels').delete().eq('id', hostelId);
    }
  });
  
  describe('handleOccupancyChange', () => {
    
    it('should create correct segments when student joins', async () => {
      // Create initial segment with Student A only
      const initialReading = await supabaseServer
        .from('meter_readings')
        .select('id')
        .eq('meter_id', meterId)
        .eq('reason', 'initial')
        .single();
        
      if (!initialReading.data) throw new Error('Initial reading not found');
      
      await createBillingSegment(
        hostelId,
        roomId,
        meterId,
        initialReading.data.id,
        new Date(Date.now() - 86400000), // Yesterday
        false
      );
      
      // Student B joins
      const { data: allocationB, error: allocBError } = await supabaseServer
        .from('room_allocations')
        .insert({
          hostel_id: hostelId,
          room_id: roomId,
          student_id: studentBId,
          start_date: new Date().toISOString(),
          status: 'active'
        })
        .select('id')
        .single();
        
      if (allocBError) throw allocBError;
      allocationBId = allocationB.id;
      
      // Handle occupancy change
      const result = await handleOccupancyChange(
        allocationBId,
        'student_join',
        1050, // 50 units consumed
        ownerId,
        'Student B joins'
      );
      
      expect(result.readingId).toBeDefined();
      expect(result.segmentsAffected.length).toBe(2); // Closed old, created new
      
      // Verify old segment closed with 1 occupant
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
      expect(closedSegment.consumption_units).toBe(50);
      
      // Verify new segment created with 2 occupants
      const newSegment = segments![1];
      expect(newSegment.end_date).toBeNull(); // Open segment
      expect(newSegment.occupant_count).toBe(2);
      
      // Verify charges calculated for Student A only (in closed segment)
      const { data: charges } = await supabaseServer
        .from('student_electricity_charges')
        .select('*')
        .eq('segment_id', closedSegment.id);
        
      expect(charges).toBeDefined();
      expect(charges!.length).toBe(1);
      expect(charges![0].student_id).toBe(studentAId);
    });
    
    it('should create correct segments when student leaves', async () => {
      // Create initial segment with Student A only
      const initialReading = await supabaseServer
        .from('meter_readings')
        .select('id')
        .eq('meter_id', meterId)
        .eq('reason', 'initial')
        .single();
        
      if (!initialReading.data) throw new Error('Initial reading not found');
      
      await createBillingSegment(
        hostelId,
        roomId,
        meterId,
        initialReading.data.id,
        new Date(Date.now() - 86400000), // Yesterday
        false
      );
      
      // Student A leaves
      const { error: updateError } = await supabaseServer
        .from('room_allocations')
        .update({
          end_date: new Date().toISOString(),
          status: 'inactive'
        })
        .eq('id', allocationAId);
        
      if (updateError) throw updateError;
      
      // Handle occupancy change
      const result = await handleOccupancyChange(
        allocationAId,
        'student_leave',
        1075, // 75 units consumed
        ownerId,
        'Student A leaves'
      );
      
      expect(result.readingId).toBeDefined();
      expect(result.segmentsAffected.length).toBe(2); // Closed old, created new
      
      // Verify old segment closed with 1 occupant
      const { data: segments } = await supabaseServer
        .from('billing_segments')
        .select('*')
        .eq('room_id', roomId)
        .order('start_date', { ascending: true });
        
      expect(segments).toBeDefined();
      expect(segments!.length).toBe(2);
      
      const closedSegment = segments![0];
      expect(closedSegment.end_date).not.toBeNull();
      expect(closedSegment.occupant_count).toBe(1);
      expect(closedSegment.consumption_units).toBe(75);
      
      // Verify new segment created with 0 occupants (empty room)
      const newSegment = segments![1];
      expect(newSegment.end_date).toBeNull(); // Open segment
      expect(newSegment.occupant_count).toBe(0);
      expect(newSegment.segment_type).toBe('empty');
    });
    
    it('should handle same-day join and leave', async () => {
      // Create initial segment with Student A
      const initialReading = await supabaseServer
        .from('meter_readings')
        .select('id')
        .eq('meter_id', meterId)
        .eq('reason', 'initial')
        .single();
        
      if (!initialReading.data) throw new Error('Initial reading not found');
      
      await createBillingSegment(
        hostelId,
        roomId,
        meterId,
        initialReading.data.id,
        new Date(Date.now() - 86400000),
        false
      );
      
      const today = new Date();
      const morning = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0);
      const afternoon = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0, 0);
      
      // Student B joins at 9 AM
      const { data: allocationB } = await supabaseServer
        .from('room_allocations')
        .insert({
          hostel_id: hostelId,
          room_id: roomId,
          student_id: studentBId,
          start_date: morning.toISOString(),
          status: 'active'
        })
        .select('id')
        .single();
        
      allocationBId = allocationB!.id;
      
      const joinResult = await handleOccupancyChange(
        allocationBId,
        'student_join',
        1060,
        ownerId,
        'Student B joins at 9 AM'
      );
      
      expect(joinResult.segmentsAffected.length).toBe(2);
      
      // Student B leaves at 2 PM
      await supabaseServer
        .from('room_allocations')
        .update({
          end_date: afternoon.toISOString(),
          status: 'inactive'
        })
        .eq('id', allocationBId);
      
      const leaveResult = await handleOccupancyChange(
        allocationBId,
        'student_leave',
        1065,
        ownerId,
        'Student B leaves at 2 PM'
      );
      
      expect(leaveResult.segmentsAffected.length).toBe(2);
      
      // Verify 3 segments created
      const { data: segments } = await supabaseServer
        .from('billing_segments')
        .select('*')
        .eq('room_id', roomId)
        .order('start_date', { ascending: true });
        
      expect(segments).toBeDefined();
      expect(segments!.length).toBe(3);
      
      // Segment 1: Before B joins (1 occupant - A)
      expect(segments![0].occupant_count).toBe(1);
      expect(segments![0].end_date).not.toBeNull();
      
      // Segment 2: B joined (2 occupants - A and B)
      expect(segments![1].occupant_count).toBe(2);
      expect(segments![1].end_date).not.toBeNull();
      
      // Segment 3: After B leaves (1 occupant - A)
      expect(segments![2].occupant_count).toBe(1);
      expect(segments![2].end_date).toBeNull(); // Still open
    });
    
  });
  
  describe('processOccupancyChangeEvent', () => {
    
    it('should process pending event when qualifying reading exists', async () => {
      // Create an occupancy change event
      const changeTimestamp = new Date();
      const { data: event } = await supabaseServer
        .from('occupancy_change_events')
        .insert({
          hostel_id: hostelId,
          room_id: roomId,
          allocation_id: allocationAId,
          student_id: studentAId,
          change_type: 'student_join',
          change_timestamp: changeTimestamp.toISOString(),
          status: 'pending_reading'
        })
        .select('id')
        .single();
        
      expect(event).toBeDefined();
      
      // Record a qualifying reading (before change timestamp)
      const readingTimestamp = new Date(changeTimestamp.getTime() - 1000); // 1 second before
      await supabaseServer
        .from('meter_readings')
        .insert({
          meter_id: meterId,
          room_id: roomId,
          hostel_id: hostelId,
          reading_value: 1100,
          reading_timestamp: readingTimestamp.toISOString(),
          recorded_by: ownerId,
          reason: 'occupancy_change',
          notes: 'Qualifying reading'
        });
      
      // Process the event
      await processOccupancyChangeEvent(event!.id);
      
      // Verify event status updated to completed
      const { data: updatedEvent } = await supabaseServer
        .from('occupancy_change_events')
        .select('*')
        .eq('id', event!.id)
        .single();
        
      expect(updatedEvent).toBeDefined();
      expect(updatedEvent!.status).toBe('completed');
      expect(updatedEvent!.required_reading_id).not.toBeNull();
      expect(updatedEvent!.completed_at).not.toBeNull();
      
      // Cleanup
      await supabaseServer
        .from('occupancy_change_events')
        .delete()
        .eq('id', event!.id);
    });
    
    it('should remain pending when no qualifying reading exists', async () => {
      // Create an occupancy change event
      const changeTimestamp = new Date();
      const { data: event } = await supabaseServer
        .from('occupancy_change_events')
        .insert({
          hostel_id: hostelId,
          room_id: roomId,
          allocation_id: allocationAId,
          student_id: studentAId,
          change_type: 'student_leave',
          change_timestamp: changeTimestamp.toISOString(),
          status: 'pending_reading'
        })
        .select('id')
        .single();
        
      expect(event).toBeDefined();
      
      // Try to process without qualifying reading
      await processOccupancyChangeEvent(event!.id);
      
      // Verify event still pending
      const { data: updatedEvent } = await supabaseServer
        .from('occupancy_change_events')
        .select('*')
        .eq('id', event!.id)
        .single();
        
      expect(updatedEvent).toBeDefined();
      expect(updatedEvent!.status).toBe('pending_reading');
      expect(updatedEvent!.required_reading_id).toBeNull();
      
      // Cleanup
      await supabaseServer
        .from('occupancy_change_events')
        .delete()
        .eq('id', event!.id);
    });
    
  });
  
});
