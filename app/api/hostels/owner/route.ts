import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/hostels/owner
 * Returns hostels owned by the authenticated user
 */
export async function GET(_req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: hostels, error } = await supabase
      .from('hostels')
      .select('id, name')
      .eq('owner_id', user.id)
      .order('name');

    if (error) {
      console.error('[Hostels Owner API] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch hostels' },
        { status: 500 }
      );
    }

    return NextResponse.json({ hostels }, { status: 200 });
  } catch (error: any) {
    console.error('[Hostels Owner API] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
