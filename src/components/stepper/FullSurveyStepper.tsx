import { useState, useMemo, useEffect, startTransition } from 'react';
import ModellingNotice from '../ModellingNotice';
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
import type { EngineInputV2_3, FullEngineResult, BuildingFabricType } from '../../engine/schema/EngineInputV2_3';
import type { VisualSpecV1, Timeline24hV1 } from '../../contracts/EngineOutputV1';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import { toEngineInput } from '../../ui/fullSurvey/FullSurveyModelV1';
import { runEngine } from '../../engine/Engine';
import { runThermalInertiaModule } from '../../engine/modules/ThermalInertiaModule';
import { calcFlowLpm, PIPE_THRESHOLDS } from '../../engine/modules/HydraulicModule';
import { runCombiDhwModuleV1 } from '../../engine/modules/CombiDhwModule';
import { analysePressure } from '../../engine/modules/PressureModule';
import { runRegionalHardness } from '../../engine/modules/RegionalHardness';
import { resolveNominalEfficiencyPct, computeCurrentEfficiencyPct, ERP_TO_NOMINAL_PCT, deriveErpClass } from '../../engine/utils/efficiency';
import InteractiveComfortClock from '../visualizers/InteractiveComfortClock';
import LifestyleInteractive from '../visualizers/LifestyleInteractive';
import DemandProfilePainter from '../visualizers/DemandProfilePainter';
import EfficiencyCurve from '../visualizers/EfficiencyCurve';
import FootprintXRay from '../visualizers/FootprintXRay';
import GlassBoxPanel from '../visualizers/GlassBoxPanel';
import InteractiveTwin from '../InteractiveTwin';
import Timeline24hRenderer from '../visualizers/Timeline24hRenderer';
import SystemConditionImpact from '../visualizers/SystemConditionImpact';
import { computeConditionImpactMetrics } from '../../engine/modules/SystemConditionImpactModule';
// BOM utilities retained for internal/engineer mode — not rendered in customer cockpit
// import { exportBomToCsv, calculateBomTotal } from '../../engine/modules/WholesalerPricingAdapter';

interface Props {
  onBack: () => void;
  /** Optional prefill state from Story Mode escalation. */
  prefill?: Partial<FullSurveyModelV1>;
}

type Step = 'location' | 'pressure' | 'hydraulic' | 'lifestyle' | 'hot_water' | 'commercial' | 'overlay' | 'results';
const STEPS: Step[] = ['location', 'pressure', 'hydraulic', 'lifestyle', 'hot_water', 'commercial', 'overlay', 'results'];

// ─── Fabric Behaviour Controls ────────────────────────────────────────────────
// Two independent physics dimensions:
//   A) Fabric heat-loss (wall type, insulation, glazing, roof, airtightness)
//   B) Thermal inertia (mass — separate from wall type)

type WallType = 'solid_masonry' | 'cavity_insulated' | 'cavity_uninsulated' | 'timber_lightweight';
type InsulationLevel = 'poor' | 'moderate' | 'good' | 'exceptional';
type AirTightness = 'leaky' | 'average' | 'tight' | 'passive_level';
type Glazing = 'single' | 'double' | 'triple';
type RoofInsulation = 'poor' | 'moderate' | 'good';
type ThermalMass = 'light' | 'medium' | 'heavy';

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

function sanitiseModelForEngine(model: FullSurveyModelV1): FullSurveyModelV1 {
  const sanitised: FullSurveyModelV1 = { ...model };
  if (sanitised.currentBoilerAgeYears !== undefined && sanitised.currentBoilerAgeYears > 50) {
    sanitised.currentBoilerAgeYears = undefined;
  }
  if (sanitised.mainsDynamicFlowLpm !== undefined && sanitised.mainsDynamicFlowLpm > 60) {
    sanitised.mainsDynamicFlowLpm = undefined;
  }
  if (sanitised.staticMainsPressureBar !== undefined && sanitised.staticMainsPressureBar > 10) {
    sanitised.staticMainsPressureBar = 10;
  }
  const dynamicPressure = sanitised.dynamicMainsPressureBar ?? sanitised.dynamicMainsPressure;
  if (
    sanitised.staticMainsPressureBar !== undefined
    && dynamicPressure !== undefined
    && dynamicPressure > sanitised.staticMainsPressureBar
  ) {
    sanitised.dynamicMainsPressureBar = undefined;
    sanitised.dynamicMainsPressure = sanitised.staticMainsPressureBar;
  }
  return sanitised;
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
  if (score === 2) return { label: 'Moderate', colour: '#d69e2e' };
  if (score === 3) return { label: 'High',     colour: '#dd6b20' };
  return              { label: 'Very High', colour: '#c53030' };
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

const ASHP_COP_LABEL: Record<'pass' | 'caution', string> = {
  pass: '✅ Acceptable',
  caution: '⚠️ Borderline Physics',
};

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

// Preset examples — promoted to a primary "home type" selector in Step 1
const FABRIC_PRESETS: Array<{
  label: string;
  wall: WallType;
  insulation: InsulationLevel;
  air: AirTightness;
  glaz: Glazing;
  roof: RoofInsulation;
  mass: ThermalMass;
}> = [
  { label: 'Solid brick (pre-war)',          wall: 'solid_masonry',      insulation: 'poor',       air: 'leaky',         glaz: 'single', roof: 'poor',     mass: 'heavy'  },
  { label: '1970s cavity filled',            wall: 'cavity_insulated',   insulation: 'moderate',   air: 'average',       glaz: 'double', roof: 'moderate', mass: 'medium' },
  { label: 'Turn of century / high-exposure',wall: 'cavity_uninsulated', insulation: 'poor',       air: 'leaky',         glaz: 'single', roof: 'poor',     mass: 'heavy'  },
  { label: '2020s new build',                wall: 'timber_lightweight', insulation: 'moderate',   air: 'tight',         glaz: 'double', roof: 'good',     mass: 'light'  },
  { label: 'Passivhaus',                     wall: 'timber_lightweight', insulation: 'exceptional', air: 'passive_level', glaz: 'triple', roof: 'good',     mass: 'light'  },
];

const defaultInput: FullSurveyModelV1 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.0,
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
    connectedEvidence: { energyProvider: 'placeholder', hive: 'placeholder' },
    manualEvidence: {},
    telemetryPlaceholders: { coolingTau: null, confidence: 'none' },
  },
};

export default function FullSurveyStepper({ onBack, prefill }: Props) {
  const [currentStep, setCurrentStep] = useState<Step>('location');
  const [input, setInput] = useState<FullSurveyModelV1>(() =>
    prefill ? { ...defaultInput, ...prefill } : defaultInput
  );
  const [prefillActive] = useState<boolean>(!!prefill);
  const [showPrefillBanner, setShowPrefillBanner] = useState<boolean>(!!prefill);
  const [compareMixergy, setCompareMixergy] = useState(false);
  const [results, setResults] = useState<FullEngineResult | null>(null);
  const [systemPlanType, setSystemPlanType] = useState<'y_plan' | 's_plan'>('s_plan');

  // Water hardness search: shows a live preview when the user clicks "Search"
  const [hardnessPreview, setHardnessPreview] = useState<ReturnType<typeof runRegionalHardness> | null>(null);
  const searchHardness = () => setHardnessPreview(runRegionalHardness(input.postcode));

  // Raw string state for iOS-friendly numeric inputs (preserves typed value, normalises on blur)
  const [rawPressureStr, setRawPressureStr] = useState(String(defaultInput.dynamicMainsPressure));
  const [rawFlowStr, setRawFlowStr] = useState(
    defaultInput.mainsDynamicFlowLpm != null ? String(defaultInput.mainsDynamicFlowLpm) : ''
  );

  // ── Fabric simulation controls ─────────────────────────────────────────────
  // Section A (heat loss): wall, insulation, glazing, roof, airtightness
  // Section B (inertia): thermalMass (independent from wall type)
  const [wallType, setWallType] = useState<WallType>('solid_masonry');
  const [insulationLevel, setInsulationLevel] = useState<InsulationLevel>('moderate');
  const [airTightness, setAirTightness] = useState<AirTightness>('average');
  const [glazing, setGlazing] = useState<Glazing>('single');
  const [roofInsulation, setRoofInsulation] = useState<RoofInsulation>('poor');
  const [thermalMass, setThermalMass] = useState<ThermalMass>('heavy');

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

  const stepIndex = STEPS.indexOf(currentStep);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const next = () => {
    if (currentStep === 'overlay') {
      // Strip fullSurvey extras — pass only the EngineInputV2_3 subset to the engine.
      setResults(runEngine(toEngineInput(sanitiseModelForEngine(input))));
      setCurrentStep('results');
    } else {
      setCurrentStep(STEPS[stepIndex + 1]);
    }
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

  return (
    <div className="stepper-container">
      {showPrefillBanner && prefillActive && (
        <div className="prefill-banner" role="status">
          <span>Prefilled from Story Mode.</span>
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

      {currentStep === 'location' && (
        <div className="step-card">
          <h2>📍 Step 1: Geochemical &amp; Fabric Baseline</h2>
          <p className="description">
            Your postcode outward code anchors the simulation to local water chemistry (e.g. SW1A,
            BH, DT). The fabric controls below drive two independent physics estimates:
            <strong>how much heat leaks</strong> (fabric heat-loss band) and <strong>how spiky demand feels</strong>
            (thermal inertia / τ).
          </p>

          <div className="form-grid">
            <div className="form-field">
              <label>Postcode</label>
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

            {/* ── Home type quick-select (auto-populates fabric controls) ── */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: '0.4rem', color: '#4a5568' }}>
                🏠 Home type (auto-fills construction &amp; insulation)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {FABRIC_PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => {
                      setWallType(p.wall);
                      setInsulationLevel(p.insulation);
                      setAirTightness(p.air);
                      setGlazing(p.glaz);
                      setRoofInsulation(p.roof);
                      setThermalMass(p.mass);
                    }}
                    style={{
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.82rem',
                      border: '1px solid #cbd5e0',
                      borderRadius: '6px',
                      background: '#f7fafc',
                      cursor: 'pointer',
                      color: '#4a5568',
                      fontWeight: 500,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

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
                        onClick={() => setWallType(opt.value)}
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
                        onClick={() => setInsulationLevel(lvl)}
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
                        onClick={() => setGlazing(opt.value)}
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
                        onClick={() => setRoofInsulation(lvl)}
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
                        onClick={() => setAirTightness(opt.value)}
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
                  <div style={{ fontSize: '0.7rem', color: '#a0aec0' }}>
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
                  <div style={{ fontSize: '0.7rem', color: '#a0aec0' }}>
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
                    onClick={() => setThermalMass(opt.value)}
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

          </div>

          <div className="step-actions">
            <button className="next-btn" onClick={next}>Next →</button>
          </div>
        </div>
      )}

      {currentStep === 'pressure' && (
        <div className="step-card">
          <h2>💧 Step 2: Mains Supply &amp; Flow</h2>
          <p className="description">
            A dynamic operating point (L/min @ bar) is needed to characterise supply quality — pressure
            alone is not enough. The static-to-dynamic drop reveals pipe restriction and shared-mains
            weakness. Enter all readings you have; partial data is better than none.
          </p>

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
                  onChange={e => setInput({
                    ...input,
                    staticMainsPressureBar: e.target.value ? +e.target.value : undefined,
                  })}
                  style={{ marginTop: '0.4rem' }}
                />
                <div style={{ fontSize: '0.75rem', color: '#a0aec0', marginTop: '0.25rem' }}>
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
                      setInput({
                        ...input,
                        dynamicMainsPressure: val,
                        dynamicMainsPressureBar: val,
                      });
                    }
                  }}
                  onBlur={() => setRawPressureStr(r => normaliseNumericString(r))}
                  style={{ marginTop: '0.4rem' }}
                />
                <div style={{ fontSize: '0.75rem', color: '#a0aec0', marginTop: '0.25rem' }}>
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
                    setInput({ ...input, mainsDynamicFlowLpm: flow });
                  }}
                  onBlur={() => setRawFlowStr(r => normaliseNumericString(r))}
                  style={{ marginTop: '0.4rem' }}
                />
                <div style={{ fontSize: '0.75rem', color: '#a0aec0', marginTop: '0.25rem' }}>
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
                  ℹ️ Supply quality needs a dynamic operating point: L/min @ bar. Enter flow above to characterise supply.
                  {input.staticMainsPressureBar == null && <> Drop classification also unavailable without static pressure.</>}
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
                    <div style={{ fontSize: '0.72rem', color: '#a0aec0', marginBottom: '0.2rem' }}>Static</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: input.staticMainsPressureBar != null ? '#1a365d' : '#cbd5e0', lineHeight: 1 }}>
                      {input.staticMainsPressureBar != null ? `${input.staticMainsPressureBar.toFixed(1)}` : '—'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>bar</div>
                  </div>
                  {/* Arrow */}
                  <div style={{ fontSize: '1.4rem', color: '#a0aec0' }}>→</div>
                  {/* Dynamic */}
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: '0.72rem', color: '#a0aec0', marginBottom: '0.2rem' }}>Dynamic</div>
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
                      Drop: <strong>{pressureAnalysis.dropBar.toFixed(1)} bar</strong>
                    </span>
                    <span style={{
                      padding: '0.2rem 0.55rem',
                      background: DROP_COLOUR,
                      color: '#fff',
                      borderRadius: '4px',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                    }}>
                      Diagnostic indicator
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
                    Pressure drop — diagnostic indicator (restriction / shared main)
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#a0aec0', marginTop: '0.25rem' }}>
                    <span>0</span><span>1.0 large drop</span><span>2.0 bar</span>
                  </div>
                  {pressureAnalysis.dropBar >= 1.0 && (
                    <div style={{ fontSize: '0.75rem', color: '#744210', marginTop: '0.35rem' }}>
                      Large drop — suggests restriction or shared main. Confirm with flow test.
                    </div>
                  )}
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
                  <div style={{
                    padding: '0.75rem',
                    background: hasFlow ? '#f0fff4' : '#fffff0',
                    border: `1px solid ${hasFlow ? '#9ae6b4' : '#faf089'}`,
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                  }}>
                    <div style={{ fontWeight: 700, color: '#2d3748', marginBottom: '0.25rem' }}>Dynamic operating point</div>
                    {hasFlow && pressureBar !== undefined
                      ? <div style={{ color: '#276749' }}>✓ {flow.toFixed(1)} L/min @ {pressureBar.toFixed(1)} bar</div>
                      : hasFlow
                      ? <div style={{ color: '#276749' }}>✓ {flow.toFixed(1)} L/min (pressure not recorded)</div>
                      : <div style={{ color: '#744210' }}>Flow not entered — need L/min to characterise supply.</div>
                    }
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="step-actions">
            <button className="prev-btn" onClick={prev}>← Back</button>
            <button className="next-btn" onClick={next}>Next →</button>
          </div>
        </div>
      )}

      {currentStep === 'hydraulic' && (
        <div className="step-card">
          <h2>🔧 Step 3: Hydraulic Integrity</h2>
          <p className="description">
            Pipe size sets the flow rate ceiling. An ASHP operates at ΔT 5°C — four times
            the flow of a boiler at ΔT 20°C. Adjust the controls to see where your circuit
            sits on that curve and whether the primary pipework can sustain both technologies.
          </p>

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
                      onClick={() => setSystemPlanType(opt.value)}
                      style={{
                        flex: 1,
                        padding: '0.5rem 0.75rem',
                        border: `2px solid ${systemPlanType === opt.value ? '#3182ce' : '#e2e8f0'}`,
                        borderRadius: '6px',
                        background: systemPlanType === opt.value ? '#ebf8ff' : '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.12s',
                      }}
                    >
                      <div style={{ fontWeight: systemPlanType === opt.value ? 700 : 500, fontSize: '0.88rem' }}>{opt.label}</div>
                      <div style={{ fontSize: '0.72rem', color: '#718096' }}>{opt.sub}</div>
                    </button>
                  ))}
                </div>
                {systemPlanType === 'y_plan' && (
                  <p style={{ fontSize: '0.75rem', color: '#744210', marginTop: '0.3rem', background: '#fffaf0', padding: '0.3rem 0.5rem', borderRadius: '4px' }}>
                    Y-Plan: check mid-position valve travel — poor calibration can cause simultaneous CH+DHW demand contention.
                  </p>
                )}
              </div>

              {/* Heat loss input */}
              <div className="form-field">
                <label style={{ fontWeight: 600, fontSize: '0.88rem', color: '#4a5568' }}>
                  Design Heat Loss (kW)
                </label>
                <input
                  type="number"
                  min={1}
                  max={40}
                  step={0.5}
                  value={input.heatLossWatts / 1000}
                  onChange={e => setInput({ ...input, heatLossWatts: +e.target.value * 1000 })}
                  style={{ marginTop: '0.4rem' }}
                />
              </div>

              {/* ΔT reference (engine authority — locked display) */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1, padding: '0.5rem 0.75rem', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: '#a0aec0' }}>Boiler ΔT</div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>20°C</div>
                </div>
                <div style={{ flex: 1, padding: '0.5rem 0.75rem', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: '#a0aec0' }}>ASHP ΔT</div>
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

              {/* Flow vs heat loss chart */}
              <div>
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
              <input
                type="number"
                min={1}
                max={60}
                step={0.5}
                value={input.currentBoilerOutputKw ?? ''}
                onChange={e => setInput({ ...input, currentBoilerOutputKw: e.target.value ? +e.target.value : undefined })}
                placeholder="e.g. 24"
              />
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
          <p className="description">
            A combi boiler delivers one outlet at a time. Two simultaneous draws, two bathrooms,
            or continuous-occupancy patterns all break that constraint. Adjust the controls —
            the panel shows exactly where your household sits on that physics boundary.
          </p>

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

              {/* Household size — 3 granular tiers */}
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: '0.4rem', color: '#4a5568' }}>
                  Household size
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setInput({ ...input, highOccupancy: false, occupancyCount: 2 })}
                    style={{
                      flex: 1, padding: '0.5rem',
                      border: `2px solid ${!input.highOccupancy && (input.occupancyCount ?? 2) <= 2 ? '#3182ce' : '#e2e8f0'}`,
                      borderRadius: '6px',
                      background: !input.highOccupancy && (input.occupancyCount ?? 2) <= 2 ? '#ebf8ff' : '#fff',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: !input.highOccupancy && (input.occupancyCount ?? 2) <= 2 ? 700 : 400,
                    }}
                  >
                    1–2 people
                  </button>
                  <button
                    onClick={() => setInput({ ...input, highOccupancy: false, occupancyCount: 3 })}
                    style={{
                      flex: 1, padding: '0.5rem',
                      border: `2px solid ${!input.highOccupancy && input.occupancyCount === 3 ? '#d69e2e' : '#e2e8f0'}`,
                      borderRadius: '6px',
                      background: !input.highOccupancy && input.occupancyCount === 3 ? '#fefcbf' : '#fff',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: !input.highOccupancy && input.occupancyCount === 3 ? 700 : 400,
                    }}
                  >
                    3 people ⚠️
                  </button>
                  <button
                    onClick={() => setInput({ ...input, highOccupancy: true, occupancyCount: 4 })}
                    style={{
                      flex: 1, padding: '0.5rem',
                      border: `2px solid ${input.highOccupancy ? '#c53030' : '#e2e8f0'}`,
                      borderRadius: '6px',
                      background: input.highOccupancy ? '#fff5f5' : '#fff',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: input.highOccupancy ? 700 : 400,
                    }}
                  >
                    4+ people
                  </button>
                </div>
                {!input.highOccupancy && input.occupancyCount === 3 && (
                  <p style={{ fontSize: '0.75rem', color: '#975a16', marginTop: '0.3rem', lineHeight: 1.4 }}>
                    ⚠️ 3 people is a borderline case — a combi boiler may struggle during simultaneous draws. Consider a stored system.
                  </p>
                )}
              </div>
            </div>

            {/* Right: live response panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

              {/* DHW demand level badge */}
              <div style={{
                padding: '0.875rem 1rem',
                background: '#f7fafc',
                border: `2px solid ${dhwBand.colour}`,
                borderRadius: '8px',
                display: 'flex', flexDirection: 'column', gap: '0.3rem',
              }}>
                <div style={{ fontSize: '0.75rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  DHW demand level
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: dhwBand.colour, lineHeight: 1 }}>
                  {dhwBand.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#718096' }}>
                  {input.bathroomCount} bathroom{input.bathroomCount !== 1 ? 's' : ''} · {input.peakConcurrentOutlets ?? 1} peak outlet{(input.peakConcurrentOutlets ?? 1) !== 1 ? 's' : ''} · {input.highOccupancy ? '4+ people' : input.occupancyCount === 3 ? '3 people (borderline)' : '1–2 people'}
                </div>
              </div>

              {/* Combi overall verdict */}
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

              {/* Reason chips */}
              {combiDhwLive.flags.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {combiDhwLive.flags.map(flag => (
                    <div
                      key={flag.id}
                      style={{
                        padding: '0.5rem 0.75rem',
                        background: flag.severity === 'fail' ? '#fff5f5' : '#fffff0',
                        border: `1px solid ${flag.severity === 'fail' ? '#feb2b2' : '#faf089'}`,
                        borderLeft: `4px solid ${flag.severity === 'fail' ? '#c53030' : '#d69e2e'}`,
                        borderRadius: '4px',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: flag.severity === 'fail' ? '#c53030' : '#b7791f', marginBottom: '0.2rem' }}>
                        {flag.title}
                      </div>
                      <div style={{ color: '#4a5568', lineHeight: 1.4 }}>{flag.detail}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Outlet demand vs combi capacity bars */}
              <div style={{ padding: '0.75rem', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.78rem', color: '#718096', marginBottom: '0.5rem' }}>
                  Outlets in use vs. combi on-demand capacity
                </div>
                {/* Combi limit bar (always 1) */}
                <div style={{ marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#a0aec0', marginBottom: '0.2rem' }}>Combi limit — 1 outlet</div>
                  <div style={{ background: '#e2e8f0', borderRadius: '4px', height: '10px' }}>
                    <div style={{ width: '33%', background: '#38a169', height: '100%', borderRadius: '4px' }} />
                  </div>
                </div>
                {/* Peak demand bar */}
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#a0aec0', marginBottom: '0.2rem' }}>
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
            </div>
          </div>

          <div className="step-actions">
            <button className="prev-btn" onClick={prev}>← Back</button>
            <button className="next-btn" onClick={next}>Next →</button>
          </div>
        </div>
      )}

      {currentStep === 'commercial' && (
        <div className="step-card">
          <h2>💼 Step 6: Commercial Strategy Selection</h2>
          <p className="description">
            Choose your installation strategy. A low flow temp design achieves 35–40°C,
            delivering SPF 3.8–4.4. A high temp retrofit retains existing radiators
            at 50–55°C (SPF 2.9–3.1). Adding a Mixergy Hot Water Battery delivers a
            21% gas saving via active stratification.
          </p>
          <div className="form-grid">
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>🏗️ Installation Policy</label>
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
                  <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>✅ Low flow temp design (35–40°C)</div>
                  <div style={{ fontSize: '0.82rem', color: '#4a5568' }}>
                    New oversized Type 22 radiators · Design flow 35–40°C · SPF 3.8–4.4
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
                  <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>⚡ High temp retrofit (50–55°C)</div>
                  <div style={{ fontSize: '0.82rem', color: '#4a5568' }}>
                    Existing radiators retained · Design flow 50–55°C · SPF 2.9–3.1
                  </div>
                </button>
              </div>
            </div>
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>💧 Hot Water Storage</label>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
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
                    Conventional stored hot water system
                  </div>
                </button>
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
                    +21% gas saving · Active stratification · Top-down heating
                  </div>
                </button>
              </div>
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

          {/* ─── Energy provider placeholder ─────────────────────────────── */}
          <details style={{ marginTop: '1.25rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#4a5568' }}>
              ⚡ Energy Consumption (optional)
            </summary>
            <div style={{ marginTop: '0.75rem', padding: '0.875rem', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <button
                  disabled
                  style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e0', background: '#edf2f7', color: '#a0aec0', cursor: 'not-allowed', fontSize: '0.85rem' }}
                >
                  🔌 Connect Provider (coming soon)
                </button>
                <span style={{ fontSize: '0.78rem', color: '#a0aec0' }}>
                  Source: Manual (placeholder for provider sync)
                </span>
              </div>
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
            <p className="description">
              Each cell shows how your building's physics gates each system option.
              Click any cell to jump back to the step that controls it.
              Green across a column = viable candidate for full analysis.
            </p>

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
                        <div style={{ fontSize: '0.7rem', color: '#a0aec0', fontWeight: 400 }}>
                          → {row.step.replace(/_/g, ' ')}
                        </div>
                      </td>
                      {OVERLAY_SYSTEMS.map(sys => {
                        const risk = cellMap[sys.id][row.id];
                        return (
                          <td key={sys.id} style={{ padding: '0.35rem 0.5rem', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
                            <button
                              onClick={() => setCurrentStep(row.step)}
                              title={`Jump to ${row.step.replace(/_/g, ' ')} step`}
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
                          <span style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.5rem',
                            background: CELL_BG[overall],
                            border: `1px solid ${CELL_BORDER[overall]}`,
                            borderRadius: '4px',
                            fontSize: '0.9rem',
                            fontWeight: 700,
                          }}>
                            {CELL_ICON[overall]}
                          </span>
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
              <span style={{ marginLeft: 'auto', color: '#a0aec0' }}>
                Click any cell to jump to the controlling step
              </span>
            </div>

            <div className="step-actions">
              <button className="prev-btn" onClick={prev}>← Back</button>
              <button className="next-btn" onClick={next}>Run Full Analysis →</button>
            </div>
          </div>
        );
      })()}

      {currentStep === 'results' && results && (
        <FullSurveyResults
          results={results}
          input={input}
          validationWarnings={inputWarnings}
          compareMixergy={compareMixergy}
          onBack={onBack}
        />
      )}
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

  return (
    <div className="step-card">
      <h2>🏠 Step 4: Lifestyle &amp; Thermal Comfort</h2>
      <p className="description">
        Your occupancy pattern determines which heating technology wins.
        The exponential decay formula shows the predicted room temperature drop during
        your absence. A drop of more than 4°C in 8 hours triggers fabric improvement recommendations.
      </p>

      <div className="form-grid">
        <div className="form-field">
          <label>Occupancy Signature</label>
          <select
            value={input.occupancySignature}
            onChange={e => setInput({ ...input, occupancySignature: e.target.value as EngineInputV2_3['occupancySignature'] })}
          >
            <option value="professional">Professional (away 08:00–17:00)</option>
            <option value="steady_home">Steady Home (retired / family, continuous)</option>
            <option value="shift_worker">Shift Worker (irregular, offset peaks)</option>
          </select>
        </div>
      </div>

      {/* Thermal Comfort Physics */}
      <div style={{ marginTop: '1.25rem' }}>
        <h4 style={{ marginBottom: '0.5rem', fontSize: '0.95rem', color: '#4a5568' }}>
          🌡️ Comfort Physics – Predicted Temperature Decay
        </h4>
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

      {/* ─── Hive / thermal telemetry placeholder ──────────────────────── */}
      <details style={{ marginTop: '1.25rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#4a5568' }}>
          🌡️ Thermal Telemetry (optional)
        </summary>
        <div style={{ marginTop: '0.75rem', padding: '0.875rem', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <button
              disabled
              style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e0', background: '#edf2f7', color: '#a0aec0', cursor: 'not-allowed', fontSize: '0.85rem' }}
            >
              🔗 Connect Hive (coming soon)
            </button>
            <span style={{ fontSize: '0.78rem', color: '#a0aec0' }}>
              Cooling data not connected
            </span>
          </div>
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
              <option value="none">Unknown — awaiting telemetry</option>
              <option value="low">Low — house cools quickly</option>
              <option value="high">High — house retains heat well</option>
            </select>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#a0aec0', marginTop: '0.5rem' }}>
            This proxy will be replaced by Hive cooling-tau data when connected.
          </p>
        </div>
      </details>

      <div className="step-actions">
        <button className="prev-btn" onClick={onPrev}>← Back</button>
        <button className="next-btn" onClick={onNext}>Next →</button>
      </div>
    </div>
  );
}

const ELIGIBILITY_ICONS: Record<string, string> = { on_demand: '🔥', stored_vented: '🫙', stored_unvented: '💧', ashp: '🌿' };

// ── Evidence badge colour helpers ─────────────────────────────────────────────
const BADGE_ALPHA = '22';

function confidenceColour(confidence: string): string {
  if (confidence === 'high') return '#38a169';
  if (confidence === 'medium') return '#d69e2e';
  return '#e53e3e';
}

function sourceColour(source: string): string {
  if (source === 'manual') return '#3182ce';
  if (source === 'derived') return '#805ad5';
  if (source === 'assumed') return '#d69e2e';
  return '#a0aec0';
}

function sensitivityColour(effect: string): string {
  return effect === 'upgrade' ? '#38a169' : '#e53e3e';
}

// ─── SystemTransitionCard ─────────────────────────────────────────────────────
// Renders a current → proposed system architecture summary.
// No pricing, no SKUs — architecture shift only.

function SystemTransitionCard({
  input,
  results,
}: {
  input: FullSurveyModelV1;
  results: FullEngineResult;
}) {
  const { hydraulic, engineOutput } = results;

  // Derive current system description from survey inputs
  const currentHeatLabel: Record<string, string> = {
    combi: 'Combi boiler',
    system: 'System boiler',
    regular: 'Regular boiler',
    ashp: 'Air Source Heat Pump',
    other: 'Existing heat source',
  };
  const currentHeat = currentHeatLabel[input.currentHeatSourceType ?? ''] ?? 'Existing heating system';

  const currentDhw =
    input.currentHeatSourceType === 'combi'
      ? 'On-demand hot water (no cylinder)'
      : input.currentHeatSourceType === 'regular'
      ? 'Open-vented hot water cylinder'
      : 'Stored hot water cylinder';

  const currentCircuit =
    input.currentHeatSourceType === 'regular'
      ? 'Open-vented, gravity-fed heating'
      : input.currentHeatSourceType === 'combi' || input.currentHeatSourceType === 'system'
      ? 'Sealed, pressurised heating circuit'
      : 'Heating circuit';

  const currentPipe = `${input.primaryPipeDiameter}mm primary pipework`;
  const currentPressure = `${(input.dynamicMainsPressureBar ?? input.dynamicMainsPressure).toFixed(1)} bar dynamic mains pressure`;

  // Derive proposed system from top viable option
  const topOption = engineOutput.options?.find(o => o.status === 'viable') ?? engineOutput.options?.[0];

  const proposedHeadlines: Record<string, { heat: string; dhw: string; circuit: string }> = {
    combi: {
      heat: 'Combi boiler',
      dhw: 'On-demand hot water (no cylinder)',
      circuit: 'Sealed, pressurised heating circuit',
    },
    stored_vented: {
      heat: 'Regular or system boiler',
      dhw: 'Stored hot water — vented cylinder (gravity-fed)',
      circuit: 'Open-vented or sealed heating circuit',
    },
    stored_unvented: {
      heat: 'System boiler',
      dhw: 'Stored hot water — unvented cylinder (mains pressure)',
      circuit: 'Sealed, pressurised heating circuit',
    },
    system_unvented: {
      heat: 'System boiler',
      dhw: 'Unvented cylinder (stored hot water)',
      circuit: 'Sealed, pressurised heating circuit',
    },
    ashp: {
      heat: 'Air Source Heat Pump',
      dhw: 'Unvented cylinder (heat pump compatible)',
      circuit: 'Low-temperature sealed heating circuit',
    },
    regular_vented: {
      heat: 'Regular boiler',
      dhw: 'Open-vented hot water cylinder',
      circuit: 'Open-vented, gravity-fed heating',
    },
  };

  const proposed = topOption ? (proposedHeadlines[topOption.id] ?? null) : null;
  const proposedPipe =
    hydraulic.isBottleneck || hydraulic.ashpRequires28mm
      ? '28mm primary pipework (upgrade required)'
      : `${input.primaryPipeDiameter}mm primary pipework (no change)`;
  const proposedPressure = `${(input.dynamicMainsPressureBar ?? input.dynamicMainsPressure).toFixed(1)} bar dynamic mains pressure`;

  const needsLoftWork =
    input.currentHeatSourceType === 'regular' &&
    topOption?.id !== 'regular_vented';

  return (
    <div className="result-section">
      <h3>🔄 System Transition</h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        gap: '1rem',
        alignItems: 'start',
      }}>
        {/* Current system */}
        <div style={{
          padding: '1rem',
          background: '#fff5f5',
          border: '1px solid #fed7d7',
          borderRadius: '8px',
        }}>
          <div style={{ fontWeight: 700, color: '#c53030', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
            🏠 Current System
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 1.25rem', fontSize: '0.85rem', lineHeight: 1.7, color: '#4a5568' }}>
            <li>{currentHeat}</li>
            <li>{currentDhw}</li>
            <li>{currentCircuit}</li>
            <li>{currentPipe}</li>
            <li>{currentPressure}</li>
            {input.currentHeatSourceType === 'regular' && (
              <li>Feed &amp; expansion tank in loft</li>
            )}
          </ul>
        </div>

        {/* Arrow divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          color: '#718096',
          paddingTop: '2rem',
        }}>
          ⬇
        </div>

        {/* Proposed system */}
        <div style={{
          padding: '1rem',
          background: '#f0fff4',
          border: '1px solid #9ae6b4',
          borderRadius: '8px',
        }}>
          <div style={{ fontWeight: 700, color: '#276749', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
            🚀 Proposed System
            {topOption && (
              <span style={{
                marginLeft: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '1px 7px',
                borderRadius: '10px',
                background: topOption.status === 'viable' ? '#c6f6d5' : '#fefcbf',
                color: topOption.status === 'viable' ? '#276749' : '#744210',
              }}>{topOption.label}</span>
            )}
          </div>
          {proposed ? (
            <ul style={{ margin: 0, padding: '0 0 0 1.25rem', fontSize: '0.85rem', lineHeight: 1.7, color: '#4a5568' }}>
              <li>{proposed.heat}</li>
              <li>{proposed.dhw}</li>
              <li>{proposed.circuit}</li>
              <li>{proposedPipe}</li>
              <li>{proposedPressure}</li>
              {needsLoftWork && (
                <li>Loft feed &amp; expansion tank removed</li>
              )}
            </ul>
          ) : (
            <p style={{ fontSize: '0.85rem', color: '#718096', margin: 0 }}>
              Complete the survey to see your proposed system.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── EngineeringRequirementsCard ──────────────────────────────────────────────
// Renders a bullet list of engineering changes required for the transition.
// Derived from hydraulicV1, pressureAnalysis, storedDhwV1, and combiDhwV1 flags.

function EngineeringRequirementsCard({
  input,
  results,
}: {
  input: FullSurveyModelV1;
  results: FullEngineResult;
}) {
  const { hydraulic, pressureAnalysis, storedDhwV1, combiDhwV1 } = results;

  const items: string[] = [];

  // Pipe upgrade
  if (hydraulic.isBottleneck || hydraulic.ashpRequires28mm) {
    items.push('Upgrade primary pipework from 22mm → 28mm');
  }

  // Sealed system conversion — only required when moving away from an open-vented regular system
  if (input.currentHeatSourceType === 'regular') {
    items.push('Convert to sealed, pressurised heating circuit');
  }

  // Magnetic filter — only if not already installed
  if (!input.hasMagneticFilter) {
    items.push('Install inline magnetic filter (BS 7593 compliance)');
  }

  // Stored DHW flags
  for (const flag of storedDhwV1.flags) {
    if (flag.id === 'stored-space-tight') {
      items.push('Confirm cylinder/airing-cupboard space — space is tight');
    }
    if (flag.id === 'stored-high-demand') {
      items.push('Upsize cylinder to meet high hot-water demand');
    }
  }

  // Combi DHW flags
  for (const flag of combiDhwV1.flags) {
    if (flag.id === 'combi-pressure-lockout') {
      items.push('Mains pressure boost or stored alternative — combi pressure lockout risk');
    }
    if (flag.id === 'combi-simultaneous-demand') {
      items.push('Manage simultaneous DHW demand — combi cannot serve multiple outlets');
    }
  }

  // Pressure diagnostic notes
  if (pressureAnalysis.inconsistentReading) {
    items.push('Recheck mains pressure readings — dynamic exceeds static (inconsistent)');
  } else if (pressureAnalysis.dropBar !== undefined && pressureAnalysis.dropBar >= 1.0) {
    items.push('Investigate mains supply restriction — large pressure drop detected');
  }

  // Controls upgrade — always recommended for any system change (MCS / BS 7593 best practice)
  items.push('Upgrade heating controls (zoning, TRVs, smart thermostat)');

  return (
    <div className="result-section">
      <h3>🛠 Engineering Changes Required</h3>
      <ul style={{ margin: 0, padding: '0 0 0 1.25rem', lineHeight: 1.8, color: '#2d3748' }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: '0.9rem' }}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function FullSurveyResults({
  results,
  input,
  validationWarnings,
  compareMixergy,
  onBack,
}: {
  results: FullEngineResult;
  input: FullSurveyModelV1;
  validationWarnings: InputValidationWarning[];
  compareMixergy: boolean;
  onBack: () => void;
}) {
  const { hydraulic, combiStress, mixergy, lifestyle, normalizer } = results;
  const regime = results.heatPumpRegime;
  const [engineOutput, setEngineOutput] = useState(results.engineOutput);
  const [showTwin, setShowTwin] = useState(false);
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null);
  const [activeOptionTab, setActiveOptionTab] = useState<Record<string, 'heat' | 'dhw' | 'needs' | 'why'>>({});
  const [visualFilter, setVisualFilter] = useState<'all' | 'relevant'>('all');
  const [compareAId, setCompareAId] = useState<string>('current');
  const [compareBId, setCompareBId] = useState<string>(
    results.engineOutput.recommendation.primary.toLowerCase().includes('heat pump') ? 'ashp'
    : results.engineOutput.recommendation.primary.toLowerCase().includes('unvented') ? 'stored_unvented'
    : results.engineOutput.recommendation.primary.toLowerCase().includes('vented') ? 'stored_vented'
    : 'on_demand',
  );
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [hoveredTimelineIndex, setHoveredTimelineIndex] = useState<number | undefined>(undefined);
  const debugEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('debug') === '1';
  }, []);

  // UI-level ASHP COP override: treat COP ≤ 3.0 as "Borderline/Caution" regardless of engine verdict.
  const ashpCopStatus = useMemo<'pass' | 'caution'>(() => {
    if (regime.designCopEstimate <= 3.0) return 'caution';
    return 'pass';
  }, [regime.designCopEstimate]);

  // Timeline visual is always derived from engine output — single source of truth.
  // A/B changes rerun the engine with engineConfig.timelinePair; timeline visual is rendered from the new engineOutput.
  const timelineVisual = engineOutput.visuals?.find((v: VisualSpecV1) => v.type === 'timeline_24h');
  const timelinePayload: Timeline24hV1 | undefined = timelineVisual?.type === 'timeline_24h' ? timelineVisual.data as Timeline24hV1 : undefined;
  const hoveredTimeLabel =
    timelinePayload && hoveredTimelineIndex !== undefined
      ? timelinePayload.timeMinutes?.[hoveredTimelineIndex]
      : undefined;

  /** Rerun the engine with the given A/B pair and update engineOutput (single source of truth). */
  const updateTimelinePair = (newA: string, newB: string) => {
    if (newA === compareAId && newB === compareBId) return;
    setIsRecomputing(true);
    startTransition(() => {
      const engineInput = toEngineInput(sanitiseModelForEngine(input));
      engineInput.engineConfig = { timelinePair: [newA, newB] };
      const out = runEngine(engineInput);
      setEngineOutput(out.engineOutput);
      setIsRecomputing(false);
    });
  };

  // Derive current efficiency from surveyed SEDBUK nominal (or 92% fallback) minus decay.
  // resolveNominalEfficiencyPct is the single fallback + clamp point; post-decay
  // result is also clamped via computeCurrentEfficiencyPct.
  const nominalEfficiencyPct = resolveNominalEfficiencyPct(input.currentBoilerSedbukPct);
  const currentEfficiencyPct = computeCurrentEfficiencyPct(nominalEfficiencyPct, normalizer.tenYearEfficiencyDecayPct);
  const shouldShowMixergy = input.dhwTankType === 'mixergy' || compareMixergy;

  if (showTwin) {
    return (
      <InteractiveTwin
        mixergy={mixergy}
        currentEfficiencyPct={currentEfficiencyPct}
        nominalEfficiencyPct={nominalEfficiencyPct}
        hydraulic={results.hydraulicV1}
        systemAType={compareAId}
        systemBType={compareBId}
        onBack={() => setShowTwin(false)}
      />
    );
  }

  return (
    <div className="results-container">

      <ModellingNotice />

      {/* Your Situation – Context Summary */}
      {engineOutput.contextSummary && engineOutput.contextSummary.bullets.length > 0 && (
        <div className="result-section">
          <h3>🏠 Your Situation</h3>
          {validationWarnings.length > 0 && (
            <div style={{ marginBottom: '0.6rem', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #fbd38d', background: '#fffaf0', color: '#744210', fontSize: '0.8rem' }}>
              Confidence: <strong>low</strong> — one or more readings look implausible and were capped/ignored for decisioning.
            </div>
          )}
          <ul className="context-summary-list">
            {engineOutput.contextSummary.bullets.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        </div>
      )}

      {/* System Transition – Current → Proposed Architecture */}
      <SystemTransitionCard input={input} results={results} />

      {/* 24-Hour Compare Timeline — A/B selector + main timeline visual */}
      {(() => {
        if (!timelineVisual) return null;
        const COMPARE_SYSTEMS = [
          { id: 'current',          label: 'Current' },
          { id: 'on_demand',        label: 'Combi'   },
          { id: 'stored_vented',    label: 'Stored — Vented' },
          { id: 'stored_unvented',  label: 'Stored — Unvented' },
          { id: 'ashp',             label: 'ASHP' },
        ] as const;
        const btnStyle = (active: boolean): React.CSSProperties => ({
          padding: '4px 12px',
          borderRadius: '14px',
          border: '1px solid #cbd5e0',
          background: active ? '#3182ce' : '#fff',
          color: active ? '#fff' : '#4a5568',
          cursor: 'pointer',
          fontWeight: active ? 700 : 400,
          fontSize: '0.8rem',
        });
        return (
          <div className="result-section">
            <h3>📈 24-Hour Comparative Timeline</h3>
            <p style={{ fontSize: '0.82rem', color: '#718096', marginBottom: '0.75rem' }}>
              Compare how two heating systems behave across a typical day — heat demand, delivery, efficiency and hot water events.
            </p>
            {/* A/B tile selectors */}
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#3182ce', marginBottom: '0.35rem' }}>
                  System A (blue)
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {COMPARE_SYSTEMS.map(s => (
                    <button key={s.id} style={btnStyle(compareAId === s.id)} onClick={() => { setCompareAId(s.id); updateTimelinePair(s.id, compareBId); }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e53e3e', marginBottom: '0.35rem' }}>
                  System B (red)
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {COMPARE_SYSTEMS.map(s => (
                    <button key={s.id} style={btnStyle(compareBId === s.id)} onClick={() => { setCompareBId(s.id); updateTimelinePair(compareAId, s.id); }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {isRecomputing && (
              <div style={{ fontSize: '0.78rem', color: '#718096', marginBottom: '0.5rem', fontStyle: 'italic' }}>
                Recomputing…
              </div>
            )}
            <VisualCard
              spec={timelineVisual}
              compareAId={compareAId}
              compareBId={compareBId}
              onTimelineHoverIndexChange={setHoveredTimelineIndex}
            />
            {debugEnabled && timelinePayload?.series && (
              <div style={{ marginTop: '0.875rem', padding: '0.625rem 0.75rem', borderRadius: '6px', background: '#1a202c', color: '#e2e8f0', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.75rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Debug (physics inputs)</div>
                <div>erpClass: {input.currentBoilerErpClass ?? 'none'}</div>
                <div>nominalEfficiencyPct (UI, from sedbukPct/ErP): {nominalEfficiencyPct.toFixed(1)}</div>
                <div>boilerModel.baselineSeasonalEta: {results.boilerEfficiencyModelV1?.baselineSeasonalEta != null ? (results.boilerEfficiencyModelV1.baselineSeasonalEta * 100).toFixed(1) : 'n/a (no boiler spec)'}</div>
                <div>boilerModel.inHomeAdjustedEta: {results.boilerEfficiencyModelV1?.inHomeAdjustedEta != null ? (results.boilerEfficiencyModelV1.inHomeAdjustedEta * 100).toFixed(1) : 'n/a'}</div>
                <div>tenYearEfficiencyDecayPct: {normalizer.tenYearEfficiencyDecayPct.toFixed(1)}</div>
                <div>currentEfficiencyPct: {currentEfficiencyPct.toFixed(1)}% (ErP {deriveErpClass(currentEfficiencyPct) ?? 'n/a'})</div>
                <div>hoveredTime: {hoveredTimeLabel !== undefined ? `${Math.floor(hoveredTimeLabel / 60).toString().padStart(2, '0')}:${(hoveredTimeLabel % 60).toString().padStart(2, '0')}` : 'none'}</div>
                {timelinePayload.series.map((s: { id: string; efficiency: number[]; performanceKind?: 'eta' | 'cop' }) => {
                  const etaValue = hoveredTimelineIndex !== undefined ? s.efficiency[hoveredTimelineIndex] : undefined;
                  const metric = s.performanceKind === 'cop' ? 'COP' : 'η';
                  return (
                    <div key={s.id}>
                      {s.id}_{metric}: {etaValue !== undefined ? etaValue.toFixed(3) : 'n/a'}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Your Options – Option Matrix V1 */}
      {engineOutput.options && engineOutput.options.length > 0 && (
        <div className="result-section">
          <h3>🔍 Your Options</h3>
          <div className="options-grid">
            {engineOutput.options.map(card => {
              const statusClass = card.status === 'rejected' ? 'rejected' : card.status === 'caution' ? 'caution' : 'viable';
              const statusLabel = card.status === 'rejected' ? '❌ Not suitable' : card.status === 'caution' ? '⚠️ Possible' : '✅ Suitable';
              const isExpanded = expandedOptionId === card.id;
              return (
                <div key={card.id} className={`option-card option-card--${statusClass}`}>
                  <div
                    className="option-card__header"
                    onClick={() => setExpandedOptionId(isExpanded ? null : card.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="option-card__title">
                      <span className="option-card__label">{card.label}</span>
                      <span className={`option-card__status option-card__status--${statusClass}`}>{statusLabel}</span>
                    </div>
                    <p className="option-card__headline">{card.headline}</p>
                    <span className="option-card__toggle">{isExpanded ? '▲ Less' : '▼ Details'}</span>
                  </div>
                  {isExpanded && (
                    <div className="option-card__body">
                      {/* Four-section tabs: Heat / Hot Water / What needs changing / Why change? */}
                      {card.heat && card.dhw && card.engineering && card.typedRequirements && (() => {
                        const tab = activeOptionTab[card.id] ?? 'heat';
                        const setTab = (t: 'heat' | 'dhw' | 'needs' | 'why') =>
                          setActiveOptionTab(prev => ({ ...prev, [card.id]: t }));
                        return (
                          <div className="option-card__tabs">
                            <div className="option-card__tab-bar">
                              <button
                                className={`option-card__tab-btn${tab === 'heat' ? ' option-card__tab-btn--active' : ''}`}
                                onClick={() => setTab('heat')}
                              >🔥 Heat</button>
                              <button
                                className={`option-card__tab-btn${tab === 'dhw' ? ' option-card__tab-btn--active' : ''}`}
                                onClick={() => setTab('dhw')}
                              >🚿 Hot Water</button>
                              <button
                                className={`option-card__tab-btn${tab === 'needs' ? ' option-card__tab-btn--active' : ''}`}
                                onClick={() => setTab('needs')}
                              >🔧 What needs changing</button>
                              {card.sensitivities && card.sensitivities.length > 0 && (
                                <button
                                  className={`option-card__tab-btn${tab === 'why' ? ' option-card__tab-btn--active' : ''}`}
                                  onClick={() => setTab('why')}
                                >🔀 What would change this?</button>
                              )}
                            </div>
                            {tab === 'heat' && (
                              <div className="option-card__tab-panel">
                                <p className="option-card__tab-headline">{card.heat.headline}</p>
                                <ul>{card.heat.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
                              </div>
                            )}
                            {tab === 'dhw' && (
                              <div className="option-card__tab-panel">
                                <p className="option-card__tab-headline">{card.dhw.headline}</p>
                                <ul>{card.dhw.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
                              </div>
                            )}
                            {tab === 'needs' && (
                              <div className="option-card__tab-panel">
                                {card.typedRequirements.mustHave.length > 0 && (
                                  <div className="option-card__req-group">
                                    <strong>Must have:</strong>
                                    <ul>{card.typedRequirements.mustHave.map((r, i) => <li key={i}>{r}</li>)}</ul>
                                  </div>
                                )}
                                {card.typedRequirements.likelyUpgrades.length > 0 && (
                                  <div className="option-card__req-group">
                                    <strong>Likely upgrades:</strong>
                                    <ul>{card.typedRequirements.likelyUpgrades.map((r, i) => <li key={i}>{r}</li>)}</ul>
                                  </div>
                                )}
                                {card.typedRequirements.niceToHave.length > 0 && (
                                  <div className="option-card__req-group">
                                    <strong>Nice to have:</strong>
                                    <ul>{card.typedRequirements.niceToHave.map((r, i) => <li key={i}>{r}</li>)}</ul>
                                  </div>
                                )}
                              </div>
                            )}
                            {tab === 'why' && card.sensitivities && (
                              <div className="option-card__tab-panel">
                                <p style={{ fontSize: '0.82rem', color: '#718096', marginBottom: '0.75rem' }}>
                                  These are the inputs that sit closest to a boundary. Changing them would shift this option&apos;s verdict.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  {card.sensitivities.map((s, i) => {
                                    const sColour = sensitivityColour(s.effect);
                                    const upgradeIcon = s.effect === 'upgrade' ? '\u2B06\uFE0F' : '\u2B07\uFE0F';
                                    return (
                                      <div key={i} style={{
                                        padding: '0.625rem 0.875rem',
                                        background: s.effect === 'upgrade' ? '#f0fff4' : '#fff5f5',
                                        border: `1px solid ${s.effect === 'upgrade' ? '#9ae6b4' : '#fed7d7'}`,
                                        borderRadius: '6px',
                                        fontSize: '0.83rem',
                                      }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                          <span>{upgradeIcon}</span>
                                          <strong style={{ color: sColour }}>{s.lever}</strong>
                                          <span style={{
                                            fontSize: '0.72rem',
                                            padding: '1px 6px',
                                            borderRadius: '8px',
                                            background: sColour + BADGE_ALPHA,
                                            color: sColour,
                                            fontWeight: 600,
                                          }}>{s.effect}</span>
                                        </div>
                                        <div style={{ color: '#4a5568', lineHeight: 1.4 }}>{s.note}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Engineering Requirements */}
      <EngineeringRequirementsCard input={input} results={results} />

      {/* Engine-driven visuals — rendered by type switch, no business logic */}
      {engineOutput.visuals && engineOutput.visuals.length > 0 && (
        <div className="result-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>📊 Physics Instruments</h3>
            {expandedOptionId && (
              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem' }}>
                <button
                  onClick={() => setVisualFilter('all')}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e0',
                    background: visualFilter === 'all' ? '#3182ce' : '#fff',
                    color: visualFilter === 'all' ? '#fff' : '#4a5568',
                    cursor: 'pointer',
                    fontWeight: visualFilter === 'all' ? 700 : 400,
                  }}
                >All</button>
                <button
                  onClick={() => setVisualFilter('relevant')}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e0',
                    background: visualFilter === 'relevant' ? '#3182ce' : '#fff',
                    color: visualFilter === 'relevant' ? '#fff' : '#4a5568',
                    cursor: 'pointer',
                    fontWeight: visualFilter === 'relevant' ? 700 : 400,
                  }}
                >Relevant to selected</button>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
            {engineOutput.visuals
              .filter(visual => {
                // timeline_24h is rendered separately at the top
                if (visual.type === 'timeline_24h') return false;
                if (visualFilter === 'all' || !expandedOptionId) return true;
                if (!visual.affectsOptionIds) return true;
                return visual.affectsOptionIds.includes(expandedOptionId);
              })
              .map(visual => (
                <VisualCard key={visual.id} spec={visual} />
              ))}
          </div>
        </div>
      )}

      {/* Evidence & Confidence */}
      {engineOutput.evidence && engineOutput.evidence.length > 0 && (
        <div className="result-section">
          <h3>🔬 Evidence &amp; Confidence</h3>
          <p style={{ fontSize: '0.82rem', color: '#718096', marginBottom: '0.75rem' }}>
            What the engine knows, how it knows it, and how confident it is.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Input</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Value</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Source</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Confidence</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Affects</th>
                </tr>
              </thead>
              <tbody>
                {engineOutput.evidence.map(item => {
                  const cColour = confidenceColour(item.confidence);
                  const sColour = sourceColour(item.source);
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 10px', fontWeight: 600, color: '#2d3748' }}>{item.label}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{item.value}</td>
                      <td style={{ padding: '6px 10px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 7px',
                          borderRadius: '10px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: sColour + BADGE_ALPHA,
                          color: sColour,
                        }}>{item.source}</span>
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 7px',
                          borderRadius: '10px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: cColour + BADGE_ALPHA,
                          color: cColour,
                        }}>{item.confidence}</span>
                      </td>
                      <td style={{ padding: '6px 10px', color: '#718096', fontSize: '0.75rem' }}>
                        {item.affectsOptionIds.join(', ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Red Flags */}
      <div className="result-section">
        <h3>🚩 System Eligibility</h3>
        <div className="verdict-grid">
          {engineOutput.eligibility.map(item => {
            const icons = ELIGIBILITY_ICONS;
            const statusClass = item.status === 'rejected' ? 'rejected' : item.status === 'caution' ? 'flagged' : 'approved';
            const statusLabel = item.status === 'rejected' ? '❌ Rejected' : item.status === 'caution' ? '⚠️ Caution' : '✅ Viable';
            return (
              <div key={item.id} className={`verdict-item ${statusClass}`}>
                <div className="verdict-icon">{icons[item.id] ?? '🔧'}</div>
                <div className="verdict-label">{item.label}</div>
                <div className="verdict-status">{statusLabel}</div>
              </div>
            );
          })}
        </div>
        {engineOutput.redFlags.length > 0 && (
          <ul className="red-flag-list" style={{ marginTop: '1rem' }}>
            {engineOutput.redFlags.map(flag => (
              <li key={flag.id} className={flag.severity === 'fail' ? 'reject' : 'flag'}>
                <strong>{flag.title}:</strong> {flag.detail}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ASHP COP Analysis — UI-level COP threshold check */}
      <div className="result-section">
        <h3>🌿 ASHP Design COP Analysis</h3>
        <div className="metric-row">
          <span className="metric-label">Design COP Estimate (+7°C outdoor)</span>
          <span className={`metric-value ${ashpCopStatus === 'caution' ? 'warning' : 'ok'}`}>
            {regime.designCopEstimate.toFixed(2)}
          </span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Cold-Morning COP (−3°C outdoor)</span>
          <span className="metric-value">{regime.coldMorningCopEstimate.toFixed(2)}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Design Flow Temp Band</span>
          <span className="metric-value">{regime.designFlowTempBand}°C</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Seasonal Performance Band</span>
          <span className={`metric-value ${regime.spfBand === 'poor' ? 'warning' : regime.spfBand === 'ok' ? '' : 'ok'}`}>
            {regime.spfBand.toUpperCase()}
          </span>
        </div>
        <div className="metric-row">
          <span className="metric-label">COP Viability</span>
          <span className={`metric-value ${ashpCopStatus === 'caution' ? 'warning' : 'ok'}`}>
            {ASHP_COP_LABEL[ashpCopStatus]}
          </span>
        </div>
        {ashpCopStatus === 'caution' && (
          <p style={{ fontSize: '0.8rem', color: '#744210', marginTop: '0.5rem', background: '#fffaf0', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #fbd38d' }}>
            ⚠️ Borderline COP: at {regime.designCopEstimate.toFixed(2)} this ASHP is on the economic margin. Consider a full-job radiator upgrade to achieve ≤{regime.designFlowTempBand}°C flow temperature and improve COP.
          </p>
        )}
      </div>

      {/* Lifestyle Recommendation */}
      <div className="result-section">
        <h3>👥 Lifestyle Recommendation</h3>
        <div className={`recommendation-banner ${lifestyle.recommendedSystem}`}>
          {engineOutput.recommendation.primary}
        </div>
        <div style={{ marginTop: '1rem' }}>
          <h4 style={{ marginBottom: '0.75rem', fontSize: '0.95rem', color: '#4a5568' }}>
            🎨 Paint Your Day – Interactive Comfort Clock
          </h4>
          <InteractiveComfortClock heatLossKw={results.hydraulic.flowRateLs * 1000 / 100 || 8} />
        </div>
      </div>

      {/* Demand Profile Painter – Three-channel editor + System A vs B comparison */}
      <div className="result-section">
        <h3>🎛️ Demand Profile Painter — System Comparison</h3>
        <p className="description" style={{ marginBottom: '0.75rem' }}>
          Paint three independent demand channels (Heat Intent, DHW, Cold Draw) and watch
          two systems respond in real-time. Graph A shows demand vs plant output (kW);
          Graph B shows efficiency or COP. No scores — pure behaviour comparison.
        </p>
        <DemandProfilePainter baseInput={{
          occupancySignature: lifestyle.signature,
          heatLossWatts: input.heatLossWatts,
          bathroomCount: input.bathroomCount,
        }} />
      </div>

      {/* Lifestyle Interactive – Day Painter Sales Closer */}
      <div className="result-section">
        <h3>🏠 Day Painter – Domestic Thermal Simulator</h3>
        <p className="description" style={{ marginBottom: '0.75rem' }}>
          Paint your 24-hour routine and watch three live curves react: the Boiler "Stepped" sprint,
          the Heat Pump "Horizon" stability line (SPF-driven), and the Mixergy Hot Water Battery
          State of Charge. Toggle <strong>Full Job</strong>, <strong>DHW Supply Path</strong>, and{' '}
          <strong>Softener</strong> to see the physics change in real-time.
        </p>
        <LifestyleInteractive baseInput={{ occupancySignature: lifestyle.signature }} />
      </div>

      {/* Hydraulic Analysis */}
      <div className="result-section">
        <h3>🔧 Hydraulic Analysis</h3>
        <div className="metric-row">
          <span className="metric-label">Flow Rate</span>
          <span className="metric-value">{(hydraulic.flowRateLs * 1000).toFixed(2)} L/min</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Pipe Velocity</span>
          <span className={`metric-value ${hydraulic.velocityMs > 1.5 ? 'warning' : 'ok'}`}>
            {hydraulic.velocityMs.toFixed(2)} m/s
          </span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Hydraulic Bottleneck</span>
          <span className={`metric-value ${hydraulic.isBottleneck ? 'warning' : 'ok'}`}>
            {hydraulic.isBottleneck ? '⚠️ YES – Upgrade to 28mm' : '✅ No'}
          </span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Safety Cut-off Risk</span>
          <span className={`metric-value ${hydraulic.isSafetyCutoffRisk ? 'warning' : 'ok'}`}>
            {hydraulic.isSafetyCutoffRisk ? '🚨 YES – Low pressure' : '✅ No'}
          </span>
        </div>
        {hydraulic.notes.length > 0 && (
          <ul className="notes-list" style={{ marginTop: '0.75rem' }}>
            {hydraulic.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        )}
      </div>

      {/* System Condition Impact — Before vs After Flush + Filter */}
      <div className="result-section">
        <SystemConditionImpact impact={computeConditionImpactMetrics(
          results.sludgeVsScale,
          results.hydraulic.velocityMs,
          nominalEfficiencyPct,
          currentEfficiencyPct,
          input.systemAgeYears ?? 0,
          input.currentHeatSourceType === 'combi' ? {
            maxQtoDhwKw: results.combiDhwV1.maxQtoDhwKw,
            maxQtoDhwKwDerated: results.combiDhwV1.maxQtoDhwKwDerated,
          } : undefined,
        )} />
      </div>

      {/* Combi Efficiency / Scaling — only relevant for combi boilers */}
      {input.currentHeatSourceType === 'combi' && (
      <div className="result-section">
        <h3>📉 Combi Efficiency Analysis — Scaling &amp; Plate Heat Exchanger</h3>
        <div className="metric-row">
          <span className="metric-label">Annual Purge Loss</span>
          <span className="metric-value warning">{combiStress.annualPurgeLossKwh} kWh/yr</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Short-Draw Efficiency</span>
          <span className="metric-value warning">{combiStress.shortDrawEfficiencyPct}%</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Condensing Compromised</span>
          <span className={`metric-value ${combiStress.isCondensingCompromised ? 'warning' : 'ok'}`}>
            {combiStress.isCondensingCompromised ? '⚠️ Yes' : '✅ No'}
          </span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Total Annual Penalty</span>
          <span className="metric-value warning">{combiStress.totalPenaltyKwh.toFixed(0)} kWh/yr</span>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <h4 style={{ marginBottom: '0.75rem', fontSize: '0.95rem', color: '#4a5568' }}>
            Efficiency Decay vs Draw Frequency
          </h4>
          <div className="chart-wrapper">
            <EfficiencyCurve />
          </div>
        </div>
      </div>
      )}

      {/* Water Quality */}
      <div className="result-section">
        <h3>🧪 Geochemical Analysis (Silicate Tax)</h3>
        <div className="metric-row">
          <span className="metric-label">Water Hardness</span>
          <span className={`metric-value ${normalizer.waterHardnessCategory === 'soft' ? 'ok' : 'warning'}`}>
            {normalizer.waterHardnessCategory.replace('_', ' ').toUpperCase()}
          </span>
        </div>
        <div className="metric-row">
          <span className="metric-label">CaCO₃ Level</span>
          <span className="metric-value">{normalizer.cacO3Level} mg/L</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Silica Level</span>
          <span className="metric-value">{normalizer.silicaLevel} mg/L</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Thermal Resistance Factor (Rf)</span>
          <span className="metric-value">{normalizer.scaleRf.toFixed(5)} m²K/W</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">10-Year Efficiency Decay</span>
          <span className={`metric-value ${normalizer.tenYearEfficiencyDecayPct > 8 ? 'warning' : 'ok'}`}>
            {normalizer.tenYearEfficiencyDecayPct.toFixed(1)}%
          </span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Current Boiler Efficiency (post-decay)</span>
          <span className={`metric-value ${currentEfficiencyPct < 80 ? 'warning' : 'ok'}`}>
            {currentEfficiencyPct.toFixed(1)}% — ErP {deriveErpClass(currentEfficiencyPct) ?? 'n/a'}
          </span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Boiler ErP (from entered SEDBUK %)</span>
          <span className="metric-value">{deriveErpClass(nominalEfficiencyPct) ?? 'n/a'}</span>
        </div>
      </div>

      {/* Mixergy Volumetrics */}
      {shouldShowMixergy && (
        <div className="result-section">
          <h3>💧 Mixergy Cylinder Analysis</h3>
          <div className="metric-row">
            <span className="metric-label">Mixergy Size</span>
            <span className="metric-value ok">{mixergy.mixergyLitres}L</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Conventional Equivalent</span>
            <span className="metric-value">{mixergy.equivalentConventionalLitres}L</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Footprint Saving</span>
            <span className="metric-value ok">{mixergy.footprintSavingPct}%</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">COP Multiplier (with ASHP)</span>
            <span className="metric-value ok">+{mixergy.heatPumpCopMultiplierPct}–10%</span>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.95rem', color: '#4a5568' }}>
              Footprint X-Ray: Tank Size Comparison
            </h4>
            <FootprintXRay mixergyLitres={mixergy.mixergyLitres} conventionalLitres={mixergy.equivalentConventionalLitres} />
          </div>
          {mixergy.notes.length > 0 && (
            <ul className="notes-list" style={{ marginTop: '0.75rem' }}>
              {mixergy.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Glass Box – Raw Data / Physics Trace / Visual Outcome */}
      <div className="result-section">
        <h3>🔭 Glass Box – Physics Transparency Panel</h3>
        <p className="description" style={{ marginBottom: '0.75rem' }}>
          Every visual outcome is a deterministic result of the home's hydraulic and
          thermodynamic constraints. Switch tabs to inspect the normalized data, the
          full calculation trace, or the interactive visual outcome.
        </p>
        <GlassBoxPanel results={results} />
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button className="prev-btn" onClick={onBack}>← New Survey</button>
        <button className="next-btn" onClick={() => setShowTwin(true)} style={{ background: '#9f7aea' }}>
          🏠 Open Interactive Twin →
        </button>
      </div>
    </div>
  );
}

// ─── Engine-driven visual renderer ───────────────────────────────────────────
// No business logic — render by type switch only.

function VisualCard({
  spec,
  compareAId,
  compareBId,
  onTimelineHoverIndexChange,
}: {
  spec: VisualSpecV1;
  compareAId?: string;
  compareBId?: string;
  onTimelineHoverIndexChange?: (index: number | undefined) => void;
}) {
  const cardStyle: React.CSSProperties = {
    padding: '0.875rem',
    background: '#f7fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '0.85rem',
  };
  const titleStyle: React.CSSProperties = {
    fontWeight: 700,
    marginBottom: '0.5rem',
    color: '#2d3748',
    fontSize: '0.875rem',
  };

  if (spec.type === 'pressure_drop') {
    const { staticBar, dynamicBar, dropBar, quality } = spec.data as {
      staticBar?: number; dynamicBar: number; dropBar?: number; quality?: string;
    };
    const qualityColour = quality === 'strong' ? '#38a169' : quality === 'moderate' ? '#d69e2e' : '#e53e3e';
    return (
      <div style={cardStyle}>
        <div style={titleStyle}>💧 {spec.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
          {staticBar !== undefined ? (
            <>
              <span style={{ fontWeight: 600 }}>{staticBar.toFixed(1)} bar</span>
              <span style={{ color: '#a0aec0' }}>→</span>
              <span style={{ fontWeight: 600 }}>{dynamicBar.toFixed(1)} bar</span>
            </>
          ) : (
            <span style={{ fontWeight: 600 }}>{dynamicBar.toFixed(1)} bar (dynamic only)</span>
          )}
        </div>
        {dropBar !== undefined && quality && (
          <div style={{ color: qualityColour, fontWeight: 600, fontSize: '0.8rem' }}>
            Drop: {dropBar.toFixed(1)} bar — {quality}
          </div>
        )}
      </div>
    );
  }

  if (spec.type === 'ashp_flow') {
    const { boilerFlowLpm, ashpFlowLpm, multiplier, ashpRisk } = spec.data as {
      boilerFlowLpm: number; ashpFlowLpm: number; multiplier: number; ashpRisk: string;
    };
    const riskColour = ashpRisk === 'pass' ? '#38a169' : ashpRisk === 'warn' ? '#d69e2e' : '#e53e3e';
    // Scale both bars relative to the larger value (ashpFlowLpm) so boiler shows its true proportion.
    const maxFlow = ashpFlowLpm;
    const boilerPct = Math.min(100, (boilerFlowLpm / maxFlow) * 100);
    const ashpPct = 100;
    return (
      <div style={cardStyle}>
        <div style={titleStyle}>🌿 {spec.title}</div>
        <div style={{ marginBottom: '0.25rem', fontSize: '0.8rem', color: '#718096' }}>Boiler</div>
        <div style={{ background: '#4299e1', height: 10, borderRadius: 4, width: `${boilerPct}%`, marginBottom: '0.375rem' }} />
        <div style={{ marginBottom: '0.25rem', fontSize: '0.8rem', color: '#718096' }}>ASHP ({multiplier}×)</div>
        <div style={{ background: riskColour, height: 10, borderRadius: 4, width: `${ashpPct}%`, marginBottom: '0.375rem' }} />
        <div style={{ fontSize: '0.8rem' }}>
          {boilerFlowLpm.toFixed(1)} L/min → {ashpFlowLpm.toFixed(1)} L/min
        </div>
      </div>
    );
  }

  if (spec.type === 'dhw_outlets') {
    const { combiRisk, simultaneousFail } = spec.data as { combiRisk: string; simultaneousFail: boolean };
    const colour = combiRisk === 'pass' ? '#38a169' : combiRisk === 'warn' ? '#d69e2e' : '#e53e3e';
    return (
      <div style={cardStyle}>
        <div style={titleStyle}>🚿 {spec.title}</div>
        <div style={{ color: colour, fontWeight: 600 }}>
          {simultaneousFail ? '❌ Simultaneous demand exceeds combi capacity' : combiRisk === 'pass' ? '✅ Within combi capacity' : '⚠️ Borderline'}
        </div>
      </div>
    );
  }

  if (spec.type === 'space_footprint') {
    const { storedRisk, recommendedType, mixergyLitres, conventionalLitres, footprintSavingPct } = spec.data as {
      storedRisk: string; recommendedType: string; mixergyLitres: number; conventionalLitres: number; footprintSavingPct: number;
    };
    const colour = storedRisk === 'pass' ? '#38a169' : '#d69e2e';
    return (
      <div style={cardStyle}>
        <div style={titleStyle}>📦 {spec.title}</div>
        <div style={{ color: colour, fontWeight: 600, marginBottom: '0.375rem' }}>
          {recommendedType === 'mixergy' ? '⚡ Mixergy recommended' : '🫙 Standard cylinder'}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#718096' }}>
          Mixergy {mixergyLitres}L vs {conventionalLitres}L conventional — saves {footprintSavingPct}% footprint
        </div>
      </div>
    );
  }

  if (spec.type === 'timeline_24h') {
    return (
      <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
        {spec.title && <div style={titleStyle}>📈 {spec.title}</div>}
        <Timeline24hRenderer
          payload={spec.data}
          compareAId={compareAId}
          compareBId={compareBId}
          onHoverIndexChange={onTimelineHoverIndexChange}
        />
      </div>
    );
  }

  // Fallback for unknown visual types
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>{spec.title ?? spec.type}</div>
      <pre style={{ fontSize: '0.72rem', color: '#a0aec0', overflow: 'auto' }}>
        {JSON.stringify(spec.data, null, 2)}
      </pre>
    </div>
  );
}
