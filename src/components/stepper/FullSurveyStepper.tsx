import { useState, useMemo, useEffect, type CSSProperties } from 'react';
import {
  DEMAND_PRESETS,
  presetToEngineSignature,
  resolveTimingOverrides,
  getDemandStyleLabel,
  type DemandPresetId,
  type DemandTimingOverrides,
} from '../../engine/schema/OccupancyPreset';
import { deriveRawPressureStr, deriveRawFlowStr } from './pressureFlowHelpers';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import OperatingPointChart, { OPERATING_POINT_NOTE } from '../visualizers/OperatingPointChart';
import type { EngineInputV2_3, FullEngineResult, BuildingFabricType, HouseholdComposition } from '../../engine/schema/EngineInputV2_3';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { FullSurveyModelV1, HeatingConditionDiagnosticsV1, DhwConditionDiagnosticsV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import { toEngineInput } from '../../ui/fullSurvey/FullSurveyModelV1';
import { sanitiseModelForEngine } from '../../ui/fullSurvey/sanitiseModelForEngine';
import { inferSystemConditionFlags } from '../../engine/modules/SystemConditionInferenceModule';
import { runEngine } from '../../engine/Engine';
import { runPvAssessmentModule } from '../../engine/modules/PvAssessmentModule';
import { runThermalInertiaModule } from '../../engine/modules/ThermalInertiaModule';
import { calcFlowLpm, PIPE_THRESHOLDS } from '../../engine/modules/HydraulicModule';
import {
  deriveProfileFromHouseholdComposition,
  type DaytimeOccupancyPattern,
  type BathUsePattern,
} from '../../lib/occupancy/deriveProfileFromHouseholdComposition';
import { runCombiDhwModuleV1 } from '../../engine/modules/CombiDhwModule';
import { analysePressure } from '../../engine/modules/PressureModule';
import { runRegionalHardness } from '../../engine/modules/RegionalHardness';
import { ERP_TO_NOMINAL_PCT } from '../../engine/utils/efficiency';
import {
  type WallType,
  type InsulationLevel,
  type AirTightness,
  type Glazing,
  type RoofInsulation,
  type ThermalMass,
} from '../../engine/presets/FabricPresets';
import LiveHubPage from '../../live/LiveHubPage';
import LivePhysicsOverlay, { type OverlayStepKey } from '../../ui/overlay/LivePhysicsOverlay';
import DeltaStrip from '../../ui/panels/DeltaStrip';
import { EDUCATIONAL_EXPLAINERS } from '../../explainers/educational/content';
import HeatLossCalculator from '../heatloss/HeatLossCalculator';

interface Props {
  onBack: () => void;
  /** Optional prefill state from Story Mode escalation. */
  prefill?: Partial<FullSurveyModelV1>;
  onOpenFloorPlan?: (surveyResults: Partial<FullSurveyModelV1>) => void;
  /**
   * Called when the first-pass survey completes.  Receives the cleaned
   * EngineInputV2_3 ready for the simulator.  When provided, the stepper
   * routes directly to the simulator instead of opening LiveHubPage.
   */
  onComplete?: (engineInput: EngineInputV2_3) => void;
  /**
   * Called on every step transition (and at completion) with the current raw
   * FullSurveyModelV1 — including fullSurvey extras.  Used by VisitPage to
   * autosave mid-survey state so that navigation-away-and-back, refresh, and
   * save/reload all preserve the full survey including Step 5 hot-water data.
   */
  onDraft?: (draft: FullSurveyModelV1) => void;
}

type Step = 'location' | 'pressure' | 'hydraulic' | 'lifestyle' | 'hot_water' | 'commercial' | 'overlay';
/** Step 8 ("results") is intentionally excluded — the survey ends at "overlay"
 *  and the stepper transitions to hub mode after the engine run. */
const STEPS: Step[] = ['location', 'pressure', 'hydraulic', 'lifestyle', 'hot_water', 'commercial', 'overlay'];

// ─── Fabric Behaviour Controls ────────────────────────────────────────────────
// Two independent physics dimensions:
//   A) Fabric heat-loss (wall type, insulation, glazing, roof, airtightness)
//   B) Thermal inertia (mass — separate from wall type)

type InputValidationWarning = {
  key: 'boiler_age' | 'flow_lpm' | 'static_pressure' | 'pressure_order';
  message: string;
};

function collectInputValidationWarnings(model: FullSurveyModelV1): InputValidationWarning[] {
  const warnings: InputValidationWarning[] = [];
  if (model.currentBoilerAgeYears !== undefined && model.currentBoilerAgeYears > 50) {
    warnings.push({
      key: 'boiler_age',
      message: 'Boiler age looks unrealistic (>50 years) — treating age as unknown for efficiency decay modelling.',
    });
  }
  if (model.mainsDynamicFlowLpm !== undefined && model.mainsDynamicFlowLpm > 60) {
    warnings.push({
      key: 'flow_lpm',
      message: 'Flow reading looks unrealistic (>60 L/min) — check units/readings before relying on supply decisions.',
    });
  }
  if (model.staticMainsPressureBar !== undefined && model.staticMainsPressureBar > 10) {
    warnings.push({
      key: 'static_pressure',
      message: 'Static pressure looks unrealistic (>10 bar) — capping value for modelling.',
    });
  }

  const pressureBar = model.dynamicMainsPressureBar ?? model.dynamicMainsPressure;
  if (pressureBar !== undefined && model.staticMainsPressureBar !== undefined && pressureBar > model.staticMainsPressureBar) {
    warnings.push({
      key: 'pressure_order',
      message: 'Dynamic pressure is above static pressure — dynamic reading ignored for decisioning until re-measured.',
    });
  }
  return warnings;
}

function normalizePostcodeOutward(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim();
  const [outward = ''] = cleaned.split(/\s+/);
  return outward;
}

/**
 * Base τ matrix (hours): thermal mass × insulation level.
 * τ is now derived from thermalMass (inertia), NOT wall type.
 * Derived from CIBSE Guide A lumped-capacitance guidance and BRE field data.
 */
const BASE_TAU: Record<ThermalMass, Record<InsulationLevel, number>> = {
  heavy:  { poor: 45, moderate: 55, good: 70, exceptional: 90 },
  medium: { poor: 22, moderate: 35, good: 48, exceptional: 65 },
  light:  { poor: 10, moderate: 15, good: 22, exceptional: 35 },
};

/** Air-tightness multiplier applied to the base τ. */
const AIR_TIGHTNESS_FACTOR: Record<AirTightness, number> = {
  leaky:         0.75,
  average:       1.00,
  tight:         1.15,
  passive_level: 1.40,
};

/**
 * Derive τ (thermal time constant) from thermal mass + insulation + airtightness.
 * τ reflects inertia — not efficiency or heat loss.
 * Special case: light + exceptional + passive-level → Passivhaus τ (190.5 h).
 */
function deriveTau(mass: ThermalMass, insulation: InsulationLevel, air: AirTightness): number {
  if (mass === 'light' && insulation === 'exceptional' && air === 'passive_level') {
    return 190.5; // Passivhaus standard
  }
  return Math.round(BASE_TAU[mass][insulation] * AIR_TIGHTNESS_FACTOR[air]);
}

/** Map thermal mass + insulation + airtightness to BuildingFabricType for ThermalInertiaModule. */
function deriveFabricType(mass: ThermalMass, insulation: InsulationLevel, air: AirTightness): BuildingFabricType {
  if (mass === 'light' && insulation === 'exceptional' && air === 'passive_level') return 'passivhaus_standard';
  if (mass === 'heavy')  return 'solid_brick_1930s';
  if (mass === 'medium') return '1970s_cavity_wall';
  return 'lightweight_new';
}

/** Map thermal mass to buildingMass for the engine contract. */
function deriveBuildingMass(mass: ThermalMass): EngineInputV2_3['buildingMass'] {
  return mass; // ThermalMass values match BuildingMass values exactly
}

/**
 * Qualitative heat-loss band based on wall type, insulation, glazing, and roof.
 * Solid masonry = high heat loss (leaky); it is NOT "best" just because it has high mass.
 */
function deriveHeatLossBand(
  wall: WallType,
  insulation: InsulationLevel,
  glaz: Glazing,
  roof: RoofInsulation,
): { label: string; colour: string } {
  // Score: 0 = worst heat loss, higher = better
  const insulScore = (['poor', 'moderate', 'good', 'exceptional'] as InsulationLevel[]).indexOf(insulation); // 0–3
  const wallScore: Record<WallType, number> = { solid_masonry: 0, cavity_uninsulated: 0, cavity_insulated: 1, timber_lightweight: 2 };
  const glazScore: Record<Glazing, number> = { single: 0, double: 1, triple: 2 };
  const roofScore: Record<RoofInsulation, number> = { poor: 0, moderate: 1, good: 2 };
  const total = insulScore + wallScore[wall] + glazScore[glaz] + roofScore[roof]; // 0–9
  if (total <= 1)  return { label: 'Very High', colour: '#c53030' };
  if (total <= 3)  return { label: 'High',      colour: '#dd6b20' };
  if (total <= 5)  return { label: 'Moderate',  colour: '#d69e2e' };
  if (total <= 7)  return { label: 'Low',        colour: '#38a169' };
  return               { label: 'Very Low',   colour: '#276749' };
}

/** Derive qualitative inertia band from τ. */
function deriveInertiaBand(tauHours: number): { label: string; colour: string } {
  if (tauHours < 20) return { label: 'Spiky',    colour: '#c53030' };
  if (tauHours < 50) return { label: 'Moderate', colour: '#d69e2e' };
  return                    { label: 'Stable',   colour: '#38a169' };
}

/** Generate a 10-hour temperature decay trace directly from τ. */
function buildDecayTrace(tauHours: number, initialTempC = 20, outdoorTempC = 5) {
  const deltaT = initialTempC - outdoorTempC;
  return Array.from({ length: 11 }, (_, h) => ({
    hourOffset: h,
    tempC: parseFloat((outdoorTempC + deltaT * Math.exp(-h / tauHours)).toFixed(1)),
  }));
}

/** Recharts tooltip formatter for temperature traces. */
function tempTooltipFormatter(v: number | undefined): [string, string] {
  return [v !== undefined ? `${v}°C` : 'N/A', 'Room temp'];
}

// ─── System Overlay Helpers ───────────────────────────────────────────────────

const OVERLAY_SYSTEMS = [
  { id: 'combi',            label: 'Combi'            },
  { id: 'stored_vented',    label: 'Stored — vented'  },
  { id: 'stored_unvented',  label: 'Stored — unvented' },
  { id: 'ashp',             label: 'ASHP'             },
  { id: 'regular_vented',   label: 'Regular'          },
  { id: 'system_unvented',  label: 'Sys+Unvented'     },
] as const;

const OVERLAY_ROWS: Array<{ id: string; label: string; step: Step }> = [
  { id: 'heat_delivery', label: 'Heat delivery',      step: 'hydraulic'  },
  { id: 'hot_water',     label: 'Hot water',          step: 'hot_water'  },
  { id: 'water_supply',  label: 'Water supply',       step: 'pressure'   },
  { id: 'space',         label: 'Space & constraints', step: 'commercial' },
  { id: 'future_works',  label: 'Future works',       step: 'commercial' },
];

type RiskLevel = 'pass' | 'warn' | 'fail';

interface OverlayExplanation {
  ruleName: string;
  observedValue: string;
  threshold: string;
  whyItMatters: string;
  whatWouldChange: string;
}

function deriveOverlayCell(
  system: string,
  row: string,
  boilerRisk: RiskLevel,
  ashpRisk: RiskLevel,
  combiDhwRisk: RiskLevel,
  dhwBandLabel: string,
  cwsMeetsUnvented: boolean,
  cwsHasMeasurements: boolean,
  cwsInconsistent: boolean,
  dynamicBar: number,
  availableSpace: string | undefined,
  futureLoft: boolean,
  futureBath: boolean,
): RiskLevel {
  // Water supply risk: based on flow-based eligibility gate, not pressure drop quality
  const waterSupplyRisk: RiskLevel =
    cwsInconsistent ? 'fail' :
    !cwsHasMeasurements ? 'warn' :
    cwsMeetsUnvented ? 'pass' : 'warn';

  switch (row) {
    case 'heat_delivery':
      return system === 'ashp' ? ashpRisk : boilerRisk;

    case 'hot_water':
      if (system === 'combi') return combiDhwRisk;
      // Stored/ASHP/regular/unvented — multi-bathroom is fine; flag only extreme demand
      return dhwBandLabel === 'Very High' ? 'warn' : 'pass';

    case 'water_supply':
      if (system === 'regular_vented') return 'pass'; // gravity-fed, not pressure-sensitive
      if (system === 'stored_vented') return 'pass';  // tank-fed, not mains pressure-sensitive
      if (system === 'combi') return dynamicBar < 1.0 ? 'fail' : waterSupplyRisk;
      if (system === 'system_unvented' || system === 'stored_unvented') return waterSupplyRisk;
      return dynamicBar < 1.0 ? 'warn' : waterSupplyRisk; // ashp

    case 'space':
      if (system === 'combi') return 'pass'; // no cylinder needed
      return availableSpace === 'ok' ? 'pass' : 'warn';

    case 'future_works': {
      const hasPlanned = futureLoft || futureBath;
      if (!hasPlanned) return 'pass';
      if (system === 'combi') return 'fail';
      if (system === 'stored_vented' || system === 'regular_vented') return futureLoft ? 'fail' : 'warn';
      return 'warn';
    }

    default: return 'pass';
  }
}

const CELL_ICON: Record<RiskLevel, string> = { pass: '✅', warn: '⚠️', fail: '❌' };
const CELL_BG:   Record<RiskLevel, string> = { pass: '#f0fff4', warn: '#fffff0', fail: '#fff5f5' };
const CELL_BORDER: Record<RiskLevel, string> = { pass: '#9ae6b4', warn: '#faf089', fail: '#feb2b2' };

function overlayExplanation(
  system: string,
  row: string,
  risk: RiskLevel,
  input: FullSurveyModelV1,
  dhwBandLabel: string,
  cwsMeetsUnvented: boolean,
  cwsHasMeasurements: boolean,
  cwsInconsistent: boolean,
): OverlayExplanation {
  if (row === 'hot_water' && system === 'combi') {
    return {
      ruleName: 'Combi simultaneous draw limit',
      observedValue: `${input.peakConcurrentOutlets ?? 1} peak outlet(s), ${input.bathroomCount} bathroom(s)`,
      threshold: 'Combi on-demand performs best with one outlet at a time.',
      whyItMatters: 'Simultaneous or back-to-back draws can reduce outlet temperature and flow stability.',
      whatWouldChange: 'Selecting stored hot water removes this throughput constraint for multi-outlet use.',
    };
  }

  if (row === 'hot_water') {
    return {
      ruleName: 'Stored hot-water demand fit',
      observedValue: `Demand band: ${dhwBandLabel}`,
      threshold: 'Stored hot water supports low to very high demand; only very high demand triggers a review.',
      whyItMatters: 'Stored volume is designed for simultaneous outlets and morning demand clustering.',
      whatWouldChange: 'No architecture change is needed unless demand materially increases beyond the selected cylinder strategy.',
    };
  }

  if (row === 'water_supply') {
    const observed = cwsHasMeasurements
      ? `${input.mainsDynamicFlowLpm ?? 'N/A'} L/min @ ${input.dynamicMainsPressureBar ?? input.dynamicMainsPressure ?? 'N/A'} bar`
      : 'No dynamic flow measurement recorded';
    return {
      ruleName: 'Mains flow and pressure check',
      observedValue: observed,
      threshold: 'Typical unvented/combi gate: ≥10 L/min at ~1.0 bar dynamic (or stronger equivalent).',
      whyItMatters: cwsInconsistent
        ? 'Inconsistent pressure readings make capacity assessments unreliable.'
        : 'Insufficient mains performance can limit simultaneous outlet comfort.',
      whatWouldChange: cwsMeetsUnvented
        ? 'No immediate action — evidence supports mains-fed operation.'
        : 'Take an on-load flow/pressure measurement, then review supply upgrade options if needed.',
    };
  }

  if (row === 'space') {
    return {
      ruleName: 'Cylinder space suitability',
      observedValue: `Surveyed space: ${input.availableSpace ?? 'unknown'}`,
      threshold: 'Stored systems require suitable cylinder footprint and service clearances.',
      whyItMatters: 'Insufficient space can constrain cylinder choice, serviceability, and installation route.',
      whatWouldChange: 'Confirm cupboard dimensions or use compact/stratified storage where space is tight.',
    };
  }

  if (row === 'future_works') {
    return {
      ruleName: 'Future expansion resilience',
      observedValue: `Loft conversion: ${input.futureLoftConversion ? 'planned' : 'not planned'}, additional bathroom: ${input.futureAddBathroom ? 'planned' : 'not planned'}`,
      threshold: 'Future demand growth should be accommodated without major rework.',
      whyItMatters: 'Planned expansion can turn a currently adequate architecture into a future bottleneck.',
      whatWouldChange: 'Choose a system/cylinder strategy that supports added outlets and future peak draw.',
    };
  }

  return {
    ruleName: 'Heat delivery compatibility',
    observedValue: `Status: ${risk.toUpperCase()}`,
    threshold: 'Emitter capacity and design flow temperatures should match the selected heat source.',
    whyItMatters: 'Temperature mismatch impacts comfort and seasonal efficiency.',
    whatWouldChange: 'Emitter and control upgrades can improve compatibility for low-temperature operation.',
  };
}

function overallRisk(cells: RiskLevel[]): RiskLevel {
  if (cells.includes('fail')) return 'fail';
  if (cells.includes('warn')) return 'warn';
  return 'pass';
}

// ─── Pressure Behaviour Helpers ──────────────────────────────────────────────

/** Colour for pressure drop bar indicator (diagnostic only, not eligibility). */
const DROP_COLOUR = '#d69e2e'; // amber — drop is always just a clue

function unventedSuitability(
  cwsMeetsRequirement: boolean,
  cwsHasMeasurements: boolean,
  cwsInconsistent: boolean,
): { label: string; colour: string; note: string } {
  if (cwsInconsistent) return {
    label:  '❌ Readings inconsistent',
    colour: '#c53030',
    note:   'Dynamic pressure cannot exceed static — readings may be swapped or taken at different points.',
  };
  if (!cwsHasMeasurements) return {
    label:  '⚠️ Check supply',
    colour: '#d69e2e',
    note:   'Need L/min @ bar measurement to assess unvented suitability.',
  };
  if (cwsMeetsRequirement) return {
    label:  '✅ Suitable for unvented',
    colour: '#38a169',
    note:   'Supply meets unvented requirement (≥ 10 L/min @ ≥ 1 bar, or ≥ 12 L/min flow-only with pressure not recorded).',
  };
  return {
    label:  '⚠️ Marginal',
    colour: '#d69e2e',
    note:   'Supply does not meet unvented requirement — consider pressure boost or alternative architecture.',
  };
}

// ─── Input parsing helpers ───────────────────────────────────────────────────

/** Parse a raw input string to a number, or undefined if blank/invalid. */
function parseOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const normalised = trimmed.replace(',', '.');
  const n = Number(normalised);
  return isNaN(n) ? undefined : n;
}

/** Collapse leading zeros for display (e.g. "03" → "3", "01.5" → "1.5"). Preserves "0" and "0.". */
function normaliseNumericString(raw: string): string {
  if (raw === '' || raw === '0' || raw.startsWith('0.')) return raw;
  return raw.replace(/^0+(\d)/, '$1');
}

// ─── DHW Behaviour Helpers ───────────────────────────────────────────────────

/** Qualitative DHW demand band from bathrooms, outlets, and occupancy. */
function dhwDemandBand(bathrooms: number, outlets: number, highOcc: boolean): { label: string; colour: string } {
  const score = outlets + (bathrooms > 1 ? bathrooms - 1 : 0) + (highOcc ? 1 : 0);
  if (score <= 1) return { label: 'Low',      colour: '#38a169' };
  if (score === 2) return { label: 'Moderate', colour: '#3182ce' };
  if (score === 3) return { label: 'High',     colour: '#d69e2e' };
  return              { label: 'Very High', colour: '#b7791f' };
}

/** Format a HouseholdComposition into a compact readable summary string. */
function formatHouseholdCompositionSummary(composition: HouseholdComposition): string {
  const parts: string[] = [];
  if (composition.adultCount > 0) {
    const n = composition.adultCount;
    parts.push(`${n} adult${n !== 1 ? 's' : ''}`);
  }
  if (composition.youngAdultCount18to25AtHome > 0) {
    const n = composition.youngAdultCount18to25AtHome;
    parts.push(`${n} young adult${n !== 1 ? 's' : ''} (18–25)`);
  }
  if (composition.childCount0to4 > 0) {
    const n = composition.childCount0to4;
    parts.push(`${n} child${n !== 1 ? 'ren' : ''} age 0–4`);
  }
  if (composition.childCount5to10 > 0) {
    const n = composition.childCount5to10;
    parts.push(`${n} child${n !== 1 ? 'ren' : ''} age 5–10`);
  }
  if (composition.childCount11to17 > 0) {
    const n = composition.childCount11to17;
    parts.push(`${n} child${n !== 1 ? 'ren' : ''} age 11–17`);
  }
  return parts.join(', ');
}

// ─── Hydraulic Behaviour Helpers ─────────────────────────────────────────────

const RISK_COLOUR: Record<'pass' | 'warn' | 'fail', string> = {
  pass: '#38a169',
  warn: '#d69e2e',
  fail: '#c53030',
};
const RISK_BG: Record<'pass' | 'warn' | 'fail', string> = {
  pass: '#f0fff4',
  warn: '#fffff0',
  fail: '#fff5f5',
};
const RISK_LABEL: Record<'pass' | 'warn' | 'fail', string> = {
  pass: '✅ Pass',
  warn: '⚠️ Caution',
  fail: '❌ Fail',
};

/** Options for the Y-plan / S-plan fallback capture chip in the overlay step. */
const PLAN_TYPE_OPTIONS: Array<{ value: 'y_plan' | 's_plan'; label: string; sub: string }> = [
  { value: 'y_plan', label: 'Y-plan', sub: 'Single mid-position valve' },
  { value: 's_plan', label: 'S-plan', sub: 'Twin 2-port zone valves' },
];

function uiClassifyRisk(kw: number, warnKw: number, failKw: number): 'pass' | 'warn' | 'fail' {
  if (kw >= failKw) return 'fail';
  if (kw >= warnKw) return 'warn';
  return 'pass';
}

/** Build a 0–20 kW flow-vs-heat-loss curve for the selected pipe, plus its thresholds. */
function buildFlowCurve(pipeDiameter: number) {
  const key = ([35, 28, 22, 15] as const).find(k => pipeDiameter >= k) ?? 15;
  const thresholds = PIPE_THRESHOLDS[key];
  const data = Array.from({ length: 21 }, (_, i) => ({
    heatLossKw: i,
    boilerLpm: parseFloat(calcFlowLpm(i, 20).toFixed(1)),
    ashpLpm:   parseFloat(calcFlowLpm(i, 5).toFixed(1)),
  }));
  return { data, thresholds };
}

const defaultInput: FullSurveyModelV1 = {
  postcode: '',
  dynamicMainsPressure: 1.0,
  buildingMass: 'heavy',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 2,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: false,
  hasMagneticFilter: false,
  installationPolicy: 'full_job',
  dhwTankType: 'standard',
  installerNetwork: 'british_gas',
  fullSurvey: {
    manualEvidence: {},
    telemetryPlaceholders: { coolingTau: null, confidence: 'none' },
  },
};

/** Z-index for full-screen overlays rendered above the stepper. */
const OVERLAY_Z_INDEX = 1000;

/** Inline expandable explainer link — renders a <details> element tied to an educational explainer. */
function InlineExplainerLink({ explainerId, testId, style }: {
  explainerId: string;
  testId: string;
  style?: React.CSSProperties;
}) {
  const e = EDUCATIONAL_EXPLAINERS.find(x => x.id === explainerId);
  if (!e) return null;
  return (
    <details data-testid={testId} style={{ fontSize: '0.75rem', color: '#3182ce', cursor: 'pointer', ...style }}>
      <summary style={{ listStyle: 'none', display: 'inline', cursor: 'pointer' }}>
        📖 Learn more: {e.title}
      </summary>
      <div style={{ marginTop: '0.5rem', padding: '0.625rem', background: '#ebf8ff', border: '1px solid #bee3f8', borderRadius: '6px', color: '#2c5282', lineHeight: 1.5 }}>
        <p style={{ margin: '0 0 0.4rem 0', fontWeight: 600 }}>{e.point}</p>
        <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
          {e.bullets.map((b, i) => <li key={i} style={{ marginBottom: '0.25rem' }}>{b}</li>)}
        </ul>
      </div>
    </details>
  );
}

export default function FullSurveyStepper({ onBack, prefill, onComplete, onDraft }: Props) {
  const [currentStep, setCurrentStep] = useState<Step>('location');
  const [input, setInput] = useState<FullSurveyModelV1>(() =>
    prefill ? { ...defaultInput, ...prefill } : defaultInput
  );
  const [prefillActive] = useState<boolean>(!!prefill);
  const [showPrefillBanner, setShowPrefillBanner] = useState<boolean>(!!prefill);
  const [compareMixergy, setCompareMixergy] = useState(() => prefill?.fullSurvey?.compareMixergy ?? false);
  const [overlayDetail, setOverlayDetail] = useState<{ systemLabel: string; rowLabel: string; step: Step; risk: RiskLevel; explanation: OverlayExplanation } | null>(null);
  const [results, setResults] = useState<FullEngineResult | null>(null);
  const [mode, setMode] = useState<'stepper' | 'hub'>('stepper');
  const [showHeatLossCalc, setShowHeatLossCalc] = useState(false);

  // Live physics overlay: runs a lightweight engine pass on every step for real-time feedback.
  // Debounced so it doesn't block every keystroke.
  const [liveEngineOutput, setLiveEngineOutput] = useState<EngineOutputV1 | null>(null);
  const [prevEngineOutput, setPrevEngineOutput] = useState<EngineOutputV1 | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const engineInput = toEngineInput(sanitiseModelForEngine(input));
      const out = runEngine(engineInput);
      setLiveEngineOutput(prev => {
        setPrevEngineOutput(prev);
        return out.engineOutput;
      });
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  /**
   * Maps survey step names to LivePhysicsOverlay step keys.
   *
   * The 'lifestyle' step (Step 4) is intentionally excluded: the LifePanel
   * content (Peak DHW demand / CH lockout) duplicates the dhw-demand-summary
   * block that lives inside the step card itself. Removing the 'life' mapping
   * keeps the working in-card summary as the single source of truth and avoids
   * the faulty highlighted strip at the top of Step 4.
   */
  const overlayStepKey: OverlayStepKey | null = useMemo(() => {
    if (currentStep === 'location')   return 'shell';
    if (currentStep === 'pressure')   return 'supply';
    if (currentStep === 'hot_water')  return 'storage';
    return null;
  }, [currentStep]);

  // Water hardness search: shows a live preview when the user clicks "Search"
  const [hardnessPreview, setHardnessPreview] = useState<ReturnType<typeof runRegionalHardness> | null>(null);
  const searchHardness = () => setHardnessPreview(runRegionalHardness(input.postcode));

  // Raw string state for iOS-friendly numeric inputs (preserves typed value, normalises on blur).
  // Derived from the same initial-input object as `input` so Story Mode / restored-model prefills
  // appear correctly on first render without a string/numeric mismatch.
  const [rawPressureStr, setRawPressureStr] = useState(() => {
    const init = prefill ? { ...defaultInput, ...prefill } : defaultInput;
    return deriveRawPressureStr(init);
  });
  const [rawFlowStr, setRawFlowStr] = useState(() => {
    const init = prefill ? { ...defaultInput, ...prefill } : defaultInput;
    return deriveRawFlowStr(init);
  });

  // ── Fabric simulation controls ─────────────────────────────────────────────
  // Section A (heat loss): wall, insulation, glazing, roof, airtightness
  // Section B (inertia): thermalMass (independent from wall type)
  //
  // When a prefill is present with building.fabric / building.thermalMass values,
  // the individual controls are initialised directly from those saved values so
  // that a reload/navigate-away-back round-trip restores the exact fabric state
  // the surveyor had selected.  The back-mapping from engine types to UI types:
  //   'cavity_filled'   → 'cavity_insulated'
  //   'cavity_unfilled' → 'cavity_uninsulated'
  //   'timber_frame'    → 'timber_lightweight'
  //   'solid_masonry'   → 'solid_masonry'
  //   'passive'         → 'passive_level'   (airTightness only)
  const prefillFabric = prefill?.building?.fabric;
  const prefillThermalMass = prefill?.building?.thermalMass;

  const [wallType, setWallType] = useState<WallType>(() => {
    const fw = prefillFabric?.wallType;
    if (fw === 'cavity_filled')   return 'cavity_insulated';
    if (fw === 'cavity_unfilled') return 'cavity_uninsulated';
    if (fw === 'timber_frame')    return 'timber_lightweight';
    if (fw === 'solid_masonry')   return 'solid_masonry';
    return 'solid_masonry';
  });
  const [insulationLevel, setInsulationLevel] = useState<InsulationLevel>(() => {
    const fi = prefillFabric?.insulationLevel;
    if (fi === 'poor' || fi === 'moderate' || fi === 'good' || fi === 'exceptional') return fi;
    return 'moderate';
  });
  const [airTightness, setAirTightness] = useState<AirTightness>(() => {
    const fa = prefillFabric?.airTightness;
    if (fa === 'passive') return 'passive_level';
    if (fa === 'leaky' || fa === 'average' || fa === 'tight') return fa;
    return 'average';
  });
  const [glazing, setGlazing] = useState<Glazing>(() => {
    const fg = prefillFabric?.glazing;
    if (fg === 'single' || fg === 'double' || fg === 'triple') return fg;
    return 'single';
  });
  const [roofInsulation, setRoofInsulation] = useState<RoofInsulation>(() => {
    const fr = prefillFabric?.roofInsulation;
    if (fr === 'poor' || fr === 'moderate' || fr === 'good') return fr;
    return 'poor';
  });
  const [thermalMass, setThermalMass] = useState<ThermalMass>(() => {
    const tm = prefillThermalMass;
    if (tm === 'light' || tm === 'medium' || tm === 'heavy') return tm;
    return 'heavy';
  });
  const [showAdvancedFabric, setShowAdvancedFabric] = useState(false);
  /** Roof type — used for solar PV suitability assessment. */
  const [roofType, setRoofType] = useState<'pitched' | 'flat' | 'mixed' | 'unknown' | undefined>(
    () => prefill?.roofType ?? undefined,
  );
  /** Usable roof orientation — used for solar PV suitability assessment. */
  const [roofOrientation, setRoofOrientation] = useState<
    'north' | 'east' | 'south' | 'west' | 'south_east' | 'south_west' | 'mixed' | 'unknown' | undefined
  >(
    () => prefill?.roofOrientation ?? undefined,
  );
  /** Solar shading level — used for solar PV suitability assessment. */
  const [solarShading, setSolarShading] = useState<'low' | 'medium' | 'high' | 'unknown' | undefined>(
    () => prefill?.solarShading ?? undefined,
  );
  /** Solar PV installation status — actual presence, not just roof suitability. */
  const [pvStatus, setPvStatus] = useState<'none' | 'existing' | 'planned' | undefined>(
    () => prefill?.pvStatus ?? undefined,
  );
  /** Battery storage status — actual presence, not just PV suitability. */
  const [batteryStatus, setBatteryStatus] = useState<'none' | 'existing' | 'planned' | undefined>(
    () => prefill?.batteryStatus ?? undefined,
  );
  /** Hydraulic step — flow-demand chart hidden by default to keep the step fast. */
  const [showHydraulicDetail, setShowHydraulicDetail] = useState(false);
  /** Hot-water step — outlet-vs-demand analysis hidden by default. */
  const [showHotWaterAnalysis, setShowHotWaterAnalysis] = useState(false);

  /** Shared button style for inline detail-expand toggles. */
  const detailToggleStyle: CSSProperties = {
    border: 'none', background: 'transparent', color: '#3182ce',
    cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left', padding: '0.25rem 0',
  };

  // Derived values — update whenever any fabric control changes
  const derivedTau = useMemo(() => deriveTau(thermalMass, insulationLevel, airTightness), [thermalMass, insulationLevel, airTightness]);
  const fabricType: BuildingFabricType = useMemo(() => deriveFabricType(thermalMass, insulationLevel, airTightness), [thermalMass, insulationLevel, airTightness]);
  const heatLossBand = useMemo(() => deriveHeatLossBand(wallType, insulationLevel, glazing, roofInsulation), [wallType, insulationLevel, glazing, roofInsulation]);
  const inertiaBand = useMemo(() => deriveInertiaBand(derivedTau), [derivedTau]);
  const decayTrace = useMemo(() => buildDecayTrace(derivedTau), [derivedTau]);

  // Keep buildingMass and building.fabric in engine input in sync with the fabric controls
  useEffect(() => {
    const wallTypeForEngine =
      wallType === 'solid_masonry'        ? 'solid_masonry' :
      wallType === 'cavity_insulated'     ? 'cavity_filled' :
      wallType === 'cavity_uninsulated'   ? 'solid_masonry' :
      'timber_frame' as const;
    const airTightnessForEngine =
      airTightness === 'passive_level' ? 'passive' : airTightness as 'leaky' | 'average' | 'tight';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInput(prev => ({
      ...prev,
      buildingMass: deriveBuildingMass(thermalMass),
      building: {
        fabric: {
          wallType:       wallTypeForEngine,
          insulationLevel,
          glazing,
          roofInsulation,
          airTightness:   airTightnessForEngine,
        },
        thermalMass,
      },
    }));
  }, [wallType, insulationLevel, airTightness, glazing, roofInsulation, thermalMass]);

  // ── Hydraulic derived values — update when pipe size or heat loss changes ──
  const hydraulicLive = useMemo(() => {
    const kw = input.heatLossWatts / 1000;
    const pipeKey = ([35, 28, 22, 15] as const).find(k => input.primaryPipeDiameter >= k) ?? 15;
    const thresholds = PIPE_THRESHOLDS[pipeKey];
    const boilerFlowLpm = calcFlowLpm(kw, 20);
    const ashpFlowLpm   = calcFlowLpm(kw, 5);
    const boilerRisk    = uiClassifyRisk(kw, thresholds.boilerWarnKw, thresholds.boilerFailKw);
    const ashpRisk      = uiClassifyRisk(kw, thresholds.ashpWarnKw,   thresholds.ashpFailKw);
    const flowRatio     = boilerFlowLpm > 0 ? (ashpFlowLpm / boilerFlowLpm).toFixed(1) : '4.0';
    return { kw, boilerFlowLpm, ashpFlowLpm, boilerRisk, ashpRisk, flowRatio };
  }, [input.primaryPipeDiameter, input.heatLossWatts]);

  const flowCurveData = useMemo(
    () => buildFlowCurve(input.primaryPipeDiameter),
    [input.primaryPipeDiameter],
  );

  // ── DHW derived values — update when demand inputs change ──────────────────
  // eslint-disable-next-line react-hooks/preserve-manual-memoization, react-hooks/exhaustive-deps
  const combiDhwLive = useMemo(() => runCombiDhwModuleV1(input), [
    input.dynamicMainsPressure,
    input.peakConcurrentOutlets,
    input.bathroomCount,
    input.occupancySignature,
    input.occupancyCount,
  ]);
  const dhwBand = useMemo(
    () => dhwDemandBand(input.bathroomCount, input.peakConcurrentOutlets ?? 1, input.highOccupancy),
    [input.bathroomCount, input.peakConcurrentOutlets, input.highOccupancy],
  );

  // ── Pressure derived values ─────────────────────────────────────────────────
  const pressureAnalysis = useMemo(
    () => analysePressure(
      input.dynamicMainsPressureBar ?? input.dynamicMainsPressure,
      input.staticMainsPressureBar,
    ),
    [input.dynamicMainsPressure, input.dynamicMainsPressureBar, input.staticMainsPressureBar],
  );
  const inputWarnings = useMemo(() => collectInputValidationWarnings(input), [input]);

  // ── PV assessment — recomputed when solar inputs change ────────────────────
  const livePvAssessment = useMemo(
    () => runPvAssessmentModule(toEngineInput(input)),
    [
      input.roofType,
      input.roofOrientation,
      input.solarShading,
      input.pvStatus,
      input.batteryStatus,
      input.dhwTankType,
      input.occupancySignature,
      input.preferCombi,
    ],
  );

  // ── System condition inference — heating + DHW diagnostics ─────────────────
  const systemConditionFlags = useMemo(() => inferSystemConditionFlags({
    heatingCondition: input.fullSurvey?.heatingCondition,
    dhwCondition: input.fullSurvey?.dhwCondition,
    waterHardnessCategory: hardnessPreview?.hardnessCategory,
    systemAgeYears: input.systemAgeYears,
  }), [
    input.fullSurvey?.heatingCondition,
    input.fullSurvey?.dhwCondition,
    hardnessPreview?.hardnessCategory,
    input.systemAgeYears,
  ]);

  const stepIndex = STEPS.indexOf(currentStep);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  // Scroll to top whenever the active step changes so the user always sees the
  // top of the new step — prevents "mid-page carryover" between steps.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentStep]);

  /** Build a draft that embeds compareMixergy into fullSurvey for persistence. */
  const buildDraft = (): FullSurveyModelV1 => ({
    ...input,
    fullSurvey: {
      ...input.fullSurvey,
      compareMixergy,
    },
  });

  const next = () => {
    if (currentStep === 'overlay') {
      // Strip fullSurvey extras — pass only the EngineInputV2_3 subset to the engine.
      const draft = buildDraft();
      const engineInput = toEngineInput(sanitiseModelForEngine(draft));
      if (onDraft) onDraft(draft);
      if (onComplete) {
        // Route directly to the simulator dashboard without stopping at LiveHubPage.
        onComplete(engineInput);
        return;
      }
      const engineResult = runEngine(engineInput);
      setResults(engineResult);
      setMode('hub');
      return;
    }
    // Autosave draft on every step transition so partial survey state survives
    // page refresh / navigate-away / save-reload.
    if (onDraft) onDraft(buildDraft());
    setCurrentStep(STEPS[stepIndex + 1]);
  };

  const prev = () => {
    if (stepIndex === 0) {
      onBack();
    } else {
      setCurrentStep(STEPS[stepIndex - 1]);
    }
  };

  // selectedArchetype shape kept for LifestyleComfortStep compatibility
  const selectedArchetype = { label: `${thermalMass} mass / ${insulationLevel}`, tauHours: derivedTau, fabricType };

  if (mode === 'hub' && results) {
    return (
      <LiveHubPage
        result={results}
        input={input}
        onBack={() => setMode('stepper')}
      />
    );
  }

  // Heat loss calculator overlay — shown above the stepper when triggered.
  if (showHeatLossCalc) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: OVERLAY_Z_INDEX, overflowY: 'auto', background: '#f8fafc' }}>
        <HeatLossCalculator
          onBack={() => setShowHeatLossCalc(false)}
          onComplete={(totalHL) => {
            setInput(prev => ({ ...prev, heatLossWatts: Math.round(totalHL * 1000) }));
            setShowHeatLossCalc(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="stepper-container">
      {showPrefillBanner && prefillActive && (
        <div className="prefill-banner" role="status">
          <span>Prefilled from Fast Choice.</span>
          <button
            type="button"
            className="prefill-banner__reset"
            onClick={() => { setInput(defaultInput); setShowPrefillBanner(false); }}
          >
            Reset to defaults
          </button>
          <button
            type="button"
            className="prefill-banner__dismiss"
            onClick={() => setShowPrefillBanner(false)}
          >
            ✕
          </button>
        </div>
      )}
      <div className="stepper-header">
        <button className="back-btn" onClick={prev}>← Back</button>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="step-label">Step {stepIndex + 1} of {STEPS.length}</span>
      </div>

      {/* Live physics overlay — shown on steps that have a step key mapping */}
      {liveEngineOutput && overlayStepKey && (
        <div style={{ maxWidth: '100%' }}>
          <DeltaStrip previous={prevEngineOutput} current={liveEngineOutput} />
          <LivePhysicsOverlay
            engineOutput={liveEngineOutput}
            activeStepKey={overlayStepKey}
          />
        </div>
      )}

      {currentStep === 'location' && (
        <div className="step-card">
          <h2>📍 Step 1: Geochemical &amp; Fabric Baseline</h2>

          <div className="form-grid">
            <div className="form-field">
              <label>Postcode outward code (first two characters, e.g. SW, BH, DT)</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  value={input.postcode}
                  onChange={e => { setInput({ ...input, postcode: normalizePostcodeOutward(e.target.value) }); setHardnessPreview(null); }}
                  placeholder="e.g. SW1A, BH or DT"
                  style={{ flex: 1 }}
                  onKeyDown={e => { if (e.key === 'Enter') searchHardness(); }}
                />
                <button
                  onClick={searchHardness}
                  style={{
                    padding: '0.45rem 0.9rem',
                    background: '#3182ce',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Submit
                </button>
              </div>
              {hardnessPreview && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  background: hardnessPreview.hardnessCategory === 'soft' ? '#f0fff4' : hardnessPreview.hardnessCategory === 'very_hard' ? '#fff5f5' : '#fffaf0',
                  border: `1px solid ${hardnessPreview.hardnessCategory === 'soft' ? '#68d391' : hardnessPreview.hardnessCategory === 'very_hard' ? '#fc8181' : '#fbd38d'}`,
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  color: '#2d3748',
                }}>
                  <strong>Water hardness: {hardnessPreview.hardnessCategory.replace('_', ' ').toUpperCase()}</strong> ({hardnessPreview.ppmLevel} ppm)
                  <div style={{ color: '#718096', marginTop: '0.2rem' }}>{hardnessPreview.description}</div>
                </div>
              )}
            </div>
          </div>

          {/* ─── Section A: Fabric heat-loss controls ─────────────────── */}
          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#2d3748', marginBottom: '0.1rem' }}>
              🧱 Section A — Fabric Heat-Loss Controls
            </h3>
            <p style={{ fontSize: '0.83rem', color: '#718096', marginBottom: '0.875rem' }}>
              Drives the <em>heat-loss band</em> — how hard the building leaks energy.
              Solid masonry without insulation leaks as badly as any wall type.
            </p>

            {/* ── Building controls ── */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: '0.4rem', color: '#4a5568' }}>
                🏠 Building fabric controls
              </label>
              <div style={{ fontSize: '0.74rem', color: '#718096', marginTop: '0.35rem' }}>
                Building presets removed — adjust this home directly with advanced controls.
                {' '}
                <button onClick={() => setShowAdvancedFabric(v => !v)} style={{ border: 'none', background: 'transparent', color: '#3182ce', cursor: 'pointer' }}>
                  {showAdvancedFabric ? 'Hide advanced controls' : 'Show advanced controls'}
                </button>
              </div>
            </div>

            {/* ── Solar PV — roof type, orientation, shading ──────────────── */}
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Roof type */}
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: '0.3rem', color: '#4a5568' }}>
                  🏠 What type of roof is most usable for solar panels?
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                  {([
                    { value: 'pitched', label: 'Pitched' },
                    { value: 'flat',    label: 'Flat' },
                    { value: 'mixed',   label: 'Mixed' },
                    { value: 'unknown', label: 'Not sure' },
                  ] as Array<{ value: 'pitched' | 'flat' | 'mixed' | 'unknown'; label: string }>).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        const next = roofType === opt.value ? undefined : opt.value;
                        setRoofType(next);
                        setInput(prev => ({ ...prev, roofType: next }));
                      }}
                      style={{
                        padding: '0.5rem 0.4rem',
                        border: `2px solid ${roofType === opt.value ? '#d69e2e' : '#e2e8f0'}`,
                        borderRadius: '6px',
                        background: roofType === opt.value ? '#fffff0' : '#fff',
                        cursor: 'pointer',
                        fontWeight: roofType === opt.value ? 700 : 400,
                        fontSize: '0.82rem',
                        textAlign: 'center',
                        transition: 'all 0.12s',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Roof orientation */}
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: '0.3rem', color: '#4a5568' }}>
                  🧭 What direction does the main usable roof face?
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                  {([
                    { value: 'north',      label: '↑ N' },
                    { value: 'east',       label: '→ E' },
                    { value: 'south',      label: '↓ S' },
                    { value: 'west',       label: '← W' },
                    { value: 'south_east', label: '↘ SE' },
                    { value: 'south_west', label: '↙ SW' },
                    { value: 'mixed',      label: 'Mixed' },
                    { value: 'unknown',    label: 'Not sure' },
                  ] as Array<{
                    value: 'north' | 'east' | 'south' | 'west' | 'south_east' | 'south_west' | 'mixed' | 'unknown';
                    label: string;
                  }>).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        const next = roofOrientation === opt.value ? undefined : opt.value;
                        setRoofOrientation(next);
                        setInput(prev => ({ ...prev, roofOrientation: next }));
                      }}
                      style={{
                        padding: '0.5rem 0.4rem',
                        border: `2px solid ${roofOrientation === opt.value ? '#d69e2e' : '#e2e8f0'}`,
                        borderRadius: '6px',
                        background: roofOrientation === opt.value ? '#fffff0' : '#fff',
                        cursor: 'pointer',
                        fontWeight: roofOrientation === opt.value ? 700 : 400,
                        fontSize: '0.82rem',
                        textAlign: 'center',
                        transition: 'all 0.12s',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {roofOrientation !== undefined && roofOrientation !== 'unknown' && (() => {
                  const isFavourable = roofOrientation === 'south' || roofOrientation === 'south_east' || roofOrientation === 'south_west' || roofOrientation === 'mixed';
                  const isNorth = roofOrientation === 'north';
                  const style: CSSProperties = isFavourable
                    ? { background: '#f0fff4', color: '#276749', border: '1px solid #9ae6b4' }
                    : isNorth
                      ? { background: '#fff5f5', color: '#9b2c2c', border: '1px solid #feb2b2' }
                      : { background: '#fffaf0', color: '#7b341e', border: '1px solid #fbd38d' };
                  const message = isFavourable
                    ? '✅ Favourable orientation for solar PV — needs roof survey to confirm'
                    : isNorth
                      ? '❌ North-facing roof — poor PV candidate; alternative sections should be assessed'
                      : '⚠️ Roof orientation less optimal for PV — east/west-facing pitches generate less';
                  return (
                    <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 500, ...style }}>
                      {message}
                    </div>
                  );
                })()}
              </div>

              {/* Shading */}
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: '0.3rem', color: '#4a5568' }}>
                  🌳 How shaded is the usable roof?
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                  {([
                    { value: 'low',     label: 'Little or none' },
                    { value: 'medium',  label: 'Some shading' },
                    { value: 'high',    label: 'Heavy shading' },
                    { value: 'unknown', label: 'Not sure' },
                  ] as Array<{ value: 'low' | 'medium' | 'high' | 'unknown'; label: string }>).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        const next = solarShading === opt.value ? undefined : opt.value;
                        setSolarShading(next);
                        setInput(prev => ({ ...prev, solarShading: next }));
                      }}
                      style={{
                        padding: '0.5rem 0.4rem',
                        border: `2px solid ${solarShading === opt.value ? '#d69e2e' : '#e2e8f0'}`,
                        borderRadius: '6px',
                        background: solarShading === opt.value ? '#fffff0' : '#fff',
                        cursor: 'pointer',
                        fontWeight: solarShading === opt.value ? 700 : 400,
                        fontSize: '0.82rem',
                        textAlign: 'center',
                        transition: 'all 0.12s',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {solarShading === 'high' && (
                  <div style={{
                    marginTop: '0.5rem',
                    padding: '0.4rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    background: '#fff5f5', color: '#9b2c2c', border: '1px solid #feb2b2',
                  }}>
                    ⚠️ Heavy shading significantly reduces solar PV viability — a detailed shading analysis is recommended
                  </div>
                )}
              </div>

              {/* ── PV status — actual installation, not just roof suitability ── */}
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: '0.3rem', color: '#4a5568' }}>
                  ☀️ Does this property have or plan solar PV panels?
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                  {([
                    { value: 'none',     label: '🚫 None',     sub: 'No PV installed or planned' },
                    { value: 'existing', label: '✅ Existing', sub: 'PV panels already installed' },
                    { value: 'planned',  label: '🔜 Planned',  sub: 'Planning to install PV' },
                  ] as Array<{ value: 'none' | 'existing' | 'planned'; label: string; sub: string }>).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        const next = pvStatus === opt.value ? undefined : opt.value;
                        setPvStatus(next);
                        setInput(prev => ({ ...prev, pvStatus: next }));
                      }}
                      style={{
                        padding: '0.5rem 0.4rem',
                        border: `2px solid ${pvStatus === opt.value ? '#d69e2e' : '#e2e8f0'}`,
                        borderRadius: '6px',
                        background: pvStatus === opt.value ? '#fffff0' : '#fff',
                        cursor: 'pointer',
                        fontWeight: pvStatus === opt.value ? 700 : 400,
                        fontSize: '0.82rem',
                        textAlign: 'center',
                        transition: 'all 0.12s',
                      }}
                    >
                      <div>{opt.label}</div>
                      <div style={{ fontSize: '0.72rem', color: '#718096', marginTop: '0.15rem' }}>{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Battery status ──────────────────────────────────────────── */}
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: '0.3rem', color: '#4a5568' }}>
                  🔋 Does this property have or plan a battery storage system?
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                  {([
                    { value: 'none',     label: '🚫 None',     sub: 'No battery installed or planned' },
                    { value: 'existing', label: '✅ Existing', sub: 'Battery already installed' },
                    { value: 'planned',  label: '🔜 Planned',  sub: 'Planning to add a battery' },
                  ] as Array<{ value: 'none' | 'existing' | 'planned'; label: string; sub: string }>).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        const next = batteryStatus === opt.value ? undefined : opt.value;
                        setBatteryStatus(next);
                        setInput(prev => ({ ...prev, batteryStatus: next }));
                      }}
                      style={{
                        padding: '0.5rem 0.4rem',
                        border: `2px solid ${batteryStatus === opt.value ? '#d69e2e' : '#e2e8f0'}`,
                        borderRadius: '6px',
                        background: batteryStatus === opt.value ? '#fffff0' : '#fff',
                        cursor: 'pointer',
                        fontWeight: batteryStatus === opt.value ? 700 : 400,
                        fontSize: '0.82rem',
                        textAlign: 'center',
                        transition: 'all 0.12s',
                      }}
                    >
                      <div>{opt.label}</div>
                      <div style={{ fontSize: '0.72rem', color: '#718096', marginTop: '0.15rem' }}>{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Derived PV summary — closes the loop ────────────────────── */}
              {(() => {
                const pv = livePvAssessment;
                const pvStatusLabel =
                  pvStatus === 'existing' ? 'Existing' :
                  pvStatus === 'planned'  ? 'Planned'  :
                  pvStatus === 'none'     ? 'None'     : 'Not captured';
                const batteryLabel =
                  batteryStatus === 'existing' ? 'Existing' :
                  batteryStatus === 'planned'  ? 'Planned'  :
                  batteryStatus === 'none'     ? 'None'     : 'Not captured';
                const suitabilityColour =
                  pv.pvSuitability === 'good'    ? '#276749' :
                  pv.pvSuitability === 'fair'    ? '#7b341e' :
                  '#9b2c2c';
                const alignmentLabel =
                  pv.energyDemandAlignment === 'aligned'        ? 'Strong' :
                  pv.energyDemandAlignment === 'partly_aligned' ? 'Moderate' :
                  'Limited';
                const generationLabel =
                  pv.pvGenerationTimingProfile === 'peak_daytime'   ? 'Strong (peak midday)' :
                  pv.pvGenerationTimingProfile === 'spread'          ? 'Moderate (morning/afternoon)' :
                  'Limited (seasonal / high shading)';
                const hasBattery = batteryStatus === 'existing' || batteryStatus === 'planned';
                const bestUseLabel =
                  pv.solarStorageOpportunity === 'high'   ? 'Stored hot water / Mixergy' :
                  pv.solarStorageOpportunity === 'medium' ? (hasBattery ? 'Battery + direct use' : 'Direct daytime use') :
                  'Limited benefit without storage';
                return (
                  <div style={{
                    border: '1px solid #d69e2e',
                    borderRadius: '8px',
                    background: '#fffff0',
                    padding: '0.75rem 1rem',
                    fontSize: '0.8rem',
                    color: '#4a5568',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem', color: '#744210' }}>
                      ☀️ Solar / PV Summary
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem 1rem' }}>
                      <div><span style={{ fontWeight: 600 }}>PV status:</span> {pvStatusLabel}</div>
                      <div><span style={{ fontWeight: 600 }}>Battery:</span> {batteryLabel}</div>
                      <div>
                        <span style={{ fontWeight: 600 }}>PV suitability:</span>{' '}
                        <span style={{ color: suitabilityColour, fontWeight: 600 }}>
                          {pv.pvSuitability.charAt(0).toUpperCase() + pv.pvSuitability.slice(1)}
                        </span>
                      </div>
                      <div><span style={{ fontWeight: 600 }}>Likely generation:</span> {generationLabel}</div>
                      <div><span style={{ fontWeight: 600 }}>Demand alignment:</span> {alignmentLabel}</div>
                      <div><span style={{ fontWeight: 600 }}>Best use here:</span> {bestUseLabel}</div>
                    </div>
                  </div>
                );
              })()}

            </div>

            {showAdvancedFabric && (
              <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', alignItems: 'start' }}>

              {/* Left: heat-loss levers */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Wall Construction */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: '0.4rem', color: '#4a5568' }}>
                    Wall Construction
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {([
                      { value: 'solid_masonry',      label: 'Solid masonry',           sub: '225 mm brick / stone — leaky until insulated' },
                      { value: 'cavity_uninsulated',  label: 'Cavity (uninsulated)',    sub: 'Empty cavity — high exposure / turn of century homes' },
                      { value: 'cavity_insulated',    label: 'Cavity (insulated)',      sub: 'Full or partial fill — medium baseline loss' },
                      { value: 'timber_lightweight',  label: 'Timber / lightweight',    sub: 'Frame or light block — low baseline loss' },
                    ] as Array<{ value: WallType; label: string; sub: string }>).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setWallType(opt.value); }}
                        style={{
                          padding: '0.5rem 0.75rem',
                          border: `2px solid ${wallType === opt.value ? '#3182ce' : '#e2e8f0'}`,
                          borderRadius: '6px',
                          background: wallType === opt.value ? '#ebf8ff' : '#fff',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.12s',
                        }}
                      >
                        <div style={{ fontWeight: wallType === opt.value ? 700 : 500, fontSize: '0.88rem' }}>{opt.label}</div>
                        <div style={{ fontSize: '0.75rem', color: '#718096' }}>{opt.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Insulation Level */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: '0.4rem', color: '#4a5568' }}>
                    Insulation Level
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    {(['poor', 'moderate', 'good', 'exceptional'] as InsulationLevel[]).map(lvl => (
                      <button
                        key={lvl}
                        onClick={() => { setInsulationLevel(lvl); }}
                        style={{
                          padding: '0.45rem 0.6rem',
                          border: `2px solid ${insulationLevel === lvl ? '#38a169' : '#e2e8f0'}`,
                          borderRadius: '6px',
                          background: insulationLevel === lvl ? '#f0fff4' : '#fff',
                          cursor: 'pointer',
                          fontWeight: insulationLevel === lvl ? 700 : 400,
                          fontSize: '0.85rem',
                          textTransform: 'capitalize',
                          transition: 'all 0.12s',
                        }}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Glazing */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: '0.4rem', color: '#4a5568' }}>
                    Glazing
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                    {([
                      { value: 'single', label: 'Single' },
                      { value: 'double', label: 'Double' },
                      { value: 'triple', label: 'Triple' },
                    ] as Array<{ value: Glazing; label: string }>).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setGlazing(opt.value); }}
                        style={{
                          padding: '0.45rem 0.6rem',
                          border: `2px solid ${glazing === opt.value ? '#3182ce' : '#e2e8f0'}`,
                          borderRadius: '6px',
                          background: glazing === opt.value ? '#ebf8ff' : '#fff',
                          cursor: 'pointer',
                          fontWeight: glazing === opt.value ? 700 : 400,
                          fontSize: '0.85rem',
                          transition: 'all 0.12s',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Roof Insulation */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: '0.4rem', color: '#4a5568' }}>
                    Roof Insulation
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                    {(['poor', 'moderate', 'good'] as RoofInsulation[]).map(lvl => (
                      <button
                        key={lvl}
                        onClick={() => { setRoofInsulation(lvl); }}
                        style={{
                          padding: '0.45rem 0.6rem',
                          border: `2px solid ${roofInsulation === lvl ? '#dd6b20' : '#e2e8f0'}`,
                          borderRadius: '6px',
                          background: roofInsulation === lvl ? '#fffaf0' : '#fff',
                          cursor: 'pointer',
                          fontWeight: roofInsulation === lvl ? 700 : 400,
                          fontSize: '0.85rem',
                          textTransform: 'capitalize',
                          transition: 'all 0.12s',
                        }}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Air Tightness */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: '0.4rem', color: '#4a5568' }}>
                    Air Tightness
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    {([
                      { value: 'leaky',        label: 'Leaky' },
                      { value: 'average',      label: 'Average' },
                      { value: 'tight',        label: 'Tight' },
                      { value: 'passive_level',label: 'Passive-level' },
                    ] as Array<{ value: AirTightness; label: string }>).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setAirTightness(opt.value); }}
                        style={{
                          padding: '0.45rem 0.6rem',
                          border: `2px solid ${airTightness === opt.value ? '#805ad5' : '#e2e8f0'}`,
                          borderRadius: '6px',
                          background: airTightness === opt.value ? '#faf5ff' : '#fff',
                          cursor: 'pointer',
                          fontWeight: airTightness === opt.value ? 700 : 400,
                          fontSize: '0.85rem',
                          transition: 'all 0.12s',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Live outputs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                {/* Heat-loss band */}
                <div style={{
                  padding: '0.875rem 1rem',
                  background: '#f7fafc',
                  border: `2px solid ${heatLossBand.colour}`,
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                }}>
                  <div style={{ fontSize: '0.78rem', color: '#718096', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Fabric Heat-Loss Band
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: heatLossBand.colour, lineHeight: 1 }}>
                    {heatLossBand.label}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#718096' }}>
                    Driven by wall + insulation + glazing + roof
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#718096' }}>
                    Modelled estimate — not a measured survey value
                  </div>
                </div>

                {/* Section B: Thermal inertia / τ */}
                <div style={{
                  padding: '0.875rem 1rem',
                  background: '#ebf8ff',
                  border: '2px solid #3182ce',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}>
                  <div style={{ fontSize: '0.78rem', color: '#2b6cb0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Thermal Inertia (τ)
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a365d', lineHeight: 1 }}>
                    τ = {derivedTau}h&nbsp;
                    <span style={{ fontSize: '1rem', fontWeight: 600, color: inertiaBand.colour }}>
                      ({inertiaBand.label})
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#4a5568' }}>
                    Derived from thermal mass + insulation + airtightness
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#718096' }}>
                    Modelled estimate — high τ means slow to cool, not necessarily efficient
                  </div>
                </div>

                {/* Decay trace */}
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#718096', marginBottom: '0.3rem' }}>
                    Heating response curve — 10 h unheated window (20°C → 5°C outdoor)
                  </div>
                  <div style={{ height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={decayTrace} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#edf2f7" />
                        <XAxis dataKey="hourOffset" tickFormatter={h => `+${h}h`} tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 22]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}°`} />
                        <Tooltip formatter={tempTooltipFormatter} />
                        <ReferenceLine y={16} stroke="#e53e3e" strokeDasharray="4 4" label={{ value: '16°C min', fontSize: 9, fill: '#e53e3e' }} />
                        <Line type="monotone" dataKey="tempC" stroke="#3182ce" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Section B: Thermal Mass (separate from wall type) ────── */}
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '2px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#2d3748', marginBottom: '0.2rem' }}>
                ⚖️ Section B — Thermal Mass (Inertia)
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#718096', marginBottom: '0.75rem' }}>
                Sets how spiky heating demand feels. Independent of heat loss — solid brick has
                heavy mass but can still leak badly without insulation.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                {([
                  { value: 'light',  label: 'Light',  sub: 'Timber / plasterboard — fast response' },
                  { value: 'medium', label: 'Medium', sub: 'Cavity / screed — moderate inertia' },
                  { value: 'heavy',  label: 'Heavy',  sub: 'Solid brick / concrete — slow to cool' },
                ] as Array<{ value: ThermalMass; label: string; sub: string }>).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setThermalMass(opt.value); }}
                    style={{
                      padding: '0.6rem 0.75rem',
                      border: `2px solid ${thermalMass === opt.value ? '#3182ce' : '#e2e8f0'}`,
                      borderRadius: '6px',
                      background: thermalMass === opt.value ? '#ebf8ff' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.12s',
                    }}
                  >
                    <div style={{ fontWeight: thermalMass === opt.value ? 700 : 500, fontSize: '0.88rem' }}>{opt.label}</div>
                    <div style={{ fontSize: '0.73rem', color: '#718096' }}>{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>
              </>
            )}

          </div>

          <div className="step-actions">
            <button className="next-btn" onClick={next}>Next →</button>
          </div>
        </div>
      )}

      {currentStep === 'pressure' && (
        <div className="step-card">
          <h2>💧 Step 2: Mains Supply &amp; Flow</h2>

          {/* ─── Physics levers + live panel ─────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', alignItems: 'start' }}>

            {/* Left: controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Static pressure */}
              <div className="form-field">
                <label style={{ fontWeight: 600, fontSize: '0.88rem', color: '#4a5568' }}>
                  Static pressure (bar) — no flow
                </label>
                <input
                  type="number"
                  min={0.5}
                  max={8}
                  step={0.1}
                  value={input.staticMainsPressureBar ?? ''}
                  placeholder="e.g. 3.5 — optional"
                  onChange={e => setInput(prev => ({
                    ...prev,
                    staticMainsPressureBar: e.target.value ? +e.target.value : undefined,
                  }))}
                  style={{ marginTop: '0.4rem' }}
                />
                <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.25rem' }}>
                  Measured with all taps closed. Leave blank if not taken.
                </div>
              </div>

              {/* Dynamic pressure */}
              <div className="form-field">
                <label style={{ fontWeight: 600, fontSize: '0.88rem', color: '#4a5568' }}>
                  Dynamic pressure (bar) — under flow
                </label>
                <input
                  type="number"
                  min={0.1}
                  max={8}
                  step={0.1}
                  value={rawPressureStr}
                  onChange={e => {
                    const raw = e.target.value;
                    setRawPressureStr(raw);
                    const val = parseOptionalNumber(raw);
                    if (val !== undefined) {
                      setInput(prev => ({
                        ...prev,
                        dynamicMainsPressure: val,
                        dynamicMainsPressureBar: val,
                      }));
                    }
                  }}
                  onBlur={() => setRawPressureStr(r => normaliseNumericString(r))}
                  style={{ marginTop: '0.4rem' }}
                />
                <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.25rem' }}>
                  Measured with the cold tap running at full bore.
                </div>
              </div>

              {/* Dynamic flow */}
              <div className="form-field">
                <label style={{ fontWeight: 600, fontSize: '0.88rem', color: '#4a5568' }}>
                  Dynamic flow (L/min) — at pressure
                </label>
                <input
                  type="number"
                  min={0.5}
                  max={40}
                  step={0.5}
                  value={rawFlowStr}
                  placeholder="e.g. 12 — optional"
                  onChange={e => {
                    const raw = e.target.value;
                    setRawFlowStr(raw);
                    const parsed = parseOptionalNumber(raw);
                    const flow = parsed !== undefined && parsed > 0 ? parsed : undefined;
                    // Mark as a confirmed measured reading whenever the surveyor
                    // enters a value — anything typed here is a real site measurement.
                    setInput(prev => ({
                      ...prev,
                      mainsDynamicFlowLpm: flow,
                      mainsDynamicFlowLpmKnown: flow !== undefined ? true : undefined,
                    }));
                  }}
                  onBlur={() => setRawFlowStr(r => normaliseNumericString(r))}
                  style={{ marginTop: '0.4rem' }}
                />
                <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.25rem' }}>
                  Measured simultaneously with dynamic pressure. Leave blank if not taken.
                </div>
              </div>

              {/* Operating point hint — show when only one of pressure/flow is present */}
              {input.mainsDynamicFlowLpm == null && (
                <div style={{
                  padding: '0.5rem 0.75rem',
                  background: '#fffff0',
                  border: '1px solid #faf089',
                  borderLeft: '4px solid #d69e2e',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  color: '#744210',
                }}>
                  ℹ️ Enter flow (L/min) above to plot the operating point under load — this is the key supply signal.
                  {input.staticMainsPressureBar == null && <> Static pressure is also useful context but is not required for the operating-point assessment.</>}
                </div>
              )}
            </div>

            {/* Right: live response panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

              {/* Static → Dynamic arrow gauge */}
              <div style={{
                padding: '1rem',
                background: '#f7fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}>
                <div style={{ fontSize: '0.75rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
                  Supply pressure
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {/* Static */}
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: '0.72rem', color: '#718096', marginBottom: '0.2rem' }}>Static</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: input.staticMainsPressureBar != null ? '#1a365d' : '#cbd5e0', lineHeight: 1 }}>
                      {input.staticMainsPressureBar != null ? `${input.staticMainsPressureBar.toFixed(1)}` : '—'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>bar</div>
                  </div>
                  {/* Arrow */}
                  <div style={{ fontSize: '1.4rem', color: '#718096' }}>→</div>
                  {/* Dynamic */}
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: '0.72rem', color: '#718096', marginBottom: '0.2rem' }}>Dynamic</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a365d', lineHeight: 1 }}>
                      {input.dynamicMainsPressure.toFixed(1)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>bar</div>
                  </div>
                </div>
                {/* Drop line — diagnostic only, not eligibility */}
                {pressureAnalysis.dropBar != null && !pressureAnalysis.inconsistentReading && (
                  <div style={{
                    marginTop: '0.75rem',
                    paddingTop: '0.6rem',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.85rem',
                  }}>
                    <span style={{ color: '#718096' }}>
                      Drop: <strong>{pressureAnalysis.dropBar.toFixed(1)} bar</strong> — expected under flow
                    </span>
                    <span style={{
                      padding: '0.2rem 0.55rem',
                      background: DROP_COLOUR,
                      color: '#fff',
                      borderRadius: '4px',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                    }}>
                      Normal
                    </span>
                  </div>
                )}
                {/* Inconsistency warning */}
                {pressureAnalysis.inconsistentReading && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    background: '#fff5f5',
                    border: '1px solid #feb2b2',
                    borderLeft: '4px solid #c53030',
                    borderRadius: '4px',
                    fontSize: '0.82rem',
                    color: '#c53030',
                    fontWeight: 700,
                  }}>
                    ⚠️ Readings inconsistent — dynamic cannot exceed static. Recheck measurements.
                  </div>
                )}
              </div>

              {/* Drop bar visual — diagnostic only */}
              {pressureAnalysis.dropBar != null && !pressureAnalysis.inconsistentReading && (
                <div style={{ padding: '0.75rem', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.4rem' }}>
                    Pressure under load vs. static — drop under flow is expected
                  </div>
                  {/* Bar track: 0 to 2 bar */}
                  <div style={{ position: 'relative', background: '#e2e8f0', borderRadius: '4px', height: '12px' }}>
                    {/* Filled drop portion */}
                    <div style={{
                      width: `${Math.min((pressureAnalysis.dropBar / 2) * 100, 100)}%`,
                      background: DROP_COLOUR,
                      height: '100%', borderRadius: '4px', transition: 'width 0.2s',
                    }} />
                    {/* 1.0 bar marker */}
                    <div style={{ position: 'absolute', left: '50%', top: '-4px', bottom: '-4px', width: '2px', background: '#c53030' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#718096', marginTop: '0.25rem' }}>
                    <span>0</span><span>1.0 diagnostic marker</span><span>2.0 bar</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#4a5568', marginTop: '0.35rem' }}>
                    Dynamic pressure under flow is normally lower than static pressure.
                  </div>
                </div>
              )}

              {/* Unvented suitability indicator */}
              {(() => {
                const cwsResult = (() => {
                  const flowLpm = input.mainsDynamicFlowLpm;
                  // Pressure is "not recorded" when mainsPressureRecorded is explicitly false.
                  const pressureRecorded = input.mainsPressureRecorded !== false;
                  const pressureBar: number | undefined = pressureRecorded
                    ? (input.dynamicMainsPressureBar ?? input.dynamicMainsPressure)
                    : undefined;
                  const staticBar = input.staticMainsPressureBar;
                  const inconsistent = staticBar !== undefined && pressureBar !== undefined && pressureBar > staticBar + 0.2;
                  const hasFlow = flowLpm !== undefined && flowLpm > 0;
                  const flow = hasFlow ? (flowLpm as number) : 0;
                  // Operating-point evidence: flow ≥ 10 L/min AND pressure ≥ 1.0 bar
                  // Flow-only evidence: flow ≥ 12 L/min AND pressure not recorded (undefined)
                  const meetsReq = !inconsistent && hasFlow && (
                    (pressureBar !== undefined && flow >= 10 && pressureBar >= 1.0) ||
                    (pressureBar === undefined && flow >= 12)
                  );
                  return { inconsistent, hasMeasurements: hasFlow, meetsUnventedRequirement: meetsReq };
                })();
                const suit = unventedSuitability(cwsResult.meetsUnventedRequirement, cwsResult.hasMeasurements, cwsResult.inconsistent);
                return (
                  <div style={{
                    padding: '0.6rem 0.875rem',
                    background: '#f7fafc',
                    borderLeft: `4px solid ${suit.colour}`,
                    border: `1px solid ${suit.colour}44`,
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                  }}>
                    <div style={{ fontWeight: 700, color: suit.colour, marginBottom: '0.2rem' }}>
                      {suit.label}
                    </div>
                    <div style={{ color: '#4a5568' }}>{suit.note}</div>
                  </div>
                );
              })()}

              {/* Dynamic operating point summary */}
              {(() => {
                const pressureBar = input.dynamicMainsPressureBar ?? input.dynamicMainsPressure;
                const flowLpm = input.mainsDynamicFlowLpm;
                const hasFlow = flowLpm !== undefined && flowLpm > 0;
                const flow = hasFlow ? (flowLpm as number) : 0;
                return (
                  <>
                    {/* Operating-point visual — shown when both flow and pressure are available */}
                    {hasFlow && pressureBar !== undefined && (
                      <div style={{ padding: '0.75rem', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                        <OperatingPointChart flowLpm={flow} pressureBar={pressureBar} />
                      </div>
                    )}

                    {/* Text summary when chart cannot be shown */}
                    {(!hasFlow || pressureBar === undefined) && (
                      <div style={{
                        padding: '0.75rem',
                        background: hasFlow ? '#f0fff4' : '#fffff0',
                        border: `1px solid ${hasFlow ? '#9ae6b4' : '#faf089'}`,
                        borderRadius: '6px',
                        fontSize: '0.82rem',
                      }}>
                        <div style={{ fontWeight: 700, color: '#2d3748', marginBottom: '0.25rem' }}>Operating supply under load</div>
                        {hasFlow
                          ? <div style={{ color: '#276749' }}>✓ {flow.toFixed(1)} L/min (pressure not recorded — enter pressure to plot operating point)</div>
                          : <div style={{ color: '#744210' }}>Flow not entered — supply-quality assessment needs L/min @ bar.</div>
                        }
                        <div style={{ fontSize: '0.72rem', color: '#718096', marginTop: '0.3rem' }}>
                          {OPERATING_POINT_NOTE}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {input.mainsDynamicFlowLpm == null && (
            <div className="step-indicative-warning" role="alert">
              <span aria-hidden="true">⚠️</span>{' '}
              <strong>Indicative only</strong> — dynamic flow not entered. Supply-quality decisions will use estimated defaults. Enter L/min above for a reliable result.
            </div>
          )}
          <div className="step-actions">
            <button className="prev-btn" onClick={prev}>← Back</button>
            <button className="next-btn" onClick={next}>Next →</button>
          </div>
        </div>
      )}

      {currentStep === 'hydraulic' && (
        <div className="step-card">
          <h2>🔧 Step 3: Hydraulic Integrity</h2>

          {/* ─── Physics levers + live panel ─────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', alignItems: 'start', marginBottom: '1.5rem' }}>

            {/* Left: controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Pipe size button group */}
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: '0.4rem', color: '#4a5568' }}>
                  Primary Pipe Diameter
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  {([
                    { value: 15, label: '15 mm', sub: 'Microbore — severe ASHP limit' },
                    { value: 22, label: '22 mm', sub: 'Standard — covers most boilers' },
                    { value: 28, label: '28 mm', sub: 'Large bore — ASHP capable' },
                    { value: 35, label: '35 mm', sub: 'Oversized — heat main / commercial' },
                  ] as Array<{ value: number; label: string; sub: string }>).map(opt => {
                    const is22Bottleneck = opt.value === 22 && input.heatLossWatts > 8000;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setInput({ ...input, primaryPipeDiameter: opt.value })}
                        style={{
                          padding: '0.5rem 0.75rem',
                          border: `2px solid ${input.primaryPipeDiameter === opt.value ? '#805ad5' : '#e2e8f0'}`,
                          borderRadius: '6px',
                          background: input.primaryPipeDiameter === opt.value ? '#faf5ff' : '#fff',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.12s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontWeight: input.primaryPipeDiameter === opt.value ? 700 : 500, fontSize: '0.88rem' }}>{opt.label}</span>
                          {is22Bottleneck && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#fed7d7', color: '#c53030', padding: '1px 5px', borderRadius: '4px' }}>
                              ⚠️ Physics Alert: flow velocity exceeds 1.5 m/s
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#718096' }}>{opt.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* System Architecture button group */}
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: '0.4rem', color: '#4a5568' }}>
                  System Architecture
                </label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {([
                    { value: 's_plan' as const, label: 'S-Plan (Twin 2-port)', sub: 'Independent zone valves' },
                    { value: 'y_plan' as const, label: 'Y-Plan (3-port)', sub: 'Combined mid-position valve' },
                  ]).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setInput(prev => ({ ...prev, systemPlanType: opt.value }))}
                      style={{
                        flex: 1,
                        padding: '0.5rem 0.75rem',
                        border: `2px solid ${(input.systemPlanType ?? 'y_plan') === opt.value ? '#3182ce' : '#e2e8f0'}`,
                        borderRadius: '6px',
                        background: (input.systemPlanType ?? 'y_plan') === opt.value ? '#ebf8ff' : '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.12s',
                      }}
                    >
                      <div style={{ fontWeight: (input.systemPlanType ?? 'y_plan') === opt.value ? 700 : 500, fontSize: '0.88rem' }}>{opt.label}</div>
                      <div style={{ fontSize: '0.72rem', color: '#718096' }}>{opt.sub}</div>
                    </button>
                  ))}
                </div>
                {(input.systemPlanType ?? 'y_plan') === 'y_plan' && (
                  <p style={{ fontSize: '0.75rem', color: '#276749', marginTop: '0.3rem', background: '#f0fff4', padding: '0.3rem 0.5rem', borderRadius: '4px' }}>
                    Y-Plan is suitable at modest heat loads — simpler combined control architecture. S-plan offers greater separation and flexibility, but Y-plan remains a workable architecture for lower-demand cases.
                  </p>
                )}
              </div>

              {/* Heat loss input */}
              <div className="form-field">
                <label style={{ fontWeight: 600, fontSize: '0.88rem', color: '#4a5568' }}>
                  Design Heat Loss (kW)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.4rem' }}>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    step={0.5}
                    value={input.heatLossWatts / 1000}
                    onChange={e => setInput({ ...input, heatLossWatts: +e.target.value * 1000 })}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowHeatLossCalc(true)}
                    style={{
                      padding: '0.45rem 0.75rem',
                      border: '1.5px solid #805ad5',
                      borderRadius: '6px',
                      background: '#faf5ff',
                      color: '#553c9a',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'background 0.12s',
                    }}
                    title="Open the heat loss calculator to estimate design heat loss from your floor plan"
                  >
                    🔥 Calculate
                  </button>
                </div>
              </div>

              {/* ΔT reference (engine authority — locked display) */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1, padding: '0.5rem 0.75rem', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: '#718096' }}>Boiler ΔT</div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>20°C</div>
                </div>
                <div style={{ flex: 1, padding: '0.5rem 0.75rem', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: '#718096' }}>ASHP ΔT</div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>5°C</div>
                </div>
              </div>
            </div>

            {/* Right: live response panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

              {/* Boiler circuit badge */}
              <div style={{
                padding: '0.75rem 1rem',
                background: RISK_BG[hydraulicLive.boilerRisk],
                border: `2px solid ${RISK_COLOUR[hydraulicLive.boilerRisk]}`,
                borderRadius: '8px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Boiler circuit</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a365d', lineHeight: 1.1 }}>
                      {hydraulicLive.boilerFlowLpm.toFixed(1)} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>L/min</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>at ΔT 20°C</div>
                  </div>
                  <div style={{
                    padding: '0.3rem 0.65rem',
                    background: RISK_COLOUR[hydraulicLive.boilerRisk],
                    color: '#fff',
                    borderRadius: '4px',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                  }}>
                    {RISK_LABEL[hydraulicLive.boilerRisk]}
                  </div>
                </div>
              </div>

              {/* ASHP circuit badge */}
              <div style={{
                padding: '0.75rem 1rem',
                background: RISK_BG[hydraulicLive.ashpRisk],
                border: `2px solid ${RISK_COLOUR[hydraulicLive.ashpRisk]}`,
                borderRadius: '8px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.04em' }}>ASHP circuit</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a365d', lineHeight: 1.1 }}>
                      {hydraulicLive.ashpFlowLpm.toFixed(1)} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>L/min</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>
                      at ΔT 5°C · <strong>{hydraulicLive.flowRatio}×</strong> boiler flow
                    </div>
                  </div>
                  <div style={{
                    padding: '0.3rem 0.65rem',
                    background: RISK_COLOUR[hydraulicLive.ashpRisk],
                    color: '#fff',
                    borderRadius: '4px',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                  }}>
                    {RISK_LABEL[hydraulicLive.ashpRisk]}
                  </div>
                </div>
              </div>

              {/* Flow vs heat loss chart — hidden by default, revealed via detail toggle */}
              <button
                onClick={() => setShowHydraulicDetail(v => !v)}
                style={detailToggleStyle}
                data-testid="survey-hydraulic-detail-toggle"
                aria-expanded={showHydraulicDetail}
                aria-controls="survey-hydraulic-detail"
              >
                {showHydraulicDetail ? '▲ Hide flow demand curve' : '▼ Show flow demand curve'}
              </button>
              {showHydraulicDetail && (
              <div id="survey-hydraulic-detail" data-testid="survey-hydraulic-detail">
                <div style={{ fontSize: '0.78rem', color: '#718096', marginBottom: '0.3rem' }}>
                  Flow demand curve — {input.primaryPipeDiameter}mm pipe (0–20 kW)
                </div>
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={flowCurveData.data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#edf2f7" />
                      <XAxis dataKey="heatLossKw" tick={{ fontSize: 10 }} tickFormatter={v => `${v}kW`} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}L`} />
                      <Tooltip
                        formatter={(v, name) => [`${v} L/min`, name === 'boilerLpm' ? 'Boiler (ΔT 20°C)' : 'ASHP (ΔT 5°C)']}
                        labelFormatter={(label) => `Heat loss: ${label} kW`}
                      />
                      {/* Boiler warn / fail vertical thresholds */}
                      {flowCurveData.thresholds.boilerWarnKw <= 20 && (
                        <ReferenceLine x={flowCurveData.thresholds.boilerWarnKw} stroke="#d69e2e" strokeDasharray="3 3"
                          label={{ value: '⚠ boiler', fontSize: 9, fill: '#d69e2e', position: 'insideTopRight' }} />
                      )}
                      {flowCurveData.thresholds.boilerFailKw <= 20 && (
                        <ReferenceLine x={flowCurveData.thresholds.boilerFailKw} stroke="#c53030" strokeDasharray="3 3"
                          label={{ value: '✕ boiler', fontSize: 9, fill: '#c53030', position: 'insideTopRight' }} />
                      )}
                      {/* ASHP warn / fail vertical thresholds */}
                      {flowCurveData.thresholds.ashpWarnKw <= 20 && (
                        <ReferenceLine x={flowCurveData.thresholds.ashpWarnKw} stroke="#d69e2e" strokeDasharray="4 2"
                          label={{ value: '⚠ ASHP', fontSize: 9, fill: '#d69e2e', position: 'insideTopLeft' }} />
                      )}
                      {flowCurveData.thresholds.ashpFailKw <= 20 && (
                        <ReferenceLine x={flowCurveData.thresholds.ashpFailKw} stroke="#c53030" strokeDasharray="4 2"
                          label={{ value: '✕ ASHP', fontSize: 9, fill: '#c53030', position: 'insideTopLeft' }} />
                      )}
                      {/* Current heat loss marker */}
                      <ReferenceLine x={hydraulicLive.kw} stroke="#3182ce" strokeWidth={2}
                        label={{ value: `${hydraulicLive.kw.toFixed(1)}kW`, fontSize: 9, fill: '#3182ce', position: 'top' }} />
                      {/* 28mm Stabilized Path — shown when 22mm is in Fail zone */}
                      {input.primaryPipeDiameter === 22 && hydraulicLive.boilerRisk === 'fail' && PIPE_THRESHOLDS[28].ashpWarnKw <= 20 && (
                        <ReferenceLine x={PIPE_THRESHOLDS[28].ashpWarnKw} stroke="#38a169" strokeDasharray="3 3"
                          label={{ value: '28mm Stabilized', fontSize: 9, fill: '#38a169', position: 'insideTopLeft' }} />
                      )}
                      <Line type="monotone" dataKey="boilerLpm" stroke={hydraulicLive.boilerRisk !== 'pass' ? '#c53030' : '#dd6b20'} strokeWidth={2} dot={false} name="boilerLpm" />
                      <Line type="monotone" dataKey="ashpLpm"   stroke="#3182ce" strokeWidth={2} dot={false} name="ashpLpm" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              )}
            </div>
          </div>

          {/* ─── Secondary system details ─────────────────────────────────── */}
          <div className="form-grid">
            <div className="form-field">
              <label>Radiator Count</label>
              <input
                type="number"
                min={1}
                max={30}
                value={input.radiatorCount}
                onChange={e => setInput({ ...input, radiatorCount: +e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>Return Water Temp (°C)</label>
              <input
                type="number"
                min={30}
                max={80}
                step={5}
                value={input.returnWaterTemp}
                onChange={e => setInput({ ...input, returnWaterTemp: +e.target.value })}
              />
            </div>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={input.hasLoftConversion}
                onChange={e => setInput({ ...input, hasLoftConversion: e.target.checked })}
              />
              <span>Loft conversion present</span>
            </label>
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>🧲 Magnetic Filter (Sludge Guard)</label>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setInput({ ...input, hasMagneticFilter: true })}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    border: `2px solid ${input.hasMagneticFilter ? '#38a169' : '#e2e8f0'}`,
                    borderRadius: '6px',
                    background: input.hasMagneticFilter ? '#f0fff4' : '#fff',
                    cursor: 'pointer',
                    fontWeight: input.hasMagneticFilter ? 700 : 400,
                  }}
                >
                  ✅ Fitted – magnetite sludge captured
                </button>
                <button
                  onClick={() => setInput({ ...input, hasMagneticFilter: false })}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    border: `2px solid ${!input.hasMagneticFilter ? '#c53030' : '#e2e8f0'}`,
                    borderRadius: '6px',
                    background: !input.hasMagneticFilter ? '#fff5f5' : '#fff',
                    cursor: 'pointer',
                    fontWeight: !input.hasMagneticFilter ? 700 : 400,
                  }}
                >
                  ❌ Not fitted – Sludge Tax applies (47% radiator loss)
                </button>
              </div>
            </div>
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>🌡️ Emitter Type</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {([
                  { value: 'radiators', label: '🔲 Radiators only', desc: 'Conventional panel radiators' },
                  { value: 'ufh', label: '♨️ Underfloor heating', desc: 'UFH throughout — low flow temperature compatible' },
                  { value: 'mixed', label: '⚙️ Mixed emitters', desc: 'Combination of radiators and UFH' },
                ] as const).map(opt => {
                  const isSelected = (input.emitterType ?? 'radiators') === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setInput({ ...input, emitterType: opt.value })}
                      style={{
                        flex: 1,
                        minWidth: '8rem',
                        padding: '0.625rem',
                        border: `2px solid ${isSelected ? '#3182ce' : '#e2e8f0'}`,
                        borderRadius: '6px',
                        background: isSelected ? '#ebf8ff' : '#fff',
                        cursor: 'pointer',
                        fontWeight: isSelected ? 700 : 400,
                        fontSize: '0.85rem',
                        textAlign: 'left' as const,
                      }}
                      data-testid={`emitter-type-${opt.value}`}
                    >
                      <div>{opt.label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#718096', fontWeight: 400, marginTop: '0.2rem' }}>{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: '0.78rem', color: '#718096', marginTop: '0.3rem', lineHeight: 1.4 }}>
                UFH operates at lower flow temperatures — influences heat pump recommendation, condensing boiler efficiency range, and emitter upgrade advice.
              </p>
            </div>
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>Current Heat Source</label>
              <select
                value={input.currentHeatSourceType ?? 'other'}
                onChange={e => setInput({ ...input, currentHeatSourceType: e.target.value as EngineInputV2_3['currentHeatSourceType'] })}
              >
                <option value="combi">Combi Boiler</option>
                <option value="system">System Boiler</option>
                <option value="regular">Regular / Heat-only Boiler</option>
                <option value="ashp">Air Source Heat Pump</option>
                <option value="other">Other / Unknown</option>
              </select>
            </div>
            <div className="form-field">
              <label>Current Boiler Age (years)</label>
              <input
                type="number"
                min={0}
                max={40}
                value={input.currentBoilerAgeYears ?? ''}
                onChange={e => setInput({ ...input, currentBoilerAgeYears: e.target.value ? +e.target.value : undefined })}
                placeholder="e.g. 8"
              />
            </div>
            <div className="form-field">
              <label>Current Boiler Output (kW, optional)</label>
              <select
                value={input.currentBoilerOutputKw ?? ''}
                onChange={e => setInput({ ...input, currentBoilerOutputKw: e.target.value ? +e.target.value : undefined })}
              >
                <option value="">Select output (optional)</option>
                <option value="8">8 kW</option>
                <option value="12">12 kW</option>
                <option value="15">15 kW</option>
                <option value="16">16 kW</option>
                <option value="18">18 kW</option>
                <option value="19">19 kW</option>
                <option value="21">21 kW</option>
                <option value="24">24 kW</option>
                <option value="25">25 kW</option>
                <option value="30">30 kW</option>
                <option value="35">35 kW</option>
                <option value="40">40 kW</option>
                <option value="45">45 kW</option>
                <option value="50">50 kW</option>
              </select>
            </div>
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>Current Boiler Make / Model (optional)</label>
              <input
                type="text"
                value={input.makeModelText ?? ''}
                onChange={e => setInput({ ...input, makeModelText: e.target.value || undefined })}
                placeholder="e.g. Worcester Greenstar 30i"
              />
            </div>
            <div className="form-field">
              <label>Efficiency lookup helper (ErP)</label>
              <select
                value={input.currentBoilerErpClass ?? ''}
                onChange={e => {
                  const erpClass = (e.target.value || undefined) as FullSurveyModelV1['currentBoilerErpClass'];
                  setInput({
                    ...input,
                    currentBoilerErpClass: erpClass,
                    currentBoilerSedbukPct: erpClass ? ERP_TO_NOMINAL_PCT[erpClass] : input.currentBoilerSedbukPct,
                  });
                }}
              >
                <option value="">Select class (optional)</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
                <option value="E">E</option>
                <option value="F">F</option>
                <option value="G">G</option>
              </select>
              <p style={{ fontSize: '0.78rem', color: '#718096', marginTop: '0.3rem', lineHeight: 1.4 }}>
                Lookup helper only: select the label letter to pre-fill a SEDBUK % baseline. The engine models using the SEDBUK percentage below.
              </p>
            </div>
            <div className="form-field">
              <label>Boiler seasonal efficiency (SEDBUK %) — enter directly or use ErP lookup above</label>
              <input
                type="number"
                step={1}
                value={input.currentBoilerSedbukPct ?? ''}
                onChange={e => {
                  const parsed = parseOptionalNumber(e.target.value);
                  setInput({ ...input, currentBoilerSedbukPct: parsed });
                }}
                placeholder="e.g. 89 (leave blank to use 92% default)"
              />
              <p style={{ fontSize: '0.78rem', color: '#718096', marginTop: '0.3rem', lineHeight: 1.4 }}>
                Enter SEDBUK % directly (typically 78–94). The ErP letter is displayed on results as a derived output.
              </p>
            </div>
            {inputWarnings.length > 0 && (
              <div style={{ gridColumn: '1 / -1', background: '#fffaf0', border: '1px solid #fbd38d', borderRadius: '8px', padding: '0.625rem 0.875rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#975a16', marginBottom: '0.25rem' }}>Input validation warnings</div>
                <ul style={{ margin: 0, paddingLeft: '1rem', color: '#744210', fontSize: '0.8rem', lineHeight: 1.5 }}>
                  {inputWarnings.map(w => <li key={w.key}>{w.message}</li>)}
                </ul>
              </div>
            )}
            <details style={{ gridColumn: '1 / -1', marginTop: '0.25rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#4a5568' }}>Advanced (Engineer): Heat Exchanger Metallurgy</summary>
              <div className="form-field" style={{ marginTop: '0.75rem' }}>
                <label>Heat Exchanger Material Preference</label>
                <select
                  value={input.preferredMetallurgy ?? 'auto'}
                  onChange={e => setInput({ ...input, preferredMetallurgy: e.target.value as EngineInputV2_3['preferredMetallurgy'] })}
                >
                  <option value="auto">Auto (engine recommendation)</option>
                  <option value="al_si">Al-Si (e.g. WB 8000+ style)</option>
                  <option value="stainless_steel">Stainless steel</option>
                </select>
                {input.preferredMetallurgy === 'al_si' && (
                  <p style={{ fontSize: '0.8rem', color: '#2b6cb0', marginTop: '0.375rem' }}>
                    ℹ️ Al-Si selection keeps WB softener-edge analysis visible where relevant.
                  </p>
                )}
              </div>
            </details>
          </div>

          {/* ─── Heating Circuit Condition Diagnostics ──────────────────── */}
          <details style={{ marginTop: '1.25rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#4a5568' }}>
              🔍 Heating Circuit Condition (site observations)
            </summary>
            <div style={{ marginTop: '0.75rem', padding: '0.875rem', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <p style={{ fontSize: '0.82rem', color: '#4a5568', marginTop: 0, marginBottom: '0.75rem', lineHeight: 1.5 }}>
                Record what you observed on site. These observations feed the sludge and open vented circuit fault diagnostics — they do not directly change the physics model yet.
              </p>

              {/* Pumping over — always first, prominent */}
              <div className="form-field" style={{ gridColumn: '1 / -1', marginBottom: '0.75rem' }}>
                <label style={{ fontWeight: 700 }}>⚠️ Pumping over observed?</label>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    onClick={() => setInput({
                      ...input,
                      fullSurvey: {
                        ...input.fullSurvey,
                        heatingCondition: {
                          ...input.fullSurvey?.heatingCondition,
                          pumpingOverObserved: true,
                        },
                      },
                    })}
                    style={{
                      flex: 1,
                      padding: '0.625rem',
                      border: `2px solid ${input.fullSurvey?.heatingCondition?.pumpingOverObserved === true ? '#c53030' : '#e2e8f0'}`,
                      borderRadius: '6px',
                      background: input.fullSurvey?.heatingCondition?.pumpingOverObserved === true ? '#fff5f5' : '#fff',
                      cursor: 'pointer',
                      fontWeight: input.fullSurvey?.heatingCondition?.pumpingOverObserved === true ? 700 : 400,
                    }}
                  >
                    🚨 Yes — water rising up open vent pipe
                  </button>
                  <button
                    onClick={() => setInput({
                      ...input,
                      fullSurvey: {
                        ...input.fullSurvey,
                        heatingCondition: {
                          ...input.fullSurvey?.heatingCondition,
                          pumpingOverObserved: false,
                        },
                      },
                    })}
                    style={{
                      flex: 1,
                      padding: '0.625rem',
                      border: `2px solid ${input.fullSurvey?.heatingCondition?.pumpingOverObserved === false ? '#38a169' : '#e2e8f0'}`,
                      borderRadius: '6px',
                      background: input.fullSurvey?.heatingCondition?.pumpingOverObserved === false ? '#f0fff4' : '#fff',
                      cursor: 'pointer',
                      fontWeight: input.fullSurvey?.heatingCondition?.pumpingOverObserved === false ? 700 : 400,
                    }}
                  >
                    ✅ No — not observed
                  </button>
                </div>
              </div>

              {/* Pumping over hard advisory */}
              {systemConditionFlags.pumpingOverPresent && (
                <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: '#fff5f5', border: '2px solid #c53030', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 700, color: '#c53030', marginBottom: '0.4rem' }}>⛔ Open vented circuit fault — hard advisory</div>
                  {systemConditionFlags.pumpingOverAdvisory.map((msg, i) => (
                    <p key={i} style={{ margin: 0, marginTop: i > 0 ? '0.4rem' : 0, fontSize: '0.85rem', color: '#742a2a', lineHeight: 1.5 }}>
                      {msg}
                    </p>
                  ))}
                </div>
              )}

              <div className="form-grid">
                {/* Circuit type */}
                <div className="form-field">
                  <label>Circuit type</label>
                  <select
                    value={input.fullSurvey?.heatingCondition?.systemCircuitType ?? ''}
                    onChange={e => setInput({
                      ...input,
                      fullSurvey: {
                        ...input.fullSurvey,
                        heatingCondition: {
                          ...input.fullSurvey?.heatingCondition,
                          systemCircuitType: (e.target.value || undefined) as HeatingConditionDiagnosticsV1['systemCircuitType'],
                        },
                      },
                    })}
                  >
                    <option value="">Not recorded</option>
                    <option value="open_vented">Open vented central heating</option>
                    <option value="sealed">Sealed heating system</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>

                {/* Bleed water colour */}
                <div className="form-field">
                  <label>Bleed water colour</label>
                  <select
                    value={input.fullSurvey?.heatingCondition?.bleedWaterColour ?? ''}
                    onChange={e => setInput({
                      ...input,
                      fullSurvey: {
                        ...input.fullSurvey,
                        heatingCondition: {
                          ...input.fullSurvey?.heatingCondition,
                          bleedWaterColour: (e.target.value || undefined) as HeatingConditionDiagnosticsV1['bleedWaterColour'],
                        },
                      },
                    })}
                  >
                    <option value="">Not recorded</option>
                    <option value="clear">Clear (good)</option>
                    <option value="brown">Brown (magnetite sludge present)</option>
                    <option value="black">Black (heavy magnetite sludge)</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>

                {/* Symptom checkboxes */}
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={input.fullSurvey?.heatingCondition?.radiatorsColdAtBottom ?? false}
                    onChange={e => setInput({
                      ...input,
                      fullSurvey: {
                        ...input.fullSurvey,
                        heatingCondition: {
                          ...input.fullSurvey?.heatingCondition,
                          radiatorsColdAtBottom: e.target.checked,
                        },
                      },
                    })}
                  />
                  <span>Radiators cold at bottom</span>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={input.fullSurvey?.heatingCondition?.radiatorsHeatingUnevenly ?? false}
                    onChange={e => setInput({
                      ...input,
                      fullSurvey: {
                        ...input.fullSurvey,
                        heatingCondition: {
                          ...input.fullSurvey?.heatingCondition,
                          radiatorsHeatingUnevenly: e.target.checked,
                        },
                      },
                    })}
                  />
                  <span>Radiators heating unevenly</span>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={input.fullSurvey?.heatingCondition?.magneticDebrisEvidence ?? false}
                    onChange={e => setInput({
                      ...input,
                      fullSurvey: {
                        ...input.fullSurvey,
                        heatingCondition: {
                          ...input.fullSurvey?.heatingCondition,
                          magneticDebrisEvidence: e.target.checked,
                        },
                      },
                    })}
                  />
                  <span>Magnetic debris / sludge in filter</span>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={input.fullSurvey?.heatingCondition?.pumpSpeedHigh ?? false}
                    onChange={e => setInput({
                      ...input,
                      fullSurvey: {
                        ...input.fullSurvey,
                        heatingCondition: {
                          ...input.fullSurvey?.heatingCondition,
                          pumpSpeedHigh: e.target.checked,
                        },
                      },
                    })}
                  />
                  <span>Pump speed set to maximum</span>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={input.fullSurvey?.heatingCondition?.repeatedPumpOrValveReplacements ?? false}
                    onChange={e => setInput({
                      ...input,
                      fullSurvey: {
                        ...input.fullSurvey,
                        heatingCondition: {
                          ...input.fullSurvey?.heatingCondition,
                          repeatedPumpOrValveReplacements: e.target.checked,
                        },
                      },
                    })}
                  />
                  <span>Repeated pump / valve replacements</span>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={input.fullSurvey?.heatingCondition?.boilerCavitationOrNoise ?? false}
                    onChange={e => setInput({
                      ...input,
                      fullSurvey: {
                        ...input.fullSurvey,
                        heatingCondition: {
                          ...input.fullSurvey?.heatingCondition,
                          boilerCavitationOrNoise: e.target.checked,
                        },
                      },
                    })}
                  />
                  <span>Boiler cavitation / circuit noise</span>
                </label>
              </div>

              {/* Live sludge risk badge */}
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#718096' }}>Inferred sludge risk:</span>
                <span style={{
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  background: systemConditionFlags.sludgeRisk === 'high' ? '#fff5f5' : systemConditionFlags.sludgeRisk === 'moderate' ? '#fffff0' : '#f0fff4',
                  color: systemConditionFlags.sludgeRisk === 'high' ? '#c53030' : systemConditionFlags.sludgeRisk === 'moderate' ? '#b7791f' : '#276749',
                  border: `1px solid ${systemConditionFlags.sludgeRisk === 'high' ? '#feb2b2' : systemConditionFlags.sludgeRisk === 'moderate' ? '#faf089' : '#9ae6b4'}`,
                }}>
                  {systemConditionFlags.sludgeRisk.toUpperCase()}
                </span>
                {systemConditionFlags.openVentedFaultRisk !== 'none' && (
                  <>
                    <span style={{ fontSize: '0.78rem', color: '#718096' }}>Open vented circuit fault risk:</span>
                    <span style={{
                      padding: '0.2rem 0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      background: systemConditionFlags.openVentedFaultRisk === 'likely' ? '#fff5f5' : '#fffff0',
                      color: systemConditionFlags.openVentedFaultRisk === 'likely' ? '#c53030' : '#b7791f',
                      border: `1px solid ${systemConditionFlags.openVentedFaultRisk === 'likely' ? '#feb2b2' : '#faf089'}`,
                    }}>
                      {systemConditionFlags.openVentedFaultRisk.toUpperCase()}
                    </span>
                  </>
                )}
              </div>
            </div>
          </details>
          <div className="step-actions">
            <button className="prev-btn" onClick={prev}>← Back</button>
            <button className="next-btn" onClick={next}>Next →</button>
          </div>
        </div>
      )} 

      {currentStep === 'lifestyle' && (
        <LifestyleComfortStep
          input={input}
          fabricType={fabricType}
          selectedArchetype={selectedArchetype}
          setInput={setInput}
          onNext={next}
          onPrev={prev}
        />
      )}

      {currentStep === 'hot_water' && (
        <div className="step-card">
          <h2>🚿 Step 5: Hot Water Demand</h2>

          {/* ─── Canonical DHW setup path ─────────────────────────────────── */}
          <div data-testid="survey-dhw-setup" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2d3748', margin: '0 0 0.75rem 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Current hot water setup
            </p>
            {/* Explainer link: on-demand vs stored */}
            <InlineExplainerLink
              explainerId="on_demand_vs_stored"
              testId="explainer-link-on-demand-vs-stored"
              style={{ marginBottom: '0.75rem' }}
            />

            {/* Is there a cylinder currently installed? */}
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: '0.4rem', color: '#4a5568' }}>
                Is there a hot water cylinder currently installed?
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['yes', 'no', 'unknown'] as const).map(opt => {
                  const current = input.fullSurvey?.dhwCondition?.currentCylinderPresent;
                  const isSelected =
                    opt === 'yes' ? current === true :
                    opt === 'no'  ? current === false :
                    current === undefined;
                  return (
                    <button
                      key={opt}
                      onClick={() => setInput({
                        ...input,
                        currentCylinderPresent: opt === 'yes' ? true : opt === 'no' ? false : undefined,
                        fullSurvey: {
                          ...input.fullSurvey,
                          dhwCondition: {
                            ...input.fullSurvey?.dhwCondition,
                            currentCylinderPresent: opt === 'yes' ? true : opt === 'no' ? false : undefined,
                          },
                        },
                      })}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        border: `2px solid ${isSelected ? '#3182ce' : '#e2e8f0'}`,
                        background: isSelected ? '#ebf8ff' : '#fff',
                        cursor: 'pointer',
                        fontWeight: isSelected ? 700 : 400,
                        fontSize: '0.85rem',
                      }}
                    >
                      {opt === 'yes' ? 'Yes' : opt === 'no' ? 'No' : 'Unknown'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cylinder detail fields — only when cylinder is confirmed present */}
            {input.fullSurvey?.dhwCondition?.currentCylinderPresent === true && (
              <div style={{ marginBottom: '0.875rem', padding: '0.75rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2d3748', margin: '0 0 0.6rem 0', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  Current cylinder details
                </p>
                <div className="form-grid">
                  {/* Cylinder type */}
                  <div className="form-field">
                    <label>Cylinder type</label>
                    <select
                      value={input.fullSurvey?.dhwCondition?.currentCylinderType ?? ''}
                      onChange={e => setInput({
                        ...input,
                        fullSurvey: {
                          ...input.fullSurvey,
                          dhwCondition: {
                            ...input.fullSurvey?.dhwCondition,
                            currentCylinderType: (e.target.value || undefined) as DhwConditionDiagnosticsV1['currentCylinderType'],
                          },
                        },
                      })}
                    >
                      <option value="">Not recorded</option>
                      <option value="vented">Vented — tank-fed hot water (open-vented)</option>
                      <option value="unvented">Unvented — mains-fed supply (sealed)</option>
                      <option value="mixergy">Mixergy — stored hot water with active stratification</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>

                  {/* Approximate volume */}
                  <div className="form-field">
                    <label>Approximate volume (litres)</label>
                    <input
                      type="number"
                      min={30}
                      max={600}
                      step={5}
                      value={typeof input.fullSurvey?.dhwCondition?.currentCylinderVolumeLitres === 'number'
                        ? input.fullSurvey.dhwCondition.currentCylinderVolumeLitres
                        : ''}
                      onChange={e => setInput({
                        ...input,
                        cylinderVolumeLitres: e.target.value ? Number(e.target.value) : undefined,
                        fullSurvey: {
                          ...input.fullSurvey,
                          dhwCondition: {
                            ...input.fullSurvey?.dhwCondition,
                            currentCylinderVolumeLitres: e.target.value ? Number(e.target.value) : 'unknown',
                          },
                        },
                      })}
                      placeholder="e.g. 150 (leave blank if unknown)"
                    />
                  </div>

                  {/* Age band */}
                  <div className="form-field">
                    <label>Approximate age</label>
                    <select
                      value={input.fullSurvey?.dhwCondition?.currentCylinderAgeBand ?? ''}
                      onChange={e => setInput({
                        ...input,
                        fullSurvey: {
                          ...input.fullSurvey,
                          dhwCondition: {
                            ...input.fullSurvey?.dhwCondition,
                            currentCylinderAgeBand: (e.target.value || undefined) as DhwConditionDiagnosticsV1['currentCylinderAgeBand'],
                          },
                        },
                      })}
                    >
                      <option value="">Not recorded</option>
                      <option value="under_5">Under 5 years</option>
                      <option value="5_to_10">5–10 years</option>
                      <option value="10_to_15">10–15 years</option>
                      <option value="over_15">Over 15 years</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>

                  {/* Condition */}
                  <div className="form-field">
                    <label>Condition</label>
                    <select
                      value={input.fullSurvey?.dhwCondition?.currentCylinderCondition ?? ''}
                      onChange={e => setInput({
                        ...input,
                        fullSurvey: {
                          ...input.fullSurvey,
                          dhwCondition: {
                            ...input.fullSurvey?.dhwCondition,
                            currentCylinderCondition: (e.target.value || undefined) as DhwConditionDiagnosticsV1['currentCylinderCondition'],
                          },
                        },
                      })}
                    >
                      <option value="">Not recorded</option>
                      <option value="good">Good</option>
                      <option value="average">Average</option>
                      <option value="poor">Poor</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>

                  {/* Vented head — only relevant for vented cylinders */}
                  {input.fullSurvey?.dhwCondition?.currentCylinderType === 'vented' && (
                    <div className="form-field">
                      <label>Approximate head above draw-off (m)</label>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step={0.1}
                        value={typeof input.fullSurvey?.dhwCondition?.currentCwsHeadMetres === 'number'
                          ? input.fullSurvey.dhwCondition.currentCwsHeadMetres
                          : ''}
                        onChange={e => setInput({
                          ...input,
                          cwsHeadMetres: e.target.value ? Number(e.target.value) : undefined,
                          fullSurvey: {
                            ...input.fullSurvey,
                            dhwCondition: {
                              ...input.fullSurvey?.dhwCondition,
                              currentCwsHeadMetres: e.target.value ? Number(e.target.value) : 'unknown',
                            },
                          },
                        })}
                        placeholder="e.g. 1.5 (leave blank if unknown)"
                      />
                      <p style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.25rem' }}>
                        Height from loft tank to the highest draw-off point (metres). Determines available delivery pressure for tank-fed hot water.
                      </p>
                    </div>
                  )}
                </div>
                {/* Explainer: why cylinder age and condition matter */}
                <p style={{ fontSize: '0.75rem', color: '#718096', margin: '0.5rem 0 0 0', lineHeight: 1.5 }}>
                  Age and condition affect standing heat loss and coil transfer efficiency — both feed directly into the recommendation rationale and the stored hot water comparison.
                </p>
                {/* Explainer link: cylinder age and condition */}
                <InlineExplainerLink
                  explainerId="cylinder_age_condition"
                  testId="explainer-link-cylinder-age-condition"
                  style={{ marginTop: '0.4rem' }}
                />
              </div>
            )}

            {/* DHW upgrade intent */}
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: '0.4rem', color: '#4a5568' }}>
                What is the plan for hot water?
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {([
                  { value: 'keep',    label: 'Keep existing' },
                  { value: 'replace', label: 'Replace' },
                  { value: 'unsure',  label: 'Unsure' },
                ] as const).map(opt => {
                  const selected = input.fullSurvey?.dhwCondition?.dhwUpgradeIntent === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setInput({
                        ...input,
                        fullSurvey: {
                          ...input.fullSurvey,
                          dhwCondition: {
                            ...input.fullSurvey?.dhwCondition,
                            dhwUpgradeIntent: opt.value,
                          },
                        },
                      })}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: `2px solid ${selected ? '#3182ce' : '#e2e8f0'}`,
                        background: selected ? '#ebf8ff' : '#fff',
                        cursor: 'pointer',
                        fontWeight: selected ? 700 : 400,
                        fontSize: '0.85rem',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Proposed hot water storage — only when stored hot water is relevant.
                Visible when: a cylinder is already present, the user intends to replace,
                or the user is unsure. Hidden only when no cylinder exists AND intent is 'keep'
                (i.e., keeping an on-demand combi setup with no storage being considered). */}
            {(input.fullSurvey?.dhwCondition?.currentCylinderPresent === true ||
              input.fullSurvey?.dhwCondition?.dhwUpgradeIntent === 'replace' ||
              input.fullSurvey?.dhwCondition?.dhwUpgradeIntent === 'unsure') && (
              <div data-testid="survey-dhw-tank-type-picker" style={{ marginTop: '0.875rem', padding: '0.875rem', background: '#fff', border: '1px solid #bee3f8', borderLeft: '4px solid #3182ce', borderRadius: '6px' }}>
                {/* Explainer: why stored hot water is being considered */}
                <p style={{ fontSize: '0.78rem', color: '#2c5282', margin: '0 0 0.75rem 0', lineHeight: 1.5 }}>
                  💧 <strong>Stored hot water is being considered</strong> for this property.
                  {input.fullSurvey?.dhwCondition?.currentCylinderPresent === true && input.fullSurvey?.dhwCondition?.dhwUpgradeIntent === 'keep'
                    ? ' The existing cylinder is being retained — select its type below to include it in the comparison.'
                    : ' Select the proposed storage type to include in the recommendation.'}
                </p>
                <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: '0.4rem', color: '#4a5568' }}>
                  Proposed hot water storage type
                </label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => setInput({ ...input, dhwTankType: 'standard' })}
                    style={{
                      flex: 1,
                      padding: '0.875rem',
                      border: `2px solid ${input.dhwTankType !== 'mixergy' ? '#3182ce' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      background: input.dhwTankType !== 'mixergy' ? '#ebf8ff' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>🫙 Standard Cylinder</div>
                    <div style={{ fontSize: '0.82rem', color: '#4a5568' }}>
                      Conventional stored hot water for whole-home demand.
                    </div>
                  </button>
                  {/* Mixergy is not available for combi — combi has no stored cylinder. */}
                  {input.preferCombi !== true && input.currentHeatSourceType !== 'combi' && (
                  <button
                    onClick={() => setInput({ ...input, dhwTankType: 'mixergy' })}
                    style={{
                      flex: 1,
                      padding: '0.875rem',
                      border: `2px solid ${input.dhwTankType === 'mixergy' ? '#805ad5' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      background: input.dhwTankType === 'mixergy' ? '#faf5ff' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>⚡ Mixergy Hot Water Battery</div>
                    <div style={{ fontSize: '0.82rem', color: '#4a5568' }}>
                      Stored hot water with top-down heating and active stratification.
                    </div>
                  </button>
                  )}
                </div>
                {/* Explainer: standard vs Mixergy */}
                <p style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.5rem', marginBottom: 0, lineHeight: 1.5 }}>
                  A standard cylinder stores hot water heated by the boiler or heat pump.
                  Mixergy uses top-down heating and active stratification to reduce cycling penalties and deliver usable hot water sooner — particularly beneficial alongside a heat pump or time-of-use tariffs.
                </p>
                {/* Explainer link: standard vs Mixergy */}
                <InlineExplainerLink
                  explainerId="standard_vs_mixergy"
                  testId="explainer-link-standard-vs-mixergy"
                  style={{ marginTop: '0.4rem' }}
                />
                {input.dhwTankType === 'mixergy' && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div className="form-field">
                      <label>Installer Network</label>
                      <select
                        value={input.installerNetwork ?? 'independent'}
                        onChange={e => setInput({ ...input, installerNetwork: e.target.value as EngineInputV2_3['installerNetwork'] })}
                      >
                        <option value="independent">Independent Installer</option>
                      </select>
                    </div>
                  </div>
                )}
                <label className="checkbox-field" style={{ marginTop: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={compareMixergy}
                    onChange={e => setCompareMixergy(e.target.checked)}
                  />
                  <span>Show Mixergy comparison in results (even if standard cylinder selected)</span>
                </label>
              </div>
            )}
          </div>

          {/* ─── Physics levers + live panel ─────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', alignItems: 'start' }}>

            {/* Left: controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Bathrooms */}
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: '0.4rem', color: '#4a5568' }}>
                  Bathrooms
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                  {[1, 2, 3, 4].map(n => (
                    <button
                      key={n}
                      onClick={() => setInput({ ...input, bathroomCount: n })}
                      style={{
                        padding: '0.5rem',
                        border: `2px solid ${input.bathroomCount === n ? '#3182ce' : '#e2e8f0'}`,
                        borderRadius: '6px',
                        background: input.bathroomCount === n ? '#ebf8ff' : '#fff',
                        cursor: 'pointer',
                        fontWeight: input.bathroomCount === n ? 700 : 400,
                        fontSize: '0.9rem',
                        transition: 'all 0.12s',
                      }}
                    >
                      {n}{n === 4 ? '+' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Peak concurrent outlets */}
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: '0.4rem', color: '#4a5568' }}>
                  Peak simultaneous outlets
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {([
                    { value: 1, label: '1 outlet',  sub: 'Single shower or tap' },
                    { value: 2, label: '2 outlets',  sub: 'e.g. shower + basin simultaneously' },
                    { value: 3, label: '3+ outlets', sub: 'Multiple simultaneous draws' },
                  ] as Array<{ value: number; label: string; sub: string }>).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setInput({ ...input, peakConcurrentOutlets: opt.value })}
                      style={{
                        padding: '0.5rem 0.75rem',
                        border: `2px solid ${(input.peakConcurrentOutlets ?? 1) === opt.value ? '#3182ce' : '#e2e8f0'}`,
                        borderRadius: '6px',
                        background: (input.peakConcurrentOutlets ?? 1) === opt.value ? '#ebf8ff' : '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.12s',
                      }}
                    >
                      <div style={{ fontWeight: (input.peakConcurrentOutlets ?? 1) === opt.value ? 700 : 500, fontSize: '0.88rem' }}>{opt.label}</div>
                      <div style={{ fontSize: '0.72rem', color: '#718096' }}>{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>


              {/* Derived household profile — read-only, sourced from Step 4 */}
              {input.householdComposition ? (
                <div style={{
                  padding: '0.75rem 1rem',
                  background: '#f0fff4',
                  border: '1px solid #9ae6b4',
                  borderRadius: '8px',
                }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#276749', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Derived from household profile
                  </p>
                  <div style={{ fontSize: '0.82rem', color: '#2d3748', lineHeight: 1.7 }}>
                    <div>{formatHouseholdCompositionSummary(input.householdComposition) || `${Math.max(1, input.occupancyCount ?? 1)} occupant${(input.occupancyCount ?? 1) !== 1 ? 's' : ''}`}</div>
                    {DEMAND_PRESETS.find(p => p.id === input.demandPreset) && (
                      <div style={{ color: '#276749' }}>{DEMAND_PRESETS.find(p => p.id === input.demandPreset)!.label}</div>
                    )}
                    <div style={{ color: '#718096' }}>Peak demand: {input.peakConcurrentOutlets ?? 1} outlet{(input.peakConcurrentOutlets ?? 1) !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '0.75rem 1rem',
                  background: '#fffbeb',
                  border: '1px solid #f6e05e',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  color: '#975a16',
                }}>
                  ℹ️ Complete Step 4 (Lifestyle) to see the derived household profile here.
                </div>
              )}
            </div>

            {/* Right: live response panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

              {/* DHW demand summary */}
              <div style={{
                padding: '0.875rem 1rem',
                background: '#f7fafc',
                border: `2px solid ${dhwBand.colour}`,
                borderRadius: '8px',
                display: 'flex', flexDirection: 'column', gap: '0.3rem',
              }}>
                <div style={{ fontSize: '0.75rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  DHW demand summary
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: dhwBand.colour, lineHeight: 1 }}>
                  {dhwBand.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#718096' }}>
                  {input.bathroomCount} bathroom{input.bathroomCount !== 1 ? 's' : ''} · {input.peakConcurrentOutlets ?? 1} peak outlet{(input.peakConcurrentOutlets ?? 1) !== 1 ? 's' : ''} · {(input.occupancyCount ?? 2) >= 4 ? '4+ people' : (input.occupancyCount ?? 2) === 3 ? '3 people' : '1–2 people'}
                </div>
              </div>

              {/* Stored-hot-water fit shown early as primary recommendation */}
              {(input.bathroomCount >= 2 || (input.peakConcurrentOutlets ?? 1) >= 2) && (
                <div style={{
                  padding: '0.6rem 0.875rem',
                  background: '#ebf8ff',
                  border: '1px solid #90cdf4',
                  borderLeft: '4px solid #3182ce',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                }}>
                  <div style={{ fontWeight: 700, color: '#2b6cb0', marginBottom: '0.2rem' }}>
                    Stored hot water strongly favoured
                  </div>
                  <div style={{ color: '#4a5568', lineHeight: 1.4 }}>
                    {(input.peakConcurrentOutlets ?? 1) >= 2
                      ? 'Two or more simultaneous outlets are better served by stored volume than by on-demand hot water.'
                      : 'Multiple bathrooms increase the likelihood of simultaneous demand — stored hot water handles this without throughput constraints.'
                    }
                  </div>
                </div>
              )}

              {/* Unvented positive explainer */}
              <div style={{
                padding: '0.6rem 0.875rem',
                background: '#f0fff4',
                border: '1px solid #9ae6b4',
                borderLeft: '4px solid #38a169',
                borderRadius: '6px',
                fontSize: '0.82rem',
              }}>
                <div style={{ fontWeight: 700, color: '#276749', marginBottom: '0.2rem' }}>
                  Unvented full mains flow
                </div>
                <div style={{ color: '#4a5568', lineHeight: 1.4 }}>
                  Stored hot water at mains pressure supports stronger simultaneous outlet performance than vented storage.
                </div>
              </div>

              {/* Combi limitation verdict — keep failure emphasis here only */}
              <div style={{
                padding: '0.6rem 0.875rem',
                background: RISK_BG[combiDhwLive.verdict.combiRisk],
                border: `2px solid ${RISK_COLOUR[combiDhwLive.verdict.combiRisk]}`,
                borderRadius: '6px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: '0.88rem', color: '#4a5568' }}>Combi on-demand verdict</span>
                <span style={{
                  padding: '0.25rem 0.65rem',
                  background: RISK_COLOUR[combiDhwLive.verdict.combiRisk],
                  color: '#fff', borderRadius: '4px', fontWeight: 700, fontSize: '0.82rem',
                }}>
                  {RISK_LABEL[combiDhwLive.verdict.combiRisk]}
                </span>
              </div>

              {combiDhwLive.flags[0] && (
                <div style={{
                  padding: '0.5rem 0.75rem',
                  background: '#f7fafc',
                  border: '1px solid #e2e8f0',
                  borderLeft: '4px solid #718096',
                  borderRadius: '4px',
                  fontSize: '0.82rem',
                }}>
                  <div style={{ fontWeight: 700, color: '#4a5568', marginBottom: '0.2rem' }}>
                    {combiDhwLive.flags[0].title}
                  </div>
                  <div style={{ color: '#4a5568', lineHeight: 1.4 }}>{combiDhwLive.flags[0].detail}</div>
                </div>
              )}

              {/* Outlet demand analysis — hidden by default, revealed via detail toggle */}
              <button
                onClick={() => setShowHotWaterAnalysis(v => !v)}
                style={detailToggleStyle}
                data-testid="survey-hotwater-analysis-toggle"
                aria-expanded={showHotWaterAnalysis}
                aria-controls="survey-hotwater-analysis"
              >
                {showHotWaterAnalysis ? '▲ Hide outlet analysis' : '▼ Show outlet analysis'}
              </button>
              {showHotWaterAnalysis && (
              <div id="survey-hotwater-analysis" style={{ padding: '0.75rem', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }} data-testid="survey-hotwater-analysis">
                <div style={{ fontSize: '0.78rem', color: '#718096', marginBottom: '0.5rem' }}>
                  Simultaneous outlets: on-demand vs. stored
                </div>
                {/* On-demand limit bar (always 1) */}
                <div style={{ marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#718096', marginBottom: '0.2rem' }}>On-demand limit — 1 outlet at a time</div>
                  <div style={{ background: '#e2e8f0', borderRadius: '4px', height: '10px' }}>
                    <div style={{ width: '33%', background: '#38a169', height: '100%', borderRadius: '4px' }} />
                  </div>
                </div>
                {/* Peak demand bar */}
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#718096', marginBottom: '0.2rem' }}>
                    Your peak — {input.peakConcurrentOutlets ?? 1} outlet{(input.peakConcurrentOutlets ?? 1) !== 1 ? 's' : ''}
                  </div>
                  <div style={{ background: '#e2e8f0', borderRadius: '4px', height: '10px', position: 'relative' }}>
                    <div style={{
                      width: `${Math.min(((input.peakConcurrentOutlets ?? 1) / 3) * 100, 100)}%`,
                      background: RISK_COLOUR[combiDhwLive.verdict.combiRisk],
                      height: '100%', borderRadius: '4px', transition: 'width 0.2s',
                    }} />
                    {/* Combi limit marker at 33% */}
                    <div style={{ position: 'absolute', left: '33%', top: '-3px', bottom: '-3px', width: '2px', background: '#38a169' }} />
                  </div>
                </div>
              </div>
              )}
            </div>
          </div>

          {/* ─── DHW Circuit Condition Diagnostics ──────────────────────── */}
          <details style={{ marginTop: '1.25rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#4a5568' }}>
              🔍 DHW Circuit Condition (site observations)
            </summary>
            <div style={{ marginTop: '0.75rem', padding: '0.875rem', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <p style={{ fontSize: '0.82rem', color: '#4a5568', marginTop: 0, marginBottom: '0.75rem', lineHeight: 1.5 }}>
                Record observations about the hot water cylinder or combi plate heat exchanger. These feed the scale and DHW condition diagnostics.
              </p>

              {/* ── Combi plate HEX condition (primary inputs) ────────────── */}
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2d3748', margin: '0 0 0.5rem 0', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                Combi plate heat exchanger
              </p>
              <div className="form-grid" style={{ marginBottom: '1rem' }}>
                {/* Hot water performance — primary plate HEX condition signal */}
                <div className="form-field">
                  <label>How is the hot water performing?</label>
                  <select
                    value={input.fullSurvey?.dhwCondition?.hotWaterPerformanceBand ?? ''}
                    onChange={e => setInput({
                      ...input,
                      fullSurvey: {
                        ...input.fullSurvey,
                        dhwCondition: {
                          ...input.fullSurvey?.dhwCondition,
                          hotWaterPerformanceBand: (e.target.value || undefined) as DhwConditionDiagnosticsV1['hotWaterPerformanceBand'],
                        },
                      },
                    })}
                  >
                    <option value="">Not recorded</option>
                    <option value="good">Good — normal hot water output</option>
                    <option value="slightly_reduced">Slightly reduced — lower than expected</option>
                    <option value="fluctuating">Fluctuating — temperature varies during draw</option>
                    <option value="poor">Poor — noticeably weak or inconsistent</option>
                  </select>
                </div>

                {/* Water softener — reduces scale risk */}
                <div className="form-field" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label className="checkbox-field" style={{ marginTop: 'auto' }}>
                    <input
                      type="checkbox"
                      checked={input.fullSurvey?.dhwCondition?.softenerPresent ?? false}
                      onChange={e => setInput({
                        ...input,
                        fullSurvey: {
                          ...input.fullSurvey,
                          dhwCondition: {
                            ...input.fullSurvey?.dhwCondition,
                            softenerPresent: e.target.checked,
                          },
                        },
                      })}
                    />
                    <span>Water softener installed</span>
                  </label>
                </div>
              </div>

              {/* Live plate HEX condition badge (rich band from condition model) */}
              {(() => {
                const band = systemConditionFlags.plateHexDetail.conditionBand;
                const foulingFactor = systemConditionFlags.plateHexDetail.foulingFactor;
                const confidence = systemConditionFlags.plateHexDetail.confidence;
                const BAND_COLOUR: Record<string, string> = {
                  good: '#276749', moderate: '#b7791f', poor: '#c05621', severe: '#c53030',
                };
                const BAND_BG: Record<string, string> = {
                  good: '#f0fff4', moderate: '#fffff0', poor: '#fffaf0', severe: '#fff5f5',
                };
                const BAND_BORDER: Record<string, string> = {
                  good: '#9ae6b4', moderate: '#faf089', poor: '#fbd38d', severe: '#feb2b2',
                };
                const IMPLICATION: Record<string, string> = {
                  good: 'On-demand hot water response within design limits',
                  moderate: 'Hot water response likely slightly reduced',
                  poor: 'Likely temperature fluctuation under heavier demand',
                  severe: 'Performance loss likely due to scale/fouling — output reduced',
                };
                return (
                  <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.875rem', background: BAND_BG[band], border: `1px solid ${BAND_BORDER[band]}`, borderLeft: `4px solid ${BAND_COLOUR[band]}`, borderRadius: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#718096' }}>Plate HEX condition:</span>
                      <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700, background: BAND_COLOUR[band], color: '#fff' }}>
                        {band.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#718096' }}>fouling factor {foulingFactor.toFixed(2)} · {confidence} confidence</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#4a5568' }}>{IMPLICATION[band]}</div>
                  </div>
                );
              })()}

              <div className="form-grid">
                {/* Plate HEX age (combi only) */}
                <div className="form-field">
                  <label>Combi plate heat exchanger age (years)</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step={1}
                    value={typeof input.fullSurvey?.dhwCondition?.plateHexAgeYears === 'number' ? input.fullSurvey.dhwCondition.plateHexAgeYears : ''}
                    onChange={e => setInput({
                      ...input,
                      fullSurvey: {
                        ...input.fullSurvey,
                        dhwCondition: {
                          ...input.fullSurvey?.dhwCondition,
                          plateHexAgeYears: e.target.value ? Number(e.target.value) : 'unknown',
                        },
                      },
                    })}
                    placeholder="e.g. 8 (leave blank if unknown)"
                  />
                </div>

                {/* Symptom checkboxes */}
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={input.fullSurvey?.dhwCondition?.kettlingOrScaleSymptoms ?? false}
                    onChange={e => setInput({
                      ...input,
                      fullSurvey: {
                        ...input.fullSurvey,
                        dhwCondition: {
                          ...input.fullSurvey?.dhwCondition,
                          kettlingOrScaleSymptoms: e.target.checked,
                        },
                      },
                    })}
                  />
                  <span>Kettling or scale noise on heat exchanger / coil</span>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={input.fullSurvey?.dhwCondition?.immersionFailureHistory ?? false}
                    onChange={e => setInput({
                      ...input,
                      fullSurvey: {
                        ...input.fullSurvey,
                        dhwCondition: {
                          ...input.fullSurvey?.dhwCondition,
                          immersionFailureHistory: e.target.checked,
                        },
                      },
                    })}
                  />
                  <span>Immersion heater failure history</span>
                </label>
              </div>

              {/* Live scale risk + condition badges */}
              <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#718096' }}>Inferred scale risk:</span>
                <span style={{
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  background: systemConditionFlags.scaleRisk === 'high' ? '#fff5f5' : systemConditionFlags.scaleRisk === 'moderate' ? '#fffff0' : '#f0fff4',
                  color: systemConditionFlags.scaleRisk === 'high' ? '#c53030' : systemConditionFlags.scaleRisk === 'moderate' ? '#b7791f' : '#276749',
                  border: `1px solid ${systemConditionFlags.scaleRisk === 'high' ? '#feb2b2' : systemConditionFlags.scaleRisk === 'moderate' ? '#faf089' : '#9ae6b4'}`,
                }}>
                  {systemConditionFlags.scaleRisk.toUpperCase()}
                </span>
                {systemConditionFlags.cylinderAgeBand !== 'unknown' && (
                  <>
                    <span style={{ fontSize: '0.78rem', color: '#718096' }}>Cylinder:</span>
                    <span style={{
                      padding: '0.2rem 0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      background: systemConditionFlags.cylinderAgeBand === 'aged' ? '#fffff0' : '#f0fff4',
                      color: systemConditionFlags.cylinderAgeBand === 'aged' ? '#b7791f' : '#276749',
                      border: `1px solid ${systemConditionFlags.cylinderAgeBand === 'aged' ? '#faf089' : '#9ae6b4'}`,
                    }}>
                      {systemConditionFlags.cylinderAgeBand.toUpperCase()}
                    </span>
                  </>
                )}
              </div>
            </div>
          </details>

          <div className="step-actions">
            <button className="prev-btn" onClick={prev}>← Back</button>
            <button className="next-btn" onClick={next}>Next →</button>
          </div>
        </div>
      )}

      {currentStep === 'commercial' && (
        <div className="step-card">
          <h2>💼 Step 6: Installation approach</h2>
          <div className="form-grid">
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>🏗️ Upgrade strategy</label>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setInput({ ...input, installationPolicy: 'full_job' })}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    border: `2px solid ${input.installationPolicy === 'full_job' ? '#3182ce' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    background: input.installationPolicy === 'full_job' ? '#ebf8ff' : '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>✅ Full upgrade (low-temp design)</div>
                  <div style={{ fontSize: '0.82rem', color: '#4a5568' }}>
                    We can improve radiators and controls so the system runs more efficiently at lower temperatures.
                  </div>
                </button>
                <button
                  onClick={() => setInput({ ...input, installationPolicy: 'high_temp_retrofit' })}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    border: `2px solid ${input.installationPolicy === 'high_temp_retrofit' ? '#c53030' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    background: input.installationPolicy === 'high_temp_retrofit' ? '#fff5f5' : '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>⚡ Like-for-like retrofit (higher temp)</div>
                  <div style={{ fontSize: '0.82rem', color: '#4a5568' }}>
                    Keep most existing emitters and fit around the current setup, typically at higher flow temperatures.
                  </div>
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#718096', marginTop: '0.5rem' }}>
                These choices influence performance assumptions and which systems are shown as best-fit. Low-temp upgrades usually improve efficiency; like-for-like minimises disruption.
              </p>
            </div>
            <div className="form-field">
              <label>Cylinder / airing-cupboard space</label>
              <select
                value={input.availableSpace ?? 'unknown'}
                onChange={e => setInput({ ...input, availableSpace: e.target.value as 'tight' | 'ok' | 'unknown' })}
              >
                <option value="ok">OK – adequate space available</option>
                <option value="tight">Tight – limited space</option>
                <option value="unknown">Unknown – not yet surveyed</option>
              </select>
            </div>
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>🏠 How important is saving space / avoiding a hot water cylinder?</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {(
                  [
                    { value: 'low',    label: '🟢 Not an issue',              sub: 'Space is available — performance first' },
                    { value: 'medium', label: '🟡 Prefer compact if practical', sub: 'Minor preference to keep space free' },
                    { value: 'high',   label: '🔴 Must avoid a cylinder',       sub: 'Space is critical — compact system required' },
                  ] as const
                ).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setInput({ ...input, preferences: { ...input.preferences, spacePriority: opt.value } })}
                    style={{
                      flex: 1,
                      minWidth: '10rem',
                      padding: '0.75rem',
                      border: `2px solid ${(input.preferences?.spacePriority ?? 'low') === opt.value ? '#3182ce' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      background: (input.preferences?.spacePriority ?? 'low') === opt.value ? '#ebf8ff' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '0.2rem', fontSize: '0.85rem' }}>{opt.label}</div>
                    <div style={{ fontSize: '0.75rem', color: '#4a5568' }}>{opt.sub}</div>
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.8rem', color: '#718096', marginTop: '0.5rem' }}>
                This influences which systems are recommended. Compact systems (like a combi boiler) free up airing-cupboard space but have throughput limits.
              </p>
            </div>
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>🔧 How much installation disruption is acceptable?</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {(
                  [
                    { value: 'low',    label: '🟢 Low',    sub: 'Keep disruption minimal' },
                    { value: 'medium', label: '🟡 Medium', sub: 'Some improvement work is acceptable' },
                    { value: 'high',   label: '🔴 High',   sub: 'Open to major future-proofing works' },
                  ] as const
                ).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setInput({ ...input, preferences: { ...input.preferences, disruptionTolerance: opt.value } })}
                    style={{
                      flex: 1,
                      minWidth: '10rem',
                      padding: '0.75rem',
                      border: `2px solid ${(input.preferences?.disruptionTolerance ?? 'medium') === opt.value ? '#3182ce' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      background: (input.preferences?.disruptionTolerance ?? 'medium') === opt.value ? '#ebf8ff' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '0.2rem', fontSize: '0.85rem' }}>{opt.label}</div>
                    <div style={{ fontSize: '0.75rem', color: '#4a5568' }}>{opt.sub}</div>
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.8rem', color: '#718096', marginTop: '0.5rem' }}>
                This influences ranking of upgrade-heavy pathways. Low disruption tolerance deprioritises options requiring major enabling works such as emitter replacements or electrical upgrades.
              </p>
            </div>
            <div className="form-field">
              <label>Bedrooms</label>
              <select
                value={input.bedrooms ?? ''}
                onChange={e => setInput({ ...input, bedrooms: e.target.value ? +e.target.value : undefined })}
              >
                <option value="">Not specified</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5+</option>
              </select>
            </div>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={input.futureLoftConversion ?? false}
                onChange={e => setInput({ ...input, futureLoftConversion: e.target.checked })}
              />
              <span>Loft conversion planned</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={input.futureAddBathroom ?? false}
                onChange={e => setInput({ ...input, futureAddBathroom: e.target.checked })}
              />
              <span>Additional bathroom planned</span>
            </label>
          </div>

          {/* ─── Energy Consumption ───────────────────────────────────────── */}
          <details style={{ marginTop: '1.25rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#4a5568' }}>
              ⚡ Energy Consumption (optional)
            </summary>
            <div style={{ marginTop: '0.75rem', padding: '0.875rem', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <p style={{ fontSize: '0.82rem', color: '#4a5568', marginTop: 0, marginBottom: '0.75rem', lineHeight: 1.5 }}>
                If you know your annual gas or electricity usage, enter it below.
                You can find this on your bill or online account.
              </p>
              <div className="form-grid">
                <div className="form-field">
                  <label>Annual gas consumption (kWh, optional)</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={input.fullSurvey?.manualEvidence?.annualGasKwh ?? ''}
                    onChange={e => setInput({
                      ...input,
                      fullSurvey: {
                        ...input.fullSurvey,
                        manualEvidence: {
                          ...input.fullSurvey?.manualEvidence,
                          annualGasKwh: e.target.value ? Number(e.target.value) : undefined,
                        },
                      },
                    })}
                    placeholder="e.g. 12000"
                  />
                </div>
                <div className="form-field">
                  <label>Annual electricity consumption (kWh, optional)</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={input.fullSurvey?.manualEvidence?.annualElecKwh ?? ''}
                    onChange={e => setInput({
                      ...input,
                      fullSurvey: {
                        ...input.fullSurvey,
                        manualEvidence: {
                          ...input.fullSurvey?.manualEvidence,
                          annualElecKwh: e.target.value ? Number(e.target.value) : undefined,
                        },
                      },
                    })}
                    placeholder="e.g. 3500"
                  />
                </div>
              </div>
              {!input.fullSurvey?.manualEvidence?.annualGasKwh && !input.fullSurvey?.manualEvidence?.annualElecKwh && (
                <p style={{ fontSize: '0.78rem', color: '#718096', marginTop: '0.5rem', marginBottom: 0 }}>
                  Using estimated consumption based on heat loss and occupancy.
                </p>
              )}
            </div>
          </details>

          <div className="step-actions">
            <button className="prev-btn" onClick={prev}>← Back</button>
            <button className="next-btn" onClick={next}>Next →</button>
          </div>
        </div>
      )}

      {currentStep === 'overlay' && (() => {
        // Pre-compute all cell statuses
        const cellMap: Record<string, Record<string, RiskLevel>> = {};
        // Derive CWS evidence for overlay cell gating
        const overlayPressureBar = input.dynamicMainsPressureBar ?? input.dynamicMainsPressure;
        const overlayFlowLpm = input.mainsDynamicFlowLpm;
        const overlayStaticBar = input.staticMainsPressureBar;
        const overlayInconsistent = overlayStaticBar !== undefined && overlayPressureBar > overlayStaticBar + 0.2;
        const overlayHasFlow = overlayFlowLpm !== undefined && overlayFlowLpm > 0;
        const overlayFlow = overlayHasFlow ? (overlayFlowLpm as number) : 0;
        const overlayMeetsUnvented = !overlayInconsistent && overlayHasFlow && (
          (overlayFlow >= 10 && overlayPressureBar >= 1.0) ||
          (overlayFlow >= 12 && overlayPressureBar <= 0.2)
        );
        for (const sys of OVERLAY_SYSTEMS) {
          cellMap[sys.id] = {};
          for (const row of OVERLAY_ROWS) {
            cellMap[sys.id][row.id] = deriveOverlayCell(
              sys.id, row.id,
              hydraulicLive.boilerRisk, hydraulicLive.ashpRisk,
              combiDhwLive.verdict.combiRisk,
              dhwBand.label,
              overlayMeetsUnvented,
              overlayHasFlow,
              overlayInconsistent,
              input.dynamicMainsPressure,
              input.availableSpace,
              input.futureLoftConversion ?? false,
              input.futureAddBathroom ?? false,
            );
          }
        }

        return (
          <div className="step-card">
            <h2>🔬 Step 7: System Overlay</h2>

            {/* Grid table */}
            <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#718096', fontWeight: 600, fontSize: '0.78rem', borderBottom: '2px solid #e2e8f0' }}>
                      Physics domain
                    </th>
                    {OVERLAY_SYSTEMS.map(sys => (
                      <th key={sys.id} style={{ padding: '0.5rem 0.5rem', textAlign: 'center', color: '#2d3748', fontWeight: 700, borderBottom: '2px solid #e2e8f0', minWidth: '80px' }}>
                        {sys.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {OVERLAY_ROWS.map((row, ri) => (
                    <tr key={row.id} style={{ background: ri % 2 === 0 ? '#fff' : '#f7fafc' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#4a5568', borderBottom: '1px solid #e2e8f0' }}>
                        {row.label}
                        <div style={{ fontSize: '0.7rem', color: '#718096', fontWeight: 400 }}>
                          → {row.step.replace(/_/g, ' ')}
                        </div>
                      </td>
                      {OVERLAY_SYSTEMS.map(sys => {
                        const risk = cellMap[sys.id][row.id];
                        return (
                          <td key={sys.id} style={{ padding: '0.35rem 0.5rem', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
                            <button
                              onClick={() => setOverlayDetail({
                                systemLabel: sys.label,
                                rowLabel: row.label,
                                step: row.step,
                                risk,
                                explanation: overlayExplanation(
                                  sys.id,
                                  row.id,
                                  risk,
                                  input,
                                  dhwBand.label,
                                  overlayMeetsUnvented,
                                  overlayHasFlow,
                                  overlayInconsistent,
                                ),
                              })}
                              title={`Open ${row.label} explanation for ${sys.label}`}
                              style={{
                                width: '100%',
                                padding: '0.35rem 0.25rem',
                                background: CELL_BG[risk],
                                border: `1px solid ${CELL_BORDER[risk]}`,
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                lineHeight: 1,
                              }}
                            >
                              {CELL_ICON[risk]}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* Overall row */}
                  <tr style={{ background: '#edf2f7', borderTop: '2px solid #e2e8f0' }}>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#2d3748' }}>
                      Overall
                    </td>
                    {OVERLAY_SYSTEMS.map(sys => {
                      const cells = OVERLAY_ROWS.map(r => cellMap[sys.id][r.id]);
                      const overall = overallRisk(cells);
                      return (
                        <td key={sys.id} style={{ padding: '0.5rem 0.5rem', textAlign: 'center' }}>
                          <button
                            onClick={() => setOverlayDetail({
                              systemLabel: sys.label,
                              rowLabel: 'Overall',
                              step: OVERLAY_ROWS.find(r => cellMap[sys.id][r.id] !== 'pass')?.step ?? 'overlay',
                              risk: overall,
                              explanation: {
                                ruleName: 'Overall system readiness',
                                observedValue: `Overall status: ${overall.toUpperCase()}`,
                                threshold: 'Overall rolls up all physics-domain checks for this architecture.',
                                whyItMatters: 'This provides a quick view of whether follow-up actions are required before selection.',
                                whatWouldChange: 'Open the specific caution/fail domains to see the controlling rule and required action.',
                              },
                            })}
                            style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.5rem',
                              background: CELL_BG[overall],
                              border: `1px solid ${CELL_BORDER[overall]}`,
                              borderRadius: '4px',
                              fontSize: '0.9rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {CELL_ICON[overall]}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.875rem', fontSize: '0.78rem', color: '#718096', flexWrap: 'wrap' }}>
              <span>✅ Pass — no constraint</span>
              <span>⚠️ Caution — check detail</span>
              <span>❌ Fail — blocking constraint</span>
              <span style={{ marginLeft: 'auto', color: '#718096' }}>
                Click any cell to jump to the controlling step
              </span>
            </div>

            {overlayDetail && (
              <div style={{
                marginTop: '0.9rem',
                padding: '0.85rem 1rem',
                background: CELL_BG[overlayDetail.risk],
                border: `1px solid ${CELL_BORDER[overlayDetail.risk]}`,
                borderRadius: '8px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, color: '#2d3748' }}>
                    {overlayDetail.systemLabel} · {overlayDetail.rowLabel} · {overlayDetail.risk.toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {overlayDetail.step !== 'overlay' && (
                      <button
                        onClick={() => {
                          setCurrentStep(overlayDetail.step);
                          setOverlayDetail(null);
                        }}
                        style={{
                          padding: '0.3rem 0.6rem',
                          border: '1px solid #cbd5e0',
                          borderRadius: '4px',
                          background: '#fff',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                        }}
                      >
                        Jump to {overlayDetail.step.replace(/_/g, ' ')}
                      </button>
                    )}
                    <button
                      onClick={() => setOverlayDetail(null)}
                      style={{
                        padding: '0.3rem 0.6rem',
                        border: '1px solid #cbd5e0',
                        borderRadius: '4px',
                        background: '#fff',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: '#4a5568', lineHeight: 1.5 }}>
                  <div><strong>Rule:</strong> {overlayDetail.explanation.ruleName}</div>
                  <div><strong>Observed:</strong> {overlayDetail.explanation.observedValue}</div>
                  <div><strong>Threshold:</strong> {overlayDetail.explanation.threshold}</div>
                  <div><strong>Why it matters:</strong> {overlayDetail.explanation.whyItMatters}</div>
                  <div><strong>What would change it:</strong> {overlayDetail.explanation.whatWouldChange}</div>
                </div>
              </div>
            )}

            {/* Plan-type fallback capture — shown when systemPlanType was never set */}
            {input.systemPlanType === undefined && (
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem 1rem',
                background: '#fffbeb',
                border: '1px solid #f6e05e',
                borderRadius: '6px',
                fontSize: '0.85rem',
              }}>
                <strong>⚠️ Heating / hot water layout — not confirmed</strong>
                <p style={{ margin: '0.375rem 0 0.625rem', color: '#744210' }}>
                  Select the zone control arrangement to ensure accurate condensing runtime
                  analysis. If unsure, you can proceed — the result will note this as unconfirmed.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {PLAN_TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      aria-pressed={input.systemPlanType === opt.value}
                      onClick={() => setInput(prev => ({ ...prev, systemPlanType: opt.value }))}
                      style={{
                        padding: '0.4rem 0.875rem',
                        border: '2px solid #e2e8f0',
                        borderRadius: '6px',
                        background: '#fff',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        lineHeight: 1.3,
                        textAlign: 'left',
                      }}
                    >
                      <div>{opt.label}</div>
                      <div style={{ fontWeight: 400, fontSize: '0.75rem', color: '#718096' }}>{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="step-actions">
              <button className="prev-btn" onClick={prev}>← Back</button>
              <button className="next-btn" onClick={next}>Run Full Analysis →</button>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

// ─── Step 3: Lifestyle & Thermal Comfort ─────────────────────────────────────

interface LifestyleStepProps {
  input: FullSurveyModelV1;
  fabricType: BuildingFabricType;
  selectedArchetype: { label: string; tauHours: number; fabricType: BuildingFabricType };
  setInput: React.Dispatch<React.SetStateAction<FullSurveyModelV1>>;
  onNext: () => void;
  onPrev: () => void;
}

function LifestyleComfortStep({ input, fabricType, selectedArchetype, setInput, onNext, onPrev }: LifestyleStepProps) {
  const thermalResult = useMemo(() => runThermalInertiaModule({
    fabricType,
    occupancyProfile: input.occupancySignature === 'steady_home' ? 'home_all_day' : 'professional',
    initialTempC: 20,
    outdoorTempC: 5,
  }), [fabricType, input.occupancySignature]);

  const dropWarning = thermalResult.totalDropC > 4;

  // ── Household composition state ───────────────────────────────────────────
  // Default to a minimal composition when none has been set yet.
  const DEFAULT_COMPOSITION: HouseholdComposition = {
    adultCount: 1,
    childCount0to4: 0,
    childCount5to10: 0,
    childCount11to17: 0,
    youngAdultCount18to25AtHome: 0,
  };
  const composition: HouseholdComposition = input.householdComposition ?? DEFAULT_COMPOSITION;
  const hasComposition = input.householdComposition != null;

  // Read daytime pattern from existing timing overrides (mapped from engine values).
  const daytimePattern: DaytimeOccupancyPattern =
    input.demandTimingOverrides?.daytimeOccupancy === 'full'    ? 'usually_home' :
    input.demandTimingOverrides?.daytimeOccupancy === 'partial' ? 'irregular' :
    'usually_out';

  // Read bath use band from bathFrequencyPerWeek.
  const bathUse: BathUsePattern =
    (input.demandTimingOverrides?.bathFrequencyPerWeek ?? 0) >= 7 ? 'frequent' :
    (input.demandTimingOverrides?.bathFrequencyPerWeek ?? 0) >= 2 ? 'sometimes' :
    'rare';

  // ── Composition handlers ──────────────────────────────────────────────────

  /** Update a single composition band and re-derive the demand profile. */
  function handleCompositionChange(patch: Partial<HouseholdComposition>) {
    const newComposition: HouseholdComposition = { ...composition, ...patch };
    const derived = deriveProfileFromHouseholdComposition(newComposition, daytimePattern, bathUse);
    const sig = presetToEngineSignature(derived.derivedPresetId);
    setInput(prev => ({
      ...prev,
      householdComposition: newComposition,
      demandPreset: derived.derivedPresetId,
      occupancySignature: sig,
      occupancyCount: derived.occupancyCount,
      highOccupancy: derived.occupancyCount >= 4,
      demandTimingOverrides: {
        ...prev.demandTimingOverrides,
        bathFrequencyPerWeek: derived.bathFrequencyPerWeek,
        simultaneousUseSeverity: derived.simultaneousUseSeverity,
        daytimeOccupancy: derived.daytimeOccupancyHint,
      },
    }));
  }

  /** Increment / decrement a composition band, clamped to 0–MAX_BAND_COUNT. */
  const MAX_BAND_COUNT = 10;
  function adjustBand(band: keyof HouseholdComposition, delta: number) {
    const current = composition[band];
    const next = Math.max(0, Math.min(MAX_BAND_COUNT, current + delta));
    handleCompositionChange({ [band]: next });
  }

  /** Update the weekday pattern and re-derive the profile. */
  function handleDaytimePatternChange(pattern: DaytimeOccupancyPattern) {
    const daytimeOccupancy: DemandTimingOverrides['daytimeOccupancy'] =
      pattern === 'usually_home' ? 'full' :
      pattern === 'irregular'    ? 'partial' : 'absent';
    if (hasComposition) {
      const derived = deriveProfileFromHouseholdComposition(composition, pattern, bathUse);
      const sig = presetToEngineSignature(derived.derivedPresetId);
      setInput(prev => ({
          ...prev,
          demandPreset: derived.derivedPresetId,
          occupancySignature: sig,
          occupancyCount: derived.occupancyCount,
          highOccupancy: derived.occupancyCount >= 4,
          demandTimingOverrides: {
            ...prev.demandTimingOverrides,
            daytimeOccupancy,
            simultaneousUseSeverity: derived.simultaneousUseSeverity,
          },
        }));
    } else {
      setInput(prev => ({
        ...prev,
        demandTimingOverrides: { ...prev.demandTimingOverrides, daytimeOccupancy },
      }));
    }
  }

  /** Update the bath use band and re-derive the profile. */
  function handleBathUseChange(bath: BathUsePattern) {
    if (hasComposition) {
      const derived = deriveProfileFromHouseholdComposition(composition, daytimePattern, bath);
      const sig = presetToEngineSignature(derived.derivedPresetId);
      setInput(prev => ({
        ...prev,
        demandPreset: derived.derivedPresetId,
        occupancySignature: sig,
        occupancyCount: derived.occupancyCount,
        highOccupancy: derived.occupancyCount >= 4,
        demandTimingOverrides: {
          ...prev.demandTimingOverrides,
          bathFrequencyPerWeek: derived.bathFrequencyPerWeek,
          simultaneousUseSeverity: derived.simultaneousUseSeverity,
          daytimeOccupancy: derived.daytimeOccupancyHint,
        },
      }));
    } else {
      const bathFrequency = bath === 'frequent' ? 7 : bath === 'sometimes' ? 3 : 0;
      setInput(prev => ({
        ...prev,
        demandTimingOverrides: { ...prev.demandTimingOverrides, bathFrequencyPerWeek: bathFrequency },
      }));
    }
  }

  // ── Derive the active preset id — fall back to a sensible default ───────────
  const activePresetId: DemandPresetId = (input.demandPreset as DemandPresetId | undefined)
    ?? 'single_working_adult';

  // ── Apply preset selection (manual override path) ─────────────────────────
  function handlePresetSelect(id: DemandPresetId) {
    const sig = presetToEngineSignature(id);
    setInput(prev => ({
      ...prev,
      demandPreset: id,
      occupancySignature: sig,
      demandTimingOverrides: undefined,   // clear any stale overrides from old preset
    }));
  }

  // ── Apply a single timing-override field ──────────────────────────────────
  function handleTimingChange(patch: Partial<DemandTimingOverrides>) {
    setInput(prev => ({
      ...prev,
      demandTimingOverrides: { ...prev.demandTimingOverrides, ...patch },
    }));
  }

  // Resolved timing (preset defaults merged with any overrides)
  const timing = resolveTimingOverrides(activePresetId, input.demandTimingOverrides as DemandTimingOverrides | undefined);

  // ── DHW sanity summary — physics-derived indicator ───────────────────────
  // Shows estimated daily litres and peak concurrent outlets so users can spot
  // a zero-demand scenario immediately (red flag: 0 L or 0 outlets).
  /** Typical UK shower volume per person per event (litres). */
  const LITRES_PER_SHOWER = 50;
  /** Standard UK bath draw volume (litres). */
  const LITRES_PER_BATH   = 120;
  /** Kitchen hot-water daily litres by frequency band. */
  const KITCHEN_LITRES_BY_FREQUENCY: Record<Required<DemandTimingOverrides>['kitchenHotWaterFrequency'], number> = {
    low: 5, medium: 15, high: 30,
  };
  const occupancyForDhw = Math.max(1, input.occupancyCount ?? 2);
  const bathsPerDay = timing.bathFrequencyPerWeek / 7;
  const estimatedDailyLitres = Math.round(
    occupancyForDhw * LITRES_PER_SHOWER
    + bathsPerDay * LITRES_PER_BATH
    + (KITCHEN_LITRES_BY_FREQUENCY[timing.kitchenHotWaterFrequency] ?? 15),
  );
  // Peak outlets: explicit survey value wins; otherwise derive from preset simultaneous severity.
  const estimatedPeakOutlets =
    input.peakConcurrentOutlets ??
    (timing.simultaneousUseSeverity === 'high' || timing.simultaneousUseSeverity === 'medium' ? 2 : 1);
  const dhwSummaryOk = estimatedDailyLitres > 0 && estimatedPeakOutlets > 0;

  return (
    <div className="step-card">
      <h2>🏠 Step 4: Lifestyle &amp; Thermal Comfort</h2>

      {/* ── Household composition card ───────────────────────────────────── */}
      <div
        data-testid="household-composition-card"
        style={{
          padding: '1rem',
          background: '#f7fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          marginBottom: '1.25rem',
        }}
      >
        <p style={{ fontWeight: 600, fontSize: '0.9rem', color: '#2d3748', marginBottom: '0.75rem', marginTop: 0 }}>
          Who lives here?
        </p>
        <p style={{ fontSize: '0.78rem', color: '#718096', marginBottom: '0.875rem', marginTop: 0 }}>
          Enter the number of people in each age group. The demand profile is derived automatically.
        </p>

        {/* ── Age-band stepper rows ─────────────────────────────────────── */}
        {(
          [
            { band: 'adultCount',                label: 'Adults',             emoji: '👤' },
            { band: 'childCount0to4',             label: 'Age 0–4',            emoji: '🍼' },
            { band: 'childCount5to10',            label: 'Age 5–10',           emoji: '🎒' },
            { band: 'childCount11to17',           label: 'Age 11–17',          emoji: '🎧' },
            { band: 'youngAdultCount18to25AtHome', label: 'Age 18–25 at home', emoji: '🎓' },
          ] as Array<{ band: keyof HouseholdComposition; label: string; emoji: string }>
        ).map(({ band, label, emoji }) => (
          <div
            key={band}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.375rem 0',
              borderBottom: '1px solid #edf2f7',
            }}
          >
            <span style={{ fontSize: '0.85rem', color: '#4a5568' }}>
              {emoji} {label}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                aria-label={`Decrease ${label}`}
                onClick={() => adjustBand(band, -1)}
                disabled={composition[band] <= 0}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: '1px solid #cbd5e0', background: '#fff',
                  cursor: composition[band] <= 0 ? 'not-allowed' : 'pointer',
                  fontSize: '1rem', fontWeight: 700, color: '#4a5568',
                  opacity: composition[band] <= 0 ? 0.4 : 1,
                }}
              >−</button>
              <span
                data-testid={`composition-${band}`}
                style={{ minWidth: 20, textAlign: 'center', fontWeight: 700, fontSize: '0.9rem', color: '#2d3748' }}
              >
                {composition[band]}
              </span>
              <button
                aria-label={`Increase ${label}`}
                onClick={() => adjustBand(band, 1)}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: '1px solid #cbd5e0', background: '#fff',
                  cursor: 'pointer', fontSize: '1rem', fontWeight: 700, color: '#4a5568',
                }}
              >+</button>
            </div>
          </div>
        ))}

        {/* ── Weekday pattern ───────────────────────────────────────────── */}
        <div style={{ marginTop: '1rem' }}>
          <p style={{ fontWeight: 600, fontSize: '0.85rem', color: '#4a5568', marginBottom: '0.5rem', marginTop: 0 }}>
            Weekday pattern
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(
              [
                { value: 'usually_out',  label: 'Usually out' },
                { value: 'usually_home', label: 'Usually someone home' },
                { value: 'irregular',    label: 'Irregular / shifts' },
              ] as Array<{ value: DaytimeOccupancyPattern; label: string }>
            ).map(({ value, label }) => (
              <button
                key={value}
                data-testid={`daytime-pattern-${value}`}
                onClick={() => handleDaytimePatternChange(value)}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '6px',
                  border: daytimePattern === value ? '2px solid #3182ce' : '1px solid #e2e8f0',
                  background: daytimePattern === value ? '#ebf8ff' : '#fff',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: daytimePattern === value ? 600 : 400,
                  color: daytimePattern === value ? '#2b6cb0' : '#4a5568',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Bath use ─────────────────────────────────────────────────── */}
        <div style={{ marginTop: '0.875rem' }}>
          <p style={{ fontWeight: 600, fontSize: '0.85rem', color: '#4a5568', marginBottom: '0.5rem', marginTop: 0 }}>
            Bath use
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(
              [
                { value: 'rare',      label: 'Rare' },
                { value: 'sometimes', label: 'Sometimes' },
                { value: 'frequent',  label: 'Frequent' },
              ] as Array<{ value: BathUsePattern; label: string }>
            ).map(({ value, label }) => (
              <button
                key={value}
                data-testid={`bath-use-${value}`}
                onClick={() => handleBathUseChange(value)}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '6px',
                  border: bathUse === value ? '2px solid #3182ce' : '1px solid #e2e8f0',
                  background: bathUse === value ? '#ebf8ff' : '#fff',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: bathUse === value ? 600 : 400,
                  color: bathUse === value ? '#2b6cb0' : '#4a5568',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Derived demand style badge ────────────────────────────────────── */}
      <div style={{
        padding: '0.625rem 0.875rem',
        background: '#ebf8ff',
        border: '1px solid #bee3f8',
        borderRadius: '6px',
        fontSize: '0.82rem',
        color: '#2b6cb0',
        marginBottom: '0.75rem',
      }}>
        <strong>{hasComposition ? 'Derived demand style: ' : 'Selected demand style: '}</strong>{getDemandStyleLabel(activePresetId)}
      </div>

      {/* ── DHW demand sanity indicator ──────────────────────────────────── */}
      <div
        data-testid="dhw-demand-summary"
        style={{
          padding: '0.5rem 0.875rem',
          background: dhwSummaryOk ? '#f0fff4' : '#fff5f5',
          border: `1px solid ${dhwSummaryOk ? '#9ae6b4' : '#feb2b2'}`,
          borderRadius: '6px',
          fontSize: '0.8rem',
          color: dhwSummaryOk ? '#276749' : '#c53030',
          marginBottom: '1.25rem',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <span>💧 Daily hot water: <strong>~{estimatedDailyLitres}L</strong></span>
        <span>🚿 Peak demand: <strong>{estimatedPeakOutlets} outlet{estimatedPeakOutlets !== 1 ? 's' : ''}</strong></span>
        {!dhwSummaryOk && <span style={{ fontWeight: 700 }}>⚠️ Zero demand — check occupancy</span>}
      </div>

      {/* ── Advanced: manual archetype override ─────────────────────────── */}
      <details style={{ marginBottom: '1.25rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#4a5568', fontSize: '0.9rem' }}>
          🔧 Advanced: manual archetype override (optional)
        </summary>
        <p style={{ fontSize: '0.78rem', color: '#718096', margin: '0.5rem 0 0.75rem' }}>
          The profile above is derived automatically from household composition. You can override it here if needed.
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '0.5rem',
        }}>
          {DEMAND_PRESETS.map(preset => {
            const isActive = preset.id === activePresetId;
            return (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '8px',
                  border: isActive ? '2px solid #3182ce' : '1px solid #e2e8f0',
                  background: isActive ? '#ebf8ff' : '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <span style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{preset.emoji}</span>
                <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#2d3748', lineHeight: 1.3 }}>
                  {preset.label}
                </span>
                <span style={{ fontSize: '0.73rem', color: '#718096', marginTop: '0.2rem', lineHeight: 1.3 }}>
                  {preset.description}
                </span>
              </button>
            );
          })}
        </div>
      </details>

      {/* ── Quick timing controls ────────────────────────────────────────── */}
      <details style={{ marginBottom: '1.25rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#4a5568', fontSize: '0.9rem' }}>
          ⚡ Quick demand shaping (optional)
        </summary>
        <p style={{ fontSize: '0.78rem', color: '#718096', margin: '0.5rem 0 0.75rem' }}>
          These are pre-filled from your chosen preset. Tap to adjust — all are optional.
        </p>
        <div className="form-grid" style={{ gap: '0.75rem' }}>

          <div className="form-field">
            <label style={{ fontSize: '0.82rem' }}>First shower time</label>
            <select
              value={timing.firstShowerHour}
              onChange={e => handleTimingChange({ firstShowerHour: Number(e.target.value) })}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label style={{ fontSize: '0.82rem' }}>Evening hot-water peak</label>
            <select
              value={timing.eveningPeakHour}
              onChange={e => handleTimingChange({ eveningPeakHour: Number(e.target.value) })}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label style={{ fontSize: '0.82rem' }}>Bath frequency</label>
            <select
              value={timing.bathFrequencyPerWeek}
              onChange={e => handleTimingChange({ bathFrequencyPerWeek: Number(e.target.value) })}
            >
              <option value={0}>Never</option>
              <option value={1}>Once a week</option>
              <option value={2}>Twice a week</option>
              <option value={3}>3× a week</option>
              <option value={5}>5× a week</option>
              <option value={7}>Daily</option>
              <option value={14}>Twice daily</option>
            </select>
          </div>

          <div className="form-field">
            <label style={{ fontSize: '0.82rem' }}>Kitchen hot water</label>
            <select
              value={timing.kitchenHotWaterFrequency}
              onChange={e => handleTimingChange({ kitchenHotWaterFrequency: e.target.value as DemandTimingOverrides['kitchenHotWaterFrequency'] })}
            >
              <option value="low">Low — occasional</option>
              <option value="medium">Medium — most days</option>
              <option value="high">High — throughout the day</option>
            </select>
          </div>

          <div className="form-field">
            <label style={{ fontSize: '0.82rem' }}>Daytime occupancy</label>
            <select
              value={timing.daytimeOccupancy}
              onChange={e => handleTimingChange({ daytimeOccupancy: e.target.value as DemandTimingOverrides['daytimeOccupancy'] })}
            >
              <option value="absent">Absent (out all day)</option>
              <option value="partial">Partial (some home working / part-time)</option>
              <option value="full">Full (home all day)</option>
            </select>
          </div>

          <div className="form-field">
            <label style={{ fontSize: '0.82rem' }}>Simultaneous hot water</label>
            <select
              value={timing.simultaneousUseSeverity}
              onChange={e => handleTimingChange({ simultaneousUseSeverity: e.target.value as DemandTimingOverrides['simultaneousUseSeverity'] })}
            >
              <option value="low">Low — single outlet at a time</option>
              <option value="medium">Medium — two outlets occasionally</option>
              <option value="high">High — two or more outlets regularly</option>
            </select>
          </div>

        </div>
      </details>

      {/* Thermal Comfort Physics — collapsed by default to reduce page noise */}
      <details style={{ marginTop: '1.25rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#4a5568', fontSize: '0.9rem' }}>
          🌡️ Comfort Physics – Predicted Temperature Decay (optional)
        </summary>
        <div style={{ marginTop: '0.75rem' }}>
        <p style={{ fontSize: '0.82rem', color: '#718096', marginBottom: '0.75rem' }}>
          T(t) = T<sub>outdoor</sub> + (T<sub>initial</sub> − T<sub>outdoor</sub>) × e<sup>−t/τ</sup>
          &nbsp;— Building: <strong>{selectedArchetype.label}</strong> (τ = {selectedArchetype.tauHours}h)
        </p>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{
            padding: '0.625rem 0.875rem',
            background: '#f7fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            fontSize: '0.85rem',
          }}>
            <span style={{ color: '#718096' }}>Starting temp:</span> <strong>20°C</strong>
          </div>
          <div style={{
            padding: '0.625rem 0.875rem',
            background: '#f7fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            fontSize: '0.85rem',
          }}>
            <span style={{ color: '#718096' }}>Outdoor (design):</span> <strong>5°C</strong>
          </div>
          <div style={{
            padding: '0.625rem 0.875rem',
            background: '#f7fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            fontSize: '0.85rem',
          }}>
            <span style={{ color: '#718096' }}>After absence:</span>{' '}
            <strong style={{ color: dropWarning ? '#c53030' : '#276749' }}>
              {thermalResult.finalTempC}°C (↓{thermalResult.totalDropC}°C)
            </strong>
          </div>
        </div>

        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={thermalResult.trace} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#edf2f7" />
              <XAxis
                dataKey="hourOffset"
                tickFormatter={h => `+${h}h`}
                tick={{ fontSize: 11 }}
                label={{ value: 'Hours without heating', position: 'insideBottom', offset: -2, fontSize: 11 }}
              />
              <YAxis
                domain={[0, 22]}
                tick={{ fontSize: 11 }}
                tickFormatter={v => `${v}°C`}
              />
              <Tooltip formatter={tempTooltipFormatter} />
              <ReferenceLine y={16} stroke="#e53e3e" strokeDasharray="4 4" label={{ value: '16°C min', fontSize: 10, fill: '#e53e3e' }} />
              <ReferenceLine
                y={thermalResult.finalTempC}
                stroke={dropWarning ? '#c53030' : '#38a169'}
                strokeDasharray="3 3"
              />
              <Line
                type="monotone"
                dataKey="tempC"
                stroke="#3182ce"
                strokeWidth={2}
                dot={false}
                name="Room temperature"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {dropWarning && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.625rem 0.875rem',
            background: '#fff5f5',
            border: '1px solid #fed7d7',
            borderRadius: '6px',
            fontSize: '0.82rem',
            color: '#c53030',
          }}>
            ⚠️ Temperature drops <strong>{thermalResult.totalDropC}°C</strong> during absence (more than 4°C threshold).
            The report will recommend fabric improvements (insulation upgrades) to reduce the reheat penalty.
          </div>
        )}

        {!dropWarning && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.625rem 0.875rem',
            background: '#f0fff4',
            border: '1px solid #9ae6b4',
            borderRadius: '6px',
            fontSize: '0.82rem',
            color: '#276749',
          }}>
            ✅ Temperature drop of <strong>{thermalResult.totalDropC}°C</strong> is within the 4°C comfort threshold.
            The thermal mass retains heat well during the away period.
          </div>
        )}

        {thermalResult.notes.length > 0 && (
          <ul className="notes-list" style={{ marginTop: '0.75rem' }}>
            {thermalResult.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        )}
        </div>
      </details>

      {/* ─── Thermal Telemetry ───────────────────────────────────────────── */}
      <details style={{ marginTop: '1.25rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#4a5568' }}>
          🌡️ Thermal Telemetry (optional)
        </summary>
        <div style={{ marginTop: '0.75rem', padding: '0.875rem', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
          <p style={{ fontSize: '0.82rem', color: '#4a5568', marginTop: 0, marginBottom: '0.75rem', lineHeight: 1.5 }}>
            Manually indicate how quickly your home loses heat. This improves the thermal inertia model used to calculate heating schedules and boiler cycling estimates.
          </p>
          <div className="form-field">
            <label>Thermal inertia feel (manual proxy)</label>
            <select
              value={input.fullSurvey?.telemetryPlaceholders?.confidence ?? 'none'}
              onChange={e => setInput({
                ...input,
                fullSurvey: {
                  ...input.fullSurvey,
                  telemetryPlaceholders: {
                    ...input.fullSurvey?.telemetryPlaceholders,
                    confidence: e.target.value as 'none' | 'low' | 'high',
                  },
                },
              })}
            >
              <option value="none">Unknown</option>
              <option value="low">Low — house cools quickly</option>
              <option value="high">High — house retains heat well</option>
            </select>
          </div>
        </div>
      </details>

      <div className="step-actions">
        <button className="prev-btn" onClick={onPrev}>← Back</button>
        <button className="next-btn" onClick={onNext}>Next →</button>
      </div>
    </div>
  );
}
