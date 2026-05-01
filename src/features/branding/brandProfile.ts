/**
 * src/features/branding/brandProfile.ts
 *
 * BrandProfileV1 — white-label brand data model.
 *
 * This file contains type definitions only.  It has no runtime side-effects and
 * does not influence physics, ranking, or recommendation output in any way.
 */

// ─── Tone ─────────────────────────────────────────────────────────────────────

export type BrandToneV1 = 'formal' | 'friendly' | 'technical';

// ─── Theme tokens ─────────────────────────────────────────────────────────────

export interface BrandThemeTokensV1 {
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  textColor?: string;
}

// ─── Contact ──────────────────────────────────────────────────────────────────

export interface BrandContactV1 {
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
}

// ─── Output settings ──────────────────────────────────────────────────────────

export interface BrandOutputSettingsV1 {
  showPricing: boolean;
  showCarbon: boolean;
  showInstallerContact: boolean;
  tone: BrandToneV1;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface BrandProfileV1 {
  version: '1.0';
  brandId: string;
  companyName: string;
  logoUrl?: string;
  theme: BrandThemeTokensV1;
  contact: BrandContactV1;
  outputSettings: BrandOutputSettingsV1;
}
