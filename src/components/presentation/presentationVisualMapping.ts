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
 */
export function isVisualValid(
  visualId: PhysicsVisualId,
  context: VisualValidationContext,
): boolean {
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
 * Resolve the best visual for a shortlist page using signal priority:
 *   1. signal-driven: cylinder_charge_mixergy or cylinder_charge_standard when
 *      solarStorageOpportunity is high, selected by dhwStorageType.
 *      If dhwStorageType is unknown, return null (no animation is better than wrong animation).
 *   2. signal-driven: flow_split when peakSimultaneousOutlets >= 2
 *   3. null — no family-based fallback; show a neutral card instead
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
): PhysicsVisualId | null {
  // 1. Signal: solar storage opportunity is high → select cylinder visual by storage subtype
  if (solarStorageOpportunity === 'high') {
    if (dhwStorageType === 'mixergy') return 'cylinder_charge_mixergy';
    if (
      dhwStorageType === 'open_vented' ||
      dhwStorageType === 'unvented' ||
      dhwStorageType === 'thermal_store'
    ) return 'cylinder_charge_standard';
    // Unknown or absent storage subtype — show nothing rather than the wrong visual
    return null;
  }

  // 2. Signal: concurrent demand risk → flow split is the key story
  if (peakSimultaneousOutlets >= 2) return 'flow_split';

  // 3. No direct signal match — return null so callers show a neutral card
  //    rather than a misleading family-based animation.
  return null;
}

export default SECTION_VISUAL_MAP;
