/**
 * portalUrl.test.ts
 *
 * Tests for portal URL generation and parsing utilities.
 */

import { describe, it, expect } from 'vitest';
import { buildPortalUrl, parsePortalPath } from '../portalUrl';

// ─── buildPortalUrl ───────────────────────────────────────────────────────────

describe('buildPortalUrl', () => {
  it('builds a portal URL from a reference and origin', () => {
    const url = buildPortalUrl('abc-123', 'https://example.com');
    expect(url).toBe('https://example.com/portal/abc-123');
  });

  it('encodes special characters in the reference', () => {
    const url = buildPortalUrl('ref with spaces', 'https://example.com');
    expect(url).toBe('https://example.com/portal/ref%20with%20spaces');
  });

  it('uses empty string origin when window is unavailable', () => {
    const url = buildPortalUrl('ref-1', '');
    expect(url).toBe('/portal/ref-1');
  });

  it('appends token as ?token= query param when provided', () => {
    const url = buildPortalUrl('abc-123', 'https://example.com', 'tok.sig');
    expect(url).toBe('https://example.com/portal/abc-123?token=tok.sig');
  });

  it('encodes special characters in the token', () => {
    const url = buildPortalUrl('abc-123', 'https://example.com', 'a+b/c=');
    expect(url).toContain('?token=');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('token')).toBe('a+b/c=');
  });

  it('produces URL without token query param when token is omitted', () => {
    const url = buildPortalUrl('abc-123', 'https://example.com');
    expect(url).not.toContain('?token');
  });

  it('keeps optional display labels and address summaries out of the URL', () => {
    const url = buildPortalUrl('visit-ref', 'https://example.com', 'signed-token');
    expect(url).toBe('https://example.com/portal/visit-ref?token=signed-token');
    expect(url).not.toContain('Smith');
    expect(url).not.toContain('Example Road');
  });
});

// ─── parsePortalPath ──────────────────────────────────────────────────────────

describe('parsePortalPath', () => {
  it('extracts a reference from a valid portal path', () => {
    expect(parsePortalPath('/portal/abc-123')).toBe('abc-123');
  });

  it('decodes URL-encoded references', () => {
    expect(parsePortalPath('/portal/ref%20with%20spaces')).toBe('ref with spaces');
  });

  it('returns null for non-portal paths', () => {
    expect(parsePortalPath('/report/abc')).toBeNull();
    expect(parsePortalPath('/')).toBeNull();
    expect(parsePortalPath('/portal/')).toBeNull();
    expect(parsePortalPath('/portal')).toBeNull();
  });

  it('returns null for paths with extra segments', () => {
    expect(parsePortalPath('/portal/abc/extra')).toBeNull();
  });
});
