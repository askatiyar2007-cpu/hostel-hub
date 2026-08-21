import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient as createSsrServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

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
export function createClient() {
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
