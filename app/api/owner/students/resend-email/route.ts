import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import crypto from 'crypto';
import { sendStudentInvitationEmail } from '@/lib/email/brevo';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate caller (supports cookie and Bearer token)
    const supabase = createClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Validate request body
    const body = await req.json();
    const {
      invitation_url,
      student_name,
      hostel_name,
      room_number,
      booking_type,
      email
    } = body;

    if (!email || !invitation_url) {
      return NextResponse.json({ error: 'Email and invitation URL are required' }, { status: 400 });
    }

    // 3. Extract rawToken from invitation URL and compute SHA-256 hash
    const rawToken = invitation_url.split('/invite/')[1]?.split('?')[0]?.split('#')[0]?.trim();
    if (!rawToken) {
      return NextResponse.json({ error: 'Invalid invitation URL format' }, { status: 400 });
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 4. Verify invitation exists in the database
    const { data: invitation, error: invError } = await supabaseServer
      .from('student_invitations')
      .select('id, student_id, email, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (invError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // 5. Look up student's room allocation to verify hostel ownership
    const { data: allocation, error: allocError } = await supabaseServer
      .from('room_allocations')
      .select(`
        id,
        booking_type,
        student_name,
        rooms (
          room_number
        ),
        hostels (
          id,
          name,
          owner_id
        )
      `)
      .eq('student_id', invitation.student_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (allocError || !allocation) {
      return NextResponse.json({ error: 'Room allocation not found for this invitation' }, { status: 404 });
    }

    const hostel = allocation.hostels as any;
    if (!hostel || hostel.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this hostel' }, { status: 403 });
    }

    // 6. Dispatch invitation email with server-verified context
    const room = allocation.rooms as any;
    const finalEmail = (invitation.email || email).trim().toLowerCase();
    const finalStudentName = allocation.student_name || student_name;
    const finalHostelName = hostel?.name || hostel_name || 'Your Hostel';
    const finalRoomName = room?.room_number ? `Room ${room.room_number}` : (room_number || 'Your Room');
    const finalBookingType = (allocation.booking_type || booking_type || 'shared_bed') as 'shared_bed' | 'entire_room';

    const result = await sendStudentInvitationEmail({
      email: finalEmail,
      studentName: finalStudentName,
      hostelName: finalHostelName,
      roomName: finalRoomName,
      invitationUrl: invitation_url,
      bookingType: finalBookingType
    });

    if (result.success) {
      return NextResponse.json({ success: true, messageId: result.messageId });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Resend email error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to resend email' },
      { status: 500 }
    );
  }
}
