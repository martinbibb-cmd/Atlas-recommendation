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
 * Optional StoryEscalation button when scenario.escalationAllowed === true.
 */
import { useState, useMemo } from 'react';
import type { EngineInputV2_3 } from '../engine/schema/EngineInputV2_3';
import type { CombiSwitchInputs, OldBoilerRealityInputs } from './scenarioRegistry';
import { combiSwitchScenario, oldBoilerRealityScenario } from './scenarioRegistry';
import { CombiSwitchInputPanel, OldBoilerRealityInputPanel } from './ScenarioInputPanel';
import {
  applyCombiSwitchInputs,
  applyOldBoilerRealityInputs,
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
  onBack: () => void;
  onEscalate: (prefill: Partial<EngineInputV2_3>) => void;
}

// ── Combi Switch Shell ─────────────────────────────────────────────────────────

function CombiSwitchShell({
  onBack,
  onEscalate,
}: {
  onBack: () => void;
  onEscalate: (prefill: Partial<EngineInputV2_3>) => void;
}) {
  const [inputs, setInputs] = useState<CombiSwitchInputs>(combiSwitchScenario.defaults);

  const show = (panel: OutputPanel) =>
    shouldShowPanel(combiSwitchScenario.outputFocus, panel);

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
      <div className="scenario-shell__header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="step-label">{combiSwitchScenario.title}</span>
      </div>

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
              onClick={() => setInputs(prev => ({ ...prev, storedType: type }))}
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
      </div>

      <div className="scenario-shell__layout">
        {/* Left: inputs */}
        <div className="scenario-shell__inputs">
          <CombiSwitchInputPanel inputs={inputs} onChange={setInputs} />
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
  onEscalate,
}: {
  onBack: () => void;
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
      <div className="scenario-shell__header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="step-label">{oldBoilerRealityScenario.title}</span>
      </div>

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

export default function ScenarioShell({ scenarioId, onBack, onEscalate }: Props) {
  if (scenarioId === 'combi_switch') {
    return <CombiSwitchShell onBack={onBack} onEscalate={onEscalate} />;
  }
  if (scenarioId === 'old_boiler_reality') {
    return <OldBoilerRealityShell onBack={onBack} onEscalate={onEscalate} />;
  }
  return (
    <div className="scenario-shell">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <p>Unknown scenario: {scenarioId}</p>
    </div>
  );
}

// ── Re-export for tests ───────────────────────────────────────────────────────

export { DEFAULT_NOMINAL_EFFICIENCY_PCT };
