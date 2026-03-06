// src/explainers/lego/animation/types.ts

import type { CylinderStore } from './storage'

export type OutletId = 'A' | 'B' | 'C'
export type OutletKind = 'shower_mixer' | 'basin' | 'bath' | 'cold_tap'
export type HeatSourceType = 'combi' | 'system_boiler' | 'regular_boiler' | 'heat_pump'
export type SystemMode = 'idle' | 'heating' | 'dhw_draw' | 'dhw_reheat'

/**
 * Simulation domain — distinguishes how energy or fluid is moving.
 *
 * Used to animate correctly:
 *  - fluid_path: water physically moving through pipes
 *  - heat_transfer: energy crossing the cylinder coil (glow/pulse visual)
 *  - storage_state: stored energy changing inside a cylinder (fill level / stratification)
 */
export type SimulationDomain = 'fluid_path' | 'heat_transfer' | 'storage_state'

/**
 * A named hydraulic path through the system — water physically moving in pipes.
 *
 * `edgeIds` reference the logical pipe segments that form this path.
 * Semantic IDs are used here (e.g. 'primary_circuit', 'dhw_draw', 'cold_feed',
 * 'cylinder_coil_primary') because the visual schematic does not yet expose
 * formal builder graph edge IDs.
 */
export type FluidPathVisual = {
  /** Logical identifiers for the pipe segments forming this path. */
  edgeIds: string[]
  /** Direction water flows along this path. */
  direction: 'forward' | 'reverse'
  /** Whether this path is actively carrying flow right now. */
  active: boolean
  /** Approximate flow rate through this path (L/min). */
  flowLpm?: number
}

/**
 * The type of heat-exchange component doing the energy transfer.
 * This deliberately distinguishes the heat source from the transfer site.
 */
export type HeatTransferKind =
  | 'burner'        // gas/oil burner inside a boiler
  | 'plate_hex'     // plate heat exchanger (combi DHW transfer)
  | 'coil'          // immersion coil inside a cylinder
  | 'emitter'       // radiator or underfloor emitting heat into a room
  | 'compressor'    // heat pump compressor (refrigerant circuit)

/**
 * A component that is actively transferring heat (not fluid flow).
 * The visual style is a glow or pulse localised to the component.
 */
export type HeatTransferVisual = {
  /** Semantic node identifier for the component (e.g. 'boiler_burner', 'combi_hex', 'cylinder_coil'). */
  nodeId: string
  /** Whether this component is actively transferring heat right now. */
  active: boolean
  /** Normalised intensity 0–1 (used for animation brightness). */
  intensity?: number
  /** What kind of heat exchange this component performs. */
  kind: HeatTransferKind
}

/**
 * The thermal state of a storage vessel (cylinder, buffer, etc.).
 * The visual style is a fill level or gradient inside the vessel body.
 */
export type StorageStateVisual = {
  /** Semantic node identifier for the vessel (e.g. 'cylinder'). */
  nodeId: string
  /** Whether this vessel is currently tracked by the simulation. */
  active: boolean
  /**
   * Fractional charge 0–1 (0 = cold inlet temp, 1 = 80 °C — conventional upper
   * working temperature used as the reference maximum for cylinder fill displays).
   * Used to drive the fill-level indicator inside the vessel.
   */
  chargePct?: number
  /**
   * Fraction of the vessel volume that is "usably hot" (above usable threshold).
   * For future Mixergy stratification rendering (top-down hot band).
   */
  hotTopPct?: number
}

/**
 * Complete set of visual outputs emitted by `stepSimulation()` for each frame.
 *
 * Renderers must consume these three arrays separately so that:
 *  - moving fluid dots only appear on `fluidPaths`
 *  - glow/pulse effects only appear at `heatTransfers`
 *  - fill/gradient changes only appear on `storageStates`
 *
 * This prevents the visual confusion of implying that domestic hot water
 * travels through a boiler coil, or that stored hot water is the same
 * circuit as the primary water.
 */
export type SimulationVisuals = {
  /** Active hydraulic paths — water moving through pipes. */
  fluidPaths: FluidPathVisual[]
  /** Active heat-transfer sites — energy moving across components. */
  heatTransfers: HeatTransferVisual[]
  /** Current thermal state of storage vessels. */
  storageStates: StorageStateVisual[]
}

/**
 * Heating demand state — controls the space-heating part of Play mode.
 *
 * For MVP, `enabled` is sufficient to gate CH simulation.
 * `targetFlowTempC` and `demandLevel` allow richer future scenarios.
 */
export type HeatingDemandState = {
  /** Whether the central-heating demand is active. */
  enabled: boolean
  /** Target flow temperature to emitters (°C). Defaults to 70 °C for standard radiators. */
  targetFlowTempC?: number
  /**
   * Simple 0–1 scalar representing emitter demand (heat loss proxy).
   * 0 = no heating required, 1 = maximum heating demand.
   */
  demandLevel?: number
  /** Active zone IDs for multi-zone systems. */
  activeZones?: string[]
}

export type OutletControl = {
  id: OutletId
  enabled: boolean
  kind: OutletKind
  demandLpm: number
  /**
   * Whether a thermostatic mixer valve (TMV) is installed on this outlet.
   * Only meaningful for `shower_mixer` outlets.
   * Defaults to `true` for shower_mixer in `defaultOutlets()`.
   */
  tmvEnabled?: boolean
  /**
   * Target shower delivery temperature when TMV is installed (°C).
   * The TMV blends hot and cold supplies to reach this temperature.
   * Defaults to 40 °C.
   */
  tmvTargetTempC?: number
  /** Builder graph node ID for topology-derived hot/cold path semantics. */
  builderNodeId?: string
}

/** Default outlet configuration: A (shower, enabled, TMV on), B (basin), C (bath). */
export function defaultOutlets(): OutletControl[] {
  return [
    { id: 'A', enabled: true,  kind: 'shower_mixer', demandLpm: 10, tmvEnabled: true,  tmvTargetTempC: 40 },
    { id: 'B', enabled: false, kind: 'basin',        demandLpm: 5 },
    { id: 'C', enabled: false, kind: 'bath',         demandLpm: 18 },
  ]
}

/**
 * Which path segment a flow particle is currently travelling.
 * COLD_A: cold supply bypass to outlet A's thermostatic mixer valve (bypasses HEX).
 */
export type LabRoute = 'MAIN' | 'A' | 'B' | 'C' | 'COLD_A'

export type FlowParticle = {
  id: string
  // 0..1 along the current route's polyline
  s: number
  // flow/velocity proxy
  v: number
  // pressure proxy (size)
  p: number
  // heat content above cold baseline (proxy, use J/kg style units)
  hJPerKg: number
  // which polyline this particle is currently on
  route: LabRoute
  /**
   * Outlet pre-assigned at spawn time so the draw junction upstream of the
   * boiler already "knows" where this packet of water is destined.
   * Particles without a pre-assignment (e.g. manually created in tests) fall
   * back to the hash-based deterministic roulette at the split point.
   */
  assignedOutlet?: OutletId
  /**
   * Simulation domain tag — describes what this particle represents physically.
   * Defaults to 'fluid_path' when not set.
   */
  domain?: SimulationDomain
}

/** Distinguishes combi (on-demand) from stored hot water systems. */
export type SystemType = 'combi' | 'unvented_cylinder' | 'vented_cylinder'

export type CylinderControls = {
  volumeL: number       // e.g. 150 / 180 / 210
  initialTempC: number  // e.g. 55
  reheatKw: number      // boiler/coil power into the store, e.g. 12
}

export type VentedControls = {
  headMeters: number    // e.g. 3
}

export type LabControls = {
  systemType: SystemType
  heatSourceType?: HeatSourceType

  coldInletC: 5 | 10 | 15
  dhwSetpointC: number        // default 50

  // supply + distribution
  mainsDynamicFlowLpm: number // e.g. 6..25
  pipeDiameterMm: 15 | 22     // v1

  // combi-only
  combiDhwKw: number          // e.g. 24..40

  // cylinder-only
  cylinder?: CylinderControls
  vented?: VentedControls

  outlets: OutletControl[]    // A/B/C per-outlet demand configuration
  graphFacts?: {
    hotFedOutletNodeIds: string[]
    coldOnlyOutletNodeIds: string[]
    hasStoredDhw?: boolean
  }
  heatDemandKw?: number
  /**
   * Structured heating demand state.  When present, takes precedence over the
   * legacy scalar `heatDemandKw`.  Play mode UI populates this field.
   */
  heatingDemand?: HeatingDemandState
  dhwReheatHysteresisC?: number
  dhwReheatTargetC?: number
  outletBindings?: Partial<Record<'A' | 'B' | 'C', string>>
}

/** Rolling EMA temperature sample collected from tokens exiting an outlet branch. */
export type OutletSample = { tempC: number; count: number }

export type LabFrame = {
  nowMs: number
  particles: FlowParticle[]
  /** Fractional spawn carry-over (deterministic, avoids Math.random). */
  spawnAccumulator: number
  /** Monotonically increasing counter for unique particle IDs. */
  nextTokenId: number
  /** Per-outlet temperature samples (EMA from particles exiting each branch). */
  outletSamples: Record<OutletId, OutletSample>
  /** Cylinder thermal store state (only present for cylinder system types). */
  cylinderStore?: CylinderStore
  systemMode?: SystemMode
  storeNeedsReheat?: boolean
  /**
   * Structured visual domains emitted by the simulation each frame.
   *
   * Consumers must use each array for its dedicated visual purpose:
   * - `fluidPaths`   → moving-dot / flow-line animation (water in pipes)
   * - `heatTransfers` → glow / pulse at components (energy transfer sites)
   * - `storageStates` → fill / gradient inside vessels (stored thermal state)
   *
   * This separation prevents misleading visuals such as domestic water
   * appearing to travel through the primary circuit.
   */
  visuals?: SimulationVisuals
}
