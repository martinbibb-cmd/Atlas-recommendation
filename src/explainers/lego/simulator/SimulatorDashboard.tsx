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
import SimulatorPanel from './SimulatorPanel';
import ExpandedPanelModal from './ExpandedPanelModal';
import SystemDiagramPanel from './panels/SystemDiagramPanel';
import HouseStatusPanel from './panels/HouseStatusPanel';
import DrawOffStatusPanel from './panels/DrawOffStatusPanel';
import EfficiencyPanel from './panels/EfficiencyPanel';
import { useSystemDiagramPlayback } from './useSystemDiagramPlayback';
import type { SimulatorSystemChoice } from './useSystemDiagramPlayback';
import { useHousePlayback } from './useHousePlayback';
import { useDrawOffPlayback } from './useDrawOffPlayback';
import { useEfficiencyPlayback } from './useEfficiencyPlayback';
import './labDashboard.css';
import './labPanels.css';

type PanelId = 'system' | 'house' | 'drawoff' | 'efficiency';

const PANEL_METADATA: Record<PanelId, { title: string; icon: string }> = {
  system:     { title: 'System Diagram',  icon: '⚙'  },
  house:      { title: 'House View',      icon: '🏠' },
  drawoff:    { title: 'Draw-Off Status', icon: '💧' },
  efficiency: { title: 'Efficiency',      icon: '📊' },
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
}

function PhaseBar({
  phaseLabel, chActive, dhwActive, reheatActive, chPaused, isManualMode, onResetAuto,
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
      {isManualMode && (
        <>
          <span className="sim-phase-bar__divider" aria-hidden="true">·</span>
          <span className="sim-phase-badge sim-phase-badge--manual">Manual</span>
          <button
            className="sim-phase-bar__reset"
            onClick={onResetAuto}
            aria-label="Return to auto demo mode"
          >
            Auto ↺
          </button>
        </>
      )}
    </div>
  )
}

// ─── Demand controls ──────────────────────────────────────────────────────────

interface DemandControlsProps {
  heatingEnabled: boolean
  shower: boolean
  bath: boolean
  kitchen: boolean
  onToggleHeating: () => void
  onToggleShower: () => void
  onToggleBath: () => void
  onToggleKitchen: () => void
  onPresetOne: () => void
  onPresetTwo: () => void
  onPresetBathFill: () => void
  isCombi: boolean
}

function DemandControlsBar({
  heatingEnabled, shower, bath, kitchen,
  onToggleHeating, onToggleShower, onToggleBath, onToggleKitchen,
  onPresetOne, onPresetTwo, onPresetBathFill,
  isCombi,
}: DemandControlsProps) {
  return (
    <div className="sim-demand-controls" aria-label="Demand controls">
      {/* Heating toggle */}
      <button
        className={`sim-demand-btn${heatingEnabled ? ' sim-demand-btn--active' : ''}`}
        onClick={onToggleHeating}
        aria-pressed={heatingEnabled}
        aria-label={`Heating ${heatingEnabled ? 'on' : 'off'}`}
      >
        🔥 Heating {heatingEnabled ? 'On' : 'Off'}
      </button>

      {/* Outlet toggles */}
      <button
        className={`sim-demand-btn sim-demand-btn--outlet${shower ? ' sim-demand-btn--active' : ''}`}
        onClick={onToggleShower}
        aria-pressed={shower}
        aria-label={`Shower ${shower ? 'open' : 'closed'}`}
      >
        🚿 Shower
      </button>

      <button
        className={`sim-demand-btn sim-demand-btn--outlet${bath ? ' sim-demand-btn--active' : ''}`}
        onClick={onToggleBath}
        aria-pressed={bath}
        aria-label={`Bath ${bath ? 'open' : 'closed'}`}
      >
        🛁 Bath
      </button>

      <button
        className={`sim-demand-btn sim-demand-btn--outlet${kitchen ? ' sim-demand-btn--active' : ''}`}
        onClick={onToggleKitchen}
        aria-pressed={kitchen}
        aria-label={`Kitchen tap ${kitchen ? 'open' : 'closed'}`}
      >
        🚰 Kitchen
      </button>

      {/* Combi capacity warning */}
      {isCombi && (shower ? 1 : 0) + (bath ? 1 : 0) + (kitchen ? 1 : 0) >= 2 && (
        <span className="sim-demand-warning" aria-live="polite">
          ⚠ Concurrent demand — flow and temp reduced
        </span>
      )}

      {/* Presets */}
      <span className="sim-demand-controls__divider" aria-hidden="true">|</span>
      <button
        className="sim-demand-btn sim-demand-btn--preset"
        onClick={onPresetOne}
        aria-label="Preset: one outlet"
      >
        One outlet
      </button>
      <button
        className="sim-demand-btn sim-demand-btn--preset"
        onClick={onPresetTwo}
        aria-label="Preset: two outlets"
      >
        Two outlets
      </button>
      <button
        className="sim-demand-btn sim-demand-btn--preset"
        onClick={onPresetBathFill}
        aria-label="Preset: bath fill"
      >
        Bath fill
      </button>
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
  const {
    state: diagramState,
    systemChoice,
    setSystemChoice,
    demandControls,
    setDemandControls,
    isManualMode,
    resetToAutoMode,
  } = useSystemDiagramPlayback(initialSystemChoice);
  const houseState = useHousePlayback(diagramState);
  const drawOffState = useDrawOffPlayback(diagramState);
  const efficiencyState = useEfficiencyPlayback(diagramState);

  // Derive phase bar indicators from authoritative diagramState.
  const { systemMode, serviceSwitchingActive, hotDrawActive } = diagramState;
  const chActive = (systemMode === 'heating' || systemMode === 'heating_and_reheat') && !serviceSwitchingActive;
  const dhwActive = systemMode === 'dhw_draw' || hotDrawActive;
  const reheatActive = systemMode === 'dhw_reheat' || systemMode === 'heating_and_reheat';
  const chPaused = serviceSwitchingActive;
  const isCombi = systemChoice === 'combi';

  const expandedContent: Partial<Record<PanelId, React.ReactElement>> = {
    system: <SystemDiagramPanel state={diagramState} />,
    house:    <HouseStatusPanel state={houseState} />,
    drawoff:  <DrawOffStatusPanel state={drawOffState} />,
    efficiency: <EfficiencyPanel state={efficiencyState} />,
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
      />

      {/* Demand controls */}
      <DemandControlsBar
        heatingEnabled={demandControls.heatingEnabled}
        shower={demandControls.shower}
        bath={demandControls.bath}
        kitchen={demandControls.kitchen}
        onToggleHeating={() => setDemandControls({ heatingEnabled: !demandControls.heatingEnabled })}
        onToggleShower={() => setDemandControls({ shower: !demandControls.shower })}
        onToggleBath={() => setDemandControls({ bath: !demandControls.bath })}
        onToggleKitchen={() => setDemandControls({ kitchen: !demandControls.kitchen })}
        onPresetOne={() => setDemandControls({ shower: true, bath: false, kitchen: false })}
        onPresetTwo={() => setDemandControls({ shower: true, bath: true, kitchen: false })}
        onPresetBathFill={() => setDemandControls({ shower: false, bath: true, kitchen: false, heatingEnabled: false })}
        isCombi={isCombi}
      />

      <div className="sim-dashboard" data-testid="simulator-dashboard">
        {/* System Diagram — live animated */}
        <SimulatorPanel
          title="System Diagram"
          icon="⚙"
          onExpand={() => setExpanded('system')}
        >
          <SystemDiagramPanel state={diagramState} />
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
          <DrawOffStatusPanel state={drawOffState} />
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
