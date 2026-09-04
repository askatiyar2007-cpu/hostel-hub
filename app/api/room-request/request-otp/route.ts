import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import { sendRoomRequestOtpEmail } from '@/lib/email/brevo';

export async function POST(req: NextRequest) {
  try {
    console.log('[ROOM OTP] Request received');
    
    const { hostelId, roomId, bookingType, details, photoPath } = await req.json();
    console.log('[ROOM OTP] Request body validated:', { hostelId, roomId, bookingType, hasPhoto: !!photoPath });

    // Use SSR client for authentication check only
    const authClient = createClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    console.log('[ROOM OTP] Auth check completed:', { hasUser: !!user, authError: authError?.message });

    if (authError || !user) {
      console.error('[ROOM OTP] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('[ROOM OTP] Auth user found:', { userId: user.id, email: user.email });

    // Use service role client for database operations and RPC calls
    const supabase = supabaseServer;
    console.log('[ROOM OTP] Service role client created');

    // Get student profile using service role client
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

    // Get student record using service role client
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

    // Use the email entered in the room-request form for OTP
    const otpEmail = details?.parent_email?.trim();
    const studentName = profile.full_name;

    if (!otpEmail) {
      console.error('[ROOM OTP] Parent email missing from room-request details');
      return NextResponse.json(
        { error: 'Parent email is required for OTP verification' },
        { status: 400 }
      );
    }

    // Validate photo path is provided
    if (!photoPath) {
      console.error('[ROOM OTP] Photo path missing from request');
      return NextResponse.json(
        { error: 'Passport-size photo is required' },
        { status: 400 }
      );
    }

    console.log('[ROOM OTP] OTP email validated:', { email: otpEmail, name: studentName, photoPath });

    // Call RPC to request OTP using service role client
    console.log('[ROOM OTP] Calling request_otp RPC');
    const { data, error } = await supabase.rpc('request_otp', {
      p_email: otpEmail,
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
        email: otpEmail,
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
      message: 'Verification code sent to your parent email',
      otpEmail: otpEmail // Return for UI display (can be masked)
    });

  } catch (error: any) {
    console.error('[ROOM OTP] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to request verification code' },
      { status: 500 }
    );
  }
}
