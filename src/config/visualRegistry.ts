/**
 * visualRegistry.ts
 *
 * Visual asset registry for the Atlas recommendation overview page.
 *
 * Provides a declarative mapping from semantic visual keys to image sources,
 * alt text, and optional background treatment. Using visual keys rather than
 * direct file paths keeps page components decoupled from the asset layout.
 *
 * Keys for the "What We Know" overview page:
 *   overview_system_combi                — combi boiler card
 *   overview_system_system               — system boiler card
 *   overview_system_system_unvented      — system boiler + unvented cylinder
 *   overview_system_regular              — regular boiler with cylinder
 *   overview_system_regular_vented       — regular boiler + open-vented cylinder
 *   overview_system_heat_pump            — air source heat pump card
 *   overview_system_gshp                 — ground source heat pump card
 */

const SYSTEMS_BASE = `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}/images/systems`;

export interface VisualRegistryEntry {
  /** Absolute path for use as <img src> */
  src: string;
  /** Descriptive alt text for accessibility */
  alt: string;
  /** Optional soft CSS background colour for the media area */
  bgColor?: string;
}

export type OverviewSystemVisualKey =
  | 'overview_system_combi'
  | 'overview_system_system'
  | 'overview_system_system_unvented'
  | 'overview_system_regular'
  | 'overview_system_regular_vented'
  | 'overview_system_heat_pump'
  | 'overview_system_gshp';

const VISUAL_REGISTRY: Record<OverviewSystemVisualKey, VisualRegistryEntry> = {
  overview_system_combi: {
    src: `${SYSTEMS_BASE}/combination.svg`,
    alt: 'Combination boiler diagram',
    bgColor: '#fef9f0',
  },
  overview_system_system: {
    src: `${SYSTEMS_BASE}/system-boiler.svg`,
    alt: 'System boiler diagram',
    bgColor: '#f0f7fe',
  },
  overview_system_system_unvented: {
    src: `${SYSTEMS_BASE}/unvented-cylinder.svg`,
    alt: 'System boiler with unvented cylinder diagram',
    bgColor: '#f0f7fe',
  },
  overview_system_regular: {
    src: `${SYSTEMS_BASE}/open-vented-schematic.svg`,
    alt: 'Regular boiler with open-vented cylinder diagram',
    bgColor: '#f0f7fe',
  },
  overview_system_regular_vented: {
    src: `${SYSTEMS_BASE}/vented-cylinder.svg`,
    alt: 'Regular boiler with vented cylinder diagram',
    bgColor: '#f0f7fe',
  },
  overview_system_heat_pump: {
    src: `${SYSTEMS_BASE}/ashp.svg`,
    alt: 'Air source heat pump diagram',
    bgColor: '#f0faf4',
  },
  overview_system_gshp: {
    src: `${SYSTEMS_BASE}/gshp.svg`,
    alt: 'Ground source heat pump diagram',
    bgColor: '#f0faf4',
  },
};

/**
 * Retrieve a visual registry entry for the given overview system key.
 * Returns null when no entry exists — callers should render a component-based
 * alternative (e.g. SystemArchitectureVisualiser) rather than a broken image.
 */
export function getOverviewSystemVisual(
  key: OverviewSystemVisualKey,
): VisualRegistryEntry | null {
  return VISUAL_REGISTRY[key] ?? null;
}
