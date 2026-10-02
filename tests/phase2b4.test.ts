import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { calculateRoomOccupancy, calculateHostelOccupancy } from '../lib/utils/occupancy';

describe('Phase 2B-4: Occupancy Alignment and Student Offline Payment Submission', () => {
  const rootDir = path.resolve(__dirname, '..');

  describe('1. Canonical Occupancy Calculation (lib/utils/occupancy.ts)', () => {
    test('calculateRoomOccupancy: empty room returns 0 occupied and full capacity available', () => {
      const res = calculateRoomOccupancy(2, []);
      expect(res.occupiedBeds).toBe(0);
      expect(res.availableBeds).toBe(2);
      expect(res.isEntireRoom).toBe(false);
    });

    test('calculateRoomOccupancy: single shared allocation in double room', () => {
      const res = calculateRoomOccupancy(2, [{ active: true, booking_type: 'shared_bed' }]);
      expect(res.occupiedBeds).toBe(1);
      expect(res.availableBeds).toBe(1);
      expect(res.isEntireRoom).toBe(false);
    });

    test('calculateRoomOccupancy: entirely occupied room with shared beds', () => {
      const res = calculateRoomOccupancy(2, [
        { active: true, booking_type: 'shared_bed' },
        { active: true, booking_type: 'shared_bed' }
      ]);
      expect(res.occupiedBeds).toBe(2);
      expect(res.availableBeds).toBe(0);
      expect(res.isEntireRoom).toBe(false);
    });

    test('calculateRoomOccupancy: entire_room booking occupies all beds in room', () => {
      const res = calculateRoomOccupancy(3, [
        { active: true, booking_type: 'entire_room' }
      ]);
      expect(res.occupiedBeds).toBe(3);
      expect(res.availableBeds).toBe(0);
      expect(res.isEntireRoom).toBe(true);
    });

    test('calculateRoomOccupancy: inactive allocations are excluded', () => {
      const res = calculateRoomOccupancy(4, [
        { active: false, booking_type: 'entire_room' },
        { active: true, booking_type: 'shared_bed' }
      ]);
      expect(res.occupiedBeds).toBe(1);
      expect(res.availableBeds).toBe(3);
      expect(res.isEntireRoom).toBe(false);
    });

    test('calculateRoomOccupancy: active allocations exceeding room capacity capped at capacity', () => {
      const res = calculateRoomOccupancy(2, [
        { active: true, booking_type: 'shared_bed' },
        { active: true, booking_type: 'shared_bed' },
        { active: true, booking_type: 'shared_bed' }
      ]);
      expect(res.occupiedBeds).toBe(2);
      expect(res.availableBeds).toBe(0);
    });

    test('calculateHostelOccupancy: 10 rooms of capacity 2, 10 shared allocations = 50% occupancy', () => {
      const rooms = Array.from({ length: 10 }, (_, i) => ({ id: `r-${i}`, capacity: 2 }));
      const allocations = Array.from({ length: 10 }, (_, i) => ({
        room_id: `r-${Math.floor(i / 2)}`,
        active: true,
        booking_type: 'shared_bed'
      }));

      const res = calculateHostelOccupancy(rooms, allocations);
      expect(res.totalBeds).toBe(20);
      expect(res.occupiedBeds).toBe(10);
      expect(res.availableBeds).toBe(10);
      expect(res.occupancyPercentage).toBe(50);
    });

    test('calculateHostelOccupancy: 10 rooms of capacity 2, 15 shared allocations = 75% occupancy', () => {
      const rooms = Array.from({ length: 10 }, (_, i) => ({ id: `r-${i}`, capacity: 2 }));
      const allocations = Array.from({ length: 15 }, (_, i) => ({
        room_id: `r-${Math.floor(i / 2)}`,
        active: true,
        booking_type: 'shared_bed'
      }));

      const res = calculateHostelOccupancy(rooms, allocations);
      expect(res.totalBeds).toBe(20);
      expect(res.occupiedBeds).toBe(15);
      expect(res.availableBeds).toBe(5);
      expect(res.occupancyPercentage).toBe(75);
    });

    test('calculateHostelOccupancy: 1 room of capacity 3, 1 entire_room allocation = 100% occupancy', () => {
      const rooms = [{ id: 'r-1', capacity: 3 }];
      const allocations = [{ room_id: 'r-1', active: true, booking_type: 'entire_room' }];

      const res = calculateHostelOccupancy(rooms, allocations);
      expect(res.totalBeds).toBe(3);
      expect(res.occupiedBeds).toBe(3);
      expect(res.availableBeds).toBe(0);
      expect(res.occupancyPercentage).toBe(100);
    });

    test('calculateHostelOccupancy: mixed entire_room and shared rooms with empty rooms', () => {
      const rooms = [
        { id: 'r-1', capacity: 2 },
        { id: 'r-2', capacity: 3 },
        { id: 'r-3', capacity: 2 }
      ];
      const allocations = [
        { room_id: 'r-1', active: true, booking_type: 'shared_bed' }, // 1 bed
        { room_id: 'r-2', active: true, booking_type: 'entire_room' }, // 3 beds
        // r-3 has 0 allocations
      ];

      const res = calculateHostelOccupancy(rooms, allocations);
      expect(res.totalBeds).toBe(7);
      expect(res.occupiedBeds).toBe(4);
      expect(res.availableBeds).toBe(3);
      expect(res.occupancyPercentage).toBe(57); // round(4/7 * 100) = 57
    });

    test('calculateHostelOccupancy: empty hostel returns 0% without divide by zero', () => {
      const res = calculateHostelOccupancy([], []);
      expect(res.totalBeds).toBe(0);
      expect(res.occupiedBeds).toBe(0);
      expect(res.availableBeds).toBe(0);
      expect(res.occupancyPercentage).toBe(0);
    });
  });

  describe('2. Occupancy Alignment Across Application Files', () => {
    test('lib/utils/api.ts imports and uses calculateHostelOccupancy with booking_type', () => {
      const content = fs.readFileSync(path.join(rootDir, 'lib', 'utils', 'api.ts'), 'utf-8');
      expect(content).toContain('calculateHostelOccupancy');
      expect(content).toContain('booking_type');
    });

    test('app/owner/dashboard/page.tsx uses calculateHostelOccupancy with booking_type', () => {
      const content = fs.readFileSync(path.join(rootDir, 'app', 'owner', 'dashboard', 'page.tsx'), 'utf-8');
      expect(content).toContain('calculateHostelOccupancy');
      expect(content).toContain('booking_type');
    });

    test('app/owner/rooms/page.tsx uses calculateRoomOccupancy and tracks occupiedBeds and availableBeds', () => {
      const content = fs.readFileSync(path.join(rootDir, 'app', 'owner', 'rooms', 'page.tsx'), 'utf-8');
      expect(content).toContain('calculateRoomOccupancy');
      expect(content).toContain('booking_type');
      expect(content).toContain('occupiedBeds');
      expect(content).toContain('availableBeds');
    });

    test('app/owner/hostels/page.tsx uses calculateHostelOccupancy with booking_type', () => {
      const content = fs.readFileSync(path.join(rootDir, 'app', 'owner', 'hostels', 'page.tsx'), 'utf-8');
      expect(content).toContain('calculateHostelOccupancy');
      expect(content).toContain('booking_type');
    });

    test('app/owner/rooms/[id]/page.tsx uses calculateRoomOccupancy with booking_type', () => {
      const content = fs.readFileSync(path.join(rootDir, 'app', 'owner', 'rooms', '[id]', 'page.tsx'), 'utf-8');
      expect(content).toContain('calculateRoomOccupancy');
      expect(content).toContain('booking_type');
    });

    test('app/hostels/[id]/page.tsx uses calculateHostelOccupancy with booking_type', () => {
      const content = fs.readFileSync(path.join(rootDir, 'app', 'hostels', '[id]', 'page.tsx'), 'utf-8');
      expect(content).toContain('calculateHostelOccupancy');
      expect(content).toContain('booking_type');
    });
  });

  describe('3. Student Offline Payment Submission (app/student/bills/page.tsx)', () => {
    const studentBillsContent = fs.readFileSync(
      path.join(rootDir, 'app', 'student', 'bills', 'page.tsx'),
      'utf-8'
    );

    test('Calls existing public.record_student_payment RPC', () => {
      expect(studentBillsContent).toContain(".rpc('record_student_payment'");
      expect(studentBillsContent).toContain('p_student_fees_id');
      expect(studentBillsContent).toContain('p_reference_number');
      expect(studentBillsContent).toContain('p_proof_url');
    });

    test('Validates authenticated student ownership of fee', () => {
      expect(studentBillsContent).toContain('selectedFeeForPayment.student_id !== studentRecord.id');
    });

    test('Rejects payment submission for already paid or pending verification fees', () => {
      expect(studentBillsContent).toContain("selectedFeeForPayment.status === 'paid'");
      expect(studentBillsContent).toContain("selectedFeeForPayment.status === 'pending_verification'");
    });

    test('Supports payment modes upi, bank, and cash', () => {
      expect(studentBillsContent).toContain("'upi'");
      expect(studentBillsContent).toContain("'bank'");
      expect(studentBillsContent).toContain("'cash'");
    });

    test('Uploads receipt file to payments bucket in Supabase storage', () => {
      expect(studentBillsContent).toContain(".from('payments')");
      expect(studentBillsContent).toContain('.upload(');
      expect(studentBillsContent).toContain('.getPublicUrl(');
    });

    test('Dual-compatibility update for payments table', () => {
      expect(studentBillsContent).toContain(".from('payments')");
      expect(studentBillsContent).toContain("payment_status: 'pending_verification'");
      expect(studentBillsContent).toContain('student_fees_id: selectedFeeForPayment.id');
    });

    test('Includes Submit Payment Proof button in current month summary and fee rows', () => {
      expect(studentBillsContent).toContain('openPaymentModal');
      expect(studentBillsContent).toContain('Submit Payment Proof');
      expect(studentBillsContent).toContain('Submit Proof');
    });
  });
});
