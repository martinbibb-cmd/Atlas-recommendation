/**
 * SimulatorDashboard — 4-panel simulator layout.
 *
 * Panels (2×2 grid):
 *  - top-left:     System Diagram
 *  - top-right:    House View
 *  - bottom-left:  Draw-Off Status
 *  - bottom-right: Efficiency
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
import './labDashboard.css';
import './labPanels.css';

type PanelId = 'system' | 'house' | 'drawoff' | 'efficiency';

import type { ReactElement } from 'react';

interface PanelConfig {
  id: PanelId;
  title: string;
  icon: string;
  content: ReactElement;
}

const PANELS: PanelConfig[] = [
  {
    id: 'system',
    title: 'System Diagram',
    icon: '⚙',
    content: <SystemDiagramPanel />,
  },
  {
    id: 'house',
    title: 'House View',
    icon: '🏠',
    content: <HouseStatusPanel />,
  },
  {
    id: 'drawoff',
    title: 'Draw-Off Status',
    icon: '💧',
    content: <DrawOffStatusPanel />,
  },
  {
    id: 'efficiency',
    title: 'Efficiency',
    icon: '📊',
    content: <EfficiencyPanel />,
  },
];

export default function SimulatorDashboard() {
  const [expanded, setExpanded] = useState<PanelId | null>(null);

  const expandedPanel = expanded ? PANELS.find(p => p.id === expanded) : null;

  return (
    <>
      <div className="sim-dashboard" data-testid="simulator-dashboard">
        {PANELS.map(panel => (
          <SimulatorPanel
            key={panel.id}
            title={panel.title}
            icon={panel.icon}
            onExpand={() => setExpanded(panel.id)}
          >
            {panel.content}
          </SimulatorPanel>
        ))}
      </div>

      {expandedPanel && (
        <ExpandedPanelModal
          title={expandedPanel.title}
          icon={expandedPanel.icon}
          onClose={() => setExpanded(null)}
        >
          {expandedPanel.content}
        </ExpandedPanelModal>
      )}
    </>
  );
}
