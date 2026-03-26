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
import type { DhwArchitecture } from './buildCanonicalPresentation';

export type { DhwArchitecture };

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
 * Map a DHW architecture to the appropriate cylinder visual id.
 * Returns the architecture-specific visual, or null when the architecture
 * has no cylinder visual (no animation beats a wrong animation).
 *
 * Thermal store and on-demand are intentionally excluded:
 *   - thermal_store is a current-system explainer with its own dedicated visual.
 *   - on_demand has no cylinder to animate.
 */
function getCylinderVisualForArchitecture(architecture?: DhwArchitecture): 'cylinder_charge_mixergy' | 'cylinder_charge_standard' | null {
  if (architecture === 'mixergy')           return 'cylinder_charge_mixergy';
  if (architecture === 'standard_cylinder') return 'cylinder_charge_standard';
  // thermal_store, on_demand, and undefined: no animation is better than a wrong animation.
  return null;
}

/**
 * Resolve the visual id for the current-system presentation section using
 * DHW architecture as the primary discriminator.
 *
 *   thermal_store    → 'thermal_store'  (stores heat, high primary temp)
 *   mixergy          → 'cylinder_charge_mixergy'
 *   standard_cylinder → 'cylinder_charge_standard'
 *   on_demand        → 'driving_style' (mode driven by heat source type)
 *
 * When architecture is undefined the function falls back to driving_style so
 * the current-system page always shows a meaningful visual.
 *
 * @param architecture   Top-level DHW architecture from CurrentSystemSignal.
 * @returns              The PhysicsVisualId to render for the current system.
 */
export function resolveCurrentSystemVisualId(
  architecture: DhwArchitecture | undefined,
): PhysicsVisualId {
  if (architecture === 'thermal_store')     return 'thermal_store';
  if (architecture === 'mixergy')           return 'cylinder_charge_mixergy';
  if (architecture === 'standard_cylinder') return 'cylinder_charge_standard';
  // on_demand (or undefined fallback) → driving_style
  return 'driving_style';
}

/**
 * Resolve the best visual for a shortlist page using signal priority, with
 * DHW architecture as the primary cylinder-type discriminator.
 *
 *   1. signal-driven: cylinder visual when solarStorageOpportunity is high,
 *      selected by dhwArchitecture.  Returns null for thermal_store and
 *      on_demand (no cylinder visual is better than a wrong one).
 *   2. signal-driven: flow_split when peakSimultaneousOutlets >= 2
 *   3. signal-driven: cylinder visual when storageBenefitSignal is high,
 *      selected by dhwArchitecture.
 *   4. null — no family-based fallback; show a neutral card instead
 *
 * Storage relevance guard: if neither storageBenefitSignal nor
 * solarStorageOpportunity is 'high', cylinder visuals are suppressed —
 * showing a cylinder for a low-demand single-person home with no solar adds
 * noise rather than insight.
 *
 * Visual priority:  signalMatch ?? sectionDefault ?? null
 *
 * @param solarStorageOpportunity  'high' | 'medium' | 'low'
 * @param peakSimultaneousOutlets  Count of simultaneous hot-water outlets.
 * @param dhwArchitecture          Top-level DHW architecture of the option.
 * @param storageBenefitSignal     'high' | 'medium' | 'low'
 */
export function resolveShortlistVisualId(
  solarStorageOpportunity: string,
  peakSimultaneousOutlets: number,
  dhwArchitecture?: DhwArchitecture,
  storageBenefitSignal?: string,
): PhysicsVisualId | null {
  // 1. Signal: solar storage opportunity is high → select cylinder visual by architecture
  if (solarStorageOpportunity === 'high') {
    return getCylinderVisualForArchitecture(dhwArchitecture);
  }

  // 2. Signal: concurrent demand risk → flow split is the key story
  if (peakSimultaneousOutlets >= 2) return 'flow_split';

  // 3. Signal: storage benefit is high → cylinder visual by architecture
  //    Guard: skip if storage benefit is not high (avoids noise for low-demand homes)
  if (storageBenefitSignal === 'high') {
    return getCylinderVisualForArchitecture(dhwArchitecture);
  }

  // 4. No direct signal match — return null so callers show a neutral card
  //    rather than a misleading family-based animation.
  return null;
}

export default SECTION_VISUAL_MAP;
