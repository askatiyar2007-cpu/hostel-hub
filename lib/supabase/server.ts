import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient as createSsrServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Service role client for server-only operations (no cookies, elevated permissions)
export const supabaseServer = createSupabaseClient(
  supabaseUrl,
  supabaseServiceKey || supabaseKey
);

// Deprecated: use supabaseServer directly for service role operations
export function createServerClient() {
  return createSupabaseClient(
    supabaseUrl,
    supabaseServiceKey || supabaseKey || ''
  );
}

// SSR client with cookies for authentication (anon key only)
// If NextRequest is passed with Authorization: Bearer <token>, uses token auth
export function createClient(req?: NextRequest) {
  if (req) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token) {
        // Create a standard Supabase client with the Bearer token
        // auth.getUser() will validate this token against Supabase Auth
        return createSupabaseClient(supabaseUrl, supabaseKey, {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        });
      }
    }
  }

  const cookieStore = cookies();
  return createSsrServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

/**
 * Creates a Supabase client from a NextRequest.
 * 
 * Mobile clients: If an Authorization: Bearer <token> header is present,
 * creates a @supabase/supabase-js client authenticated with that access token.
 * 
 * Web clients: Falls back to the cookie-based SSR client (createClient()).
 * 
 * Usage in API routes:
 *   const supabase = createClientFromRequest(req);
 *   // or: const supabase = createClient(req);
 *   const { data: { user } } = await supabase.auth.getUser();
 */
export function createClientFromRequest(req: NextRequest) {
  return createClient(req);
}

