import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // 1. Hash the raw token to compare with the database
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // 2. Fetch the invitation details using service role
    const { data: invitation, error } = await supabaseServer
      .from('student_invitations')
      .select('*, students(*)')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (error || !invitation) {
      return NextResponse.json({ valid: false, status: 'invalid' });
    }

    // 3. Check if used
    if (invitation.used_at) {
      return NextResponse.json({ 
        valid: false, 
        status: 'used', 
        email: invitation.email,
        student_name: invitation.students?.student_name || 'Invited Student'
      });
    }

    // 4. Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ 
        valid: false, 
        status: 'expired', 
        email: invitation.email,
        student_name: invitation.students?.student_name || 'Invited Student'
      });
    }

    // 5. Fetch room and hostel details from active allocation
    const { data: allocation } = await supabaseServer
      .from('room_allocations')
      .select('*, rooms(*), hostels(*)')
      .eq('student_id', invitation.student_id)
      .eq('active', true)
      .maybeSingle();

    return NextResponse.json({
      valid: true,
      status: 'valid',
      email: invitation.email,
      student_name: invitation.students?.student_name || allocation?.student_name || 'Invited Student',
      hostel_name: allocation?.hostels?.name || 'N/A',
      room_number: allocation?.rooms?.room_number || 'N/A'
    });

  } catch (error: any) {
    console.error('Validate token error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
