/**
 * index.ts
 *
 * Public surface of the local hardware contracts module.
 *
 * When @atlas/contracts ships a hardware sub-path (e.g. @atlas/contracts/hardware),
 * this file can be replaced with:
 *
 *   export type { ApplianceDefinitionV1, … } from '@atlas/contracts/hardware';
 *   export { MASTER_REGISTRY } from '@atlas/contracts/hardware';
 *
 * All consumers of hardware types should import from this barrel file, not
 * from the individual files, to make the future migration a single-line swap.
 */

export type {
  ApplianceDimensionsV1,
  ApplianceClearanceRulesV1,
  ApplianceDefinitionV1,
} from './ApplianceDefinitionV1';

export type {
  HardwarePatchEntryV1,
  HardwarePatchV1,
} from './HardwarePatchV1';

// ─── Master Registry ──────────────────────────────────────────────────────────

import registryData from './MasterRegistry.json';
import type { ApplianceDefinitionV1 } from './ApplianceDefinitionV1';

/**
 * MASTER_REGISTRY
 *
 * The full flat list of known appliance definitions.
 * Indexed into by BoilerDatabase lookup helpers and BoilerSizingModule.
 *
 * This is the runtime equivalent of MasterRegistry.json — importing the JSON
 * directly ensures tree-shakers can drop it when not needed and avoids a
 * separate fetch.
 */
export const MASTER_REGISTRY: readonly ApplianceDefinitionV1[] =
  registryData as ApplianceDefinitionV1[];

/**
 * MASTER_REGISTRY_BY_ID
 *
 * Pre-built O(1) lookup map from modelId → ApplianceDefinitionV1.
 * Avoids repeated linear scans when resolving a specific model.
 */
export const MASTER_REGISTRY_BY_ID: ReadonlyMap<string, ApplianceDefinitionV1> = new Map(
  MASTER_REGISTRY.map((entry) => [entry.modelId, entry]),
);
