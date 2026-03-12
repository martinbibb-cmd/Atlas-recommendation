/**
 * View-model types for the Draw-Off Workbench.
 *
 * These are presentation-layer contracts only.  The engine and simulator
 * own the physics; these shapes exist solely to drive DrawOffCard and
 * CylinderStatusCard without coupling them to simulator internals.
 */

// ─── Draw-off outlet ──────────────────────────────────────────────────────────

/**
 * Describes the current service state of one outlet.
 *
 * stable       — temperature and flow both within expected range.
 * flow_limited — delivered flow is capped (combi throughput or pipe limit).
 * temp_limited — delivered temperature is below target (low store or high
 *                blending ratio).
 * starved      — hot supply has fallen to a level where useful service is
 *                impossible (store depleted or combi overloaded).
 */
export type DrawOffStatus = 'stable' | 'flow_limited' | 'temp_limited' | 'starved'

/**
 * Combi boiler firing state derived from flow/pressure thresholds.
 *
 * firing          — flow sustained above ignition threshold; burner stable.
 * marginal        — flow near minimum sustained operation threshold; burner
 *                   operation may be intermittent or unstable.
 * fails_to_fire   — flow below minimum ignition threshold; burner cannot
 *                   ignite or maintain operation.
 *
 * Only applicable when the system regime is 'combi'.  Undefined for stored
 * hot-water systems.
 */
export type BoilerState = 'firing' | 'marginal' | 'fails_to_fire'

export interface DrawOffViewModel {
  /** Unique identifier for this outlet. */
  id: string
  /** Human-readable outlet name shown in the card header. */
  label: string
  /** Emoji / short character icon shown alongside the label. */
  icon: string
  /** Current service status — drives the status chip colour. */
  status: DrawOffStatus
  /** Incoming cold supply temperature (°C). */
  coldSupplyTempC: number
  /** Incoming cold supply flow available (L/min). */
  coldSupplyFlowLpm: number
  /** Hot supply temperature reaching the mixing point (°C). */
  hotSupplyTempC: number
  /** Hot supply maximum available flow at mixing point (L/min). */
  hotSupplyAvailableFlowLpm: number
  /** Blended delivered temperature at outlet (°C). */
  deliveredTempC: number
  /** Actual mixed flow reaching the outlet (L/min). */
  deliveredFlowLpm: number
  /** One-line behavioural note explaining why this result is happening. */
  note: string
  /**
   * Short description of the primary constraint limiting this outlet's
   * performance.  Shown in the Focus inspection view.  Optional — not all
   * contexts that build a DrawOffViewModel need to compute a limiting factor.
   */
  limitingFactor?: string
  /**
   * Combi boiler firing state for this draw-off point.  Derived from
   * hot-supply available flow relative to known ignition thresholds.
   * Only set for combi regimes; undefined for stored hot-water systems.
   */
  boilerState?: BoilerState
}

// ─── Cylinder / hot-water source ─────────────────────────────────────────────

/**
 * Hot-water storage regime — determines which source-state fields are
 * meaningful and how the right-hand panel is labelled.
 *
 * boiler_cylinder    — stored hot water from boiler-heated cylinder.
 * heat_pump_cylinder — stored hot water from heat-pump-heated cylinder.
 * mixergy_cylinder   — stratified mains-fed cylinder (Mixergy); usable reserve
 *                      modelled with demand mirroring and reduced cycling.
 * on_demand_combi    — on-demand hot water; no cylinder storage.
 */
export type StorageRegime =
  | 'boiler_cylinder'
  | 'heat_pump_cylinder'
  | 'mixergy_cylinder'
  | 'on_demand_combi'

/**
 * Current operational state of the hot-water source.
 *
 * idle       — no draw-off; source not actively heating.
 * charging   — source actively heating the cylinder from cold / reheat.
 * recovering — source adding heat during or immediately after a draw-off.
 * depleted   — usable stored volume has fallen below the service threshold.
 */
export type CylinderState = 'idle' | 'charging' | 'recovering' | 'depleted'

export interface CylinderStatusViewModel {
  /** Which type of hot-water source is in use. */
  storageRegime: StorageRegime
  /**
   * Temperature at the top of the cylinder — closest to delivery temperature
   * (°C).  Undefined for combi (no cylinder).
   */
  topTempC?: number
  /**
   * Bulk / mid-cylinder temperature — represents the average stored-heat
   * level (°C).  Undefined for combi.
   */
  bulkTempC?: number
  /** Cylinder nominal volume in litres.  Undefined for combi. */
  nominalVolumeL?: number
  /**
   * Fraction of nominal volume currently usable at delivery temperature
   * (0–1).  Undefined for combi.
   */
  usableVolumeFactor?: number
  /**
   * Volume of the actively heated layer in litres.  Specific to
   * mixergy_cylinder; undefined for all other regimes.
   */
  heatedVolumeL?: number
  /**
   * Fraction of the nominal volume currently heated (0–100).  Specific to
   * mixergy_cylinder; undefined for all other regimes.
   */
  heatedFractionPct?: number
  /**
   * Recovery source label shown under "Recovery source".
   * e.g. "Boiler", "Heat pump", "None (on-demand)"
   */
  recoverySource: string
  /**
   * Tendency label shown under "Recovery power tendency".
   * e.g. "High — rapid recovery", "Moderate — lagging under peak demand"
   */
  recoveryPowerTendency: string
  /** Current store / appliance state. */
  state: CylinderState
  /** One-line note explaining current recovery / recharge behaviour. */
  recoveryNote: string
  /** One-line note explaining draw-off impact on the store. */
  storeNote: string
}
