/**
 * ApplianceDefinitionV1.ts
 *
 * Shared hardware schema for the Atlas platform.
 *
 * This file is the TypeScript equivalent of ApplianceDefinitionV1.swift in the
 * Atlas-contracts repository.  Once @atlas/contracts ships a hardware module,
 * this file can be replaced with a re-export:
 *
 *   export type { ApplianceDefinitionV1, … } from '@atlas/contracts/hardware';
 *
 * Fields follow the Atlas-contracts HardwareRegistryV1 spec:
 *   modelId  — unique identifier across all brands
 *   brand    — slug used by BoilerSizingModule and the iOS Ghost Box
 *   dimensions — physical envelope in millimetres (W × D × H)
 *   clearanceRules — minimum installation clearances in mm per side
 *
 * Design rules:
 *   - No engine calls, no React dependencies, no mutations.
 *   - All dimension and clearance values are in millimetres.
 */

// ─── Dimensions ───────────────────────────────────────────────────────────────

/** Physical enclosure dimensions of an appliance (all values in mm). */
export interface ApplianceDimensionsV1 {
  /** Width in millimetres (left to right when installed). */
  readonly widthMm: number;
  /** Depth in millimetres (front to back when installed). */
  readonly depthMm: number;
  /** Height in millimetres (floor to top when installed). */
  readonly heightMm: number;
}

// ─── Clearance rules ──────────────────────────────────────────────────────────

/**
 * Minimum installation clearances required around an appliance (all values
 * in mm).  Used by the iOS Ghost Box to generate the SCNBox collision volume.
 */
export interface ApplianceClearanceRulesV1 {
  /** Minimum clear space in front of the appliance (for servicing access). */
  readonly frontMm: number;
  /** Minimum clear space on each side of the appliance. */
  readonly sideMm: number;
  /** Minimum clear space above the appliance. */
  readonly topMm: number;
  /** Minimum clear space below the appliance. */
  readonly bottomMm: number;
}

// ─── Appliance definition ─────────────────────────────────────────────────────

/**
 * ApplianceDefinitionV1
 *
 * Single source-of-truth record for one boiler (or appliance) model.
 * All consumers — BoilerSizingModule, the Hardware Selection UI, and the
 * iOS Ghost Box — derive their data from this type.
 */
export interface ApplianceDefinitionV1 {
  /**
   * Unique model identifier across the entire registry.
   * Used as a stable foreign key in quotes, handoff packs, and patches.
   * Example: "gs4000_25kw"
   */
  readonly modelId: string;

  /**
   * Brand slug (lower-snake-case).
   * Example: "worcester_bosch"
   */
  readonly brand: string;

  /**
   * Human-readable brand name.
   * Example: "Worcester Bosch"
   */
  readonly brandName: string;

  /**
   * Series identifier within the brand.
   * Example: "greenstar_4000"
   */
  readonly seriesId: string;

  /**
   * Human-readable series name.
   * Example: "Greenstar 4000"
   */
  readonly seriesName: string;

  /**
   * Short description of the series shown in the Hardware Selection UI.
   * Example: "Wall-hung combi and system boiler range"
   */
  readonly seriesDescription?: string;

  /**
   * Human-readable model name shown in the spec table.
   * Example: "Greenstar 4000 25kW"
   */
  readonly modelName: string;

  /**
   * Nominal maximum heating / DHW output in kW.
   * Used by BoilerSizingModule for oversize-ratio calculations.
   */
  readonly outputKw: number;

  /** Physical enclosure dimensions. */
  readonly dimensions: ApplianceDimensionsV1;

  /**
   * Minimum installation clearances required by the manufacturer.
   * Drives the Ghost Box collision volume on iOS.
   */
  readonly clearanceRules: ApplianceClearanceRulesV1;

  /**
   * Path to the brand logo asset (relative to public/).
   * Null when no logo asset is available.
   */
  readonly logoPath?: string | null;
}
