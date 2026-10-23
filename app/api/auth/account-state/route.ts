import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Returns the canonical account completion state for the authenticated user.
 * This is the single source of truth for account completion, wrapping the
 * get_account_state() SQL function which defines the authoritative completion
 * rules. The client-side AuthProvider calls this endpoint instead of
 * reimplementing the completion logic, ensuring the database and client never
 * diverge on what "complete" means.
 */
export async function GET(req: NextRequest) {
  const sessionClient = createClient(req);
  const { data: { user }, error: userError } = await sessionClient.auth.getUser();

  if (userError || !user?.email) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  // Helper to resolve account state from user profile when service-role is unavailable
  const getProfileFallbackState = async () => {
    let { data: profile } = await sessionClient
      .from('profiles')
      .select('role, full_name, password_set')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile && user.email) {
      const { data: byEmail } = await sessionClient
        .from('profiles')
        .select('role, full_name, password_set')
        .eq('email', user.email)
        .maybeSingle();
      profile = byEmail;
    }

    const missing_step = !profile?.role
      ? 'role'
      : !profile?.full_name
      ? 'password'
      : 'complete';

    return {
      missing_step,
      is_complete: missing_step === 'complete',
      role: profile?.role || null,
      password_set: profile?.password_set !== false,
    };
  };

  // Check if service role key is properly configured
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey || serviceRoleKey.trim() === '') {
    const fallback = await getProfileFallbackState();
    return NextResponse.json(fallback);
  }

  // Call get_account_state via service-role client (the function requires
  // service_role grant and is not directly accessible to anon/authenticated roles)
  const { data, error } = await supabaseServer.rpc('get_account_state', {
    p_email: user.email,
  });

  if (error) {
    console.warn('Account state RPC lookup failed, using profile fallback:', error.message);
    const fallback = await getProfileFallbackState();
    return NextResponse.json(fallback);
  }

  const state = Array.isArray(data) ? data[0] : data;

  // Verify the returned state belongs to the authenticated user (security check)
  if (!state || state.user_id !== user.id) {
    const fallback = await getProfileFallbackState();
    return NextResponse.json(fallback);
  }

  // Return only the fields needed by the client
  return NextResponse.json({
    missing_step: state.missing_step,
    is_complete: state.is_complete,
    role: state.role,
    password_set: state.password_set,
  });
}
