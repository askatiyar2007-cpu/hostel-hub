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

    // Verify profile existence and identity binding
    const { data: profile, error: profileFetchError } = await supabaseServer
      .from('profiles')
      .select('id, user_id, email, role, password_set')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileFetchError) {
      console.error('[reset-password] Database error fetching profile for user %s:', userId, profileFetchError);
      cookieStore.delete('reset_token');
      return NextResponse.json(
        { error: 'Password updated in auth system, but failed to verify profile status. Please try logging in or contact support.' },
        { status: 500 }
      );
    }

    if (!profile) {
      console.error('[reset-password] No profile found for verified user %s', userId);
      cookieStore.delete('reset_token');
      return NextResponse.json(
        { error: 'Account profile not found. Please contact support.' },
        { status: 422 }
      );
    }

    // Synchronize profiles.password_set if not already established
    if (profile.password_set !== true) {
      const { data: updatedRows, error: profileUpdateError } = await supabaseServer
        .from('profiles')
        .update({ password_set: true })
        .eq('user_id', userId)
        .select('id, password_set');

      if (profileUpdateError) {
        console.error('[reset-password] Failed to synchronize password_set for user %s:', userId, profileUpdateError);
        cookieStore.delete('reset_token');
        return NextResponse.json(
          { error: 'Password updated, but profile state synchronization failed. Please try logging in.' },
          { status: 500 }
        );
      }

      if (!updatedRows || updatedRows.length === 0) {
        console.error('[reset-password] Profile update affected 0 rows for user %s', userId);
        cookieStore.delete('reset_token');
        return NextResponse.json(
          { error: 'Password updated, but profile record was not modified. Please try logging in.' },
          { status: 500 }
        );
      }
    }

    // Invalidate/delete the reset_token cookie upon complete success
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
