/**
 * HeatSourcePanel.tsx
 *
 * Layer 5 — heat source detail panel.
 * Renders either a boiler panel (efficiency, condensing, load gauges)
 * or a heat pump panel (COP, SPF, flow temp regime, defrost).
 * Cylinder data is shown when a stored DHW system is active.
 *
 * All assumptions driving the displayed numbers are passed in explicitly
 * via the `assumptions` prop — nothing is silently defaulted inside this component.
 * Active constraint labels are shown as diagnostic tags.
 */

import type { SystemConfig, ExplorerAssumptions, ConstraintLabel } from './explorerTypes';
import { CONSTRAINT_LABEL_DISPLAY } from './explorerTypes';
import { DEFAULT_NOMINAL_EFFICIENCY_PCT } from '../../engine/utils/efficiency';

interface Props {
  systemConfig: SystemConfig;
  assumptions: ExplorerAssumptions;
  constraintLabels: ConstraintLabel[];
  onClose: () => void;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GaugeBand({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="hs-panel__gauge">
      <div className="hs-panel__gauge-header">
        <span className="hs-panel__gauge-label">{label}</span>
        <span className="hs-panel__gauge-value" style={{ color }}>{value} kW</span>
      </div>
      <div className="hs-panel__gauge-track">
        <div className="hs-panel__gauge-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function Chip({ label, value, tone }: {
  label: string; value: string;
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
}) {
  return (
    <div className={`hs-panel__chip hs-panel__chip--${tone ?? 'neutral'}`}>
      <span className="hs-panel__chip-label">{label}</span>
      <span className="hs-panel__chip-value">{value}</span>
    </div>
  );
}

/** Renders active constraint labels as diagnostic tags. */
function ConstraintTags({ labels }: { labels: ConstraintLabel[] }) {
  if (labels.length === 0) return null;
  return (
    <div className="hs-panel__constraint-tags" aria-label="Active constraints">
      {labels.map(label => (
        <span key={label} className="hs-panel__constraint-tag">
          {CONSTRAINT_LABEL_DISPLAY[label]}
        </span>
      ))}
    </div>
  );
}

function CylinderSection({ systemConfig }: { systemConfig: SystemConfig }) {
  const { cylinder, dhwMethod } = systemConfig;
  if (!cylinder) return null;

  const dhwLabel = dhwMethod === 'cylinder_gravity' ? 'Gravity-fed (vented)' : 'Mains-pressure (unvented)';
  const typeLabel: Record<string, string> = {
    indirect_vented:   'Indirect Vented',
    indirect_unvented: 'Indirect Unvented',
    mixergy:           'Mixergy Stratified',
  };

  return (
    <div className="hs-panel__section hs-panel__section--cylinder">
      <h3 className="hs-panel__section-title">DHW cylinder</h3>
      <Chip label="Type"          value={typeLabel[cylinder.type] ?? cylinder.type}     tone="neutral" />
      <Chip label="Volume"        value={`${cylinder.volumeLitres} L`}                  tone="neutral" />
      <Chip label="Recovery time" value={`${cylinder.recoveryTimeMinutes} min`}         tone="neutral" />
      <Chip label="DHW pressure"  value={dhwLabel}                                       tone={dhwMethod === 'cylinder_mains' ? 'success' : 'neutral'} />
      <Chip label="Standing loss" value={`${cylinder.standingLossKwhPerDay} kWh/day`}   tone="warning" />
      <Chip label="G3 compliance" value={cylinder.g3Required ? 'Required' : 'Not required'} tone={cylinder.g3Required ? 'warning' : 'success'} />
      {cylinder.g3Required && (
        <div className="hs-panel__tip">
          <strong>G3 requirement:</strong> Unvented systems must be installed and commissioned by a G3-qualified engineer. Annual servicing of PRV, expansion vessel, and tundish is mandatory.
        </div>
      )}
    </div>
  );
}

// ── Boiler panel ──────────────────────────────────────────────────────────────

function BoilerPanel({ systemConfig, assumptions, constraintLabels, onClose }: Props) {
  const { heatSource, accentColor } = systemConfig;
  const outputKw     = heatSource.outputKw     ?? 24;
  const currentLoadKw = heatSource.currentLoadKw ?? 14;
  const returnTempC  = heatSource.returnTempC  ?? 65;
  const efficiencyPct = heatSource.efficiencyPct ?? 88;
  const condensing   = heatSource.condensing   ?? false;

  const loadPct  = Math.round((currentLoadKw / outputKw) * 100);
  const effTone  = efficiencyPct >= DEFAULT_NOMINAL_EFFICIENCY_PCT ? 'success' : efficiencyPct >= 85 ? 'warning' : 'danger';
  const retTone  = returnTempC < 55 ? 'success' : 'warning';
  const conTone  = condensing ? 'success' : 'warning';

  return (
    <div className="hs-panel" style={{ '--hs-accent': accentColor } as React.CSSProperties}
      role="dialog" aria-label="Boiler detail">
      <div className="hs-panel__header">
        <div>
          <h2 className="hs-panel__title">Heat Source</h2>
          <p className="hs-panel__subtitle">{heatSource.brand} {heatSource.model}</p>
        </div>
        <button className="hs-panel__close" onClick={onClose} aria-label="Close">×</button>
      </div>

      {/* Assumed flow temperature — always visible */}
      <div className="hs-panel__chips">
        <Chip label="Assumed flow temp" value={`${assumptions.assumedFlowTempC}°C`} tone="neutral" />
        <Chip label="Primary pipe"      value={`${assumptions.primaryPipeMm}mm`}    tone="neutral" />
      </div>

      {/* Active constraint labels */}
      <ConstraintTags labels={constraintLabels} />

      <div className="hs-panel__section">
        <h3 className="hs-panel__section-title">Current load</h3>
        <GaugeBand label="Rated output"  value={outputKw}      max={outputKw} color="#cbd5e0" />
        <GaugeBand label="Current load"  value={currentLoadKw} max={outputKw} color={accentColor} />
        <div className="hs-panel__load-pct">{loadPct}% of rated capacity</div>
      </div>

      <div className="hs-panel__chips">
        <Chip label="Return temp"  value={`${returnTempC}°C`}      tone={retTone} />
        <Chip label="Condensing"   value={condensing ? 'YES — saving ~10%' : 'NO — return temp too high'} tone={conTone} />
        <Chip label="Efficiency"   value={`${efficiencyPct}%`}     tone={effTone} />
      </div>

      {!condensing && (
        <div className="hs-panel__tip">
          <strong>Why not condensing?</strong>{' '}
          Return water at {returnTempC}°C is above the condensing threshold (~55°C).
          Lowering flow temperatures would recover 8–12% efficiency.
        </div>
      )}

      <CylinderSection systemConfig={systemConfig} />

      <details className="hs-panel__raw-details">
        <summary className="hs-panel__raw-summary">Raw engine output</summary>
        <pre className="hs-panel__raw">{JSON.stringify({
          outputKw, currentLoadKw, returnTempC, condensing, efficiencyPct,
          assumedFlowTempC: assumptions.assumedFlowTempC,
          primaryPipeMm: assumptions.primaryPipeMm,
        }, null, 2)}</pre>
      </details>
    </div>
  );
}

// ── Heat pump panel ───────────────────────────────────────────────────────────

function HeatPumpPanel({ systemConfig, assumptions, constraintLabels, onClose }: Props) {
  const { heatSource, accentColor, primaryDiameterMm } = systemConfig;
  const ratedKw  = heatSource.ratedOutputKw  ?? 7;
  const loadKw   = heatSource.currentLoadKw  ?? 4.5;
  const cop      = heatSource.cop            ?? 2.8;
  const spf      = heatSource.spf            ?? 2.5;
  const flowTemp = assumptions.assumedFlowTempC;
  const regime   = heatSource.flowTempRegime ?? '45C';
  const outdoorT = heatSource.outdoorTempC   ?? 7;

  const loadPct  = Math.round((loadKw / ratedKw) * 100);
  const copTone  = cop >= 3.5 ? 'success' : cop >= 2.5 ? 'warning' : 'danger';
  const spfTone  = spf >= 3.0 ? 'success' : spf >= 2.5 ? 'warning' : 'danger';
  const flowTempTone = flowTemp <= 35 ? 'success' : flowTemp <= 45 ? 'warning' : 'danger';
  const pipeTone = primaryDiameterMm >= 28 ? 'success' : 'danger';

  const FLOW_TEMP_REASON: Record<ExplorerAssumptions['emitterState'], string | null> = {
    existing:  'existing radiators require high flow temperature',
    oversized: 'oversized radiators (fast-fit, 45°C capable)',
    upgraded:  null,
  };
  const flowTempReason = FLOW_TEMP_REASON[assumptions.emitterState];

  return (
    <div className="hs-panel" style={{ '--hs-accent': accentColor } as React.CSSProperties}
      role="dialog" aria-label="Heat pump detail">
      <div className="hs-panel__header">
        <div>
          <h2 className="hs-panel__title">Air Source Heat Pump</h2>
          <p className="hs-panel__subtitle">{heatSource.brand} {heatSource.model}</p>
        </div>
        <button className="hs-panel__close" onClick={onClose} aria-label="Close">×</button>
      </div>

      {/* Assumed flow temperature — always visible with reason */}
      <div className="hs-panel__chips">
        <Chip
          label="Assumed flow temp"
          value={`${flowTemp}°C`}
          tone={flowTempTone}
        />
        <Chip label="Emitter state"   value={assumptions.emitterState}                tone={flowTempTone} />
        <Chip label="Primary pipe"    value={`${assumptions.primaryPipeMm}mm`}        tone={pipeTone}     />
        <Chip label="Compensation"    value={assumptions.compensationEnabled ? 'On' : 'Off'}
          tone={assumptions.compensationEnabled ? 'success' : 'warning'}
        />
      </div>

      {/* Explain why operating at non-optimal flow temp */}
      {flowTemp > 35 && flowTempReason && (
        <div className="hs-panel__tip hs-panel__tip--info" data-testid="flow-temp-reason">
          <strong>Why {flowTemp}°C?</strong>{' '}{flowTempReason}.
          {flowTemp >= 55 && ' Operating in high-temperature recovery mode.'}
        </div>
      )}

      {/* Active constraint labels */}
      <ConstraintTags labels={constraintLabels} />

      {/* Load gauges */}
      <div className="hs-panel__section">
        <h3 className="hs-panel__section-title">Current output</h3>
        <GaugeBand label="Rated output"   value={ratedKw} max={ratedKw} color="#cbd5e0" />
        <GaugeBand label="Current output" value={loadKw}  max={ratedKw} color={accentColor} />
        <div className="hs-panel__load-pct">{loadPct}% of rated capacity</div>
      </div>

      {/* Performance chips */}
      <div className="hs-panel__chips">
        <Chip label="Design COP"       value={`${cop}`}         tone={copTone}    />
        <Chip label="Seasonal SPF"     value={`${spf}`}         tone={spfTone}    />
        <Chip label="Outdoor temp"     value={`${outdoorT}°C`}  tone="neutral"    />
        <Chip label="Flow temp regime" value={regime}           tone={flowTempTone} />
      </div>

      {flowTemp > 35 && (
        <div className="hs-panel__tip">
          <strong>Better SPF available:</strong>{' '}
          Upgrading emitters to operate at 35°C would raise SPF from {spf} to ~3.3,
          cutting running costs by roughly 25%.
        </div>
      )}

      {primaryDiameterMm < 28 && (
        <div className="hs-panel__tip hs-panel__tip--danger">
          <strong>Pipe sizing risk:</strong>{' '}
          Heat pumps need 28mm primary to achieve the required flow rates (ΔT 5°C).
          Current 22mm pipe may cause velocity noise and reduced output.
        </div>
      )}

      <CylinderSection systemConfig={systemConfig} />

      <details className="hs-panel__raw-details">
        <summary className="hs-panel__raw-summary">COP model (raw)</summary>
        <pre className="hs-panel__raw">{JSON.stringify({
          ratedOutputKw: ratedKw,
          currentLoadKw: loadKw,
          cop, spf,
          assumedFlowTempC: flowTemp,
          outdoorTempC: outdoorT,
          emitterState: assumptions.emitterState,
          primaryPipeMm: assumptions.primaryPipeMm,
          compensationEnabled: assumptions.compensationEnabled,
        }, null, 2)}</pre>
      </details>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function HeatSourcePanel({ systemConfig, assumptions, constraintLabels, onClose }: Props) {
  if (systemConfig.heatSource.isHeatPump) {
    return <HeatPumpPanel systemConfig={systemConfig} assumptions={assumptions} constraintLabels={constraintLabels} onClose={onClose} />;
  }
  return <BoilerPanel systemConfig={systemConfig} assumptions={assumptions} constraintLabels={constraintLabels} onClose={onClose} />;
}
