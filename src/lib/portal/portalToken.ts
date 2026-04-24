/**
 * portalToken.ts
 *
 * HMAC-SHA256 signed portal token generation and validation.
 *
 * Token format: `<base64url-payload>.<base64url-signature>`
 *   - payload  = base64url( JSON.stringify({ ref: string, exp: number }) )
 *   - signature = HMAC-SHA256( signingKey, payloadPart )
 *
 * The signing key is derived from a compile-time application constant.
 * This provides meaningful protection against reference enumeration attacks;
 * it is not a substitute for server-managed secrets in a full production system.
 *
 * Token validity: 30 days from generation.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default token TTL: 30 days in milliseconds. */
export const PORTAL_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Application-level HMAC key material (compile-time constant).
 *
 * Security note: this value is bundled with the client-side JavaScript and
 * is therefore not a secret in the cryptographic sense. Its purpose is to
 * prevent casual reference enumeration by making portal URLs unguessable
 * without access to both the reference and a valid token.
 *
 * In a server-rendered or Cloudflare Workers deployment, replace this with
 * an environment variable (e.g. `PORTAL_TOKEN_SECRET`) to achieve true
 * server-side signing where the key material is never exposed to the client.
 */
const KEY_MATERIAL = 'atlas-portal-token-v1';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TokenPayload {
  /** Report/visit reference the token is scoped to. */
  ref: string;
  /** Unix millisecond expiry. */
  exp: number;
}

/** Result of validating a portal token. */
export type TokenValidationResult = 'valid' | 'invalid' | 'expired';

// ─── Crypto helpers ───────────────────────────────────────────────────────────

async function importHmacKey(): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(KEY_MATERIAL);
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function base64urlEncode(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array<ArrayBuffer> {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a signed portal token scoped to the given reference.
 *
 * @param reference - The report/visit reference to scope the token to.
 * @param nowIso    - Optional ISO timestamp override (useful for testing).
 * @returns A signed token string of the form `<payload>.<signature>`.
 */
export async function generatePortalToken(
  reference: string,
  nowIso?: string,
): Promise<string> {
  const now = nowIso ? new Date(nowIso).getTime() : Date.now();
  const payload: TokenPayload = {
    ref: reference,
    exp: now + PORTAL_TOKEN_TTL_MS,
  };

  const encoder = new TextEncoder();
  const payloadPart = base64urlEncode(encoder.encode(JSON.stringify(payload)));

  const key = await importHmacKey();
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payloadPart),
  );
  const signaturePart = base64urlEncode(new Uint8Array(signatureBuffer));

  return `${payloadPart}.${signaturePart}`;
}

/**
 * Validate a portal token for the given reference.
 *
 * @param reference - The expected reference. Token is rejected if it was scoped
 *                   to a different reference.
 * @param token     - The token string to validate.
 * @param nowMs     - Optional current time override in ms (useful for testing).
 * @returns `'valid'` | `'invalid'` | `'expired'`
 */
export async function validatePortalToken(
  reference: string,
  token: string,
  nowMs?: number,
): Promise<TokenValidationResult> {
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1 || dotIndex === 0 || dotIndex === token.length - 1) {
    return 'invalid';
  }

  const payloadPart = token.slice(0, dotIndex);
  const signaturePart = token.slice(dotIndex + 1);

  // Verify HMAC signature
  let signatureBytes: Uint8Array<ArrayBuffer>;
  try {
    signatureBytes = base64urlDecode(signaturePart);
  } catch {
    return 'invalid';
  }

  const key = await importHmacKey();
  let isValid: boolean;
  try {
    isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      new TextEncoder().encode(payloadPart) as Uint8Array<ArrayBuffer>,
    );
  } catch {
    return 'invalid';
  }

  if (!isValid) return 'invalid';

  // Decode and validate payload
  let payload: TokenPayload;
  try {
    const payloadBytes = base64urlDecode(payloadPart);
    payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as TokenPayload;
  } catch {
    return 'invalid';
  }

  if (typeof payload.ref !== 'string' || typeof payload.exp !== 'number') {
    return 'invalid';
  }

  // Scope check — token must be scoped to this reference
  if (payload.ref !== reference) return 'invalid';

  // Expiry check
  const now = nowMs ?? Date.now();
  if (payload.exp < now) return 'expired';

  return 'valid';
}
