import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { sendRoomRequestOtpEmail } from '@/lib/email/brevo';

export async function POST(req: NextRequest) {
  try {
    const { hostelId, roomId, bookingType, details } = await req.json();

    // Get authenticated user from session
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    // Get student profile
    const { data: student, error: studentError } = await supabaseServer
      .from('students')
      .select('id, profiles(full_name, email)')
      .eq('profile_id', user.id)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Student profile not found' },
        { status: 404 }
      );
    }

    const studentEmail = (student.profiles as any)?.email;
    const studentName = (student.profiles as any)?.full_name;

    if (!studentEmail) {
      return NextResponse.json(
        { error: 'Student email not found' },
        { status: 400 }
      );
    }

    // Call RPC to request OTP
    const { data, error } = await supabaseServer.rpc('request_otp', {
      p_email: studentEmail,
      p_purpose: 'room_request_verification',
      p_user_id: user.id
    });

    if (error) {
      console.error('OTP request error:', error);
      return NextResponse.json(
        { error: 'Failed to request verification code' },
        { status: 500 }
      );
    }

    if (!data?.success) {
      return NextResponse.json(
        { error: data.error || 'Failed to request verification code' },
        { status: 400 }
      );
    }

    // Send OTP email
    if (data?.otp) {
      const emailResult = await sendRoomRequestOtpEmail({
        email: studentEmail,
        studentName: studentName || 'Student',
        otp: data.otp
      });

      if (!emailResult.success) {
        console.error('Failed to send room request OTP email:', emailResult.error);
        return NextResponse.json(
          { error: 'Failed to send verification email' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your registered email',
      studentEmail: studentEmail // Return for UI display (can be masked)
    });

  } catch (error: any) {
    console.error('Room request OTP error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to request verification code' },
      { status: 500 }
    );
  }
}
