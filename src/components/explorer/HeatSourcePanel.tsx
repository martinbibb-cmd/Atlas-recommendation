/**
 * HeatSourcePanel.tsx
 *
 * Layer 5 — heat source detail panel.
 * Renders either a boiler panel (efficiency, condensing, load gauges)
 * or a heat pump panel (COP, SPF, flow temp regime, defrost).
 * Cylinder data is shown when a stored DHW system is active.
 */

import type { SystemConfig } from './explorerTypes';

interface Props {
  systemConfig: SystemConfig;
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

function BoilerPanel({ systemConfig, onClose }: Props) {
  const { heatSource, accentColor } = systemConfig;
  const outputKw     = heatSource.outputKw     ?? 24;
  const currentLoadKw = heatSource.currentLoadKw ?? 14;
  const returnTempC  = heatSource.returnTempC  ?? 65;
  const efficiencyPct = heatSource.efficiencyPct ?? 88;
  const condensing   = heatSource.condensing   ?? false;

  const loadPct  = Math.round((currentLoadKw / outputKw) * 100);
  const effTone  = efficiencyPct >= 92 ? 'success' : efficiencyPct >= 85 ? 'warning' : 'danger';
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

      <div className="hs-panel__section">
        <h3 className="hs-panel__section-title">Raw engine output</h3>
        <pre className="hs-panel__raw">{JSON.stringify({
          outputKw, currentLoadKw, returnTempC, condensing, efficiencyPct,
        }, null, 2)}</pre>
      </div>
    </div>
  );
}

// ── Heat pump panel ───────────────────────────────────────────────────────────

function HeatPumpPanel({ systemConfig, onClose }: Props) {
  const { heatSource, accentColor, primaryDiameterMm } = systemConfig;
  const ratedKw  = heatSource.ratedOutputKw  ?? 7;
  const loadKw   = heatSource.currentLoadKw  ?? 4.5;
  const cop      = heatSource.cop            ?? 2.8;
  const spf      = heatSource.spf            ?? 2.5;
  const flowTemp = heatSource.flowTempC      ?? 45;
  const regime   = heatSource.flowTempRegime ?? '45C';
  const outdoorT = heatSource.outdoorTempC   ?? 7;

  const loadPct  = Math.round((loadKw / ratedKw) * 100);
  const copTone  = cop >= 3.5 ? 'success' : cop >= 2.5 ? 'warning' : 'danger';
  const spfTone  = spf >= 3.0 ? 'success' : spf >= 2.5 ? 'warning' : 'danger';
  const regimeTone = regime === '35C' ? 'success' : regime === '45C' ? 'warning' : 'danger';
  const pipeTone = primaryDiameterMm >= 28 ? 'success' : 'danger';

  const regimeLabel: Record<string, string> = {
    '35C': '35°C — full emitter upgrade (optimal)',
    '45C': '45°C — oversized radiators (fast-fit)',
    '50C': '50°C — minimal emitter change (poor SPF)',
  };

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

      {/* Load gauges */}
      <div className="hs-panel__section">
        <h3 className="hs-panel__section-title">Current output</h3>
        <GaugeBand label="Rated output"   value={ratedKw} max={ratedKw} color="#cbd5e0" />
        <GaugeBand label="Current output" value={loadKw}  max={ratedKw} color={accentColor} />
        <div className="hs-panel__load-pct">{loadPct}% of rated capacity</div>
      </div>

      {/* Performance chips */}
      <div className="hs-panel__chips">
        <Chip label="Design COP"       value={`${cop}`}                tone={copTone}    />
        <Chip label="Seasonal SPF"     value={`${spf}`}                tone={spfTone}    />
        <Chip label="Outdoor temp"     value={`${outdoorT}°C`}         tone="neutral"    />
        <Chip label="Flow temp"        value={`${flowTemp}°C`}          tone={regimeTone} />
        <Chip label="Flow temp regime" value={regimeLabel[regime]}      tone={regimeTone} />
        <Chip label="Primary pipe"     value={`${primaryDiameterMm}mm`} tone={pipeTone}  />
      </div>

      {regime !== '35C' && (
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

      <div className="hs-panel__section">
        <h3 className="hs-panel__section-title">COP model (raw)</h3>
        <pre className="hs-panel__raw">{JSON.stringify({
          ratedOutputKw: ratedKw,
          currentLoadKw: loadKw,
          cop, spf,
          flowTempC: flowTemp,
          outdoorTempC: outdoorT,
          regime,
        }, null, 2)}</pre>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function HeatSourcePanel({ systemConfig, onClose }: Props) {
  if (systemConfig.heatSource.isHeatPump) {
    return <HeatPumpPanel systemConfig={systemConfig} onClose={onClose} />;
  }
  return <BoilerPanel systemConfig={systemConfig} onClose={onClose} />;
}
