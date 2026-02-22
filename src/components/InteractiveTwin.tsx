/**
 * InteractiveTwin
 *
 * The "Interactive Twin" presentation layer.  Combines three interactive
 * visualisers into one educational simulation panel:
 *
 *   1. OccupancyClock  – drag-and-drop 24-hour routine painter
 *   2. SystemFlushSlider – maintenance recovery scenario
 *   3. MixergyTankVisualizer – State of Charge animated tank
 */
import { useState } from 'react';
import OccupancyClock from './visualizers/OccupancyClock';
import type { HourOccupancy } from './visualizers/OccupancyClock';
import SystemFlushSlider from './visualizers/SystemFlushSlider';
import MixergyTankVisualizer from './visualizers/MixergyTankVisualizer';
import type { MixergyResult } from '../engine/schema/EngineInputV2_3';

/** Minimum home-hours per day to favour a heat pump's "continuous low-level" profile */
const HEAT_PUMP_HOME_HOURS_THRESHOLD = 14;
/** Minimum away-hours per day to favour a boiler's double-peak "fast response" profile */
const BOILER_AWAY_HOURS_THRESHOLD = 10;

interface Props {
  mixergy: MixergyResult;
  /** Current boiler efficiency for the flush slider (post-decay) */
  currentEfficiencyPct: number;
  /** Annual gas spend for the saving calculation */
  annualGasSpendGbp?: number;
  onBack?: () => void;
}

export default function InteractiveTwin({
  mixergy,
  currentEfficiencyPct,
  annualGasSpendGbp = 1200,
  onBack,
}: Props) {
  const [occupancy, setOccupancy] = useState<HourOccupancy[]>([]);
  const homeHours = occupancy.filter(o => o.state === 'home').length;
  const awayHours = occupancy.filter(o => o.state === 'away').length;

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

      {/* ── Occupancy Clock ─────────────────────────────────────────────── */}
      <div className="result-section">
        <h3>📅 Drag-and-Drop Occupancy Painter</h3>
        <p className="description" style={{ marginBottom: '0.75rem' }}>
          Paint your daily routine on the 24-hour clock. The engine uses your occupancy
          profile to optimise heating schedules and compare boiler vs heat-pump performance.
        </p>
        <OccupancyClock onChange={setOccupancy} />
        {occupancy.length > 0 && (
          <div style={{
            marginTop: 12, padding: '8px 14px',
            background: '#ebf8ff', borderRadius: 8,
            fontSize: '0.82rem', color: '#2c5282',
          }}>
            <strong>Live recalculation:</strong>{' '}
            {homeHours}h at home · {awayHours}h away ·{' '}
            {24 - homeHours - awayHours}h sleeping
            {homeHours > HEAT_PUMP_HOME_HOURS_THRESHOLD ? (
              <span style={{ color: '#276749', fontWeight: 600 }}>
                {' '}— Continuous occupancy: heat pump suits this profile.
              </span>
            ) : awayHours > BOILER_AWAY_HOURS_THRESHOLD ? (
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
          Drag the slider to simulate a power-flush and filter service. See the immediate
          efficiency recovery and the annual £ saving it delivers.
        </p>
        <SystemFlushSlider
          currentEfficiencyPct={currentEfficiencyPct}
          annualGasSpendGbp={annualGasSpendGbp}
        />
      </div>

      {/* ── Mixergy State of Charge ─────────────────────────────────────── */}
      <div className="result-section">
        <h3>💧 Mixergy State of Charge Simulation</h3>
        <p className="description" style={{ marginBottom: '0.75rem' }}>
          A {mixergy.mixergyLitres}L Mixergy at 80% SoC provides the same usable hot water
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
    </div>
  );
}
