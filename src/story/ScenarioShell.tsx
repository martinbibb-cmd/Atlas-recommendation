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
import type { CombiSwitchInputs, OldBoilerRealityInputs, StorySharedBasics, StoryScenario } from './scenarioRegistry';
import { combiSwitchScenario, oldBoilerRealityScenario, heatPumpViabilityScenario, flagshipDemoScenario, STORY_SCENARIOS } from './scenarioRegistry';
import {
  COLD_SUPPLY_TEMP_PRESETS,
  COMBI_HOT_OUT_PRESETS,
  OUTLET_FLOW_PRESETS_LPM,
  SHOWER_DURATION_PRESETS,
  PROPERTY_HEAT_LOSS_PRESETS,
  computeHeatLimitLpm,
  computeRequiredKw,
  computeDailyDhwLitres,
} from '../engine/presets/DhwFlowPresets';
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
  ageDerateByYears,
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
import { shouldShowPanel } from './rendering/shouldShowPanel';
import type { OutputPanel } from './scenarioRegistry';

// ── DHW flow concurrency graph ────────────────────────────────────────────────

/**
 * DhwFlowGraph
 *
 * Physics-honest SVG bar chart for the DHW flow/season preset panel.
 *
 * X-axis: concurrent outlets (1 / 2 / 3)
 * Y-axis: flow demand in L/min
 *
 * Each bar = n × showerPreset flow (stacked band per outlet).
 * Horizontal overlay lines:
 *   — combi heat limit (solid red) = kW_max / (0.0697 × ΔT) — varies with season + DHW mode
 *   — mains supply limit (dashed blue) = measured mainsFlowLpm when known
 *
 * Bars above the heat limit are coloured amber/red to signal "shortfall risk".
 */
function DhwFlowGraph({
  showerFlowLpm,
  heatLimitLpm,
  mainsLimitLpm,
}: {
  showerFlowLpm: number;
  heatLimitLpm: number;
  mainsLimitLpm: number | null;
}) {
  const OUTLETS = [1, 2, 3] as const;
  const demands = OUTLETS.map(n => n * showerFlowLpm);

  // Y-axis ceiling: max of all demands + 20% headroom, or at least heat limit + 4
  const maxDemand = Math.max(...demands);
  const yMax = Math.max(maxDemand * 1.25, heatLimitLpm + 4, (mainsLimitLpm ?? 0) + 4);

  const SVG_W = 280;
  const SVG_H = 160;
  const PAD_L = 36;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 28;
  const chartW = SVG_W - PAD_L - PAD_R;
  const chartH = SVG_H - PAD_T - PAD_B;

  const barW = chartW / OUTLETS.length;
  const barGap = barW * 0.18;
  const barInner = barW - barGap * 2;

  function yPx(val: number) {
    return PAD_T + chartH - (val / yMax) * chartH;
  }
  function hPx(val: number) {
    return (val / yMax) * chartH;
  }

  const heatLimitY = yPx(heatLimitLpm);
  const mainsLimitY = mainsLimitLpm !== null ? yPx(mainsLimitLpm) : null;

  // Y-axis tick values (round numbers)
  const tickCount = 4;
  const tickStep = Math.ceil(yMax / tickCount / 2) * 2;
  const ticks: number[] = [];
  for (let t = 0; t <= yMax; t += tickStep) ticks.push(t);

  return (
    <svg
      width={SVG_W}
      height={SVG_H}
      style={{ display: 'block', overflow: 'visible' }}
      aria-label="DHW flow vs combi heat limit"
    >
      {/* Y-axis ticks + labels */}
      {ticks.map(t => (
        <g key={t}>
          <line
            x1={PAD_L - 4} y1={yPx(t)}
            x2={PAD_L + chartW} y2={yPx(t)}
            stroke="#e2e8f0" strokeWidth={1}
          />
          <text
            x={PAD_L - 6} y={yPx(t) + 4}
            textAnchor="end" fontSize={9} fill="#718096"
          >
            {t}
          </text>
        </g>
      ))}

      {/* Y-axis label */}
      <text
        x={10} y={PAD_T + chartH / 2}
        textAnchor="middle" fontSize={9} fill="#718096"
        transform={`rotate(-90,10,${PAD_T + chartH / 2})`}
      >
        L/min
      </text>

      {/* Outlet bars */}
      {OUTLETS.map((n, i) => {
        const demand = demands[i];
        const barH = hPx(demand);
        const x = PAD_L + i * barW + barGap;
        const y = yPx(demand);
        const overLimit = demand > heatLimitLpm;
        const safeH = Math.min(barH, hPx(heatLimitLpm));
        const overH = barH - safeH;

        return (
          <g key={n}>
            {/* Safe portion (below heat limit) */}
            <rect
              x={x} y={y + (overLimit ? overH : 0)}
              width={barInner}
              height={overLimit ? safeH : barH}
              fill="#63b3ed"
              rx={2}
            />
            {/* Over-limit portion (above heat limit) */}
            {overLimit && overH > 0 && (
              <rect
                x={x} y={y}
                width={barInner} height={overH}
                fill="#fc8181"
                rx={2}
              />
            )}
            {/* Demand label inside/above bar */}
            <text
              x={x + barInner / 2}
              y={Math.min(y - 3, PAD_T + chartH - 3)}
              textAnchor="middle"
              fontSize={9}
              fontWeight={overLimit ? 700 : 500}
              fill={overLimit ? '#c53030' : '#2b6cb0'}
            >
              {demand.toFixed(0)}
            </text>
            {/* X-axis label */}
            <text
              x={x + barInner / 2} y={SVG_H - PAD_B + 14}
              textAnchor="middle" fontSize={9} fill="#4a5568"
            >
              {n === 1 ? '1 outlet' : `${n} outlets`}
            </text>
          </g>
        );
      })}

      {/* Combi heat limit line */}
      <line
        x1={PAD_L} y1={heatLimitY}
        x2={PAD_L + chartW} y2={heatLimitY}
        stroke="#e53e3e" strokeWidth={2} strokeDasharray="0"
      />
      <text
        x={PAD_L + chartW - 2} y={heatLimitY - 3}
        textAnchor="end" fontSize={8} fill="#e53e3e" fontWeight={700}
      >
        Combi limit {heatLimitLpm.toFixed(1)} L/min
      </text>

      {/* Mains supply limit line (when known) */}
      {mainsLimitY !== null && mainsLimitLpm !== null && (
        <>
          <line
            x1={PAD_L} y1={mainsLimitY}
            x2={PAD_L + chartW} y2={mainsLimitY}
            stroke="#3182ce" strokeWidth={1.5} strokeDasharray="4 3"
          />
          <text
            x={PAD_L + chartW - 2} y={mainsLimitY - 3}
            textAnchor="end" fontSize={8} fill="#3182ce"
          >
            Mains {mainsLimitLpm} L/min
          </text>
        </>
      )}
    </svg>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  scenarioId: string;
  sharedBasics: StorySharedBasics;
  onBack: () => void;
  onSwitch: (id: string) => void;
  onEscalate: (prefill: Partial<EngineInputV2_3>) => void;
  /**
   * Called when the user wants to open the current scenario in System Lab.
   * Receives the partial engine input accumulated so far so that the Lab
   * Quick Inputs gate can skip fields already known.
   */
  onOpenLab?: (partialInput?: Partial<EngineInputV2_3>) => void;
  onSharedBasicsChange: (update: Partial<StorySharedBasics>) => void;
}

// ── Onward actions (Open in System Lab / Open Full Survey) ────────────────────

/**
 * OnwardActions
 *
 * Shown at the bottom of every scenario result to route the user to the next
 * appropriate tool: System Lab for comparison and physics, or Full Survey for
 * higher-certainty capture.
 */
function OnwardActions({
  onOpenLab,
  onEscalate,
  prefill,
}: {
  onOpenLab?: (partialInput?: Partial<EngineInputV2_3>) => void;
  onEscalate: (prefill: Partial<EngineInputV2_3>) => void;
  prefill: Partial<EngineInputV2_3>;
}) {
  return (
    <div className="fc-onward-actions">
      <div className="fc-onward-actions__buttons">
        <button
          className="cta-btn fc-onward-actions__lab-btn"
          onClick={() => onOpenLab?.(prefill)}
          disabled={!onOpenLab}
        >
          Open in System Summary →
        </button>
        <button
          className="cta-btn fc-onward-actions__full-btn"
          onClick={() => onEscalate(prefill)}
        >
          Open Full Survey →
        </button>
      </div>
      <p className="fc-onward-actions__hint">
        System Summary shows side-by-side comparison and physical trade-offs.
        Full Survey captures more detail to increase certainty.
      </p>
    </div>
  );
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
  onOpenLab,
  sharedBasics,
  onSharedBasicsChange,
  scenario = combiSwitchScenario,
}: {
  onBack: () => void;
  onSwitch: (id: string) => void;
  onEscalate: (prefill: Partial<EngineInputV2_3>) => void;
  onOpenLab?: (partialInput?: Partial<EngineInputV2_3>) => void;
  sharedBasics: StorySharedBasics;
  onSharedBasicsChange: (update: Partial<StorySharedBasics>) => void;
  scenario?: StoryScenario<CombiSwitchInputs>;
}) {
  const [inputs, setInputs] = useState<CombiSwitchInputs>(() => ({
    ...scenario.defaults,
    ...(sharedBasics.occupancyCount !== undefined && { occupancyCount: sharedBasics.occupancyCount }),
    ...(sharedBasics.bathroomCount !== undefined && { bathroomCount: sharedBasics.bathroomCount }),
    ...(sharedBasics.mainsFlowLpm !== undefined && { mainsFlowLpm: sharedBasics.mainsFlowLpm }),
    ...(sharedBasics.mainsFlowLpm !== undefined && !sharedBasics.mainsFlowUnknown && { mainsFlowLpmKnown: true }),
  }));

  const show = (panel: OutputPanel) =>
    shouldShowPanel(scenario.outputFocus, panel);

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

  // ── DHW flow physics (derived from presets, not from engine round-trip) ──────
  const dhwPhysics = useMemo(() => {
    const coldC     = COLD_SUPPLY_TEMP_PRESETS[inputs.season];
    const hotC      = COMBI_HOT_OUT_PRESETS[inputs.dhwMode];
    const deltaT    = hotC - coldC;

    // Shower flow derived from bathroom count heuristic — no UI selector.
    // ≥2 bathrooms implies higher-demand multi-bathroom setup → mixer_high (12 L/min).
    // Single bathroom → mixer (10 L/min).
    const showerPreset: keyof typeof OUTLET_FLOW_PRESETS_LPM =
      inputs.bathroomCount >= 2 ? 'mixer_high' : 'mixer';
    const showerLpm = OUTLET_FLOW_PRESETS_LPM[showerPreset];

    // System type: use selected combiKw (not hardcoded 30)
    const heatLimitLpm = computeHeatLimitLpm(inputs.combiKw, deltaT);
    const requiredKw   = computeRequiredKw(showerLpm, deltaT);
    const shortfallLpm = showerLpm > heatLimitLpm
      ? parseFloat((showerLpm - heatLimitLpm).toFixed(1))
      : null;
    const mainsLimitLpm = inputs.mainsFlowLpmKnown ? inputs.mainsFlowLpm : null;

    // Customer usage modelling
    const durationMin    = SHOWER_DURATION_PRESETS[inputs.showerDurationPreset];
    const dailyDhwLitres = computeDailyDhwLitres(
      inputs.showersPerDay, durationMin, showerLpm, inputs.bathsPerDay,
    );
    const peakDrawMinutes = inputs.showersPerDay * durationMin;
    const heatLossKw      = PROPERTY_HEAT_LOSS_PRESETS[inputs.propertyType] / 1000;

    // Morning peak kW = space heating kW + shower kW (back-to-back draws)
    // Combi supplies DHW in priority mode, so space heating is suspended during draws.
    // Peak demand is just the DHW kW.
    const peakDhwKw = requiredKw;

    // Sizing verdict: does the selected combi kW cover the peak DHW draw?
    const sizingOk = inputs.combiKw >= peakDhwKw;

    return {
      coldC, hotC, deltaT, showerLpm, showerPreset, heatLimitLpm, requiredKw, shortfallLpm,
      mainsLimitLpm, durationMin, dailyDhwLitres, peakDrawMinutes, heatLossKw,
      peakDhwKw, sizingOk,
    };
  }, [
    inputs.season, inputs.dhwMode, inputs.bathroomCount, inputs.combiKw,
    inputs.mainsFlowLpmKnown, inputs.mainsFlowLpm,
    inputs.showerDurationPreset, inputs.showersPerDay, inputs.bathsPerDay,
    inputs.propertyType,
  ]);

  return (
    <div className="scenario-shell">
      <ScenarioHeader
        currentId={scenario.id}
        title={scenario.title}
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

          {/* ── DHW flow & concurrency panel ─────────────────────────────── */}
          <div className="story-dhw-flow-panel">
            <h4>Water power &amp; concurrency</h4>

            {/* Live sentence */}
            <p className="story-dhw-live-sentence">
              At <strong>{inputs.season === 'winter' ? 'Winter' : inputs.season === 'summer' ? 'Summer' : 'Typical'} ({dhwPhysics.coldC}°C)</strong>{' '}
              cold supply and <strong>{dhwPhysics.hotC}°C DHW</strong>, a {inputs.combiKw} kW combi can sustain{' '}
              <strong style={{ color: '#2b6cb0' }}>~{dhwPhysics.heatLimitLpm.toFixed(1)} L/min</strong>.
              {dhwPhysics.shortfallLpm !== null ? (
                <span style={{ color: '#c53030', fontWeight: 600 }}>
                  {' '}Your shower ({dhwPhysics.showerLpm} L/min) needs{' '}
                  {dhwPhysics.requiredKw.toFixed(1)} kW — shortfall of {dhwPhysics.shortfallLpm} L/min.
                </span>
              ) : (
                <span style={{ color: '#276749' }}>
                  {' '}Your shower ({dhwPhysics.showerLpm} L/min) needs{' '}
                  {dhwPhysics.requiredKw.toFixed(1)} kW — within capacity.
                </span>
              )}
            </p>

            {/* kW callout row for all shower presets */}
            <div className="story-dhw-preset-callouts">
              {(Object.entries(OUTLET_FLOW_PRESETS_LPM) as [keyof typeof OUTLET_FLOW_PRESETS_LPM, number][]).map(([key, lpm]) => {
                const kw = computeRequiredKw(lpm, dhwPhysics.deltaT);
                const over = lpm > dhwPhysics.heatLimitLpm;
                const isSelected = dhwPhysics.showerPreset === key;
                const label = key === 'mixer' ? 'Mixer' : key === 'mixer_high' ? 'Mixer high' : 'Rainfall';
                return (
                  <div
                    key={key}
                    className={`story-dhw-callout${isSelected ? ' story-dhw-callout--selected' : ''}${over ? ' story-dhw-callout--over' : ''}`}
                  >
                    <span className="story-dhw-callout__label">{label}</span>
                    <span className="story-dhw-callout__flow">{lpm} L/min</span>
                    <span className="story-dhw-callout__kw">{kw.toFixed(1)} kW</span>
                    {over && <span className="story-dhw-callout__badge">Over limit</span>}
                  </div>
                );
              })}
            </div>

            {/* Concurrency graph */}
            <div style={{ marginTop: '0.75rem', overflowX: 'auto' }}>
              <DhwFlowGraph
                showerFlowLpm={dhwPhysics.showerLpm}
                heatLimitLpm={dhwPhysics.heatLimitLpm}
                mainsLimitLpm={dhwPhysics.mainsLimitLpm}
              />
            </div>

            {/* Shortfall or OK call-to-action */}
            {dhwPhysics.shortfallLpm !== null ? (
              <p className="story-dhw-shortfall-note">
                ⚠️ <strong>{inputs.season === 'winter' ? 'Winter risk' : 'Shortfall'}</strong> — this combi cannot sustain {dhwPhysics.showerLpm} L/min at {dhwPhysics.hotC}°C when cold water is {dhwPhysics.coldC}°C.
                Flow will be throttled or temperature will droop.
              </p>
            ) : (
              <p className="story-dhw-ok-note">
                ✅ Within capacity for a single shower at {dhwPhysics.showerLpm} L/min.
                Change season to &quot;Winter&quot; to see where the combi is most challenged.
              </p>
            )}
          </div>

          {/* ── Customer usage & heat summary ─────────────────────────── */}
          <div className="story-usage-summary">
            <h4>Customer usage model</h4>
            <div className="story-usage-grid">
              <div className="story-usage-stat">
                <span className="story-usage-stat__value">{dhwPhysics.dailyDhwLitres} L</span>
                <span className="story-usage-stat__label">est. daily hot water</span>
              </div>
              <div className="story-usage-stat">
                <span className="story-usage-stat__value">{dhwPhysics.peakDrawMinutes} min</span>
                <span className="story-usage-stat__label">morning peak draw</span>
              </div>
              <div className="story-usage-stat">
                <span className="story-usage-stat__value">{dhwPhysics.peakDhwKw.toFixed(1)} kW</span>
                <span className="story-usage-stat__label">peak DHW demand</span>
              </div>
              <div className="story-usage-stat">
                <span className="story-usage-stat__value">~{dhwPhysics.heatLossKw.toFixed(0)} kW</span>
                <span className="story-usage-stat__label">
                  {inputs.propertyType === 'flat' ? 'flat' : inputs.propertyType === 'small_house' ? 'small house' : inputs.propertyType === 'medium_house' ? 'medium house' : 'large house'} heat demand
                </span>
              </div>
            </div>
            {/* Sizing note */}
            <p className={`story-usage-sizing-note story-usage-sizing-note--${dhwPhysics.sizingOk ? 'ok' : 'warn'}`}>
              {dhwPhysics.sizingOk
                ? `✅ ${inputs.combiKw} kW combi covers the ${dhwPhysics.peakDhwKw.toFixed(1)} kW peak DHW draw for this usage pattern.`
                : `⚠️ ${inputs.combiKw} kW combi is under-sized — ${dhwPhysics.peakDhwKw.toFixed(1)} kW needed for a ${dhwPhysics.showerLpm} L/min shower at ${dhwPhysics.coldC}°C cold supply.`
              }
            </p>
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

          <OnwardActions onOpenLab={onOpenLab} onEscalate={onEscalate} prefill={engineInput} />
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
  onOpenLab,
}: {
  onBack: () => void;
  onSwitch: (id: string) => void;
  onEscalate: (prefill: Partial<EngineInputV2_3>) => void;
  onOpenLab?: (partialInput?: Partial<EngineInputV2_3>) => void;
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
    const agePenalty      = ageDerateByYears(inputs.boilerAgeYears);
    const filterBonus     = inputs.filterPresent === 'yes' ? 2 : 0;

    const totalDecay = sludgePenalty + controlsPenalty + agePenalty - filterBonus;
    const currentPct = computeCurrentEfficiencyPct(nominalPct, totalDecay);

    // After clean & protect: remove sludge derate, keep age and controls penalty
    const restoredDecay = controlsPenalty + agePenalty - filterBonus;
    const restoredPct = computeCurrentEfficiencyPct(nominalPct, restoredDecay);

    const newBaselinePct = resolveNominalEfficiencyPct(undefined); // DEFAULT_NOMINAL_EFFICIENCY_PCT

    const confidence = deriveOldBoilerConfidence(inputs);

    const contributors: { label: string; valuePct: number }[] = [];
    if (agePenalty > 0)      contributors.push({ label: 'Boiler age',       valuePct: agePenalty });
    if (sludgePenalty > 0)   contributors.push({ label: 'Contamination',    valuePct: sludgePenalty });
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

          <OnwardActions onOpenLab={onOpenLab} onEscalate={onEscalate} prefill={engineInput} />
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

/**
 * Assumptions in use panel — shown when one or more heat pump viability
 * inputs are defaulted rather than measured.
 *
 * This gives the advisor a single, consistent view of what's assumed vs.
 * known, pinned next to the verdict where it matters most.
 */
function HeatPumpAssumptionsPanel({ inputs }: { inputs: HeatPumpViabilityInputs }) {
  const [open, setOpen] = useState(false);
  const defaults = heatPumpViabilityScenario.defaults;
  const assumptions: { label: string; value: string }[] = [];

  if (!inputs.heatLossKnown) {
    assumptions.push({
      label: 'Fabric heat loss',
      value: `${defaults.heatLossWatts / 1000} kW (assumed — measure for accuracy)`,
    });
  }
  if (!inputs.primaryPipeDiameterKnown) {
    assumptions.push({
      label: 'Primary pipe diameter',
      value: `${defaults.primaryPipeDiameter} mm (assumed — check to confirm)`,
    });
  }

  if (assumptions.length === 0) return null;

  return (
    <div className="hp-assumptions-panel">
      <button
        type="button"
        className="hp-assumptions-panel__toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        📋 {open ? '▲ Hide' : '▼ Show'} assumptions driving this answer ({assumptions.length})
      </button>
      {open && (
        <ul className="hp-assumptions-panel__list">
          {assumptions.map(a => (
            <li key={a.label}>
              <span className="hp-assumptions-panel__key">{a.label}:</span>
              <span className="hp-assumptions-panel__value">{a.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HeatPumpViabilityShell({
  onBack,
  onSwitch,
  onEscalate,
  onOpenLab,
  sharedBasics,
  onSharedBasicsChange,
}: {
  onBack: () => void;
  onSwitch: (id: string) => void;
  onEscalate: (prefill: Partial<EngineInputV2_3>) => void;
  onOpenLab?: (partialInput?: Partial<EngineInputV2_3>) => void;
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

          {/* Assumptions in use — shown when any input is defaulted */}
          {(!inputs.heatLossKnown || !inputs.primaryPipeDiameterKnown) && (
            <HeatPumpAssumptionsPanel inputs={inputs} />
          )}

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
          <OnwardActions onOpenLab={onOpenLab} onEscalate={onEscalate} prefill={engineInput} />
        </div>
      </div>
    </div>
  );
}

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

export default function ScenarioShell({ scenarioId, sharedBasics, onBack, onSwitch, onEscalate, onOpenLab, onSharedBasicsChange }: Props) {
  if (scenarioId === 'flagship_demo') {
    return (
      <CombiSwitchShell
        onBack={onBack}
        onSwitch={onSwitch}
        onEscalate={onEscalate}
        onOpenLab={onOpenLab}
        sharedBasics={sharedBasics}
        onSharedBasicsChange={onSharedBasicsChange}
        scenario={flagshipDemoScenario}
      />
    );
  }
  if (scenarioId === 'combi_switch') {
    return (
      <CombiSwitchShell
        onBack={onBack}
        onSwitch={onSwitch}
        onEscalate={onEscalate}
        onOpenLab={onOpenLab}
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
        onOpenLab={onOpenLab}
      />
    );
  }
  if (scenarioId === 'heat_pump_viability') {
    return (
      <HeatPumpViabilityShell
        onBack={onBack}
        onSwitch={onSwitch}
        onEscalate={onEscalate}
        onOpenLab={onOpenLab}
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
