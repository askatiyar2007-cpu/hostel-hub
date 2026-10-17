import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/signout
 * 
 * Authoritative server-side sign out endpoint.
 * 1. Invalidates the Supabase session on the server.
 * 2. Purges all Supabase authentication cookies with maxAge: 0 and past expiry.
 * 3. Instructs the client browser to purge cached responses and storage.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createClient(request);
    
    // Invalidate session in Supabase Auth
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[SignOut API] Warning: Error invalidating server session:', err);
    }

    const response = NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200 }
    );

    // Prevent caching of the logout response
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    // Instruct browsers to clear client storage and cookies for origin
    response.headers.set('Clear-Site-Data', '"cache", "cookies", "storage"');

    // Authoritatively purge all Supabase and auth-related cookies on the server response
    const allCookies = request.cookies.getAll();
    for (const cookie of allCookies) {
      if (
        cookie.name.startsWith('sb-') ||
        cookie.name.includes('auth') ||
        cookie.name.includes('token') ||
        cookie.name.includes('session')
      ) {
        response.cookies.set({
          name: cookie.name,
          value: '',
          path: '/',
          maxAge: 0,
          expires: new Date(0),
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
      }
    }

    return response;
  } catch (error) {
    console.error('[SignOut API] Unexpected error during sign out:', error);
    const errorResponse = NextResponse.json(
      { success: false, error: 'Sign out failed' },
      { status: 500 }
    );
    errorResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return errorResponse;
  }
}
