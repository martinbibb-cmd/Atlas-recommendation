/**
 * src/features/branding/brandProfiles.ts
 *
 * Built-in default brand profiles.
 *
 * Adding a new profile here is the only change required to register it;
 * resolveBrandProfile() picks it up automatically via BRAND_PROFILES.
 */

import type { BrandProfileV1 } from './brandProfile';

// ─── Default profiles ─────────────────────────────────────────────────────────

const ATLAS_DEFAULT: BrandProfileV1 = {
  version: '1.0',
  brandId: 'atlas-default',
  companyName: 'Atlas',
  theme: {
    primaryColor: '#2563EB',
    secondaryColor: '#1E40AF',
    accentColor: '#3B82F6',
    backgroundColor: '#FFFFFF',
    surfaceColor: '#F8FAFC',
    textColor: '#0F172A',
  },
  contact: {},
  outputSettings: {
    showPricing: true,
    showCarbon: true,
    showInstallerContact: false,
    tone: 'technical',
  },
};

const INSTALLER_DEMO: BrandProfileV1 = {
  version: '1.0',
  brandId: 'installer-demo',
  companyName: 'Demo Heating Co',
  theme: {
    primaryColor: '#16A34A',
    secondaryColor: '#15803D',
    accentColor: '#22C55E',
    backgroundColor: '#FFFFFF',
    surfaceColor: '#F0FDF4',
    textColor: '#052E16',
  },
  contact: {
    phone: '0800 123 4567',
    email: 'hello@demo-heating.co.uk',
    website: 'https://demo-heating.co.uk',
  },
  outputSettings: {
    showPricing: true,
    showCarbon: true,
    showInstallerContact: true,
    tone: 'friendly',
  },
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const BRAND_PROFILES: Record<string, BrandProfileV1> = {
  'atlas-default': ATLAS_DEFAULT,
  'installer-demo': INSTALLER_DEMO,
};

export const DEFAULT_BRAND_ID = 'atlas-default';
