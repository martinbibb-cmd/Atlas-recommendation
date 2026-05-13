/**
 * src/auth/brand/__tests__/resolveBrandForWorkspace.test.ts
 *
 * Unit tests for resolveBrandForWorkspace.
 *
 * Coverage:
 *   1. locked workspace ignores route and user overrides (with warnings)
 *   2. allowed user preference resolves as 'user_preference'
 *   3. disallowed user preference falls back to workspace_default (with warning)
 *   4. allowed route override resolves as 'route_override'
 *   5. disallowed route override falls back (with warning)
 *   6. route_override wins over user_preference for non-locked workspace
 *   7. no workspace → atlas_default
 *   8. null userProfile → workspace_default (no preference to read)
 *   9. storedBrandId wins over profile preference
 *  10. disallowed storedBrandId falls back (with warning)
 *  11. defaultBrandId always treated as allowed even when absent from allowedBrandIds
 *  12. visit inherits resolved brand (smoke test: brand flows consistently)
 *  13. exports contain resolved brand metadata (smoke test)
 */

import { describe, it, expect } from 'vitest';
import { resolveBrandForWorkspace } from '../resolveBrandForWorkspace';
import type { ResolveBrandForWorkspaceInput } from '../resolveBrandForWorkspace';
import type { AtlasWorkspaceV1 } from '../../authTypes';
import type { AtlasUserProfileV1 } from '../../authTypes';
import type { BrandProfileV1 } from '../../../features/branding/brandProfile';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FIXED_NOW = '2026-05-13T10:00:00.000Z';

const ATLAS_DEFAULT_PROFILE: BrandProfileV1 = {
  version: '1.0',
  brandId: 'atlas-default',
  companyName: 'Atlas',
  theme: { primaryColor: '#2563EB' },
  contact: {},
  outputSettings: { showPricing: true, showCarbon: true, showInstallerContact: false, tone: 'technical' },
};

const INSTALLER_DEMO_PROFILE: BrandProfileV1 = {
  version: '1.0',
  brandId: 'installer-demo',
  companyName: 'Demo Heating Co',
  theme: { primaryColor: '#16A34A' },
  contact: { phone: '0800 123 4567' },
  outputSettings: { showPricing: true, showCarbon: true, showInstallerContact: true, tone: 'friendly' },
};

const SECONDARY_BRAND_PROFILE: BrandProfileV1 = {
  version: '1.0',
  brandId: 'secondary-brand',
  companyName: 'Secondary Co',
  theme: { primaryColor: '#DC2626' },
  contact: {},
  outputSettings: { showPricing: false, showCarbon: false, showInstallerContact: false, tone: 'formal' },
};

const TEST_REGISTRY: Readonly<Record<string, BrandProfileV1>> = {
  'atlas-default': ATLAS_DEFAULT_PROFILE,
  'installer-demo': INSTALLER_DEMO_PROFILE,
  'secondary-brand': SECONDARY_BRAND_PROFILE,
};

function makeWorkspace(
  overrides: Partial<AtlasWorkspaceV1> = {},
): AtlasWorkspaceV1 {
  return {
    version: '1.0',
    workspaceId: 'ws_test',
    name: 'Test Workspace',
    ownerAtlasUserId: 'atlas_user_001',
    defaultBrandId: 'installer-demo',
    allowedBrandIds: ['installer-demo', 'secondary-brand'],
    brandPolicy: 'workspace_default',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

function makeUserProfile(
  overrides: Partial<AtlasUserProfileV1> = {},
): AtlasUserProfileV1 {
  return {
    version: '1.0',
    atlasUserId: 'atlas_user_001',
    firebaseUid: 'firebase_uid_001',
    displayName: 'Alice Engineer',
    email: 'alice@example.com',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

function makeInput(
  overrides: Partial<ResolveBrandForWorkspaceInput> = {},
): ResolveBrandForWorkspaceInput {
  return {
    workspace: makeWorkspace(),
    userProfile: makeUserProfile(),
    brandRegistry: TEST_REGISTRY,
    ...overrides,
  };
}

// ─── 1. Locked workspace ignores overrides ────────────────────────────────────

describe('1 — locked workspace ignores route and user overrides', () => {
  it('returns workspace_default and ignores routeBrandId', () => {
    const result = resolveBrandForWorkspace(
      makeInput({
        workspace: makeWorkspace({ brandPolicy: 'locked' }),
        routeBrandId: 'secondary-brand',
      }),
    );
    expect(result.resolutionSource).toBe('workspace_default');
    expect(result.activeBrandId).toBe('installer-demo');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/locked.*route override.*ignored/i);
  });

  it('returns workspace_default and ignores storedBrandId', () => {
    const result = resolveBrandForWorkspace(
      makeInput({
        workspace: makeWorkspace({ brandPolicy: 'locked' }),
        storedBrandId: 'secondary-brand',
      }),
    );
    expect(result.resolutionSource).toBe('workspace_default');
    expect(result.activeBrandId).toBe('installer-demo');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/locked.*stored preference.*ignored/i);
  });

  it('returns workspace_default and ignores profile preference for locked workspace', () => {
    const result = resolveBrandForWorkspace(
      makeInput({
        workspace: makeWorkspace({ brandPolicy: 'locked' }),
        userProfile: makeUserProfile({
          preferredBrandIdByWorkspace: { ws_test: 'secondary-brand' },
        }),
      }),
    );
    expect(result.resolutionSource).toBe('workspace_default');
    expect(result.activeBrandId).toBe('installer-demo');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/locked.*profile preference.*ignored/i);
  });

  it('produces no warnings when locked workspace has no override inputs', () => {
    const result = resolveBrandForWorkspace(
      makeInput({ workspace: makeWorkspace({ brandPolicy: 'locked' }) }),
    );
    expect(result.resolutionSource).toBe('workspace_default');
    expect(result.warnings).toHaveLength(0);
  });
});

// ─── 2. Allowed user preference resolves ─────────────────────────────────────

describe('2 — allowed user preference resolves as user_preference', () => {
  it('uses storedBrandId when it is in allowedBrandIds', () => {
    const result = resolveBrandForWorkspace(
      makeInput({ storedBrandId: 'secondary-brand' }),
    );
    expect(result.resolutionSource).toBe('user_preference');
    expect(result.activeBrandId).toBe('secondary-brand');
    expect(result.warnings).toHaveLength(0);
  });

  it('uses profile preference when storedBrandId is absent', () => {
    const result = resolveBrandForWorkspace(
      makeInput({
        userProfile: makeUserProfile({
          preferredBrandIdByWorkspace: { ws_test: 'secondary-brand' },
        }),
      }),
    );
    expect(result.resolutionSource).toBe('user_preference');
    expect(result.activeBrandId).toBe('secondary-brand');
    expect(result.warnings).toHaveLength(0);
  });

  it('storedBrandId takes priority over profile preference', () => {
    const result = resolveBrandForWorkspace(
      makeInput({
        storedBrandId: 'secondary-brand',
        userProfile: makeUserProfile({
          preferredBrandIdByWorkspace: { ws_test: 'atlas-default' },
        }),
      }),
    );
    expect(result.resolutionSource).toBe('user_preference');
    expect(result.activeBrandId).toBe('secondary-brand');
  });
});

// ─── 3. Disallowed user preference falls back ─────────────────────────────────

describe('3 — disallowed user preference falls back to workspace_default', () => {
  it('warns and falls back when storedBrandId is not in allowedBrandIds', () => {
    const result = resolveBrandForWorkspace(
      makeInput({ storedBrandId: 'atlas-default' }),
    );
    // 'atlas-default' is NOT in allowedBrandIds ['installer-demo', 'secondary-brand']
    expect(result.resolutionSource).toBe('workspace_default');
    expect(result.activeBrandId).toBe('installer-demo');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/not in allowedBrandIds/i);
  });

  it('warns and falls back when profile preference is disallowed', () => {
    const result = resolveBrandForWorkspace(
      makeInput({
        userProfile: makeUserProfile({
          preferredBrandIdByWorkspace: { ws_test: 'unknown-brand' },
        }),
      }),
    );
    expect(result.resolutionSource).toBe('workspace_default');
    expect(result.activeBrandId).toBe('installer-demo');
    expect(result.warnings).toHaveLength(1);
  });
});

// ─── 4. Allowed route override resolves ───────────────────────────────────────

describe('4 — allowed route override resolves as route_override', () => {
  it('uses routeBrandId when it is in allowedBrandIds', () => {
    const result = resolveBrandForWorkspace(
      makeInput({ routeBrandId: 'secondary-brand' }),
    );
    expect(result.resolutionSource).toBe('route_override');
    expect(result.activeBrandId).toBe('secondary-brand');
    expect(result.warnings).toHaveLength(0);
  });
});

// ─── 5. Disallowed route override falls back ──────────────────────────────────

describe('5 — disallowed route override falls back', () => {
  it('warns and falls back when routeBrandId is not in allowedBrandIds', () => {
    const result = resolveBrandForWorkspace(
      makeInput({ routeBrandId: 'atlas-default' }),
    );
    // 'atlas-default' is not in ['installer-demo', 'secondary-brand']
    expect(result.resolutionSource).toBe('workspace_default');
    expect(result.activeBrandId).toBe('installer-demo');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/not in allowedBrandIds/i);
  });
});

// ─── 6. route_override wins over user_preference ─────────────────────────────

describe('6 — route_override wins over user_preference for non-locked workspace', () => {
  it('prefers routeBrandId over storedBrandId', () => {
    const result = resolveBrandForWorkspace(
      makeInput({
        routeBrandId: 'secondary-brand',
        storedBrandId: 'installer-demo',
      }),
    );
    expect(result.resolutionSource).toBe('route_override');
    expect(result.activeBrandId).toBe('secondary-brand');
  });
});

// ─── 7. No workspace → atlas_default ─────────────────────────────────────────

describe('7 — no workspace → atlas_default', () => {
  it('returns atlas_default when workspace is null', () => {
    const result = resolveBrandForWorkspace(
      makeInput({ workspace: null }),
    );
    expect(result.resolutionSource).toBe('atlas_default');
    expect(result.activeBrandId).toBe('atlas-default');
    expect(result.warnings).toHaveLength(0);
  });

  it('returns atlas_default profile with companyName Atlas', () => {
    const result = resolveBrandForWorkspace(
      makeInput({ workspace: null }),
    );
    expect(result.activeBrandProfile.companyName).toBe('Atlas');
  });
});

// ─── 8. Null userProfile → workspace_default ──────────────────────────────────

describe('8 — null userProfile → workspace_default (no preference to read)', () => {
  it('falls through to workspace_default when userProfile is null', () => {
    const result = resolveBrandForWorkspace(
      makeInput({ userProfile: null }),
    );
    expect(result.resolutionSource).toBe('workspace_default');
    expect(result.activeBrandId).toBe('installer-demo');
    expect(result.warnings).toHaveLength(0);
  });
});

// ─── 9. storedBrandId vs profile preference priority ─────────────────────────

describe('9 — storedBrandId wins over profile preference', () => {
  it('returns storedBrandId when both storedBrandId and profile preference are set', () => {
    const result = resolveBrandForWorkspace(
      makeInput({
        storedBrandId: 'secondary-brand',
        userProfile: makeUserProfile({
          preferredBrandIdByWorkspace: { ws_test: 'atlas-default' },
        }),
      }),
    );
    // secondary-brand is allowed, atlas-default is not, so storedBrandId wins
    expect(result.resolutionSource).toBe('user_preference');
    expect(result.activeBrandId).toBe('secondary-brand');
  });
});

// ─── 10. Disallowed storedBrandId falls back ──────────────────────────────────

describe('10 — disallowed storedBrandId falls back', () => {
  it('warns and falls back to workspace_default when storedBrandId is disallowed', () => {
    const result = resolveBrandForWorkspace(
      makeInput({ storedBrandId: 'not-registered-brand' }),
    );
    expect(result.resolutionSource).toBe('workspace_default');
    expect(result.warnings).toHaveLength(1);
  });
});

// ─── 11. defaultBrandId always treated as allowed ────────────────────────────

describe('11 — defaultBrandId always treated as allowed', () => {
  it('falls back to defaultBrandId even if it is missing from allowedBrandIds array', () => {
    const result = resolveBrandForWorkspace(
      makeInput({
        workspace: makeWorkspace({
          defaultBrandId: 'installer-demo',
          allowedBrandIds: [], // empty — but defaultBrandId should still be treated as allowed
        }),
      }),
    );
    expect(result.resolutionSource).toBe('workspace_default');
    expect(result.activeBrandId).toBe('installer-demo');
  });
});

// ─── 12. Visit inherits resolved brand (integration smoke test) ───────────────

describe('12 — visit inherits resolved brand', () => {
  it('resolved brand flows consistently: activeBrandId matches activeBrandProfile.brandId', () => {
    const result = resolveBrandForWorkspace(makeInput({ storedBrandId: 'secondary-brand' }));
    expect(result.activeBrandId).toBe(result.activeBrandProfile.brandId);
  });

  it('workspace_default brand flows consistently', () => {
    const result = resolveBrandForWorkspace(makeInput());
    expect(result.activeBrandId).toBe(result.activeBrandProfile.brandId);
  });
});

// ─── 13. Exports contain resolved brand metadata ─────────────────────────────

describe('13 — exports contain resolved brand metadata', () => {
  it('resolved result carries all required fields for export embedding', () => {
    const result = resolveBrandForWorkspace(makeInput({ storedBrandId: 'installer-demo' }));
    expect(result).toHaveProperty('activeBrandId');
    expect(result).toHaveProperty('activeBrandProfile');
    expect(result).toHaveProperty('resolutionSource');
    expect(result).toHaveProperty('warnings');
    expect(typeof result.activeBrandId).toBe('string');
    expect(result.activeBrandId.length).toBeGreaterThan(0);
  });

  it('user_selectable workspace preserves user preference for export', () => {
    const result = resolveBrandForWorkspace(
      makeInput({
        workspace: makeWorkspace({ brandPolicy: 'user_selectable' }),
        storedBrandId: 'secondary-brand',
      }),
    );
    expect(result.resolutionSource).toBe('user_preference');
    expect(result.activeBrandId).toBe('secondary-brand');
  });
});
