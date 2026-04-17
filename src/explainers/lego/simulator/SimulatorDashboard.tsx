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
import { CompareHalfPanel } from './ExpandedPanelModal';
import SystemDiagramPanel from './panels/SystemDiagramPanel';
import HouseStatusPanel from './panels/HouseStatusPanel';
import DrawOffStatusPanel from './panels/DrawOffStatusPanel';
import EfficiencyPanel from './panels/EfficiencyPanel';
import LimitersPanel from './panels/LimitersPanel';
import SystemInputsPanel from './panels/SystemInputsPanel';
import ComparisonSummaryStrip from './panels/ComparisonSummaryStrip';
import DayTimelinePanel from './panels/DayTimelinePanel';
import DailyEfficiencySummaryPanel from './panels/DailyEfficiencySummaryPanel';
import BehaviourGraph from './BehaviourGraph';
import { useBehaviourTimeline } from './useBehaviourTimeline';
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
import type { EmitterCoverageClassification } from '../../../lib/floorplan/adaptFloorplanToAtlasInputs';
import type { DrawOffFlowStability } from '../../../engine/modules/StoredDhwModule';
import './labDashboard.css';
import './labPanels.css';

type PanelId = 'system' | 'house' | 'drawoff' | 'efficiency' | 'limiters' | 'inputs';
type SimulatorMode = 'single' | 'compare';

// ─── FloorplanOperatingAssumptions ───────────────────────────────────────────

/**
 * Summary of floor-plan-driven operating assumptions shown as a badge in the
 * simulator.  Built from FloorplanInsights (advice page) or directly from
 * AtlasFloorplanInputs + buildHeatingOperatingState when the simulator has
 * floor-plan data available.
 */
export interface FloorplanOperatingAssumptions {
  /** Aggregated whole-home heat loss (kW) derived from room geometry. */
  refinedHeatLossKw: number | null;
  /** Whole-system emitter coverage classification. null = no installed data. */
  coverageClassification: EmitterCoverageClassification | null;
  /** Rooms where installed emitter output is insufficient to meet demand. */
  undersizedRooms: string[];
  /** Rooms where installed emitter output far exceeds demand. */
  oversizedRooms: string[];
  /**
   * True when floor-plan emitter data meaningfully changed the operating
   * temperature assumption from the standard 1.0× default.
   */
  operatingTempInfluenced: boolean;
  /**
   * Physics story tags derived by buildHeatingOperatingState when the floor
   * plan emitter adequacy signal was active.
   */
  emitterExplanationTags: string[];
}

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

// ─── Floorplan operating badge ────────────────────────────────────────────────

/** Human-readable labels for each emitter coverage classification. */
const COVERAGE_LABEL: Record<EmitterCoverageClassification, string> = {
  all_adequate:        'All rooms adequate',
  all_oversized:       'All rooms oversized — lower flow temp achievable',
  majority_undersized: 'Majority undersized — higher flow temp needed',
  mixed:               'Mixed coverage',
  insufficient_data:   'Insufficient data',
};

/**
 * Compact banner surfacing floor-plan-driven operating assumptions.
 * Shown in the simulator when the caller has floor-plan emitter data.
 */
function FloorplanOperatingBadge({ assumptions }: { assumptions: FloorplanOperatingAssumptions }) {
  const { refinedHeatLossKw, coverageClassification, undersizedRooms, oversizedRooms, operatingTempInfluenced, emitterExplanationTags } = assumptions;

  const hasAnyData =
    refinedHeatLossKw != null ||
    coverageClassification != null ||
    undersizedRooms.length > 0 ||
    oversizedRooms.length > 0;

  if (!hasAnyData) return null;

  return (
    <div
      className="sim-floorplan-badge"
      role="status"
      aria-label="Floor plan operating assumptions active"
    >
      <span className="sim-floorplan-badge__icon" aria-hidden="true">📐</span>
      <div className="sim-floorplan-badge__body">
        <span className="sim-floorplan-badge__title">Floor plan data active</span>
        <div className="sim-floorplan-badge__items">
          {refinedHeatLossKw != null && (
            <span className="sim-floorplan-badge__item">
              Heat loss: <strong>{refinedHeatLossKw} kW</strong>
            </span>
          )}
          {coverageClassification != null && coverageClassification !== 'insufficient_data' && (
            <span className="sim-floorplan-badge__item">
              Emitters: <strong>{COVERAGE_LABEL[coverageClassification]}</strong>
            </span>
          )}
          {oversizedRooms.length > 0 && (
            <span className="sim-floorplan-badge__item sim-floorplan-badge__item--oversized">
              Oversized: {oversizedRooms.join(', ')}
            </span>
          )}
          {undersizedRooms.length > 0 && (
            <span className="sim-floorplan-badge__item sim-floorplan-badge__item--undersized">
              Undersized: {undersizedRooms.join(', ')}
            </span>
          )}
          {operatingTempInfluenced && emitterExplanationTags.length > 0 && (
            <span className="sim-floorplan-badge__item sim-floorplan-badge__item--op-temp">
              Operating assumption: {emitterExplanationTags.join(' · ')}
            </span>
          )}
        </div>
      </div>
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
  /**
   * Optional floor-plan-driven operating assumptions.
   * When present, a compact "Floor plan data active" badge is shown above the
   * simulator panels so users can see which physics constraints are informed
   * by the floor plan (refined heat loss, emitter coverage, operating temperature).
   */
  floorplanOperatingAssumptions?: FloorplanOperatingAssumptions
  /**
   * Flow stability for the initial (current) system, derived from CWS head data.
   * When provided alongside an open-vented initial system, the Draw-Off panel
   * surfaces the pipework-dependent performance advisory.
   */
  initialCurrentFlowStability?: DrawOffFlowStability
  /**
   * When true, the simulator is running inside the customer portal.
   * The SystemInputsPanel will hide expert-only fields (mains pressure, mains
   * flow, boiler output, heat loss, etc.) and only show the portal-safe subset:
   * system condition, cylinder size, emitter size, and primary pipe size.
   */
  portalMode?: boolean
}

export default function SimulatorDashboard({
  initialSystemChoice = 'combi',
  initialSystemInputs,
  surveyBacked = false,
  defaultMode,
  initialProposedSystemChoice,
  initialProposedSystemInputs,
  compareLabels = { current: 'Current system', proposed: 'Proposed system' },
  floorplanOperatingAssumptions,
  initialCurrentFlowStability,
  portalMode = false,
}: Props) {
  const [expanded, setExpanded] = useState<PanelId | null>(null);
  const [expandedCompare, setExpandedCompare] = useState<{ side: 'left' | 'right'; title: string; icon: string; content: ReactElement } | null>(null);
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

  // When switching system choice, keep cylinderType consistent with the new
  // system's valid options.  Both open_vented and unvented architectures support
  // the Mixergy cylinder variant — Mixergy is never silently reset when moving
  // between stored-water system types.
  //
  //   open_vented  → valid: open_vented (Standard) or mixergy.  Reset unvented → open_vented.
  //   unvented / heat_pump → valid: unvented (Standard) or mixergy.  Reset open_vented → unvented.
  //   mixergy (legacy top-level) → ensure cylinderType reflects Mixergy behaviour.
  //   combi → no cylinder; cylinderType is ignored so no reset required.
  const setSystemChoice = (c: SimulatorSystemChoice) => {
    setSystemChoiceRaw(c)
    if (c === 'mixergy') {
      // Legacy top-level Mixergy choice: ensure cylinderType reflects Mixergy.
      setSystemInputs(prev => ({ ...prev, cylinderType: 'mixergy' }))
    } else if (c === 'open_vented') {
      // open_vented does not support the unvented cylinder type.
      setSystemInputs(prev =>
        prev.cylinderType === 'unvented' ? { ...prev, cylinderType: 'open_vented' } : prev
      )
    } else if (c === 'unvented' || c === 'heat_pump') {
      // unvented / heat_pump do not support the open_vented cylinder type.
      setSystemInputs(prev =>
        prev.cylinderType === 'open_vented' ? { ...prev, cylinderType: 'unvented' } : prev
      )
    }
    // combi: no cylinder, no reset needed (cylinderType is unused for combi)
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

  // ── Behaviour timeline (current and improved columns) ───────────────────────
  // Hooks are always called unconditionally (React rules).
  // The rolling buffer drives the BehaviourGraph panels shown in both modes.
  const behaviourTimeline = useBehaviourTimeline(diagramState, systemInputs, systemChoice);
  const behaviourTimelineImproved = useBehaviourTimeline(diagramStateImproved, improvedInputs, systemChoiceImproved);

  // kW ceiling for the graph y-axes — keeps the scale consistent across phases.
  const behaviourMaxKw = Math.max(systemInputs.boilerOutputKw, systemInputs.combiPowerKw, systemInputs.heatLossKw);
  const behaviourMaxKwImproved = Math.max(improvedInputs.boilerOutputKw, improvedInputs.combiPowerKw, improvedInputs.heatLossKw);

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
      cylinderType={systemInputs.cylinderType}
      mainsPressureBar={systemInputs.mainsPressureBar}
      mainsFlowLpm={systemInputs.mainsFlowLpm}
      flowStability={systemChoice === initialSystemChoice ? initialCurrentFlowStability : undefined}
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
    house:    <HouseStatusPanel state={houseState} isExpanded />,
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
        portalMode={portalMode}
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
    // Helper to open a half-screen expanded panel for compare mode.
    const openCompare = (side: 'left' | 'right', title: string, icon: string, content: ReactElement) => {
      setExpandedCompare({ side, title, icon, content });
    };

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

        {/* Context banner — shown when in survey-backed compare mode to explain what's being compared */}
        {surveyBacked && (
          <div className="sim-compare-context" role="note" data-testid="compare-context-banner">
            <span className="sim-compare-context__label">Comparing</span>
            <span className="sim-compare-context__current">{compareLabels.current}</span>
            <span className="sim-compare-context__arrow" aria-hidden="true">→</span>
            <span className="sim-compare-context__proposed">{compareLabels.proposed}</span>
          </div>
        )}

        {/* Floor-plan operating assumptions badge */}
        {floorplanOperatingAssumptions != null && (
          <FloorplanOperatingBadge assumptions={floorplanOperatingAssumptions} />
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
              <SimulatorPanel title="System Diagram" icon="⚙" onExpand={() => openCompare('left', 'System Diagram', '⚙', <SystemDiagramPanel state={diagramState} highlightedComponents={highlightedComponents} boilerOutputKw={boilerOutputKwForDiagram} />)}>
                <SystemDiagramPanel state={diagramState} highlightedComponents={highlightedComponents} boilerOutputKw={boilerOutputKwForDiagram} />
              </SimulatorPanel>
            </div>

            {/* System Behaviour graph — shown early so dynamics are the second thing the user sees */}
            <div className="sim-compare-behaviour">
              <SimulatorPanel title="System Behaviour" icon="📈" onExpand={() => openCompare('left', 'System Behaviour', '📈', <BehaviourGraph timeline={behaviourTimeline} systemChoice={systemChoice} maxKw={behaviourMaxKw} />)}>
                <BehaviourGraph
                  timeline={behaviourTimeline}
                  systemChoice={systemChoice}
                  maxKw={behaviourMaxKw}
                />
              </SimulatorPanel>
            </div>

            <div className="sim-compare-efficiency">
              <SimulatorPanel title="Efficiency" icon="📊" onExpand={() => openCompare('left', 'Efficiency', '📊', <EfficiencyPanel state={efficiencyState} />)}>
                <EfficiencyPanel state={efficiencyState} />
              </SimulatorPanel>
            </div>

            <div className="sim-compare-limiters">
              <SimulatorPanel title="System Limiters" icon="⚠" onExpand={() => openCompare('left', 'System Limiters', '⚠', <LimitersPanel state={limiterState} />)}>
                <LimitersPanel state={limiterState} />
              </SimulatorPanel>
            </div>

            <div className="sim-compare-inputs">
              <SimulatorPanel title="System Inputs" icon="🎛" onExpand={() => openCompare('left', 'System Inputs', '🎛', <SystemInputsPanel timeSpeed={timeSpeed} onTimeSpeedChange={setTimeSpeed} inputs={systemInputs} onInputChange={partial => setSystemInputs(prev => ({ ...prev, ...partial }))} systemChoice={systemChoice} portalMode={portalMode} />)}>
                <SystemInputsPanel
                  timeSpeed={timeSpeed}
                  onTimeSpeedChange={setTimeSpeed}
                  inputs={systemInputs}
                  onInputChange={partial => setSystemInputs(prev => ({ ...prev, ...partial }))}
                  systemChoice={systemChoice}
                  portalMode={portalMode}
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
              <SimulatorPanel title="System Diagram" icon="⚙" onExpand={() => openCompare('right', 'System Diagram', '⚙', <SystemDiagramPanel state={diagramStateImproved} highlightedComponents={highlightedComponentsImproved} boilerOutputKw={boilerOutputKwForDiagramImproved} />)}>
                <SystemDiagramPanel state={diagramStateImproved} highlightedComponents={highlightedComponentsImproved} boilerOutputKw={boilerOutputKwForDiagramImproved} />
              </SimulatorPanel>
            </div>

            {/* System Behaviour graph — shown early so dynamics are the second thing the user sees */}
            <div className="sim-compare-behaviour">
              <SimulatorPanel title="System Behaviour" icon="📈" onExpand={() => openCompare('right', 'System Behaviour', '📈', <BehaviourGraph timeline={behaviourTimelineImproved} systemChoice={systemChoiceImproved} maxKw={behaviourMaxKwImproved} />)}>
                <BehaviourGraph
                  timeline={behaviourTimelineImproved}
                  systemChoice={systemChoiceImproved}
                  maxKw={behaviourMaxKwImproved}
                />
              </SimulatorPanel>
            </div>

            <div className="sim-compare-efficiency">
              <SimulatorPanel title="Efficiency" icon="📊" onExpand={() => openCompare('right', 'Efficiency', '📊', <EfficiencyPanel state={efficiencyStateImproved} />)}>
                <EfficiencyPanel state={efficiencyStateImproved} />
              </SimulatorPanel>
            </div>

            <div className="sim-compare-limiters">
              <SimulatorPanel title="System Limiters" icon="⚠" onExpand={() => openCompare('right', 'System Limiters', '⚠', <LimitersPanel state={limiterStateImproved} />)}>
                <LimitersPanel state={limiterStateImproved} />
              </SimulatorPanel>
            </div>

            <div className="sim-compare-inputs">
              <SimulatorPanel title={`${compareLabels.proposed} Inputs`} icon="🎛" onExpand={() => openCompare('right', `${compareLabels.proposed} Inputs`, '🎛', <SystemInputsPanel timeSpeed={timeSpeed} onTimeSpeedChange={setTimeSpeed} inputs={improvedInputs} onInputChange={partial => setImprovedInputs(prev => ({ ...prev, ...partial }))} systemChoice={systemChoiceImproved} portalMode={portalMode} />)}>
                <SystemInputsPanel
                  timeSpeed={timeSpeed}
                  onTimeSpeedChange={setTimeSpeed}
                  inputs={improvedInputs}
                  onInputChange={partial => setImprovedInputs(prev => ({ ...prev, ...partial }))}
                  systemChoice={systemChoiceImproved}
                  portalMode={portalMode}
                />
              </SimulatorPanel>
            </div>
          </div>
        </div>

        {/* Half-screen expanded panel overlay for compare mode */}
        {expandedCompare != null && (
          <CompareHalfPanel
            title={expandedCompare.title}
            icon={expandedCompare.icon}
            side={expandedCompare.side}
            onClose={() => setExpandedCompare(null)}
          >
            {expandedCompare.content}
          </CompareHalfPanel>
        )}
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

      {/* Floor-plan operating assumptions badge */}
      {floorplanOperatingAssumptions != null && (
        <FloorplanOperatingBadge assumptions={floorplanOperatingAssumptions} />
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

      {/* System Behaviour graph — full-width row below daily summary */}
      <div className="sim-behaviour-row">
        <SimulatorPanel
          title="System Behaviour"
          icon="📈"
          onExpand={() => {}}
        >
          <BehaviourGraph
            timeline={behaviourTimeline}
            systemChoice={systemChoice}
            maxKw={behaviourMaxKw}
          />
        </SimulatorPanel>
      </div>

      {/* System Inputs — full-width row below behaviour graph */}
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
            portalMode={portalMode}
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
