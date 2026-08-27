import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

// Query parameter validation schema (Design Section 6.4.3)
const BillingExportQuerySchema = z.object({
  hostel_id: z.string().uuid('Invalid hostel ID format'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
  format: z.enum(['csv']).default('csv')
});

interface BillingExportRow {
  room_number: string;
  segment_start: string;
  segment_end: string;
  consumption_kwh: number;
  rate_per_kwh: number;
  occupants: number;
  total_cost_rupees: number;
  segment_type: string;
  student_name: string;
  student_charge_rupees: number;
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
    // 1. Authenticate the user using cookie-based client
    const supabase = createClient();
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

    if (profile.role !== 'owner') {
      console.log('[Billing Export API] Authorization failed - not an owner:', profile.role);
      return NextResponse.json(
        { error: 'Forbidden: Only hostel owners can export billing data' },
        { status: 403 }
      );
    }

    // 3. Parse and validate query parameters
    const searchParams = req.nextUrl.searchParams;
    const hostelId = searchParams.get('hostel_id');
    const month = searchParams.get('month');
    const format = searchParams.get('format') || 'csv';

    if (!hostelId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: hostel_id' },
        { status: 400 }
      );
    }

    if (!month) {
      return NextResponse.json(
        { error: 'Missing required query parameter: month' },
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
      .select('id, owner_id, hostel_name')
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
        rooms!inner(room_number),
        student_electricity_charges(
          student_id,
          charge_amount_paise,
          profiles(full_name)
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

    // 6. Transform data into export rows
    const exportRows: BillingExportRow[] = [];

    for (const segment of segmentsData || []) {
      const room = segment.rooms as any;
      const charges = segment.student_electricity_charges as any[];

      const baseData = {
        room_number: room.room_number,
        segment_start: segment.start_date,
        segment_end: segment.end_date || '',
        consumption_kwh: parseFloat(segment.consumption_units || 0),
        rate_per_kwh: parseFloat(segment.rate_per_unit || 0),
        occupants: segment.occupant_count,
        total_cost_rupees: (segment.total_cost_paise || 0) / 100,
        segment_type: segment.segment_type
      };

      // If empty room segment or no charges, create single row
      if (!charges || charges.length === 0) {
        exportRows.push({
          ...baseData,
          student_name: segment.segment_type === 'empty' ? 'Empty Room' : 'No Students',
          student_charge_rupees: 0
        });
      } else {
        // Create one row per student charge
        for (const charge of charges) {
          const profile = charge.profiles as any;
          exportRows.push({
            ...baseData,
            student_name: profile?.full_name || 'Unknown',
            student_charge_rupees: (charge.charge_amount_paise || 0) / 100
          });
        }
      }
    }

    // 7. Convert to CSV format
    const csv = convertToCSV(exportRows);

    // 8. Set appropriate headers for file download (Design Section 6.4.3)
    const filename = `billing_${hostel.hostel_name || 'hostel'}_${validated.month}.csv`;
    const headers = new Headers();
    headers.set('Content-Type', 'text/csv; charset=utf-8');
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);

    console.log('[Billing Export API] Success:', {
      hostel_id: validated.hostel_id,
      billing_month: validated.month,
      rows_exported: exportRows.length
    });

    return new NextResponse(csv, {
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
 * Convert billing export rows to CSV format
 * 
 * @param rows - Array of billing export rows
 * @returns CSV string with headers and data
 */
function convertToCSV(rows: BillingExportRow[]): string {
  // CSV header (Design Section 6.4.3)
  const headers = [
    'Room Number',
    'Segment Start',
    'Segment End',
    'Consumption (kWh)',
    'Rate (₹/kWh)',
    'Occupants',
    'Total Cost (₹)',
    'Segment Type',
    'Student Name',
    'Student Charge (₹)'
  ];

  const csvLines = [headers.join(',')];

  for (const row of rows) {
    const values = [
      escapeCsvValue(row.room_number),
      escapeCsvValue(row.segment_start),
      escapeCsvValue(row.segment_end),
      row.consumption_kwh.toFixed(2),
      row.rate_per_kwh.toFixed(4),
      row.occupants.toString(),
      row.total_cost_rupees.toFixed(2),
      escapeCsvValue(row.segment_type),
      escapeCsvValue(row.student_name),
      row.student_charge_rupees.toFixed(2)
    ];

    csvLines.push(values.join(','));
  }

  return csvLines.join('\n');
}

/**
 * Escape CSV value to handle special characters
 * 
 * @param value - Value to escape
 * @returns Escaped CSV value
 */
function escapeCsvValue(value: string): string {
  if (value == null) {
    return '';
  }

  const stringValue = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}
