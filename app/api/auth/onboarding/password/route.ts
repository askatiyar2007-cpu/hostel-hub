import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const sessionClient = createClient();
  const { data: { user }, error: userError } = await sessionClient.auth.getUser();

  if (userError || !user?.email) {
    return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid password setup request.' }, { status: 400 });
  }

  const password = typeof body === 'object' && body !== null && 'password' in body
    ? body.password
    : undefined;

  if (typeof password !== 'string' || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
  }

  // Confirm the canonical missing step before changing the auth credential. The
  // state-recording RPC re-checks the same predicate while it commits the next
  // permitted public-record transition.
  const { data: accountState, error: stateError } = await supabaseServer
    .rpc('get_account_state', { p_email: user.email });
  const state = Array.isArray(accountState) ? accountState[0] : accountState;

  if (stateError || !state || state.user_id !== user.id || state.missing_step !== 'password') {
    return NextResponse.json({ error: 'That setup step is no longer available.' }, { status: 409 });
  }

  // Use session-based password update instead of admin API to preserve the
  // browser session atomically. The admin API (updateUserById) invalidates all
  // existing sessions as a security feature, causing the next API call to fail
  // with 401. The session-based updateUser() updates the password AND refreshes
  // the session in a single atomic operation, maintaining browser authentication.
  const { error: passwordError } = await sessionClient.auth.updateUser({ password });

  if (passwordError) {
    console.error('Onboarding password update failed:', passwordError);
    return NextResponse.json({ error: 'Unable to save your password. Please try again.' }, { status: 500 });
  }

  const { data, error } = await supabaseServer.rpc('complete_onboarding_password_state', {
    p_user_id: user.id,
  });

  if (error) {
    console.error('Onboarding password-state transition failed:', error);
    return NextResponse.json({ error: 'Unable to complete password setup. Please try again.' }, { status: 500 });
  }

  if (!data?.success) {
    return NextResponse.json({ error: 'That setup step is no longer available.' }, { status: 409 });
  }

  return NextResponse.json({ success: true, next: data.next });
}
