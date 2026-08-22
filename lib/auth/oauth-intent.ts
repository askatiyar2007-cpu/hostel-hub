import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export type OAuthIntent = 'login' | 'signup';

export const OAUTH_CALLBACK_TRANSACTION_COOKIE = 'oauth_callback_transaction';
export const OAUTH_INTENT_TTL_SECONDS = 5 * 60;
const OAUTH_INTENT_SIGNING_SECRET = 'OAUTH_INTENT_SIGNING_SECRET';

interface OAuthIntentTransactionPayload {
  version: 1;
  intent: OAuthIntent;
  expiresAt: number;
  nonce: string;
}

function getSigningSecret(): string {
  const secret = process.env[OAUTH_INTENT_SIGNING_SECRET];

  if (!secret || secret.length < 32) {
    throw new Error(`${OAUTH_INTENT_SIGNING_SECRET} must be set to a value of at least 32 characters.`);
  }

  return secret;
}

function isTransactionPayload(value: unknown): value is OAuthIntentTransactionPayload {
  if (!value || typeof value !== 'object') return false;

  const payload = value as Record<string, unknown>;
  return payload.version === 1
    && isOAuthIntent(payload.intent)
    && typeof payload.expiresAt === 'number'
    && Number.isInteger(payload.expiresAt)
    && typeof payload.nonce === 'string'
    && /^[A-Za-z0-9_-]{43}$/.test(payload.nonce);
}

/**
 * Creates an integrity-protected callback transaction with no account data.
 * The random nonce gives each OAuth attempt a distinct transaction, while the
 * short expiry prevents a previously issued redirect URL from remaining valid.
 */
export function createOAuthIntentTransaction(intent: OAuthIntent, now = Date.now()): string {
  const payload: OAuthIntentTransactionPayload = {
    version: 1,
    intent,
    expiresAt: Math.floor(now / 1000) + OAUTH_INTENT_TTL_SECONDS,
    nonce: randomBytes(32).toString('base64url'),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

/**
 * Validates a signed, unexpired transaction and returns only its intent.
 * The callback consumes the matching HttpOnly transaction cookie after this
 * verification, making a transaction single-use in the originating browser.
 */
export function verifyOAuthIntentTransaction(
  transaction: string | null,
  now = Date.now(),
): OAuthIntent | null {
  if (!transaction) return null;

  const [encodedPayload, suppliedSignature, extra] = transaction.split('.');
  if (!encodedPayload || !suppliedSignature || extra !== undefined) return null;

  const expectedSignature = createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('base64url');
  const suppliedBuffer = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (suppliedBuffer.length !== expectedBuffer.length
    || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!isTransactionPayload(payload) || payload.expiresAt <= Math.floor(now / 1000)) {
      return null;
    }

    return payload.intent;
  } catch {
    return null;
  }
}

export function isOAuthIntent(value: unknown): value is OAuthIntent {
  return value === 'login' || value === 'signup';
}
