/**
 * HouseFirstSimulatorDashboard — house-first Real Simulator layout.
 *
 * The canonical UI for the System Simulator at /?lab=1.
 *
 * Layout:
 *   - Compact header with action buttons (Setup · Engineering · Warnings)
 *   - Live toast showing the current simulation phase
 *   - Central house stage (HouseStatusPanel) with draw-off chips
 *   - Roof widgets: left = heat source / right = efficiency summary
 *   - Bottom sheet: day timeline + scenario selector + draw-off controls
 *   - Left slide-over: setup / system configuration
 *   - Right slide-over: engineering detail (efficiency + limiters)
 *   - Top sheet: warnings / physics explainers
 *
 * All simulator state comes from the canonical hooks:
 *   useSystemDiagramPlayback → diagramState
 *   useHousePlayback         → houseState
 *   useDrawOffPlayback       → drawOffState
 *   useEfficiencyPlayback    → efficiencyState
 *   useLimiterPlayback       → limiterState
 *   useEmitterPrimaryModel   → emitterState
 *
 * No engine / model / calculation files are changed.
 */

import { useState } from 'react';
import { useSystemDiagramPlayback } from './useSystemDiagramPlayback';
import type { SimulatorSystemChoice } from './useSystemDiagramPlayback';
import { useHousePlayback } from './useHousePlayback';
import { useDrawOffPlayback } from './useDrawOffPlayback';
import { useEfficiencyPlayback } from './useEfficiencyPlayback';
import { useLimiterPlayback } from './useLimiterPlayback';
import { useEmitterPrimaryModel } from './useEmitterPrimaryModel';
import { computeDayTimeline } from './useDayTimeline';
import HouseStatusPanel from './panels/HouseStatusPanel';
import EfficiencyPanel from './panels/EfficiencyPanel';
import LimitersPanel from './panels/LimitersPanel';
import DrawOffStatusPanel from './panels/DrawOffStatusPanel';
import SystemInputsPanel from './panels/SystemInputsPanel';
import DayTimelinePanel from './panels/DayTimelinePanel';
import { DEFAULT_SYSTEM_INPUTS } from './systemInputsTypes';
import type { SystemInputs } from './systemInputsTypes';
import type { ScenarioKey } from './scenarioTypes';
import { SCENARIO_PRESETS, SCENARIO_PRESET_LIST, DEFAULT_SCENARIO_KEY } from './scenarioTypes';
import ExplainerPanel from '../../educational/ExplainerPanel';
import LabHomeLink from '../../../components/lab/LabHomeLink';
import '../../../components/lab/lab.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const SYSTEM_TYPE_LABEL: Record<SimulatorSystemChoice, string> = {
  combi:       'Combi boiler',
  unvented:    'Unvented cylinder',
  open_vented: 'Open-vented cylinder',
  heat_pump:   'Heat pump',
  mixergy:     'Mixergy cylinder',
};

const SYSTEM_CHOICE_OPTIONS: { value: SimulatorSystemChoice; label: string }[] = [
  { value: 'combi',       label: 'Combi' },
  { value: 'unvented',    label: 'Unvented' },
  { value: 'open_vented', label: 'Open-vented' },
  { value: 'heat_pump',   label: 'Heat pump' },
  { value: 'mixergy',     label: 'Mixergy' },
];

/** Icon for each outlet type used in the draw-off chip strip. */
const OUTLET_ICON: Record<string, string> = {
  shower:   '🚿',
  bath:     '🛁',
  kitchen:  '🚰',
  cold_tap: '🚰',
};

// ─── Efficiency summary badge ─────────────────────────────────────────────────

/** Small condensing / efficiency status badge for the roof widget. */
function EfficiencyBadge({ headlineText, statusTone }: { headlineText: string; statusTone: string }) {
  const colorMap: Record<string, string> = {
    good:    '#276749',
    warning: '#744210',
    poor:    '#742a2a',
    idle:    '#718096',
  };
  const color = colorMap[statusTone] ?? '#718096';
  return (
    <span style={{ fontSize: '0.82rem', fontWeight: 700, color }} aria-live="polite">
      {headlineText}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Navigate back to the app home / landing page. */
  onHome: () => void;
  /** Initial system type when first mounted. Defaults to 'combi'. */
  initialSystemChoice?: SimulatorSystemChoice;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HouseFirstSimulatorDashboard({
  onHome,
  initialSystemChoice = 'combi',
}: Props) {
  // ── Panel visibility ────────────────────────────────────────────────────────
  const [leftOpen,         setLeftOpen]         = useState(false);
  const [rightOpen,        setRightOpen]        = useState(false);
  const [topSheetOpen,     setTopSheetOpen]     = useState(false);
  const [bottomSheetOpen,  setBottomSheetOpen]  = useState(true);

  // ── Simulator inputs ────────────────────────────────────────────────────────
  const [timeSpeed,    setTimeSpeed]    = useState(1);
  const [scenarioKey,  setScenarioKey]  = useState<ScenarioKey>(DEFAULT_SCENARIO_KEY);
  const [systemInputs, setSystemInputs] = useState<SystemInputs>({ ...DEFAULT_SYSTEM_INPUTS });

  // ── Simulator core hooks ────────────────────────────────────────────────────
  const {
    state: diagramState,
    systemChoice,
    setSystemChoice: setSystemChoiceRaw,
    demandControls,
    setDemandControls,
    isManualMode,
    resetToAutoMode,
    setManualMode,
    simHour,
  } = useSystemDiagramPlayback(
    initialSystemChoice,
    timeSpeed,
    systemInputs.occupancyProfile,
    systemInputs.demandPreset,
  );

  // Sync cylinder type when switching system choice (mirrors SimulatorDashboard).
  function setSystemChoice(c: SimulatorSystemChoice) {
    setSystemChoiceRaw(c);
    if (c === 'mixergy') {
      setSystemInputs(prev => ({ ...prev, cylinderType: 'mixergy' }));
    } else if (c === 'open_vented') {
      setSystemInputs(prev =>
        prev.cylinderType === 'unvented' ? { ...prev, cylinderType: 'open_vented' } : prev,
      );
    } else if (c === 'unvented' || c === 'heat_pump') {
      setSystemInputs(prev =>
        prev.cylinderType === 'open_vented' ? { ...prev, cylinderType: 'unvented' } : prev,
      );
    }
  }

  const houseState = useHousePlayback(diagramState);

  const drawOffState = useDrawOffPlayback(
    diagramState,
    systemInputs.cylinderType,
    systemInputs.cylinderSizeLitres,
    systemInputs.mainsFlowLpm,
    systemInputs.combiPowerKw,
    systemInputs.coldInletTempC,
  );

  const emitterState = useEmitterPrimaryModel({
    emitterCapacityFactor: systemInputs.emitterCapacityFactor,
    primaryPipeSize:       systemInputs.primaryPipeSize,
    emitterType:           systemInputs.emitterType,
    weatherCompensation:   systemInputs.weatherCompensation,
    loadCompensation:      systemInputs.loadCompensation,
    heatLossKw:            systemInputs.heatLossKw,
    boilerOutputKw:        systemInputs.boilerOutputKw,
  });

  const efficiencyState = useEfficiencyPlayback(
    diagramState,
    emitterState,
    systemInputs.systemCondition,
  );

  const limiterState = useLimiterPlayback(
    diagramState,
    systemInputs.combiPowerKw,
    systemInputs.coldInletTempC,
    emitterState,
    systemInputs.cylinderType,
    systemInputs.systemCondition,
  );

  // ── Day timeline ────────────────────────────────────────────────────────────
  const activePreset    = SCENARIO_PRESETS[scenarioKey];
  const dayTimelineState = computeDayTimeline(simHour, {
    sunriseHour: activePreset.sunriseHour,
    sunsetHour:  activePreset.sunsetHour,
  });

  // Apply scenario preset to system inputs (cold inlet temp + occupancy).
  function handleScenarioChange(key: ScenarioKey) {
    setScenarioKey(key);
    const preset = SCENARIO_PRESETS[key];
    setSystemInputs(prev => ({
      ...prev,
      coldInletTempC:   preset.coldInletTempC,
      occupancyProfile: preset.occupancyProfile,
    }));
  }

  // ── Live state derivations ──────────────────────────────────────────────────
  const { systemMode, serviceSwitchingActive, hotDrawActive } = diagramState;
  const chActive  = (systemMode === 'heating' || systemMode === 'heating_and_reheat') && !serviceSwitchingActive;
  const dhwActive = systemMode === 'dhw_draw' || hotDrawActive;

  // Active outlets for inline draw-off chips.
  const activeOutlets = drawOffState.outletStates.filter(o => o.open);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="lab-wrap lab-wrap--house-first">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="lab-house-header">
        <LabHomeLink onHome={onHome} />

        <div className="lab-house-title">
          <h1 className="lab-h1">System Simulator</h1>
          <p className="lab-subtitle">
            House-first · live heating behaviour and on-demand hot water response
          </p>
        </div>

        <nav className="lab-house-header-actions" aria-label="Simulator panels">
          <button
            className="lab-house-action"
            onClick={() => { setLeftOpen(v => !v); setRightOpen(false); }}
            aria-expanded={leftOpen}
            aria-controls="lab-setup-panel"
          >
            ⚙ Setup
          </button>
          <button
            className="lab-house-action"
            onClick={() => { setRightOpen(v => !v); setLeftOpen(false); }}
            aria-expanded={rightOpen}
            aria-controls="lab-engineering-panel"
          >
            📊 Engineering
          </button>
          <button
            className="lab-house-action"
            onClick={() => setTopSheetOpen(v => !v)}
            aria-expanded={topSheetOpen}
            aria-controls="lab-warnings-panel"
          >
            ⚠ Warnings
          </button>
        </nav>
      </header>

      {/* ── Toast: live phase narration ───────────────────────────────────── */}
      <div className="lab-house-toast" role="status" aria-live="polite">
        <span aria-hidden="true">
          {chActive ? '🔥' : dhwActive ? '💧' : '💤'}
        </span>
        <strong>{diagramState.phaseLabel}</strong>
        {limiterState.activeLimiters.length > 0 && (
          <span className="lab-house-toast__warn">
            ⚠ {limiterState.activeLimiters[0].title}
          </span>
        )}
      </div>

      {/* ── Warnings top sheet ────────────────────────────────────────────── */}
      {topSheetOpen && (
        <section
          id="lab-warnings-panel"
          className="lab-top-sheet"
          role="region"
          aria-label="Warnings and physics explainers"
        >
          <div className="lab-top-sheet__header">
            <h2>Warnings and explainers</h2>
            <button
              className="lab-house-action"
              onClick={() => setTopSheetOpen(false)}
              aria-label="Close warnings panel"
            >
              Close
            </button>
          </div>
          <ExplainerPanel />
        </section>
      )}

      {/* ── Central house stage ───────────────────────────────────────────── */}
      <section className="lab-house-stage" aria-label="House simulator surface">

        {/* Left roof widget — heat source + current service mode */}
        <aside
          className="lab-roof-widget lab-roof-widget--left"
          aria-label="Heat source status"
        >
          <span className="lab-roof-widget__label">Heat source</span>
          <strong className="lab-roof-widget__value">
            {SYSTEM_TYPE_LABEL[systemChoice]}
          </strong>
          <p className="lab-roof-widget__note">
            {chActive
              ? '🔥 Heating active'
              : dhwActive
                ? '💧 Hot water active'
                : serviceSwitchingActive
                  ? '↔ Service switching'
                  : '⏸ Idle'}
          </p>
        </aside>

        {/* Right roof widget — efficiency summary */}
        <aside
          className="lab-roof-widget lab-roof-widget--right"
          aria-label="Efficiency status"
        >
          <span className="lab-roof-widget__label">Efficiency</span>
          <EfficiencyBadge
            headlineText={efficiencyState.headlineEfficiencyText}
            statusTone={efficiencyState.statusTone}
          />
          {efficiencyState.statusDescription !== '' && (
            <p className="lab-roof-widget__note">{efficiencyState.statusDescription}</p>
          )}
        </aside>

        {/* House canvas — the central persistent view */}
        <div className="lab-house-canvas">
          <HouseStatusPanel state={houseState} />

          {/* Draw-off chips: live telemetry for each active outlet */}
          {activeOutlets.length > 0 && (
            <div className="lab-drawoff-chips" aria-label="Active draw-off telemetry">
              {activeOutlets.map(outlet => (
                <div
                  key={outlet.outletId}
                  className={`lab-drawoff-chip${outlet.isConstrained ? ' lab-drawoff-chip--constrained' : ''}`}
                  role="status"
                  aria-label={[
                    outlet.label,
                    `${outlet.flowLpm.toFixed(1)} L/min`,
                    outlet.deliveredTempC !== undefined ? `${Math.round(outlet.deliveredTempC)}°C` : null,
                  ].filter(Boolean).join(', ')}
                >
                  <span className="lab-drawoff-chip__icon" aria-hidden="true">
                    {OUTLET_ICON[outlet.outletId] ?? '💧'}
                  </span>
                  <span className="lab-drawoff-chip__label">{outlet.label}</span>
                  <span className="lab-drawoff-chip__metric">
                    {outlet.flowLpm.toFixed(1)} L/min
                  </span>
                  {outlet.deliveredTempC !== undefined && (
                    <span className="lab-drawoff-chip__metric">
                      {Math.round(outlet.deliveredTempC)}°C
                    </span>
                  )}
                  {outlet.isConstrained && (
                    <span className="lab-drawoff-chip__warn" aria-hidden="true">⚠</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Bottom sheet: timeline + scenarios + draw-off controls ──────────── */}
      <section
        className={`lab-bottom-sheet${bottomSheetOpen ? ' lab-bottom-sheet--open' : ''}`}
        aria-label="Timeline and scenarios"
      >
        <div className="lab-bottom-sheet__header">
          <h2>Timeline and scenarios</h2>
          <div className="lab-bottom-sheet__toolbar">
            <div
              className="sim-scenario-selector"
              role="group"
              aria-label="Day scenario"
            >
              {SCENARIO_PRESET_LIST.map(preset => (
                <button
                  key={preset.key}
                  className={`sim-scenario-selector__btn${scenarioKey === preset.key ? ' sim-scenario-selector__btn--active' : ''}`}
                  onClick={() => handleScenarioChange(preset.key)}
                  aria-pressed={scenarioKey === preset.key}
                  title={preset.description}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <button
              className="lab-house-action"
              onClick={() => setBottomSheetOpen(v => !v)}
              aria-label={bottomSheetOpen ? 'Collapse timeline' : 'Expand timeline'}
            >
              {bottomSheetOpen ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {bottomSheetOpen && (
          <div className="lab-bottom-sheet__body">
            {/* 24-hour day timeline strip */}
            <DayTimelinePanel state={dayTimelineState} />

            {/* Draw-off controls and workbench */}
            <DrawOffStatusPanel
              state={drawOffState}
              systemChoice={systemChoice}
              cylinderType={systemInputs.cylinderType}
              mainsPressureBar={systemInputs.mainsPressureBar}
              mainsFlowLpm={systemInputs.mainsFlowLpm}
              boilerDhwOutputKw={systemInputs.combiPowerKw}
              coldInletTempC={systemInputs.coldInletTempC}
              mode={isManualMode ? 'manual' : 'auto'}
              heatingEnabled={demandControls.heatingEnabled}
              shower={demandControls.shower}
              bath={demandControls.bath}
              kitchen={demandControls.kitchen}
              coldTap={demandControls.coldTap}
              onSetMode={mode => (mode === 'auto' ? resetToAutoMode() : setManualMode())}
              onToggleHeating={() => setDemandControls({ heatingEnabled: !demandControls.heatingEnabled })}
              onToggleShower={() => setDemandControls({ shower: !demandControls.shower })}
              onToggleBath={() => setDemandControls({ bath: !demandControls.bath })}
              onToggleKitchen={() => setDemandControls({ kitchen: !demandControls.kitchen })}
              onToggleColdTap={() => setDemandControls({ coldTap: !demandControls.coldTap })}
              onPresetOne={() => setDemandControls({ shower: true, bath: false, kitchen: false, coldTap: false })}
              onPresetTwo={() => setDemandControls({ shower: true, bath: true,  kitchen: false, coldTap: false })}
              onPresetBathFill={() => setDemandControls({ shower: false, bath: true, kitchen: false, coldTap: false, heatingEnabled: false })}
            />
          </div>
        )}
      </section>

      {/* ── Left slide-over: Setup / configuration ───────────────────────── */}
      {leftOpen && (
        <aside
          id="lab-setup-panel"
          className="lab-slide-over lab-slide-over--left"
          role="region"
          aria-label="Setup and configuration"
        >
          <div className="lab-slide-over__header">
            <h2>Setup</h2>
            <button
              className="lab-house-action"
              onClick={() => setLeftOpen(false)}
              aria-label="Close setup panel"
            >
              Close
            </button>
          </div>

          {/* System type selector */}
          <div className="lab-hf-setup-section">
            <p className="lab-hf-setup-label">System type</p>
            <div className="sim-system-selector" aria-label="System type selector">
              {SYSTEM_CHOICE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`sim-system-selector__btn${systemChoice === opt.value ? ' sim-system-selector__btn--active' : ''}`}
                  onClick={() => setSystemChoice(opt.value)}
                  aria-pressed={systemChoice === opt.value}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Full system inputs panel */}
          <SystemInputsPanel
            timeSpeed={timeSpeed}
            onTimeSpeedChange={setTimeSpeed}
            inputs={systemInputs}
            onInputChange={partial => setSystemInputs(prev => ({ ...prev, ...partial }))}
            systemChoice={systemChoice}
          />
        </aside>
      )}

      {/* ── Right slide-over: Engineering / efficiency detail ─────────────── */}
      {rightOpen && (
        <aside
          id="lab-engineering-panel"
          className="lab-slide-over lab-slide-over--right"
          role="region"
          aria-label="Engineering and efficiency detail"
        >
          <div className="lab-slide-over__header">
            <h2>Engineering detail</h2>
            <button
              className="lab-house-action"
              onClick={() => setRightOpen(false)}
              aria-label="Close engineering panel"
            >
              Close
            </button>
          </div>
          <EfficiencyPanel state={efficiencyState} />
          <LimitersPanel state={limiterState} />
        </aside>
      )}
    </div>
  );
}
