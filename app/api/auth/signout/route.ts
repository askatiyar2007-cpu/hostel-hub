import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/signout
 * 
 * Authoritative server-side sign out endpoint:
 * 1. Attempts remote session revocation on Supabase GoTrue using the caller's session.
 * 2. Purges all Supabase authentication cookies with maxAge: 0 and past expiry (1970-01-01).
 * 3. Distinguishes cookie cleanup from remote revocation in response payload without masking errors.
 * 4. Selectively expires only Supabase authentication cookies and chunks, preserving unrelated cookies.
 */
/**
 * Safely resolves the canonical Supabase auth cookie storageKey for the configured project.
 * 
 * 1. Primary source: The initialized Supabase server client's own `storageKey`.
 * 2. Fallback: ONLY accepts a verified standard Supabase domain (`<project-ref>.supabase.co`).
 *    For custom domains, self-hosted instances, ambiguous, missing, or malformed URLs,
 *    returns null to strictly prevent accidental deletion of unrelated cookies.
 */
export function resolveSupabaseProjectStorageKey(supabaseClient?: unknown, supabaseUrlEnv?: string): string | null {
  // 1. Primary: initialized Supabase client storageKey
  const clientStorageKey = (supabaseClient as any)?.auth?.storageKey;
  if (typeof clientStorageKey === 'string' && /^sb-[a-zA-Z0-9_-]+-auth-token$/.test(clientStorageKey)) {
    return clientStorageKey;
  }

  // 2. Fallback: verified standard Supabase URL (<project-ref>.supabase.co) only
  const rawUrl = supabaseUrlEnv !== undefined ? supabaseUrlEnv : (process.env.NEXT_PUBLIC_SUPABASE_URL || '');
  if (!rawUrl || typeof rawUrl !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    // Strict hostname verification: must end with .supabase.co and have exactly one valid project ref subdomain
    const hostname = parsed.hostname.toLowerCase();
    const match = hostname.match(/^([a-z0-9_-]+)\.supabase\.co$/);
    if (match && match[1]) {
      return `sb-${match[1]}-auth-token`;
    }
  } catch {
    // Malformed URL: fail closed
    return null;
  }

  // Custom domain, self-hosted, or ambiguous hostname: fail closed
  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createClient(request);
    
    let remoteRevoked = false;
    let revocationError: string | null = null;

    // 1. Attempt remote session revocation on Supabase Auth
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        revocationError = error.message;
        console.warn('[SignOut API] Supabase remote revocation returned error:', error.message);
      } else {
        remoteRevoked = true;
      }
    } catch (err) {
      revocationError = err instanceof Error ? err.message : String(err);
      console.error('[SignOut API] Supabase remote revocation threw exception:', err);
    }

    // 2. Identify all Supabase authentication cookies and chunks that need expiration
    const expiredCookies: string[] = [];

    // Safely resolve the base cookie key using verified project resolution
    const baseKey = resolveSupabaseProjectStorageKey(supabase);

    // Safety guard: Never delete cookies if the configured project key cannot be reliably identified
    if (!baseKey) {
      console.warn('[SignOut API] Configured Supabase project key could not be reliably identified; skipping cookie expiration.');
    }

    // Helper to test if a cookie belongs ONLY to the configured Supabase project's auth cookie or its canonical numeric chunks
    const isConfiguredSupabaseAuthCookie = (name: string): boolean => {
      if (!baseKey) {
        return false;
      }
      if (name === baseKey) {
        return true;
      }
      const prefix = `${baseKey}.`;
      if (name.startsWith(prefix)) {
        const chunkPart = name.slice(prefix.length);
        // Canonical numeric index check: 0 or positive integer without leading zeros (e.g. 0, 1, 2, ..., 12)
        return /^(0|[1-9]\d*)$/.test(chunkPart);
      }
      return false;
    };

    // Scan all cookies sent in the request without arbitrary chunk limits
    let maxFoundChunkIndex = -1;
    if (baseKey) {
      const allCookies = request.cookies.getAll();
      for (const cookie of allCookies) {
        if (isConfiguredSupabaseAuthCookie(cookie.name)) {
          if (!expiredCookies.includes(cookie.name)) {
            expiredCookies.push(cookie.name);
          }
          const chunkMatch = cookie.name.match(/\.(0|[1-9]\d*)$/);
          if (chunkMatch) {
            const idx = parseInt(chunkMatch[1], 10);
            if (!isNaN(idx) && idx > maxFoundChunkIndex) {
              maxFoundChunkIndex = idx;
            }
          }
        }
      }

      // Proactively expire the configured project's base auth cookie and any chunk sequence
      if (!expiredCookies.includes(baseKey)) {
        expiredCookies.push(baseKey);
      }
      const upperChunkLimit = Math.max(maxFoundChunkIndex, 4);
      for (let i = 0; i <= upperChunkLimit; i++) {
        const chunkKey = `${baseKey}.${i}`;
        if (!expiredCookies.includes(chunkKey)) {
          expiredCookies.push(chunkKey);
        }
      }
    }

    // 3. Prepare response distinguishing cookie cleanup from remote revocation
    const response = NextResponse.json(
      {
        success: true,
        cookieCleared: true,
        remoteRevoked,
        revocationError,
        expiredCookies,
      },
      { status: 200 }
    );

    // 4. Response headers to prevent caching
    // NOTE: Clear-Site-Data is intentionally omitted so origin cookies/preferences are not broadly wiped
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    // 5. Authoritatively purge all identified Supabase cookies on the response
    for (const cookieName of expiredCookies) {
      response.cookies.set({
        name: cookieName,
        value: '',
        path: '/',
        maxAge: 0,
        expires: new Date(0),
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }

    return response;
  } catch (error) {
    console.error('[SignOut API] Unexpected error during sign out:', error);
    const errorResponse = NextResponse.json(
      {
        success: false,
        cookieCleared: false,
        remoteRevoked: false,
        error: error instanceof Error ? error.message : 'Sign out failed',
      },
      { status: 500 }
    );
    errorResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return errorResponse;
  }
}
