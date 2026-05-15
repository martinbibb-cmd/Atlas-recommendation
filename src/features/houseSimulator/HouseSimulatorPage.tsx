/**
 * HouseSimulatorPage — customer-facing house simulator surface.
 *
 * Accessible at /?house-simulator=1.
 *
 * This is a new standalone UI surface built on top of the same simulator
 * playback hooks used by the engineering lab (/?lab=1).  It presents the
 * same physics outputs through a customer-first visual interaction model.
 *
 * Architecture:
 *   - Reads from the canonical simulator hooks (no new physics).
 *   - Adapts the output through buildHouseSimulatorViewModel.
 *   - Renders through new customer-facing components (HouseSimulatorCanvas,
 *     LiveMetricChip, SystemNarrationToast, SimulatorSideDrawer,
 *     TimelineBottomSheet).
 *
 * The existing lab/workbench (/?lab=1) is unchanged.
 *
 * Layout:
 *   - Compact header: home link · title · Setup / Engineering / Warnings buttons
 *   - SystemNarrationToast: top live-phase banner
 *   - Roof widgets: left = heat source status  ·  right = efficiency summary
 *   - HouseSimulatorCanvas: central persistent house view with outlet nodes
 *   - TimelineBottomSheet: 24-hour timeline + scenario selector + draw-off controls
 *   - SimulatorSideDrawer (left):  Setup / system configuration
 *   - SimulatorSideDrawer (right): Engineering / efficiency detail
 *   - Top sheet: warnings / physics explainers
 */

import { useState } from 'react';

import { useSystemDiagramPlayback } from '../../explainers/lego/simulator/useSystemDiagramPlayback';
import type { SimulatorSystemChoice } from '../../explainers/lego/simulator/useSystemDiagramPlayback';
import { useHousePlayback } from '../../explainers/lego/simulator/useHousePlayback';
import { useDrawOffPlayback } from '../../explainers/lego/simulator/useDrawOffPlayback';
import { useEfficiencyPlayback } from '../../explainers/lego/simulator/useEfficiencyPlayback';
import { useLimiterPlayback } from '../../explainers/lego/simulator/useLimiterPlayback';
import { useEmitterPrimaryModel } from '../../explainers/lego/simulator/useEmitterPrimaryModel';
import { computeDayTimeline } from '../../explainers/lego/simulator/useDayTimeline';
import { DEFAULT_SYSTEM_INPUTS } from '../../explainers/lego/simulator/systemInputsTypes';
import type { SystemInputs } from '../../explainers/lego/simulator/systemInputsTypes';
import type { ScenarioKey } from '../../explainers/lego/simulator/scenarioTypes';
import { SCENARIO_PRESETS, DEFAULT_SCENARIO_KEY } from '../../explainers/lego/simulator/scenarioTypes';

import DayTimelinePanel from '../../explainers/lego/simulator/panels/DayTimelinePanel';
import DrawOffStatusPanel from '../../explainers/lego/simulator/panels/DrawOffStatusPanel';
import SystemInputsPanel from '../../explainers/lego/simulator/panels/SystemInputsPanel';
import EfficiencyPanel from '../../explainers/lego/simulator/panels/EfficiencyPanel';
import LimitersPanel from '../../explainers/lego/simulator/panels/LimitersPanel';
import ExplainerPanel from '../../explainers/educational/ExplainerPanel';

import { buildHouseSimulatorViewModel } from './buildHouseSimulatorViewModel';
import HouseSimulatorCanvas from './HouseSimulatorCanvas';
import SystemNarrationToast from './SystemNarrationToast';
import SimulatorSideDrawer from './SimulatorSideDrawer';
import TimelineBottomSheet from './TimelineBottomSheet';

import './houseSimulator.css';

// ─── Efficiency badge ─────────────────────────────────────────────────────────

const EFFICIENCY_BADGE_COLOR: Record<string, string> = {
  good:    '#276749',
  warning: '#744210',
  poor:    '#742a2a',
  idle:    '#718096',
};

const SYSTEM_CHOICE_OPTIONS: { value: SimulatorSystemChoice; label: string }[] = [
  { value: 'combi',       label: 'Combi' },
  { value: 'unvented',    label: 'Unvented' },
  { value: 'open_vented', label: 'Open-vented' },
  { value: 'heat_pump',   label: 'Heat pump' },
  { value: 'mixergy',     label: 'Mixergy' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface HouseSimulatorPageProps {
  /** Navigate back to the app home / landing page. */
  onBack: () => void;
  /** Initial system type when first mounted. Defaults to 'combi'. */
  initialSystemChoice?: SimulatorSystemChoice;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HouseSimulatorPage({
  onBack,
  initialSystemChoice = 'combi',
}: HouseSimulatorPageProps) {

  // ── Panel visibility ────────────────────────────────────────────────────────
  const [leftOpen,        setLeftOpen]        = useState(false);
  const [rightOpen,       setRightOpen]       = useState(false);
  const [topSheetOpen,    setTopSheetOpen]    = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(true);

  // ── Simulator inputs ────────────────────────────────────────────────────────
  const [timeSpeed,    setTimeSpeed]    = useState(1);
  const [scenarioKey,  setScenarioKey]  = useState<ScenarioKey>(DEFAULT_SCENARIO_KEY);
  const [systemInputs, setSystemInputs] = useState<SystemInputs>({ ...DEFAULT_SYSTEM_INPUTS });

  // ── Simulator core hooks (same hooks as the lab — no new physics) ────────────
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

  // Sync cylinder type when switching system choice.
  // Each system family implies a compatible cylinder technology:
  //   mixergy → always uses its own stratified cylinder type.
  //   open_vented → system boiler with gravity-fed CWS; only corrects if previously unvented.
  //   unvented / heat_pump → mains-fed cylinder; only corrects if previously open_vented.
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

  function handleScenarioChange(key: ScenarioKey) {
    setScenarioKey(key);
    const preset = SCENARIO_PRESETS[key];
    setSystemInputs(prev => ({
      ...prev,
      coldInletTempC:   preset.coldInletTempC,
      occupancyProfile: preset.occupancyProfile,
    }));
  }

  // ── View model (adapter — reshapes existing state for the customer UI) ───────
  const vm = buildHouseSimulatorViewModel(
    diagramState,
    drawOffState,
    efficiencyState,
    limiterState,
    systemChoice,
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  const efficiencyBadgeColor =
    EFFICIENCY_BADGE_COLOR[vm.efficiencyWidget.statusTone] ?? '#718096';

  return (
    <div className="hs-wrap">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="hs-header">
        <button
          className="hs-home-btn"
          onClick={onBack}
          aria-label="Back to home"
        >
          ← Home
        </button>

        <div className="hs-header__title">
          <h1 className="hs-h1">House Simulator</h1>
          <p className="hs-subtitle">
            System response · live heating behaviour and on-demand hot water
          </p>
        </div>

        <nav className="hs-header__actions" aria-label="Simulator panels">
          <button
            className="hs-action-btn"
            onClick={() => { setLeftOpen(v => !v); setRightOpen(false); }}
            aria-expanded={leftOpen}
            aria-controls="hs-setup-drawer"
          >
            ⚙ Setup
          </button>
          <button
            className="hs-action-btn"
            onClick={() => { setRightOpen(v => !v); setLeftOpen(false); }}
            aria-expanded={rightOpen}
            aria-controls="hs-engineering-drawer"
          >
            📊 Engineering
          </button>
          <button
            className={`hs-action-btn${vm.hasWarnings ? ' hs-action-btn--warn' : ''}`}
            onClick={() => setTopSheetOpen(v => !v)}
            aria-expanded={topSheetOpen}
            aria-controls="hs-warnings-sheet"
          >
            ⚠ Warnings{vm.warningCount > 0 ? ` (${vm.warningCount})` : ''}
          </button>
        </nav>
      </header>

      {/* ── Narration toast ───────────────────────────────────────────────── */}
      <SystemNarrationToast
        icon={vm.narration.icon}
        phase={vm.narration.phase}
        warningText={vm.narration.warningText}
      />

      {/* ── Warnings top sheet ────────────────────────────────────────────── */}
      {topSheetOpen && (
        <section
          id="hs-warnings-sheet"
          className="hs-top-sheet"
          role="region"
          aria-label="Warnings and physics explainers"
        >
          <div className="hs-top-sheet__header">
            <h2>Warnings and explainers</h2>
            <button
              className="hs-action-btn"
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
      <section className="hs-stage" aria-label="House simulator stage">

        {/* Left roof widget — heat source status */}
        <aside className="hs-roof-widget hs-roof-widget--left" aria-label="Heat source status">
          <span className="hs-roof-widget__label">Heat source</span>
          <strong className="hs-roof-widget__value">{vm.heatSourceWidget.systemLabel}</strong>
          <p className="hs-roof-widget__note">{vm.heatSourceWidget.statusText}</p>
        </aside>

        {/* Central house canvas */}
        <HouseSimulatorCanvas
          houseState={houseState}
          activeOutlets={vm.activeOutlets}
        />

        {/* Right roof widget — efficiency summary */}
        <aside className="hs-roof-widget hs-roof-widget--right" aria-label="Efficiency status">
          <span className="hs-roof-widget__label">Efficiency</span>
          <strong
            className="hs-roof-widget__value"
            style={{ color: efficiencyBadgeColor }}
          >
            {vm.efficiencyWidget.headlineText}
          </strong>
          {vm.efficiencyWidget.description !== '' && (
            <p className="hs-roof-widget__note">{vm.efficiencyWidget.description}</p>
          )}
        </aside>

      </section>

      {/* ── Bottom sheet: timeline + scenarios + draw-off controls ──────────── */}
      <TimelineBottomSheet
        open={bottomSheetOpen}
        scenarioKey={scenarioKey}
        onScenarioChange={handleScenarioChange}
        onToggle={() => setBottomSheetOpen(v => !v)}
      >
        <DayTimelinePanel state={dayTimelineState} />
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
          onPresetTwo={() => setDemandControls({ shower: true, bath: true, kitchen: false, coldTap: false })}
          onPresetBathFill={() => setDemandControls({ shower: false, bath: true, kitchen: false, coldTap: false, heatingEnabled: false })}
        />
      </TimelineBottomSheet>

      {/* ── Left drawer: Setup / system configuration ─────────────────────── */}
      <SimulatorSideDrawer
        id="hs-setup-drawer"
        side="left"
        title="Setup"
        open={leftOpen}
        onClose={() => setLeftOpen(false)}
      >
        <div className="hs-setup-section">
          <p className="hs-setup-label">System type</p>
          <div className="hs-system-selector" role="group" aria-label="System type selector">
            {SYSTEM_CHOICE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`hs-system-btn${systemChoice === opt.value ? ' hs-system-btn--active' : ''}`}
                onClick={() => setSystemChoice(opt.value)}
                aria-pressed={systemChoice === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <SystemInputsPanel
          timeSpeed={timeSpeed}
          onTimeSpeedChange={setTimeSpeed}
          inputs={systemInputs}
          onInputChange={partial => setSystemInputs(prev => ({ ...prev, ...partial }))}
          systemChoice={systemChoice}
        />
      </SimulatorSideDrawer>

      {/* ── Right drawer: Engineering / efficiency detail ──────────────────── */}
      <SimulatorSideDrawer
        id="hs-engineering-drawer"
        side="right"
        title="Engineering detail"
        open={rightOpen}
        onClose={() => setRightOpen(false)}
      >
        <EfficiencyPanel state={efficiencyState} />
        <LimitersPanel state={limiterState} />
      </SimulatorSideDrawer>

    </div>
  );
}
