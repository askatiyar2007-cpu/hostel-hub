import { NextRequest, NextResponse } from 'next/server';
import {
  createOAuthIntentTransaction,
  isOAuthIntent,
  OAUTH_CALLBACK_TRANSACTION_COOKIE,
  OAUTH_INTENT_TTL_SECONDS,
} from '@/lib/auth/oauth-intent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Creates the only client-supplied OAuth intent state accepted by the callback.
 * Account data is deliberately excluded from the signed transaction.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid OAuth intent.' }, { status: 400 });
  }

  const intent = typeof body === 'object' && body !== null && 'intent' in body
    ? body.intent
    : undefined;

  if (!isOAuthIntent(intent)) {
    return NextResponse.json({ error: 'Invalid OAuth intent.' }, { status: 400 });
  }

  try {
    const transaction = createOAuthIntentTransaction(intent);
    const callbackUrl = new URL('/auth/callback', request.nextUrl.origin);
    callbackUrl.searchParams.set('transaction', transaction);

    const response = NextResponse.json({ redirectTo: callbackUrl.toString() });
    response.cookies.set({
      name: OAUTH_CALLBACK_TRANSACTION_COOKIE,
      value: transaction,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth/callback',
      maxAge: OAUTH_INTENT_TTL_SECONDS,
    });

    return response;
  } catch (error) {
    console.error('Unable to create OAuth intent transaction:', error);
    return NextResponse.json({ error: 'Unable to start OAuth. Please try again.' }, { status: 500 });
  }
}
