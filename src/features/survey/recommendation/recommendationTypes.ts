/**
 * recommendationTypes.ts
 *
 * Types for the Recommendation step — the final survey step where the
 * surveyor records the agreed installation recommendation.
 */

// ─── Heat source ──────────────────────────────────────────────────────────────

export type HeatSourceType =
  | 'combi_boiler'
  | 'system_boiler'
  | 'regular_boiler'
  | 'heat_pump_air'
  | 'heat_pump_ground'
  | 'keep_existing';

export const HEAT_SOURCE_OPTIONS: { value: HeatSourceType; label: string; sub: string }[] = [
  { value: 'combi_boiler',      label: 'Combi Boiler',          sub: 'Instant hot water, no cylinder' },
  { value: 'system_boiler',     label: 'System Boiler',         sub: 'Sealed system, stored hot water' },
  { value: 'regular_boiler',    label: 'Regular Boiler',        sub: 'Open vented, stored hot water' },
  { value: 'heat_pump_air',     label: 'Air Source Heat Pump',  sub: 'Low carbon, high efficiency' },
  { value: 'heat_pump_ground',  label: 'Ground Source Heat Pump', sub: 'Highest efficiency, significant groundworks' },
  { value: 'keep_existing',     label: 'Keep Existing System',  sub: 'No heat source change' },
];

// ─── Water source ─────────────────────────────────────────────────────────────

export type WaterSourceType =
  | 'keep_existing'
  | 'unvented_cylinder'
  | 'vented_cylinder'
  | 'mixergy_cylinder'
  | 'combi_plate_hex';

export const WATER_SOURCE_OPTIONS: { value: WaterSourceType; label: string; sub: string }[] = [
  { value: 'keep_existing',     label: 'Keep Existing',         sub: 'No change to hot water source' },
  { value: 'unvented_cylinder', label: 'Unvented Cylinder',     sub: 'Mains pressure, stored — e.g. Megaflo' },
  { value: 'vented_cylinder',   label: 'Vented Cylinder',       sub: 'Low pressure, gravity fed' },
  { value: 'mixergy_cylinder',  label: 'Mixergy Cylinder',      sub: 'Smart stratified, top-down heating' },
  { value: 'combi_plate_hex',   label: 'Combi (Plate HEX)',     sub: 'Instant — no cylinder needed' },
];

// ─── Powerflush ───────────────────────────────────────────────────────────────

export type PowerflushType = 'yes' | 'no' | 'chemical_only' | 'not_assessed';

export const POWERFLUSH_OPTIONS: { value: PowerflushType; label: string; sub: string }[] = [
  { value: 'yes',           label: 'Full Powerflush',      sub: 'Machine flush of complete circuit' },
  { value: 'chemical_only', label: 'Chemical Clean Only',  sub: 'Inhibitor dose + system clean' },
  { value: 'no',            label: 'Not Required',         sub: 'System is clean, no flush needed' },
  { value: 'not_assessed',  label: 'Not Yet Assessed',     sub: 'To be confirmed on installation day' },
];

// ─── Filter ───────────────────────────────────────────────────────────────────

export type FilterType = 'magnetic_inline' | 'magnetic_full_flow' | 'scale_reducer' | 'none' | 'keep_existing';

export const FILTER_OPTIONS: { value: FilterType; label: string; sub: string }[] = [
  { value: 'magnetic_inline',    label: 'Magnetic Inline Filter',    sub: 'e.g. Adey MagnaClean, Fernox TF1' },
  { value: 'magnetic_full_flow', label: 'Magnetic Full-Flow Filter', sub: 'Higher flow, reduced head loss' },
  { value: 'scale_reducer',      label: 'Scale Reducer',             sub: 'Hard water areas — limescale protection' },
  { value: 'keep_existing',      label: 'Keep Existing Filter',      sub: 'Current filter retained' },
  { value: 'none',               label: 'No Filter',                 sub: 'Not required for this installation' },
];

// ─── Additions ────────────────────────────────────────────────────────────────

export interface RecommendationAdditions {
  sealedSystemKit: boolean;
  smartControls: boolean;
  trvs: boolean;
  weatherCompensation: boolean;
  replacementRadiators: boolean;
  mixergy: boolean;
}

// ─── Full recommendation state ────────────────────────────────────────────────

export interface RecommendationState {
  heatSource: HeatSourceType | null;
  waterSource: WaterSourceType | null;
  powerflush: PowerflushType | null;
  filter: FilterType | null;
  additions: RecommendationAdditions;
  notes: string;
}

export const INITIAL_RECOMMENDATION_STATE: RecommendationState = {
  heatSource: null,
  waterSource: null,
  powerflush: null,
  filter: null,
  additions: {
    sealedSystemKit: false,
    smartControls: false,
    trvs: false,
    weatherCompensation: false,
    replacementRadiators: false,
    mixergy: false,
  },
  notes: '',
};
