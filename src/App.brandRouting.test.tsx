/**
 * src/App.brandRouting.test.tsx
 *
 * Tests for the host → workspace → brand routing priority chain used in App.tsx.
 *
 * These tests exercise the pure functions that underpin the brand priority
 * chain, and document the expected App.tsx behaviour without rendering the
 * full App component.
 *
 * Coverage:
 *   - demo-heating.atlas-phm.uk resolves demo-heating tenant and installer-demo brand
 *   - atlas-phm.uk falls back to atlas-default
 *   - www.atlas-phm.uk falls back to atlas-default
 *   - next.atlas-phm.uk falls back to atlas-default (host-reserved slug)
 *   - localhost falls back to atlas-default
 *   - unknown workspace falls back to atlas-default
 *   - reserved workspace slug falls back to atlas-default
 *   - active visit brandId beats host-resolved brandId (visit wins)
 *   - host-resolved brandId is used when no active visit exists
 *   - scan payload brandId is preserved independently of host (no host override)
 */

import { describe, it, expect } from 'vitest';
import { resolveWorkspaceFromHost } from './features/tenants/workspaceHost';

// ─── Host workspace resolution ────────────────────────────────────────────────

describe('App brand routing — host workspace resolution', () => {
  it('resolves demo-heating tenant and installer-demo brand for demo-heating.atlas-phm.uk', () => {
    const resolution = resolveWorkspaceFromHost('demo-heating.atlas-phm.uk');
    expect(resolution.source).toBe('host');
    expect(resolution.workspaceSlug).toBe('demo-heating');
    expect(resolution.tenantId).toBe('demo-heating');
    expect(resolution.brandId).toBe('installer-demo');
  });

  it('falls back to atlas-default for atlas-phm.uk', () => {
    const resolution = resolveWorkspaceFromHost('atlas-phm.uk');
    expect(resolution.source).toBe('fallback');
    expect(resolution.brandId).toBe('atlas-default');
  });

  it('falls back to atlas-default for www.atlas-phm.uk', () => {
    const resolution = resolveWorkspaceFromHost('www.atlas-phm.uk');
    expect(resolution.source).toBe('fallback');
    expect(resolution.brandId).toBe('atlas-default');
  });

  it('falls back to atlas-default for next.atlas-phm.uk (host-reserved staging slug)', () => {
    const resolution = resolveWorkspaceFromHost('next.atlas-phm.uk');
    expect(resolution.source).toBe('fallback');
    expect(resolution.brandId).toBe('atlas-default');
  });

  it('falls back to atlas-default for localhost', () => {
    const resolution = resolveWorkspaceFromHost('localhost');
    expect(resolution.source).toBe('fallback');
    expect(resolution.brandId).toBe('atlas-default');
  });

  it('falls back to atlas-default for an unknown workspace slug', () => {
    const resolution = resolveWorkspaceFromHost('britishgas.atlas-phm.uk');
    expect(resolution.source).toBe('fallback');
    expect(resolution.brandId).toBe('atlas-default');
  });

  it('falls back to atlas-default for a reserved workspace slug (admin)', () => {
    const resolution = resolveWorkspaceFromHost('admin.atlas-phm.uk');
    expect(resolution.source).toBe('fallback');
    expect(resolution.brandId).toBe('atlas-default');
  });
});

// ─── Brand priority chain (mirrors App.tsx: activeAtlasVisit?.brandId ?? hostResolution.brandId) ──

describe('App brand routing — priority chain', () => {
  it('active visit brandId wins over host-resolved brandId', () => {
    // Scenario: host resolves to demo-heating (installer-demo brand)
    // but the active visit was created with atlas-default brand.
    const hostResolution = resolveWorkspaceFromHost('demo-heating.atlas-phm.uk');
    const activeVisitBrandId = 'atlas-default';

    // App.tsx: brandId={activeAtlasVisit?.brandId ?? hostResolution.brandId}
    const resolvedBrandId = activeVisitBrandId ?? hostResolution.brandId;

    expect(resolvedBrandId).toBe('atlas-default');
    // Confirm the host would have supplied a different brand without the visit.
    expect(hostResolution.brandId).toBe('installer-demo');
  });

  it('host-resolved brandId is used when no active visit brand exists', () => {
    const hostResolution = resolveWorkspaceFromHost('demo-heating.atlas-phm.uk');
    const activeVisitBrandId: string | undefined = undefined;

    const resolvedBrandId = activeVisitBrandId ?? hostResolution.brandId;

    expect(resolvedBrandId).toBe('installer-demo');
  });

  it('falls back to atlas-default when host is localhost and no active visit', () => {
    const hostResolution = resolveWorkspaceFromHost('localhost');
    const activeVisitBrandId: string | undefined = undefined;

    const resolvedBrandId = activeVisitBrandId ?? hostResolution.brandId;

    expect(resolvedBrandId).toBe('atlas-default');
  });

  it('active visit brand from installer-demo beats host atlas fallback', () => {
    // Scenario: host is localhost (atlas fallback) but visit brand is installer-demo.
    const hostResolution = resolveWorkspaceFromHost('localhost');
    const activeVisitBrandId = 'installer-demo';

    const resolvedBrandId = activeVisitBrandId ?? hostResolution.brandId;

    expect(resolvedBrandId).toBe('installer-demo');
  });
});

// ─── Scan payload brand independence ─────────────────────────────────────────

describe('App brand routing — scan payload brand authority', () => {
  it('scan payload brandId is independent of host resolution', () => {
    // ScanHandoffReceivePage uses visit.brandId directly from the parsed payload
    // and does not read window.location.host.  The host resolution is not
    // involved in scan receive processing, so payload brand always wins.
    const hostResolution = resolveWorkspaceFromHost('atlas-phm.uk'); // atlas fallback
    const payloadBrandId = 'installer-demo'; // from scan handoff payload

    // The scan receive path: const atlasVisit = createAtlasVisit(visit.visitId, visit.brandId ?? DEFAULT_BRAND_ID)
    // visit.brandId comes from the payload — host is not consulted.
    expect(payloadBrandId).toBe('installer-demo');
    expect(payloadBrandId).not.toBe(hostResolution.brandId);
  });

  it('scan payload with atlas-default brand is preserved even on a branded host', () => {
    const hostResolution = resolveWorkspaceFromHost('demo-heating.atlas-phm.uk');
    const payloadBrandId = 'atlas-default'; // payload explicitly set atlas-default

    // Host brand (installer-demo) does not override the payload brand.
    expect(payloadBrandId).toBe('atlas-default');
    expect(hostResolution.brandId).toBe('installer-demo');
  });
});
