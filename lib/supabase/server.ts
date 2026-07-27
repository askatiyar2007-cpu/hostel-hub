import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient as createSsrServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pcwlceklvjuddghogfbf.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key';

export const supabaseServer = createSupabaseClient(
  supabaseUrl,
  supabaseServiceKey
);

export function createServerClient() {
  return createSupabaseClient(
    supabaseUrl,
    supabaseServiceKey
  );
}

export function createClient() {
  const cookieStore = cookies();
  return createSsrServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options?: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Ignored when executing inside read-only server components
          }
        },
        remove(name: string, options?: Record<string, unknown>) {
          try {
            cookieStore.delete({ name, ...options });
          } catch {
            // Ignored when executing inside read-only server components
          }
        },
      },
    }
  );
}
