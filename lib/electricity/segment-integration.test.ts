/**
 * Integration tests for billing segment lifecycle with reading operations
 * Tests the complete workflow from recording readings to segment creation/closure
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { recordMeterReading } from './reading-validation';

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: {
    from: vi.fn()
  }
}));

import { supabaseServer } from '@/lib/supabase/server';

describe('Segment Lifecycle Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('complete workflow: occupancy_change closes and creates segments', async () => {
    const mockMeter = {
      id: 'meter-1',
      room_id: 'room-1',
      hostel_id: 'hostel-1'
    };

    const mockReading = {
      id: 'reading-end'
    };

    // Mock open segment to close
    const mockOpenSegment = {
      id: 'segment-old',
      start_reading_id: 'reading-start',
      rate_per_unit: 8.5,
      occupant_count: 2,
      segment_type: 'occupied'
    };

    const mockStartReading = {
      reading_value: 1000
    };

    // Mock rate for new segment
    const mockRate = {
      rate_per_unit: 8.5
    };

    // Mock new occupants (one student left)
    const mockNewOccupants = [
      {
        id: 'alloc-2',
        student_id: 'student-b',
        profiles: { full_name: 'Bob', email: 'bob@test.com' }
      }
    ];

    const mockSegmentUpdate = { error: null };
    const mockNewSegment = { id: 'segment-new' };
    const mockOccupantsInsert = { error: null };

    let fromCallCount = 0;
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'electricity_meters') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockMeter,
                error: null
              })
            })
          })
        };
      }
      
      if (table === 'meter_readings') {
        fromCallCount++;
        if (fromCallCount === 1) {
          // Insert new reading
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockReading,
                  error: null
                })
              })
            })
          };
        } else {
          // Fetch start reading for consumption calculation
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockStartReading,
                  error: null
                })
              })
            })
          };
        }
      }
      
      if (table === 'billing_segments') {
        fromCallCount++;
        if (fromCallCount === 2) {
          // Find open segment
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: mockOpenSegment,
                    error: null
                  })
                })
              })
            })
          };
        } else if (fromCallCount === 4) {
          // Update/close segment
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue(mockSegmentUpdate)
            })
          };
        } else {
          // Create new segment
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockNewSegment,
                  error: null
                })
              })
            })
          };
        }
      }
      
      if (table === 'electricity_rate_history') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: mockRate,
                      error: null
                    })
                  })
                })
              })
            })
          })
        };
      }
      
      if (table === 'room_allocations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  or: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({
                      data: mockNewOccupants,
                      error: null
                    })
                  })
                })
              })
            })
          })
        };
      }
      
      if (table === 'segment_occupants') {
        return {
          insert: vi.fn().mockResolvedValue(mockOccupantsInsert)
        };
      }
      
      return null;
    });

    (supabaseServer.from as any) = mockFrom;

    // Execute: Record occupancy_change reading
    const result = await recordMeterReading(
      'meter-1',
      1150, // 150 units consumed
      'occupancy_change',
      'owner-id',
      'Student A left'
    );

    // Verify: Reading recorded
    expect(result.readingId).toBe('reading-end');
    
    // Verify: Both segments affected (closed old, created new)
    expect(result.segmentsAffected).toHaveLength(2);
    expect(result.segmentsAffected[0]).toBe('segment-old'); // Closed
    expect(result.segmentsAffected[1]).toBe('segment-new'); // Created
  });

  it('month_end reading: closes and creates segment with same occupants', async () => {
    const mockMeter = {
      id: 'meter-1',
      room_id: 'room-1',
      hostel_id: 'hostel-1'
    };

    const mockReading = {
      id: 'reading-month-end'
    };

    const mockOpenSegment = {
      id: 'segment-jan',
      start_reading_id: 'reading-jan-start',
      rate_per_unit: 8.0,
      occupant_count: 2,
      segment_type: 'occupied'
    };

    const mockStartReading = {
      reading_value: 500
    };

    const mockRate = {
      rate_per_unit: 8.5
    };

    // Same occupants continue in February
    const mockOccupants = [
      {
        id: 'alloc-1',
        student_id: 'student-a',
        profiles: { full_name: 'Alice', email: 'alice@test.com' }
      },
      {
        id: 'alloc-2',
        student_id: 'student-b',
        profiles: { full_name: 'Bob', email: 'bob@test.com' }
      }
    ];

    let fromCallCount = 0;
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'electricity_meters') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockMeter,
                error: null
              })
            })
          })
        };
      }
      
      if (table === 'meter_readings') {
        fromCallCount++;
        if (fromCallCount === 1) {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockReading,
                  error: null
                })
              })
            })
          };
        } else {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockStartReading,
                  error: null
                })
              })
            })
          };
        }
      }
      
      if (table === 'billing_segments') {
        fromCallCount++;
        if (fromCallCount === 2) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: mockOpenSegment,
                    error: null
                  })
                })
              })
            })
          };
        } else if (fromCallCount === 4) {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          };
        } else {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'segment-feb' },
                  error: null
                })
              })
            })
          };
        }
      }
      
      if (table === 'electricity_rate_history') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: mockRate,
                      error: null
                    })
                  })
                })
              })
            })
          })
        };
      }
      
      if (table === 'room_allocations') {
        // Same occupants for month_end
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  or: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({
                      data: mockOccupants,
                      error: null
                    })
                  })
                })
              })
            })
          })
        };
      }
      
      if (table === 'segment_occupants') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null })
        };
      }
      
      return null;
    });

    (supabaseServer.from as any) = mockFrom;

    // Execute: Record month_end reading
    const result = await recordMeterReading(
      'meter-1',
      700, // 200 units consumed in January
      'month_end',
      'owner-id',
      'End of January'
    );

    // Verify: Month-end closes January and creates February segment
    expect(result.readingId).toBe('reading-month-end');
    expect(result.segmentsAffected).toHaveLength(2);
    expect(result.segmentsAffected[0]).toBe('segment-jan');
    expect(result.segmentsAffected[1]).toBe('segment-feb');
  });

  it('empty room: creates empty segment with zero charges', async () => {
    const mockMeter = {
      id: 'meter-1',
      room_id: 'room-1',
      hostel_id: 'hostel-1'
    };

    const mockReading = {
      id: 'reading-empty'
    };

    const mockRate = {
      rate_per_unit: 8.5
    };

    // No occupants (empty room)
    const mockOccupants: any[] = [];

    let fromCallCount = 0;
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'electricity_meters') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockMeter,
                error: null
              })
            })
          })
        };
      }
      
      if (table === 'meter_readings') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockReading,
                error: null
              })
            })
          })
        };
      }
      
      if (table === 'billing_segments') {
        fromCallCount++;
        if (fromCallCount === 1) {
          // No open segment
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null
                  })
                })
              })
            })
          };
        } else {
          // Create empty segment
          const insertSpy = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'segment-empty' },
                error: null
              })
            })
          });
          return { insert: insertSpy };
        }
      }
      
      if (table === 'electricity_rate_history') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: mockRate,
                      error: null
                    })
                  })
                })
              })
            })
          })
        };
      }
      
      if (table === 'room_allocations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  or: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({
                      data: mockOccupants,
                      error: null
                    })
                  })
                })
              })
            })
          })
        };
      }
      
      return null;
    });

    (supabaseServer.from as any) = mockFrom;

    // Execute: Record occupancy_change for empty room
    const result = await recordMeterReading(
      'meter-1',
      1000,
      'occupancy_change',
      'owner-id',
      'Last student left'
    );

    // Verify: Empty segment created
    expect(result.readingId).toBe('reading-empty');
    expect(result.segmentsAffected).toHaveLength(1);
    expect(result.segmentsAffected[0]).toBe('segment-empty');
  });

  it('manual_check reading: does NOT trigger segment operations', async () => {
    const mockMeter = {
      id: 'meter-1',
      room_id: 'room-1',
      hostel_id: 'hostel-1'
    };

    const mockReading = {
      id: 'reading-manual'
    };

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'electricity_meters') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockMeter,
                error: null
              })
            })
          })
        };
      }
      
      if (table === 'meter_readings') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockReading,
                error: null
              })
            })
          })
        };
      }
      
      return null;
    });

    (supabaseServer.from as any) = mockFrom;

    // Execute: Record manual_check reading
    const result = await recordMeterReading(
      'meter-1',
      1050,
      'manual_check',
      'owner-id',
      'Just checking meter'
    );

    // Verify: No segments affected
    expect(result.readingId).toBe('reading-manual');
    expect(result.segmentsAffected).toHaveLength(0);
  });
});
