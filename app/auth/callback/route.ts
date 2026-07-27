import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET Handler for Supabase OAuth Callback.
 * Exchanges authorization code and routes users based on password/role completion status.
 */
export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const error_description = requestUrl.searchParams.get('error_description');

  const timestamp = new Date().toISOString();
  console.log('='.repeat(60));
  console.log(`[${timestamp}] CALLBACK ROUTE HIT!`);
  console.log('Full URL:', request.url);
  console.log('Code present:', !!code);
  console.log('='.repeat(60));

  // Handle OAuth errors
  if (error) {
    console.error(`[${timestamp}] [OAuth Callback] Google OAuth failure: ${error} - ${error_description}`);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error_description || error)}`, request.url));
  }

  try {
    const supabase = createClient();
    let sessionUser = null;

    // If we have a code, exchange it for a session (Authorization Code Flow)
    if (code) {
      console.log(`[${timestamp}] [OAuth Callback] Found code, exchanging for session...`);
      const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error(`[${timestamp}] [OAuth Callback] Code exchange failed: ${exchangeError.message}`);
        return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, request.url));
      }

      sessionUser = exchangeData.user;
      console.log(`[${timestamp}] [OAuth Callback] Code exchange successful. Session established.`);
    } else {
      // No code found - Supabase may have used Implicit Flow and set session via token
      console.log(`[${timestamp}] [OAuth Callback] No code parameter. Checking if session exists...`);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        sessionUser = session.user;
        console.log(`[${timestamp}] [OAuth Callback] Session found! User authenticated.`);
      } else {
        console.warn(`[${timestamp}] [OAuth Callback] No session found and no code to exchange.`);
      }
    }

    if (sessionUser) {
      // 1. Get the current authenticated user metadata
      const { data: { user: freshUser } } = await supabase.auth.getUser();
      const currentUser = freshUser || sessionUser;

      const password_set = currentUser?.user_metadata?.password_set === true;
      let hasRole = !!(currentUser?.user_metadata?.role) || currentUser?.user_metadata?.role_selected === true;

      // 2. Fallback check: check in database profiles table if role is configured
      if (!hasRole) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (profile) {
          if (profile.role && profile.role !== 'student') {
            hasRole = true;
          } else if (profile.role === 'student') {
            // Check if student table has a matching record (proves enrollment setup has completed)
            const { data: student } = await supabase
              .from('students')
              .select('id')
              .eq('profile_id', profile.id)
              .maybeSingle();
            
            if (student) {
              hasRole = true;
            }
          }
        }
      }

      console.log('[Callback] user_metadata.password_set:', currentUser?.user_metadata?.password_set);
      console.log('[Callback] computed password_set:', password_set);
      console.log('[Callback] user_metadata.role:', currentUser?.user_metadata?.role);
      console.log('[Callback] computed hasRole:', hasRole);

      // 3. Redirect based on state
      if (!password_set) {
        console.log('[Callback] DECISION: Redirecting to setup-password');
        return NextResponse.redirect(new URL('/auth/setup-password', request.url));
      }
      
      if (!hasRole) {
        console.log('[Callback] DECISION: Redirecting to select-role');
        return NextResponse.redirect(new URL('/auth/select-role', request.url));
      }
      
      console.log('[Callback] DECISION: Redirecting to dashboard');
      return NextResponse.redirect(new URL('/student/dashboard', request.url));
    }

    // Default fallback to login
    return NextResponse.redirect(new URL('/login', request.url));
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown server error during OAuth callback';
    console.error(`[${timestamp}] [OAuth Callback] Critical exception in route handler:`, err);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errMsg)}`, request.url));
  }
};
