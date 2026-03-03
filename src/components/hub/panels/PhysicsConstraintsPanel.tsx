/**
 * PhysicsConstraintsPanel — iPad-first "Water power & concurrency" panel.
 *
 * Shows:
 *  A) Live output header: Combi + Stored verdict tiles
 *  B) Water power & concurrency card with season toggle, shower presets,
 *     and a div-based concurrency bar chart
 *  C) Customer usage model mini-cards (derived from behaviourTimeline)
 *  D) "Within capacity" callout at the bottom
 *
 * Data comes entirely from FullEngineResult and EngineInputV2_3.
 * No engine changes, no scoring, no new engine fields.
 */
import { useState } from 'react';
import type { FullEngineResult } from '../../../engine/schema/EngineInputV2_3';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import { kwForFlow, flowForKw } from '../utils/dhwMath';

// ─── Types ────────────────────────────────────────────────────────────────────

type Season = 'typical' | 'winter';

interface ShowerPreset {
  id: string;
  label: string;
  flowLpm: number;
}

const SHOWER_PRESETS: ShowerPreset[] = [
  { id: 'mixer', label: 'Mixer', flowLpm: 10 },
  { id: 'mixer_high', label: 'Mixer high', flowLpm: 12 },
  { id: 'rainfall', label: 'Rainfall', flowLpm: 16 },
];

const COLD_TEMP: Record<Season, number> = {
  typical: 10,
  winter: 5,
};

const DHW_SETPOINT = 50; // °C — fixed

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  result: FullEngineResult;
  input: EngineInputV2_3;
  onBack?: () => void;
}

// Visual scale for the bar chart: bars extend to 1.5× the combi limit so there is
// headroom to show "over limit" bars without clipping at the track boundary.
const BAR_CHART_SCALE_FACTOR = 1.5;

export default function PhysicsConstraintsPanel({ result, input }: Props) {
  const [season, setSeason] = useState<Season>('typical');
  const [selectedPreset, setSelectedPreset] = useState<string>('mixer');

  // ── A: Verdict derivation ────────────────────────────────────────────────
  const combiRisk = result.combiDhwV1.verdict.combiRisk;
  const storedRisk = result.storedDhwV1.verdict.storedRisk;

  const combiStatusLabel =
    combiRisk === 'fail' ? 'Not suitable'
    : combiRisk === 'warn' ? 'Caution'
    : 'Suitable';
  const combiPillClass =
    combiRisk === 'fail' ? 'status-pill status-pill--red'
    : combiRisk === 'warn' ? 'status-pill status-pill--amber'
    : 'status-pill status-pill--green';

  const storedStatusLabel = storedRisk === 'warn' ? 'Caution' : 'Suitable';
  const storedPillClass =
    storedRisk === 'warn' ? 'status-pill status-pill--amber' : 'status-pill status-pill--green';

  // ── B: Water power & concurrency ─────────────────────────────────────────
  const coldTemp = COLD_TEMP[season];
  const deltaT = DHW_SETPOINT - coldTemp;

  // Combi DHW kW — prefer derated value from engine
  const combiKw = result.combiDhwV1.maxQtoDhwKwDerated;
  const combiLimitFlow = flowForKw(combiKw, deltaT);

  const preset = SHOWER_PRESETS.find(p => p.id === selectedPreset) ?? SHOWER_PRESETS[0];
  const selectedFlow = preset.flowLpm;

  // ── C: Customer usage model ───────────────────────────────────────────────
  const timeline = result.engineOutput.behaviourTimeline;

  let peakDhwKw: number | null = null;
  let peakHeatKw: number | null = null;
  let dailyHotWaterL: number | null = null;
  let morningPeakDrawMin: number | null = null;

  if (timeline && timeline.points.length > 0) {
    const points = timeline.points;
    peakDhwKw = Math.max(...points.map(p => p.dhwDemandKw));
    peakHeatKw = Math.max(...points.map(p => p.heatDemandKw));

    // Daily hot water in litres: integrate DHW energy → kWh → litres
    // Physics: E(kJ) = mass(kg) × cp × ΔT  →  mass(kg) ≈ volume(L)
    //   totalDhwKwh × 3600 gives kJ; dividing by (cp × ΔT) gives litres
    const resolutionH = (timeline.resolutionMins ?? 15) / 60;
    const totalDhwKwh = points.reduce((sum, p) => sum + p.dhwDemandKw * resolutionH, 0);
    const cp = 4.186; // kJ/(kg·°C)
    const kWh_to_kJ = 3600;
    dailyHotWaterL = (totalDhwKwh * kWh_to_kJ) / (cp * deltaT);

    // Morning peak draw (min): longest contiguous window 06:00–10:00 with dhwDemandKw > 0
    const morningPoints = points.filter(p => p.tHour >= 6 && p.tHour < 10);
    let maxRun = 0;
    let currentRun = 0;
    for (const p of morningPoints) {
      if (p.dhwDemandKw > 0) {
        currentRun++;
        if (currentRun > maxRun) maxRun = currentRun;
      } else {
        currentRun = 0;
      }
    }
    morningPeakDrawMin = maxRun * (timeline.resolutionMins ?? 15);
  }

  // ── D: Callout ────────────────────────────────────────────────────────────
  const withinCapacity = selectedFlow <= combiLimitFlow;

  return (
    <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── A: Live output header ─────────────────────────────────────────── */}
      <div>
        <p className="panel-card__eyebrow">Live output</p>
        <div className="live-output-grid">
          <div className="status-tile">
            <span className="status-tile__name">Combi</span>
            <span className={combiPillClass}>{combiStatusLabel}</span>
          </div>
          <div className="status-tile">
            <span className="status-tile__name">Stored (Unvented)</span>
            <span className={storedPillClass}>{storedStatusLabel}</span>
          </div>
        </div>
      </div>

      {/* ── B: Water power & concurrency ─────────────────────────────────── */}
      <div className="panel-card panel-card--inner">
        <h3 className="panel-card__title">Water power &amp; concurrency</h3>

        {/* Season toggle */}
        <div className="segment-control" role="group" aria-label="Season">
          {(['typical', 'winter'] as Season[]).map(s => (
            <button
              key={s}
              className={`segment-control__btn${season === s ? ' segment-control__btn--active' : ''}`}
              onClick={() => setSeason(s)}
            >
              {s === 'typical' ? 'Typical (10°C)' : 'Winter (5°C)'}
            </button>
          ))}
        </div>

        {/* Combi sustain flow */}
        <div className="metric-row" style={{ marginTop: '0.75rem' }}>
          <span className="metric-label">Combi DHW output</span>
          <span className="metric-value">{combiKw.toFixed(1)} kW</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Combi sustain flow @ {deltaT}°C rise</span>
          <span className="metric-value">~{combiLimitFlow.toFixed(1)} L/min</span>
        </div>

        {/* Shower preset tiles */}
        <div className="preset-grid" style={{ marginTop: '1rem' }}>
          {SHOWER_PRESETS.map(p => {
            const requiredKw = kwForFlow(p.flowLpm, deltaT);
            const overLimit = requiredKw > combiKw;
            const isSelected = selectedPreset === p.id;
            return (
              <button
                key={p.id}
                className={`preset-tile${isSelected ? ' preset-tile--selected' : ''}${overLimit ? ' preset-tile--overlimit' : ''}`}
                onClick={() => setSelectedPreset(p.id)}
                aria-pressed={isSelected}
              >
                <span className="preset-tile__label">{p.label}</span>
                <span className="preset-tile__flow">{p.flowLpm} L/min</span>
                <span className="preset-tile__kw">{requiredKw.toFixed(1)} kW</span>
                {overLimit && <span className="preset-tile__badge">Over limit</span>}
              </button>
            );
          })}
        </div>

        {/* Concurrency bar chart (div-based, no chart lib) */}
        <div style={{ marginTop: '1.25rem' }}>
          <p className="panel-card__subtitle">Concurrency — {preset.label} shower(s)</p>
          <div className="bar-chart" role="img" aria-label="Concurrency bar chart">
            {[1, 2, 3].map(outlets => {
              const totalFlow = selectedFlow * outlets;
              const pct = Math.min(100, (totalFlow / (combiLimitFlow * BAR_CHART_SCALE_FACTOR)) * 100);
              const overBar = totalFlow > combiLimitFlow;
              const limitPct = Math.min(100, (combiLimitFlow / (combiLimitFlow * BAR_CHART_SCALE_FACTOR)) * 100);
              return (
                <div key={outlets} className="bar-chart__row">
                  <span className="bar-chart__label">{outlets} outlet{outlets > 1 ? 's' : ''}</span>
                  <div className="bar-chart__track">
                    <div
                      className={`bar-chart__fill${overBar ? ' bar-chart__fill--over' : ''}`}
                      style={{ width: `${pct}%` }}
                    />
                    {/* Combi limit marker */}
                    <div
                      className="bar-chart__limit-line"
                      style={{ left: `${limitPct}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="bar-chart__value">{totalFlow.toFixed(0)} L/min</span>
                </div>
              );
            })}
          </div>
          <p className="bar-chart__legend">
            <span className="bar-chart__legend-line" /> = combi limit ({combiLimitFlow.toFixed(1)} L/min)
          </p>
        </div>
      </div>

      {/* ── C: Customer usage model ───────────────────────────────────────── */}
      <div className="panel-card panel-card--inner">
        <h3 className="panel-card__title">Customer usage model</h3>
        <div className="mini-metrics-grid">
          <MiniCard
            label="Est. daily hot water"
            value={dailyHotWaterL !== null ? `${Math.round(dailyHotWaterL)} L` : '—'}
          />
          <MiniCard
            label="Morning peak draw"
            value={morningPeakDrawMin !== null ? `${morningPeakDrawMin} min` : '—'}
          />
          <MiniCard
            label="Peak DHW demand"
            value={peakDhwKw !== null ? `${peakDhwKw.toFixed(1)} kW` : '—'}
          />
          <MiniCard
            label="Peak heat demand"
            value={peakHeatKw !== null ? `${peakHeatKw.toFixed(1)} kW` : '—'}
          />
        </div>
      </div>

      {/* ── D: Callout ────────────────────────────────────────────────────── */}
      <div className={`capacity-callout${withinCapacity ? ' capacity-callout--ok' : ' capacity-callout--warn'}`}>
        {withinCapacity
          ? `✅ Within capacity for a single ${preset.label.toLowerCase()} shower at ${deltaT}°C rise`
          : `⚠️ Over limit — expect temperature drop or reduced flow with a ${preset.label.toLowerCase()} shower at ${deltaT}°C rise`}
      </div>

      {/* Occupancy context */}
      {(input.occupancyCount !== undefined || input.bathroomCount !== undefined) && (
        <div className="panel-card panel-card--inner">
          <h3 className="panel-card__title">Occupancy context</h3>
          <div className="metric-row">
            <span className="metric-label">Occupants</span>
            <span className="metric-value">{input.occupancyCount ?? '—'}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Bathrooms</span>
            <span className="metric-value">{input.bathroomCount ?? '—'}</span>
          </div>
          {input.peakConcurrentOutlets !== undefined && (
            <div className="metric-row">
              <span className="metric-label">Peak concurrent outlets</span>
              <span className="metric-value">{input.peakConcurrentOutlets}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Mini-card helper ─────────────────────────────────────────────────────────

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-card">
      <span className="mini-card__label">{label}</span>
      <span className="mini-card__value">{value}</span>
    </div>
  );
}
