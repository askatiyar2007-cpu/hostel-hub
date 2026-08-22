import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const selectableRoles = new Set(['student', 'owner']);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const sessionClient = createClient();
  const { data: { user }, error: userError } = await sessionClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid role selection.' }, { status: 400 });
  }

  const role = typeof body === 'object' && body !== null && 'role' in body
    ? body.role
    : undefined;

  if (typeof role !== 'string' || !selectableRoles.has(role)) {
    return NextResponse.json({ error: 'Invalid role selection.' }, { status: 400 });
  }

  const databaseRole = role === 'owner' ? 'hostel_owner' : role;
  const { data, error } = await supabaseServer.rpc('complete_onboarding_role', {
    p_user_id: user.id,
    p_role: databaseRole,
  });

  if (error) {
    console.error('Onboarding role transition failed:', error);
    return NextResponse.json({ error: 'Unable to save your role. Please try again.' }, { status: 500 });
  }

  if (!data?.success) {
    return NextResponse.json({ error: 'That setup step is no longer available.' }, { status: 409 });
  }

  return NextResponse.json({ success: true, next: data.next });
}
