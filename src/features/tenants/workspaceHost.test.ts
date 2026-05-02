/**
 * src/features/tenants/workspaceHost.test.ts
 *
 * Tests for the workspace host resolver.
 *
 * Coverage:
 *   normaliseHost
 *     - strips port
 *     - lowercases
 *
 *   extractWorkspaceSlugFromHost
 *     - returns slug for valid subdomain
 *     - returns null for host-reserved slugs (next, staging, …)
 *     - returns null for workspace-reserved slugs (admin, www, …)
 *     - returns null for root domain
 *     - returns null for www alias
 *     - returns null for non-atlas-phm.uk hosts
 *     - returns null for multi-level subdomains
 *
 *   resolveWorkspaceFromHost
 *     - demo-heating.atlas-phm.uk → demo-heating tenant, installer-demo brand
 *     - britishgas.atlas-phm.uk (unknown) → atlas fallback
 *     - atlas-phm.uk → atlas fallback
 *     - www.atlas-phm.uk → atlas fallback
 *     - next.atlas-phm.uk → atlas fallback (host-reserved)
 *     - localhost → atlas fallback
 *     - localhost:5173 → atlas fallback
 *     - 127.0.0.1 → atlas fallback
 *     - *.pages.dev → atlas fallback
 *     - *.vercel.app → atlas fallback
 *     - *.netlify.app → atlas fallback
 *     - reserved workspace slug (admin.atlas-phm.uk) → atlas fallback
 *     - resolved workspace has correct source='host'
 *     - fallback has source='fallback'
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  normaliseHost,
  extractWorkspaceSlugFromHost,
  resolveWorkspaceFromHost,
} from './workspaceHost';

// ─── normaliseHost ────────────────────────────────────────────────────────────

describe('normaliseHost', () => {
  it('strips a port suffix', () => {
    expect(normaliseHost('localhost:5173')).toBe('localhost');
  });

  it('strips a port from an atlas domain', () => {
    expect(normaliseHost('demo-heating.atlas-phm.uk:3000')).toBe('demo-heating.atlas-phm.uk');
  });

  it('lowercases the host', () => {
    expect(normaliseHost('DEMO-HEATING.ATLAS-PHM.UK')).toBe('demo-heating.atlas-phm.uk');
  });

  it('trims surrounding whitespace', () => {
    expect(normaliseHost('  atlas-phm.uk  ')).toBe('atlas-phm.uk');
  });

  it('returns the host unchanged when no port or casing changes are needed', () => {
    expect(normaliseHost('atlas-phm.uk')).toBe('atlas-phm.uk');
  });
});

// ─── extractWorkspaceSlugFromHost ─────────────────────────────────────────────

describe('extractWorkspaceSlugFromHost', () => {
  it('returns the slug for a valid subdomain', () => {
    expect(extractWorkspaceSlugFromHost('demo-heating.atlas-phm.uk')).toBe('demo-heating');
  });

  it('returns the slug for a single-word subdomain', () => {
    expect(extractWorkspaceSlugFromHost('britishgas.atlas-phm.uk')).toBe('britishgas');
  });

  it('is case-insensitive (normalises before matching)', () => {
    expect(extractWorkspaceSlugFromHost('Demo-Heating.atlas-phm.uk')).toBe('demo-heating');
  });

  it('returns null for the root domain', () => {
    expect(extractWorkspaceSlugFromHost('atlas-phm.uk')).toBeNull();
  });

  it('returns null for the www alias', () => {
    expect(extractWorkspaceSlugFromHost('www.atlas-phm.uk')).toBeNull();
  });

  it('returns null for the host-reserved slug "next"', () => {
    expect(extractWorkspaceSlugFromHost('next.atlas-phm.uk')).toBeNull();
  });

  it('returns null for the host-reserved slug "staging"', () => {
    expect(extractWorkspaceSlugFromHost('staging.atlas-phm.uk')).toBeNull();
  });

  it('returns null for the host-reserved slug "dev"', () => {
    expect(extractWorkspaceSlugFromHost('dev.atlas-phm.uk')).toBeNull();
  });

  it('returns null for the host-reserved slug "preview"', () => {
    expect(extractWorkspaceSlugFromHost('preview.atlas-phm.uk')).toBeNull();
  });

  it('returns null for the workspace-reserved slug "admin"', () => {
    expect(extractWorkspaceSlugFromHost('admin.atlas-phm.uk')).toBeNull();
  });

  it('returns null for the workspace-reserved slug "www"', () => {
    // 'www' is both workspace-reserved and handled as a direct fallback above,
    // but extractWorkspaceSlugFromHost should also reject it.
    expect(extractWorkspaceSlugFromHost('www.atlas-phm.uk')).toBeNull();
  });

  it('returns null for multi-level subdomains', () => {
    expect(extractWorkspaceSlugFromHost('a.b.atlas-phm.uk')).toBeNull();
  });

  it('returns null for non-atlas-phm.uk hosts', () => {
    expect(extractWorkspaceSlugFromHost('demo-heating.example.com')).toBeNull();
  });

  it('returns null for localhost', () => {
    expect(extractWorkspaceSlugFromHost('localhost')).toBeNull();
  });
});

// ─── resolveWorkspaceFromHost ─────────────────────────────────────────────────

describe('resolveWorkspaceFromHost — known workspace', () => {
  it('resolves demo-heating.atlas-phm.uk to the demo-heating tenant', () => {
    const result = resolveWorkspaceFromHost('demo-heating.atlas-phm.uk');
    expect(result.workspaceSlug).toBe('demo-heating');
    expect(result.tenantId).toBe('demo-heating');
    expect(result.brandId).toBe('installer-demo');
    expect(result.source).toBe('host');
  });

  it('sets the normalised host on the result', () => {
    const result = resolveWorkspaceFromHost('Demo-Heating.atlas-phm.uk:443');
    expect(result.host).toBe('demo-heating.atlas-phm.uk');
  });
});

describe('resolveWorkspaceFromHost — atlas fallback cases', () => {
  it('falls back to atlas for the root domain atlas-phm.uk', () => {
    const result = resolveWorkspaceFromHost('atlas-phm.uk');
    expect(result.brandId).toBe('atlas-default');
    expect(result.source).toBe('fallback');
    expect(result.workspaceSlug).toBeUndefined();
  });

  it('falls back to atlas for www.atlas-phm.uk', () => {
    const result = resolveWorkspaceFromHost('www.atlas-phm.uk');
    expect(result.brandId).toBe('atlas-default');
    expect(result.source).toBe('fallback');
  });

  it('falls back to atlas for next.atlas-phm.uk (host-reserved staging slug)', () => {
    const result = resolveWorkspaceFromHost('next.atlas-phm.uk');
    expect(result.brandId).toBe('atlas-default');
    expect(result.source).toBe('fallback');
  });

  it('falls back to atlas for localhost', () => {
    const result = resolveWorkspaceFromHost('localhost');
    expect(result.brandId).toBe('atlas-default');
    expect(result.source).toBe('fallback');
  });

  it('falls back to atlas for localhost:5173', () => {
    const result = resolveWorkspaceFromHost('localhost:5173');
    expect(result.brandId).toBe('atlas-default');
    expect(result.source).toBe('fallback');
  });

  it('falls back to atlas for 127.0.0.1', () => {
    const result = resolveWorkspaceFromHost('127.0.0.1');
    expect(result.brandId).toBe('atlas-default');
    expect(result.source).toBe('fallback');
  });

  it('falls back to atlas for a Cloudflare Pages preview deploy (*.pages.dev)', () => {
    const result = resolveWorkspaceFromHost('abc123.pages.dev');
    expect(result.brandId).toBe('atlas-default');
    expect(result.source).toBe('fallback');
  });

  it('falls back to atlas for a Vercel preview deploy (*.vercel.app)', () => {
    const result = resolveWorkspaceFromHost('my-app.vercel.app');
    expect(result.brandId).toBe('atlas-default');
    expect(result.source).toBe('fallback');
  });

  it('falls back to atlas for a Netlify preview deploy (*.netlify.app)', () => {
    const result = resolveWorkspaceFromHost('my-app.netlify.app');
    expect(result.brandId).toBe('atlas-default');
    expect(result.source).toBe('fallback');
  });

  it('falls back to atlas for an unknown workspace slug', () => {
    const result = resolveWorkspaceFromHost('britishgas.atlas-phm.uk');
    expect(result.brandId).toBe('atlas-default');
    expect(result.source).toBe('fallback');
  });

  it('falls back to atlas for a workspace-reserved slug (admin)', () => {
    const result = resolveWorkspaceFromHost('admin.atlas-phm.uk');
    expect(result.brandId).toBe('atlas-default');
    expect(result.source).toBe('fallback');
  });

  it('falls back to atlas for a workspace-reserved slug (api)', () => {
    const result = resolveWorkspaceFromHost('api.atlas-phm.uk');
    expect(result.brandId).toBe('atlas-default');
    expect(result.source).toBe('fallback');
  });
});

// ─── resolveWorkspaceFromHost — stored (edited) tenant ───────────────────────

describe('resolveWorkspaceFromHost — stored tenant', () => {
  beforeEach(() => {
    // Inject a custom tenant into localStorage using the correct store shape.
    const storeShape = {
      schemaVersion: 1,
      tenantsById: {
        'custom-co': {
          version: '1.0',
          tenantId: 'custom-co',
          workspaceSlug: 'custom-co',
          displayName: 'Custom Co',
          brandId: 'installer-demo',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      },
    };
    localStorage.setItem('atlas:tenants:v1', JSON.stringify(storeShape));
  });

  afterEach(() => {
    localStorage.removeItem('atlas:tenants:v1');
  });

  it('resolves a stored tenant from its workspace slug', () => {
    const result = resolveWorkspaceFromHost('custom-co.atlas-phm.uk');
    expect(result.workspaceSlug).toBe('custom-co');
    expect(result.tenantId).toBe('custom-co');
    expect(result.source).toBe('host');
  });
});

// ─── resolveWorkspaceFromHost — never throws ─────────────────────────────────

describe('resolveWorkspaceFromHost — robustness', () => {
  it('does not throw for an empty string', () => {
    expect(() => resolveWorkspaceFromHost('')).not.toThrow();
  });

  it('does not throw for a malformed host', () => {
    expect(() => resolveWorkspaceFromHost(':::invalid:::')).not.toThrow();
  });

  it('returns source=fallback for an empty string', () => {
    const result = resolveWorkspaceFromHost('');
    expect(result.source).toBe('fallback');
  });
});
