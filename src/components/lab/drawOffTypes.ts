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
}

// ─── Cylinder / hot-water source ─────────────────────────────────────────────

/**
 * Hot-water storage regime — determines which source-state fields are
 * meaningful and how the right-hand panel is labelled.
 *
 * boiler_cylinder   — stored hot water from boiler-heated cylinder.
 * heat_pump_cylinder — stored hot water from heat-pump-heated cylinder.
 * on_demand_combi — on-demand hot water; no cylinder storage.
 */
export type StorageRegime =
  | 'boiler_cylinder'
  | 'heat_pump_cylinder'
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
