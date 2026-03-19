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
