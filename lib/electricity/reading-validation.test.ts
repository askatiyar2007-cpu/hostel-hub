/**
 * Unit tests for meter reading validation logic
 * Test coverage for design.md Section 8.1.3
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { validateMeterReading, recordMeterReading } from './reading-validation';
import { supabaseServer } from '@/lib/supabase/server';

// Mock the Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: {
    from: vi.fn()
  }
}));

describe('validateMeterReading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('accepts reading equal to previous', async () => {
    // Setup: Previous reading value is 1000
    const mockPreviousReading = {
      reading_value: 1000,
      reading_timestamp: '2024-01-15T10:00:00Z'
    };

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockPreviousReading,
                error: null
              })
            })
          })
        })
      })
    });

    (supabaseServer.from as any) = mockFrom;

    // Test: New reading equals previous (zero consumption)
    const result = await validateMeterReading(
      'meter-id-123',
      1000,
      new Date('2024-01-16T10:00:00Z')
    );

    expect(result.isValid).toBe(true);
    expect(result.previousReading).toEqual({
      value: 1000,
      timestamp: new Date('2024-01-15T10:00:00Z')
    });
    expect(result.warnings).toHaveLength(0);
  });

  test('rejects reading less than previous', async () => {
    // Setup: Previous reading value is 1000
    const mockPreviousReading = {
      reading_value: 1000,
      reading_timestamp: '2024-01-15T10:00:00Z'
    };

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockPreviousReading,
                error: null
              })
            })
          })
        })
      })
    });

    (supabaseServer.from as any) = mockFrom;

    // Test: New reading is less than previous
    const result = await validateMeterReading(
      'meter-id-123',
      950,
      new Date('2024-01-16T10:00:00Z')
    );

    expect(result.isValid).toBe(false);
    expect(result.previousReading).toEqual({
      value: 1000,
      timestamp: new Date('2024-01-15T10:00:00Z')
    });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('less than previous reading');
  });

  test('warns for consumption > 1000 units', async () => {
    // Setup: Previous reading value is 1000
    const mockPreviousReading = {
      reading_value: 1000,
      reading_timestamp: '2024-01-15T10:00:00Z'
    };

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockPreviousReading,
                error: null
              })
            })
          })
        })
      })
    });

    (supabaseServer.from as any) = mockFrom;

    // Test: New reading exceeds previous by 1500 units
    const result = await validateMeterReading(
      'meter-id-123',
      2500,
      new Date('2024-01-16T10:00:00Z')
    );

    expect(result.isValid).toBe(true);
    expect(result.previousReading).toEqual({
      value: 1000,
      timestamp: new Date('2024-01-15T10:00:00Z')
    });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('High consumption detected');
    expect(result.warnings[0]).toContain('1500 units');
  });

  test('accepts first reading as baseline', async () => {
    // Setup: No previous reading exists
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          })
        })
      })
    });

    (supabaseServer.from as any) = mockFrom;

    // Test: First reading for meter
    const result = await validateMeterReading(
      'meter-id-123',
      500,
      new Date('2024-01-15T10:00:00Z')
    );

    expect(result.isValid).toBe(true);
    expect(result.previousReading).toBeUndefined();
    expect(result.warnings).toHaveLength(0);
  });

  test('accepts reading greater than previous', async () => {
    // Setup: Previous reading value is 1000
    const mockPreviousReading = {
      reading_value: 1000,
      reading_timestamp: '2024-01-15T10:00:00Z'
    };

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockPreviousReading,
                error: null
              })
            })
          })
        })
      })
    });

    (supabaseServer.from as any) = mockFrom;

    // Test: Normal consumption (500 units)
    const result = await validateMeterReading(
      'meter-id-123',
      1500,
      new Date('2024-01-16T10:00:00Z')
    );

    expect(result.isValid).toBe(true);
    expect(result.previousReading).toEqual({
      value: 1000,
      timestamp: new Date('2024-01-15T10:00:00Z')
    });
    expect(result.warnings).toHaveLength(0);
  });

  test('handles database errors gracefully', async () => {
    // Setup: Database error
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database connection failed' }
              })
            })
          })
        })
      })
    });

    (supabaseServer.from as any) = mockFrom;

    // Test: Should throw error on database failure
    await expect(
      validateMeterReading(
        'meter-id-123',
        1500,
        new Date('2024-01-16T10:00:00Z')
      )
    ).rejects.toThrow('Failed to fetch previous reading');
  });
});

describe('recordMeterReading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('successfully records initial reading', async () => {
    // Setup: Meter exists
    const mockMeter = {
      id: 'meter-id-123',
      room_id: 'room-id-456',
      hostel_id: 'hostel-id-789'
    };

    const mockReading = {
      id: 'reading-id-abc'
    };

    const mockFrom = vi.fn()
      .mockReturnValueOnce({
        // First call: Get meter details
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockMeter,
              error: null
            })
          })
        })
      })
      .mockReturnValueOnce({
        // Second call: Insert reading
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockReading,
              error: null
            })
          })
        })
      });

    (supabaseServer.from as any) = mockFrom;

    // Test: Record initial reading
    const result = await recordMeterReading(
      'meter-id-123',
      500,
      'initial',
      'user-id-xyz',
      'Initial meter setup'
    );

    expect(result.readingId).toBe('reading-id-abc');
    expect(result.segmentsAffected).toHaveLength(0);
  });

  test('successfully records manual_check reading without closing segments', async () => {
    // Setup: Meter exists
    const mockMeter = {
      id: 'meter-id-123',
      room_id: 'room-id-456',
      hostel_id: 'hostel-id-789'
    };

    const mockReading = {
      id: 'reading-id-def'
    };

    const mockFrom = vi.fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockMeter,
              error: null
            })
          })
        })
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockReading,
              error: null
            })
          })
        })
      });

    (supabaseServer.from as any) = mockFrom;

    // Test: Record manual_check reading (should NOT close segments)
    const result = await recordMeterReading(
      'meter-id-123',
      750,
      'manual_check',
      'user-id-xyz',
      'Routine check'
    );

    expect(result.readingId).toBe('reading-id-def');
    expect(result.segmentsAffected).toHaveLength(0);
  });

  test('records occupancy_change reading (segment operations placeholder)', async () => {
    // Setup: Meter exists
    const mockMeter = {
      id: 'meter-id-123',
      room_id: 'room-id-456',
      hostel_id: 'hostel-id-789'
    };

    const mockReading = {
      id: 'reading-id-ghi'
    };

    // Mock for open segment (to close)
    const mockOpenSegmentChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
    };

    // Mock for rate history
    const mockRateChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ 
        data: { rate_per_unit: 8.5 }, 
        error: null 
      })
    };

    // Mock for room allocations
    const mockAllocationsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null })
    };

    // Mock for segment insert
    const mockSegmentInsertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ 
        data: { id: 'new-segment-id' }, 
        error: null 
      })
    };

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
        return fromCallCount === 1 ? mockOpenSegmentChain : mockSegmentInsertChain;
      }
      if (table === 'electricity_rate_history') return mockRateChain;
      if (table === 'room_allocations') return mockAllocationsChain;
      return null;
    });

    (supabaseServer.from as any) = mockFrom;

    // Test: Record occupancy_change reading
    const result = await recordMeterReading(
      'meter-id-123',
      1000,
      'occupancy_change',
      'user-id-xyz',
      'Student joined'
    );

    expect(result.readingId).toBe('reading-id-ghi');
    // Segment operations now implemented in Task 7
    expect(result.segmentsAffected).toHaveLength(1);
    expect(result.segmentsAffected[0]).toBe('new-segment-id');
  });

  test('records month_end reading (segment operations placeholder)', async () => {
    // Setup: Meter exists
    const mockMeter = {
      id: 'meter-id-123',
      room_id: 'room-id-456',
      hostel_id: 'hostel-id-789'
    };

    const mockReading = {
      id: 'reading-id-jkl'
    };

    // Mock for open segment (to close)
    const mockOpenSegmentChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
    };

    // Mock for rate history
    const mockRateChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ 
        data: { rate_per_unit: 8.5 }, 
        error: null 
      })
    };

    // Mock for room allocations
    const mockAllocationsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null })
    };

    // Mock for segment insert
    const mockSegmentInsertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ 
        data: { id: 'new-segment-id' }, 
        error: null 
      })
    };

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
        return fromCallCount === 1 ? mockOpenSegmentChain : mockSegmentInsertChain;
      }
      if (table === 'electricity_rate_history') return mockRateChain;
      if (table === 'room_allocations') return mockAllocationsChain;
      return null;
    });

    (supabaseServer.from as any) = mockFrom;

    // Test: Record month_end reading
    const result = await recordMeterReading(
      'meter-id-123',
      1200,
      'month_end',
      'user-id-xyz',
      'End of January'
    );

    expect(result.readingId).toBe('reading-id-jkl');
    // Segment operations now implemented in Task 7
    expect(result.segmentsAffected).toHaveLength(1);
    expect(result.segmentsAffected[0]).toBe('new-segment-id');
  });

  test('throws error when meter not found', async () => {
    // Setup: Meter does not exist
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Meter not found' }
          })
        })
      })
    });

    (supabaseServer.from as any) = mockFrom;

    // Test: Should throw error when meter doesn't exist
    await expect(
      recordMeterReading(
        'invalid-meter-id',
        1000,
        'initial',
        'user-id-xyz'
      )
    ).rejects.toThrow('Meter not found');
  });

  test('throws error when reading insert fails', async () => {
    // Setup: Meter exists but insert fails
    const mockMeter = {
      id: 'meter-id-123',
      room_id: 'room-id-456',
      hostel_id: 'hostel-id-789'
    };

    const mockFrom = vi.fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockMeter,
              error: null
            })
          })
        })
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Insert failed' }
            })
          })
        })
      });

    (supabaseServer.from as any) = mockFrom;

    // Test: Should throw error on insert failure
    await expect(
      recordMeterReading(
        'meter-id-123',
        1000,
        'initial',
        'user-id-xyz'
      )
    ).rejects.toThrow('Failed to insert reading');
  });

  test('includes notes when provided', async () => {
    // Setup: Meter exists
    const mockMeter = {
      id: 'meter-id-123',
      room_id: 'room-id-456',
      hostel_id: 'hostel-id-789'
    };

    const mockReading = {
      id: 'reading-id-mno'
    };

    let capturedInsertData: any = null;

    const mockFrom = vi.fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockMeter,
              error: null
            })
          })
        })
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockImplementation((data) => {
          capturedInsertData = data;
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockReading,
                error: null
              })
            })
          };
        })
      });

    (supabaseServer.from as any) = mockFrom;

    // Test: Record reading with notes
    const result = await recordMeterReading(
      'meter-id-123',
      1500,
      'manual_check',
      'user-id-xyz',
      'Regular monthly check'
    );

    expect(result.readingId).toBe('reading-id-mno');
    expect(capturedInsertData.notes).toBe('Regular monthly check');
  });
});

describe('Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('validateMeterReading: handles exactly 1000 unit consumption (no warning)', async () => {
    const mockPreviousReading = {
      reading_value: 1000,
      reading_timestamp: '2024-01-15T10:00:00Z'
    };

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockPreviousReading,
                error: null
              })
            })
          })
        })
      })
    });

    (supabaseServer.from as any) = mockFrom;

    // Test: Exactly 1000 units should NOT trigger warning
    const result = await validateMeterReading(
      'meter-id-123',
      2000,
      new Date('2024-01-16T10:00:00Z')
    );

    expect(result.isValid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  test('validateMeterReading: handles 1001 unit consumption (triggers warning)', async () => {
    const mockPreviousReading = {
      reading_value: 1000,
      reading_timestamp: '2024-01-15T10:00:00Z'
    };

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockPreviousReading,
                error: null
              })
            })
          })
        })
      })
    });

    (supabaseServer.from as any) = mockFrom;

    // Test: 1001 units should trigger warning
    const result = await validateMeterReading(
      'meter-id-123',
      2001,
      new Date('2024-01-16T10:00:00Z')
    );

    expect(result.isValid).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('1001 units');
  });

  test('recordMeterReading: handles reading without notes', async () => {
    const mockMeter = {
      id: 'meter-id-123',
      room_id: 'room-id-456',
      hostel_id: 'hostel-id-789'
    };

    const mockReading = {
      id: 'reading-id-pqr'
    };

    let capturedInsertData: any = null;

    const mockFrom = vi.fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockMeter,
              error: null
            })
          })
        })
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockImplementation((data) => {
          capturedInsertData = data;
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockReading,
                error: null
              })
            })
          };
        })
      });

    (supabaseServer.from as any) = mockFrom;

    // Test: Record reading without notes
    const result = await recordMeterReading(
      'meter-id-123',
      1500,
      'manual_check',
      'user-id-xyz'
      // No notes parameter
    );

    expect(result.readingId).toBe('reading-id-pqr');
    expect(capturedInsertData.notes).toBeNull();
  });
});
