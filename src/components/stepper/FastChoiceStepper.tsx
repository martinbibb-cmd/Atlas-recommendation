import { useMemo, useState, type ReactNode } from 'react';
import ModellingNotice from '../ModellingNotice';
import type { EngineInputV2_3, FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import type { AssumptionV1, ConfidenceV1 } from '../../contracts/EngineOutputV1';
import { runEngine } from '../../engine/Engine';
import { runHydraulicModuleV1 } from '../../engine/modules/HydraulicModule';
import { runCombiDhwModuleV1 } from '../../engine/modules/CombiDhwModule';
import { runStoredDhwModuleV1 } from '../../engine/modules/StoredDhwModule';
import StoryModeContainer, { ENABLE_STORY_MODE } from '../../story/StoryModeContainer';

interface Props {
  onBack: () => void;
  /** Called when Story Mode escalates to Full Survey. */
  onEscalate?: (prefill: Partial<EngineInputV2_3>) => void;
}

type ViewMode = 'input' | 'results';
type PressureMode = 'known' | 'unknown';
type PipeMode = 'known' | 'unknown';
type HeatLossMode = 'known' | 'unknown';

const defaultInput: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2,
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
  occupancyCount: 2,
  bedrooms: 2,
  availableSpace: 'unknown',
  currentHeatSourceType: 'combi',
  peakConcurrentOutlets: 1,
};

const STATUS_LABEL: Record<'pass' | 'warn' | 'fail', string> = {
  pass: 'Pass',
  warn: 'Caution',
  fail: 'Fail',
};

export default function FastChoiceStepper({ onBack, onEscalate }: Props) {
  // Route to Story Mode when the feature flag is enabled.
  if (ENABLE_STORY_MODE) {
    return (
      <StoryModeContainer
        onBack={onBack}
        onEscalate={onEscalate ?? (() => { /* no-op when caller does not handle */ })}
      />
    );
  }
  // Feature flag is off — render legacy Input Cockpit.
  return <LegacyInputCockpit onBack={onBack} />;
}

/** Legacy Input Cockpit — rendered only when ENABLE_STORY_MODE is false. */
function LegacyInputCockpit({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<ViewMode>('input');
  const [results, setResults] = useState<FullEngineResult | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('combi');
  const [isSimulating, setIsSimulating] = useState(false);

  const [input, setInput] = useState<EngineInputV2_3>(defaultInput);
  const [pressureMode, setPressureMode] = useState<PressureMode>('known');
  const [pipeMode, setPipeMode] = useState<PipeMode>('known');
  const [heatLossMode, setHeatLossMode] = useState<HeatLossMode>('known');

  const quickChecks = useMemo(() => {
    const unknowns: string[] = [];
    if (pressureMode === 'unknown') unknowns.push('Dynamic mains pressure unknown');
    if (pipeMode === 'unknown') unknowns.push('Primary pipe size unknown');
    if (heatLossMode === 'unknown') unknowns.push('Heat loss unknown');

    // When required inputs are unknown, do not run engine modules with hardcoded defaults.
    // Instrument lights must show 'data-required' so the UI clearly signals missing data.
    const hasRequiredKnowns = pressureMode === 'known' && pipeMode === 'known';
    if (!hasRequiredKnowns) {
      return {
        ashpHydraulics: 'data-required' as const,
        combiDhw: 'data-required' as const,
        storedSpace: 'data-required' as const,
        unknowns,
      };
    }

    const candidateInput: EngineInputV2_3 = {
      ...input,
      dynamicMainsPressure: input.dynamicMainsPressure,
      primaryPipeDiameter: input.primaryPipeDiameter,
      heatLossWatts: heatLossMode === 'known' ? input.heatLossWatts : defaultInput.heatLossWatts,
      peakConcurrentOutlets: input.peakConcurrentOutlets ?? (input.bathroomCount >= 2 ? 2 : 1),
    };

    const hydraulics = runHydraulicModuleV1(candidateInput);
    const combi = runCombiDhwModuleV1(candidateInput);
    const stored = runStoredDhwModuleV1(candidateInput, combi.flags.some(f => f.id === 'combi-simultaneous-demand'));

    return {
      ashpHydraulics: hydraulics.verdict.ashpRisk,
      combiDhw: combi.verdict.combiRisk,
      storedSpace: stored.verdict.storedRisk,
      unknowns,
    };
  }, [input, pressureMode, pipeMode, heatLossMode]);

  // Simulation can only run when all required known inputs have actual values.
  const canRunSimulation = pressureMode === 'known' && pipeMode === 'known';

  const engineInput: EngineInputV2_3 = {
    ...input,
    dynamicMainsPressure: pressureMode === 'known' ? input.dynamicMainsPressure : 2,
    primaryPipeDiameter: pipeMode === 'known' ? input.primaryPipeDiameter : 22,
    heatLossWatts: heatLossMode === 'known' ? input.heatLossWatts : defaultInput.heatLossWatts,
  };

  const runSimulation = async () => {
    setIsSimulating(true);
    const output = runEngine(engineInput);
    await new Promise(resolve => setTimeout(resolve, 500));
    setResults(output);
    const recommendedId = output.engineOutput.options?.find(
      option => option.label.toLowerCase().includes(output.engineOutput.recommendation.primary.toLowerCase()),
    )?.id ?? output.engineOutput.options?.[0]?.id ?? 'combi';
    setSelectedOptionId(recommendedId);
    setView('results');
    setIsSimulating(false);
  };

  if (view === 'results' && results) {
    return (
      <ResultsCockpit
        onBack={onBack}
        onEditInputs={() => setView('input')}
        result={results}
        selectedOptionId={selectedOptionId}
        onSelectOption={setSelectedOptionId}
      />
    );
  }

  return (
    <div className="cockpit-page">
      <div className="stepper-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="step-label">Input Cockpit</span>
      </div>

      <div className="input-cockpit-layout">
        <div className="step-card">
          <h2>🎛️ Input Cockpit</h2>
          <p className="description">Set the core physical constraints. Instrument lights update instantly.</p>

          <CockpitGroup title="Household">
            <div className="form-grid">
              <InputNumber label="Occupants" value={input.occupancyCount ?? 2} min={1} max={8} onChange={value => setInput({ ...input, occupancyCount: value })} />
              <InputNumber label="Bedrooms" value={input.bedrooms ?? 2} min={1} max={8} onChange={value => setInput({ ...input, bedrooms: value })} />
              <InputNumber label="Bathrooms" value={input.bathroomCount} min={1} max={4} onChange={value => setInput({ ...input, bathroomCount: value })} />
              <InputNumber label="Peak outlets at once" value={input.peakConcurrentOutlets ?? 1} min={1} max={3} onChange={value => setInput({ ...input, peakConcurrentOutlets: value })} />
            </div>
            <div className="form-grid">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={input.futureLoftConversion ?? false}
                  onChange={e => setInput({ ...input, futureLoftConversion: e.target.checked })}
                />
                <span>Future loft conversion</span>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={input.futureAddBathroom ?? false}
                  onChange={e => setInput({ ...input, futureAddBathroom: e.target.checked })}
                />
                <span>Future additional bathroom</span>
              </label>
            </div>
          </CockpitGroup>

          <CockpitGroup title="Water">
            <div className="form-grid">
              <div className="form-field">
                <label>Dynamic pressure known?</label>
                <select value={pressureMode} onChange={e => setPressureMode(e.target.value as PressureMode)}>
                  <option value="known">Known</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
              <InputNumber
                label="Dynamic mains pressure (bar)"
                value={input.dynamicMainsPressure}
                min={0.5}
                max={6}
                step={0.1}
                disabled={pressureMode === 'unknown'}
                onChange={value => setInput({ ...input, dynamicMainsPressure: value })}
              />
            </div>
          </CockpitGroup>

          <CockpitGroup title="Infrastructure">
            <div className="form-grid">
              <div className="form-field">
                <label>Primary pipe size known?</label>
                <select value={pipeMode} onChange={e => setPipeMode(e.target.value as PipeMode)}>
                  <option value="known">Known</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
              <div className="form-field">
                <label>Primary pipe size (mm)</label>
                <select
                  value={input.primaryPipeDiameter}
                  disabled={pipeMode === 'unknown'}
                  onChange={e => setInput({ ...input, primaryPipeDiameter: Number(e.target.value) })}
                >
                  <option value={15}>15</option>
                  <option value={22}>22</option>
                  <option value={28}>28</option>
                </select>
              </div>
              <div className="form-field">
                <label>Heat loss known?</label>
                <select value={heatLossMode} onChange={e => setHeatLossMode(e.target.value as HeatLossMode)}>
                  <option value="known">Known</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
              <InputNumber
                label="Heat loss (kW)"
                value={input.heatLossWatts / 1000}
                min={3}
                max={30}
                step={0.5}
                disabled={heatLossMode === 'unknown'}
                onChange={value => setInput({ ...input, heatLossWatts: value * 1000 })}
              />
            </div>
          </CockpitGroup>

          <CockpitGroup title="Space & Current System">
            <div className="form-grid">
              <div className="form-field">
                <label>Cylinder space</label>
                <select
                  value={input.availableSpace ?? 'unknown'}
                  onChange={e => setInput({ ...input, availableSpace: e.target.value as EngineInputV2_3['availableSpace'] })}
                >
                  <option value="ok">OK</option>
                  <option value="tight">Tight</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
              <div className="form-field">
                <label>Current system</label>
                <select
                  value={input.currentHeatSourceType ?? 'combi'}
                  onChange={e => setInput({ ...input, currentHeatSourceType: e.target.value as EngineInputV2_3['currentHeatSourceType'] })}
                >
                  <option value="combi">Combi boiler</option>
                  <option value="system">System boiler</option>
                  <option value="regular">Regular boiler</option>
                  <option value="ashp">ASHP</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </CockpitGroup>

          <div className="step-actions">
            <button
              className="next-btn"
              onClick={runSimulation}
              disabled={!canRunSimulation}
              aria-describedby={!canRunSimulation ? 'sim-data-required-msg' : undefined}
              title={!canRunSimulation ? 'Set Primary pipe size and Mains pressure to Known before running' : undefined}
              style={!canRunSimulation ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            >
              Run Simulation
            </button>
            {!canRunSimulation && (
              <p id="sim-data-required-msg" style={{ fontSize: '0.78rem', color: '#718096', marginTop: '0.4rem' }}>
                Set &quot;Primary pipe size&quot; and &quot;Mains pressure&quot; to <strong>Known</strong> to enable simulation.
              </p>
            )}
          </div>
        </div>

        <div className="step-card instrument-panel">
          <h2>🧭 Instrument Lights</h2>
          <InstrumentLight title="ASHP hydraulics" status={quickChecks.ashpHydraulics} />
          <InstrumentLight title="Combi DHW" status={quickChecks.combiDhw} />
          <InstrumentLight title="Stored space / demand" status={quickChecks.storedSpace === 'pass' ? 'pass' : quickChecks.storedSpace === 'data-required' ? 'data-required' : 'warn'} />

          <div className="instrument-unknowns">
            <h4>Unknowns</h4>
            {quickChecks.unknowns.length > 0 ? (
              <ul>
                {quickChecks.unknowns.map(item => <li key={item}>{item}</li>)}
              </ul>
            ) : (
              <p>None. Core constraints are known.</p>
            )}
          </div>
        </div>
      </div>

      {isSimulating && <SimulationLogOverlay />}
    </div>
  );
}

function ResultsCockpit({
  onBack,
  onEditInputs,
  result,
  selectedOptionId,
  onSelectOption,
}: {
  onBack: () => void;
  onEditInputs: () => void;
  result: FullEngineResult;
  selectedOptionId: string;
  onSelectOption: (id: string) => void;
}) {
  const options = result.engineOutput.options ?? [];
  const selected = options.find(option => option.id === selectedOptionId) ?? options[0];

  return (
    <div className="cockpit-page">
      <div className="stepper-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <button className="prev-btn" onClick={onEditInputs}>Edit Inputs</button>
        <span className="step-label">Results Cockpit</span>
      </div>

      <ModellingNotice />

      <div className="result-section">
        <h3>🏠 Your Situation</h3>
        <ul className="context-summary-list">
          {(result.engineOutput.contextSummary?.bullets ?? []).map(item => <li key={item}>{item}</li>)}
        </ul>
      </div>

      {result.engineOutput.meta?.confidence && (
        <ConfidencePanel
          confidence={result.engineOutput.meta.confidence}
          assumptions={result.engineOutput.meta.assumptions ?? []}
        />
      )}

      <div className="results-cockpit-layout">
        <aside className="options-column">
          <h3>Options</h3>
          <div className="options-list-sticky">
            {options.map(option => (
              <button
                key={option.id}
                className={`option-select option--${option.status} ${option.id === selected.id ? 'option-select--active' : ''}`}
                onClick={() => onSelectOption(option.id)}
              >
                <span>{option.label}</span>
                <span>{option.status.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className={`dashboard-panel option--${selected.status}`}>
          <h3>{selected.label}</h3>
          <p className="option-card__headline">{selected.headline}</p>

          <DashboardSection title="Heat delivery" items={selected.why.filter(line => /ashp|hydraulic|radiator|heat|flow|ΔT/i.test(line))} />
          <DashboardSection title="Hot water" items={selected.why.filter(line => /dhw|water|outlet|bathroom|cylinder|pressure/i.test(line))} />
          <DashboardSection title="Engineering" items={selected.why.filter(line => !/dhw|water|outlet|bathroom|cylinder|pressure|ashp|hydraulic|radiator|heat|flow|ΔT/i.test(line))} />

          <div className="dashboard-block">
            <h4>Requirements</h4>
            {selected.requirements.length > 0 ? (
              <ul>
                {selected.requirements.map(item => <li key={item}>{item}</li>)}
              </ul>
            ) : (
              <p>No additional requirements highlighted.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const CONFIDENCE_COLOUR: Record<ConfidenceV1['level'], string> = {
  high:   '#38a169',
  medium: '#d69e2e',
  low:    '#e53e3e',
};

const CONFIDENCE_LABEL: Record<ConfidenceV1['level'], string> = {
  high:   'High',
  medium: 'Medium',
  low:    'Low',
};

function ConfidencePanel({ confidence, assumptions }: { confidence: ConfidenceV1; assumptions: AssumptionV1[] }) {
  const [open, setOpen] = useState(false);
  const colour = CONFIDENCE_COLOUR[confidence.level];

  return (
    <div className="result-section confidence-panel">
      <button
        className="confidence-badge"
        style={{ borderColor: colour, color: colour }}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span>📊 Confidence: {CONFIDENCE_LABEL[confidence.level]}</span>
        <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>{open ? '▲ Hide' : '▼ Show assumptions'}</span>
      </button>

      {open && (
        <div className="assumptions-drawer">
          <h4>Model assumptions</h4>
          <ul className="assumptions-list">
            {assumptions.map(a => (
              <li key={a.id} className={`assumption-item assumption--${a.severity}`}>
                <strong>{a.title}</strong>
                <span className="assumption-detail">{a.detail}</span>
                {a.improveBy && (
                  <span className="assumption-improve">💡 {a.improveBy}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DashboardSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return (
      <div className="dashboard-block">
        <h4>{title}</h4>
        <p>No issues detected for this section.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-block">
      <h4>{title}</h4>
      <ul>
        {items.map(item => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function CockpitGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="cockpit-group">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function InputNumber({
  label,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="form-field">
      <label>{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function InstrumentLight({ title, status }: { title: string; status: 'pass' | 'warn' | 'fail' | 'data-required' }) {
  if (status === 'data-required') {
    return (
      <div className="instrument-light instrument-light--unknown">
        <strong>{title}</strong>
        <span style={{ color: '#718096' }}>Data Required for Engine</span>
      </div>
    );
  }
  return (
    <div className={`instrument-light instrument-light--${status}`}>
      <strong>{title}</strong>
      <span>{STATUS_LABEL[status]}</span>
    </div>
  );
}

function SimulationLogOverlay() {
  const lines = [
    'Normalize inputs → EngineInputV2_3',
    'Run Hydraulics V1 → ASHP flow check',
    'Run Combi DHW V1 → simultaneous demand check',
    'Run Stored DHW V1 → space / demand profile',
    'Build option matrix → 5 options packaged',
  ];

  return (
    <div className="simulation-overlay" role="dialog" aria-live="polite">
      <div className="simulation-panel">
        <h3>Simulation Log</h3>
        <ul>
          {lines.map(line => <li key={line}>{line}</li>)}
        </ul>
      </div>
    </div>
  );
}
