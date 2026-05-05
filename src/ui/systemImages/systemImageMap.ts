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

import type { HeatSource, DhwType, ControlFamily, PipeLayout, HeatingSystemType } from '../../features/survey/systemBuilder/systemBuilderTypes';

// ─── Image base path ─────────────────────────────────────────────────────────

const BASE = `${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/images/systems`;

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
 * heatingSystemType is consulted for regular boilers where no specific DHW type
 * is available — an open-vented heating circuit maps to the gravity layout image.
 * Returns null when the combination has no confident mapping.
 */
export function imageForCurrentSystem(
  heatSource: HeatSource | null | undefined,
  dhwType?: DhwType | null,
  heatingSystemType?: HeatingSystemType | null,
): SystemImageInfo | null {
  if (!heatSource) return null;

  switch (heatSource) {
    case 'combi':
    case 'storage_combi':
      return { src: `${BASE}/combination.svg`, alt: 'Combination boiler diagram' };

    case 'system':
      if (dhwType === 'unvented') {
        return { src: `${BASE}/unvented-cylinder.svg`, alt: 'System boiler with unvented cylinder diagram' };
      }
      return { src: `${BASE}/system-boiler.svg`, alt: 'System boiler diagram' };

    case 'regular':
      if (dhwType === 'unvented') {
        return { src: `${BASE}/unvented-cylinder.svg`, alt: 'Regular boiler with unvented cylinder diagram' };
      }
      if (dhwType === 'open_vented') {
        return { src: `${BASE}/open-vented-schematic.svg`, alt: 'Open-vented cylinder system diagram' };
      }
      // When no specific DHW type is known but heating circuit is open-vented
      // (gravity-fed with header tank), show the gravity circuit layout.
      if (heatingSystemType === 'open_vented') {
        return { src: `${BASE}/gravity.svg`, alt: 'Open-vented heating circuit — gravity-fed layout diagram' };
      }
      // thermal_store, plate_hex, small_store, sealed circuit, or unknown: no confident mapping
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
      return { src: `${BASE}/combination.svg`, alt: 'Combination boiler diagram' };
    case 'system_unvented':
      return { src: `${BASE}/unvented-cylinder.svg`, alt: 'System boiler with unvented cylinder diagram' };
    case 'heat_pump':
      return { src: `${BASE}/ashp.svg`, alt: 'Air source heat pump diagram' };
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
      return { src: `${BASE}/combination.svg`, alt: 'Combination boiler diagram' };
    case 'stored_unvented':
    case 'system_unvented':
      return { src: `${BASE}/unvented-cylinder.svg`, alt: 'System boiler with unvented cylinder diagram' };
    case 'stored_vented':
    case 'regular_vented':
      return { src: `${BASE}/vented-cylinder.svg`, alt: 'Regular boiler with open-vented cylinder diagram' };
    case 'ashp':
      return { src: `${BASE}/ashp.svg`, alt: 'Air source heat pump diagram' };
    case 'gshp':
      return { src: `${BASE}/gshp.svg`, alt: 'Ground source heat pump diagram' };
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
      return { src: `${BASE}/s-plan.svg`, alt: 'S-plan control wiring diagram' };
    case 'y_plan':
      return { src: `${BASE}/y-plan.svg`, alt: 'Y-plan control wiring diagram' };
    default:
      return null;
  }
}

// ─── Zone layout image ────────────────────────────────────────────────────────

/**
 * Returns a physical zone-layout diagram for a control architecture family.
 * Supplements (not replaces) the wiring schematic from imageForControlFamily.
 * Returns null when the control family does not imply a specific zone layout.
 */
export function imageForZoneLayout(
  controlFamily: ControlFamily | null | undefined,
): SystemImageInfo | null {
  if (!controlFamily) return null;

  switch (controlFamily) {
    case 's_plan':
    case 's_plan_plus':
      return { src: `${BASE}/two-zone.svg`, alt: 'Two-zone heating layout diagram' };
    default:
      return null;
  }
}

// ─── Pipe layout image ────────────────────────────────────────────────────────

/**
 * Returns a reference diagram for the heating pipework layout.
 * Returns null when no confident image exists for the given layout.
 */
export function imageForPipeLayout(
  layout: PipeLayout | null | undefined,
): SystemImageInfo | null {
  if (!layout) return null;

  switch (layout) {
    case 'one_pipe':
      return { src: `${BASE}/one-pipe.svg`, alt: 'One-pipe heating circuit diagram' };
    default:
      return null;
  }
}

// ─── Boiler detail image ──────────────────────────────────────────────────────

/**
 * Returns a detail image highlighting the condensate drain — applicable to all
 * modern condensing boilers (combi, system, and regular heat sources).
 * Returns null for non-boiler heat sources.
 */
export function imageForBoilerDetail(
  heatSource: HeatSource | null | undefined,
): SystemImageInfo | null {
  if (!heatSource) return null;

  switch (heatSource) {
    case 'combi':
    case 'storage_combi':
    case 'system':
    case 'regular':
      return { src: `${BASE}/condensate.svg`, alt: 'Condensate drain diagram' };
    default:
      return null;
  }
}

// ─── System components overview ───────────────────────────────────────────────

/**
 * Returns a general system-components diagram for boiler-based heating systems.
 * Suitable as a supporting explainer alongside the system architecture visualiser.
 * Returns null for heat-pump systems where the components diagram is not applicable.
 */
export function imageForSystemComponents(
  heatSource: HeatSource | null | undefined,
): SystemImageInfo | null {
  if (!heatSource) return null;

  switch (heatSource) {
    case 'system':
    case 'regular':
      return { src: `${BASE}/system-components.svg`, alt: 'Heating system components overview diagram' };
    default:
      return null;
  }
}
