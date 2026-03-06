/**
 * types — composable system concept model for the Atlas lab.
 *
 * A heating system is represented as four composable layers:
 *   1. Heat source        — what adds heat to the primary circuit
 *   2. Hot water service  — how DHW is delivered
 *   3. Controls topology  — how primary heat is directed
 *   4. Emitters           — where space heat goes
 *
 * Appliance traits sit separately, encoding what is physically integrated
 * into the appliance body (pump, expansion vessel, plate HEX, automatic
 * bypass valve).
 *
 * Key design rule
 * ───────────────
 * A combi boiler is NOT a separate heat-source kind.
 * It is modelled as:
 *   heatSource:       'system_boiler'
 *   hotWaterService:  'combi_plate_hex'
 *   traits.integratedPlateHex: true
 *
 * This replaces the earlier monolithic "combi / system / regular" taxonomy
 * with a composable set of concepts that more accurately mirrors the physics.
 */

// ─── Layer 1: Heat source ─────────────────────────────────────────────────────

/**
 * HeatSourceKind — what adds heat to the primary circuit.
 *
 *  regular_boiler  — open-vented or gravity-fed; no integrated pump or expansion
 *  system_boiler   — sealed circuit; integrated pump + expansion vessel
 *  heat_pump       — vapour-compression heat pump on the primary circuit
 */
export type HeatSourceKind =
  | 'regular_boiler'
  | 'system_boiler'
  | 'heat_pump';

// ─── Layer 2: Hot water service ───────────────────────────────────────────────

/**
 * HotWaterServiceKind — how DHW is delivered to the taps.
 *
 *  none              — no DHW service (heating-only system)
 *  combi_plate_hex   — on-demand mains-fed supply via integrated plate HEX
 *  vented_cylinder   — indirect cylinder fed from a cold-water storage cistern (tank-fed)
 *  unvented_cylinder — indirect cylinder fed directly from the mains (mains-fed)
 *  mixergy           — stratified Mixergy cylinder (mains-fed, bottom-up heating)
 */
export type HotWaterServiceKind =
  | 'none'
  | 'combi_plate_hex'
  | 'vented_cylinder'
  | 'unvented_cylinder'
  | 'mixergy';

// ─── Layer 3: Controls topology ───────────────────────────────────────────────

/**
 * ControlTopologyKind — how the primary circuit is routed and controlled.
 *
 *  none              — no zone-control arrangement (e.g. combi CH-only)
 *  y_plan            — 3-port mid-position valve; one shared primary circuit
 *  s_plan            — 2 × 2-port zone valves; separate CH zone + cylinder zone
 *  s_plan_multi_zone — S-plan with additional CH zones
 *  hp_diverter       — heat pump low-loss header / buffer diverter arrangement
 */
export type ControlTopologyKind =
  | 'none'
  | 'y_plan'
  | 's_plan'
  | 's_plan_multi_zone'
  | 'hp_diverter';

// ─── Layer 4: Emitters ────────────────────────────────────────────────────────

/**
 * EmitterKind — where space heat is delivered.
 *
 *  radiators — conventional panel radiators
 *  ufh       — underfloor heating
 *  mixed     — a combination of radiators and UFH
 */
export type EmitterKind =
  | 'radiators'
  | 'ufh'
  | 'mixed';

// ─── Appliance traits ─────────────────────────────────────────────────────────

/**
 * ApplianceTraits — what is physically integrated into the appliance body.
 *
 * These are independent of the heat-source kind; they encode the appliance
 * packaging rather than the heat-generation principle.
 *
 *  integratedPump      — circulator pump is inside the appliance
 *  integratedExpansion — expansion vessel is inside the appliance
 *  integratedPlateHex  — plate HEX for DHW is inside the appliance (combi)
 *  automaticBypass     — ABV is fitted (kept as metadata; hidden in default UI)
 */
export type ApplianceTraits = {
  integratedPump?: boolean;
  integratedExpansion?: boolean;
  integratedPlateHex?: boolean;
  automaticBypass?: boolean;
};

// ─── Composable system concept model ─────────────────────────────────────────

/**
 * SystemConceptModel — the four-layer composable representation of a heating
 * system.
 *
 * This is the primary data model for the lab builder.  A default `BuildGraph`
 * can be auto-generated from any valid `SystemConceptModel` via
 * `conceptModelToGraph()`.
 *
 * Expert/engineer detail (expansion vessel, ABV, feed-and-vent, wiring centre)
 * is kept in `traits` and surfaced as metadata only; it is not rendered in the
 * main canvas by default.
 */
export type SystemConceptModel = {
  heatSource: HeatSourceKind;
  hotWaterService: HotWaterServiceKind;
  controls: ControlTopologyKind;
  emitters: EmitterKind[];
  traits?: ApplianceTraits;
};

// ─── Canonical compositions ───────────────────────────────────────────────────

/**
 * Canonical regular boiler system.
 *
 * Open-vented heat source with no integrated pump or expansion; paired with
 * a vented (tank-fed) cylinder and Y-plan controls.
 */
export const CANONICAL_REGULAR_BOILER: SystemConceptModel = {
  heatSource: 'regular_boiler',
  hotWaterService: 'vented_cylinder',
  controls: 'y_plan',
  emitters: ['radiators'],
  traits: {
    integratedPump: false,
    integratedExpansion: false,
    integratedPlateHex: false,
  },
};

/**
 * Canonical system boiler with unvented (mains-fed) cylinder.
 *
 * Integrated pump and expansion vessel are inside the appliance body.
 * S-plan controls with separate CH and cylinder zones.
 */
export const CANONICAL_SYSTEM_BOILER: SystemConceptModel = {
  heatSource: 'system_boiler',
  hotWaterService: 'unvented_cylinder',
  controls: 's_plan',
  emitters: ['radiators'],
  traits: {
    integratedPump: true,
    integratedExpansion: true,
    integratedPlateHex: false,
  },
};

/**
 * Canonical combi boiler.
 *
 * A combi is NOT a separate heat-source kind — it is a system_boiler heat
 * source with an integrated plate HEX (hotWaterService: 'combi_plate_hex').
 * No separate cylinder or zone-control topology is required for DHW.
 */
export const CANONICAL_COMBI: SystemConceptModel = {
  heatSource: 'system_boiler',
  hotWaterService: 'combi_plate_hex',
  controls: 'none',
  emitters: ['radiators'],
  traits: {
    integratedPump: true,
    integratedExpansion: true,
    integratedPlateHex: true,
  },
};

/**
 * Canonical heat pump system.
 *
 * Heat pump primary circuit with an unvented (mains-fed) cylinder for DHW
 * and underfloor heating emitters.  A low-loss header / buffer arrangement
 * acts as the hydraulic separator (hp_diverter topology).
 */
export const CANONICAL_HEAT_PUMP: SystemConceptModel = {
  heatSource: 'heat_pump',
  hotWaterService: 'unvented_cylinder',
  controls: 'hp_diverter',
  emitters: ['ufh'],
  traits: {
    integratedPump: false,
    integratedExpansion: false,
    integratedPlateHex: false,
  },
};
