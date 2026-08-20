import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendRoomRequestOtpEmail } from '@/lib/email/brevo';

export async function POST(req: NextRequest) {
  try {
    console.log('[ROOM OTP] Request received');
    
    const { hostelId, roomId, bookingType, details } = await req.json();
    console.log('[ROOM OTP] Request body validated:', { hostelId, roomId, bookingType });

    // Create Supabase client with cookies for authentication
    const supabase = createClient();
    console.log('[ROOM OTP] Supabase client created');

    // Get session from cookies
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('[ROOM OTP] Session check completed:', { hasSession: !!session, sessionError: sessionError?.message });

    if (sessionError || !session) {
      console.error('[ROOM OTP] Authentication failed:', sessionError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = session.user;
    console.log('[ROOM OTP] Auth user found:', { userId: user.id, email: user.email });

    // Get student profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('user_id', user.id)
      .maybeSingle();

    console.log('[ROOM OTP] Profile lookup completed:', { hasProfile: !!profile, profileError: profileError?.message });

    if (profileError || !profile) {
      console.error('[ROOM OTP] Profile not found for user:', user.id, profileError);
      return NextResponse.json(
        { error: 'Student profile not found' },
        { status: 404 }
      );
    }

    // Get student record
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('profile_id', profile.id)
      .maybeSingle();

    console.log('[ROOM OTP] Student lookup completed:', { hasStudent: !!student, studentError: studentError?.message });

    if (studentError || !student) {
      console.error('[ROOM OTP] Student record not found for profile:', profile.id, studentError);
      return NextResponse.json(
        { error: 'Student record not found' },
        { status: 404 }
      );
    }

    const studentEmail = profile.email;
    const studentName = profile.full_name;

    if (!studentEmail) {
      console.error('[ROOM OTP] Student email missing from profile');
      return NextResponse.json(
        { error: 'Student email not found' },
        { status: 400 }
      );
    }

    console.log('[ROOM OTP] Student data validated:', { email: studentEmail, name: studentName });

    // Call RPC to request OTP
    console.log('[ROOM OTP] Calling request_otp RPC');
    const { data, error } = await supabase.rpc('request_otp', {
      p_email: studentEmail,
      p_purpose: 'room_request_verification',
      p_user_id: user.id
    });
    console.log('[ROOM OTP] RPC completed:', { hasData: !!data, error: error?.message, success: data?.success });

    if (error) {
      console.error('[ROOM OTP] OTP request error:', error);
      return NextResponse.json(
        { error: 'Failed to request verification code' },
        { status: 500 }
      );
    }

    if (!data?.success) {
      console.error('[ROOM OTP] RPC returned failure:', data.error);
      return NextResponse.json(
        { error: data.error || 'Failed to request verification code' },
        { status: 400 }
      );
    }

    // Send OTP email
    if (data?.otp) {
      console.log('[ROOM OTP] Sending Brevo email');
      const emailResult = await sendRoomRequestOtpEmail({
        email: studentEmail,
        studentName: studentName || 'Student',
        otp: data.otp
      });
      console.log('[ROOM OTP] Brevo response:', { success: emailResult.success, error: emailResult.error });

      if (!emailResult.success) {
        console.error('[ROOM OTP] Failed to send room request OTP email:', emailResult.error);
        return NextResponse.json(
          { error: 'Failed to send verification email' },
          { status: 500 }
        );
      }
    }

    console.log('[ROOM OTP] Request completed successfully');
    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your registered email',
      studentEmail: studentEmail // Return for UI display (can be masked)
    });

  } catch (error: any) {
    console.error('[ROOM OTP] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to request verification code' },
      { status: 500 }
    );
  }
}
