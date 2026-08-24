import { NextResponse } from 'next/server';
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
export async function GET() {
  const sessionClient = createClient();
  const { data: { user }, error: userError } = await sessionClient.auth.getUser();

  if (userError || !user?.email) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  // Call get_account_state via service-role client (the function requires
  // service_role grant and is not directly accessible to anon/authenticated roles)
  const { data, error } = await supabaseServer.rpc('get_account_state', {
    p_email: user.email,
  });

  if (error) {
    console.error('Account state lookup failed:', error);
    return NextResponse.json(
      { error: 'Unable to determine account state.' },
      { status: 500 }
    );
  }

  const state = Array.isArray(data) ? data[0] : data;

  // Verify the returned state belongs to the authenticated user (security check)
  if (!state || state.user_id !== user.id) {
    console.error('Account state mismatch:', { state, userId: user.id });
    return NextResponse.json(
      { error: 'Account state mismatch.' },
      { status: 500 }
    );
  }

  // Return only the fields needed by the client
  return NextResponse.json({
    missing_step: state.missing_step,
    is_complete: state.is_complete,
    role: state.role,
    password_set: state.password_set,
  });
}
