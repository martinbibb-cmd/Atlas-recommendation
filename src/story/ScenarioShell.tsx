/**
 * ScenarioShell.tsx
 *
 * Wraps a scenario input panel with live output rendering.
 *
 * Combi Switch:
 *   - Demand vs Plant graph (reuses runCombiDhwModuleV1 + runStoredDhwModuleV1)
 *   - Behaviour bullets
 *
 * Old Boiler Reality:
 *   - PerformanceBandLadder with 4 markers
 *   - RecoveryStepsPanel
 *
 * Heat Pump Viability:
 *   - Hydraulics (pipe-sizing)
 *   - COP estimate (efficiency_graph)
 *   - Inputs summary
 *
 * Optional StoryEscalation button when scenario.escalationAllowed === true.
 *
 * Shared basics (occupancyCount, bathroomCount, etc.) are merged into each
 * sub-shell's initial state and synced back on every change.
 */
import { useState, useMemo } from 'react';
import type { EngineInputV2_3 } from '../engine/schema/EngineInputV2_3';
import type { CombiSwitchInputs, OldBoilerRealityInputs, StorySharedBasics } from './scenarioRegistry';
import { combiSwitchScenario, oldBoilerRealityScenario, heatPumpViabilityScenario, STORY_SCENARIOS } from './scenarioRegistry';
import type { HeatPumpViabilityInputs } from './scenarios/heatPumpViability';
import {
  deriveHeatPumpFlowTempC,
  estimateHeatPumpCop,
  deriveHeatPumpViabilityVerdict,
} from './scenarios/heatPumpViability';
import { CombiSwitchInputPanel, OldBoilerRealityInputPanel, HeatPumpViabilityInputPanel } from './ScenarioInputPanel';
import {
  applyCombiSwitchInputs,
  applyOldBoilerRealityInputs,
  applyHeatPumpViabilityInputs,
  sludgeDerateByCleanlinessStatus,
  controlsCyclingPenaltyPct,
  deriveOldBoilerConfidence,
} from './applyScenarioToEngineInput';
import PerformanceBandLadder from '../components/PerformanceBandLadder';
import RecoveryStepsPanel from '../components/RecoveryStepsPanel';
import ModellingNotice from '../components/ModellingNotice';
import { runHydraulicModuleV1 } from '../engine/modules/HydraulicModule';
import { runCombiDhwModuleV1 } from '../engine/modules/CombiDhwModule';
import { runStoredDhwModuleV1 } from '../engine/modules/StoredDhwModule';
import {
  ERP_TO_NOMINAL_PCT,
  DEFAULT_NOMINAL_EFFICIENCY_PCT,
  computeCurrentEfficiencyPct,
  resolveNominalEfficiencyPct,
} from '../engine/utils/efficiency';
import StoryEscalation from './StoryEscalation';
import { shouldShowPanel } from './rendering/shouldShowPanel';
import type { OutputPanel } from './scenarioRegistry';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  scenarioId: string;
  sharedBasics: StorySharedBasics;
  onBack: () => void;
  onSwitch: (id: string) => void;
  onEscalate: (prefill: Partial<EngineInputV2_3>) => void;
  onSharedBasicsChange: (update: Partial<StorySharedBasics>) => void;
}

// ── Shared header with "← Scenarios" and scenario switcher ───────────────────

function ScenarioHeader({
  currentId,
  title,
  onBack,
  onSwitch,
}: {
  currentId: string;
  title: string;
  onBack: () => void;
  onSwitch: (id: string) => void;
}) {
  return (
    <div className="scenario-shell__header">
      <button className="back-btn" onClick={onBack}>← Scenarios</button>
      <span className="step-label">{title}</span>
      <select
        className="scenario-switch-select"
        value={currentId}
        onChange={e => onSwitch(e.target.value)}
        aria-label="Switch scenario"
      >
        {STORY_SCENARIOS.map(s => (
          <option key={s.id} value={s.id}>{s.title}</option>
        ))}
      </select>
    </div>
  );
}

// ── Combi Switch Shell ─────────────────────────────────────────────────────────

function CombiSwitchShell({
  onBack,
  onSwitch,
  onEscalate,
  sharedBasics,
  onSharedBasicsChange,
}: {
  onBack: () => void;
  onSwitch: (id: string) => void;
  onEscalate: (prefill: Partial<EngineInputV2_3>) => void;
  sharedBasics: StorySharedBasics;
  onSharedBasicsChange: (update: Partial<StorySharedBasics>) => void;
}) {
  const [inputs, setInputs] = useState<CombiSwitchInputs>(() => ({
    ...combiSwitchScenario.defaults,
    ...(sharedBasics.occupancyCount !== undefined && { occupancyCount: sharedBasics.occupancyCount }),
    ...(sharedBasics.bathroomCount !== undefined && { bathroomCount: sharedBasics.bathroomCount }),
    ...(sharedBasics.mainsFlowLpm !== undefined && { mainsFlowLpm: sharedBasics.mainsFlowLpm }),
    ...(sharedBasics.mainsFlowLpm !== undefined && !sharedBasics.mainsFlowUnknown && { mainsFlowLpmKnown: true }),
  }));

  const show = (panel: OutputPanel) =>
    shouldShowPanel(combiSwitchScenario.outputFocus, panel);

  function handleInputChange(newInputs: CombiSwitchInputs) {
    setInputs(newInputs);
    onSharedBasicsChange({
      occupancyCount:    newInputs.occupancyCount,
      bathroomCount:     newInputs.bathroomCount,
      mainsFlowLpm:      newInputs.mainsFlowLpm,
      mainsFlowUnknown:  !newInputs.mainsFlowLpmKnown,
    });
  }

  const engineInput = useMemo(() => applyCombiSwitchInputs(inputs), [inputs]);

  const checks = useMemo(() => {
    const combi  = runCombiDhwModuleV1(engineInput);
    const stored = runStoredDhwModuleV1(engineInput, combi.flags.some(f => f.id === 'combi-simultaneous-demand'));
    return { combi, stored };
  }, [engineInput]);

  const combiFail = checks.combi.flags.some(f => f.severity === 'fail');
  const combiWarn = checks.combi.flags.some(f => f.severity === 'warn');

  const storedTileTitle = inputs.storedType === 'vented' ? 'Stored (Vented)' : 'Stored (Unvented)';

  return (
    <div className="scenario-shell">
      <ScenarioHeader
        currentId="combi_switch"
        title={combiSwitchScenario.title}
        onBack={onBack}
        onSwitch={onSwitch}
      />

      <ModellingNotice />

      {/* Header controls slot — stored-cylinder type toggle */}
      <div className="scenario-shell__header-controls">
        <span className="story-stored-type-toggle__label">Stored cylinder:</span>
        <div className="chip-group">
          {(['unvented', 'vented'] as const).map(type => (
            <button
              key={type}
              type="button"
              className={`chip-btn${inputs.storedType === type ? ' chip-btn--active' : ''}`}
              onClick={() => handleInputChange({ ...inputs, storedType: type })}
            >
              {type === 'unvented' ? 'Unvented' : 'Vented'}
            </button>
          ))}
        </div>
        <p className="story-stored-type-toggle__hint">
          {inputs.storedType === 'vented'
            ? 'Vented = tank-fed (loft), stable delivery, not "mains pressure"'
            : 'Unvented = mains pressure, subject to mains flow'}
        </p>
        {inputs.mainsFlowLpmKnown && inputs.mainsFlowLpm >= 18 && inputs.storedType === 'vented' && (
          <p className="story-stored-type-toggle__hint story-stored-type-toggle__hint--recommendation">
            ✅ Mains flow ≥ 18 L/min confirmed — unvented recommended
          </p>
        )}
      </div>

      <div className="scenario-shell__layout">
        {/* Left: inputs */}
        <div className="scenario-shell__inputs">
          <CombiSwitchInputPanel inputs={inputs} onChange={handleInputChange} />
          {show('inputs_summary') && <InputsSummary engineInput={engineInput} />}
        </div>

        {/* Right: live output */}
        <div className="scenario-shell__output">
          <h3>Live output</h3>

          {/* System comparison tiles */}
          <div className="story-comparison-tiles">
            <SystemTile
              title="Combi"
              status={combiFail ? 'fail' : combiWarn ? 'warn' : 'pass'}
              flags={checks.combi.flags.map(f => f.title)}
            />
            <SystemTile
              title={storedTileTitle}
              status={checks.stored.verdict.storedRisk}
              flags={[]}
            />
          </div>

          {/* Behaviour bullets */}
          <div className="story-behaviour-bullets">
            <h4>What this means</h4>
            <ul>
              <li>Combi pauses space heating during hot water draws.</li>
              {inputs.bathroomCount >= 2 || inputs.simultaneousUse === 'often' ? (
                <li>
                  If two outlets overlap, hot water delivery becomes constrained by mains flow (
                  {inputs.mainsFlowLpmKnown ? `${inputs.mainsFlowLpm} L/min` : 'derived estimate'}).
                </li>
              ) : null}
              {inputs.occupancyCount >= 4 && (
                <li>
                  High occupancy ({inputs.occupancyCount} people) raises morning overlap probability.
                </li>
              )}
              <li>
                Stored system delivers more stable temperature under simultaneous demand.
              </li>
            </ul>
          </div>

          {/* Combi DHW flags */}
          {checks.combi.flags.length > 0 && (
            <div className="story-flags">
              {checks.combi.flags.map(f => (
                <div key={f.id} className={`story-flag story-flag--${f.severity}`}>
                  <strong>{f.title}</strong>
                  <span>{f.detail}</span>
                </div>
              ))}
            </div>
          )}

          {combiSwitchScenario.escalationAllowed && (
            <StoryEscalation onEscalate={onEscalate} prefill={engineInput} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Old Boiler Reality Shell ──────────────────────────────────────────────────

function OldBoilerRealityShell({
  onBack,
  onSwitch,
  onEscalate,
}: {
  onBack: () => void;
  onSwitch: (id: string) => void;
  onEscalate: (prefill: Partial<EngineInputV2_3>) => void;
}) {
  const [inputs, setInputs] = useState<OldBoilerRealityInputs>(oldBoilerRealityScenario.defaults);
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);

  const show = (panel: OutputPanel) =>
    shouldShowPanel(oldBoilerRealityScenario.outputFocus, panel);

  const engineInput = useMemo(() => applyOldBoilerRealityInputs(inputs), [inputs]);

  const hydraulic = useMemo(() => runHydraulicModuleV1(engineInput), [engineInput]);

  const bandData = useMemo(() => {
    const nominalPct = inputs.manufacturedSedbukPctKnown
      ? inputs.manufacturedSedbukPct
      : ERP_TO_NOMINAL_PCT[inputs.manufacturedBand];

    const sludgePenalty   = sludgeDerateByCleanlinessStatus(inputs.systemCleanliness);
    const controlsPenalty = controlsCyclingPenaltyPct(inputs.controlsType);
    const filterBonus     = inputs.filterPresent === 'yes' ? 2 : 0;

    const totalDecay = sludgePenalty + controlsPenalty - filterBonus;
    const currentPct = computeCurrentEfficiencyPct(nominalPct, totalDecay);

    // After clean & protect: remove sludge derate, keep controls penalty
    const restoredDecay = controlsPenalty - filterBonus;
    const restoredPct = computeCurrentEfficiencyPct(nominalPct, restoredDecay);

    const newBaselinePct = resolveNominalEfficiencyPct(undefined); // DEFAULT_NOMINAL_EFFICIENCY_PCT

    const confidence = deriveOldBoilerConfidence(inputs);

    const contributors: { label: string; valuePct: number }[] = [];
    if (sludgePenalty > 0)   contributors.push({ label: 'Contamination', valuePct: sludgePenalty });
    if (controlsPenalty > 0) contributors.push({ label: 'Controls cycling', valuePct: controlsPenalty });

    return { nominalPct, currentPct, restoredPct, newBaselinePct, confidence, contributors };
  }, [inputs]);

  return (
    <div className="scenario-shell">
      <ScenarioHeader
        currentId="old_boiler_reality"
        title={oldBoilerRealityScenario.title}
        onBack={onBack}
        onSwitch={onSwitch}
      />

      <ModellingNotice />

      <div className="scenario-shell__layout">
        {/* Left: inputs */}
        <div className="scenario-shell__inputs">
          <OldBoilerRealityInputPanel inputs={inputs} onChange={setInputs} />
          {show('inputs_summary') && <InputsSummary engineInput={engineInput} />}
        </div>

        {/* Right: live output */}
        <div className="scenario-shell__output">
          {show('band_ladder') && (
            <>
              <h3>Performance band ladder</h3>

              <div className={`story-confidence-badge story-confidence-badge--${bandData.confidence}`}>
                Confidence: <strong>{bandData.confidence}</strong>
                {' '}(estimated — not an official reclassification)
              </div>

              <PerformanceBandLadder
                nominalPct={bandData.nominalPct}
                currentEffectivePct={bandData.currentPct}
                restoredPct={bandData.restoredPct}
                newBaselinePct={bandData.newBaselinePct}
                confidence={bandData.confidence}
                contributors={bandData.contributors}
                onMarkerHover={setHoveredMarker}
              />
            </>
          )}

          {show('recovery_steps') && (
            <>
              <h3 style={{ marginTop: 24 }}>Recovery steps</h3>
              <RecoveryStepsPanel
                systemAType="combi"
                systemBType="combi"
                hydraulic={hydraulic}
                highlightedMarker={hoveredMarker}
              />
            </>
          )}

          {oldBoilerRealityScenario.escalationAllowed && (
            <StoryEscalation onEscalate={onEscalate} prefill={engineInput} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Heat Pump Viability Shell ─────────────────────────────────────────────────

// Assumed tariffs for economic framing when no live data is available (UK mid-2024 averages).
const ASSUMED_ELEC_PENCE_PER_KWH = 28;
const ASSUMED_GAS_PENCE_PER_KWH  = 7;
const ASSUMED_BOILER_EFFICIENCY   = 0.90; // condensing boiler in-service efficiency

/** COP threshold below which a cost-risk warning is shown. */
const COP_COST_WARNING_THRESHOLD = 3.1;

const VERDICT_LABEL: Record<'good' | 'possible' | 'limited', string> = {
  good:     'Good candidate',
  possible: 'Possible — with caveats',
  limited:  'Significant constraints',
};

const VERDICT_STATUS: Record<'good' | 'possible' | 'limited', 'pass' | 'warn' | 'fail'> = {
  good:     'pass',
  possible: 'warn',
  limited:  'fail',
};

const RADIATOR_TYPE_LABEL: Record<HeatPumpViabilityInputs['radiatorsType'], string> = {
  mostly_doubles: 'low-temp ready',
  mixed:          'mixed emitters',
  mostly_singles: 'high-temp required',
};

function HeatPumpViabilityShell({
  onBack,
  onSwitch,
  sharedBasics,
  onSharedBasicsChange,
}: {
  onBack: () => void;
  onSwitch: (id: string) => void;
  sharedBasics: StorySharedBasics;
  onSharedBasicsChange: (update: Partial<StorySharedBasics>) => void;
}) {
  const [inputs, setInputs] = useState<HeatPumpViabilityInputs>(() => ({
    ...heatPumpViabilityScenario.defaults,
    ...(sharedBasics.heatLossWatts !== undefined && { heatLossWatts: sharedBasics.heatLossWatts }),
    ...(sharedBasics.heatLossKnown !== undefined && { heatLossKnown: sharedBasics.heatLossKnown }),
  }));

  const show = (panel: OutputPanel) =>
    shouldShowPanel(heatPumpViabilityScenario.outputFocus, panel);

  function handleInputChange(newInputs: HeatPumpViabilityInputs) {
    setInputs(newInputs);
    onSharedBasicsChange({
      heatLossWatts: newInputs.heatLossWatts,
      heatLossKnown: newInputs.heatLossKnown,
    });
  }

  const engineInput = useMemo(() => applyHeatPumpViabilityInputs(inputs), [inputs]);
  const hydraulic   = useMemo(() => runHydraulicModuleV1(engineInput), [engineInput]);

  const viabilityData = useMemo(() => {
    const flowTempC = deriveHeatPumpFlowTempC(inputs.radiatorsType);
    const cop       = estimateHeatPumpCop(flowTempC);

    // Base verdict from scenario inputs.
    let verdict = deriveHeatPumpViabilityVerdict(inputs);

    // Downgrade from 'good' when ASHP hydraulic risk is non-trivial.
    // Both known and estimated heat-loss values warrant a downgrade: if the
    // pipe is already at the warn/fail threshold even on a default assumption,
    // "Good candidate" is over-confident.
    if (verdict === 'good' && hydraulic.verdict.ashpRisk !== 'pass') {
      verdict = 'possible';
    }

    // Economic framing: cost per useful kWh (assumed tariffs, shown with caveat).
    const hpCostPerUsefulKwh  = parseFloat((ASSUMED_ELEC_PENCE_PER_KWH / cop).toFixed(1));
    const gasCostPerUsefulKwh = parseFloat((ASSUMED_GAS_PENCE_PER_KWH / ASSUMED_BOILER_EFFICIENCY).toFixed(1));
    let costComparison: 'cheaper' | 'similar' | 'more_expensive';
    if (hpCostPerUsefulKwh < gasCostPerUsefulKwh * 0.95) costComparison = 'cheaper';
    else if (hpCostPerUsefulKwh > gasCostPerUsefulKwh * 1.05) costComparison = 'more_expensive';
    else costComparison = 'similar';

    return { flowTempC, cop, verdict, hpCostPerUsefulKwh, gasCostPerUsefulKwh, costComparison };
  }, [inputs, hydraulic]);

  // True when primary pipe upgrade is recommended (22 mm on high heat-loss load).
  const ashpPipeUpgradeNeeded = hydraulic.verdict.ashpRisk !== 'pass';

  return (
    <div className="scenario-shell">
      <ScenarioHeader
        currentId="heat_pump_viability"
        title={heatPumpViabilityScenario.title}
        onBack={onBack}
        onSwitch={onSwitch}
      />

      <ModellingNotice />

      <div className="scenario-shell__layout">
        {/* Left: inputs */}
        <div className="scenario-shell__inputs">
          <HeatPumpViabilityInputPanel inputs={inputs} onChange={handleInputChange} />
          {show('inputs_summary') && <InputsSummary engineInput={engineInput} />}
        </div>

        {/* Right: live output */}
        <div className="scenario-shell__output">
          <h3>Viability assessment</h3>

          {/* Verdict tile */}
          <div className={`story-system-tile story-system-tile--${VERDICT_STATUS[viabilityData.verdict]}`}>
            <strong>{VERDICT_LABEL[viabilityData.verdict]}</strong>
          </div>

          {show('efficiency_graph') && (
            <div className="story-hp-cop-summary">
              <h4>Estimated performance</h4>
              <ul>
                <li>
                  Design flow temperature:{' '}
                  <strong>{viabilityData.flowTempC} °C</strong>
                  {' '}({RADIATOR_TYPE_LABEL[inputs.radiatorsType]})
                  {viabilityData.flowTempC >= 50 && (
                    <strong className="story-hp-flow-label"> — fast fit / compromise</strong>
                  )}
                  {viabilityData.flowTempC <= 40 && (
                    <strong className="story-hp-flow-label"> — full job / best case</strong>
                  )}
                </li>
                <li>
                  Indicative seasonal COP:{' '}
                  <strong>{viabilityData.cop.toFixed(1)}</strong>
                </li>
                {viabilityData.cop <= COP_COST_WARNING_THRESHOLD && (
                  <li className="story-hp-cost-warning">
                    ⚠️ COP {viabilityData.cop.toFixed(1)} at {viabilityData.flowTempC}°C is in the "fast fit / compromise" zone.
                    Performance is acceptable but may not beat gas on cost unless electricity is unusually cheap
                    or gas unusually expensive.
                  </li>
                )}
                <li>
                  Running cost (assumed: {ASSUMED_ELEC_PENCE_PER_KWH}p/kWh elec,{' '}
                  {ASSUMED_GAS_PENCE_PER_KWH}p/kWh gas):{' '}
                  <strong>
                    HP ~{viabilityData.hpCostPerUsefulKwh}p vs gas ~{viabilityData.gasCostPerUsefulKwh}p
                    {' '}per useful kWh
                  </strong>
                  {' '}—{' '}
                  {viabilityData.costComparison === 'cheaper' && 'likely cheaper than gas'}
                  {viabilityData.costComparison === 'similar' && 'broadly similar to gas'}
                  {viabilityData.costComparison === 'more_expensive' && 'likely more expensive than gas'}
                  {' '}(assumed tariffs)
                </li>
                <li>
                  {inputs.comfortPreference === 'fast_response'
                    ? 'Fast pick-up preference → heat pump works best with continuous low-level heating.'
                    : 'Steady background heat preference → well suited to heat pump rhythm.'}
                </li>
              </ul>
            </div>
          )}

          {show('hydraulics') && (
            <div className="story-hp-hydraulics">
              <h4>Hydraulics</h4>
              <ul>
                <li>
                  Primary pipe:{' '}
                  <strong>{inputs.primaryPipeDiameterKnown ? `${inputs.primaryPipeDiameter} mm` : '22 mm (assumed)'}</strong>
                  {inputs.primaryPipeDiameter === 15 && inputs.primaryPipeDiameterKnown
                    ? ' — 15 mm may restrict flow; hydraulic separator likely required.'
                    : ''}
                </li>
                <li>
                  ASHP circuit: <strong>{hydraulic.verdict.ashpRisk}</strong>
                  {' '}(effective COP: {hydraulic.effectiveCOP.toFixed(1)})
                </li>
              </ul>
              <h4>What would need to change</h4>
              <ul>
                {!inputs.outdoorSpace && (
                  <li>No outdoor space — ASHP siting not possible without external unit location.</li>
                )}
                {inputs.radiatorsType === 'mostly_singles' && (
                  <li>Singles-dominated system → consider double-panel upgrade or fan-coil addition.</li>
                )}
                {inputs.primaryPipeDiameter === 15 && inputs.primaryPipeDiameterKnown && (
                  <li>15 mm primary pipe → hydraulic separator and low-loss header recommended.</li>
                )}
                {ashpPipeUpgradeNeeded && inputs.primaryPipeDiameter !== 15 && (
                  <li>
                    Upgrade primary circuit to 28 mm (or install hydraulic separation / low-loss
                    header) — heat load exceeds safe capacity of current pipework at ASHP ΔT.
                  </li>
                )}
                {inputs.comfortPreference === 'fast_response' && (
                  <li>Fast pick-up preference → discuss weather compensation controls and buffer vessel.</li>
                )}
              </ul>
              {inputs.outdoorSpace && inputs.radiatorsType !== 'mostly_singles' && (
                <p className="story-hp-next-step">
                  Property looks broadly suitable — detailed heat loss survey recommended to size correctly.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SystemTile helper ─────────────────────────────────────────────────────────

function SystemTile({
  title,
  status,
  flags,
}: {
  title: string;
  status: 'pass' | 'warn' | 'fail';
  flags: string[];
}) {
  const label: Record<'pass' | 'warn' | 'fail', string> = {
    pass: 'Suitable',
    warn: 'Caution',
    fail: 'Constrained',
  };
  return (
    <div className={`story-system-tile story-system-tile--${status}`}>
      <strong>{title}</strong>
      <span className={`story-system-tile__badge story-system-tile__badge--${status}`}>
        {label[status]}
      </span>
      {flags.length > 0 && (
        <ul className="story-system-tile__flags">
          {flags.map(f => <li key={f}>{f}</li>)}
        </ul>
      )}
    </div>
  );
}

// ── Inputs summary (collapsed by default) ────────────────────────────────────

function InputsSummary({ engineInput }: { engineInput: Partial<EngineInputV2_3> }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(engineInput).filter(([, v]) => v !== undefined && v !== null);

  return (
    <div className="story-inputs-summary">
      <button
        type="button"
        className="story-inputs-summary__toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        {open ? '▲ Hide' : '▼ Show'} inputs used
      </button>
      {open && (
        <ul className="story-inputs-summary__list">
          {entries.map(([k, v]) => (
            <li key={k}>
              <span className="story-inputs-summary__key">{k}</span>
              <span className="story-inputs-summary__value">{JSON.stringify(v)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export default function ScenarioShell({ scenarioId, sharedBasics, onBack, onSwitch, onEscalate, onSharedBasicsChange }: Props) {
  if (scenarioId === 'combi_switch') {
    return (
      <CombiSwitchShell
        onBack={onBack}
        onSwitch={onSwitch}
        onEscalate={onEscalate}
        sharedBasics={sharedBasics}
        onSharedBasicsChange={onSharedBasicsChange}
      />
    );
  }
  if (scenarioId === 'old_boiler_reality') {
    return (
      <OldBoilerRealityShell
        onBack={onBack}
        onSwitch={onSwitch}
        onEscalate={onEscalate}
      />
    );
  }
  if (scenarioId === 'heat_pump_viability') {
    return (
      <HeatPumpViabilityShell
        onBack={onBack}
        onSwitch={onSwitch}
        sharedBasics={sharedBasics}
        onSharedBasicsChange={onSharedBasicsChange}
      />
    );
  }
  return (
    <div className="scenario-shell">
      <button className="back-btn" onClick={onBack}>← Scenarios</button>
      <p>Unknown scenario: {scenarioId}</p>
    </div>
  );
}

// ── Re-export for tests ───────────────────────────────────────────────────────

export { DEFAULT_NOMINAL_EFFICIENCY_PCT };
