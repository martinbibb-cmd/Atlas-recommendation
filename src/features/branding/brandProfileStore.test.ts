/**
 * src/features/branding/brandProfileStore.test.ts
 *
 * Unit tests for the brand profile localStorage store.
 *
 * Coverage:
 *   - loadStoredBrandProfiles returns empty record when nothing is stored
 *   - upsertStoredBrandProfile persists a profile
 *   - deleteStoredBrandProfile removes a profile
 *   - listStoredBrandProfiles merges built-ins with stored profiles
 *   - stored profile overrides built-in by brandId
 *   - saveStoredBrandProfiles replaces the store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadStoredBrandProfiles,
  saveStoredBrandProfiles,
  upsertStoredBrandProfile,
  deleteStoredBrandProfile,
  listStoredBrandProfiles,
  BRAND_PROFILE_STORE_KEY,
} from './brandProfileStore';
import type { BrandProfileV1 } from './brandProfile';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clearStore(): void {
  try {
    localStorage.removeItem(BRAND_PROFILE_STORE_KEY);
  } catch {
    // unavailable
  }
}

function makeProfile(overrides?: Partial<BrandProfileV1>): BrandProfileV1 {
  return {
    version: '1.0',
    brandId: 'test-brand',
    companyName: 'Test Brand Co',
    theme: { primaryColor: '#123456' },
    contact: {},
    outputSettings: {
      showPricing: true,
      showCarbon: true,
      showInstallerContact: false,
      tone: 'friendly',
    },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearStore();
});

describe('loadStoredBrandProfiles', () => {
  it('returns an empty record when nothing is stored', () => {
    const profiles = loadStoredBrandProfiles();
    expect(profiles).toEqual({});
  });

  it('returns only stored profiles (not built-ins)', () => {
    const profile = makeProfile();
    upsertStoredBrandProfile(profile);
    const profiles = loadStoredBrandProfiles();
    expect(Object.keys(profiles)).toEqual(['test-brand']);
  });
});

describe('saveStoredBrandProfiles', () => {
  it('replaces the entire store', () => {
    upsertStoredBrandProfile(makeProfile({ brandId: 'old-brand', companyName: 'Old' }));
    const replacement = { 'new-brand': makeProfile({ brandId: 'new-brand', companyName: 'New' }) };
    saveStoredBrandProfiles(replacement);
    const profiles = loadStoredBrandProfiles();
    expect(Object.keys(profiles)).toEqual(['new-brand']);
    expect(profiles['old-brand']).toBeUndefined();
  });
});

describe('upsertStoredBrandProfile', () => {
  it('persists a new profile', () => {
    const profile = makeProfile();
    upsertStoredBrandProfile(profile);
    const profiles = loadStoredBrandProfiles();
    expect(profiles['test-brand']).toEqual(profile);
  });

  it('overwrites an existing profile with the same brandId', () => {
    upsertStoredBrandProfile(makeProfile({ companyName: 'Old Name' }));
    upsertStoredBrandProfile(makeProfile({ companyName: 'New Name' }));
    const profiles = loadStoredBrandProfiles();
    expect(profiles['test-brand'].companyName).toBe('New Name');
  });

  it('preserves other profiles when upserting', () => {
    upsertStoredBrandProfile(makeProfile({ brandId: 'brand-a', companyName: 'A' }));
    upsertStoredBrandProfile(makeProfile({ brandId: 'brand-b', companyName: 'B' }));
    const profiles = loadStoredBrandProfiles();
    expect(profiles['brand-a']).toBeDefined();
    expect(profiles['brand-b']).toBeDefined();
  });
});

describe('deleteStoredBrandProfile', () => {
  it('removes a stored profile', () => {
    upsertStoredBrandProfile(makeProfile());
    deleteStoredBrandProfile('test-brand');
    const profiles = loadStoredBrandProfiles();
    expect(profiles['test-brand']).toBeUndefined();
  });

  it('silently no-ops when brandId does not exist', () => {
    expect(() => deleteStoredBrandProfile('nonexistent')).not.toThrow();
  });

  it('preserves other profiles when deleting', () => {
    upsertStoredBrandProfile(makeProfile({ brandId: 'keep-me', companyName: 'Keep' }));
    upsertStoredBrandProfile(makeProfile({ brandId: 'delete-me', companyName: 'Delete' }));
    deleteStoredBrandProfile('delete-me');
    const profiles = loadStoredBrandProfiles();
    expect(profiles['keep-me']).toBeDefined();
    expect(profiles['delete-me']).toBeUndefined();
  });
});

describe('listStoredBrandProfiles', () => {
  it('includes built-in atlas-default profile', () => {
    const profiles = listStoredBrandProfiles();
    expect(profiles['atlas-default']).toBeDefined();
    expect(profiles['atlas-default'].companyName).toBe('Atlas');
  });

  it('includes built-in installer-demo profile', () => {
    const profiles = listStoredBrandProfiles();
    expect(profiles['installer-demo']).toBeDefined();
    expect(profiles['installer-demo'].companyName).toBe('Demo Heating Co');
  });

  it('includes custom stored profiles', () => {
    upsertStoredBrandProfile(makeProfile());
    const profiles = listStoredBrandProfiles();
    expect(profiles['test-brand']).toBeDefined();
  });

  it('stored profile overrides built-in by brandId', () => {
    const customInstaller: BrandProfileV1 = {
      version: '1.0',
      brandId: 'installer-demo',
      companyName: 'My Custom Heating Co',
      theme: { primaryColor: '#ff0000' },
      contact: {},
      outputSettings: {
        showPricing: false,
        showCarbon: false,
        showInstallerContact: true,
        tone: 'technical',
      },
    };
    upsertStoredBrandProfile(customInstaller);
    const profiles = listStoredBrandProfiles();
    expect(profiles['installer-demo'].companyName).toBe('My Custom Heating Co');
    expect(profiles['installer-demo'].theme.primaryColor).toBe('#ff0000');
  });
});
