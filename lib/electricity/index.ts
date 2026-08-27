/**
 * HostelHub Electricity Management System
 * Public API exports
 */

// Reading validation and recording functions
export {
  validateMeterReading,
  recordMeterReading
} from './reading-validation';

// Billing segment lifecycle functions
export {
  getActiveOccupants,
  createBillingSegment,
  closeOpenSegment
} from './segment-lifecycle';

// Occupancy change detection and processing (Task 9)
export {
  processOccupancyChangeEvent,
  handleOccupancyChange,
  processMultipleSameDayChanges
} from './occupancy-change';

// Month-end processing (Task 11)
export {
  getHostelTimezone,
  generateMonthEndReminders,
  recordMonthEndReading
} from './month-end';

// Concurrency control and idempotency (Task 12)
export {
  recordMeterReadingWithLock,
  recordReadingIdempotent,
  checkReadingSafety
} from './concurrency';

// Rate management (Task 16)
export {
  getApplicableRate,
  updateElectricityRate,
  getRateHistory,
  getCurrentRate
} from './rate-management';

// Additional types from segment lifecycle
export type {
  ActiveOccupant
} from './segment-lifecycle';

// Type exports
export type {
  ElectricityMeter,
  ElectricityRateHistory,
  MeterReading,
  BillingSegment,
  SegmentOccupant,
  StudentElectricityCharge,
  OccupancyChangeEvent,
  ReadingReason,
  SegmentType,
  OccupancyChangeType,
  EventStatus,
  MeterStatus,
  ValidationResult,
  RecordReadingResult
} from '@/types/electricity';
