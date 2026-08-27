# Electricity Management System - Developer Guide

## Overview

This module provides meter reading validation and recording functionality for the HostelHub Electricity Management System.

## Quick Start

```typescript
import { validateMeterReading, recordMeterReading } from '@/lib/electricity';

// Validate a meter reading before submission
const validation = await validateMeterReading(
  'meter-uuid',
  1500,  // new reading value
  new Date()
);

if (!validation.isValid) {
  console.error('Validation failed:', validation.warnings);
  return;
}

// Record the meter reading
const result = await recordMeterReading(
  'meter-uuid',
  1500,
  'manual_check',
  'user-uuid',
  'Optional notes'
);

console.log('Reading recorded:', result.readingId);
```

## Functions

### `validateMeterReading()`

Validates a meter reading before insertion.

**Signature:**
```typescript
async function validateMeterReading(
  meterId: string,
  newReadingValue: number,
  newTimestamp: Date
): Promise<ValidationResult>
```

**Parameters:**
- `meterId` - UUID of the electricity meter
- `newReadingValue` - New reading value in kWh
- `newTimestamp` - Timestamp of the reading

**Returns:**
```typescript
interface ValidationResult {
  isValid: boolean;
  previousReading?: {
    value: number;
    timestamp: Date;
  };
  warnings: string[];
}
```

**Validation Rules:**
1. ✅ Accepts if no previous reading (first reading)
2. ✅ Accepts if `newReadingValue >= previousReading.value`
3. ❌ Rejects if `newReadingValue < previousReading.value`
4. ⚠️ Warns if consumption > 1000 units

**Example:**
```typescript
const validation = await validateMeterReading(
  'meter-uuid-123',
  2500,
  new Date()
);

if (validation.isValid) {
  if (validation.warnings.length > 0) {
    // Show warnings to user (e.g., high consumption)
    console.warn(validation.warnings);
  }
  
  // Proceed with recording
  if (validation.previousReading) {
    console.log('Previous reading:', validation.previousReading.value);
  }
} else {
  // Show error to user
  console.error(validation.warnings[0]);
}
```

### `recordMeterReading()`

Records a meter reading with reason-based segment operations.

**Signature:**
```typescript
async function recordMeterReading(
  meterId: string,
  readingValue: number,
  reason: ReadingReason,
  recordedBy: string,
  notes?: string
): Promise<RecordReadingResult>
```

**Parameters:**
- `meterId` - UUID of the electricity meter
- `readingValue` - Reading value in kWh
- `reason` - Reason for reading: `'initial' | 'occupancy_change' | 'month_end' | 'manual_check'`
- `recordedBy` - UUID of user recording the reading
- `notes` - Optional notes (max 500 characters recommended)

**Returns:**
```typescript
interface RecordReadingResult {
  readingId: string;
  segmentsAffected: string[];
}
```

**Reading Reasons:**

| Reason | When to Use | Segment Operations |
|--------|-------------|-------------------|
| `initial` | First reading when meter configured | None - establishes baseline |
| `manual_check` | Owner checking meter routinely | None - just records reading |
| `occupancy_change` | Student joins or leaves room | Closes open segment, creates new segment |
| `month_end` | End of calendar month billing | Closes open segment, creates new segment |

**Example - Manual Check:**
```typescript
// Owner doing routine meter check
const result = await recordMeterReading(
  'meter-uuid-123',
  1500,
  'manual_check',
  'owner-uuid-456',
  'Weekly check'
);

console.log('Reading recorded:', result.readingId);
// segmentsAffected will be empty []
```

**Example - Occupancy Change:**
```typescript
// Student joins/leaves room
const result = await recordMeterReading(
  'meter-uuid-123',
  1500,
  'occupancy_change',
  'owner-uuid-456',
  'Student A joined'
);

console.log('Reading recorded:', result.readingId);
console.log('Segments affected:', result.segmentsAffected);
// Future: Will include closed and newly created segment IDs
```

## Type Definitions

### ReadingReason
```typescript
type ReadingReason = 'initial' | 'occupancy_change' | 'month_end' | 'manual_check';
```

### MeterReading
```typescript
interface MeterReading {
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
```

See `types/electricity.ts` for complete type definitions.

## Error Handling

Both functions throw descriptive errors:

```typescript
try {
  const validation = await validateMeterReading(meterId, value, timestamp);
  
  if (validation.isValid) {
    const result = await recordMeterReading(
      meterId,
      value,
      'manual_check',
      userId
    );
  }
} catch (error) {
  if (error.message.includes('Meter not found')) {
    // Handle meter not found
  } else if (error.message.includes('Failed to fetch')) {
    // Handle database connection error
  } else {
    // Handle generic error
  }
}
```

## Common Use Cases

### 1. Owner Manual Meter Check
```typescript
// Step 1: Validate reading
const validation = await validateMeterReading(meterId, newValue, new Date());

if (!validation.isValid) {
  return { error: validation.warnings[0] };
}

// Step 2: Show previous reading to owner
if (validation.previousReading) {
  const consumption = newValue - validation.previousReading.value;
  console.log(`Consumption: ${consumption} units`);
}

// Step 3: Record reading
const result = await recordMeterReading(
  meterId,
  newValue,
  'manual_check',
  ownerId
);

return { success: true, readingId: result.readingId };
```

### 2. Student Join Room (Occupancy Change)
```typescript
// Owner must record reading before or at time of student joining

// Step 1: Validate reading
const validation = await validateMeterReading(meterId, newValue, new Date());

if (!validation.isValid) {
  throw new Error('Cannot process occupancy change: ' + validation.warnings[0]);
}

// Step 2: Record reading with occupancy_change reason
const result = await recordMeterReading(
  meterId,
  newValue,
  'occupancy_change',
  ownerId,
  `Student ${studentName} joined`
);

// Step 3: Process room allocation
// The reading will trigger segment closure and creation (Task 7)
```

### 3. Month-End Billing
```typescript
// Scheduled job or manual trigger at month end

const activeMeter = await getActiveMeter(roomId);

// Step 1: Validate reading
const validation = await validateMeterReading(
  activeMeter.id,
  currentReading,
  new Date()
);

if (!validation.isValid) {
  // Alert owner about validation issue
  await createNotification(ownerId, 'Invalid month-end reading');
  return;
}

// Step 2: Record month-end reading
const result = await recordMeterReading(
  activeMeter.id,
  currentReading,
  'month_end',
  'system',  // or owner ID
  `Month-end reading for ${monthName}`
);

// This will close current month's segment and start new segment
```

## Best Practices

### 1. Always Validate Before Recording
```typescript
// ✅ Good
const validation = await validateMeterReading(meterId, value, timestamp);
if (validation.isValid) {
  await recordMeterReading(meterId, value, reason, userId);
}

// ❌ Bad - skipping validation
await recordMeterReading(meterId, value, reason, userId);
```

### 2. Handle High Consumption Warnings
```typescript
const validation = await validateMeterReading(meterId, value, timestamp);

if (validation.isValid && validation.warnings.length > 0) {
  // Show confirmation dialog to user
  const confirmed = await confirmHighConsumption(validation.warnings[0]);
  
  if (confirmed) {
    await recordMeterReading(meterId, value, reason, userId);
  }
}
```

### 3. Use Appropriate Reading Reasons
```typescript
// ✅ Good - correct reason usage
await recordMeterReading(meterId, value, 'manual_check', ownerId);  // Routine check
await recordMeterReading(meterId, value, 'occupancy_change', ownerId);  // Student move

// ❌ Bad - wrong reason for scenario
await recordMeterReading(meterId, value, 'occupancy_change', ownerId);  // Just checking
```

### 4. Provide Meaningful Notes
```typescript
// ✅ Good
await recordMeterReading(
  meterId,
  value,
  'occupancy_change',
  ownerId,
  'Student John Doe joined Room 101'
);

// ❌ Less useful
await recordMeterReading(meterId, value, 'occupancy_change', ownerId);
```

## Testing

Run tests:
```bash
npm test -- lib/electricity/reading-validation.test.ts
```

The test suite includes:
- ✅ 6 validation tests
- ✅ 7 recording tests  
- ✅ 3 edge case tests

## Database Requirements

These functions require the following tables to exist:
- ✅ `electricity_meters` (from Task 1)
- ✅ `meter_readings` (from Task 1)
- ⏳ `billing_segments` (used in Task 7)

## Future Enhancements (Task 7+)

Segment operations for `occupancy_change` and `month_end` reasons are currently placeholders. Task 7 will implement:
- Close open billing segments
- Calculate consumption and charges
- Create new billing segments
- Update occupancy change events

## Support

For issues or questions:
1. Check the test file for usage examples
2. Review the requirements document (`.kiro/specs/hostelhub-electricity-management/requirements.md`)
3. Review the design document (`.kiro/specs/hostelhub-electricity-management/design.md`)

## License

Internal HostelHub project code.
