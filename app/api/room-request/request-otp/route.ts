import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendRoomRequestOtpEmail } from '@/lib/email/brevo';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { hostelId, roomId, bookingType, details } = await req.json();

    // Create Supabase client with cookies for authentication
    const cookieStore = cookies();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false
        }
      }
    );

    // Get session from cookies
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = session.user;

    // Get student profile
    const { data: student, error: studentError } = await supabase
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
    const { data, error } = await supabase.rpc('request_otp', {
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
