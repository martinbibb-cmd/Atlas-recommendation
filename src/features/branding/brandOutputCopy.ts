/**
 * src/features/branding/brandOutputCopy.ts
 *
 * Deterministic CTA copy resolver driven by BrandProfileV1.tone.
 *
 * Rules (from atlas-terminology.md):
 *   formal    → "Please contact us to discuss the next step."
 *   friendly  → "Ready to talk through the best next step?"
 *   technical → "Review the recommendation and supporting evidence before proceeding."
 *
 * This helper is pure — no side effects, no UI, no engine access.
 * It may affect small fixed CTA strings only; it must never rewrite technical
 * conclusions or alter recommendation ranking.
 */

import type { BrandProfileV1 } from './brandProfile';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrandCtaCopy {
  /** CTA shown in the customer portal welcome/landing area. */
  portalCta: string;
  /** CTA shown alongside installer contact details. */
  contactCta: string;
  /** Short note rendered in the print/PDF footer. */
  printFooterNote: string;
}

// ─── Lookup table ─────────────────────────────────────────────────────────────

const CTA_BY_TONE: Record<BrandProfileV1['outputSettings']['tone'], BrandCtaCopy> = {
  formal: (() => {
    const copy = 'Please contact us to discuss the next step.';
    return { portalCta: copy, contactCta: copy, printFooterNote: copy };
  })(),
  friendly: (() => {
    const copy = 'Ready to talk through the best next step?';
    return { portalCta: copy, contactCta: copy, printFooterNote: copy };
  })(),
  technical: (() => {
    const copy = 'Review the recommendation and supporting evidence before proceeding.';
    return { portalCta: copy, contactCta: copy, printFooterNote: copy };
  })(),
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns deterministic CTA copy strings for the given brand profile.
 *
 * The result is looked up from a static table keyed on `brand.outputSettings.tone`.
 * The function is pure and referentially transparent — identical inputs always
 * produce identical outputs.
 *
 * @param brand - The active BrandProfileV1.
 * @returns BrandCtaCopy with portalCta, contactCta, and printFooterNote strings.
 */
export function getBrandCtaCopy(brand: BrandProfileV1): BrandCtaCopy {
  return CTA_BY_TONE[brand.outputSettings.tone];
}
