/**
 * systemRegistry.ts
 *
 * Canonical source of truth for all heating/DHW system options across the Atlas
 * recommendation engine, comparison panels, and simulator.
 *
 * This registry prevents taxonomy drift where the same system appears under
 * different IDs or labels in different parts of the application.
 *
 * Architecture decision: Mixergy is modelled as a modifier (isModifier: true)
 * on top of stored-water base systems — it is never a standalone system.
 * This is consistent with its use as a CylinderType in the simulator and as
 * dhwTankType in the engine input schema.
 *
 * Modifier model (Option B):
 *   Mixergy is never rendered alone. It is applied on top of a stored-water
 *   base system (stored_unvented, system_unvented, or stored_vented).
 *   Mixergy is a cylinder/storage technology variant — not a pressure
 *   architecture. It is selectable for both unvented (mains-fed) and open-vented
 *   (tank-fed) architectures. The simulator exposes Mixergy as a CylinderType
 *   choice within either architecture, not as a top-level system selector.
 *
 * Space-saving order (best → worst):
 *   combi → stored_unvented / system_unvented → stored_vented → regular_vented → ashp
 *
 *   Rationale:
 *   - combi: no cylinder at all — frees the airing cupboard entirely.
 *   - stored_unvented / system_unvented: mains-fed cylinder only; no cold-water
 *     storage tank in the loft.
 *   - stored_vented: open-vented cylinder plus a cold-water storage tank in the loft.
 *   - regular_vented: same as stored_vented plus a separate regular boiler body.
 *   - ashp: worst — large thermal store cylinder plus an outdoor unit footprint.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Stable registry identifier for each system or modifier.
 * These IDs MUST NOT be renamed after shipping — they are the bridge between
 * engine option IDs, simulator choice IDs, and comparison system type IDs.
 */
export type SystemRegistryId =
  | 'combi'
  | 'stored_vented'
  | 'stored_unvented'
  | 'regular_vented'
  | 'system_unvented'
  | 'ashp'
  | 'mixergy';

/** How the system delivers domestic hot water. */
export type DhwArchitecture = 'on_demand' | 'stored_dhw';

/** Broad category for space-footprint grouping. */
export type StorageCategory =
  | 'no_storage'
  | 'mains_fed_cylinder'
  | 'tank_fed_cylinder'
  | 'heat_pump_store'
  | 'modifier';

export interface SystemRecord {
  /** Stable registry ID — matches engineOptionId for non-modifier systems. */
  id: SystemRegistryId;
  /** Default customer-facing label. */
  label: string;
  /** DHW delivery architecture. */
  dhwArchitecture: DhwArchitecture;
  /** Storage category for space-ranking purposes. */
  storageCategory: StorageCategory;
  /**
   * True when this record describes a cylinder-level modifier, not a standalone
   * system architecture.  Modifier systems must always be combined with a base system.
   */
  isModifier: boolean;
  /**
   * For modifier records: the base system IDs this modifier can be applied to.
   * Empty array for non-modifier records.
   */
  baseSystemIds: SystemRegistryId[];
  /**
   * Corresponding OptionCardV1 id in the engine output.
   * Undefined for modifier records — they do not appear as standalone engine options.
   */
  engineOptionId?: string;
  /**
   * Corresponding SimulatorSystemChoice IDs.
   * A registry entry may map to multiple simulator choices.
   */
  simulatorChoiceIds: string[];
  /**
   * Corresponding ComparisonSystemType ID used in the Day Painter A/B comparison.
   * Undefined when the system has no direct comparison physics (e.g. regular_vented
   * or system_unvented use the stored_unvented physics model in the Day Painter).
   */
  comparisonSystemTypeId?: string;
}

// ─── Registry entries ─────────────────────────────────────────────────────────

const REGISTRY_ENTRIES: SystemRecord[] = [
  {
    id: 'combi',
    label: 'Combi boiler',
    dhwArchitecture: 'on_demand',
    storageCategory: 'no_storage',
    isModifier: false,
    baseSystemIds: [],
    engineOptionId: 'combi',
    simulatorChoiceIds: ['combi'],
    comparisonSystemTypeId: 'combi',
  },
  {
    id: 'stored_vented',
    label: 'Stored vented (tank-fed hot water)',
    dhwArchitecture: 'stored_dhw',
    storageCategory: 'tank_fed_cylinder',
    isModifier: false,
    baseSystemIds: [],
    engineOptionId: 'stored_vented',
    simulatorChoiceIds: ['open_vented'],
    comparisonSystemTypeId: 'stored_vented',
  },
  {
    id: 'stored_unvented',
    label: 'Stored unvented (mains-fed hot water)',
    dhwArchitecture: 'stored_dhw',
    storageCategory: 'mains_fed_cylinder',
    isModifier: false,
    baseSystemIds: [],
    engineOptionId: 'stored_unvented',
    simulatorChoiceIds: ['unvented'],
    comparisonSystemTypeId: 'stored_unvented',
  },
  {
    id: 'regular_vented',
    label: 'Regular boiler with tank-fed hot water',
    dhwArchitecture: 'stored_dhw',
    storageCategory: 'tank_fed_cylinder',
    isModifier: false,
    baseSystemIds: [],
    engineOptionId: 'regular_vented',
    // Regular vented uses the open_vented simulator choice (shares topology)
    simulatorChoiceIds: ['open_vented'],
    // No dedicated comparison system type — uses stored_vented physics in Day Painter
    comparisonSystemTypeId: undefined,
  },
  {
    id: 'system_unvented',
    label: 'System boiler with unvented cylinder',
    dhwArchitecture: 'stored_dhw',
    storageCategory: 'mains_fed_cylinder',
    isModifier: false,
    baseSystemIds: [],
    engineOptionId: 'system_unvented',
    // System unvented uses the unvented simulator choice (shares topology)
    simulatorChoiceIds: ['unvented'],
    // No dedicated comparison system type — uses stored_unvented physics in Day Painter
    comparisonSystemTypeId: undefined,
  },
  {
    id: 'ashp',
    label: 'Air source heat pump',
    dhwArchitecture: 'stored_dhw',
    storageCategory: 'heat_pump_store',
    isModifier: false,
    baseSystemIds: [],
    engineOptionId: 'ashp',
    simulatorChoiceIds: ['heat_pump'],
    comparisonSystemTypeId: 'ashp',
  },
  {
    id: 'mixergy',
    label: 'Mixergy smart cylinder',
    dhwArchitecture: 'stored_dhw',
    storageCategory: 'modifier',
    isModifier: true,
    // Mixergy can be paired with any stored-water base system.
    baseSystemIds: ['stored_unvented', 'system_unvented', 'stored_vented'],
    // Modifier — does not appear as a standalone engine option.
    engineOptionId: undefined,
    // Mixergy is a CylinderType choice within the unvented or open_vented simulator
    // system choice — it is no longer exposed as a standalone top-level selector.
    simulatorChoiceIds: ['mixergy'],
    // Mixergy has its own comparison system type in the Day Painter (mains-fed variant).
    // The tank-fed variant is represented by 'mixergy_open_vented'.
    comparisonSystemTypeId: 'mixergy',
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Map of all system records keyed by SystemRegistryId for O(1) lookup.
 */
export const SYSTEM_REGISTRY: ReadonlyMap<SystemRegistryId, SystemRecord> = new Map(
  REGISTRY_ENTRIES.map(r => [r.id, r]),
);

/**
 * All non-modifier system records in canonical order.
 * These correspond to EngineOutputV1 OptionCardV1 IDs.
 */
export const STANDALONE_SYSTEMS: readonly SystemRecord[] = REGISTRY_ENTRIES.filter(
  r => !r.isModifier,
);

/**
 * All modifier records (cylinder enhancements — not standalone systems).
 */
export const MODIFIER_SYSTEMS: readonly SystemRecord[] = REGISTRY_ENTRIES.filter(
  r => r.isModifier,
);

/**
 * IDs of systems that use stored DHW architecture (cylinder present).
 * Useful for filtering options that benefit from Mixergy or cylinder upgrades.
 */
export const STORED_DHW_SYSTEM_IDS: readonly SystemRegistryId[] = REGISTRY_ENTRIES
  .filter(r => r.dhwArchitecture === 'stored_dhw' && !r.isModifier)
  .map(r => r.id);

/**
 * IDs of base systems that the Mixergy modifier can be applied to.
 */
export const MIXERGY_COMPATIBLE_BASE_IDS: readonly SystemRegistryId[] =
  (SYSTEM_REGISTRY.get('mixergy')?.baseSystemIds ?? []) as SystemRegistryId[];

/**
 * The engine option IDs that map to mains-fed (unvented) cylinder storage.
 * These are the base systems where Mixergy delivers demand mirroring and
 * reduced cycling penalties.
 */
export const MAINS_FED_CYLINDER_SYSTEM_IDS: readonly string[] = REGISTRY_ENTRIES
  .filter(r => r.storageCategory === 'mains_fed_cylinder')
  .map(r => r.engineOptionId)
  .filter((id): id is string => id !== undefined);
