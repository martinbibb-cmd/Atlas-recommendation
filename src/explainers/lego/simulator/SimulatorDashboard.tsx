/**
 * SimulatorDashboard — 4-panel simulator layout with optional compare mode.
 *
 * Single mode (default):
 *  - 2×2 panel grid: System Diagram, House View, Draw-Off Behaviour, Efficiency
 *  - Limiters row below the grid
 *  - System Inputs row below limiters
 *
 * Compare mode (default when survey-backed):
 *  - ComparisonSummaryStrip at top showing key before/after physics
 *  - Two columns side by side: Current System | Proposed System
 *  - Each column runs independent hooks via the same simulator architecture
 *  - Left column seeded from the surveyed current system
 *  - Right column seeded from the engine's recommended proposed system
 *
 * PR6:  Added sim-time/phase bar, demand controls, and correct system-type options.
 * PR13: Added compare mode toggle, parallel improved config, ComparisonSummaryStrip.
 * PR5:  Compare mode is now the default for survey-backed entry. Proposed-system
 *       column seeded from buildCompareSeedFromSurvey, with canonical labels.
 */

import { useState } from 'react';
import type { ReactElement } from 'react';
import SimulatorPanel from './SimulatorPanel';
import ExpandedPanelModal from './ExpandedPanelModal';
import SystemDiagramPanel from './panels/SystemDiagramPanel';
import HouseStatusPanel from './panels/HouseStatusPanel';
import DrawOffStatusPanel from './panels/DrawOffStatusPanel';
import EfficiencyPanel from './panels/EfficiencyPanel';
import LimitersPanel from './panels/LimitersPanel';
import SystemInputsPanel from './panels/SystemInputsPanel';
import ComparisonSummaryStrip from './panels/ComparisonSummaryStrip';
import DayTimelinePanel from './panels/DayTimelinePanel';
import DailyEfficiencySummaryPanel from './panels/DailyEfficiencySummaryPanel';
import type { SystemInputs } from './systemInputsTypes';
import { DEFAULT_SYSTEM_INPUTS } from './systemInputsTypes';
import { useSystemDiagramPlayback } from './useSystemDiagramPlayback';
import type { SimulatorSystemChoice } from './useSystemDiagramPlayback';
import { useHousePlayback } from './useHousePlayback';
import { useDrawOffPlayback } from './useDrawOffPlayback';
import { useEfficiencyPlayback } from './useEfficiencyPlayback';
import { useLimiterPlayback } from './useLimiterPlayback';
import { useEmitterPrimaryModel } from './useEmitterPrimaryModel';
import { computeDayTimeline } from './useDayTimeline';
import { computeDailyEfficiencySummary } from './useDailyEfficiencySummary';
import type { ScenarioKey } from './scenarioTypes';
import { SCENARIO_PRESETS, SCENARIO_PRESET_LIST, DEFAULT_SCENARIO_KEY } from './scenarioTypes';
import { buildOccupancyBehaviourFromSurvey, buildOccupancyDisplayTags } from '../../../lib/occupancy/buildOccupancyBehaviourFromSurvey';
import type { DemandPresetId } from './systemInputsTypes';
import './labDashboard.css';
import './labPanels.css';

type PanelId = 'system' | 'house' | 'drawoff' | 'efficiency' | 'limiters' | 'inputs';
type SimulatorMode = 'single' | 'compare';

const PANEL_METADATA: Record<PanelId, { title: string; icon: string }> = {
  system:     { title: 'System Diagram',  icon: '⚙'  },
  house:      { title: 'House View',      icon: '🏠' },
  drawoff:    { title: 'Draw-Off Behaviour', icon: '💧' },
  efficiency: { title: 'Efficiency',      icon: '📊' },
  limiters:   { title: 'System Limiters', icon: '⚠'  },
  inputs:     { title: 'System Inputs',   icon: '🎛'  },
};

const SYSTEM_CHOICE_OPTIONS: { value: SimulatorSystemChoice; label: string; description: string }[] = [
  { value: 'combi',       label: 'Combi',       description: 'On-demand hot water via plate HEX. CH pauses on draw.' },
  { value: 'unvented',    label: 'Unvented',    description: 'Mains-fed cylinder, S-plan zone valves. CH and reheat independent.' },
  { value: 'open_vented', label: 'Open vented', description: 'Tank-fed cylinder, Y-plan mid-position valve. Gravity cold supply.' },
  { value: 'heat_pump',   label: 'Heat pump',   description: 'ASHP primary loop with cylinder. Low flow temps, no condensing.' },
  { value: 'mixergy',     label: 'Mixergy',     description: 'Stratified mains-fed cylinder. Top-down heat; demand mirroring; reduced cycling.' },
];

// ─── Phase bar ────────────────────────────────────────────────────────────────

interface PhaseBarProps {
  phaseLabel: string
  chActive: boolean
  dhwActive: boolean
  reheatActive: boolean
  chPaused: boolean
  isManualMode: boolean
  onResetAuto: () => void
  onSetManual: () => void
}

function PhaseBar({
  phaseLabel, chActive, dhwActive, reheatActive, chPaused, isManualMode, onResetAuto, onSetManual,
}: PhaseBarProps) {
  return (
    <div className="sim-phase-bar" role="status" aria-label="Simulator phase status">
      <span className="sim-phase-bar__label" aria-label="Current phase">{phaseLabel}</span>
      <span className="sim-phase-bar__divider" aria-hidden="true">·</span>
      {chActive && (
        <span className="sim-phase-badge sim-phase-badge--ch">CH active</span>
      )}
      {chPaused && (
        <span className="sim-phase-badge sim-phase-badge--paused">CH paused</span>
      )}
      {dhwActive && (
        <span className="sim-phase-badge sim-phase-badge--dhw">DHW active</span>
      )}
      {reheatActive && (
        <span className="sim-phase-badge sim-phase-badge--reheat">Reheat</span>
      )}
      {!chActive && !dhwActive && !reheatActive && !chPaused && (
        <span className="sim-phase-badge sim-phase-badge--idle">Idle</span>
      )}
      <span className="sim-phase-bar__divider" aria-hidden="true">·</span>
      <button className="sim-phase-bar__reset" onClick={onResetAuto} aria-label="Set auto demo mode">Auto demo</button>
      <button className="sim-phase-bar__reset" onClick={onSetManual} aria-label="Set manual mode">Manual</button>
      {isManualMode && <span className="sim-phase-badge sim-phase-badge--manual">Manual lock</span>}
    </div>
  )
}

// ─── System type selector ─────────────────────────────────────────────────────

interface SystemSelectorProps {
  systemChoice: SimulatorSystemChoice
  onSetSystemChoice: (c: SimulatorSystemChoice) => void
  label?: string
}

function SystemSelector({ systemChoice, onSetSystemChoice, label }: SystemSelectorProps) {
  return (
    <div className="sim-system-selector" aria-label={label ?? 'System type selector'}>
      {label && <span className="sim-system-selector__col-label">{label}</span>}
      {SYSTEM_CHOICE_OPTIONS.map(opt => (
        <button
          key={opt.value}
          className={`sim-system-selector__btn${systemChoice === opt.value ? ' sim-system-selector__btn--active' : ''}`}
          onClick={() => onSetSystemChoice(opt.value)}
          aria-pressed={systemChoice === opt.value}
          title={opt.description}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── Scenario selector ────────────────────────────────────────────────────────

interface ScenarioSelectorProps {
  scenarioKey: ScenarioKey
  onSetScenario: (key: ScenarioKey) => void
}

function ScenarioSelector({ scenarioKey, onSetScenario }: ScenarioSelectorProps) {
  return (
    <div className="sim-scenario-selector" role="group" aria-label="Day scenario selector">
      <span className="sim-scenario-selector__label" aria-hidden="true">Scenario</span>
      {SCENARIO_PRESET_LIST.map(preset => (
        <button
          key={preset.key}
          className={`sim-scenario-selector__btn${scenarioKey === preset.key ? ' sim-scenario-selector__btn--active' : ''}`}
          onClick={() => onSetScenario(preset.key)}
          aria-pressed={scenarioKey === preset.key}
          title={preset.description}
        >
          {preset.label}
        </button>
      ))}
    </div>
  )
}

// ─── Lifestyle demand badge ───────────────────────────────────────────────────

/**
 * Shows concise demand-style tags derived from the selected demand preset.
 * Gives users clear visual confirmation that the simulator is using their
 * Full Survey lifestyle selection.
 */
function LifestyleDemandBadge({ demandPreset }: { demandPreset: DemandPresetId }) {
  const behaviour = buildOccupancyBehaviourFromSurvey(demandPreset);
  const tags = buildOccupancyDisplayTags(behaviour);
  return (
    <div
      className="sim-lifestyle-badge"
      role="status"
      aria-label={`Simulator lifestyle: ${tags.join(', ')}`}
    >
      <span className="sim-lifestyle-badge__icon" aria-hidden="true">🏠</span>
      <span className="sim-lifestyle-badge__tags">
        {tags.map((tag, i) => (
          <span key={i} className={`sim-lifestyle-badge__tag${i === 0 ? ' sim-lifestyle-badge__tag--primary' : ''}`}>
            {tag}
          </span>
        ))}
      </span>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

interface Props {
  /** Initial system choice, e.g. from the setup stepper or survey adapter. */
  initialSystemChoice?: SimulatorSystemChoice
  /**
   * Optional partial SystemInputs to merge over DEFAULT_SYSTEM_INPUTS on
   * first render.  Produced by adaptFullSurveyToSimulatorInputs() when
   * the simulator is launched from a completed full survey.
   * Users can still edit any value after the simulator opens.
   */
  initialSystemInputs?: Partial<SystemInputs>
  /**
   * When true, the simulator was opened from a completed full survey.
   * Surfaces a "Using full survey data" badge so users can see the source
   * of the initial configuration.
   */
  surveyBacked?: boolean
  /**
   * Initial mode for the simulator.
   * Defaults to 'compare' when survey-backed (from Full Survey) so that the
   * strongest product demonstration — current vs proposed — is shown first.
   * Defaults to 'single' when opened without survey data (stepper path).
   */
  defaultMode?: SimulatorMode
  /**
   * Initial system choice for the proposed (right) column in compare mode.
   * Produced by buildCompareSeedFromSurvey() when launched from a full survey.
   * Falls back to initialSystemChoice when not provided.
   */
  initialProposedSystemChoice?: SimulatorSystemChoice
  /**
   * Initial partial SystemInputs for the proposed (right) column in compare mode.
   * Produced by buildCompareSeedFromSurvey() when launched from a full survey.
   * Falls back to improved defaults when not provided.
   */
  initialProposedSystemInputs?: Partial<SystemInputs>
  /**
   * Column heading labels for compare mode.
   * Defaults to { current: 'Current system', proposed: 'Proposed system' }.
   * Override to 'Improved system' etc. for non-survey-backed compare flows.
   */
  compareLabels?: { current: string; proposed: string }
}

export default function SimulatorDashboard({
  initialSystemChoice = 'combi',
  initialSystemInputs,
  surveyBacked = false,
  defaultMode,
  initialProposedSystemChoice,
  initialProposedSystemInputs,
  compareLabels = { current: 'Current system', proposed: 'Proposed system' },
}: Props) {
  const [expanded, setExpanded] = useState<PanelId | null>(null);
  const [timeSpeed, setTimeSpeed] = useState(1);
  const [simulatorMode, setSimulatorMode] = useState<SimulatorMode>(defaultMode ?? 'single');
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>(DEFAULT_SCENARIO_KEY);

  // ── Scenario preset handler ─────────────────────────────────────────────────
  // Applying a preset overwrites the cold inlet temp and occupancy profile.
  // All other inputs remain at their current user-edited values.
  function handleScenarioChange(key: ScenarioKey) {
    setScenarioKey(key);
    const preset = SCENARIO_PRESETS[key];
    setSystemInputs(prev => ({
      ...prev,
      coldInletTempC: preset.coldInletTempC,
      occupancyProfile: preset.occupancyProfile,
    }));
  }

  // ── Current config ──────────────────────────────────────────────────────────
  const [systemInputs, setSystemInputs] = useState<SystemInputs>({
    ...DEFAULT_SYSTEM_INPUTS,
    ...initialSystemInputs,
  });

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
  } = useSystemDiagramPlayback(initialSystemChoice, timeSpeed, systemInputs.occupancyProfile, systemInputs.demandPreset);

  // When switching to Mixergy, auto-set cylinderType so downstream physics
  // (useLimiterPlayback, useStoredHotWaterPlayback) use Mixergy behaviour.
  // When switching away, restore 'unvented' as the default cylinder type.
  const setSystemChoice = (c: SimulatorSystemChoice) => {
    setSystemChoiceRaw(c)
    if (c === 'mixergy') {
      setSystemInputs(prev => ({ ...prev, cylinderType: 'mixergy' }))
    } else {
      setSystemInputs(prev =>
        prev.cylinderType === 'mixergy' ? { ...prev, cylinderType: 'unvented' } : prev
      )
    }
  }
  const houseState = useHousePlayback(diagramState);
  const drawOffState = useDrawOffPlayback(diagramState, systemInputs.cylinderType, systemInputs.cylinderSizeLitres);
  const emitterState = useEmitterPrimaryModel({
    emitterCapacityFactor: systemInputs.emitterCapacityFactor,
    primaryPipeSize: systemInputs.primaryPipeSize,
    emitterType: systemInputs.emitterType,
    weatherCompensation: systemInputs.weatherCompensation,
    loadCompensation: systemInputs.loadCompensation,
    heatLossKw: systemInputs.heatLossKw,
    boilerOutputKw: systemInputs.boilerOutputKw,
  });
  const efficiencyState = useEfficiencyPlayback(diagramState, emitterState, systemInputs.systemCondition);
  const limiterState = useLimiterPlayback(diagramState, systemInputs.combiPowerKw, systemInputs.coldInletTempC, emitterState, systemInputs.cylinderType, systemInputs.systemCondition);

  // ── Day timeline and daily summary (single mode) ────────────────────────────
  const activePreset = SCENARIO_PRESETS[scenarioKey];
  const dayTimelineState = computeDayTimeline(simHour, {
    sunriseHour: activePreset.sunriseHour,
    sunsetHour: activePreset.sunsetHour,
  });
  const dailySummaryState = computeDailyEfficiencySummary(systemInputs, systemChoice, emitterState, activePreset.seasonContext);

  // ── Improved config (compare mode) ─────────────────────────────────────────
  // Hooks are always called unconditionally (React rules). Their outputs are
  // only rendered when simulatorMode === 'compare'.
  //
  // When initialProposedSystemInputs is provided (survey-backed entry), it
  // seeds the proposed column from buildCompareSeedFromSurvey output so the
  // right column represents the engine's actual recommendation.
  //
  // When not provided, fall back to the generic "improved defaults" (emitter
  // factor 1.3 — a more aggressive improvement appropriate for the non-survey
  // generic compare path where no real property physics are available to target).
  const [improvedInputs, setImprovedInputs] = useState<SystemInputs>(
    initialProposedSystemInputs != null
      ? { ...DEFAULT_SYSTEM_INPUTS, ...initialProposedSystemInputs }
      : {
          ...DEFAULT_SYSTEM_INPUTS,
          weatherCompensation: true,
          loadCompensation: true,
          emitterCapacityFactor: 1.3,
          primaryPipeSize: '22mm',
          systemCondition: 'clean',
        },
  );

  const {
    state: diagramStateImproved,
    systemChoice: systemChoiceImproved,
    setSystemChoice: setSystemChoiceImproved,
    isManualMode: isManualModeImproved,
    resetToAutoMode: resetToAutoModeImproved,
    setManualMode: setManualModeImproved,
  } = useSystemDiagramPlayback(initialProposedSystemChoice ?? initialSystemChoice, timeSpeed, improvedInputs.occupancyProfile, improvedInputs.demandPreset);
  // useHousePlayback and useDrawOffPlayback are called for React hook ordering.
  // Their results are not rendered in compare mode (only efficiency/limiters are shown).
  useHousePlayback(diagramStateImproved);
  useDrawOffPlayback(diagramStateImproved);
  const emitterStateImproved = useEmitterPrimaryModel({
    emitterCapacityFactor: improvedInputs.emitterCapacityFactor,
    primaryPipeSize: improvedInputs.primaryPipeSize,
    emitterType: improvedInputs.emitterType,
    weatherCompensation: improvedInputs.weatherCompensation,
    loadCompensation: improvedInputs.loadCompensation,
    heatLossKw: improvedInputs.heatLossKw,
    boilerOutputKw: improvedInputs.boilerOutputKw,
  });
  const efficiencyStateImproved = useEfficiencyPlayback(diagramStateImproved, emitterStateImproved, improvedInputs.systemCondition);
  const limiterStateImproved = useLimiterPlayback(diagramStateImproved, improvedInputs.combiPowerKw, improvedInputs.coldInletTempC, emitterStateImproved, improvedInputs.cylinderType, improvedInputs.systemCondition);

  // ── Derived display values (current) ───────────────────────────────────────

  const highlightedComponents = limiterState.activeLimiters
    .flatMap(l => {
      if (!l.targetComponent) return []
      return Array.isArray(l.targetComponent) ? l.targetComponent : [l.targetComponent]
    });

  const highlightedComponentsImproved = limiterStateImproved.activeLimiters
    .flatMap(l => {
      if (!l.targetComponent) return []
      return Array.isArray(l.targetComponent) ? l.targetComponent : [l.targetComponent]
    });

  const { systemMode, serviceSwitchingActive, hotDrawActive } = diagramState;
  const chActive     = (systemMode === 'heating' || systemMode === 'heating_and_reheat') && !serviceSwitchingActive;
  const dhwActive    = systemMode === 'dhw_draw' || hotDrawActive;
  const reheatActive = systemMode === 'dhw_reheat' || systemMode === 'heating_and_reheat';
  const chPaused     = serviceSwitchingActive;

  const {
    systemMode: systemModeImp,
    serviceSwitchingActive: serviceSwitchingActiveImp,
    hotDrawActive: hotDrawActiveImp,
  } = diagramStateImproved;
  const chActiveImp     = (systemModeImp === 'heating' || systemModeImp === 'heating_and_reheat') && !serviceSwitchingActiveImp;
  const dhwActiveImp    = systemModeImp === 'dhw_draw' || hotDrawActiveImp;
  const reheatActiveImp = systemModeImp === 'dhw_reheat' || systemModeImp === 'heating_and_reheat';
  const chPausedImp     = serviceSwitchingActiveImp;

  // ── Live boiler output for the system diagram labels ────────────────────────
  // Combi/Mixergy systems show combiPowerKw (DHW heating rate).
  // System-boiler stored/vented systems show boilerOutputKw (CH + reheat rate).
  const boilerOutputKwForDiagram = diagramState.heatSourceType === 'combi'
    ? systemInputs.combiPowerKw
    : systemInputs.boilerOutputKw;
  const boilerOutputKwForDiagramImproved = diagramStateImproved.heatSourceType === 'combi'
    ? improvedInputs.combiPowerKw
    : improvedInputs.boilerOutputKw;

  // ── Draw-off panels ─────────────────────────────────────────────────────────

  const drawOffPanel = (
    <DrawOffStatusPanel
      state={drawOffState}
      systemChoice={systemChoice}
      mode={isManualMode ? 'manual' : 'auto'}
      heatingEnabled={demandControls.heatingEnabled}
      shower={demandControls.shower}
      bath={demandControls.bath}
      kitchen={demandControls.kitchen}
      onSetMode={mode => mode === 'auto' ? resetToAutoMode() : setManualMode()}
      onToggleHeating={() => setDemandControls({ heatingEnabled: !demandControls.heatingEnabled })}
      onToggleShower={() => setDemandControls({ shower: !demandControls.shower })}
      onToggleBath={() => setDemandControls({ bath: !demandControls.bath })}
      onToggleKitchen={() => setDemandControls({ kitchen: !demandControls.kitchen })}
      onPresetOne={() => setDemandControls({ shower: true, bath: false, kitchen: false })}
      onPresetTwo={() => setDemandControls({ shower: true, bath: true, kitchen: false })}
      onPresetBathFill={() => setDemandControls({ shower: false, bath: true, kitchen: false, heatingEnabled: false })}
    />
  );

  // ── Expanded panel content (single mode only) ───────────────────────────────

  const expandedContent: Partial<Record<PanelId, ReactElement>> = {
    system: <SystemDiagramPanel state={diagramState} highlightedComponents={highlightedComponents} boilerOutputKw={boilerOutputKwForDiagram} />,
    house:    <HouseStatusPanel state={houseState} />,
    drawoff: drawOffPanel,
    efficiency: <EfficiencyPanel state={efficiencyState} />,
    limiters: <LimitersPanel state={limiterState} />,
    inputs: (
      <SystemInputsPanel
        timeSpeed={timeSpeed}
        onTimeSpeedChange={setTimeSpeed}
        inputs={systemInputs}
        onInputChange={partial => setSystemInputs(prev => ({ ...prev, ...partial }))}
        systemChoice={systemChoice}
      />
    ),
  };

  // ── Mode toggle ─────────────────────────────────────────────────────────────

  const modeToggle = (
    <div className="sim-mode-toggle" role="group" aria-label="Simulator mode">
      <button
        className={`sim-mode-toggle__btn${simulatorMode === 'single' ? ' sim-mode-toggle__btn--active' : ''}`}
        onClick={() => setSimulatorMode('single')}
        aria-pressed={simulatorMode === 'single'}
      >
        Single
      </button>
      <button
        className={`sim-mode-toggle__btn${simulatorMode === 'compare' ? ' sim-mode-toggle__btn--active' : ''}`}
        onClick={() => setSimulatorMode('compare')}
        aria-pressed={simulatorMode === 'compare'}
      >
        Compare
      </button>
    </div>
  );

  // ── Compare mode render ─────────────────────────────────────────────────────

  if (simulatorMode === 'compare') {
    return (
      <>
        {/* Top toolbar: mode toggle */}
        <div className="sim-toolbar">
          {modeToggle}
        </div>

        {/* Survey-backed badge — shown when simulator was launched from a full survey */}
        {surveyBacked && (
          <div className="sim-survey-badge" role="status" aria-label="Simulator is using full survey data">
            <span className="sim-survey-badge__icon" aria-hidden="true">📋</span>
            <span className="sim-survey-badge__text">Using full survey data</span>
            <span className="sim-survey-badge__hint">Values are prefilled from your survey — you can still edit them below.</span>
          </div>
        )}

        {/* Comparison summary strip */}
        <ComparisonSummaryStrip
          current={{ emitter: emitterState, efficiency: efficiencyState, limiters: limiterState }}
          improved={{ emitter: emitterStateImproved, efficiency: efficiencyStateImproved, limiters: limiterStateImproved }}
        />

        {/* Two-column compare layout */}
        <div className="sim-compare-layout" data-testid="compare-layout">

          {/* ── Current System column ── */}
          <div className="sim-compare-col sim-compare-col--current">
            <div className="sim-compare-col__heading">{compareLabels.current}</div>

            <SystemSelector
              systemChoice={systemChoice}
              onSetSystemChoice={setSystemChoice}
              label="System"
            />

            <PhaseBar
              phaseLabel={diagramState.phaseLabel}
              chActive={chActive}
              dhwActive={dhwActive}
              reheatActive={reheatActive}
              chPaused={chPaused}
              isManualMode={isManualMode}
              onResetAuto={resetToAutoMode}
              onSetManual={setManualMode}
            />

            <div className="sim-compare-panels">
              <SimulatorPanel title="System Diagram" icon="⚙" onExpand={() => {}}>
                <SystemDiagramPanel state={diagramState} highlightedComponents={highlightedComponents} boilerOutputKw={boilerOutputKwForDiagram} />
              </SimulatorPanel>
              <SimulatorPanel title="Efficiency" icon="📊" onExpand={() => {}}>
                <EfficiencyPanel state={efficiencyState} />
              </SimulatorPanel>
            </div>

            <div className="sim-compare-limiters">
              <SimulatorPanel title="System Limiters" icon="⚠" onExpand={() => {}}>
                <LimitersPanel state={limiterState} />
              </SimulatorPanel>
            </div>

            <div className="sim-compare-inputs">
              <SimulatorPanel title="System Inputs" icon="🎛" onExpand={() => {}}>
                <SystemInputsPanel
                  timeSpeed={timeSpeed}
                  onTimeSpeedChange={setTimeSpeed}
                  inputs={systemInputs}
                  onInputChange={partial => setSystemInputs(prev => ({ ...prev, ...partial }))}
                  systemChoice={systemChoice}
                />
              </SimulatorPanel>
            </div>
          </div>

          {/* ── Proposed System column ── */}
          <div className="sim-compare-col sim-compare-col--improved">
            <div className="sim-compare-col__heading sim-compare-col__heading--improved">{compareLabels.proposed}</div>

            <SystemSelector
              systemChoice={systemChoiceImproved}
              onSetSystemChoice={setSystemChoiceImproved}
              label="System"
            />

            <PhaseBar
              phaseLabel={diagramStateImproved.phaseLabel}
              chActive={chActiveImp}
              dhwActive={dhwActiveImp}
              reheatActive={reheatActiveImp}
              chPaused={chPausedImp}
              isManualMode={isManualModeImproved}
              onResetAuto={resetToAutoModeImproved}
              onSetManual={setManualModeImproved}
            />

            <div className="sim-compare-panels">
              <SimulatorPanel title="System Diagram" icon="⚙" onExpand={() => {}}>
                <SystemDiagramPanel state={diagramStateImproved} highlightedComponents={highlightedComponentsImproved} boilerOutputKw={boilerOutputKwForDiagramImproved} />
              </SimulatorPanel>
              <SimulatorPanel title="Efficiency" icon="📊" onExpand={() => {}}>
                <EfficiencyPanel state={efficiencyStateImproved} />
              </SimulatorPanel>
            </div>

            <div className="sim-compare-limiters">
              <SimulatorPanel title="System Limiters" icon="⚠" onExpand={() => {}}>
                <LimitersPanel state={limiterStateImproved} />
              </SimulatorPanel>
            </div>

            <div className="sim-compare-inputs">
              <SimulatorPanel title={`${compareLabels.proposed} Inputs`} icon="🎛" onExpand={() => {}}>
                <SystemInputsPanel
                  timeSpeed={timeSpeed}
                  onTimeSpeedChange={setTimeSpeed}
                  inputs={improvedInputs}
                  onInputChange={partial => setImprovedInputs(prev => ({ ...prev, ...partial }))}
                  systemChoice={systemChoiceImproved}
                />
              </SimulatorPanel>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Single mode render ──────────────────────────────────────────────────────

  return (
    <>
      {/* Top toolbar: mode toggle + system-type selector */}
      <div className="sim-toolbar">
        {modeToggle}
        <SystemSelector systemChoice={systemChoice} onSetSystemChoice={setSystemChoice} />
      </div>

      {/* Scenario selector — full-width row below toolbar */}
      <div className="sim-scenario-row">
        <ScenarioSelector scenarioKey={scenarioKey} onSetScenario={handleScenarioChange} />
      </div>

      {/* Survey-backed badge — shown when simulator was launched from a full survey */}
      {surveyBacked && (
        <div className="sim-survey-badge" role="status" aria-label="Simulator is using full survey data">
          <span className="sim-survey-badge__icon" aria-hidden="true">📋</span>
          <span className="sim-survey-badge__text">Using full survey data</span>
          <span className="sim-survey-badge__hint">Values are prefilled from your survey — you can still edit them below.</span>
        </div>
      )}

      {/* Lifestyle demand badge — shown when a specific demand preset is active */}
      {systemInputs.demandPreset != null && (
        <LifestyleDemandBadge demandPreset={systemInputs.demandPreset} />
      )}

      {/* 24-hour day timeline strip — always visible */}
      <div className="sim-day-timeline-row">
        <DayTimelinePanel state={dayTimelineState} />
      </div>

      {/* Sim-time / phase bar */}
      <PhaseBar
        phaseLabel={diagramState.phaseLabel}
        chActive={chActive}
        dhwActive={dhwActive}
        reheatActive={reheatActive}
        chPaused={chPaused}
        isManualMode={isManualMode}
        onResetAuto={resetToAutoMode}
        onSetManual={setManualMode}
      />

      <div className="sim-dashboard" data-testid="simulator-dashboard">
        {/* System Diagram — live animated */}
        <SimulatorPanel
          title="System Diagram"
          icon="⚙"
          onExpand={() => setExpanded('system')}
        >
          <SystemDiagramPanel state={diagramState} highlightedComponents={highlightedComponents} boilerOutputKw={boilerOutputKwForDiagram} />
        </SimulatorPanel>

        {/* House View — live playback */}
        <SimulatorPanel
          title="House View"
          icon="🏠"
          onExpand={() => setExpanded('house')}
        >
          <HouseStatusPanel state={houseState} />
        </SimulatorPanel>

        {/* Draw-Off Behaviour — live via useDrawOffPlayback */}
        <SimulatorPanel
          title="Draw-Off Behaviour"
          icon="💧"
          onExpand={() => setExpanded('drawoff')}
        >
          {drawOffPanel}
        </SimulatorPanel>

        {/* Efficiency — live via useEfficiencyPlayback */}
        <SimulatorPanel
          title="Efficiency"
          icon="📊"
          onExpand={() => setExpanded('efficiency')}
        >
          <EfficiencyPanel state={efficiencyState} />
        </SimulatorPanel>
      </div>

      {/* System Limiters — full-width row below the 2×2 grid */}
      <div className="sim-limiters-row">
        <SimulatorPanel
          title="System Limiters"
          icon="⚠"
          onExpand={() => setExpanded('limiters')}
        >
          <LimitersPanel state={limiterState} />
        </SimulatorPanel>
      </div>

      {/* Daily efficiency summary — full-width row below limiters */}
      <div className="sim-daily-summary-row">
        <DailyEfficiencySummaryPanel state={dailySummaryState} />
      </div>

      {/* System Inputs — full-width row below daily summary */}
      <div className="sim-inputs-row">
        <SimulatorPanel
          title="System Inputs"
          icon="🎛"
          onExpand={() => setExpanded('inputs')}
        >
          <SystemInputsPanel
            timeSpeed={timeSpeed}
            onTimeSpeedChange={setTimeSpeed}
            inputs={systemInputs}
            onInputChange={partial => setSystemInputs(prev => ({ ...prev, ...partial }))}
            systemChoice={systemChoice}
          />
        </SimulatorPanel>
      </div>

      {expanded && expandedContent[expanded] && (
        <ExpandedPanelModal
          title={PANEL_METADATA[expanded].title}
          icon={PANEL_METADATA[expanded].icon}
          onClose={() => setExpanded(null)}
        >
          {expandedContent[expanded]!}
        </ExpandedPanelModal>
      )}
    </>
  );
}
