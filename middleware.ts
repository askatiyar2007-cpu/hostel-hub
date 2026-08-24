import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type AccountState = {
  user_id: string | null;
  role: string | null;
  missing_step: string;
  is_complete: boolean;
  password_set: boolean;
};

function readAccountState(value: unknown): AccountState | null {
  const state = Array.isArray(value) ? value[0] : value;
  if (!state || typeof state !== 'object') return null;

  const record = state as Record<string, unknown>;
  if ((typeof record.user_id !== 'string' && record.user_id !== null)
    || (typeof record.role !== 'string' && record.role !== null)
    || typeof record.missing_step !== 'string'
    || typeof record.is_complete !== 'boolean'
    || typeof record.password_set !== 'boolean') {
    return null;
  }

  return {
    user_id: record.user_id,
    role: record.role,
    missing_step: record.missing_step,
    is_complete: record.is_complete,
    password_set: record.password_set,
  };
}

export async function middleware(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next();
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            if (options) {
              req.cookies.set({
                name,
                value,
                ...options,
              })
            }
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // No authentication required for static routes, auth pages, or public pages
  const publicPaths = [
    '/',
    '/login',
    '/signup',
    '/auth/login',
    '/auth/signup',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/callback',
    '/marketplace',
    '/hostel',
    '/invite',
  ]

  const isPublicPath = publicPaths.some(path => 
    req.nextUrl.pathname.startsWith(path)
  )

  if (isPublicPath) {
    return NextResponse.next()
  }

  // Protected routes require authentication
  const isProtectedRoute = (
    req.nextUrl.pathname.startsWith('/owner') ||
    req.nextUrl.pathname.startsWith('/student') ||
    req.nextUrl.pathname.startsWith('/parent') ||
    req.nextUrl.pathname.startsWith('/admin')
  )

  // Onboarding continuation pages (only for active signup, not abandoned signups)
  const isOnboardingPage = (
    req.nextUrl.pathname.startsWith('/auth/select-role') ||
    req.nextUrl.pathname.startsWith('/auth/setup-password')
  )

  if (!user && isProtectedRoute) {
    const url = req.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // CRITICAL BUSINESS RULE ENFORCEMENT:
  // password_set=false means NOT a HostelHub user, regardless of whether
  // a profile or role data exists. The middleware must check password_set
  // status and block access to protected routes and onboarding pages for
  // incomplete signups. This prevents abandoned Google OAuth signups from
  // accessing the dashboard or being restored to the password setup page.
  //
  // For users with password_set=false attempting to access:
  // - Protected routes (/owner/*, /student/*, etc.) → redirect to /auth/login
  // - Onboarding pages (/auth/setup-password, /auth/select-role) → redirect to /auth/login
  //
  // Rationale: Onboarding pages are for active signup flows, not abandoned
  // signups. A fresh visit with password_set=false should start at login.
  if (user && (isProtectedRoute || isOnboardingPage)) {
    try {
      // Use service role client to call get_account_state
      // This client has elevated permissions and can call the RPC function
      const supabaseServer = createSupabaseClient(
        supabaseUrl,
        supabaseServiceKey || supabaseKey
      );

      const { data, error } = await supabaseServer.rpc('get_account_state', {
        p_email: user.email,
      });

      if (!error && data) {
        const accountState = readAccountState(data);
        
        if (accountState && accountState.password_set === false) {
          // User has a session but password_set=false → incomplete signup
          // Redirect to login page (treat as non-user)
          console.log('[Middleware] Blocking access for incomplete account (password_set=false):', user.email);
          const url = req.nextUrl.clone();
          url.pathname = '/auth/login';
          return NextResponse.redirect(url);
        }
      } else if (error) {
        // If account-state lookup fails, fall back to permissive behavior
        // to prevent lockout. This is a fail-open approach for system errors.
        console.error('[Middleware] Account state lookup failed, allowing access:', error);
      }
    } catch (err) {
      // Same fail-open approach for unexpected errors
      console.error('[Middleware] Unexpected error checking account state:', err);
    }
  }

  return NextResponse.next({
    request: {
      headers: req.headers,
    },
  })
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes handle their own auth with cookies)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}