import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { dashboardPathForRole } from '@/lib/auth/dashboard'

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
    || (typeof record.password_set !== 'boolean' && record.password_set !== undefined)) {
    return null;
  }

  return {
    user_id: record.user_id,
    role: record.role,
    missing_step: record.missing_step,
    is_complete: record.is_complete,
    password_set: typeof record.password_set === 'boolean' ? record.password_set : false,
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

  const pathname = req.nextUrl.pathname

  // Exact public paths that must only match strictly
  const publicExactPaths = [
    '/',
    '/login',
    '/signup',
  ]

  // Prefix public paths for multi-segment public sub-routes
  const publicPrefixPaths = [
    '/auth/login',
    '/auth/signup',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/callback',
    '/marketplace',
    '/hostels',
    '/hostel',
    '/find-hostel',
    '/invite',
  ]

  const isPublicPath = 
    publicExactPaths.includes(pathname) ||
    publicPrefixPaths.some(path => pathname === path || pathname.startsWith(path + '/'))

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

  function redirectWithNoStore(destination: string): NextResponse {
    const url = req.nextUrl.clone();
    url.pathname = destination;
    const res = NextResponse.redirect(url);
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.headers.set('Pragma', 'no-cache');
    res.headers.set('Expires', '0');
    return res;
  }

  if (!user && (isProtectedRoute || isOnboardingPage)) {
    return redirectWithNoStore('/auth/login');
  }

  // CRITICAL BUSINESS RULE ENFORCEMENT:
  // 1. password_set=false or incomplete account means NOT a completed HostelHub user.
  //    Incomplete accounts must NEVER be granted access to protected dashboards (/owner, /student, /parent, /admin).
  // 2. However, onboarding pages (/auth/select-role, /auth/setup-password) exist specifically for incomplete accounts
  //    to finish registration. They must NOT be blocked from onboarding pages.
  // 3. Completed accounts visiting onboarding pages are redirected to their dashboard.
  if (user && (isProtectedRoute || isOnboardingPage)) {
    try {
      const supabaseServer = createSupabaseClient(
        supabaseUrl,
        supabaseServiceKey || supabaseKey
      );

      const { data, error } = await supabaseServer.rpc('get_account_state', {
        p_email: user.email,
      });

      if (error || !data) {
        console.error('[Middleware] Account state lookup failed for:', user.email, error);
        if (isProtectedRoute) {
          return redirectWithNoStore('/auth/login');
        }
      } else {
        const accountState = readAccountState(data);
        
        // Fail closed if state is malformed or does not match authenticated user
        if (isProtectedRoute && (!accountState || accountState.user_id !== user.id)) {
          console.log('[Middleware] Failing closed: account state identity mismatch or invalid for:', user.email);
          return redirectWithNoStore('/auth/login');
        }

        // Block dashboard access for incomplete accounts
        if (isProtectedRoute && (!accountState?.is_complete || accountState?.password_set === false)) {
          console.log('[Middleware] Blocking dashboard access for incomplete account:', user.email);
          return redirectWithNoStore('/auth/login');
        }

        // Strict role authorization: prevent cross-role dashboard access
        if (isProtectedRoute && accountState && accountState.is_complete) {
          const role = accountState.role;
          const isOwnerRoute = pathname.startsWith('/owner');
          const isStudentRoute = pathname.startsWith('/student');
          const isAdminRoute = pathname.startsWith('/admin');
          const isParentRoute = pathname.startsWith('/parent');

          const isAuthorized =
            (isOwnerRoute && (role === 'owner' || role === 'hostel_owner')) ||
            (isStudentRoute && role === 'student') ||
            (isAdminRoute && (role === 'admin' || role === 'super_admin')) ||
            (isParentRoute && role === 'parent');

          if (!isAuthorized) {
            console.log(`[Middleware] Role mismatch: ${role} denied access to ${pathname}`);
            const destination = (role && dashboardPathForRole(role)) || '/auth/login';
            return redirectWithNoStore(destination);
          }
        }

        // If completed account visits onboarding pages, redirect to their role dashboard
        if (isOnboardingPage && accountState?.is_complete && accountState?.password_set) {
          const destination = (accountState.role && dashboardPathForRole(accountState.role)) || '/auth/login';
          return redirectWithNoStore(destination);
        }
      }
    } catch (err) {
      console.error('[Middleware] Unexpected error checking account state:', err);
      if (isProtectedRoute) {
        return redirectWithNoStore('/auth/login');
      }
    }
  }

  const response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  if (isProtectedRoute) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  return response;
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