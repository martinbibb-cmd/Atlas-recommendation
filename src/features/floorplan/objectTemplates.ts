/**
 * objectTemplates.ts — PR19 object template registry.
 *
 * Provides sensible default dimensions, labels, icons, and grouping for
 * every FloorObjectType so that newly placed objects are meaningful from the
 * first click.
 *
 * Rules enforced here:
 *   - Default dimensions are NEVER stored as measured facts on the model.
 *   - Calling code must leave widthM / heightM / depthM undefined on the
 *     FloorObject when the user has not explicitly set them.  The inspector
 *     reads these defaults for display only.
 *   - `alwaysNumber` types (e.g. radiator) generate "Radiator 1", "Radiator 2"
 *     from the very first placement.  All other types use a plain label for
 *     the first instance and append a counter only when duplicates exist.
 */

import type { FloorObject, FloorObjectType } from '../../components/floorplan/propertyPlan.types';
import { FLOOR_OBJECT_TYPE_LABELS, FLOOR_OBJECT_TYPE_EMOJI } from '../../components/floorplan/propertyPlan.types';

// ─── Template interface ───────────────────────────────────────────────────────

export interface FloorObjectTemplate {
  /** Canonical type key. */
  type: FloorObjectType;
  /** Human-readable label (same as FLOOR_OBJECT_TYPE_LABELS for consistency). */
  label: string;
  /** Emoji icon. */
  emoji: string;
  /** Typical width in millimetres (along the wall / x-axis). */
  defaultWidthMm: number;
  /** Typical height in millimetres (depth from wall / y-axis). */
  defaultHeightMm: number;
  /** Typical depth in millimetres — only meaningful for volumetric objects
   *  (cylinder, boiler).  Undefined for flat plan-view fixtures. */
  defaultDepthMm?: number;
  /** True when the object is normally fixed to a wall (boiler, radiator, sink,
   *  shower, flue).  False for floor-standing objects (cylinder, bath). */
  wallMounted: boolean;
  /** Library group this object belongs to. */
  group: LibraryGroupId;
  /** When true the auto-label always includes a counter even for the first
   *  instance ("Radiator 1" vs plain "Boiler"). */
  alwaysNumber: boolean;
}

// ─── Library groups ───────────────────────────────────────────────────────────

export type LibraryGroupId =
  | 'heating'
  | 'hot_water'
  | 'bathroom'
  | 'building_services'
  | 'other';

export interface LibraryGroup {
  id: LibraryGroupId;
  label: string;
  types: FloorObjectType[];
}

export const LIBRARY_GROUPS: LibraryGroup[] = [
  {
    id: 'heating',
    label: 'Heating',
    types: ['boiler', 'radiator'],
  },
  {
    id: 'hot_water',
    label: 'Hot water',
    types: ['cylinder'],
  },
  {
    id: 'bathroom',
    label: 'Bathroom & fixtures',
    types: ['sink', 'bath', 'shower'],
  },
  {
    id: 'building_services',
    label: 'Building services',
    types: ['flue'],
  },
  {
    id: 'other',
    label: 'Other',
    types: ['other'],
  },
];

// ─── Template registry ────────────────────────────────────────────────────────

export const OBJECT_TEMPLATES: Record<FloorObjectType, FloorObjectTemplate> = {
  boiler: {
    type: 'boiler',
    label: FLOOR_OBJECT_TYPE_LABELS.boiler,
    emoji: FLOOR_OBJECT_TYPE_EMOJI.boiler,
    defaultWidthMm: 600,
    defaultHeightMm: 700,
    defaultDepthMm: 350,
    wallMounted: true,
    group: 'heating',
    alwaysNumber: false,
  },
  cylinder: {
    type: 'cylinder',
    label: FLOOR_OBJECT_TYPE_LABELS.cylinder,
    emoji: FLOOR_OBJECT_TYPE_EMOJI.cylinder,
    defaultWidthMm: 500,
    defaultHeightMm: 500,
    defaultDepthMm: 1100,
    wallMounted: false,
    group: 'hot_water',
    alwaysNumber: false,
  },
  radiator: {
    type: 'radiator',
    label: FLOOR_OBJECT_TYPE_LABELS.radiator,
    emoji: FLOOR_OBJECT_TYPE_EMOJI.radiator,
    defaultWidthMm: 1000,
    defaultHeightMm: 600,
    wallMounted: true,
    group: 'heating',
    alwaysNumber: true,
  },
  sink: {
    type: 'sink',
    label: FLOOR_OBJECT_TYPE_LABELS.sink,
    emoji: FLOOR_OBJECT_TYPE_EMOJI.sink,
    defaultWidthMm: 600,
    defaultHeightMm: 500,
    wallMounted: true,
    group: 'bathroom',
    alwaysNumber: false,
  },
  bath: {
    type: 'bath',
    label: FLOOR_OBJECT_TYPE_LABELS.bath,
    emoji: FLOOR_OBJECT_TYPE_EMOJI.bath,
    defaultWidthMm: 1700,
    defaultHeightMm: 700,
    wallMounted: false,
    group: 'bathroom',
    alwaysNumber: false,
  },
  shower: {
    type: 'shower',
    label: FLOOR_OBJECT_TYPE_LABELS.shower,
    emoji: FLOOR_OBJECT_TYPE_EMOJI.shower,
    defaultWidthMm: 900,
    defaultHeightMm: 900,
    wallMounted: false,
    group: 'bathroom',
    alwaysNumber: false,
  },
  flue: {
    type: 'flue',
    label: FLOOR_OBJECT_TYPE_LABELS.flue,
    emoji: FLOOR_OBJECT_TYPE_EMOJI.flue,
    defaultWidthMm: 125,
    defaultHeightMm: 125,
    wallMounted: true,
    group: 'building_services',
    alwaysNumber: false,
  },
  other: {
    type: 'other',
    label: FLOOR_OBJECT_TYPE_LABELS.other,
    emoji: FLOOR_OBJECT_TYPE_EMOJI.other,
    defaultWidthMm: 300,
    defaultHeightMm: 300,
    wallMounted: false,
    group: 'other',
    alwaysNumber: false,
  },
};

// ─── Auto-label helper ────────────────────────────────────────────────────────

/**
 * Generate a unique-enough auto-label for a newly placed object.
 *
 * `alwaysNumber` types (radiator) always include a 1-based counter.
 * All other types receive a plain label for the first instance and append
 * a counter only when one or more sibling objects of the same type already
 * exist in the plan.
 *
 * @param type             The FloorObjectType being placed.
 * @param existingObjects  All FloorObjects already present on the active floor.
 */
export function getDefaultLabel(
  type: FloorObjectType,
  existingObjects: FloorObject[],
): string {
  const tpl = OBJECT_TEMPLATES[type];
  const count = existingObjects.filter((o) => o.type === type).length;

  if (tpl.alwaysNumber) {
    // "Radiator 1", "Radiator 2", …
    return `${tpl.label} ${count + 1}`;
  }

  if (count === 0) {
    // First instance — plain label is sufficient.
    return tpl.label;
  }

  // Subsequent instances — append counter starting at 2.
  return `${tpl.label} ${count + 1}`;
}

// ─── Default-dimension helpers ────────────────────────────────────────────────

/**
 * Return the default width in metres for a type, converted from the template's
 * millimetre value.  Used by the inspector to display a fallback when the
 * object has no explicit widthM.
 */
export function defaultWidthM(type: FloorObjectType): number {
  return OBJECT_TEMPLATES[type].defaultWidthMm / 1000;
}

/**
 * Return the default height (depth-from-wall) in metres for a type.
 * Used by the inspector to display a fallback when the object has no
 * explicit heightM.
 */
export function defaultHeightM(type: FloorObjectType): number {
  return OBJECT_TEMPLATES[type].defaultHeightMm / 1000;
}

/**
 * Return the default depth in metres for types that have one (boiler,
 * cylinder).  Returns undefined for flat-plan fixtures.
 */
export function defaultDepthM(type: FloorObjectType): number | undefined {
  const mm = OBJECT_TEMPLATES[type].defaultDepthMm;
  return mm !== undefined ? mm / 1000 : undefined;
}

/**
 * Return true when the object's dimensions are all unset, meaning only
 * template defaults are available — no user measurement has been recorded.
 */
export function usingDefaultDimensions(obj: FloorObject): boolean {
  return obj.widthM === undefined && obj.heightM === undefined && obj.depthM === undefined;
}
