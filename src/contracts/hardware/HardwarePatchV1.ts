/**
 * HardwarePatchV1.ts
 *
 * Override / extension layer for custom or legacy appliance definitions that
 * are not present in the static MasterRegistry.
 *
 * Architecture:
 *   - Standard manufacturer data lives in MasterRegistry.json (the Contract).
 *   - Custom / rare / legacy appliances encountered on site are stored as
 *     HardwarePatchV1 overrides in the D1 Database and carried inside the
 *     VisitHandoffPack so the iOS app can render a correct Ghost Box even when
 *     the appliance is not in the baseline registry.
 *
 * Merge semantics:
 *   - An override with the same modelId as a registry entry replaces that
 *     entry for the duration of the visit.
 *   - An override with a novel modelId acts as an additive custom definition.
 *
 * Design rules:
 *   - No engine calls, no React dependencies, no mutations.
 *   - Never used to alter the static MasterRegistry at runtime.
 */

import type { ApplianceDefinitionV1 } from './ApplianceDefinitionV1';

// ─── Single patch entry ───────────────────────────────────────────────────────

/**
 * One override or addition to the standard hardware registry.
 *
 * `definition` must be a fully-populated ApplianceDefinitionV1 so the iOS
 * Ghost Box can generate the SCNBox without falling back to the registry.
 */
export interface HardwarePatchEntryV1 {
  /**
   * ISO 8601 timestamp of when this override was last edited.
   * Example: "2025-10-14T14:32:00Z"
   */
  readonly updatedAt: string;

  /**
   * Free-text reason why this override exists.
   * Example: "Legacy boiler not in manufacturer's current range."
   */
  readonly notes?: string;

  /** The full appliance definition that replaces or extends the registry. */
  readonly definition: ApplianceDefinitionV1;
}

// ─── Patch collection ─────────────────────────────────────────────────────────

/**
 * HardwarePatchV1
 *
 * A set of appliance overrides carried inside a VisitHandoffPack.
 * Keyed by modelId for O(1) lookup on the iOS side.
 */
export interface HardwarePatchV1 {
  /**
   * Schema version for forward-compatibility detection.
   * Current version: "1".
   */
  readonly version: '1';

  /**
   * Map from modelId → override entry.
   *
   * Consumers should merge this on top of the baseline registry before
   * resolving any appliance definition for the current visit.
   */
  readonly overrides: Record<string, HardwarePatchEntryV1>;
}
