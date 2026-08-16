import { NextRequest, NextResponse } from 'next/server';
import { sendStudentInvitationEmail } from '@/lib/email/brevo';

export async function POST(req: NextRequest) {
  try {
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

    const result = await sendStudentInvitationEmail({
      email: email.trim().toLowerCase(),
      studentName: student_name,
      hostelName: hostel_name || 'Your Hostel',
      roomName: room_number || 'Your Room',
      invitationUrl: invitation_url,
      bookingType: booking_type || 'shared_bed'
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
