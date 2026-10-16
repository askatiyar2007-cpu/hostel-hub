import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

// Query parameter validation schema (Design Section 6.4.3)
const BillingExportQuerySchema = z.object({
  hostel_id: z.string().uuid('Invalid hostel ID format'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
  format: z.enum(['csv']).default('csv')
});

export interface BillingExportRow {
  room_number: string;
  cycle_status: string;
  segment_start: string;
  segment_end: string;
  consumption_kwh: number | null;
  rate_per_kwh: number;
  occupants: number;
  total_cost_rupees: number | null;
  segment_type: string;
  student_name: string;
  student_charge_rupees: number | null;
}

/**
 * GET /api/billing/export?hostel_id={hostelId}&month={YYYY-MM}&format=csv
 * 
 * Exports billing data as CSV file for download.
 * Includes room, segment, and student charge details.
 * 
 * Requirements:
 * - REQ-16.7: Allow the Owner to export billing data as CSV
 * - REQ-22.7: Support CSV export format
 * 
 * Design: Section 6.4.3
 * 
 * @param req - Request with query params hostel_id, month (YYYY-MM), and format (csv)
 * @returns CSV file with billing data
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate the user (supports cookies and Bearer tokens)
    const supabase = createClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[Billing Export API] Authentication failed:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify user is a hostel owner using service role to bypass RLS
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('id, role, user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.log('[Billing Export API] Profile lookup failed:', profileError.message);
      return NextResponse.json(
        { error: 'Failed to verify user profile' },
        { status: 403 }
      );
    }

    if (!profile) {
      console.log('[Billing Export API] No profile found for user');
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 403 }
      );
    }

    if (profile.role !== 'owner' && profile.role !== 'hostel_owner') {
      console.log('[Billing Export API] Authorization failed - not an owner:', profile.role);
      return NextResponse.json(
        { error: 'Forbidden: Only hostel owners can export billing data' },
        { status: 403 }
      );
    }

    // 3. Parse and validate query parameters
    const searchParams = req.nextUrl.searchParams;
    const hostelId = searchParams.get('hostel_id');
    const month = searchParams.get('month') || searchParams.get('billing_month');
    const format = searchParams.get('format') || 'csv';

    if (!hostelId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: hostel_id' },
        { status: 400 }
      );
    }

    if (!month) {
      return NextResponse.json(
        { error: 'Missing required query parameter: month (or billing_month)' },
        { status: 400 }
      );
    }

    const validated = BillingExportQuerySchema.parse({
      hostel_id: hostelId,
      month: month,
      format: format
    });

    // 4. Verify hostel ownership (REQ-19.1)
    const { data: hostel, error: hostelError } = await supabaseServer
      .from('hostels')
      .select('id, owner_id, name')
      .eq('id', validated.hostel_id)
      .single();

    if (hostelError || !hostel) {
      console.log('[Billing Export API] Hostel not found:', hostelError?.message);
      return NextResponse.json(
        { error: 'Hostel not found' },
        { status: 404 }
      );
    }

    if (hostel.owner_id !== user.id) {
      console.log('[Billing Export API] Authorization failed - not hostel owner');
      return NextResponse.json(
        { error: 'Forbidden: You can only export billing data for your own hostels' },
        { status: 403 }
      );
    }

    // 5. Query billing segments with student charges (Design Section 6.4.3)
    const { data: segmentsData, error: segmentsError } = await supabaseServer
      .from('billing_segments')
      .select(`
        id,
        room_id,
        start_date,
        end_date,
        consumption_units,
        rate_per_unit,
        occupant_count,
        total_cost_paise,
        segment_type,
        closed_at,
        rooms!inner(room_number),
        segment_occupants(
          student_id,
          student_name,
          student_email
        ),
        student_electricity_charges(
          student_id,
          charge_amount_paise
        )
      `)
      .eq('hostel_id', validated.hostel_id)
      .eq('billing_month', validated.month)
      .order('start_date', { ascending: true });

    if (segmentsError) {
      console.error('[Billing Export API] Failed to fetch segments:', segmentsError);
      return NextResponse.json(
        { error: 'Failed to fetch billing data', details: segmentsError.message },
        { status: 500 }
      );
    }

    // 6. Transform data into export rows with finalized vs active cycle distinction
    const exportRows: BillingExportRow[] = [];

    for (const segment of segmentsData || []) {
      if (!segment) continue;
      const room = segment.rooms as any;
      const roomNumber = (Array.isArray(room) ? room[0]?.room_number : room?.room_number) || '';
      
      // Skip orphaned segment with no room identifier
      if (!roomNumber) continue;

      const charges = (segment.student_electricity_charges || []) as any[];
      const occupants = (segment.segment_occupants || []) as any[];
      const isClosed = segment.end_date != null && (segment.closed_at != null || segment.consumption_units != null);
      const cycleStatus = isClosed ? 'Finalized' : 'Cycle in Progress';
      const segmentStart = segment.start_date || '';
      const segmentEnd = segment.end_date || (isClosed ? '' : 'Pending Reading');
      const consumptionKwh = segment.consumption_units != null ? parseFloat(segment.consumption_units) : null;
      const ratePerKwh = segment.rate_per_unit != null ? parseFloat(segment.rate_per_unit) : 0;
      const totalCostRupees = segment.total_cost_paise != null ? (segment.total_cost_paise / 100) : null;
      const segmentType = segment.segment_type || (segment.occupant_count === 0 ? 'empty' : 'occupied');

      // Map occupant names by student_id
      const occupantMap = new Map<string, string>();
      for (const occ of occupants) {
        if (occ?.student_id && occ?.student_name) {
          occupantMap.set(occ.student_id, occ.student_name);
        }
      }

      // If charges exist (finalized segment with billed students)
      if (charges && charges.length > 0) {
        for (const charge of charges) {
          if (!charge) continue;
          const profile = charge.profiles as any;
          const studentName = profile?.full_name || occupantMap.get(charge.student_id) || charge.student_name || 'Student';
          exportRows.push({
            room_number: roomNumber,
            cycle_status: cycleStatus,
            segment_start: segmentStart,
            segment_end: segmentEnd,
            consumption_kwh: consumptionKwh,
            rate_per_kwh: ratePerKwh,
            occupants: segment.occupant_count ?? occupants.length,
            total_cost_rupees: totalCostRupees,
            segment_type: segmentType,
            student_name: studentName,
            student_charge_rupees: (charge.charge_amount_paise != null) ? (charge.charge_amount_paise / 100) : null
          });
        }
      } else if (occupants && occupants.length > 0) {
        // Occupied segment with occupants but no charges generated yet (e.g. cycle in progress)
        for (const occ of occupants) {
          if (!occ) continue;
          exportRows.push({
            room_number: roomNumber,
            cycle_status: cycleStatus,
            segment_start: segmentStart,
            segment_end: segmentEnd,
            consumption_kwh: consumptionKwh,
            rate_per_kwh: ratePerKwh,
            occupants: segment.occupant_count ?? occupants.length,
            total_cost_rupees: totalCostRupees,
            segment_type: segmentType,
            student_name: occ.student_name || 'Student',
            student_charge_rupees: isClosed ? 0 : null
          });
        }
      } else {
        // Empty room segment or unassigned
        exportRows.push({
          room_number: roomNumber,
          cycle_status: cycleStatus,
          segment_start: segmentStart,
          segment_end: segmentEnd,
          consumption_kwh: consumptionKwh,
          rate_per_kwh: ratePerKwh,
          occupants: segment.occupant_count ?? 0,
          total_cost_rupees: totalCostRupees,
          segment_type: segmentType,
          student_name: segmentType === 'empty' ? 'Empty Room' : 'No Students',
          student_charge_rupees: isClosed ? 0 : null
        });
      }
    }

    // 7. Convert to CSV format with UTF-8 BOM for Excel compatibility
    const csv = convertToCSV(exportRows);

    // 8. Set appropriate headers for file download
    const hostelName = (hostel as any).name || (hostel as any).hostel_name || 'Hostel';
    const sanitizedHostelName = hostelName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `billing_${sanitizedHostelName}_${validated.month}.csv`;
    const headers = new Headers();
    headers.set('Content-Type', 'text/csv; charset=utf-8');
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);

    console.log('[Billing Export API] Success:', {
      hostel_id: validated.hostel_id,
      billing_month: validated.month,
      rows_exported: exportRows.length
    });

    // Prepend UTF-8 BOM (\uFEFF) so Excel on Windows properly displays Rupee symbols (₹)
    const UTF8_BOM = '\uFEFF';
    return new NextResponse(UTF8_BOM + csv, {
      status: 200,
      headers: headers
    });

  } catch (error: any) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      console.log('[Billing Export API] Validation error:', error.errors);
      return NextResponse.json(
        { 
          error: 'Invalid query parameters',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }

    // Handle all other errors
    console.error('[Billing Export API] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Authoritative CSV headers for electricity billing export
 * Exactly 11 columns matching data rows 1:1
 */
export const CSV_HEADERS = [
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
] as const;

/**
 * Convert billing export rows to CSV format
 * 
 * Guarantees:
 * 1. Strict 1:1 field mapping with CSV_HEADERS (no trailing or unnamed columns).
 * 2. RFC 4180 CRLF (\r\n) line terminators.
 * 3. Sanitized entries (no trailing blank rows or empty orphaned records).
 * 4. Preservation of 'Pending Reading' and 'Pending' for in-progress cycles.
 * 
 * @param rows - Array of billing export rows
 * @returns CSV string with headers and data joined by CRLF
 */
export function convertToCSV(rows: BillingExportRow[]): string {
  const headerLine = CSV_HEADERS.map(escapeCsvValue).join(',');
  const lines: string[] = [headerLine];

  for (const row of rows) {
    if (!row || !row.room_number || row.room_number.trim() === '') {
      continue;
    }

    const consumptionStr = row.consumption_kwh != null
      ? Number(row.consumption_kwh).toFixed(2)
      : 'Pending';
    const rateStr = row.rate_per_kwh != null
      ? Number(row.rate_per_kwh).toFixed(4)
      : '0.0000';
    const occupantsStr = (row.occupants ?? 0).toString();
    const totalCostStr = row.total_cost_rupees != null
      ? Number(row.total_cost_rupees).toFixed(2)
      : 'Pending';
    const studentChargeStr = row.student_charge_rupees != null
      ? Number(row.student_charge_rupees).toFixed(2)
      : (row.cycle_status === 'Finalized' ? '0.00' : 'Pending');

    const values = [
      escapeCsvValue(row.room_number),
      escapeCsvValue(row.cycle_status),
      escapeCsvValue(row.segment_start),
      escapeCsvValue(row.segment_end),
      consumptionStr,
      rateStr,
      occupantsStr,
      totalCostStr,
      escapeCsvValue(row.segment_type),
      escapeCsvValue(row.student_name),
      studentChargeStr
    ];

    // Enforce 1:1 correspondence between headers and row values
    if (values.length !== CSV_HEADERS.length) {
      throw new Error(`CSV generation error: expected ${CSV_HEADERS.length} columns, got ${values.length}`);
    }

    lines.push(values.join(','));
  }

  // Join lines with RFC 4180 standard CRLF without any trailing blank line
  return lines.filter(l => l.trim().length > 0).join('\r\n');
}

/**
 * Escape CSV value to handle special characters and line breaks
 * 
 * @param value - Value to escape
 * @returns Escaped CSV value
 */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let stringValue = String(value)
    .replace(/\r\n/g, ' ')
    .replace(/[\r\n]/g, ' ')
    .trim();

  // If value contains comma, quote, or semicolon, wrap in quotes and escape internal quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes(';')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}
