import { describe, it, expect } from 'vitest';
import {
  convertToCSV,
  escapeCsvValue,
  CSV_HEADERS,
  BillingExportRow
} from '@/app/api/billing/export/route';

describe('Electricity Billing CSV Export Quality Suite', () => {
  describe('1. Headers & Character Encoding (Issue 1)', () => {
    it('contains all 11 expected headers in exact order', () => {
      expect(CSV_HEADERS).toHaveLength(11);
      expect(CSV_HEADERS).toEqual([
        'Room Number',
        'Cycle Status',
        'Segment Start',
        'Segment End',
        'Consumption (kWh)',
        'Rate (₹/kWh)',
        'Occupants',
        'Total Cost (₹)',
        'Segment Type',
        'Student Name',
        'Student Charge (₹)'
      ]);
    });

    it('includes Rupee currency symbol (₹) in headers without corruption', () => {
      const headerStr = CSV_HEADERS.join(',');
      expect(headerStr).toContain('Rate (₹/kWh)');
      expect(headerStr).toContain('Total Cost (₹)');
      expect(headerStr).toContain('Student Charge (₹)');

      // Must NOT contain mojibake characters like 竄ｹ
      expect(headerStr).not.toContain('竄');
      expect(headerStr).not.toContain('ｹ');
    });

    it('verifies UTF-8 BOM can be prepended cleanly', () => {
      const rows: BillingExportRow[] = [
        {
          room_number: '101',
          cycle_status: 'Finalized',
          segment_start: '2026-10-01',
          segment_end: '2026-10-15',
          consumption_kwh: 150.5,
          rate_per_kwh: 8.5,
          occupants: 2,
          total_cost_rupees: 1279.25,
          segment_type: 'occupied',
          student_name: 'Rahul Sharma',
          student_charge_rupees: 639.63
        }
      ];

      const csv = convertToCSV(rows);
      const csvWithBom = '\uFEFF' + csv;

      // UTF-8 BOM check
      expect(csvWithBom.charCodeAt(0)).toBe(0xFEFF);
      expect(csvWithBom.startsWith('\uFEFF')).toBe(true);
      expect(csvWithBom).toContain('Rate (₹/kWh)');
    });
  });

  describe('2. Exact Column Matching & No Trailing Column (Issue 2)', () => {
    it('ensures every data line has exactly 11 fields matching the header count', () => {
      const rows: BillingExportRow[] = [
        {
          room_number: '101',
          cycle_status: 'Finalized',
          segment_start: '2026-10-01',
          segment_end: '2026-10-15',
          consumption_kwh: 120.0,
          rate_per_kwh: 8.5,
          occupants: 1,
          total_cost_rupees: 1020.0,
          segment_type: 'occupied',
          student_name: 'Aman Verma',
          student_charge_rupees: 1020.0
        },
        {
          room_number: '102',
          cycle_status: 'Cycle in Progress',
          segment_start: '2026-10-15',
          segment_end: 'Pending Reading',
          consumption_kwh: null,
          rate_per_kwh: 8.5,
          occupants: 2,
          total_cost_rupees: null,
          segment_type: 'occupied',
          student_name: 'Priya Patel',
          student_charge_rupees: null
        },
        {
          room_number: '103',
          cycle_status: 'Finalized',
          segment_start: '2026-10-01',
          segment_end: '2026-10-31',
          consumption_kwh: 0,
          rate_per_kwh: 8.5,
          occupants: 0,
          total_cost_rupees: 0,
          segment_type: 'empty',
          student_name: 'Empty Room',
          student_charge_rupees: 0
        }
      ];

      const csv = convertToCSV(rows);
      const lines = csv.split('\r\n');

      // Total 4 lines: 1 header + 3 data rows
      expect(lines).toHaveLength(4);

      // Verify header column count
      const headerFields = lines[0].split(',');
      expect(headerFields).toHaveLength(11);

      // Verify each data row has exactly 11 fields
      for (let i = 1; i < lines.length; i++) {
        const fields = lines[i].split(',');
        expect(fields).toHaveLength(11);
        // Ensure no empty trailing field (which would indicate a trailing comma)
        expect(fields[10]).not.toBe('');
      }
    });

    it('properly quotes fields containing commas without creating extra columns', () => {
      const rows: BillingExportRow[] = [
        {
          room_number: '201-A, Block B',
          cycle_status: 'Finalized',
          segment_start: '2026-10-01',
          segment_end: '2026-10-15',
          consumption_kwh: 50.0,
          rate_per_kwh: 8.5,
          occupants: 1,
          total_cost_rupees: 425.0,
          segment_type: 'occupied',
          student_name: 'Doe, John Jr.',
          student_charge_rupees: 425.0
        }
      ];

      const csv = convertToCSV(rows);
      const lines = csv.split('\r\n');
      expect(lines).toHaveLength(2);

      // First field has a comma, so it must be enclosed in double quotes
      expect(lines[1]).toContain('"201-A, Block B"');
      expect(lines[1]).toContain('"Doe, John Jr."');
    });
  });

  describe('3. Blank Rows Prevention & CRLF Line Delimiters (Issue 3)', () => {
    it('uses RFC 4180 CRLF (\\r\\n) and has NO trailing blank row', () => {
      const rows: BillingExportRow[] = [
        {
          room_number: '101',
          cycle_status: 'Finalized',
          segment_start: '2026-10-01',
          segment_end: '2026-10-15',
          consumption_kwh: 100.0,
          rate_per_kwh: 8.0,
          occupants: 1,
          total_cost_rupees: 800.0,
          segment_type: 'occupied',
          student_name: 'Suresh Kumar',
          student_charge_rupees: 800.0
        }
      ];

      const csv = convertToCSV(rows);

      // Must contain \r\n
      expect(csv).toContain('\r\n');

      // Must NOT end with \r\n or \n (which creates an empty row in Excel)
      expect(csv.endsWith('\r\n')).toBe(false);
      expect(csv.endsWith('\n')).toBe(false);

      // Line split must have exactly 2 lines
      const lines = csv.split('\r\n');
      expect(lines).toHaveLength(2);
      expect(lines[0].trim().length).toBeGreaterThan(0);
      expect(lines[1].trim().length).toBeGreaterThan(0);
    });

    it('ignores empty or orphaned records without generating blank rows', () => {
      const rows: any[] = [
        null,
        { room_number: '' },
        { room_number: '   ' },
        {
          room_number: '101',
          cycle_status: 'Finalized',
          segment_start: '2026-10-01',
          segment_end: '2026-10-15',
          consumption_kwh: 100.0,
          rate_per_kwh: 8.0,
          occupants: 1,
          total_cost_rupees: 800.0,
          segment_type: 'occupied',
          student_name: 'Suresh Kumar',
          student_charge_rupees: 800.0
        },
        undefined,
        {}
      ];

      const csv = convertToCSV(rows as BillingExportRow[]);
      const lines = csv.split('\r\n');

      // Only header + 1 valid row
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('101');
    });
  });

  describe('4. Business Integrity: In-Progress Cycles vs Finalized Segments', () => {
    it('displays Pending Reading and Pending for active cycle without substituting zero', () => {
      const rows: BillingExportRow[] = [
        {
          room_number: '101',
          cycle_status: 'Cycle in Progress',
          segment_start: '2026-10-16',
          segment_end: 'Pending Reading',
          consumption_kwh: null,
          rate_per_kwh: 8.5,
          occupants: 2,
          total_cost_rupees: null,
          segment_type: 'occupied',
          student_name: 'Amit Patel',
          student_charge_rupees: null
        }
      ];

      const csv = convertToCSV(rows);
      const lines = csv.split('\r\n');
      const dataRow = lines[1];

      // Must display 'Pending Reading' for end date
      expect(dataRow).toContain('Pending Reading');

      // Must display 'Pending' for consumption, total cost, and student charge
      const fields = dataRow.split(',');
      expect(fields[1]).toBe('Cycle in Progress');
      expect(fields[3]).toBe('Pending Reading');
      expect(fields[4]).toBe('Pending'); // Consumption
      expect(fields[7]).toBe('Pending'); // Total Cost
      expect(fields[10]).toBe('Pending'); // Student Charge

      // Ensure '0.00' is NOT substituted for unknown values in an active cycle
      expect(fields[4]).not.toBe('0.00');
      expect(fields[7]).not.toBe('0.00');
      expect(fields[10]).not.toBe('0.00');
    });

    it('displays 0.00 for finalized empty room with 0 consumption', () => {
      const rows: BillingExportRow[] = [
        {
          room_number: '104',
          cycle_status: 'Finalized',
          segment_start: '2026-10-01',
          segment_end: '2026-10-31',
          consumption_kwh: 0,
          rate_per_kwh: 8.5,
          occupants: 0,
          total_cost_rupees: 0,
          segment_type: 'empty',
          student_name: 'Empty Room',
          student_charge_rupees: 0
        }
      ];

      const csv = convertToCSV(rows);
      const fields = csv.split('\r\n')[1].split(',');

      expect(fields[1]).toBe('Finalized');
      expect(fields[4]).toBe('0.00');
      expect(fields[7]).toBe('0.00');
      expect(fields[10]).toBe('0.00');
    });
  });

  describe('5. Sanitization & Escaping', () => {
    it('escapes quotes and wraps strings with commas or semicolons', () => {
      expect(escapeCsvValue('John "Jack" Doe')).toBe('"John ""Jack"" Doe"');
      expect(escapeCsvValue('Sharma, Rohit')).toBe('"Sharma, Rohit"');
      expect(escapeCsvValue('Item 1; Item 2')).toBe('"Item 1; Item 2"');
    });

    it('sanitizes embedded newlines and carriage returns to single spaces', () => {
      const messyInput = 'Line 1\r\nLine 2\nLine 3\rLine 4';
      const cleaned = escapeCsvValue(messyInput);
      expect(cleaned).toBe('Line 1 Line 2 Line 3 Line 4');
      expect(cleaned).not.toContain('\r');
      expect(cleaned).not.toContain('\n');
    });

    it('returns empty string for null or undefined', () => {
      expect(escapeCsvValue(null)).toBe('');
      expect(escapeCsvValue(undefined)).toBe('');
    });
  });
});
