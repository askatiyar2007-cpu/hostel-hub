import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      );
    }

    if (!otp || !otp.trim()) {
      return NextResponse.json(
        { error: 'Verification code is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Call RPC to verify OTP using service role
    const { data, error } = await supabaseServer.rpc('verify_otp', {
      p_email: normalizedEmail,
      p_otp: otp.trim(),
      p_purpose: 'password_reset'
    });

    if (error) {
      console.error('OTP verification error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to verify code' },
        { status: 400 }
      );
    }

    if (!data?.success) {
      return NextResponse.json(
        { error: data?.error || 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    const resetToken = data?.reset_token;
    if (!resetToken) {
      return NextResponse.json(
        { error: 'Verification succeeded but no reset token was returned' },
        { status: 500 }
      );
    }

    // Set secure HttpOnly cookie containing the reset token
    const cookieStore = cookies();
    cookieStore.set({
      name: 'reset_token',
      value: resetToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 // 15 minutes
    });

    return NextResponse.json({
      success: true,
      message: 'Verification successful'
    });

  } catch (error: any) {
    console.error('OTP verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify code' },
      { status: 500 }
    );
  }
}
