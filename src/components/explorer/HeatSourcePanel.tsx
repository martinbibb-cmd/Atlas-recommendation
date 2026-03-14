/**
 * HeatSourcePanel.tsx
 *
 * Layer 5 — boiler detail panel.
 * Shows output, load, return temperature, condensing status, and efficiency.
 */

import type { BoilerData } from './explorerTypes';

interface Props {
  boiler: BoilerData;
  onClose: () => void;
}

function GaugeBand({ value, max, color, label }: {
  value: number; max: number; color: string; label: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="hs-panel__gauge">
      <div className="hs-panel__gauge-header">
        <span className="hs-panel__gauge-label">{label}</span>
        <span className="hs-panel__gauge-value" style={{ color }}>{value} kW</span>
      </div>
      <div className="hs-panel__gauge-track">
        <div
          className="hs-panel__gauge-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function StatChip({ label, value, tone }: {
  label: string;
  value: string;
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
}) {
  return (
    <div className={`hs-panel__chip hs-panel__chip--${tone ?? 'neutral'}`}>
      <span className="hs-panel__chip-label">{label}</span>
      <span className="hs-panel__chip-value">{value}</span>
    </div>
  );
}

export default function HeatSourcePanel({ boiler, onClose }: Props) {
  const loadPct = Math.round((boiler.currentLoadKw / boiler.outputKw) * 100);
  const condensingTone = boiler.condensing ? 'success' : 'warning';
  const condensingLabel = boiler.condensing ? 'YES — saving ~10%' : 'NO — return temp too high';
  const effTone = boiler.efficiencyPct >= 92 ? 'success' : boiler.efficiencyPct >= 85 ? 'warning' : 'danger';

  return (
    <div className="hs-panel" role="dialog" aria-label="Boiler detail">
      {/* Header */}
      <div className="hs-panel__header">
        <div>
          <h2 className="hs-panel__title">Heat Source</h2>
          <p className="hs-panel__subtitle">{boiler.brand} {boiler.model}</p>
        </div>
        <button className="hs-panel__close" onClick={onClose} aria-label="Close boiler panel">×</button>
      </div>

      {/* Load gauges */}
      <div className="hs-panel__section">
        <h3 className="hs-panel__section-title">Current load</h3>
        <GaugeBand value={boiler.outputKw}    max={boiler.outputKw} color="#cbd5e0" label="Rated output" />
        <GaugeBand value={boiler.currentLoadKw} max={boiler.outputKw} color="#ff7a00"  label="Current load" />
        <div className="hs-panel__load-pct">
          {loadPct}% of rated capacity
        </div>
      </div>

      {/* Temperature and condensing */}
      <div className="hs-panel__chips">
        <StatChip label="Return temp"  value={`${boiler.returnTempC}°C`}    tone={boiler.returnTempC < 55 ? 'success' : 'warning'} />
        <StatChip label="Condensing"   value={condensingLabel}               tone={condensingTone} />
        <StatChip label="Efficiency"   value={`${boiler.efficiencyPct}%`}    tone={effTone} />
      </div>

      {/* Condensing explainer */}
      {!boiler.condensing && (
        <div className="hs-panel__tip">
          <strong>Why not condensing?</strong>{' '}
          Return water at {boiler.returnTempC}°C is above the condensing threshold (~55°C).
          Lowering radiator flow temperatures would recover ~8–12% efficiency.
        </div>
      )}

      {/* Physics trace */}
      <div className="hs-panel__section">
        <h3 className="hs-panel__section-title">Raw engine output</h3>
        <pre className="hs-panel__raw">{JSON.stringify({
          outputKw: boiler.outputKw,
          currentLoadKw: boiler.currentLoadKw,
          returnTemp: boiler.returnTempC,
          condensing: boiler.condensing,
          efficiencyPct: boiler.efficiencyPct,
        }, null, 2)}</pre>
      </div>
    </div>
  );
}
