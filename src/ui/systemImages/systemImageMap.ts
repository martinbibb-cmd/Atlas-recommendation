/**
 * systemImageMap.ts
 *
 * Maps system types, DHW types, control architectures, and recommendation IDs
 * to real-world reference images stored in /images/systems/.
 *
 * These images support visual recognition alongside the SystemArchitectureVisualiser.
 * They must never replace the visualiser — they are supporting explainers only.
 *
 * Returns null when no confident image mapping exists.
 */

import type { HeatSource, DhwType, ControlFamily } from '../../features/survey/systemBuilder/systemBuilderTypes';

// ─── Image base path ─────────────────────────────────────────────────────────

const BASE = '/images/systems';

// ─── Public API types ─────────────────────────────────────────────────────────

export interface SystemImageInfo {
  /** Absolute path for use as <img src> */
  src: string;
  /** Descriptive alt text for accessibility */
  alt: string;
}

// ─── Current system image ─────────────────────────────────────────────────────

/**
 * Returns a real-world image for the user's current heating system.
 * dhwType is consulted when the heat source alone is ambiguous (regular boiler).
 * Returns null when the combination has no confident mapping.
 */
export function imageForCurrentSystem(
  heatSource: HeatSource | null | undefined,
  dhwType?: DhwType | null,
): SystemImageInfo | null {
  if (!heatSource) return null;

  switch (heatSource) {
    case 'combi':
    case 'storage_combi':
      return { src: `${BASE}/Combination.PNG`, alt: 'Combination boiler — real-world example' };

    case 'system':
      if (dhwType === 'unvented') {
        return { src: `${BASE}/unvented-cylinder.JPG`, alt: 'System boiler with unvented cylinder — real-world example' };
      }
      return { src: `${BASE}/system-boiler.PNG`, alt: 'System boiler — real-world example' };

    case 'regular':
      if (dhwType === 'unvented') {
        return { src: `${BASE}/unvented-cylinder.JPG`, alt: 'Regular boiler with unvented cylinder — real-world example' };
      }
      if (dhwType === 'open_vented') {
        return { src: `${BASE}/open-vented-schematic.JPG`, alt: 'Open-vented cylinder system — real-world example' };
      }
      // thermal_store, plate_hex, small_store, or unknown: no confident mapping
      return null;

    default:
      return null;
  }
}

// ─── Recommendation image ─────────────────────────────────────────────────────

/**
 * Returns a real-world image for a proposed recommendation option.
 * Uses the insight recommendation ID (e.g. 'combi_upgrade', 'heat_pump').
 * Returns null when the rec ID has no confident mapping.
 */
export function imageForRecId(recId: string): SystemImageInfo | null {
  switch (recId) {
    case 'combi_upgrade':
      return { src: `${BASE}/Combination.PNG`, alt: 'Combination boiler — real-world example' };
    case 'system_unvented':
      return { src: `${BASE}/unvented-cylinder.JPG`, alt: 'System boiler with unvented cylinder — real-world example' };
    case 'heat_pump':
      return { src: `${BASE}/ASHP.PNG`, alt: 'Air source heat pump — real-world example' };
    default:
      return null;
  }
}

// ─── Option card image ────────────────────────────────────────────────────────

/**
 * Returns a real-world image for an OptionCardV1 recommendation option.
 * Uses the canonical OptionCardV1 id field.
 * Returns null when no confident mapping exists for the option.
 */
export function imageForOptionId(optionId: string): SystemImageInfo | null {
  switch (optionId) {
    case 'combi':
      return { src: `${BASE}/Combination.PNG`, alt: 'Combination boiler — real-world example' };
    case 'stored_unvented':
    case 'system_unvented':
      return { src: `${BASE}/unvented-cylinder.JPG`, alt: 'System boiler with unvented cylinder — real-world example' };
    case 'stored_vented':
    case 'regular_vented':
      return { src: `${BASE}/vented-cylinder.PNG`, alt: 'Regular boiler with open-vented cylinder — real-world example' };
    case 'ashp':
      return { src: `${BASE}/ASHP.PNG`, alt: 'Air source heat pump — real-world example' };
    case 'gshp':
      return { src: `${BASE}/GSHP.PNG`, alt: 'Ground source heat pump — real-world example' };
    default:
      return null;
  }
}

// ─── Controls/architecture image ─────────────────────────────────────────────

/**
 * Returns a schematic reference image for a control architecture family.
 * Intended for inline explainer contexts, not hero images.
 * Returns null when no reference schematic exists for the family.
 */
export function imageForControlFamily(
  controlFamily: ControlFamily | null | undefined,
): SystemImageInfo | null {
  if (!controlFamily) return null;

  switch (controlFamily) {
    case 's_plan':
    case 's_plan_plus':
      return { src: `${BASE}/s-plan.jpg`, alt: 'S-plan control wiring schematic' };
    case 'y_plan':
      return { src: `${BASE}/y-plan.jpg`, alt: 'Y-plan control wiring schematic' };
    default:
      return null;
  }
}
