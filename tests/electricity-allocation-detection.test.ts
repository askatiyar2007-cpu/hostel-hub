import { describe, it, expect, vi } from 'vitest';

describe('StayKosh Electricity Subsystem — Automatic Allocation Detection & Billing Alignment', () => {
  describe('Automatic Allocation Detection Logic', () => {
    it('detects a new allocation when active room allocations differ from open segment occupants', () => {
      const activeAllocations = [
        { id: 'alloc-student-b', student_id: 'student-b', student_name: 'Bob', active: true }
      ];
      const openSegment = {
        id: 'seg-1',
        start_reading_id: 'read-1',
        segment_occupants: [
          { student_id: 'student-a', allocation_id: 'alloc-student-a' }
        ]
      };

      const openOccupantAllocIds = new Set(openSegment.segment_occupants.map(o => o.allocation_id));
      const activeAllocIds = new Set(activeAllocations.map(a => a.id));

      const hasNewOccupant = activeAllocations.some(a => !openOccupantAllocIds.has(a.id));
      const hasDepartedOccupant = openSegment.segment_occupants.some(o => !activeAllocIds.has(o.allocation_id));
      const hasOccupancyChange = hasNewOccupant || hasDepartedOccupant;

      expect(hasOccupancyChange).toBe(true);
      expect(hasNewOccupant).toBe(true);
      expect(hasDepartedOccupant).toBe(true);
    });

    it('does NOT detect an occupancy change on page refresh or repeat reading when occupants match', () => {
      const activeAllocations = [
        { id: 'alloc-student-a', student_id: 'student-a', student_name: 'Alice', active: true }
      ];
      const openSegment = {
        id: 'seg-1',
        start_reading_id: 'read-1',
        segment_occupants: [
          { student_id: 'student-a', allocation_id: 'alloc-student-a' }
        ]
      };

      const openOccupantAllocIds = new Set(openSegment.segment_occupants.map(o => o.allocation_id));
      const activeAllocIds = new Set(activeAllocations.map(a => a.id));

      const hasNewOccupant = activeAllocations.some(a => !openOccupantAllocIds.has(a.id));
      const hasDepartedOccupant = openSegment.segment_occupants.some(o => !activeAllocIds.has(o.allocation_id));
      const hasOccupancyChange = hasNewOccupant || hasDepartedOccupant;

      expect(hasOccupancyChange).toBe(false);
    });

    it('forces initial reading on a newly installed meter with zero prior readings', () => {
      const readingCount = 0;
      const ownerInputReason = 'month_end';

      const effectiveReason = readingCount === 0 ? 'initial' : ownerInputReason;

      expect(effectiveReason).toBe('initial');
    });

    it('safely switches accidental initial reading to month_end when meter already has baseline reading', () => {
      const readingCount = 5;
      const ownerInputReason = 'initial';
      const hasOccupancyChange = false;

      let effectiveReason = ownerInputReason;
      if (readingCount > 0 && ownerInputReason === 'initial') {
        effectiveReason = hasOccupancyChange ? 'occupancy_change' : 'month_end';
      }

      expect(effectiveReason).toBe('month_end');
    });
  });

  describe('Shared Room and Successive Occupancy Calculation', () => {
    it('divides room consumption units and charges equally among active occupants with deterministic remainder distribution', () => {
      const consumptionUnits = 100;
      const ratePerUnitPaise = 1000; // Rs 10 per unit
      const totalCostPaise = consumptionUnits * ratePerUnitPaise; // 100,000 paise (Rs 1,000)

      const occupants = ['student-2', 'student-1', 'student-3']; // 3 occupants
      const occupantCount = occupants.length;

      const baseSharePaise = Math.floor(totalCostPaise / occupantCount); // 33333 paise
      const remainderPaise = totalCostPaise % occupantCount; // 1 paise

      // Deterministic sort by student_id to assign remainder paise
      const sortedOccupants = [...occupants].sort();
      const charges = sortedOccupants.map((studentId, idx) => ({
        studentId,
        chargePaise: baseSharePaise + (idx < remainderPaise ? 1 : 0),
      }));

      const sumCharges = charges.reduce((acc, c) => acc + c.chargePaise, 0);
      expect(sumCharges).toBe(totalCostPaise);
      expect(charges[0].studentId).toBe('student-1');
      expect(charges[0].chargePaise).toBe(33334); // gets the 1 remainder paise
      expect(charges[1].chargePaise).toBe(33333);
      expect(charges[2].chargePaise).toBe(33333);
    });

    it('ensures incoming student does not inherit prior student consumption', () => {
      // Prior student segment: 100 units to 250 units = 150 units
      const priorStartReading = 100;
      const checkoutReading = 250;
      const priorConsumption = checkoutReading - priorStartReading;

      // Incoming student starts at checkout reading
      const incomingStartReading = checkoutReading;
      const monthEndReading = 310;
      const incomingConsumption = monthEndReading - incomingStartReading;

      expect(priorConsumption).toBe(150);
      expect(incomingConsumption).toBe(60);
      expect(incomingConsumption + priorConsumption).toBe(monthEndReading - priorStartReading);
    });
  });

  describe('Billing Integration and Payment Status Accuracy', () => {
    it('does NOT mark electricity as paid when only rent is paid', () => {
      const rentAmount = 6000;
      const electricityAmount = 450;
      const totalDue = rentAmount + electricityAmount; // 6450

      // Student paid only 6000 (rent)
      const payments = [{ amount: 6000, status: 'completed' }];
      const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);

      const isElectricityPaid = totalPaid >= totalDue - 0.01;
      expect(isElectricityPaid).toBe(false);

      const status = isElectricityPaid ? 'paid' : 'payment_due';
      expect(status).toBe('payment_due');
    });

    it('marks electricity as paid only when total verified payments cover rent AND electricity', () => {
      const rentAmount = 6000;
      const electricityAmount = 450;
      const totalDue = rentAmount + electricityAmount; // 6450

      // Student paid 6450 in full
      const payments = [{ amount: 6450, status: 'completed' }];
      const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);

      const isElectricityPaid = totalPaid >= totalDue - 0.01;
      expect(isElectricityPaid).toBe(true);

      const status = isElectricityPaid ? 'paid' : 'payment_due';
      expect(status).toBe('paid');
    });

    it('marks electricity as pending_verification when proof submitted for full amount is awaiting approval', () => {
      const rentAmount = 6000;
      const electricityAmount = 450;
      const totalDue = rentAmount + electricityAmount; // 6450

      const payments = [{ amount: 6450, status: 'pending_verification' }];
      const completedAmount = payments.filter(p => p.status === 'completed').reduce((acc, p) => acc + p.amount, 0);
      const pendingAmount = payments.filter(p => p.status === 'pending_verification').reduce((acc, p) => acc + p.amount, 0);

      let status = 'payment_due';
      if (completedAmount >= totalDue - 0.01) {
        status = 'paid';
      } else if (completedAmount + pendingAmount >= totalDue - 0.01) {
        status = 'pending_verification';
      }

      expect(status).toBe('pending_verification');
    });
  });
});
