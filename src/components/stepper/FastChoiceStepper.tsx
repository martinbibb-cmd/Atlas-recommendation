import { useState } from 'react';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import { runRedFlagModule } from '../../engine/modules/RedFlagModule';
import type { RedFlagResult } from '../../engine/schema/EngineInputV2_3';

interface Props {
  onBack: () => void;
}

type Step = 'bathrooms' | 'loft' | 'pipework' | 'results';

const defaultInput: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.0,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: false,
};

const STEPS: Step[] = ['bathrooms', 'loft', 'pipework', 'results'];

export default function FastChoiceStepper({ onBack }: Props) {
  const [currentStep, setCurrentStep] = useState<Step>('bathrooms');
  const [input, setInput] = useState<EngineInputV2_3>(defaultInput);
  const [results, setResults] = useState<RedFlagResult | null>(null);

  const stepIndex = STEPS.indexOf(currentStep);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const next = () => {
    if (currentStep === 'pipework') {
      setResults(runRedFlagModule(input));
      setCurrentStep('results');
    } else {
      const idx = STEPS.indexOf(currentStep);
      setCurrentStep(STEPS[idx + 1]);
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

      {currentStep === 'bathrooms' && (
        <div className="step-card">
          <h2>⚡ Bathrooms &amp; Occupancy</h2>
          <p className="description">
            The number of bathrooms and household size is the single biggest determinant
            of whether a combi boiler can meet your hot water demand.
          </p>
          <div className="form-grid">
            <div className="form-field">
              <label>Number of Bathrooms</label>
              <select
                value={input.bathroomCount}
                onChange={e => setInput({ ...input, bathroomCount: +e.target.value })}
              >
                <option value={1}>1 bathroom</option>
                <option value={2}>2 bathrooms</option>
                <option value={3}>3 bathrooms</option>
                <option value={4}>4+ bathrooms</option>
              </select>
            </div>
            <div className="form-field">
              <label>Household Size</label>
              <select
                value={input.highOccupancy ? 'high' : 'normal'}
                onChange={e => setInput({ ...input, highOccupancy: e.target.value === 'high' })}
              >
                <option value="normal">1–3 people (normal)</option>
                <option value="high">4+ people (high occupancy)</option>
              </select>
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

      {currentStep === 'loft' && (
        <div className="step-card">
          <h2>🏠 Loft &amp; Roof Space</h2>
          <p className="description">
            A vented heating system requires a gravity-fed cold water storage tank
            and an F&amp;E (feed &amp; expansion) tank in the loft. Loft conversions eliminate
            this space and the gravity "head" needed for circulation.
          </p>
          <div className="form-grid">
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={input.hasLoftConversion}
                onChange={e => setInput({ ...input, hasLoftConversion: e.target.checked })}
              />
              <span>I have a loft conversion</span>
            </label>
          </div>
          <div className="step-actions">
            <button className="prev-btn" onClick={prev}>← Back</button>
            <button className="next-btn" onClick={next}>Next →</button>
          </div>
        </div>
      )}

      {currentStep === 'pipework' && (
        <div className="step-card">
          <h2>🔧 Pipework &amp; Heat Loss</h2>
          <p className="description">
            The diameter of your primary pipework determines the maximum safe flow rate.
            Heat pumps run at a low temperature difference (ΔT), requiring much higher
            flow rates than conventional boilers.
          </p>
          <div className="form-grid">
            <div className="form-field">
              <label>Primary Pipe Diameter</label>
              <select
                value={input.primaryPipeDiameter}
                onChange={e => setInput({ ...input, primaryPipeDiameter: +e.target.value })}
              >
                <option value={15}>15mm (very small)</option>
                <option value={22}>22mm (standard)</option>
                <option value={28}>28mm (large bore)</option>
              </select>
            </div>
            <div className="form-field">
              <label>Estimated Heat Loss (kW)</label>
              <select
                value={input.heatLossWatts}
                onChange={e => setInput({ ...input, heatLossWatts: +e.target.value })}
              >
                <option value={5000}>5 kW (small flat)</option>
                <option value={8000}>8 kW (small house)</option>
                <option value={10000}>10 kW (medium house)</option>
                <option value={15000}>15 kW (large house)</option>
                <option value={20000}>20 kW (very large)</option>
              </select>
            </div>
          </div>
          <div className="step-actions">
            <button className="prev-btn" onClick={prev}>← Back</button>
            <button className="next-btn" onClick={next}>See Results →</button>
          </div>
        </div>
      )}

      {currentStep === 'results' && results && (
        <FastChoiceResults results={results} input={input} onBack={onBack} />
      )}
    </div>
  );
}

function FastChoiceResults({
  results,
  onBack,
}: {
  results: RedFlagResult;
  input: EngineInputV2_3;
  onBack: () => void;
}) {
  const hasFlags = results.reasons.length > 0;

  return (
    <div className="results-container">
      <div className="result-section">
        <h3>⚡ Fast Choice Results</h3>

        <div className="verdict-grid">
          <div className={`verdict-item ${results.rejectCombi ? 'rejected' : 'approved'}`}>
            <div className="verdict-icon">🔥</div>
            <div className="verdict-label">Combi Boiler</div>
            <div className="verdict-status">
              {results.rejectCombi ? '❌ Rejected' : '✅ Eligible'}
            </div>
          </div>
          <div className={`verdict-item ${results.rejectVented ? 'rejected' : 'approved'}`}>
            <div className="verdict-icon">💧</div>
            <div className="verdict-label">Vented System</div>
            <div className="verdict-status">
              {results.rejectVented ? '❌ Rejected' : '✅ Eligible'}
            </div>
          </div>
          <div className={`verdict-item ${results.flagAshp ? 'flagged' : 'approved'}`}>
            <div className="verdict-icon">🌿</div>
            <div className="verdict-label">Heat Pump</div>
            <div className="verdict-status">
              {results.flagAshp ? '⚠️ Flagged' : '✅ Eligible'}
            </div>
          </div>
        </div>
      </div>

      {hasFlags && (
        <div className="result-section">
          <h3>🚩 Red Flags Detected</h3>
          <ul className="red-flag-list">
            {results.reasons.map((r, i) => (
              <li key={i} className={r.includes('Rejected') || r.includes('Cut-off') ? 'reject' : 'flag'}>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasFlags && (
        <div className="result-section">
          <p style={{ color: '#276749', fontWeight: 600, padding: '0.5rem' }}>
            ✅ No red flags detected. All heating system types are physically viable for your home.
            Consider running the Full Survey for a detailed specification.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button className="prev-btn" onClick={onBack}>← New Search</button>
      </div>
    </div>
  );
}
