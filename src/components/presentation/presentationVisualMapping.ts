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
 *   shortlist_*    → cylinder_charge
 *   simulator      → driving_style (preview)
 */

import type { PhysicsVisualId, VisualDisplayMode } from '../physics-visuals/physicsVisualTypes';

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
  /** Fallback visual if preferred cannot be rendered. */
  fallbackVisualId?: PhysicsVisualId;
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
    fallbackVisualId: 'driving_style',
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
    fallbackVisualId: 'driving_style',
    displayMode: 'inline',
    signalPriority: ['solarStorageOpportunity', 'peakSimultaneousOutlets', 'demandProfile'],
  },
  shortlist_option_2: {
    preferredVisualId: 'cylinder_charge',
    fallbackVisualId: 'driving_style',
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

/**
 * Resolve the best visual for a shortlist page using signal priority:
 *   1. signal-driven: cylinder_charge when solarStorageOpportunity is high
 *   2. signal-driven: flow_split when peakSimultaneousOutlets >= 2
 *   3. section default based on option family (stored families → cylinder_charge)
 *   4. family fallback → driving_style
 *
 * Visual priority:  signalMatch ?? sectionDefault ?? familyFallback
 */
export function resolveShortlistVisualId(
  solarStorageOpportunity: string,
  peakSimultaneousOutlets: number,
  optionFamily: string,
): PhysicsVisualId {
  // 1. Signal: solar storage opportunity is high → cylinder charge is the key story
  if (solarStorageOpportunity === 'high') return 'cylinder_charge';

  // 2. Signal: concurrent demand risk → flow split is the key story
  if (peakSimultaneousOutlets >= 2) return 'flow_split';

  // 3. Section default based on whether this option has stored water
  const STORED_OPTION_FAMILIES = new Set([
    'stored_vented',
    'stored_unvented',
    'regular_vented',
    'system_unvented',
  ]);
  if (STORED_OPTION_FAMILIES.has(optionFamily)) return 'cylinder_charge';

  // 4. Family fallback — on-demand or heat pump
  return 'driving_style';
}

export default SECTION_VISUAL_MAP;
