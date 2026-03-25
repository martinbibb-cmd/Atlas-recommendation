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
    signalPriority: ['storageBenefitSignal'],
  },
  shortlist_option_2: {
    preferredVisualId: 'cylinder_charge',
    fallbackVisualId: 'driving_style',
    displayMode: 'inline',
    signalPriority: ['storageBenefitSignal'],
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

export default SECTION_VISUAL_MAP;
