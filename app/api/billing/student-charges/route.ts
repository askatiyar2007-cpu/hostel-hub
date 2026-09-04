import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import { z } from 'zod';

// Query parameter validation schema (Design Section 6.4.1)
const StudentChargesQuerySchema = z.object({
  student_id: z.string().uuid('Invalid student ID format'),
  billing_month: z.string().regex(/^\d{4}-\d{2}$/, 'Billing month must be in YYYY-MM format')
});

interface StudentChargeDetail {
  segment_id: string;
  room_number: string;
  start_date: string;
  end_date: string;
  consumption_units: number;
  rate_per_unit: number;
  occupant_count: number;
  charge_amount_paise: number;
  charge_amount_rupees: number;
}

interface StudentChargesResponse {
  student_id: string;
  student_name: string;
  billing_month: string;
  charges: StudentChargeDetail[];
  total_paise: number;
  total_rupees: number;
}

/**
 * GET /api/billing/student-charges?student_id={studentId}&billing_month={YYYY-MM}
 * 
 * Retrieves electricity charges for a student, broken down by billing segments.
 * 
 * Requirements:
 * - REQ-17.1: Display the Student's current month electricity charges
 * - REQ-17.3: Display: Consumption, Electricity_Rate, total_cost, and Segment_Charge per segment
 * 
 * Design: Section 6.4.1
 * 
 * @param req - Request with query params student_id (required) and billing_month (optional, defaults to current month)
 * @returns Student charges breakdown with segment details and monthly total
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate the user using cookie-based client
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[Student Charges API] Authentication failed:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify user role (student or owner) using service role to bypass RLS
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('id, role, user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.log('[Student Charges API] Profile lookup failed:', profileError.message);
      return NextResponse.json(
        { error: 'Failed to verify user profile' },
        { status: 403 }
      );
    }

    if (!profile) {
      console.log('[Student Charges API] No profile found for user');
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 403 }
      );
    }

    if (profile.role !== 'student' && profile.role !== 'owner' && profile.role !== 'hostel_owner') {
      console.log('[Student Charges API] Authorization failed - invalid role:', profile.role);
      return NextResponse.json(
        { error: 'Forbidden: Only students and owners can view charges' },
        { status: 403 }
      );
    }

    // 3. Parse and validate query parameters
    const searchParams = req.nextUrl.searchParams;
    const studentId = searchParams.get('student_id');
    const billingMonth = searchParams.get('billing_month');

    if (!studentId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: student_id' },
        { status: 400 }
      );
    }

    // Default to current month if not provided (REQ-17.1)
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM format
    const validated = StudentChargesQuerySchema.parse({
      student_id: studentId,
      billing_month: billingMonth || currentMonth
    });

    // 4. Authorization check: Students can only view their own charges (REQ-19.3)
    if (profile.role === 'student') {
      // Resolve the authenticated user's students.id
      // students.profile_id references profiles.id, not auth.users.id
      const { data: studentRecord, error: studentError } = await supabaseServer
        .from('students')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (studentError) {
        return NextResponse.json(
          { error: 'Failed to verify student record' },
          { status: 403 }
        );
      }

      if (!studentRecord) {
        return NextResponse.json(
          { error: 'Student record not found' },
          { status: 403 }
        );
      }

      // Authorize: students.id must match the requested student_id
      if (validated.student_id !== studentRecord.id) {
        return NextResponse.json(
          { error: 'Forbidden: You can only view your own charges' },
          { status: 403 }
        );
      }
    }

    // 5. If owner, verify they own the hostel that the student belongs to (REQ-19.1)
    if (profile.role === 'owner' || profile.role === 'hostel_owner') {
      // Check if the student has any charges in hostels owned by this owner
      const { data: ownershipCheck, error: ownershipError } = await supabaseServer
        .from('student_electricity_charges')
        .select('hostel_id, hostels!inner(owner_id)')
        .eq('student_id', validated.student_id)
        .eq('billing_month', validated.billing_month)
        .limit(1);

      if (ownershipError) {
        console.error('[Student Charges API] Ownership check failed:', ownershipError);
        return NextResponse.json(
          { error: 'Failed to verify hostel ownership' },
          { status: 500 }
        );
      }

      // If no charges exist, that's ok (empty response), but if they do, verify ownership
      if (ownershipCheck && ownershipCheck.length > 0) {
        const hostels = ownershipCheck[0].hostels as unknown as { owner_id: string } | { owner_id: string }[] | null;
        const hostelOwnerId = (Array.isArray(hostels) ? hostels[0] : hostels)?.owner_id;
        if (hostelOwnerId !== user.id) {
          console.log('[Student Charges API] Authorization failed - owner viewing charges from different hostel');
          return NextResponse.json(
            { error: 'Forbidden: You can only view charges for students in your hostels' },
            { status: 403 }
          );
        }
      }
    }

    // 6. Get student name for response
    // validated.student_id is students.id, so we need to join through students table
    const { data: studentProfile, error: studentError } = await supabaseServer
      .from('students')
      .select('profiles!inner(full_name)')
      .eq('id', validated.student_id)
      .single();

    if (studentError) {
      console.error('[Student Charges API] Failed to fetch student profile:', studentError);
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    // Extract full_name from the nested profiles object
    const studentName = (studentProfile as any)?.profiles?.full_name || 'Unknown';

    // 7. Query student charges with segment details (Design Section 6.4.1)
    const { data: chargesData, error: chargesError } = await supabaseServer
      .from('student_electricity_charges')
      .select(`
        segment_id,
        charge_amount_paise,
        billing_segments!inner(
          start_date,
          end_date,
          consumption_units,
          rate_per_unit,
          occupant_count,
          room_id,
          rooms!inner(room_number)
        )
      `)
      .eq('student_id', validated.student_id)
      .eq('billing_month', validated.billing_month)
      .order('billing_segments(start_date)', { ascending: true });

    if (chargesError) {
      console.error('[Student Charges API] Failed to fetch charges:', chargesError);
      return NextResponse.json(
        { error: 'Failed to fetch charges', details: chargesError.message },
        { status: 500 }
      );
    }

    // 8. Transform database response to API response format
    const charges: StudentChargeDetail[] = [];
    
    for (const chargeRaw of (chargesData || [])) {
      const charge = chargeRaw as unknown as {
        segment_id: string;
        charge_amount_paise: number;
        billing_segments: {
          start_date: string;
          end_date: string | null;
          consumption_units: string | number;
          rate_per_unit: string | number;
          occupant_count: number;
          room_id: string;
          rooms: {
            room_number: string;
          } | {
            room_number: string;
          }[] | null;
        } | {
          start_date: string;
          end_date: string | null;
          consumption_units: string | number;
          rate_per_unit: string | number;
          occupant_count: number;
          room_id: string;
          rooms: {
            room_number: string;
          } | {
            room_number: string;
          }[] | null;
        }[] | null;
      };
      
      const rawSegment = charge.billing_segments;
      const segment = Array.isArray(rawSegment) ? rawSegment[0] : rawSegment;
      if (!segment) continue;
      
      const rawRoom = segment.rooms;
      const room = Array.isArray(rawRoom) ? rawRoom[0] : rawRoom;
      if (!room) continue;
      
      charges.push({
        segment_id: charge.segment_id,
        room_number: room.room_number,
        start_date: segment.start_date,
        end_date: segment.end_date || '',
        consumption_units: parseFloat(segment.consumption_units as string),
        rate_per_unit: parseFloat(segment.rate_per_unit as string),
        occupant_count: segment.occupant_count,
        charge_amount_paise: charge.charge_amount_paise,
        charge_amount_rupees: charge.charge_amount_paise / 100 // Convert paise to rupees
      });
    }

    // 9. Calculate monthly totals (REQ-17.1, REQ-17.3)
    const totalPaise = charges.reduce((sum, charge) => sum + charge.charge_amount_paise, 0);
    const totalRupees = totalPaise / 100;

    const response: StudentChargesResponse = {
      student_id: validated.student_id,
      student_name: studentName,
      billing_month: validated.billing_month || currentMonth,
      charges,
      total_paise: totalPaise,
      total_rupees: totalRupees
    };

    console.log('[Student Charges API] Success:', {
      student_id: validated.student_id,
      billing_month: validated.billing_month,
      charges_count: charges.length,
      total_rupees: totalRupees
    });

    return NextResponse.json(response, { status: 200 });

  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      console.log('[Student Charges API] Validation error:', error.errors);
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
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Student Charges API] Unexpected error:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
