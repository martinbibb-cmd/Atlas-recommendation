/**
 * presentationVisualMapping.ts
 *
 * Declarative mapping from canonical presentation section IDs to Physics
 * Visual Library visuals.
 *
 * This is the single source of truth for which visual appears on each page
 * section. No visual-selection logic should be scattered across JSX — all
 * choices live here and are resolved via getVisualConfigForSection().
 *
 * Mapping:
 *   house          → heat_particles
 *   home           → flow_split
 *   energy         → solar_mismatch
 *   current_system → driving_style
 *   options        → cylinder_charge
 *   ranking        → driving_style
 *   shortlist_*    → signal-driven (null if no signal matches)
 *   simulator      → driving_style (preview)
 *
 * Visual selection rule:
 *   visual = signalMatch ?? sectionDefault ?? null
 *
 * NEVER fall back to a family-based visual. If no signal matches, return null
 * so callers render a neutral explanatory card rather than a wrong animation.
 */

import type { PhysicsVisualId, VisualDisplayMode } from '../physics-visuals/physicsVisualTypes';
import { getVisualDefinition } from '../physics-visuals/physicsVisualRegistry';

// ─── Section identifiers ───────────────────────────────────────────────────────

export type CanonicalPresentationSectionId =
  | 'house'
  | 'home'
  | 'energy'
  | 'current_system'
  | 'options'
  | 'ranking'
  | 'shortlist_option_1'
  | 'shortlist_option_2'
  | 'simulator';

// ─── Per-section visual configuration ─────────────────────────────────────────

export interface SectionVisualConfig {
  /** Preferred visual for this section. */
  preferredVisualId: PhysicsVisualId;
  /** Display mode used when rendering inline on a presentation page. */
  displayMode: VisualDisplayMode;
  /**
   * Engine signal keys that inform visual selection or data for this section.
   * Used for documentation and future dynamic selection.
   */
  signalPriority: string[];
}

// ─── Mapping table ────────────────────────────────────────────────────────────

const SECTION_VISUAL_MAP: Record<CanonicalPresentationSectionId, SectionVisualConfig> = {
  house: {
    preferredVisualId: 'heat_particles',
    displayMode: 'inline',
    signalPriority: ['wallType', 'fabricHeatLoss', 'insulationLevel'],
  },
  home: {
    preferredVisualId: 'flow_split',
    displayMode: 'inline',
    signalPriority: ['peakConcurrentOutlets', 'occupancyCount', 'bathroomCount'],
  },
  energy: {
    preferredVisualId: 'solar_mismatch',
    displayMode: 'inline',
    signalPriority: ['pvSuitability', 'solarStorageOpportunity', 'energyDemandAlignment'],
  },
  current_system: {
    preferredVisualId: 'driving_style',
    displayMode: 'inline',
    signalPriority: ['system_family', 'cycling_rate'],
  },
  options: {
    preferredVisualId: 'cylinder_charge',
    displayMode: 'inline',
    signalPriority: ['storageBenefitSignal', 'demandProfileLabel'],
  },
  ranking: {
    preferredVisualId: 'driving_style',
    displayMode: 'inline',
    signalPriority: ['system_family'],
  },
  shortlist_option_1: {
    preferredVisualId: 'cylinder_charge',
    displayMode: 'inline',
    signalPriority: ['solarStorageOpportunity', 'peakSimultaneousOutlets', 'demandProfile'],
  },
  shortlist_option_2: {
    preferredVisualId: 'cylinder_charge',
    displayMode: 'inline',
    signalPriority: ['solarStorageOpportunity', 'peakSimultaneousOutlets', 'demandProfile'],
  },
  simulator: {
    preferredVisualId: 'driving_style',
    displayMode: 'preview',
    signalPriority: [],
  },
};

// ─── Lookup ────────────────────────────────────────────────────────────────────

/**
 * Return the visual configuration for a given canonical presentation section.
 * Always returns a valid config — every section has a declarative entry.
 */
export function getVisualConfigForSection(
  sectionId: CanonicalPresentationSectionId,
): SectionVisualConfig {
  return SECTION_VISUAL_MAP[sectionId];
}

// ─── Visual validity ───────────────────────────────────────────────────────────

/**
 * Context passed to isVisualValid() so it can check signal and family
 * constraints defined on a visual's `validWhen` field.
 */
export interface VisualValidationContext {
  /** Active signal keys (those whose values are present / truthy). */
  activeSignals?: string[];
  /** Appliance family for the option being rendered. */
  optionFamily?: string;
  /**
   * Page type for the rendering context.
   * Used to enforce that generic visuals are never shown on signal-driven pages.
   */
  pageType?: string;
}

/**
 * Returns true if the visual is valid to render in the given context.
 *
 * A visual is invalid when:
 *   - Its `validWhen.requiredSignals` list is non-empty and none of those
 *     signals are present in `context.activeSignals`.
 *   - Its `validWhen.invalidForFamilies` list includes `context.optionFamily`.
 *
 * If the visual has no `validWhen` constraints it is always considered valid.
 * If the visual id is not found in the registry it is considered invalid.
 *
 * @throws {Error} When `cylinder_charge` (generic) is used on a shortlist page.
 *   Only the subtype-specific visuals (`cylinder_charge_standard`,
 *   `cylinder_charge_mixergy`) are permitted on shortlist pages.
 * @throws {Error} When `thermal_store` is used on a shortlist page.
 *   Thermal store is a legacy/current-system explainer, not a recommended future option.
 */
export function isVisualValid(
  visualId: PhysicsVisualId,
  context: VisualValidationContext,
): boolean {
  // Guard: generic cylinder is never allowed on signal-driven shortlist pages.
  if (context.pageType === 'shortlist' && visualId === 'cylinder_charge') {
    throw new Error(
      "Generic 'cylinder_charge' visual not allowed on shortlist pages. " +
      "Use 'cylinder_charge_standard' or 'cylinder_charge_mixergy' instead.",
    );
  }

  // Audit guard: thermal_store is a legacy / current-system explainer.
  // It must never appear on shortlist or recommendation pages as a future option.
  if (context.pageType === 'shortlist' && visualId === 'thermal_store') {
    throw new Error(
      "'thermal_store' visual is not permitted on shortlist pages. " +
      'Thermal store is a legacy current-system explainer only — it must not appear as a recommended future option.',
    );
  }

  const definition = getVisualDefinition(visualId);
  if (!definition) return false;

  const { validWhen } = definition;
  if (!validWhen) return true;

  // Family exclusion check
  if (
    validWhen.invalidForFamilies &&
    context.optionFamily &&
    validWhen.invalidForFamilies.includes(context.optionFamily)
  ) {
    return false;
  }

  // Signal requirement check — at least one required signal must be active
  if (validWhen.requiredSignals && validWhen.requiredSignals.length > 0) {
    const active = context.activeSignals ?? [];
    const hasRequiredSignal = validWhen.requiredSignals.some((sig) => active.includes(sig));
    if (!hasRequiredSignal) return false;
  }

  return true;
}

/**
 * Map a DHW storage subtype to the appropriate cylinder visual id.
 * Returns the subtype-specific visual, or null when the subtype is unknown/absent
 * (no animation beats a wrong animation).
 *
 * Thermal store is intentionally excluded: it is a legacy/current-system
 * architecture and must not be shown on shortlist pages as a recommended future option.
 * When the current system is a thermal store, the shortlist page returns null so
 * callers render a neutral explanatory card instead.
 */
function getCylinderVisualForStorageType(dhwStorageType?: string): 'cylinder_charge_mixergy' | 'cylinder_charge_standard' | null {
  if (dhwStorageType === 'mixergy') return 'cylinder_charge_mixergy';
  if (
    dhwStorageType === 'open_vented' ||
    dhwStorageType === 'unvented'
  ) return 'cylinder_charge_standard';
  // thermal_store and unknown: no animation is better than a wrong animation.
  return null;
}

/**
 * Resolve the best visual for a shortlist page using signal priority:
 *   1. signal-driven: cylinder_charge_mixergy or cylinder_charge_standard when
 *      solarStorageOpportunity is high, selected by dhwStorageType.
 *      If dhwStorageType is unknown, return null (no animation is better than wrong animation).
 *   2. signal-driven: flow_split when peakSimultaneousOutlets >= 2
 *   3. signal-driven: cylinder_charge_mixergy or cylinder_charge_standard when
 *      storageBenefitSignal is high, selected by dhwStorageType.
 *      If dhwStorageType is unknown, return null.
 *   4. null — no family-based fallback; show a neutral card instead
 *
 * Storage relevance guard: if neither storageBenefitSignal nor solarStorageOpportunity
 * is 'high', cylinder visuals are suppressed — showing a cylinder for a low-demand
 * single-person home with no solar adds noise rather than insight.
 *
 * Visual priority:  signalMatch ?? sectionDefault ?? null
 *
 * Family-based fallbacks are intentionally removed. Showing an incorrect
 * animation is worse than showing no animation. When null is returned,
 * callers must render a neutral explanatory card.
 */
export function resolveShortlistVisualId(
  solarStorageOpportunity: string,
  peakSimultaneousOutlets: number,
  dhwStorageType?: string,
  storageBenefitSignal?: string,
): PhysicsVisualId | null {
  // 1. Signal: solar storage opportunity is high → select cylinder visual by storage subtype
  if (solarStorageOpportunity === 'high') {
    return getCylinderVisualForStorageType(dhwStorageType);
  }

  // 2. Signal: concurrent demand risk → flow split is the key story
  if (peakSimultaneousOutlets >= 2) return 'flow_split';

  // 3. Signal: storage benefit is high → cylinder visual by storage subtype
  //    Guard: skip if storage benefit is not high (avoids noise for low-demand homes)
  if (storageBenefitSignal === 'high') {
    return getCylinderVisualForStorageType(dhwStorageType);
  }

  // 4. No direct signal match — return null so callers show a neutral card
  //    rather than a misleading family-based animation.
  return null;
}

export default SECTION_VISUAL_MAP;
