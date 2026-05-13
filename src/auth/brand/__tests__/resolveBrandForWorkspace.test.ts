/**
 * src/auth/brand/__tests__/resolveBrandForWorkspace.test.ts
 *
 * Unit tests for resolveBrandForWorkspace.
 *
 * Coverage:
 *   - no workspace → atlas_default
 *   - locked policy: workspace default only; route and user overrides ignored
 *   - workspace_default policy: route override accepted; user pref ignored
 *   - user_selectable policy: route > user pref > workspace default
 *   - disallowed route brand → warning + workspace default fallback
 *   - disallowed user pref → warning + workspace default fallback
 *   - schema inconsistency: defaultBrandId not in allowedBrandIds → warning
 *   - storedBrandId param takes priority over profile-derived pref
 *   - visit inherits resolved brand (resolved brand ID is usable for createAtlasVisit)
 *   - no workspace → activeBrandId is 'atlas-default'
 */

import { describe, it, expect } from 'vitest';
import {
  resolveBrandForWorkspace,
  type ResolvableWorkspace,
  type ResolveBrandForWorkspaceInput,
} from '../resolveBrandForWorkspace';
import type { BrandProfileV1 } from '../../../features/branding/brandProfile';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ATLAS_PROFILE: BrandProfileV1 = {
  version: '1.0',
  brandId: 'atlas-default',
  companyName: 'Atlas',
  theme: { primaryColor: '#2563EB' },
  contact: {},
  outputSettings: { showPricing: true, showCarbon: true, showInstallerContact: false, tone: 'technical' },
};

const DEMO_PROFILE: BrandProfileV1 = {
  version: '1.0',
  brandId: 'installer-demo',
  companyName: 'Demo Heating Co',
  theme: { primaryColor: '#16A34A' },
  contact: { phone: '0800 123 4567' },
  outputSettings: { showPricing: true, showCarbon: true, showInstallerContact: true, tone: 'friendly' },
};

const EXTRA_PROFILE: BrandProfileV1 = {
  version: '1.0',
  brandId: 'extra-brand',
  companyName: 'Extra Brand',
  theme: { primaryColor: '#9333EA' },
  contact: {},
  outputSettings: { showPricing: false, showCarbon: false, showInstallerContact: true, tone: 'formal' },
};

const REGISTRY = {
  'atlas-default': ATLAS_PROFILE,
  'installer-demo': DEMO_PROFILE,
  'extra-brand': EXTRA_PROFILE,
};

const LOCKED_WORKSPACE: ResolvableWorkspace = {
  workspaceId: 'ws_locked',
  name: 'Locked Workspace',
  defaultBrandId: 'atlas-default',
  allowedBrandIds: ['atlas-default'],
  brandPolicy: 'locked',
};

const DEFAULT_WORKSPACE: ResolvableWorkspace = {
  workspaceId: 'ws_default',
  name: 'Default Policy Workspace',
  defaultBrandId: 'atlas-default',
  allowedBrandIds: ['atlas-default', 'installer-demo'],
  brandPolicy: 'workspace_default',
};

const SELECTABLE_WORKSPACE: ResolvableWorkspace = {
  workspaceId: 'ws_selectable',
  name: 'User Selectable Workspace',
  defaultBrandId: 'atlas-default',
  allowedBrandIds: ['atlas-default', 'installer-demo', 'extra-brand'],
  brandPolicy: 'user_selectable',
};

function makeInput(
  overrides: Partial<ResolveBrandForWorkspaceInput> & { workspace?: ResolvableWorkspace | null },
): ResolveBrandForWorkspaceInput {
  return {
    workspace: DEFAULT_WORKSPACE,
    brandRegistry: REGISTRY,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('resolveBrandForWorkspace', () => {
  // ── No workspace ──────────────────────────────────────────────────────────

  it('returns atlas-default when workspace is null', () => {
    const result = resolveBrandForWorkspace(makeInput({ workspace: null }));
    expect(result.activeBrandId).toBe('atlas-default');
    expect(result.resolutionSource).toBe('atlas_default');
    expect(result.warnings).toHaveLength(0);
  });

  it('returns atlas-default profile when workspace is null', () => {
    const result = resolveBrandForWorkspace(makeInput({ workspace: null }));
    expect(result.activeBrandProfile.brandId).toBe('atlas-default');
  });

  // ── locked policy ─────────────────────────────────────────────────────────

  it('locked: returns workspace default even when routeBrandId is provided', () => {
    const result = resolveBrandForWorkspace(
      makeInput({ workspace: LOCKED_WORKSPACE, routeBrandId: 'installer-demo' }),
    );
    expect(result.activeBrandId).toBe('atlas-default');
    expect(result.resolutionSource).toBe('workspace_default');
  });

  it('locked: adds warning when route override is ignored', () => {
    const result = resolveBrandForWorkspace(
      makeInput({ workspace: LOCKED_WORKSPACE, routeBrandId: 'installer-demo' }),
    );
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/ignored.*locked/i);
  });

  it('locked: ignores user preference from storedBrandId', () => {
    const result = resolveBrandForWorkspace(
      makeInput({ workspace: LOCKED_WORKSPACE, storedBrandId: 'installer-demo' }),
    );
    expect(result.activeBrandId).toBe('atlas-default');
    expect(result.resolutionSource).toBe('workspace_default');
  });

  it('locked: adds warning when stored user preference is ignored', () => {
    const result = resolveBrandForWorkspace(
      makeInput({ workspace: LOCKED_WORKSPACE, storedBrandId: 'installer-demo' }),
    );
    expect(result.warnings.some((w) => /ignored.*locked/i.test(w))).toBe(true);
  });

  it('locked: ignores user preference from userProfile', () => {
    const result = resolveBrandForWorkspace(
      makeInput({
        workspace: LOCKED_WORKSPACE,
        userProfile: {
          preferredBrandIdByWorkspace: { ws_locked: 'installer-demo' },
        },
      }),
    );
    expect(result.activeBrandId).toBe('atlas-default');
    expect(result.resolutionSource).toBe('workspace_default');
  });

  it('locked: no warning when routeBrandId matches defaultBrandId', () => {
    const result = resolveBrandForWorkspace(
      makeInput({ workspace: LOCKED_WORKSPACE, routeBrandId: 'atlas-default' }),
    );
    expect(result.warnings.filter((w) => /ignored.*locked/i.test(w))).toHaveLength(0);
  });

  // ── workspace_default policy ──────────────────────────────────────────────

  it('workspace_default: returns workspace default when no overrides', () => {
    const result = resolveBrandForWorkspace(makeInput({ workspace: DEFAULT_WORKSPACE }));
    expect(result.activeBrandId).toBe('atlas-default');
    expect(result.resolutionSource).toBe('workspace_default');
  });

  it('workspace_default: accepts route override when brand is in allowedBrandIds', () => {
    const result = resolveBrandForWorkspace(
      makeInput({ workspace: DEFAULT_WORKSPACE, routeBrandId: 'installer-demo' }),
    );
    expect(result.activeBrandId).toBe('installer-demo');
    expect(result.resolutionSource).toBe('route_override');
  });

  it('workspace_default: ignores user preference (policy is not user_selectable)', () => {
    const result = resolveBrandForWorkspace(
      makeInput({
        workspace: DEFAULT_WORKSPACE,
        storedBrandId: 'installer-demo',
      }),
    );
    expect(result.activeBrandId).toBe('atlas-default');
    expect(result.resolutionSource).toBe('workspace_default');
  });

  it('workspace_default: route override rejected when brand not in allowedBrandIds', () => {
    const result = resolveBrandForWorkspace(
      makeInput({ workspace: DEFAULT_WORKSPACE, routeBrandId: 'extra-brand' }),
    );
    expect(result.activeBrandId).toBe('atlas-default');
    expect(result.resolutionSource).toBe('workspace_default');
    expect(result.warnings.some((w) => /not in allowedBrandIds/i.test(w))).toBe(true);
  });

  // ── user_selectable policy ────────────────────────────────────────────────

  it('user_selectable: resolves allowed user preference', () => {
    const result = resolveBrandForWorkspace(
      makeInput({
        workspace: SELECTABLE_WORKSPACE,
        storedBrandId: 'installer-demo',
      }),
    );
    expect(result.activeBrandId).toBe('installer-demo');
    expect(result.resolutionSource).toBe('user_preference');
  });

  it('user_selectable: route override wins over user preference', () => {
    const result = resolveBrandForWorkspace(
      makeInput({
        workspace: SELECTABLE_WORKSPACE,
        routeBrandId: 'extra-brand',
        storedBrandId: 'installer-demo',
      }),
    );
    expect(result.activeBrandId).toBe('extra-brand');
    expect(result.resolutionSource).toBe('route_override');
  });

  it('user_selectable: disallowed user preference falls back to workspace default', () => {
    const result = resolveBrandForWorkspace(
      makeInput({
        workspace: SELECTABLE_WORKSPACE,
        storedBrandId: 'not-a-real-brand',
      }),
    );
    expect(result.activeBrandId).toBe('atlas-default');
    expect(result.resolutionSource).toBe('workspace_default');
    expect(result.warnings.some((w) => /not in allowedBrandIds/i.test(w))).toBe(true);
  });

  it('user_selectable: resolves preference from userProfile when storedBrandId absent', () => {
    const result = resolveBrandForWorkspace(
      makeInput({
        workspace: SELECTABLE_WORKSPACE,
        userProfile: {
          preferredBrandIdByWorkspace: { ws_selectable: 'installer-demo' },
        },
      }),
    );
    expect(result.activeBrandId).toBe('installer-demo');
    expect(result.resolutionSource).toBe('user_preference');
  });

  it('user_selectable: explicit storedBrandId takes priority over userProfile preference', () => {
    const result = resolveBrandForWorkspace(
      makeInput({
        workspace: SELECTABLE_WORKSPACE,
        storedBrandId: 'extra-brand',
        userProfile: {
          preferredBrandIdByWorkspace: { ws_selectable: 'installer-demo' },
        },
      }),
    );
    expect(result.activeBrandId).toBe('extra-brand');
    expect(result.resolutionSource).toBe('user_preference');
  });

  it('user_selectable: falls back to workspace default when no preference is set', () => {
    const result = resolveBrandForWorkspace(
      makeInput({ workspace: SELECTABLE_WORKSPACE }),
    );
    expect(result.activeBrandId).toBe('atlas-default');
    expect(result.resolutionSource).toBe('workspace_default');
  });

  // ── Schema inconsistency ──────────────────────────────────────────────────

  it('emits warning when defaultBrandId is not in allowedBrandIds', () => {
    const inconsistentWorkspace: ResolvableWorkspace = {
      workspaceId: 'ws_inconsistent',
      name: 'Inconsistent',
      defaultBrandId: 'installer-demo',
      allowedBrandIds: ['atlas-default'], // missing defaultBrandId
      brandPolicy: 'workspace_default',
    };
    const result = resolveBrandForWorkspace(
      makeInput({ workspace: inconsistentWorkspace }),
    );
    expect(result.warnings.some((w) => /schema inconsistency/i.test(w))).toBe(true);
  });

  // ── Brand profile resolution ───────────────────────────────────────────────

  it('returns the correct BrandProfileV1 for the resolved brandId', () => {
    const result = resolveBrandForWorkspace(
      makeInput({
        workspace: SELECTABLE_WORKSPACE,
        storedBrandId: 'installer-demo',
      }),
    );
    expect(result.activeBrandProfile.brandId).toBe('installer-demo');
    expect(result.activeBrandProfile.companyName).toBe('Demo Heating Co');
  });

  it('returns atlas-default profile when resolved brandId is not in registry', () => {
    const result = resolveBrandForWorkspace(
      makeInput({
        workspace: {
          ...DEFAULT_WORKSPACE,
          defaultBrandId: 'ghost-brand',
          allowedBrandIds: ['ghost-brand'],
        },
      }),
    );
    expect(result.activeBrandProfile.brandId).toBe('atlas-default');
  });

  // ── Visit brand inheritance ────────────────────────────────────────────────

  it('resolved activeBrandId can be passed directly to createAtlasVisit (string)', () => {
    const result = resolveBrandForWorkspace(
      makeInput({
        workspace: SELECTABLE_WORKSPACE,
        storedBrandId: 'installer-demo',
      }),
    );
    // activeBrandId is always a string — safe to pass to createAtlasVisit(id, activeBrandId)
    expect(typeof result.activeBrandId).toBe('string');
    expect(result.activeBrandId.trim().length).toBeGreaterThan(0);
  });
});
