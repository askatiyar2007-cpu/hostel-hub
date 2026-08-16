import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // 1. Hash the raw token to locate the invitation
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // 2. Fetch the invitation details using service role
    const { data: invitation, error: inviteErr } = await supabaseServer
      .from('student_invitations')
      .select('*, students(*)')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (inviteErr || !invitation) {
      return NextResponse.json(
        { error: 'Invitation is invalid or no longer available' },
        { status: 400 }
      );
    }

    if (invitation.used_at) {
      return NextResponse.json(
        { error: 'This invitation has already been used' },
        { status: 400 }
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This invitation has expired. Please contact your hostel owner.' },
        { status: 400 }
      );
    }

    const studentEmail = invitation.email.trim().toLowerCase();

    // 3. Check if the user already exists in profiles
    const { data: existingProfile } = await supabaseServer
      .from('profiles')
      .select('id, user_id')
      .eq('email', studentEmail)
      .maybeSingle();

    if (existingProfile) {
      // Mark invitation as used (they are already registered)
      await supabaseServer
        .from('student_invitations')
        .update({ used_at: new Date().toISOString() })
        .eq('id', invitation.id);

      return NextResponse.json({
        success: true,
        alreadyRegistered: true,
        email: studentEmail,
        message: 'Your account is already registered! Please log in directly.'
      });
    }

    // 4. Create Supabase Auth account using the Admin API (triggers handles_new_user DB function)
    const { data: authData, error: authErr } = await supabaseServer.auth.admin.createUser({
      email: studentEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: invitation.students?.student_name || 'Invited Student',
        role: 'student',
        password_set: true,
        role_selected: true
      }
    });

    if (authErr) {
      console.error('Auth signup error:', authErr);
      return NextResponse.json(
        { error: 'Auth user creation failed: ' + authErr.message },
        { status: 400 }
      );
    }

    const authUser = authData.user;
    if (!authUser) {
      return NextResponse.json(
        { error: 'Auth user record could not be created' },
        { status: 500 }
      );
    }

    // 5. Complete DB updates atomically via complete_invitation_signup RPC
    const { error: dbErr } = await supabaseServer.rpc('complete_invitation_signup', {
      p_student_id: invitation.student_id,
      p_profile_user_id: authUser.id,
      p_phone_number: invitation.students?.student_phone || '',
      p_invitation_id: invitation.id
    });

    if (dbErr) {
      console.error('DB completion error:', dbErr);
      // Rollback Auth user creation if DB transactions failed to prevent ghost accounts
      await supabaseServer.auth.admin.deleteUser(authUser.id);

      return NextResponse.json(
        { error: 'Database update failed: ' + dbErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      email: studentEmail,
      message: 'Account created successfully!'
    });

  } catch (error: any) {
    console.error('Invitation signup error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
