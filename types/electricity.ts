/**
 * Type definitions for HostelHub Electricity Management System
 * Based on design.md specification
 */

// ENUM types matching database
export type ReadingReason = 'initial' | 'occupancy_change' | 'month_end' | 'manual_check';
export type SegmentType = 'occupied' | 'empty';
export type OccupancyChangeType = 'student_join' | 'student_leave';
export type EventStatus = 'pending_reading' | 'reading_recorded' | 'completed' | 'cancelled';
export type MeterStatus = 'active' | 'inactive';

// Database table row types
export interface ElectricityMeter {
  id: string;
  hostel_id: string;
  room_id: string;
  meter_number: string;
  status: MeterStatus;
  created_at: string;
  created_by: string;
  deactivated_at: string | null;
  deactivated_by: string | null;
  notes: string | null;
}

export interface ElectricityRateHistory {
  id: string;
  hostel_id: string;
  rate_per_unit: number;
  effective_from: string;
  created_at: string;
  created_by: string;
  notes: string | null;
}

export interface MeterReading {
  id: string;
  meter_id: string;
  room_id: string;
  hostel_id: string;
  reading_value: number;
  reading_timestamp: string;
  recorded_by: string;
  reason: ReadingReason;
  notes: string | null;
  created_at: string;
}

export interface BillingSegment {
  id: string;
  hostel_id: string;
  room_id: string;
  meter_id: string;
  start_reading_id: string;
  end_reading_id: string | null;
  start_date: string;
  end_date: string | null;
  consumption_units: number | null;
  rate_per_unit: number;
  total_cost_paise: number | null;
  occupant_count: number;
  segment_type: SegmentType;
  billing_month: string;
  created_at: string;
  closed_at: string | null;
}

export interface SegmentOccupant {
  id: string;
  segment_id: string;
  student_id: string;
  allocation_id: string;
  student_name: string;
  student_email: string | null;
  created_at: string;
}

export interface StudentElectricityCharge {
  id: string;
  segment_id: string;
  student_id: string;
  hostel_id: string;
  room_id: string;
  charge_amount_paise: number;
  billing_month: string;
  created_at: string;
}

export interface OccupancyChangeEvent {
  id: string;
  hostel_id: string;
  room_id: string;
  allocation_id: string;
  student_id: string;
  change_type: OccupancyChangeType;
  change_timestamp: string;
  status: EventStatus;
  required_reading_id: string | null;
  reading_deadline: string | null;
  created_at: string;
  completed_at: string | null;
}

// API response types for validation and reading operations
export interface ValidationResult {
  isValid: boolean;
  previousReading?: {
    value: number;
    timestamp: Date;
  };
  warnings: string[];
}

export interface RecordReadingResult {
  readingId: string;
  segmentsAffected: string[];
}
