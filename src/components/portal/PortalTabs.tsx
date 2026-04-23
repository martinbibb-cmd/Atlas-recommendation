/**
 * PortalTabs.tsx — Tab navigation bar for the five-tab portal surface.
 *
 * Simple presentational tab strip. Tab state is owned by the caller (PortalPage).
 * This component only renders the tab buttons and reports clicks.
 *
 * Rules:
 *   - No recommendation logic.
 *   - No routing — tab state stays local to PortalPage.
 *   - Keyboard-accessible via role="tablist" / role="tab".
 */

import type { PortalTabId, PortalViewModel } from '../../engine/modules/buildPortalViewModel';
import './PortalTabs.css';

interface Props {
  tabs: PortalViewModel['tabs'];
  activeTab: PortalTabId;
  onTabChange: (id: PortalTabId) => void;
}

export function PortalTabs({ tabs, activeTab, onTabChange }: Props) {
  return (
    <nav
      className="portal-tabs"
      role="tablist"
      aria-label="Portal navigation"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          id={`portal-tab-${tab.id}`}
          aria-controls={`portal-panel-${tab.id}`}
          aria-selected={tab.id === activeTab}
          className={`portal-tabs__tab${tab.id === activeTab ? ' portal-tabs__tab--active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
