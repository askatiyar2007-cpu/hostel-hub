import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { sendPasswordResetOtpEmail } from '@/lib/email/brevo';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Call RPC to request OTP (handles email enumeration internally) using service role to grant permissions
    const { data, error } = await supabaseServer.rpc('request_otp', {
      p_email: normalizedEmail,
      p_purpose: 'password_reset',
      p_user_id: null
    });

    if (error) {
      console.error('OTP request error:', error);
      // Return generic success anyway to prevent enumeration
      return NextResponse.json({
        success: true,
        message: 'If an account is associated with this email, we have sent a verification code.'
      });
    }

    // If OTP was generated (user exists), send email
    if (data?.otp) {
      const emailResult = await sendPasswordResetOtpEmail({
        email: normalizedEmail,
        otp: data.otp
      });

      if (!emailResult.success) {
        console.error('Failed to send password reset email:', emailResult.error);
        // Still return generic success to prevent enumeration
      }
    }

    // Always return generic response (prevents email enumeration)
    return NextResponse.json({
      success: true,
      message: 'If an account is associated with this email, we have sent a verification code.'
    });

  } catch (error: any) {
    console.error('Forgot password error:', error);
    // Return generic success even on error to prevent enumeration
    return NextResponse.json({
      success: true,
      message: 'If an account is associated with this email, we have sent a verification code.'
    });
  }
}
