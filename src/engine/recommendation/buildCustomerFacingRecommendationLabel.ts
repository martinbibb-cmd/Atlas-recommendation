/**
 * buildCustomerFacingRecommendationLabel.ts
 *
 * Canonical resolver for customer-facing recommendation labels.
 *
 * THIS IS THE SINGLE SOURCE OF TRUTH for mapping a verdict-level
 * ApplianceFamily (plus optional DHW subtype context) to a customer-safe
 * display string.  No other module may implement its own family → label map
 * for customer-facing output.
 *
 * Rules (non-negotiable):
 *   1. "unvented cylinder" must never appear in a customer-facing label for the
 *      `system` family — use the behavioural phrasing instead.
 *   2. When dhwSubtype is 'mixergy', the label must reflect the pressure-
 *      tolerant storage arrangement, not the generic stored-water label.
 *   3. When dhwSubtype is 'vented_fallback', emit the vented storage label.
 *   4. Labels must use only terms from docs/atlas-terminology.md.
 *   5. Labels must be consistent across hero title, Atlas Pick, alternatives,
 *      ruledOut, and next-steps surfaces — never redeclared locally.
 */

import type { ApplianceFamily } from '../topology/SystemTopology';

// ─── DHW subtype context ──────────────────────────────────────────────────────

/**
 * Optional DHW subtype context supplied by the calling surface when it has
 * more precise knowledge of the hot-water arrangement than the family alone.
 *
 *   'mixergy'          — Mixergy (pressure-tolerant) cylinder is the preferred
 *                        DHW appliance for the system/regular family.
 *   'vented_fallback'  — Standard unvented is not suitable; vented cylinder
 *                        is the correct DHW arrangement.
 *   'regular_unvented' — Current heat source is a regular (heat-only) boiler
 *                        serving an unvented (mains-pressure) cylinder.  The
 *                        family maps to 'system' for physics but the label must
 *                        reflect the regular boiler (not a system boiler).
 */
export type DhwSubtypeContext = 'mixergy' | 'vented_fallback' | 'regular_unvented';

// ─── Label map ────────────────────────────────────────────────────────────────

/**
 * Base customer-facing labels per ApplianceFamily.
 *
 * These are used when no dhwSubtype context is available.  The `system` entry
 * intentionally omits "unvented cylinder" — the DHW arrangement may be
 * unvented, Mixergy, or vented depending on downstream constraint resolution,
 * so the base label uses the neutral behavioural phrase "stored hot water".
 *
 * NOTE: `open_vented` specifically refers to a regular boiler with a vented
 * (tank-fed, gravity or pumped from loft tank) cylinder arrangement.
 */
const BASE_CUSTOMER_LABELS: Record<ApplianceFamily, string> = {
  combi:       'On-demand hot water (combi boiler)',
  system:      'System boiler with stored hot water',
  heat_pump:   'Air source heat pump',
  regular:     'Regular boiler with stored hot water',
  open_vented: 'Regular boiler with tank-fed hot water',
};

// ─── Public function ──────────────────────────────────────────────────────────

/**
 * buildCustomerFacingRecommendationLabel
 *
 * Resolves the customer-safe display label for a given appliance family and
 * optional DHW subtype context.
 *
 * Priority:
 *   1. Mixergy override — emits pressure-tolerant phrasing.
 *   2. Vented fallback override — emits tank-fed storage phrasing.
 *   3. Regular-unvented override — regular boiler serving an unvented cylinder.
 *   4. Base family label — neutral behavioural phrasing without subtype leak.
 *
 * Usage:
 *   // Verdict-level (no subtype known):
 *   buildCustomerFacingRecommendationLabel('system')
 *   // → 'System boiler with stored hot water'
 *
 *   // Mixergy case:
 *   buildCustomerFacingRecommendationLabel('system', 'mixergy')
 *   // → 'System boiler with pressure-tolerant stored hot water'
 *
 *   // Vented fallback case:
 *   buildCustomerFacingRecommendationLabel('system', 'vented_fallback')
 *   // → 'Stored hot water system'
 *
 *   // Regular boiler with unvented cylinder (like-for-like):
 *   buildCustomerFacingRecommendationLabel('system', 'regular_unvented')
 *   // → 'Regular boiler with unvented cylinder'
 */
export function buildCustomerFacingRecommendationLabel(
  family: ApplianceFamily,
  dhwSubtype?: DhwSubtypeContext,
): string {
  // ── 1. Mixergy override ──────────────────────────────────────────────────────
  if (dhwSubtype === 'mixergy') {
    const boilerLabel = family === 'regular' ? 'Regular boiler' : 'System boiler';
    return `${boilerLabel} with pressure-tolerant stored hot water`;
  }

  // ── 2. Vented fallback override ──────────────────────────────────────────────
  if (dhwSubtype === 'vented_fallback') {
    return 'Stored hot water system';
  }

  // ── 3. Regular-unvented override — regular boiler + mains-pressure cylinder ─
  if (dhwSubtype === 'regular_unvented') {
    return 'Regular boiler with unvented cylinder';
  }

  // ── 4. Base label ────────────────────────────────────────────────────────────
  return BASE_CUSTOMER_LABELS[family];
}
