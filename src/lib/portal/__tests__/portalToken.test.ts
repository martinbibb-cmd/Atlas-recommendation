/**
 * portalToken.test.ts
 *
 * Tests for portal token generation and validation.
 *
 * Coverage:
 *   - generatePortalToken produces a non-empty signed token
 *   - validatePortalToken returns 'valid' for a freshly generated token
 *   - validatePortalToken returns 'invalid' for a tampered token
 *   - validatePortalToken returns 'invalid' for a token scoped to a different reference
 *   - validatePortalToken returns 'expired' for a token past its TTL
 *   - validatePortalToken returns 'invalid' for a missing/empty token
 *   - validatePortalToken returns 'invalid' for a token with no dot separator
 *   - Different references produce different tokens
 *   - Token embeds the correct reference and expiry
 */

import { describe, it, expect } from 'vitest';
import {
  generatePortalToken,
  validatePortalToken,
  PORTAL_TOKEN_TTL_MS,
} from '../portalToken';

const NOW_ISO = '2024-06-01T12:00:00.000Z';
const NOW_MS = new Date(NOW_ISO).getTime();
const REFERENCE = 'abc-123';

// ─── generatePortalToken ──────────────────────────────────────────────────────

describe('generatePortalToken', () => {
  it('returns a non-empty string', async () => {
    const token = await generatePortalToken(REFERENCE, NOW_ISO);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('contains a single dot separator', async () => {
    const token = await generatePortalToken(REFERENCE, NOW_ISO);
    const dots = (token.match(/\./g) ?? []).length;
    expect(dots).toBe(1);
  });

  it('produces different tokens for different references', async () => {
    const t1 = await generatePortalToken('ref-A', NOW_ISO);
    const t2 = await generatePortalToken('ref-B', NOW_ISO);
    expect(t1).not.toBe(t2);
  });

  it('embeds the correct reference and expiry in the payload', async () => {
    const token = await generatePortalToken(REFERENCE, NOW_ISO);
    const payloadPart = token.split('.')[0];
    // base64url → base64 → JSON
    const b64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '=');
    const payload = JSON.parse(atob(padded)) as { ref: string; exp: number };

    expect(payload.ref).toBe(REFERENCE);
    expect(payload.exp).toBe(NOW_MS + PORTAL_TOKEN_TTL_MS);
  });
});

// ─── validatePortalToken ──────────────────────────────────────────────────────

describe('validatePortalToken', () => {
  it('returns "valid" for a freshly generated token', async () => {
    const token = await generatePortalToken(REFERENCE, NOW_ISO);
    const result = await validatePortalToken(REFERENCE, token, NOW_MS);
    expect(result).toBe('valid');
  });

  it('returns "expired" for a token past its TTL', async () => {
    const token = await generatePortalToken(REFERENCE, NOW_ISO);
    const afterExpiry = NOW_MS + PORTAL_TOKEN_TTL_MS + 1;
    const result = await validatePortalToken(REFERENCE, token, afterExpiry);
    expect(result).toBe('expired');
  });

  it('returns "invalid" for an empty token string', async () => {
    const result = await validatePortalToken(REFERENCE, '', NOW_MS);
    expect(result).toBe('invalid');
  });

  it('returns "invalid" for a token with no dot separator', async () => {
    const result = await validatePortalToken(REFERENCE, 'nodothere', NOW_MS);
    expect(result).toBe('invalid');
  });

  it('returns "invalid" for a tampered payload', async () => {
    const token = await generatePortalToken(REFERENCE, NOW_ISO);
    // Corrupt the payload part
    const parts = token.split('.');
    const tampered = `AAAA${parts[0]}.${parts[1]}`;
    const result = await validatePortalToken(REFERENCE, tampered, NOW_MS);
    expect(result).toBe('invalid');
  });

  it('returns "invalid" for a tampered signature', async () => {
    const token = await generatePortalToken(REFERENCE, NOW_ISO);
    const parts = token.split('.');
    const tampered = `${parts[0]}.AAAA${parts[1]}`;
    const result = await validatePortalToken(REFERENCE, tampered, NOW_MS);
    expect(result).toBe('invalid');
  });

  it('returns "invalid" for a token scoped to a different reference', async () => {
    const token = await generatePortalToken('other-ref', NOW_ISO);
    const result = await validatePortalToken(REFERENCE, token, NOW_MS);
    expect(result).toBe('invalid');
  });

  it('returns "invalid" for a completely malformed token', async () => {
    const result = await validatePortalToken(REFERENCE, 'not.valid.base64!!!', NOW_MS);
    expect(result).toBe('invalid');
  });

  it('uses current time when nowMs is not provided', async () => {
    // Token generated now should be valid with the real clock
    const token = await generatePortalToken(REFERENCE);
    const result = await validatePortalToken(REFERENCE, token);
    expect(result).toBe('valid');
  });
});
