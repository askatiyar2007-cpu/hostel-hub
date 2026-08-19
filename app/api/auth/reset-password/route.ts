import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { newPassword } = await req.json();

    if (!newPassword || !newPassword.trim()) {
      return NextResponse.json(
        { error: 'New password is required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Read reset_token from HttpOnly cookie
    const cookieStore = cookies();
    const resetToken = cookieStore.get('reset_token')?.value;

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Reset session expired or invalid. Please verify your email again.' },
        { status: 400 }
      );
    }

    // Call RPC to authorize password reset using service role
    const { data, error } = await supabaseServer.rpc('reset_password_with_token', {
      p_reset_token: resetToken
    });

    if (error) {
      console.error('Password reset authorization error:', error);
      return NextResponse.json(
        { error: error.message || 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    if (!data?.success) {
      return NextResponse.json(
        { error: data?.error || 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    const userId = data?.user_id;
    if (!userId) {
      return NextResponse.json(
        { error: 'Authorization succeeded but no user ID was returned' },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabaseServer.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Password update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

    // Invalidate/delete the reset_token cookie upon success
    cookieStore.delete('reset_token');

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error: any) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reset password' },
      { status: 500 }
    );
  }
}
