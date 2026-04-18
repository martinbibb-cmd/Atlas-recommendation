/**
 * PhysicsConstraintsPanel — iPad-first "Water power & concurrency" panel.
 *
 * Shows:
 *  A) Hot water behaviour comparison — how each system type handles concurrent demand
 *     (combi / unvented / open-vented), with household-driven concurrency analysis.
 *     Demand is driven by household size and bathroom count heuristics — no manual
 *     shower-type selector.
 *     Storage rows distinguish boiler cylinder vs heat pump cylinder storage regime,
 *     reflecting real differences in usable volume and recovery sensitivity.
 *  B) Measured supply operating point (flow + pressure when available) — supply constraints
 *  C) Concurrency analysis — household-driven flow estimate, concurrency bar chart
 *  D) Customer usage model mini-cards (derived from behaviourTimeline)
 *
 * Data comes entirely from FullEngineResult and EngineInputV2_3.
 */
import { useState } from 'react';
import type { FullEngineResult } from '../../../engine/schema/EngineInputV2_3';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import { flowForKw } from '../utils/dhwMath';

// ─── Types ────────────────────────────────────────────────────────────────────

type Season = 'typical' | 'winter';

const COLD_TEMP: Record<Season, number> = {
  typical: 10,
  winter: 5,
};

const DHW_SETPOINT = 50; // °C — fixed

// ─── Household representative flow heuristic ──────────────────────────────────

/**
 * Derives a representative shower flow (L/min) from the household profile.
 *
 * Uses bathroom count and occupancy heuristics in place of a manual shower-type
 * selector, per the physics-driven convention: demand is driven by household size
 * and bathroom count, not by arbitrary user-selected presets.
 *
 *   1 bath / ≤2 people → 10 L/min  (typical mixer shower)
 *   1 bath / 3–4 people → 12 L/min  (higher-use mixer or mixer-high)
 *   2+ baths or 5+ people → 16 L/min  (rainfall / power shower profile)
 */
function householdRepresentativeFlowLpm(input: EngineInputV2_3): number {
  const bathrooms = input.bathroomCount ?? 1;
  const occupancy = input.occupancyCount ?? 2;
  if (bathrooms >= 2 || occupancy >= 5) return 16;
  if (occupancy >= 3) return 12;
  return 10;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  result: FullEngineResult;
  input: EngineInputV2_3;
  onBack?: () => void;
}

// Visual scale for the bar chart: bars extend to 1.5× the combi limit so there is
// headroom to show "over limit" bars without clipping at the track boundary.
const BAR_CHART_SCALE_FACTOR = 1.5;

/**
 * Minimum measured flow (L/min) that represents a clearly-strong CWS operating point.
 * Must stay in sync with STRONG_FLOW_LPM in OptionScoringV1.ts and OptionMatrixBuilder.ts.
 */
const STRONG_FLOW_LPM = 20;

export default function PhysicsConstraintsPanel({ result, input }: Props) {
  const [season, setSeason] = useState<Season>('typical');

  // ── A: Verdict derivation ────────────────────────────────────────────────
  const combiRisk = result.combiDhwV1?.verdict.combiRisk ?? 'pass';
  const storedRisk = result.storedDhwV1?.verdict.storedRisk ?? 'pass';

  // Storage regime from engine result — drives the UI copy for stored rows
  const storageRegime = result.storedDhwV1?.storageRegime ?? 'boiler_cylinder';
  const usableVolumeFactor = result.storedDhwV1?.usableVolumeFactor ?? 1.0;
  const storeTempC = result.storedDhwV1?.dhwMixing.storeTempC ?? 60;

  const combiStatusLabel =
    combiRisk === 'fail' ? 'Limited in this setup'
    : combiRisk === 'warn' ? 'Possible with caveats'
    : 'Suitable';
  const combiPillClass =
    combiRisk === 'fail' ? 'status-pill status-pill--red'
    : combiRisk === 'warn' ? 'status-pill status-pill--amber'
    : 'status-pill status-pill--green';

  const storedStatusLabel = storedRisk === 'warn' ? 'Caution' : 'Suitable';
  const storedPillClass =
    storedRisk === 'warn' ? 'status-pill status-pill--amber' : 'status-pill status-pill--green';

  // ── B: Measured supply operating point ───────────────────────────────────
  const dynamicBar: number | undefined =
    input.dynamicMainsPressureBar ?? input.dynamicMainsPressure;
  const staticBar: number | undefined = input.staticMainsPressureBar;
  const measuredFlowLpm: number | undefined = input.mainsDynamicFlowLpm;

  // Determine operating-point interpretation
  const hasFullOpPoint = measuredFlowLpm !== undefined && measuredFlowLpm > 0 && dynamicBar !== undefined;
  const isStrongFlow = hasFullOpPoint && measuredFlowLpm !== undefined && measuredFlowLpm >= STRONG_FLOW_LPM;

  // ── C: Concurrency analysis ───────────────────────────────────────────────
  const coldTemp = COLD_TEMP[season];
  const deltaT = DHW_SETPOINT - coldTemp;

  // Combi DHW kW — prefer derated value from engine
  const combiKw = result.combiDhwV1?.maxQtoDhwKwDerated ?? 0;
  const combiLimitFlow = flowForKw(combiKw, deltaT);

  // Household-driven representative flow — no manual preset selector
  const representativeFlowLpm = householdRepresentativeFlowLpm(input);

  // ── D: Customer usage model ───────────────────────────────────────────────
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

  return (
    <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── A: Live output header ─────────────────────────────────────────── */}
      <div>
        <p className="panel-card__eyebrow">Live output</p>
        <div className="live-output-grid">
          <div className="status-tile">
            <span className="status-tile__name">On-demand (combi)</span>
            <span className={combiPillClass}>{combiStatusLabel}</span>
          </div>
          <div className="status-tile">
            <span className="status-tile__name">
              {storageRegime === 'heat_pump_cylinder'
                ? 'Stored hot water (heat pump)'
                : 'Stored hot water (boiler)'}
            </span>
            <span className={storedPillClass}>{storedStatusLabel}</span>
          </div>
        </div>
      </div>

      {/* ── A2: Hot water behaviour by system type ────────────────────────── */}
      <div className="panel-card panel-card--inner">
        <h3 className="panel-card__title">Hot water behaviour by system type</h3>
        <p className="panel-card__note" style={{ fontSize: '0.8rem', color: '#555', marginBottom: '0.75rem' }}>
          Each system class handles hot-water demand differently. Stored systems buffer peak demand
          — combi delivers it on-demand from the mains supply at draw.
          Storage temperature affects how much of a cylinder's volume is usable at the tap.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <SystemBehaviourRow
            label="On-demand hot water (combi)"
            deliveryMode="On-demand from mains"
            pressureSource="Mains supply at draw"
            concurrency="Shared — all outlets divide the boiler output"
            note={combiRowNote(combiKw, representativeFlowLpm, combiLimitFlow, deltaT)}
            status={combiRisk === 'fail' ? 'constraint' : combiRisk === 'warn' ? 'borderline' : 'ok'}
          />
          <SystemBehaviourRow
            label={
              storageRegime === 'heat_pump_cylinder'
                ? `Stored hot water (heat pump cylinder) — ≈${storeTempC} °C store`
                : `Stored hot water (boiler) — ≈${storeTempC} °C store`
            }
            deliveryMode="Pre-stored, mains-fed (unvented) or tank-fed (open-vented)"
            pressureSource="Mains supply (unvented) or loft cistern — tank-fed supply"
            concurrency="Independent — stored volume serves multiple outlets simultaneously"
            note={storedVolumeNote(storageRegime, storeTempC, usableVolumeFactor)}
            status="ok"
          />
          {storageRegime !== 'heat_pump_cylinder' && (
            <SystemBehaviourRow
              label="Tank-fed stored hot water (open-vented cylinder)"
              deliveryMode="Pre-stored, delivered via tank-fed supply"
              pressureSource="Cold water cistern in loft — tank-fed supply (gravity head)"
              concurrency="Independent — stored volume serves multiple outlets simultaneously"
              note="Flow rate governed by loft cistern height (typically 1–2 bar head). High-flow showers need a dedicated pump. No mains supply dependency at the cylinder."
              status="ok"
            />
          )}
        </div>
      </div>

      {/* ── B: Supply constraints ─────────────────────────────────────────── */}
      {(dynamicBar !== undefined || measuredFlowLpm !== undefined) && (
        <div className="panel-card panel-card--inner">
          <h3 className="panel-card__title">Measured supply operating point</h3>
          {hasFullOpPoint ? (
            <>
              <div className="metric-row">
                <span className="metric-label">Dynamic operating point</span>
                <span className="metric-value">
                  {(measuredFlowLpm as number).toFixed(0)} L/min @ {(dynamicBar as number).toFixed(1)} bar
                </span>
              </div>
              {staticBar !== undefined && (
                <div className="metric-row">
                  <span className="metric-label">Static pressure</span>
                  <span className="metric-value">{staticBar.toFixed(1)} bar</span>
                </div>
              )}
              <p className="panel-card__note" style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#555' }}>
                {isStrongFlow
                  ? `Strong measured flow under load — mains-fed stored hot water is well supported. The key question is installation constraints and demand profile, not raw pressure alone.`
                  : (dynamicBar as number) < 1.5
                  ? `Dynamic pressure is in the 1.0–1.5 bar range. Verify the full operating point. 💧 A Mixergy or tank-fed cylinder removes the pressure requirement entirely.`
                  : `Measured supply appears adequate for mains-fed stored hot water options.`}
              </p>
            </>
          ) : (
            <>
              {dynamicBar !== undefined && (
                <div className="metric-row">
                  <span className="metric-label">Dynamic pressure (no flow recorded)</span>
                  <span className="metric-value">{dynamicBar.toFixed(1)} bar</span>
                </div>
              )}
              {staticBar !== undefined && (
                <div className="metric-row">
                  <span className="metric-label">Static pressure</span>
                  <span className="metric-value">{staticBar.toFixed(1)} bar</span>
                </div>
              )}
              <p className="panel-card__note" style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#555' }}>
                Add a measured flow (L/min) at pressure to confirm the full operating point.
              </p>
            </>
          )}
        </div>
      )}

      {/* ── C: Concurrency analysis ───────────────────────────────────────── */}
      <div className="panel-card panel-card--inner">
        <h3 className="panel-card__title">Concurrency analysis</h3>
        <p className="panel-card__note" style={{ fontSize: '0.8rem', color: '#555', marginBottom: '0.5rem' }}>
          Representative flow for this household: <strong>{representativeFlowLpm} L/min per outlet</strong>
          {input.occupancyCount !== undefined || input.bathroomCount !== undefined
            ? ` (derived from ${input.occupancyCount ?? '?'} occupant(s), ${input.bathroomCount ?? '?'} bathroom(s))`
            : ''}.
          The combi limit line shows how many outlets exceed the combi's on-demand heating capacity —
          stored systems are unaffected by this threshold.
        </p>

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

        {/* Combi DHW reference */}
        <div className="metric-row" style={{ marginTop: '0.75rem' }}>
          <span className="metric-label">Combi DHW output (reference)</span>
          <span className="metric-value">{combiKw.toFixed(1)} kW</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Combi sustain flow @ {deltaT}°C rise</span>
          <span className="metric-value">~{combiLimitFlow.toFixed(1)} L/min</span>
        </div>

        {/* Concurrency bar chart (div-based, no chart lib) */}
        <div style={{ marginTop: '1.25rem' }}>
          <p className="panel-card__subtitle">Concurrent outlets — {representativeFlowLpm} L/min each</p>
          <div className="bar-chart" role="img" aria-label="Concurrency bar chart">
            {[1, 2, 3].map(outlets => {
              const totalFlow = representativeFlowLpm * outlets;
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
            <span className="bar-chart__legend-line" /> = combi limit ({combiLimitFlow.toFixed(1)} L/min) — stored systems are not constrained by this limit
          </p>
        </div>

        {/* Summary callout */}
        <div
          className={`capacity-callout${representativeFlowLpm <= combiLimitFlow ? ' capacity-callout--ok' : ' capacity-callout--warn'}`}
          style={{ marginTop: '1rem' }}
        >
          {representativeFlowLpm <= combiLimitFlow
            ? `✅ Single-outlet draw (${representativeFlowLpm} L/min) is within combi capacity at ${deltaT}°C rise`
            : `ℹ️ ${representativeFlowLpm} L/min exceeds combi on-demand capacity — stored hot water buffers this demand without constraint`}
        </div>
      </div>

      {/* ── D: Customer usage model ───────────────────────────────────────── */}
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
        {(input.occupancyCount !== undefined || input.bathroomCount !== undefined) && (
          <div style={{ marginTop: '0.75rem' }}>
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
    </div>
  );
}

// ─── Combi row note helper ────────────────────────────────────────────────────

/**
 * Returns the context note shown for the combi row in the behaviour comparison.
 * Extracted from the component to keep the JSX readable and to make the
 * conditional logic easy to follow and test.
 */
function combiRowNote(
  combiKw: number,
  householdFlowLpm: number,
  combiLimitFlow: number,
  deltaT: number,
): string {
  const capacityLine =
    householdFlowLpm > combiLimitFlow
      ? `Combi cannot sustain ${householdFlowLpm} L/min for this household profile at ${deltaT}°C rise.`
      : `Within combi capacity at ${deltaT}°C rise for this household profile.`;
  return `Combi output: ${combiKw.toFixed(1)} kW. ${capacityLine}`;
}

// ─── Stored volume note helper ────────────────────────────────────────────────

/**
 * Returns the context note for the stored-cylinder row in the behaviour comparison.
 * Distinguishes boiler cylinder (higher store temp, more usable volume) from heat pump
 * cylinder (lower store temp, faster depletion per draw).
 *
 * Extracted for testability and to keep JSX readable.
 */
export function storedVolumeNote(
  regime: 'boiler_cylinder' | 'heat_pump_cylinder' | 'instantaneous_combi',
  storeTempC: number,
  usableVolumeFactor: number,
): string {
  if (regime === 'heat_pump_cylinder') {
    return (
      `Stored at lower temperature (≈${storeTempC} °C). A higher proportion of stored water ` +
      `is drawn at each outlet — usable volume is approximately ${Math.round(usableVolumeFactor * 100)}% ` +
      `of a boiler cylinder at the same nominal size. Recovery speed and simultaneous demand ` +
      `resilience are more critical for heat pump installations.`
    );
  }
  // boiler_cylinder (default)
  return (
    `Stored at higher temperature (≈${storeTempC} °C), allowing more cold dilution at outlets. ` +
    `Usable mixed volume is higher than a heat pump cylinder of the same nominal size. ` +
    `Simultaneous demand resilience is good — stored volume serves all outlets independently.`
  );
}

// ─── System behaviour row helper ─────────────────────────────────────────────

interface SystemBehaviourRowProps {
  label: string;
  deliveryMode: string;
  pressureSource: string;
  concurrency: string;
  note: string;
  status: 'ok' | 'borderline' | 'constraint';
}

function SystemBehaviourRow({ label, deliveryMode, pressureSource, concurrency, note, status }: SystemBehaviourRowProps) {
  const borderColor =
    status === 'constraint' ? '#e53e3e'
    : status === 'borderline' ? '#d69e2e'
    : '#38a169';
  return (
    <div style={{ borderLeft: `3px solid ${borderColor}`, paddingLeft: '0.75rem' }}>
      <span style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>{label}</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem 1rem', fontSize: '0.78rem', color: '#444', marginBottom: '0.3rem' }}>
        <span><em>Delivery:</em> {deliveryMode}</span>
        <span><em>Pressure:</em> {pressureSource}</span>
        <span style={{ gridColumn: '1 / -1' }}><em>Concurrent demand:</em> {concurrency}</span>
      </div>
      <span style={{ fontSize: '0.78rem', color: '#555', fontStyle: 'italic' }}>{note}</span>
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
