import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET Handler for Supabase OAuth Callback.
 * Exchanges authorization code and routes users based on signup/login intent and completion status.
 */
export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const timestamp = new Date().toISOString();
  console.log('[OAUTH CALLBACK] =================================');
  console.log(`[${timestamp}] [OAUTH CALLBACK] ROUTE HIT`);
  console.log(`[${timestamp}] [OAUTH CALLBACK] Full URL:`, request.url);

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const error_description = requestUrl.searchParams.get('error_description');
  const isSignup = requestUrl.searchParams.get('isSignup') === 'true';

  console.log(`[${timestamp}] [OAUTH CALLBACK] Code exists:`, !!code);
  console.log(`[${timestamp}] [OAUTH CALLBACK] isSignup:`, isSignup);

  // Handle OAuth errors
  if (error) {
    console.error(`[${timestamp}] [OAUTH CALLBACK] Google OAuth failure: ${error} - ${error_description}`);
    return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(error_description || error)}`, request.url));
  }

  try {
    const supabase = createClient();
    let sessionUser = null;

    // If we have a code, exchange it for a session (Authorization Code Flow)
    if (code) {
      console.log(`[${timestamp}] [OAUTH CALLBACK] Exchanging code for session`);
      const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error(`[${timestamp}] [OAUTH CALLBACK] Code exchange failed: ${exchangeError.message}`);
        return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(exchangeError.message)}`, request.url));
      }

      sessionUser = exchangeData.user;
      console.log(`[${timestamp}] [OAUTH CALLBACK] Code exchange successful`);
      console.log(`[${timestamp}] [OAUTH CALLBACK] User ID:`, sessionUser.id);
      console.log(`[${timestamp}] [OAUTH CALLBACK] User email:`, sessionUser.email);
    } else {
      // No code found - Supabase may have used Implicit Flow and set session via token
      console.log(`[${timestamp}] [OAUTH CALLBACK] No code parameter. Checking if session exists...`);
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        sessionUser = session.user;
        console.log(`[${timestamp}] [OAUTH CALLBACK] Session found! User authenticated.`);
      } else {
        console.warn(`[${timestamp}] [OAUTH CALLBACK] No session found and no code to exchange.`);
      }
    }

    if (sessionUser) {
      // 1. Get the current authenticated user metadata
      const { data: { user: freshUser } } = await supabase.auth.getUser();
      const currentUser = freshUser || sessionUser;

      // 2. Check if user already has a profile (existing account detection)
      console.log(`[${timestamp}] [OAUTH CALLBACK] Checking profile`);
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, user_id, role, email')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      console.log(`[${timestamp}] [OAUTH CALLBACK] Profile exists:`, !!existingProfile);

      // 3. Handle signup vs login logic
      if (isSignup) {
        console.log(`[${timestamp}] [OAUTH CALLBACK] Signup intent: true`);
        // SIGNUP FLOW
        if (existingProfile) {
          console.log(`[${timestamp}] [OAUTH CALLBACK] EXISTING GOOGLE USER SIGNUP -> REJECT`);
          return NextResponse.redirect(new URL('/auth/login?tab=signup', request.url));
        }

        // New Google user - continue to role selection
        console.log(`[${timestamp}] [OAUTH CALLBACK] NEW GOOGLE USER -> /auth/select-role`);
        return NextResponse.redirect(new URL('/auth/select-role', request.url));
      } else {
        console.log(`[${timestamp}] [OAUTH CALLBACK] Signup intent: false (LOGIN)`);
        // LOGIN FLOW
        if (!existingProfile) {
          console.log(`[${timestamp}] [OAUTH CALLBACK] No profile found. Redirecting to role selection.`);
          return NextResponse.redirect(new URL('/auth/select-role', request.url));
        }

        // Existing user - check completion status
        console.log(`[${timestamp}] [OAUTH CALLBACK] Role: ${existingProfile.role}`);
        const password_set = currentUser?.user_metadata?.password_set === true;
        let hasRole = !!(existingProfile.role) || currentUser?.user_metadata?.role_selected === true;

        // Additional check for students
        if (existingProfile.role === 'student') {
          const { data: student } = await supabase
            .from('students')
            .select('id')
            .eq('profile_id', existingProfile.id)
            .maybeSingle();

          if (student) {
            hasRole = true;
          }
        }

        console.log(`[${timestamp}] [OAUTH CALLBACK] password_set:`, password_set);
        console.log(`[${timestamp}] [OAUTH CALLBACK] hasRole:`, hasRole);

        // Redirect based on completion status
        if (!password_set) {
          console.log(`[${timestamp}] [OAUTH CALLBACK] Redirecting to /auth/setup-password`);
          return NextResponse.redirect(new URL('/auth/setup-password', request.url));
        }

        if (!hasRole) {
          console.log(`[${timestamp}] [OAUTH CALLBACK] Redirecting to /auth/select-role`);
          return NextResponse.redirect(new URL('/auth/select-role', request.url));
        }

        // User is complete - redirect to appropriate dashboard
        const redirectMap: Record<string, string> = {
          'owner': '/owner/dashboard',
          'student': '/student/dashboard',
          'parent': '/parent/dashboard',
          'super_admin': '/admin/dashboard',
        };

        const target = redirectMap[existingProfile.role as string];
        if (!target) {
          console.error(`[${timestamp}] [OAUTH CALLBACK] Invalid role: ${existingProfile.role}. Redirecting to role selection.`);
          return NextResponse.redirect(new URL('/auth/select-role', request.url));
        }

        console.log(`[${timestamp}] [OAUTH CALLBACK] EXISTING GOOGLE USER LOGIN -> ${target}`);
        return NextResponse.redirect(new URL(target, request.url));
      }
    }

    // Default fallback to login
    return NextResponse.redirect(new URL('/auth/login', request.url));
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown server error during OAuth callback';
    console.error(`[${timestamp}] [OAuth Callback] Critical exception in route handler:`, err);
    return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(errMsg)}`, request.url));
  }
};
