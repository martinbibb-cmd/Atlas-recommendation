/**
 * InteractiveTwin
 *
 * The "Interactive Twin" presentation layer.  Combines interactive
 * visualisers into one educational simulation panel:
 *
 *   1. PerformanceBandLadder + RecoveryStepsPanel – SEDBUK band ladder with contextual steps
 *   2. OccupancyClock  – drag-and-drop 24-hour routine painter (drives EngineInput when baseInput provided)
 *   3. SystemFlushSlider – maintenance recovery scenario (drives EngineInput when baseInput provided)
 *   4. MixergyTankVisualizer – State of Charge animated tank
 *   5. Timeline24hRenderer – 24-hour comparative timeline, updated by every engine rerun
 */
import { startTransition, useEffect, useRef, useState } from 'react';
import OccupancyClock from './visualizers/OccupancyClock';
import type { HourOccupancy } from './visualizers/OccupancyClock';
import SystemFlushSlider from './visualizers/SystemFlushSlider';
import MixergyTankVisualizer from './visualizers/MixergyTankVisualizer';
import Timeline24hRenderer from './visualizers/Timeline24hRenderer';
import type { EngineInputV2_3, HydraulicModuleV1Result, MixergyResult, OccupancySignature } from '../engine/schema/EngineInputV2_3';
import type { Timeline24hV1, VisualSpecV1 } from '../contracts/EngineOutputV1';
import { computeCurrentEfficiencyPct, getNominalEfficiencyPct } from '../engine/utils/efficiency';
import { runEngine } from '../engine/Engine';
import PerformanceBandLadder from './PerformanceBandLadder';
import RecoveryStepsPanel from './RecoveryStepsPanel';
import type { SystemType } from './RecoveryStepsPanel';

/** Minimum home+sleep hours per day to favour a heat pump's "continuous low-level" profile */
const HEAT_PUMP_HOME_HOURS_THRESHOLD = 14;
/** Minimum away-hours per day to favour a boiler's double-peak "fast response" profile */
const BOILER_AWAY_HOURS_THRESHOLD = 10;
/** Minimum home+sleep hours per day to classify as steady-home occupancy signature */
const STEADY_HOME_MIN_HOURS = 16;
/** Minimum away hours per day to classify as professional (double-peak) occupancy signature */
const PROFESSIONAL_MIN_AWAY_HOURS = 10;

/** Map a painted 24-hour occupancy array to the engine's OccupancySignature. */
function toOccupancySignature(occ: HourOccupancy[]): OccupancySignature {
  const homeHours  = occ.filter(o => o.state === 'home').length;
  const sleepHours = occ.filter(o => o.state === 'sleep').length;
  const awayHours  = occ.filter(o => o.state === 'away').length;
  if (homeHours + sleepHours > STEADY_HOME_MIN_HOURS) return 'steady_home';
  if (awayHours > PROFESSIONAL_MIN_AWAY_HOURS) return 'professional';
  return 'shift_worker';
}

interface Props {
  mixergy: MixergyResult;
  /** Current boiler efficiency for the flush slider (post-decay) */
  currentEfficiencyPct: number;
  /** Nominal (as-installed / SEDBUK) boiler efficiency for the flush slider — required; caller supplies ?? 92 fallback */
  nominalEfficiencyPct: number;
  /** Annual gas spend for the saving calculation */
  annualGasSpendGbp?: number;
  /** Hydraulic module result — used to gate the hydraulics recovery step. */
  hydraulic?: HydraulicModuleV1Result;
  /** System type for compare side A (e.g. 'ashp', 'boiler'). */
  systemAType?: SystemType;
  /** System type for compare side B. */
  systemBType?: SystemType;
  /** Post clean & protect efficiency (defaults to nominalEfficiencyPct when omitted). */
  restoredPct?: number;
  /** Confidence in the currentEfficiencyPct estimate. */
  confidence?: 'high' | 'medium' | 'low';
  /** Top degradation contributors (label + valuePct). */
  contributors?: { label: string; valuePct: number }[];
  /**
   * When provided, OccupancyClock and SystemFlushSlider changes rerun the engine
   * and update the displayed efficiency / demand metrics in real time.
   */
  baseInput?: EngineInputV2_3;
  onBack?: () => void;
}

export default function InteractiveTwin({
  mixergy,
  currentEfficiencyPct,
  nominalEfficiencyPct,
  annualGasSpendGbp = 1200,
  hydraulic,
  systemAType,
  systemBType,
  restoredPct,
  confidence = 'medium',
  contributors = [],
  baseInput,
  onBack,
}: Props) {
  const [occupancy, setOccupancy] = useState<HourOccupancy[]>([]);
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);
  const homeHours = occupancy.filter(o => o.state === 'home').length;
  const awayHours = occupancy.filter(o => o.state === 'away').length;

  // Twin engine state — tracks the last rerun driven by occupancy or flush changes.
  const twinInputRef = useRef<EngineInputV2_3 | null>(baseInput ?? null);
  const [twinCurrentEfficiencyPct, setTwinCurrentEfficiencyPct] = useState(currentEfficiencyPct);
  const [twinDailyDemandKwh, setTwinDailyDemandKwh] = useState<number | null>(null);
  const [twinRecommendedSystem, setTwinRecommendedSystem] = useState<'boiler' | 'ashp' | 'stored_water' | null>(null);
  /** Live 24h timeline updated on every engine rerun — rendered below the Flush slider. */
  const [twinTimelinePayload, setTwinTimelinePayload] = useState<Timeline24hV1 | null>(null);

  // Keep the ref in sync when the parent passes a fresh baseInput (e.g. survey step change).
  useEffect(() => {
    if (baseInput) twinInputRef.current = baseInput;
  }, [baseInput]);

  /** Rerun the engine with the current twin input (already mutated by caller) and update state. */
  const rerunEngine = (twinInput: EngineInputV2_3) => {
    startTransition(() => {
      const out = runEngine(twinInput);
      setTwinCurrentEfficiencyPct(computeCurrentEfficiencyPct(nominalEfficiencyPct, out.normalizer.tenYearEfficiencyDecayPct));
      // Each hourlyData entry is the average power (kW) for a 1-hour slot; summing 24 values gives kWh.
      const dailyDemandKwh = out.lifestyle.hourlyData.reduce((sum, h) => sum + h.demandKw, 0);
      setTwinDailyDemandKwh(parseFloat(dailyDemandKwh.toFixed(1)));
      setTwinRecommendedSystem(out.lifestyle.recommendedSystem);
      // Extract the 24h timeline visual so the renderer shows a live response.
      const timelineVisual = out.engineOutput.visuals?.find((v: VisualSpecV1) => v.type === 'timeline_24h');
      if (timelineVisual?.type === 'timeline_24h') {
        setTwinTimelinePayload(timelineVisual.data as Timeline24hV1);
      }
    });
  };

  const handleOccupancyChange = (occ: HourOccupancy[]) => {
    setOccupancy(occ);
    if (!twinInputRef.current) return;
    const sig = toOccupancySignature(occ);
    const updated: EngineInputV2_3 = { ...twinInputRef.current, occupancySignature: sig };
    twinInputRef.current = updated;
    rerunEngine(updated);
  };

  const handleFlushChange = (serviceLevelPct: number) => {
    if (!twinInputRef.current) return;
    const updated: EngineInputV2_3 = { ...twinInputRef.current, maintenance: { serviceLevelPct } };
    twinInputRef.current = updated;
    rerunEngine(updated);
  };

  // Effective efficiency shown throughout — uses engine-computed value when available.
  const effectiveCurrentEfficiencyPct = twinCurrentEfficiencyPct;

  const newBaselinePct = getNominalEfficiencyPct();
  const effectiveRestoredPct = restoredPct ?? nominalEfficiencyPct;

  // Minimal no-penalty hydraulic result used when caller does not provide one.
  // ΔT values: boiler 20°C, ASHP 5°C (standard design assumptions).
  // effectiveCOP 3.2 = BASE_ASHP_COP baseline (no velocity degradation).
  const fallbackHydraulic: HydraulicModuleV1Result = {
    boiler: { deltaT: 20, flowLpm: 0 },  // standard boiler design ΔT
    ashp: { deltaT: 5, flowLpm: 0, velocityMs: 0 },  // standard ASHP design ΔT
    verdict: { boilerRisk: 'pass', ashpRisk: 'pass' },
    velocityPenalty: 0,
    effectiveCOP: 3.2,  // BASE_ASHP_COP — no velocity penalty applied
    flowDeratePct: 0,
    notes: [],
  };
  const effectiveHydraulic = hydraulic ?? fallbackHydraulic;

  return (
    <div className="stepper-container">
      <div className="stepper-header">
        {onBack && (
          <button className="back-btn" onClick={onBack}>← Back to Results</button>
        )}
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2d3748', margin: 0 }}>
          🏠 Interactive Twin Simulation
        </h2>
      </div>

      {/* ── Performance Band Ladder + Recovery Steps ─────────────────────── */}
      <div className="result-section">
        <h3>📊 Efficiency Band Analysis</h3>
        <p className="description" style={{ marginBottom: '0.75rem' }}>
          Compare current seasonal performance against SEDBUK bands and see the recovery steps
          that will restore or raise your system's efficiency band.
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(160px, 220px) 1fr',
          gap: '1.5rem',
          alignItems: 'flex-start',
        }}>
          <div>
            <PerformanceBandLadder
              nominalPct={nominalEfficiencyPct}
              currentEffectivePct={effectiveCurrentEfficiencyPct}
              restoredPct={effectiveRestoredPct}
              newBaselinePct={newBaselinePct}
              confidence={confidence}
              contributors={contributors}
              onMarkerHover={setHoveredMarker}
            />
          </div>
          <div>
            <RecoveryStepsPanel
              systemAType={systemAType}
              systemBType={systemBType}
              hydraulic={effectiveHydraulic}
              highlightedMarker={hoveredMarker}
            />
          </div>
        </div>
      </div>

      {/* ── Occupancy Clock ─────────────────────────────────────────────── */}
      <div className="result-section">
        <h3>📅 Drag-and-Drop Occupancy Painter</h3>
        <p className="description" style={{ marginBottom: '0.75rem' }}>
          Paint your daily routine on the 24-hour clock. The engine recalculates heat demand
          and system suitability in real time as you paint.
        </p>
        <OccupancyClock onChange={handleOccupancyChange} />
        {occupancy.length > 0 && (
          <div style={{
            marginTop: 12, padding: '8px 14px',
            background: '#ebf8ff', borderRadius: 8,
            fontSize: '0.82rem', color: '#2c5282',
          }}>
            <strong>Live recalculation:</strong>{' '}
            {homeHours}h at home · {awayHours}h away ·{' '}
            {24 - homeHours - awayHours}h sleeping
            {twinDailyDemandKwh !== null && (
              <span> · <strong>{twinDailyDemandKwh} kWh</strong> estimated daily heat demand</span>
            )}
            {/* Prefer the engine-computed recommendation; fall back to local threshold heuristic
                only when no engine rerun has happened yet (baseInput not supplied). */}
            {(twinRecommendedSystem !== null ? twinRecommendedSystem === 'ashp' : homeHours > HEAT_PUMP_HOME_HOURS_THRESHOLD) ? (
              <span style={{ color: '#276749', fontWeight: 600 }}>
                {' '}— Continuous occupancy: heat pump suits this profile.
              </span>
            ) : (twinRecommendedSystem !== null ? twinRecommendedSystem === 'boiler' : awayHours > BOILER_AWAY_HOURS_THRESHOLD) ? (
              <span style={{ color: '#744210', fontWeight: 600 }}>
                {' '}— Double-peak profile: fast-response boiler suits this pattern.
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* ── System Flush Slider ─────────────────────────────────────────── */}
      <div className="result-section">
        <h3>🔧 System Cleaning Simulator</h3>
        <p className="description" style={{ marginBottom: '0.75rem' }}>
          Drag the slider to simulate a power-flush and filter service. The engine recalculates
          efficiency across all panels when the service level changes.
        </p>
        <SystemFlushSlider
          currentEfficiencyPct={effectiveCurrentEfficiencyPct}
          nominalEfficiencyPct={nominalEfficiencyPct}
          annualGasSpendGbp={annualGasSpendGbp}
          onChange={baseInput ? handleFlushChange : undefined}
        />
      </div>

      {/* ── Mixergy State of Charge ─────────────────────────────────────── */}
      <div className="result-section">
        <h3>💧 Mixergy Hot Water Battery</h3>
        <p className="description" style={{ marginBottom: '0.75rem' }}>
          A {mixergy.mixergyLitres}L Mixergy at 80% battery remaining provides the same usable hot water
          as a {mixergy.equivalentConventionalLitres}L conventional cylinder fully heated —
          using {mixergy.footprintSavingPct}% less floor space.
        </p>
        <MixergyTankVisualizer
          mixergyLitres={mixergy.mixergyLitres}
          conventionalLitres={mixergy.equivalentConventionalLitres}
          stateOfChargePct={80}
          animate
        />
      </div>

      {/* ── Live 24h Timeline — updates with every occupancy / flush change ── */}
      {twinTimelinePayload && (
        <div className="result-section">
          <h3>📈 Live 24h System Response</h3>
          <p className="description" style={{ marginBottom: '0.75rem' }}>
            This timeline reflects every change you make above — occupancy pattern, system flush level —
            running through the full engine. Row labels: Space Heat Demand · DHW Events · Heat Source Output · Performance.
          </p>
          <Timeline24hRenderer
            payload={twinTimelinePayload}
            compareAId={systemAType}
            compareBId={systemBType}
          />
        </div>
      )}
    </div>
  );
}
