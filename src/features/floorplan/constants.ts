/**
 * constants.ts — shared numeric constants for the floor planner feature modules.
 *
 * All files in src/features/floorplan/ and the associated panel components
 * should import from here rather than redefining GRID locally.
 */

/** Canvas pixels per metre.  Must match the GRID constant in FloorPlanBuilder.tsx. */
export const GRID = 24;

/** Minimum wall length in canvas pixels before it is considered drawable/labelable. */
export const MIN_WALL_LENGTH_PX = 1;

/** Minimum wall length to display a dimension label (1 metre = 24 px). */
export const MIN_LABELED_WALL_LENGTH_PX = GRID;
