import { useState } from 'react';
import type { EngineInputV2_3, FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import { runEngine } from '../../engine/Engine';
import InteractiveComfortClock from '../visualizers/InteractiveComfortClock';
import LifestyleInteractive from '../visualizers/LifestyleInteractive';
import EfficiencyCurve from '../visualizers/EfficiencyCurve';
import FootprintXRay from '../visualizers/FootprintXRay';
import GlassBoxPanel from '../visualizers/GlassBoxPanel';
import InteractiveTwin from '../InteractiveTwin';
import { exportBomToCsv, calculateBomTotal } from '../../engine/modules/WholesalerPricingAdapter';

interface Props {
  onBack: () => void;
}

type Step = 'location' | 'building' | 'occupancy' | 'systems' | 'results';
const STEPS: Step[] = ['location', 'building', 'occupancy', 'systems', 'results'];

const defaultInput: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.0,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 2,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: false,
};

export default function FullSurveyStepper({ onBack }: Props) {
  const [currentStep, setCurrentStep] = useState<Step>('location');
  const [input, setInput] = useState<EngineInputV2_3>(defaultInput);
  const [results, setResults] = useState<FullEngineResult | null>(null);

  const stepIndex = STEPS.indexOf(currentStep);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const next = () => {
    if (currentStep === 'systems') {
      setResults(runEngine(input));
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

  return (
    <div className="stepper-container">
      <div className="stepper-header">
        <button className="back-btn" onClick={prev}>← Back</button>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="step-label">Step {stepIndex + 1} of {STEPS.length}</span>
      </div>

      {currentStep === 'location' && (
        <div className="step-card">
          <h2>📍 Location &amp; Water Quality</h2>
          <p className="description">
            Your postcode determines water hardness and silicate levels, which drive
            the 10-year "Silicate Tax" efficiency decay curve.
          </p>
          <div className="form-grid">
            <div className="form-field">
              <label>Postcode</label>
              <input
                type="text"
                value={input.postcode}
                onChange={e => setInput({ ...input, postcode: e.target.value.toUpperCase() })}
                placeholder="e.g. SW1A 1AA"
              />
            </div>
            <div className="form-field">
              <label>Dynamic Mains Pressure (bar)</label>
              <input
                type="number"
                min={0.5}
                max={6}
                step={0.5}
                value={input.dynamicMainsPressure}
                onChange={e => setInput({ ...input, dynamicMainsPressure: +e.target.value })}
              />
            </div>
          </div>
          <div className="step-actions">
            <button className="next-btn" onClick={next}>Next →</button>
          </div>
        </div>
      )}

      {currentStep === 'building' && (
        <div className="step-card">
          <h2>🏗️ Building Characteristics</h2>
          <p className="description">
            Building mass determines thermal inertia (τ) – how long the structure retains heat.
            Heavy buildings are excellent thermal batteries for heat pump "low and slow" operation.
          </p>
          <div className="form-grid">
            <div className="form-field">
              <label>Building Mass</label>
              <select
                value={input.buildingMass}
                onChange={e => setInput({ ...input, buildingMass: e.target.value as EngineInputV2_3['buildingMass'] })}
              >
                <option value="light">Light (timber frame, modern)</option>
                <option value="medium">Medium (standard brick cavity)</option>
                <option value="heavy">Heavy (solid stone/Victorian brick)</option>
              </select>
            </div>
            <div className="form-field">
              <label>Primary Pipe Diameter (mm)</label>
              <select
                value={input.primaryPipeDiameter}
                onChange={e => setInput({ ...input, primaryPipeDiameter: +e.target.value })}
              >
                <option value={15}>15mm</option>
                <option value={22}>22mm (standard)</option>
                <option value={28}>28mm (large bore)</option>
              </select>
            </div>
            <div className="form-field">
              <label>Heat Loss (kW)</label>
              <input
                type="number"
                min={2}
                max={40}
                step={0.5}
                value={input.heatLossWatts / 1000}
                onChange={e => setInput({ ...input, heatLossWatts: +e.target.value * 1000 })}
              />
            </div>
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
          </div>
          <div className="step-actions">
            <button className="prev-btn" onClick={prev}>← Back</button>
            <button className="next-btn" onClick={next}>Next →</button>
          </div>
        </div>
      )}

      {currentStep === 'occupancy' && (
        <div className="step-card">
          <h2>👥 Occupancy Profile</h2>
          <p className="description">
            Your lifestyle pattern determines which heating technology wins. A professional's
            sharp morning/evening peaks suit a fast-response boiler. Continuous occupancy
            suits a heat pump's steady "horizon" line.
          </p>
          <div className="form-grid">
            <div className="form-field">
              <label>Occupancy Signature</label>
              <select
                value={input.occupancySignature}
                onChange={e => setInput({ ...input, occupancySignature: e.target.value as EngineInputV2_3['occupancySignature'] })}
              >
                <option value="professional">Professional (double peak: morning + evening)</option>
                <option value="steady_home">Steady Home (retired / family, continuous)</option>
                <option value="shift_worker">Shift Worker (irregular, offset peaks)</option>
              </select>
            </div>
            <div className="form-field">
              <label>Bathrooms</label>
              <select
                value={input.bathroomCount}
                onChange={e => setInput({ ...input, bathroomCount: +e.target.value })}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4+</option>
              </select>
            </div>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={input.highOccupancy}
                onChange={e => setInput({ ...input, highOccupancy: e.target.checked })}
              />
              <span>High occupancy (4+ people)</span>
            </label>
          </div>
          <div className="step-actions">
            <button className="prev-btn" onClick={prev}>← Back</button>
            <button className="next-btn" onClick={next}>Next →</button>
          </div>
        </div>
      )}

      {currentStep === 'systems' && (
        <div className="step-card">
          <h2>⚙️ Current System</h2>
          <p className="description">
            Tell us about any existing system preferences or constraints.
          </p>
          <div className="form-grid">
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={input.preferCombi}
                onChange={e => setInput({ ...input, preferCombi: e.target.checked })}
              />
              <span>I prefer a combination boiler</span>
            </label>
          </div>
          <div className="step-actions">
            <button className="prev-btn" onClick={prev}>← Back</button>
            <button className="next-btn" onClick={next}>Run Analysis →</button>
          </div>
        </div>
      )}

      {currentStep === 'results' && results && (
        <FullSurveyResults results={results} onBack={onBack} />
      )}
    </div>
  );
}

function FullSurveyResults({
  results,
  onBack,
}: {
  results: FullEngineResult;
  onBack: () => void;
}) {
  const { hydraulic, combiStress, mixergy, lifestyle, normalizer, redFlags, bomItems } = results;
  const [showTwin, setShowTwin] = useState(false);

  // Approximate current efficiency from normalizer decay
  const currentEfficiencyPct = Math.max(50, 92 - normalizer.tenYearEfficiencyDecayPct);
  const bomTotal = calculateBomTotal(bomItems);

  const handleExportCsv = () => {
    const csv = exportBomToCsv(bomItems);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'atlas-bom.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (showTwin) {
    return (
      <InteractiveTwin
        mixergy={mixergy}
        currentEfficiencyPct={currentEfficiencyPct}
        onBack={() => setShowTwin(false)}
      />
    );
  }

  return (
    <div className="results-container">

      {/* Red Flags */}
      <div className="result-section">
        <h3>🚩 System Eligibility</h3>
        <div className="verdict-grid">
          <div className={`verdict-item ${redFlags.rejectCombi ? 'rejected' : 'approved'}`}>
            <div className="verdict-icon">🔥</div>
            <div className="verdict-label">Combi</div>
            <div className="verdict-status">{redFlags.rejectCombi ? '❌ Rejected' : '✅ Viable'}</div>
          </div>
          <div className={`verdict-item ${redFlags.rejectVented ? 'rejected' : 'approved'}`}>
            <div className="verdict-icon">💧</div>
            <div className="verdict-label">Vented</div>
            <div className="verdict-status">{redFlags.rejectVented ? '❌ Rejected' : '✅ Viable'}</div>
          </div>
          <div className={`verdict-item ${redFlags.rejectAshp ? 'rejected' : redFlags.flagAshp ? 'flagged' : 'approved'}`}>
            <div className="verdict-icon">🌿</div>
            <div className="verdict-label">ASHP</div>
            <div className="verdict-status">{redFlags.rejectAshp ? '❌ Rejected' : redFlags.flagAshp ? '⚠️ Flagged' : '✅ Viable'}</div>
          </div>
        </div>
        {redFlags.reasons.length > 0 && (
          <ul className="red-flag-list" style={{ marginTop: '1rem' }}>
            {redFlags.reasons.map((r, i) => (
              <li key={i} className={r.includes('Rejected') || r.includes('Hard Fail') || r.includes('Cut-off') ? 'reject' : 'flag'}>{r}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Lifestyle Recommendation */}
      <div className="result-section">
        <h3>👥 Lifestyle Recommendation</h3>
        <div className={`recommendation-banner ${lifestyle.recommendedSystem}`}>
          {lifestyle.notes[0]}
        </div>
        <div style={{ marginTop: '1rem' }}>
          <h4 style={{ marginBottom: '0.75rem', fontSize: '0.95rem', color: '#4a5568' }}>
            🎨 Paint Your Day – Interactive Comfort Clock
          </h4>
          <InteractiveComfortClock heatLossKw={results.hydraulic.flowRateLs * 1000 / 100 || 8} />
        </div>
      </div>

      {/* Lifestyle Interactive – Day Painter Sales Closer */}
      <div className="result-section">
        <h3>🏠 Day Painter – Domestic Thermal Simulator</h3>
        <p className="description" style={{ marginBottom: '0.75rem' }}>
          Paint your 24-hour routine and watch three live curves react: the Boiler "Stepped" sprint,
          the Heat Pump "Horizon" stability line (SPF-driven), and the Mixergy Hot Water Battery
          State of Charge. Toggle <strong>Full Job</strong>, <strong>Power Shower</strong>, and{' '}
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

      {/* Combi Efficiency */}
      <div className="result-section">
        <h3>📉 Combi Efficiency Analysis</h3>
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
      </div>

      {/* Mixergy Volumetrics */}
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

      {/* Bill of Materials */}
      <div className="result-section">
        <h3>📋 Bill of Materials</h3>
        <table className="bom-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Model</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Line Total</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {bomItems.map((item, i) => (
              <tr key={i}>
                <td>{item.name}</td>
                <td>{item.model}</td>
                <td>{item.quantity}</td>
                <td style={{ textAlign: 'right' }}>
                  {item.unitPriceGbp !== undefined ? `£${item.unitPriceGbp.toFixed(2)}` : '—'}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                  {item.unitPriceGbp !== undefined
                    ? `£${(item.unitPriceGbp * item.quantity).toFixed(2)}`
                    : '—'}
                </td>
                <td style={{ color: '#718096', fontSize: '0.85rem' }}>{item.notes}</td>
              </tr>
            ))}
            {bomTotal > 0 && (
              <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f7fafc' }}>
                <td colSpan={4} style={{ fontWeight: 700, textAlign: 'right', padding: '8px' }}>
                  Estimated Trade Total (ex-VAT):
                </td>
                <td style={{ fontWeight: 800, color: '#2c5282', padding: '8px' }}>
                  £{bomTotal.toFixed(2)}
                </td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="next-btn" onClick={handleExportCsv} style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
            ⬇ Export BOM to CSV
          </button>
        </div>
        <p style={{ fontSize: '0.72rem', color: '#a0aec0', marginTop: '0.5rem' }}>
          Prices are indicative trade (ex-VAT) from Wolseley/City Plumbing catalogue.
        </p>
      </div>

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
