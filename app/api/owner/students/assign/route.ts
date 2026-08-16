import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import crypto from 'crypto';
import { sendStudentInvitationEmail } from '@/lib/email/brevo';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the owner using cookie-based client
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Debug logging (safe - no sensitive data)
    console.log('[Assignment API] Auth check:', { 
      hasUser: !!user, 
      authError: authError?.message,
      userId: user?.id 
    });

    if (authError || !user) {
      console.log('[Assignment API] Authentication failed:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify user role from profiles using service role to bypass RLS
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    console.log('[Assignment API] Profile check:', { 
      userId: user?.id,
      hasProfile: !!profile,
      role: profile?.role,
      profileError: profileError?.message
    });

    if (profileError || !profile || profile.role !== 'owner') {
      console.log('[Assignment API] Authorization failed - not an owner');
      return NextResponse.json(
        { error: 'Forbidden: Only hostel owners can assign students.' },
        { status: 403 }
      );
    }

    // 3. Parse and validate the request body
    const body = await req.json();
    const {
      student_name,
      student_email,
      student_phone,
      parent_name,
      parent_phone,
      parent_email,
      address,
      emergency_name,
      emergency_phone,
      hostel_id,
      room_id,
      start_date,
      booking_type = 'shared_bed'
    } = body;

    // Validate booking_type
    const validBookingTypes = ['shared_bed', 'entire_room'];
    if (!validBookingTypes.includes(booking_type)) {
      return NextResponse.json({ error: 'Invalid booking type. Must be shared_bed or entire_room' }, { status: 400 });
    }

    // Simple validation checks
    if (!student_name?.trim()) return NextResponse.json({ error: 'Student Name is required' }, { status: 400 });
    if (!student_email?.trim()) return NextResponse.json({ error: 'Student Email is required' }, { status: 400 });
    if (!student_phone?.trim()) return NextResponse.json({ error: 'Student Phone is required' }, { status: 400 });
    if (!parent_name?.trim()) return NextResponse.json({ error: 'Parent Name is required' }, { status: 400 });
    if (!parent_phone?.trim()) return NextResponse.json({ error: 'Parent Phone is required' }, { status: 400 });
    if (!parent_email?.trim()) return NextResponse.json({ error: 'Parent Email is required' }, { status: 400 });
    if (!address?.trim()) return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    if (!emergency_name?.trim()) return NextResponse.json({ error: 'Emergency Contact Name is required' }, { status: 400 });
    if (!emergency_phone?.trim()) return NextResponse.json({ error: 'Emergency Contact Phone is required' }, { status: 400 });
    if (!hostel_id) return NextResponse.json({ error: 'Hostel is required' }, { status: 400 });
    if (!room_id) return NextResponse.json({ error: 'Room is required' }, { status: 400 });
    if (!start_date) return NextResponse.json({ error: 'Check-in Date is required' }, { status: 400 });

    const normalizedEmail = student_email.trim().toLowerCase();

    // 4. Generate cryptographically secure random token & its SHA-256 hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 5. Calculate expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 6. Invoke database RPC via supabaseServer (service role) to run atomically
    const { data: rpcResult, error: rpcErr } = await supabaseServer.rpc(
      'create_manual_assignment_with_invite',
      {
        p_hostel_id: hostel_id,
        p_room_id: room_id,
        p_student_name: student_name.trim(),
        p_student_email: normalizedEmail,
        p_student_phone: student_phone.trim(),
        p_parent_name: parent_name.trim(),
        p_parent_phone: parent_phone.trim(),
        p_parent_email: parent_email.trim(),
        p_address: address.trim(),
        p_emergency_name: emergency_name.trim(),
        p_emergency_phone: emergency_phone.trim(),
        p_start_date: start_date,
        p_token_hash: tokenHash,
        p_expires_at: expiresAt.toISOString(),
        p_owner_id: user.id,
        p_booking_type: booking_type
      }
    );

    if (rpcErr) {
      console.error('RPC Error:', rpcErr);
      return NextResponse.json({ error: rpcErr.message }, { status: 400 });
    }

    // 7. Construct public invitation URL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const invitationUrl = `${siteUrl}/invite/${rawToken}`;

    // 8. Fetch hostel and room details for the email
    const { data: hostelData } = await supabaseServer
      .from('hostels')
      .select('name')
      .eq('id', hostel_id)
      .single();

    const { data: roomData } = await supabaseServer
      .from('rooms')
      .select('room_number')
      .eq('id', room_id)
      .single();

    const hostelName = hostelData?.name || 'Your Hostel';
    const roomName = roomData?.room_number ? `Room ${roomData.room_number}` : 'Your Room';

    // 9. Send invitation email via Brevo (non-blocking - don't fail if email fails)
    let emailSent = false;
    let emailError = null;

    try {
      const emailResult = await sendStudentInvitationEmail({
        email: normalizedEmail,
        studentName: student_name.trim(),
        hostelName,
        roomName,
        invitationUrl,
        bookingType: booking_type as 'shared_bed' | 'entire_room'
      });

      emailSent = emailResult.success;
      if (!emailResult.success) {
        emailError = emailResult.error;
        console.error('Brevo email sending failed:', emailError);
      }
    } catch (error) {
      console.error('Exception during Brevo email sending:', error);
      emailError = error instanceof Error ? error.message : 'Unknown error';
    }

    // 10. Return success response with email status
    return NextResponse.json({
      success: true,
      allocation_id: rpcResult.allocation_id,
      invitation_url: invitationUrl,
      expires_at: expiresAt.toISOString(),
      email_sent: emailSent,
      email_error: emailError,
      booking_type: rpcResult.booking_type
    });

  } catch (error: any) {
    console.error('Manual student assignment endpoint error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
