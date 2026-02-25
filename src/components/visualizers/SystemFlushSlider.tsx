/**
 * SystemFlushSlider
 *
 * Interactive visualiser for the "System Cleaning" scenario.
 * Linked to the PredictiveMaintenanceModule's efficiency decay model.
 *
 * Dragging the slider simulates the effect of a power-flush / filter service:
 * it "resets" the magnetite and scale accumulation and shows the user the
 * £/year benefit of carrying out the maintenance.
 *
 * The efficiency recovery calculation follows the same scale/magnetite model
 * used by PredictiveMaintenanceModule.
 */
import { useState } from 'react';

interface Props {
  /** Current boiler efficiency percentage (post-sludge/scale decay) */
  currentEfficiencyPct: number;
  /** Nominal (as-installed) boiler efficiency percentage — required; caller supplies ?? 92 fallback */
  nominalEfficiencyPct: number;
  /** Annual gas spend in GBP (used to compute £ saving) */
  annualGasSpendGbp?: number;
}

export default function SystemFlushSlider({
  currentEfficiencyPct,
  nominalEfficiencyPct,
  annualGasSpendGbp = 1200,
}: Props) {
  // 0 = no service, 100 = full power-flush + inhibitor dose + filter clean
  const [maintenanceLevel, setMaintenanceLevel] = useState(0);

  // Linear interpolation: 0% maintenance = current, 100% = nominal
  const restoredEfficiency =
    currentEfficiencyPct + (maintenanceLevel / 100) * (nominalEfficiencyPct - currentEfficiencyPct);

  // Financial benefit: efficiency gain × annual gas spend
  const efficiencyGain = restoredEfficiency - currentEfficiencyPct;
  const annualSaving = (efficiencyGain / 100) * annualGasSpendGbp;

  const barColor =
    maintenanceLevel < 33 ? '#fc8181' : maintenanceLevel < 66 ? '#f6ad55' : '#68d391';

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: '0.82rem', color: '#4a5568', fontWeight: 600 }}>
          System Flush / Filter Service
        </span>
        <span style={{ fontSize: '0.82rem', color: '#276749', fontWeight: 700 }}>
          {maintenanceLevel === 0 ? 'No service' :
           maintenanceLevel < 50 ? 'Filter clean + dose' :
           'Full power-flush'}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={maintenanceLevel}
        onChange={e => setMaintenanceLevel(+e.target.value)}
        style={{ width: '100%', cursor: 'pointer' }}
        aria-label="Maintenance level slider"
      />

      <div style={{ display: 'flex', gap: '1rem', marginTop: 12, flexWrap: 'wrap' }}>
        <div style={{
          flex: 1, minWidth: 120,
          background: '#fff5f5', border: '1.5px solid #fed7d7',
          borderRadius: 8, padding: '8px 12px',
        }}>
          <div style={{ fontSize: '0.72rem', color: '#9b2c2c' }}>Current efficiency</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#c53030' }}>
            {currentEfficiencyPct.toFixed(1)}%
          </div>
        </div>

        <div style={{
          flex: 1, minWidth: 120,
          background: '#f0fff4', border: `1.5px solid ${barColor}`,
          borderRadius: 8, padding: '8px 12px',
        }}>
          <div style={{ fontSize: '0.72rem', color: '#276749' }}>After service</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#276749' }}>
            {restoredEfficiency.toFixed(1)}%
          </div>
        </div>

        <div style={{
          flex: 1, minWidth: 120,
          background: '#ebf8ff', border: '1.5px solid #90cdf4',
          borderRadius: 8, padding: '8px 12px',
        }}>
          <div style={{ fontSize: '0.72rem', color: '#2c5282' }}>Annual saving</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#2c5282' }}>
            £{annualSaving.toFixed(0)}/yr
          </div>
        </div>
      </div>

      {maintenanceLevel === 100 && (
        <p style={{
          marginTop: 10, padding: '6px 10px',
          background: '#f0fff4', borderRadius: 6,
          fontSize: '0.78rem', color: '#276749',
        }}>
          ✅ Full power-flush restores efficiency to {nominalEfficiencyPct}% and saves
          approximately £{annualSaving.toFixed(0)} per year on gas bills.
        </p>
      )}
    </div>
  );
}
