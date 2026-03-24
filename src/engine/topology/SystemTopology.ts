/**
 * SystemTopology.ts  — PR1: Introduce topology contracts (no behaviour change)
 *
 * Defines the explicit data contracts for the physical relationships between
 * components of a domestic heating system.  The types here make previously
 * implicit architectural rules explicit and statically checkable:
 *
 *   - Only a combi appliance can serve hot water directly at the draw-off point.
 *   - Regular / system boilers and heat pumps can only charge storage for DHW.
 *   - Emitters (radiators, underfloor) are CH-only consumers — they are not
 *     DHW sources.
 *   - Cylinders and buffers are thermal loads that receive heat from an
 *     appliance — they are never heat sources.
 *
 * This module is intentionally a pure scaffolding layer.  It introduces no new
 * physics logic and changes no existing behaviour.  It is the foundation that
 * subsequent PRs (PR2–PR12) will build upon when replacing the flat
 * runEngine() orchestration with topology-aware runners.
 *
 * Usage:
 *   import { buildSystemTopologyFromSpec } from './SystemTopology';
 *   const topology = buildSystemTopologyFromSpec(heatSourceBehaviourInput);
 *   assertTopologyConsistency(topology); // throws on illegal crossover
 */

import type { HeatSourceBehaviourInput } from '../modules/HeatSourceBehaviourModel';

// ─── Appliance model ──────────────────────────────────────────────────────────

/**
 * Broad family of the primary heat-generating appliance in the system.
 *
 * The family determines which DHW service path is available and whether
 * the appliance can charge storage, serve draw-offs directly, or both.
 */
export type ApplianceFamily =
  | 'combi'        // on-demand DHW + CH in one appliance
  | 'regular'      // traditional open-vented boiler feeding a cylinder
  | 'system'       // sealed-system boiler feeding a cylinder
  | 'heat_pump'    // air- or ground-source heat pump feeding a cylinder
  | 'open_vented'; // legacy vented system (tank-fed hot water)

/**
 * A combi appliance.
 *
 * A combi is the only appliance family that may expose a direct draw-off
 * service.  The `directDrawOffService: true` field is a structural guarantee
 * — it cannot be set on any other appliance type.
 */
export interface CombiApplianceModel {
  readonly family: 'combi';
  /** Combi boilers serve hot water directly at the outlet — no cylinder required. */
  readonly directDrawOffService: true;
  /** Peak rated output in kW (nameplate / design value). */
  readonly nominalOutputKw: number;
  /** Whether the appliance is a condensing unit. */
  readonly condensing: boolean;
  /** Maximum DHW flow rate at the rated heat output (L/min). */
  readonly maxDhwLpm: number;
}

/**
 * A hydronic appliance (regular, system, heat pump, open-vented).
 *
 * These appliances deliver heat into the primary hydronic circuit — either
 * charging a storage cylinder/buffer for DHW or driving emitters for CH.
 * They never serve a draw-off point directly; that role belongs exclusively
 * to combi appliances.  The `directDrawOffService: false` literal makes this
 * constraint statically enforceable — any code path that attempts to route a
 * draw-off through one of these appliance types will fail at the type level.
 *
 * The name "hydronic" is intentional: regular boilers, system boilers, and
 * heat pumps are all primarily "heat into hydronic circuit" devices.  Calling
 * them "storage charging" would be too DHW-specific and would not accommodate
 * buffer-only or heating-only configurations in future topology variants.
 */
export interface HydronicApplianceModel {
  readonly family: Exclude<ApplianceFamily, 'combi'>;
  /** Hydronic appliances cannot serve draw-offs directly. */
  readonly directDrawOffService: false;
  /** Peak rated output in kW (nameplate / design value). */
  readonly nominalOutputKw: number;
  /** Whether the appliance is a condensing unit. */
  readonly condensing: boolean;
}

/**
 * Discriminated union of all appliance types.
 *
 * Use the `family` field (or `directDrawOffService`) to narrow to the
 * specific appliance variant:
 *
 *   if (appliance.family === 'combi') { // CombiApplianceModel }
 *   if (!appliance.directDrawOffService) { // HydronicApplianceModel }
 */
export type ApplianceModel = CombiApplianceModel | HydronicApplianceModel;

// ─── Emitter model ────────────────────────────────────────────────────────────

/**
 * Physical type of heat emitter installed in the property.
 */
export type EmitterKind =
  | 'radiator'    // panel or column radiator (typical UK)
  | 'underfloor'  // wet underfloor heating
  | 'fan_coil';   // fan-assisted heat emitter

/**
 * A heating emitter — a consumer of space-heating energy only.
 *
 * Emitters are always CH-only: they receive heat from the primary circuit and
 * deliver it to the space.  They play no role in the DHW circuit.
 *
 * The `purpose: 'ch_only'` literal enforces this at the type level and
 * prevents emitters from appearing on the DHW service path in future code.
 */
export interface EmitterModel {
  readonly kind: EmitterKind;
  /** Emitters are exclusively central-heating consumers — never DHW sources. */
  readonly purpose: 'ch_only';
  /**
   * Minimum flow temperature required to reach design output (°C).
   * Radiators typically need 55–80 °C; underfloor 35–45 °C.
   */
  readonly designFlowTempC: number;
  /** Number of emitter circuits or panels of this kind. */
  readonly count: number;
}

// ─── Storage load model ───────────────────────────────────────────────────────

/**
 * Physical type of thermal storage vessel in the system.
 */
export type StorageKind =
  | 'cylinder_vented'    // open-vented (tank-fed) hot-water cylinder
  | 'cylinder_unvented'  // mains-pressure (sealed) hot-water cylinder
  | 'buffer'             // buffer vessel (no domestic draw-off)
  | 'mixergy';           // Mixergy smart stratified cylinder

/**
 * A thermal storage vessel — always a load (receives heat), never a source.
 *
 * The `role: 'load'` literal enforces the rule that cylinders and buffers are
 * passive thermal stores.  They cannot be treated as heat sources for CH or
 * any other purpose.
 */
export interface StorageLoadModel {
  readonly kind: StorageKind;
  /**
   * Explicit role declaration: storage vessels receive heat from the
   * appliance — they do not generate or supply primary-circuit heat.
   */
  readonly role: 'load';
  /** Nominal vessel volume (litres). */
  readonly volumeLitres: number;
  /**
   * Rated primary-coil heat input from the appliance (kW).
   * Absent for direct-immersion or heat-pump-integrated cylinders where
   * the rating is captured in the appliance model.
   */
  readonly primaryCoilKw?: number;
}

// ─── Draw-off model ───────────────────────────────────────────────────────────

/**
 * How domestic hot water is delivered to the outlet (tap, shower, bath).
 *
 *   'combi_direct'  — appliance heats the water on demand; no storage involved.
 *   'store_delivery'— hot water is drawn from a pre-charged storage vessel.
 */
export type DrawOffSource = 'combi_direct' | 'store_delivery';

/**
 * The hot-water delivery path to the draw-off point.
 *
 * This model makes the DHW service topology explicit: either the water is
 * generated on demand by a combi, or it is drawn from a charged store.
 * Subsequent modules use this to enforce the correct physics path.
 */
export interface DrawOffModel {
  /** Service path — determines which module handles the draw. */
  readonly source: DrawOffSource;
  /**
   * Maximum flow rate available at the draw-off point (L/min).
   * For combi_direct: constrained by appliance output and mains pressure.
   * For store_delivery: constrained by cylinder connection and mains pressure.
   */
  readonly maxFlowLpm: number;
}

// ─── System topology ──────────────────────────────────────────────────────────

/**
 * The complete topology contract for a domestic heating and hot-water system.
 *
 * `SystemTopology` is the single source of truth for how the major components
 * relate to each other.  All runner modules (PR2 onwards) must accept a
 * `SystemTopology` and respect its hard rules rather than inferring topology
 * from loose flags on a shared input bag.
 *
 * Hard rules (enforced by `assertTopologyConsistency`):
 *   1. Only a combi appliance may carry `drawOff.source === 'combi_direct'`.
 *   2. Non-combi Atlas DHW topologies must include a DHW storage load.
 *   3. Storage vessels must declare `role === 'load'` (never a heat source).
 *   4. All emitters must declare `purpose === 'ch_only'`.
 */
export interface SystemTopology {
  /** The primary heat-generating appliance. */
  readonly appliance: ApplianceModel;
  /** Space-heating emitters installed in the property (may be empty). */
  readonly emitters: readonly EmitterModel[];
  /**
   * Thermal storage vessel, if present.
   * Required for all non-combi systems.
   * Must be absent (or omitted) for pure combi systems with no buffer.
   */
  readonly storage?: StorageLoadModel;
  /**
   * How domestic hot water reaches the draw-off point.
   *
   * Present only when the appliance can serve draw-off fixtures directly
   * (i.e. combi systems).  For hydronic appliances (regular, system, heat pump,
   * open-vented), the delivery chain is appliance → storage → fixture: the
   * appliance is not topologically connected to the draw-off point, so this
   * field is absent.  Delivery fixtures still exist in the building; they are
   * just not an appliance-topology concern for non-combi systems.
   */
  readonly drawOff?: DrawOffModel;
}

// ─── Consistency assertion ────────────────────────────────────────────────────

/**
 * Asserts that `topology` obeys all hard topology rules.
 *
 * Throws a descriptive `Error` on the first violation found.  Call this after
 * constructing a `SystemTopology` from survey data or adapter functions to
 * catch illegal crossover early in the pipeline.
 *
 * Rules enforced:
 *   1. `combi_direct` draw-off is only permitted when `appliance.family === 'combi'`.
 *   2. Non-combi Atlas DHW topologies must include a DHW storage load.
 *   3. Storage role must always be `'load'` (compile-time + runtime guard).
 *   4. Every emitter must declare `purpose === 'ch_only'`.
 */
export function assertTopologyConsistency(topology: SystemTopology): void {
  const { appliance, emitters, storage, drawOff } = topology;

  // Rule 1: only combi can serve direct draw-off
  if (drawOff !== undefined && drawOff.source === 'combi_direct' && appliance.family !== 'combi') {
    throw new Error(
      `Topology violation: draw-off source is 'combi_direct' but appliance family is '${appliance.family}'. ` +
        `Only a combi appliance may serve draw-offs directly.`
    );
  }

  // Rule 2: non-combi appliances must have associated storage for DHW
  if (appliance.family !== 'combi' && storage === undefined) {
    throw new Error(
      `Topology violation: non-combi Atlas recommendation topologies must include a DHW storage load. ` +
        `Appliance family '${appliance.family}' charges storage — it does not serve draw-offs directly.`
    );
  }

  // Rule 3: storage role must be 'load' (defence-in-depth against future mutations)
  if (storage !== undefined && storage.role !== 'load') {
    throw new Error(
      `Topology violation: storage vessel role must be 'load'; got '${(storage as StorageLoadModel).role}'. ` +
        `Cylinders and buffers are thermal loads — they do not generate heat.`
    );
  }

  // Rule 4: emitters must be CH-only consumers
  for (const emitter of emitters) {
    if (emitter.purpose !== 'ch_only') {
      throw new Error(
        `Topology violation: emitter of kind '${emitter.kind}' has purpose '${(emitter as EmitterModel).purpose}'. ` +
          `Emitters must be CH-only consumers — they are not part of the DHW circuit.`
      );
    }
  }
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

/**
 * Builds a `SystemTopology` from the minimal `HeatSourceBehaviourInput` used
 * by the existing engine modules.
 *
 * This adapter is the bridge between the current "bag of flags" inputs and the
 * new topology contracts.  It does not change any physics logic; it merely
 * surfaces the implicit topology as an explicit, validated structure.
 *
 * Defaults applied when optional survey fields are absent:
 *   - `nominalOutputKw`  → 24 kW (typical combi) / 18 kW (stored / HP)
 *   - `condensing`       → true (assumed for modern UK installs)
 *   - `maxDhwLpm`        → derived from peakHotWaterCapacityLpm or 10 L/min
 *   - `primaryCoilKw`    → 15 kW (typical boiler coil)
 *   - emitter            → single radiator circuit at 70 °C design flow temp
 *   - `maxFlowLpm`       → from peakHotWaterCapacityLpm or storage→10 L/min
 */
export function buildSystemTopologyFromSpec(
  spec: HeatSourceBehaviourInput
): SystemTopology {
  const isCombi = spec.systemType === 'combi';

  // ── Appliance ──────────────────────────────────────────────────────────────
  const appliance: ApplianceModel = isCombi
    ? ({
        family: 'combi',
        directDrawOffService: true,
        nominalOutputKw: 24,
        condensing: true,
        maxDhwLpm: spec.peakHotWaterCapacityLpm ?? 10,
      } satisfies CombiApplianceModel)
    : ({
        family:
          spec.systemType === 'heat_pump'
            ? 'heat_pump'
            : spec.systemType === 'open_vented'
            ? 'open_vented'
            : 'system', // stored_water → system boiler (most common UK case)
        directDrawOffService: false,
        nominalOutputKw: spec.systemType === 'heat_pump' ? 10 : 18,
        condensing: spec.systemType !== 'open_vented',
      } satisfies HydronicApplianceModel);

  // ── Emitters ───────────────────────────────────────────────────────────────
  // The existing input schema does not capture emitter detail at this
  // abstraction level.  Provide a conservative default (single radiator circuit
  // at high flow-temperature design) so topology can be constructed.  Callers
  // with richer survey data should pass an explicit emitter list.
  const emitters: EmitterModel[] = [
    {
      kind: 'radiator',
      purpose: 'ch_only',
      designFlowTempC: spec.systemType === 'heat_pump' ? 45 : 70,
      count: 1,
    },
  ];

  // ── Storage ────────────────────────────────────────────────────────────────
  let storage: StorageLoadModel | undefined;
  if (!isCombi && spec.hotWaterStorageLitres !== undefined) {
    const kind: StorageKind =
      spec.systemType === 'open_vented'
        ? 'cylinder_vented'
        : 'cylinder_unvented';
    storage = {
      kind,
      role: 'load',
      volumeLitres: spec.hotWaterStorageLitres,
      primaryCoilKw: spec.systemType === 'heat_pump' ? undefined : 15,
    };
  } else if (!isCombi) {
    // Non-combi without explicit volume — create a placeholder so topology
    // can still be validated.  Volume 0 signals "unknown" to callers.
    storage = {
      kind: spec.systemType === 'open_vented' ? 'cylinder_vented' : 'cylinder_unvented',
      role: 'load',
      volumeLitres: 0,
    };
  }

  // ── Draw-off ───────────────────────────────────────────────────────────────
  // Only combi appliances can serve draw-off points directly.  For hydronic
  // systems (regular, system, heat pump, open-vented) the delivery chain is
  // appliance → storage → fixture; the appliance is not topologically
  // connected to the draw-off outlet, so this field is intentionally absent.
  const drawOff: DrawOffModel | undefined = isCombi
    ? {
        source: 'combi_direct',
        maxFlowLpm: spec.peakHotWaterCapacityLpm ?? 10,
      }
    : undefined;

  const topology: SystemTopology = { appliance, emitters, storage, ...(drawOff !== undefined ? { drawOff } : {}) };

  // Validate hard rules before returning — fail fast if data is inconsistent.
  assertTopologyConsistency(topology);

  return topology;
}
