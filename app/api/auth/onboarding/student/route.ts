import { NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  const sessionClient = createClient();
  const { data: { user }, error: userError } = await sessionClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const { data, error } = await supabaseServer.rpc('complete_onboarding_student', {
    p_user_id: user.id,
  });

  if (error) {
    console.error('Student onboarding transition failed:', error);
    return NextResponse.json({ error: 'Unable to complete student setup. Please try again.' }, { status: 500 });
  }

  if (!data?.success) {
    return NextResponse.json({ error: 'That setup step is no longer available.' }, { status: 409 });
  }

  return NextResponse.json({ success: true, next: data.next });
}
