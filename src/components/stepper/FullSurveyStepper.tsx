import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { EngineInputV2_3, FullEngineResult, BuildingFabricType } from '../../engine/schema/EngineInputV2_3';
import { runEngine } from '../../engine/Engine';
import { runThermalInertiaModule } from '../../engine/modules/ThermalInertiaModule';
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

type Step = 'location' | 'hydraulic' | 'lifestyle' | 'commercial' | 'results';
const STEPS: Step[] = ['location', 'hydraulic', 'lifestyle', 'commercial', 'results'];

// Property archetype configuration: maps fabric type to display label, τ, and building mass
const ARCHETYPES: Array<{
  fabricType: BuildingFabricType;
  label: string;
  era: string;
  tauHours: number;
  buildingMass: EngineInputV2_3['buildingMass'];
  description: string;
  emoji: string;
}> = [
  {
    fabricType: 'solid_brick_1930s',
    label: '1930s Solid Brick Semi',
    era: 'Pre-war',
    tauHours: 55,
    buildingMass: 'heavy',
    description: '225mm solid brick walls. High thermal mass – slow to heat, but retains warmth all day.',
    emoji: '🏚️',
  },
  {
    fabricType: '1970s_cavity_wall',
    label: '1970s Cavity Wall',
    era: '1970s',
    tauHours: 35,
    buildingMass: 'medium',
    description: 'Cavity wall with partial-fill insulation. Medium thermal storage – moderate response.',
    emoji: '🏠',
  },
  {
    fabricType: 'lightweight_new',
    label: '2020s New Build',
    era: 'Modern',
    tauHours: 15,
    buildingMass: 'light',
    description: 'Timber frame / lightweight block. Low thermal mass – fast response but rapid cooling.',
    emoji: '🏡',
  },
  {
    fabricType: 'passivhaus_standard',
    label: 'Passivhaus',
    era: 'Super-insulated',
    tauHours: 190.5,
    buildingMass: 'light',
    description: 'Super-insulated certified build. Exceptional thermal retention – ideal for heat pumps.',
    emoji: '🌿',
  },
];

const defaultInput: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.0,
  buildingMass: 'heavy',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 2,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: false,
  hasMagneticFilter: false,
  installationPolicy: 'full_job',
  dhwTankType: 'standard',
  installerNetwork: 'british_gas',
};

export default function FullSurveyStepper({ onBack }: Props) {
  const [currentStep, setCurrentStep] = useState<Step>('location');
  const [input, setInput] = useState<EngineInputV2_3>(defaultInput);
  const [fabricType, setFabricType] = useState<BuildingFabricType>('solid_brick_1930s');
  const [compareMixergy, setCompareMixergy] = useState(false);
  const [results, setResults] = useState<FullEngineResult | null>(null);

  const stepIndex = STEPS.indexOf(currentStep);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const next = () => {
    if (currentStep === 'commercial') {
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

  const selectedArchetype = ARCHETYPES.find(a => a.fabricType === fabricType) ?? ARCHETYPES[0];

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
          <h2>📍 Step 1: Geochemical &amp; Property Baseline</h2>
          <p className="description">
            Your postcode anchors the simulation to local water chemistry. In Sherborne (DT9),
            hardness reaches 364 ppm, triggering silicate-scaffolded scale modelling.
            Your property archetype sets the Thermal Time Constant (τ).
          </p>

          <div className="form-grid">
            <div className="form-field">
              <label>Postcode</label>
              <input
                type="text"
                value={input.postcode}
                onChange={e => setInput({ ...input, postcode: e.target.value.toUpperCase() })}
                placeholder="e.g. BH1 1AA or DT9 3AQ"
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

          <div style={{ marginTop: '1.5rem' }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.75rem' }}>
              Property Archetype
            </label>
            <p style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '0.75rem' }}>
              Select your property type to automatically assign the Thermal Time Constant (τ).
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {ARCHETYPES.map(arch => (
                <button
                  key={arch.fabricType}
                  onClick={() => {
                    setFabricType(arch.fabricType);
                    setInput({ ...input, buildingMass: arch.buildingMass });
                  }}
                  style={{
                    padding: '0.875rem',
                    border: `2px solid ${fabricType === arch.fabricType ? '#3182ce' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    background: fabricType === arch.fabricType ? '#ebf8ff' : '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{arch.emoji}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.125rem' }}>{arch.label}</div>
                  <div style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '0.5rem' }}>{arch.era}</div>
                  <div style={{
                    display: 'inline-block',
                    background: fabricType === arch.fabricType ? '#3182ce' : '#edf2f7',
                    color: fabricType === arch.fabricType ? '#fff' : '#4a5568',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}>
                    τ = {arch.tauHours}h
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.375rem', lineHeight: 1.3 }}>
                    {arch.description}
                  </div>
                </button>
              ))}
            </div>
            {fabricType && (
              <div style={{
                marginTop: '0.75rem',
                padding: '0.75rem',
                background: '#f0fff4',
                border: '1px solid #9ae6b4',
                borderRadius: '6px',
                fontSize: '0.85rem',
                color: '#276749',
              }}>
                ✅ <strong>{selectedArchetype.label}</strong> selected — Thermal Time Constant τ = {selectedArchetype.tauHours} hours preset.
              </div>
            )}
          </div>

          <div className="step-actions">
            <button className="next-btn" onClick={next}>Next →</button>
          </div>
        </div>
      )}

      {currentStep === 'hydraulic' && (
        <div className="step-card">
          <h2>🔧 Step 2: Hydraulic Integrity &amp; System Health</h2>
          <p className="description">
            These data points power the British Gas HomeCare ROI calculation by identifying
            existing system bottlenecks. A 15mm primary pipe flags "High Velocity Noise Risk"
            for heat pumps. No magnetic filter applies a "Sludge Tax" (47% radiator output reduction).
          </p>
          <div className="form-grid">
            <div className="form-field">
              <label>Primary Pipe Diameter (mm)</label>
              <select
                value={input.primaryPipeDiameter}
                onChange={e => setInput({ ...input, primaryPipeDiameter: +e.target.value })}
              >
                <option value={15}>15mm ⚠️ High Velocity Noise Risk for heat pumps</option>
                <option value={22}>22mm (standard)</option>
                <option value={28}>28mm (large bore – required for 19 kW+)</option>
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
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>🧲 Magnetic Filter (Sludge Guard)</label>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setInput({ ...input, hasMagneticFilter: true })}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    border: `2px solid ${input.hasMagneticFilter ? '#38a169' : '#e2e8f0'}`,
                    borderRadius: '6px',
                    background: input.hasMagneticFilter ? '#f0fff4' : '#fff',
                    cursor: 'pointer',
                    fontWeight: input.hasMagneticFilter ? 700 : 400,
                  }}
                >
                  ✅ Fitted – magnetite sludge captured
                </button>
                <button
                  onClick={() => setInput({ ...input, hasMagneticFilter: false })}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    border: `2px solid ${!input.hasMagneticFilter ? '#c53030' : '#e2e8f0'}`,
                    borderRadius: '6px',
                    background: !input.hasMagneticFilter ? '#fff5f5' : '#fff',
                    cursor: 'pointer',
                    fontWeight: !input.hasMagneticFilter ? 700 : 400,
                  }}
                >
                  ❌ Not fitted – Sludge Tax applies (47% radiator loss)
                </button>
              </div>
            </div>
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>Current Heat Source</label>
              <select
                value={input.currentHeatSourceType ?? 'other'}
                onChange={e => setInput({ ...input, currentHeatSourceType: e.target.value as EngineInputV2_3['currentHeatSourceType'] })}
              >
                <option value="combi">Combi Boiler</option>
                <option value="system">System Boiler</option>
                <option value="regular">Regular / Heat-only Boiler</option>
                <option value="ashp">Air Source Heat Pump</option>
                <option value="other">Other / Unknown</option>
              </select>
            </div>
            <div className="form-field">
              <label>Current Boiler Age (years)</label>
              <input
                type="number"
                min={0}
                max={40}
                value={input.currentBoilerAgeYears ?? ''}
                onChange={e => setInput({ ...input, currentBoilerAgeYears: e.target.value ? +e.target.value : undefined })}
                placeholder="e.g. 8"
              />
            </div>
            <div className="form-field">
              <label>Current Boiler Output (kW, optional)</label>
              <input
                type="number"
                min={1}
                max={60}
                step={0.5}
                value={input.currentBoilerOutputKw ?? ''}
                onChange={e => setInput({ ...input, currentBoilerOutputKw: e.target.value ? +e.target.value : undefined })}
                placeholder="e.g. 24"
              />
            </div>
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>Current Boiler Make / Model (optional)</label>
              <input
                type="text"
                value={input.makeModelText ?? ''}
                onChange={e => setInput({ ...input, makeModelText: e.target.value || undefined })}
                placeholder="e.g. Worcester Greenstar 30i"
              />
            </div>
            <details style={{ gridColumn: '1 / -1', marginTop: '0.25rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#4a5568' }}>Advanced (Engineer): Heat Exchanger Metallurgy</summary>
              <div className="form-field" style={{ marginTop: '0.75rem' }}>
                <label>Heat Exchanger Material Preference</label>
                <select
                  value={input.preferredMetallurgy ?? 'auto'}
                  onChange={e => setInput({ ...input, preferredMetallurgy: e.target.value as EngineInputV2_3['preferredMetallurgy'] })}
                >
                  <option value="auto">Auto (engine recommendation)</option>
                  <option value="al_si">Al-Si (e.g. WB 8000+ style)</option>
                  <option value="stainless_steel">Stainless steel</option>
                </select>
                {input.preferredMetallurgy === 'al_si' && (
                  <p style={{ fontSize: '0.8rem', color: '#2b6cb0', marginTop: '0.375rem' }}>
                    ℹ️ Al-Si selection keeps WB softener-edge analysis visible where relevant.
                  </p>
                )}
              </div>
            </details>
          </div>
          <div className="step-actions">
            <button className="prev-btn" onClick={prev}>← Back</button>
            <button className="next-btn" onClick={next}>Next →</button>
          </div>
        </div>
      )}

      {currentStep === 'lifestyle' && (
        <LifestyleComfortStep
          input={input}
          fabricType={fabricType}
          selectedArchetype={selectedArchetype}
          setInput={setInput}
          onNext={next}
          onPrev={prev}
        />
      )}

      {currentStep === 'commercial' && (
        <div className="step-card">
          <h2>💼 Step 4: Commercial Strategy Selection</h2>
          <p className="description">
            Choose your installation strategy to model the British Gas "Full Job" advantage.
            A Full Job designs flow temperatures of 35–40°C, delivering SPF 3.8–4.4.
            Adding a Mixergy Hot Water Battery unlocks a £40/year "Mixergy Extra" rebate
            (British Gas customers) and a 21% gas saving via active stratification.
          </p>
          <div className="form-grid">
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>🏗️ Installation Policy</label>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setInput({ ...input, installationPolicy: 'full_job' })}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    border: `2px solid ${input.installationPolicy === 'full_job' ? '#3182ce' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    background: input.installationPolicy === 'full_job' ? '#ebf8ff' : '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>✅ Full Job (British Gas)</div>
                  <div style={{ fontSize: '0.82rem', color: '#4a5568' }}>
                    New oversized Type 22 radiators · Design flow 35–40°C · SPF 3.8–4.4
                  </div>
                </button>
                <button
                  onClick={() => setInput({ ...input, installationPolicy: 'high_temp_retrofit' })}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    border: `2px solid ${input.installationPolicy === 'high_temp_retrofit' ? '#c53030' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    background: input.installationPolicy === 'high_temp_retrofit' ? '#fff5f5' : '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>⚡ Fast Fit (High Temp Retrofit)</div>
                  <div style={{ fontSize: '0.82rem', color: '#4a5568' }}>
                    Existing radiators retained · Design flow 50–55°C · SPF 2.9–3.1
                  </div>
                </button>
              </div>
            </div>
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label>💧 Hot Water Storage</label>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setInput({ ...input, dhwTankType: 'standard' })}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    border: `2px solid ${input.dhwTankType !== 'mixergy' ? '#3182ce' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    background: input.dhwTankType !== 'mixergy' ? '#ebf8ff' : '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>🫙 Standard Cylinder</div>
                  <div style={{ fontSize: '0.82rem', color: '#4a5568' }}>
                    Conventional stored hot water system
                  </div>
                </button>
                <button
                  onClick={() => setInput({ ...input, dhwTankType: 'mixergy' })}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    border: `2px solid ${input.dhwTankType === 'mixergy' ? '#805ad5' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    background: input.dhwTankType === 'mixergy' ? '#faf5ff' : '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>⚡ Mixergy Hot Water Battery</div>
                  <div style={{ fontSize: '0.82rem', color: '#4a5568' }}>
                    +21% gas saving · Active stratification · Top-down heating
                  </div>
                </button>
              </div>
              {input.dhwTankType === 'mixergy' && (
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{
                    padding: '0.625rem 0.875rem',
                    background: '#faf5ff',
                    border: '1px solid #d6bcfa',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    color: '#553c9a',
                  }}>
                    🎁 British Gas "Mixergy Extra" rebate: <strong>+£40/year</strong> for BG customers
                    via active stratification load-shifting.
                  </div>
                  <div className="form-field">
                    <label>Installer Network</label>
                    <select
                      value={input.installerNetwork ?? 'british_gas'}
                      onChange={e => setInput({ ...input, installerNetwork: e.target.value as EngineInputV2_3['installerNetwork'] })}
                    >
                      <option value="british_gas">British Gas (£40/yr Mixergy Extra rebate)</option>
                      <option value="independent">Independent Installer</option>
                    </select>
                  </div>
                </div>
              )}
              <label className="checkbox-field" style={{ marginTop: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={compareMixergy}
                  onChange={e => setCompareMixergy(e.target.checked)}
                />
                <span>Show Mixergy comparison in results (even if standard cylinder selected)</span>
              </label>
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
            <div className="form-field">
              <label>Peak concurrent hot-water outlets</label>
              <select
                value={input.peakConcurrentOutlets ?? 1}
                onChange={e => setInput({ ...input, peakConcurrentOutlets: +e.target.value })}
              >
                <option value={1}>1 (single shower / tap)</option>
                <option value={2}>2 (e.g. shower + basin)</option>
                <option value={3}>3+ (multiple simultaneous)</option>
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
            <div className="form-field">
              <label>Cylinder / airing-cupboard space</label>
              <select
                value={input.availableSpace ?? 'unknown'}
                onChange={e => setInput({ ...input, availableSpace: e.target.value as 'tight' | 'ok' | 'unknown' })}
              >
                <option value="ok">OK – adequate space available</option>
                <option value="tight">Tight – limited space</option>
                <option value="unknown">Unknown – not yet surveyed</option>
              </select>
            </div>
            <div className="form-field">
              <label>Bedrooms</label>
              <select
                value={input.bedrooms ?? ''}
                onChange={e => setInput({ ...input, bedrooms: e.target.value ? +e.target.value : undefined })}
              >
                <option value="">Not specified</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5+</option>
              </select>
            </div>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={input.futureLoftConversion ?? false}
                onChange={e => setInput({ ...input, futureLoftConversion: e.target.checked })}
              />
              <span>Loft conversion planned</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={input.futureAddBathroom ?? false}
                onChange={e => setInput({ ...input, futureAddBathroom: e.target.checked })}
              />
              <span>Additional bathroom planned</span>
            </label>
          </div>
          <div className="step-actions">
            <button className="prev-btn" onClick={prev}>← Back</button>
            <button className="next-btn" onClick={next}>Run Analysis →</button>
          </div>
        </div>
      )}

      {currentStep === 'results' && results && (
        <FullSurveyResults
          results={results}
          input={input}
          compareMixergy={compareMixergy}
          onBack={onBack}
        />
      )}
    </div>
  );
}

// ─── Step 3: Lifestyle & Thermal Comfort ─────────────────────────────────────

interface LifestyleStepProps {
  input: EngineInputV2_3;
  fabricType: BuildingFabricType;
  selectedArchetype: { label: string; tauHours: number; fabricType: BuildingFabricType };
  setInput: React.Dispatch<React.SetStateAction<EngineInputV2_3>>;
  onNext: () => void;
  onPrev: () => void;
}

function LifestyleComfortStep({ input, fabricType, selectedArchetype, setInput, onNext, onPrev }: LifestyleStepProps) {
  const thermalResult = useMemo(() => runThermalInertiaModule({
    fabricType,
    occupancyProfile: input.occupancySignature === 'steady_home' ? 'home_all_day' : 'professional',
    initialTempC: 20,
    outdoorTempC: 5,
  }), [fabricType, input.occupancySignature]);

  const dropWarning = thermalResult.totalDropC > 4;

  return (
    <div className="step-card">
      <h2>🏠 Step 3: Lifestyle &amp; Thermal Comfort</h2>
      <p className="description">
        Your occupancy pattern determines which heating technology wins.
        The exponential decay formula shows the predicted room temperature drop during
        your absence. A drop of more than 4°C in 8 hours triggers fabric improvement recommendations.
      </p>

      <div className="form-grid">
        <div className="form-field">
          <label>Occupancy Signature</label>
          <select
            value={input.occupancySignature}
            onChange={e => setInput({ ...input, occupancySignature: e.target.value as EngineInputV2_3['occupancySignature'] })}
          >
            <option value="professional">Professional (away 08:00–17:00)</option>
            <option value="steady_home">Steady Home (retired / family, continuous)</option>
            <option value="shift_worker">Shift Worker (irregular, offset peaks)</option>
          </select>
        </div>
      </div>

      {/* Thermal Comfort Physics */}
      <div style={{ marginTop: '1.25rem' }}>
        <h4 style={{ marginBottom: '0.5rem', fontSize: '0.95rem', color: '#4a5568' }}>
          🌡️ Comfort Physics – Predicted Temperature Decay
        </h4>
        <p style={{ fontSize: '0.82rem', color: '#718096', marginBottom: '0.75rem' }}>
          T(t) = T<sub>outdoor</sub> + (T<sub>initial</sub> − T<sub>outdoor</sub>) × e<sup>−t/τ</sup>
          &nbsp;— Building: <strong>{selectedArchetype.label}</strong> (τ = {selectedArchetype.tauHours}h)
        </p>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{
            padding: '0.625rem 0.875rem',
            background: '#f7fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            fontSize: '0.85rem',
          }}>
            <span style={{ color: '#718096' }}>Starting temp:</span> <strong>20°C</strong>
          </div>
          <div style={{
            padding: '0.625rem 0.875rem',
            background: '#f7fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            fontSize: '0.85rem',
          }}>
            <span style={{ color: '#718096' }}>Outdoor (design):</span> <strong>5°C</strong>
          </div>
          <div style={{
            padding: '0.625rem 0.875rem',
            background: '#f7fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            fontSize: '0.85rem',
          }}>
            <span style={{ color: '#718096' }}>After absence:</span>{' '}
            <strong style={{ color: dropWarning ? '#c53030' : '#276749' }}>
              {thermalResult.finalTempC}°C (↓{thermalResult.totalDropC}°C)
            </strong>
          </div>
        </div>

        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={thermalResult.trace} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#edf2f7" />
              <XAxis
                dataKey="hourOffset"
                tickFormatter={h => `+${h}h`}
                tick={{ fontSize: 11 }}
                label={{ value: 'Hours without heating', position: 'insideBottom', offset: -2, fontSize: 11 }}
              />
              <YAxis
                domain={[0, 22]}
                tick={{ fontSize: 11 }}
                tickFormatter={v => `${v}°C`}
              />
              <Tooltip formatter={(v: number | undefined) => [v !== undefined ? `${v}°C` : 'N/A', 'Room temp']} />
              <ReferenceLine y={16} stroke="#e53e3e" strokeDasharray="4 4" label={{ value: '16°C min', fontSize: 10, fill: '#e53e3e' }} />
              <ReferenceLine
                y={thermalResult.finalTempC}
                stroke={dropWarning ? '#c53030' : '#38a169'}
                strokeDasharray="3 3"
              />
              <Line
                type="monotone"
                dataKey="tempC"
                stroke="#3182ce"
                strokeWidth={2}
                dot={false}
                name="Room temperature"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {dropWarning && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.625rem 0.875rem',
            background: '#fff5f5',
            border: '1px solid #fed7d7',
            borderRadius: '6px',
            fontSize: '0.82rem',
            color: '#c53030',
          }}>
            ⚠️ Temperature drops <strong>{thermalResult.totalDropC}°C</strong> during absence (more than 4°C threshold).
            The report will recommend fabric improvements (insulation upgrades) to reduce the reheat penalty.
          </div>
        )}

        {!dropWarning && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.625rem 0.875rem',
            background: '#f0fff4',
            border: '1px solid #9ae6b4',
            borderRadius: '6px',
            fontSize: '0.82rem',
            color: '#276749',
          }}>
            ✅ Temperature drop of <strong>{thermalResult.totalDropC}°C</strong> is within the 4°C comfort threshold.
            The thermal mass retains heat well during the away period.
          </div>
        )}

        {thermalResult.notes.length > 0 && (
          <ul className="notes-list" style={{ marginTop: '0.75rem' }}>
            {thermalResult.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        )}
      </div>

      <div className="step-actions">
        <button className="prev-btn" onClick={onPrev}>← Back</button>
        <button className="next-btn" onClick={onNext}>Next →</button>
      </div>
    </div>
  );
}

const ELIGIBILITY_ICONS: Record<string, string> = { instant: '🔥', stored: '💧', ashp: '🌿' };

function FullSurveyResults({
  results,
  input,
  compareMixergy,
  onBack,
}: {
  results: FullEngineResult;
  input: EngineInputV2_3;
  compareMixergy: boolean;
  onBack: () => void;
}) {
  const { hydraulic, combiStress, mixergy, lifestyle, normalizer, bomItems, engineOutput } = results;
  const [showTwin, setShowTwin] = useState(false);
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null);
  const [activeOptionTab, setActiveOptionTab] = useState<Record<string, 'heat' | 'dhw' | 'needs'>>({});

  // Approximate current efficiency from normalizer decay
  const currentEfficiencyPct = Math.max(50, 92 - normalizer.tenYearEfficiencyDecayPct);
  const bomTotal = calculateBomTotal(bomItems);
  const shouldShowMixergy = input.dhwTankType === 'mixergy' || compareMixergy;

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

      {/* Your Situation – Context Summary */}
      {engineOutput.contextSummary && engineOutput.contextSummary.bullets.length > 0 && (
        <div className="result-section">
          <h3>🏠 Your Situation</h3>
          <ul className="context-summary-list">
            {engineOutput.contextSummary.bullets.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Your Options – Option Matrix V1 */}
      {engineOutput.options && engineOutput.options.length > 0 && (
        <div className="result-section">
          <h3>🔍 Your Options</h3>
          <div className="options-grid">
            {engineOutput.options.map(card => {
              const statusClass = card.status === 'rejected' ? 'rejected' : card.status === 'caution' ? 'caution' : 'viable';
              const statusLabel = card.status === 'rejected' ? '❌ Not suitable' : card.status === 'caution' ? '⚠️ Possible' : '✅ Suitable';
              const isExpanded = expandedOptionId === card.id;
              return (
                <div key={card.id} className={`option-card option-card--${statusClass}`}>
                  <div
                    className="option-card__header"
                    onClick={() => setExpandedOptionId(isExpanded ? null : card.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="option-card__title">
                      <span className="option-card__label">{card.label}</span>
                      <span className={`option-card__status option-card__status--${statusClass}`}>{statusLabel}</span>
                    </div>
                    <p className="option-card__headline">{card.headline}</p>
                    <span className="option-card__toggle">{isExpanded ? '▲ Less' : '▼ Details'}</span>
                  </div>
                  {isExpanded && (
                    <div className="option-card__body">
                      {/* Three-section tabs: Heat / Hot Water / What needs changing */}
                      {card.heat && card.dhw && card.engineering && card.typedRequirements && (() => {
                        const tab = activeOptionTab[card.id] ?? 'heat';
                        const setTab = (t: 'heat' | 'dhw' | 'needs') =>
                          setActiveOptionTab(prev => ({ ...prev, [card.id]: t }));
                        return (
                          <div className="option-card__tabs">
                            <div className="option-card__tab-bar">
                              <button
                                className={`option-card__tab-btn${tab === 'heat' ? ' option-card__tab-btn--active' : ''}`}
                                onClick={() => setTab('heat')}
                              >🔥 Heat</button>
                              <button
                                className={`option-card__tab-btn${tab === 'dhw' ? ' option-card__tab-btn--active' : ''}`}
                                onClick={() => setTab('dhw')}
                              >🚿 Hot Water</button>
                              <button
                                className={`option-card__tab-btn${tab === 'needs' ? ' option-card__tab-btn--active' : ''}`}
                                onClick={() => setTab('needs')}
                              >🔧 What needs changing</button>
                            </div>
                            {tab === 'heat' && (
                              <div className="option-card__tab-panel">
                                <p className="option-card__tab-headline">{card.heat.headline}</p>
                                <ul>{card.heat.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
                              </div>
                            )}
                            {tab === 'dhw' && (
                              <div className="option-card__tab-panel">
                                <p className="option-card__tab-headline">{card.dhw.headline}</p>
                                <ul>{card.dhw.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
                              </div>
                            )}
                            {tab === 'needs' && (
                              <div className="option-card__tab-panel">
                                {card.typedRequirements.mustHave.length > 0 && (
                                  <div className="option-card__req-group">
                                    <strong>Must have:</strong>
                                    <ul>{card.typedRequirements.mustHave.map((r, i) => <li key={i}>{r}</li>)}</ul>
                                  </div>
                                )}
                                {card.typedRequirements.likelyUpgrades.length > 0 && (
                                  <div className="option-card__req-group">
                                    <strong>Likely upgrades:</strong>
                                    <ul>{card.typedRequirements.likelyUpgrades.map((r, i) => <li key={i}>{r}</li>)}</ul>
                                  </div>
                                )}
                                {card.typedRequirements.niceToHave.length > 0 && (
                                  <div className="option-card__req-group">
                                    <strong>Nice to have:</strong>
                                    <ul>{card.typedRequirements.niceToHave.map((r, i) => <li key={i}>{r}</li>)}</ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Red Flags */}
      <div className="result-section">
        <h3>🚩 System Eligibility</h3>
        <div className="verdict-grid">
          {engineOutput.eligibility.map(item => {
            const icons = ELIGIBILITY_ICONS;
            const statusClass = item.status === 'rejected' ? 'rejected' : item.status === 'caution' ? 'flagged' : 'approved';
            const statusLabel = item.status === 'rejected' ? '❌ Rejected' : item.status === 'caution' ? '⚠️ Caution' : '✅ Viable';
            return (
              <div key={item.id} className={`verdict-item ${statusClass}`}>
                <div className="verdict-icon">{icons[item.id] ?? '🔧'}</div>
                <div className="verdict-label">{item.label}</div>
                <div className="verdict-status">{statusLabel}</div>
              </div>
            );
          })}
        </div>
        {engineOutput.redFlags.length > 0 && (
          <ul className="red-flag-list" style={{ marginTop: '1rem' }}>
            {engineOutput.redFlags.map(flag => (
              <li key={flag.id} className={flag.severity === 'fail' ? 'reject' : 'flag'}>
                <strong>{flag.title}:</strong> {flag.detail}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Lifestyle Recommendation */}
      <div className="result-section">
        <h3>👥 Lifestyle Recommendation</h3>
        <div className={`recommendation-banner ${lifestyle.recommendedSystem}`}>
          {engineOutput.recommendation.primary}
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
      {shouldShowMixergy && (
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
      )}

      {/* Bill of Materials */}
      <div className="result-section">
        <h3>📋 Bill of Materials</h3>
        <div className="bom-scroll">
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
        </div>
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
