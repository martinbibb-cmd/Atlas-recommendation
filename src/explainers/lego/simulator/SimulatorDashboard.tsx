/**
 * SimulatorDashboard — 4-panel simulator layout.
 *
 * Panels (2×2 grid):
 *  - top-left:     System Diagram (live animated schematic — PR2)
 *  - top-right:    House View
 *  - bottom-left:  Draw-Off Status
 *  - bottom-right: Efficiency
 *
 * The System Diagram panel is driven by useSystemDiagramPlayback, which uses
 * service-arbitration truth (resolveServiceMode / computeServiceSwitchingActive)
 * as the authoritative source for animation state.
 *
 * Tapping any panel opens an ExpandedPanelModal with the same content enlarged.
 */

import { useState } from 'react';
import SimulatorPanel from './SimulatorPanel';
import ExpandedPanelModal from './ExpandedPanelModal';
import SystemDiagramPanel from './panels/SystemDiagramPanel';
import HouseStatusPanel from './panels/HouseStatusPanel';
import DrawOffStatusPanel from './panels/DrawOffStatusPanel';
import EfficiencyPanel from './panels/EfficiencyPanel';
import { useSystemDiagramPlayback } from './useSystemDiagramPlayback';
import { useHousePlayback } from './useHousePlayback';
import { useDrawOffPlayback } from './useDrawOffPlayback';
import type { SystemType } from '../animation/types';
import './labDashboard.css';
import './labPanels.css';

type PanelId = 'system' | 'house' | 'drawoff' | 'efficiency';

const PANEL_METADATA: Record<PanelId, { title: string; icon: string }> = {
  system:     { title: 'System Diagram',  icon: '⚙'  },
  house:      { title: 'House View',      icon: '🏠' },
  drawoff:    { title: 'Draw-Off Status', icon: '💧' },
  efficiency: { title: 'Efficiency',      icon: '📊' },
};

const SYSTEM_TYPE_OPTIONS: { value: SystemType; label: string }[] = [
  { value: 'combi',              label: 'Combi'    },
  { value: 'unvented_cylinder',  label: 'Stored'   },
  { value: 'vented_cylinder',    label: 'Vented'   },
];

export default function SimulatorDashboard() {
  const [expanded, setExpanded] = useState<PanelId | null>(null);
  const { state: diagramState, systemType, setSystemType } = useSystemDiagramPlayback();
  const houseState = useHousePlayback(diagramState);
  const drawOffState = useDrawOffPlayback(diagramState);

  const expandedContent: Partial<Record<PanelId, React.ReactElement>> = {
    system: <SystemDiagramPanel state={diagramState} />,
    house:    <HouseStatusPanel state={houseState} />,
    drawoff:  <DrawOffStatusPanel state={drawOffState} />,
    efficiency: <EfficiencyPanel />,
  };

  return (
    <>
      {/* System-type selector — controls which system the diagram animates */}
      <div className="sim-system-selector" aria-label="System type selector">
        {SYSTEM_TYPE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`sim-system-selector__btn${systemType === opt.value ? ' sim-system-selector__btn--active' : ''}`}
            onClick={() => setSystemType(opt.value)}
            aria-pressed={systemType === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>

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

        {/* Efficiency — shell */}
        <SimulatorPanel
          title="Efficiency"
          icon="📊"
          onExpand={() => setExpanded('efficiency')}
        >
          <EfficiencyPanel />
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
