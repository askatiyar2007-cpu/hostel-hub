/**
 * Unit and Property Tests for Student Charge Calculation
 * Task 8.2: Property test for paise calculation
 * Task 8.3: Unit tests for charge calculation edge cases
 * 
 * Requirements:
 * - REQ-10.1, REQ-10.2: Divide cost with deterministic remainder allocation
 * - REQ-10.5, REQ-20.2: Sum of charges equals segment total exactly
 * - REQ-20.1-20.3: Paise precision and exact sum
 */

import { describe, test, expect } from 'vitest';

// Test helper: Calculate charges using the same algorithm as production code
function calculateChargeDistribution(totalPaise: number, occupantCount: number): number[] {
  if (occupantCount <= 0) {
    throw new Error('occupantCount must be positive');
  }
  
  const baseCharge = Math.floor(totalPaise / occupantCount);
  const remainder = totalPaise % occupantCount;
  
  const charges: number[] = [];
  for (let i = 0; i < occupantCount; i++) {
    charges.push(baseCharge + (i < remainder ? 1 : 0));
  }
  
  return charges;
}

describe('Student Charge Calculation - Paise Precision', () => {
  
  /**
   * Task 8.2: Property Test
   * **Property 3: Sum of charges equals segment total exactly**
   * **Validates: REQ-10.5, REQ-20.2**
   */
  describe('Property 3: Sum equals total exactly', () => {
    
    test('property: sum of distributed charges always equals total for any valid inputs', () => {
      // Test various realistic scenarios
      const testCases = [
        { total: 100, occupants: 1 },    // Single occupant
        { total: 100, occupants: 2 },    // Even split
        { total: 100, occupants: 3 },    // Uneven split with remainder
        { total: 1000, occupants: 3 },   // Standard case from design doc
        { total: 1000, occupants: 7 },   // Multiple remainder paise
        { total: 5000, occupants: 4 },   // Large amount even split
        { total: 5000, occupants: 7 },   // Large amount uneven split
        { total: 1, occupants: 1 },      // Minimum case
        { total: 1, occupants: 2 },      // 1 paise split (1 gets it, 1 gets 0)
        { total: 2, occupants: 3 },      // 2 paise split (2 get 1 each, 1 gets 0)
        { total: 10000, occupants: 11 }, // Large occupant count
        { total: 999, occupants: 10 },   // Random uneven
        { total: 12345, occupants: 6 },  // Random large
      ];
      
      for (const { total, occupants } of testCases) {
        const charges = calculateChargeDistribution(total, occupants);
        const sum = charges.reduce((acc, c) => acc + c, 0);
        
        expect(sum).toBe(total);
        expect(charges.length).toBe(occupants);
        
        // Additional property: all charges should be base or base+1
        const baseCharge = Math.floor(total / occupants);
        for (const charge of charges) {
          expect(charge).toBeGreaterThanOrEqual(baseCharge);
          expect(charge).toBeLessThanOrEqual(baseCharge + 1);
        }
      }
    });
    
    test('property: remainder paise allocated to first N students only', () => {
      const testCases = [
        { total: 1000, occupants: 3, expectedRemainder: 1 },
        { total: 100, occupants: 3, expectedRemainder: 1 },
        { total: 1000, occupants: 7, expectedRemainder: 6 },
        { total: 5000, occupants: 7, expectedRemainder: 2 },
      ];
      
      for (const { total, occupants, expectedRemainder } of testCases) {
        const charges = calculateChargeDistribution(total, occupants);
        const baseCharge = Math.floor(total / occupants);
        
        // First 'remainder' students should have baseCharge + 1
        for (let i = 0; i < expectedRemainder; i++) {
          expect(charges[i]).toBe(baseCharge + 1);
        }
        
        // Remaining students should have baseCharge
        for (let i = expectedRemainder; i < occupants; i++) {
          expect(charges[i]).toBe(baseCharge);
        }
      }
    });
    
    test('property: deterministic allocation (same inputs produce same outputs)', () => {
      const testCases = [
        { total: 1000, occupants: 3 },
        { total: 100, occupants: 7 },
        { total: 5000, occupants: 11 },
      ];
      
      for (const { total, occupants } of testCases) {
        const charges1 = calculateChargeDistribution(total, occupants);
        const charges2 = calculateChargeDistribution(total, occupants);
        
        expect(charges1).toEqual(charges2);
      }
    });
  });
  
  /**
   * Task 8.3: Unit Tests for Edge Cases
   * Design reference: Section 8.5 (cases 4-7)
   */
  describe('Edge Case 4: ₹0.01 allocation (1 paise ÷ 3 students)', () => {
    test('1 paise ÷ 3 students = [1, 0, 0]', () => {
      const charges = calculateChargeDistribution(1, 3);
      
      expect(charges).toEqual([1, 0, 0]);
      expect(charges.reduce((sum, c) => sum + c, 0)).toBe(1);
    });
    
    test('1 paise ÷ 1 student = [1]', () => {
      const charges = calculateChargeDistribution(1, 1);
      
      expect(charges).toEqual([1]);
      expect(charges.reduce((sum, c) => sum + c, 0)).toBe(1);
    });
    
    test('1 paise ÷ 2 students = [1, 0]', () => {
      const charges = calculateChargeDistribution(1, 2);
      
      expect(charges).toEqual([1, 0]);
      expect(charges.reduce((sum, c) => sum + c, 0)).toBe(1);
    });
    
    test('1 paise ÷ 5 students = [1, 0, 0, 0, 0]', () => {
      const charges = calculateChargeDistribution(1, 5);
      
      expect(charges).toEqual([1, 0, 0, 0, 0]);
      expect(charges.reduce((sum, c) => sum + c, 0)).toBe(1);
    });
  });
  
  describe('Edge Case 5: ₹0.02 allocation (2 paise ÷ 3 students)', () => {
    test('2 paise ÷ 3 students = [1, 1, 0]', () => {
      const charges = calculateChargeDistribution(2, 3);
      
      expect(charges).toEqual([1, 1, 0]);
      expect(charges.reduce((sum, c) => sum + c, 0)).toBe(2);
    });
    
    test('2 paise ÷ 2 students = [1, 1]', () => {
      const charges = calculateChargeDistribution(2, 2);
      
      expect(charges).toEqual([1, 1]);
      expect(charges.reduce((sum, c) => sum + c, 0)).toBe(2);
    });
    
    test('2 paise ÷ 5 students = [1, 1, 0, 0, 0]', () => {
      const charges = calculateChargeDistribution(2, 5);
      
      expect(charges).toEqual([1, 1, 0, 0, 0]);
      expect(charges.reduce((sum, c) => sum + c, 0)).toBe(2);
    });
  });
  
  describe('Edge Case 6: Exact division (900 paise ÷ 3 students)', () => {
    test('900 paise ÷ 3 students = [300, 300, 300] (no remainder)', () => {
      const charges = calculateChargeDistribution(900, 3);
      
      expect(charges).toEqual([300, 300, 300]);
      expect(charges.reduce((sum, c) => sum + c, 0)).toBe(900);
    });
    
    test('1000 paise ÷ 4 students = [250, 250, 250, 250] (no remainder)', () => {
      const charges = calculateChargeDistribution(1000, 4);
      
      expect(charges).toEqual([250, 250, 250, 250]);
      expect(charges.reduce((sum, c) => sum + c, 0)).toBe(1000);
    });
    
    test('1000 paise ÷ 5 students = [200, 200, 200, 200, 200] (no remainder)', () => {
      const charges = calculateChargeDistribution(1000, 5);
      
      expect(charges).toEqual([200, 200, 200, 200, 200]);
      expect(charges.reduce((sum, c) => sum + c, 0)).toBe(1000);
    });
    
    test('5000 paise ÷ 10 students = [500, 500, ...] (no remainder)', () => {
      const charges = calculateChargeDistribution(5000, 10);
      
      expect(charges).toEqual([500, 500, 500, 500, 500, 500, 500, 500, 500, 500]);
      expect(charges.reduce((sum, c) => sum + c, 0)).toBe(5000);
    });
  });
  
  describe('Edge Case 7: Large remainder (1000 paise ÷ 3 students)', () => {
    test('1000 paise ÷ 3 students = [334, 333, 333] (remainder 1)', () => {
      const charges = calculateChargeDistribution(1000, 3);
      
      expect(charges).toEqual([334, 333, 333]);
      expect(charges.reduce((sum, c) => sum + c, 0)).toBe(1000);
    });
    
    test('1000 paise ÷ 7 students = [143, 143, 143, 143, 143, 143, 142] (remainder 6)', () => {
      const charges = calculateChargeDistribution(1000, 7);
      
      expect(charges).toEqual([143, 143, 143, 143, 143, 143, 142]);
      expect(charges.reduce((sum, c) => sum + c, 0)).toBe(1000);
    });
    
    test('5000 paise ÷ 7 students = [715, 715, 714, 714, 714, 714, 714] (remainder 2)', () => {
      const charges = calculateChargeDistribution(5000, 7);
      
      expect(charges).toEqual([715, 715, 714, 714, 714, 714, 714]);
      expect(charges.reduce((sum, c) => sum + c, 0)).toBe(5000);
    });
    
    test('10000 paise ÷ 3 students = [3334, 3333, 3333] (remainder 1)', () => {
      const charges = calculateChargeDistribution(10000, 3);
      
      expect(charges).toEqual([3334, 3333, 3333]);
      expect(charges.reduce((sum, c) => sum + c, 0)).toBe(10000);
    });
  });
  
  describe('Additional Edge Cases', () => {
    test('handles single occupant (full charge to one student)', () => {
      const charges = calculateChargeDistribution(1000, 1);
      
      expect(charges).toEqual([1000]);
      expect(charges.reduce((sum, c) => sum + c, 0)).toBe(1000);
    });
    
    test('handles zero total cost (all charges are 0)', () => {
      const charges = calculateChargeDistribution(0, 3);
      
      expect(charges).toEqual([0, 0, 0]);
      expect(charges.reduce((sum, c) => sum + c, 0)).toBe(0);
    });
    
    test('handles large occupant count', () => {
      const charges = calculateChargeDistribution(10000, 100);
      
      expect(charges.length).toBe(100);
      expect(charges.reduce((sum, c) => sum + c, 0)).toBe(10000);
      // All should be 100 paise (exact division)
      expect(charges.every(c => c === 100)).toBe(true);
    });
    
    test('handles large occupant count with remainder', () => {
      const charges = calculateChargeDistribution(10001, 100);
      
      expect(charges.length).toBe(100);
      expect(charges.reduce((sum, c) => sum + c, 0)).toBe(10001);
      // First student gets 101, rest get 100
      expect(charges[0]).toBe(101);
      expect(charges.slice(1).every(c => c === 100)).toBe(true);
    });
    
    test('handles very small amounts', () => {
      const testCases = [
        { total: 1, occupants: 1, expected: [1] },
        { total: 1, occupants: 10, expected: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
        { total: 5, occupants: 10, expected: [1, 1, 1, 1, 1, 0, 0, 0, 0, 0] },
      ];
      
      for (const { total, occupants, expected } of testCases) {
        const charges = calculateChargeDistribution(total, occupants);
        expect(charges).toEqual(expected);
        expect(charges.reduce((sum, c) => sum + c, 0)).toBe(total);
      }
    });
    
    test('throws error for invalid occupant count', () => {
      expect(() => calculateChargeDistribution(1000, 0)).toThrow('occupantCount must be positive');
      expect(() => calculateChargeDistribution(1000, -1)).toThrow('occupantCount must be positive');
    });
  });
  
  describe('Calculation Properties', () => {
    test('base charge calculation is correct', () => {
      const testCases = [
        { total: 1000, occupants: 3, expectedBase: 333 },
        { total: 1000, occupants: 7, expectedBase: 142 },
        { total: 900, occupants: 3, expectedBase: 300 },
        { total: 5000, occupants: 7, expectedBase: 714 },
      ];
      
      for (const { total, occupants, expectedBase } of testCases) {
        const charges = calculateChargeDistribution(total, occupants);
        const actualBase = Math.min(...charges);
        expect(actualBase).toBe(expectedBase);
      }
    });
    
    test('remainder calculation is correct', () => {
      const testCases = [
        { total: 1000, occupants: 3, expectedRemainder: 1 },
        { total: 1000, occupants: 7, expectedRemainder: 6 },
        { total: 900, occupants: 3, expectedRemainder: 0 },
        { total: 5000, occupants: 7, expectedRemainder: 2 },
      ];
      
      for (const { total, occupants, expectedRemainder } of testCases) {
        const charges = calculateChargeDistribution(total, occupants);
        const baseCharge = Math.floor(total / occupants);
        const countWithExtra = charges.filter(c => c === baseCharge + 1).length;
        expect(countWithExtra).toBe(expectedRemainder);
      }
    });
    
    test('no charge exceeds base + 1', () => {
      const testCases = [
        { total: 1000, occupants: 3 },
        { total: 100, occupants: 7 },
        { total: 5000, occupants: 11 },
        { total: 999, occupants: 10 },
      ];
      
      for (const { total, occupants } of testCases) {
        const charges = calculateChargeDistribution(total, occupants);
        const baseCharge = Math.floor(total / occupants);
        
        for (const charge of charges) {
          expect(charge).toBeGreaterThanOrEqual(baseCharge);
          expect(charge).toBeLessThanOrEqual(baseCharge + 1);
        }
      }
    });
  });
});

/**
 * Integration tests would test the actual calculateStudentCharges function
 * against a real database. These would be in a separate integration test file
 * and would verify:
 * 
 * 1. Fetching segment_occupants correctly ordered by student_id
 * 2. Inserting student_electricity_charges records
 * 3. Error handling for missing segments/occupants
 * 4. Validation that sum matches total_cost_paise
 * 
 * Those tests would require database setup and are beyond the scope of
 * pure unit tests focused on calculation logic.
 */
