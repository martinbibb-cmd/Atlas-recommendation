/**
 * SimulatorDashboard — 4-panel simulator layout.
 *
 * Panels (2×2 grid):
 *  - top-left:     System Diagram (live animated schematic)
 *  - top-right:    House View
 *  - bottom-left:  Draw-Off Status
 *  - bottom-right: Efficiency
 *
 * The System Diagram panel is driven by useSystemDiagramPlayback, which uses
 * service-arbitration truth (resolveServiceMode / computeServiceSwitchingActive)
 * as the authoritative source for animation state.
 *
 * Tapping any panel opens an ExpandedPanelModal with the same content enlarged.
 *
 * PR6: Added sim-time/phase bar, demand controls, and correct system-type options.
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
import type { SystemInputs } from './systemInputsTypes';
import { DEFAULT_SYSTEM_INPUTS } from './systemInputsTypes';
import { useSystemDiagramPlayback } from './useSystemDiagramPlayback';
import type { SimulatorSystemChoice } from './useSystemDiagramPlayback';
import { useHousePlayback } from './useHousePlayback';
import { useDrawOffPlayback } from './useDrawOffPlayback';
import { useEfficiencyPlayback } from './useEfficiencyPlayback';
import { useLimiterPlayback } from './useLimiterPlayback';
import { useEmitterPrimaryModel } from './useEmitterPrimaryModel';
import './labDashboard.css';
import './labPanels.css';

type PanelId = 'system' | 'house' | 'drawoff' | 'efficiency' | 'limiters' | 'inputs';

const PANEL_METADATA: Record<PanelId, { title: string; icon: string }> = {
  system:     { title: 'System Diagram',  icon: '⚙'  },
  house:      { title: 'House View',      icon: '🏠' },
  drawoff:    { title: 'Draw-Off Status', icon: '💧' },
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

// ─── Dashboard ────────────────────────────────────────────────────────────────

interface Props {
  /** Initial system choice, e.g. from the setup stepper. */
  initialSystemChoice?: SimulatorSystemChoice
}

export default function SimulatorDashboard({ initialSystemChoice = 'combi' }: Props) {
  const [expanded, setExpanded] = useState<PanelId | null>(null);
  const [timeSpeed, setTimeSpeed] = useState(1);
  const [systemInputs, setSystemInputs] = useState<SystemInputs>(DEFAULT_SYSTEM_INPUTS);

  const {
    state: diagramState,
    systemChoice,
    setSystemChoice,
    demandControls,
    setDemandControls,
    isManualMode,
    resetToAutoMode,
    setManualMode,
  } = useSystemDiagramPlayback(initialSystemChoice, timeSpeed);
  const houseState = useHousePlayback(diagramState);
  const drawOffState = useDrawOffPlayback(diagramState);
  const emitterState = useEmitterPrimaryModel({
    emitterCapacityFactor: systemInputs.emitterCapacityFactor,
    primaryPipeSize: systemInputs.primaryPipeSize,
    emitterType: systemInputs.emitterType,
    weatherCompensation: systemInputs.weatherCompensation,
  });
  const efficiencyState = useEfficiencyPlayback(diagramState, emitterState);
  const limiterState = useLimiterPlayback(diagramState, systemInputs.combiPowerKw, systemInputs.coldInletTempC, emitterState);

  // Derive highlighted schematic components from active limiters.
  // targetComponent may be a single string or an array, so flatten both forms.
  const highlightedComponents = limiterState.activeLimiters
    .flatMap(l => {
      if (!l.targetComponent) return []
      return Array.isArray(l.targetComponent) ? l.targetComponent : [l.targetComponent]
    });

  // Derive phase bar indicators from authoritative diagramState.
  const { systemMode, serviceSwitchingActive, hotDrawActive } = diagramState;
  const chActive = (systemMode === 'heating' || systemMode === 'heating_and_reheat') && !serviceSwitchingActive;
  const dhwActive = systemMode === 'dhw_draw' || hotDrawActive;
  const reheatActive = systemMode === 'dhw_reheat' || systemMode === 'heating_and_reheat';
  const chPaused = serviceSwitchingActive;

  const drawOffPanel = (
    <DrawOffStatusPanel
      state={drawOffState}
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

  const expandedContent: Partial<Record<PanelId, ReactElement>> = {
    system: <SystemDiagramPanel state={diagramState} highlightedComponents={highlightedComponents} />,
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

  return (
    <>
      {/* System-type selector */}
      <div className="sim-system-selector" aria-label="System type selector">
        {SYSTEM_CHOICE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`sim-system-selector__btn${systemChoice === opt.value ? ' sim-system-selector__btn--active' : ''}`}
            onClick={() => setSystemChoice(opt.value)}
            aria-pressed={systemChoice === opt.value}
            title={opt.description}
          >
            {opt.label}
          </button>
        ))}
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
          <SystemDiagramPanel state={diagramState} highlightedComponents={highlightedComponents} />
        </SimulatorPanel>

        {/* House View — live playback */}
        <SimulatorPanel
          title="House View"
          icon="🏠"
          onExpand={() => setExpanded('house')}
        >
          <HouseStatusPanel state={houseState} />
        </SimulatorPanel>

        {/* Draw-Off Status — live via useDrawOffPlayback */}
        <SimulatorPanel
          title="Draw-Off Status"
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

      {/* System Inputs — full-width row below limiters */}
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
