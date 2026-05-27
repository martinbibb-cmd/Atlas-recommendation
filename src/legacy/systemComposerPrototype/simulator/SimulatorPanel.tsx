/**
 * SimulatorPanel — reusable panel card shell with tap-to-expand affordance.
 *
 * Props:
 *  - title: panel heading
 *  - icon: emoji / character shown beside title
 *  - onExpand: called when the card is clicked
 *  - children: panel body content
 */

import type { ReactNode } from 'react';

interface Props {
  title: string;
  icon: string;
  onExpand: () => void;
  children: ReactNode;
}

export default function SimulatorPanel({ title, icon, onExpand, children }: Props) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onExpand();
    }
  }

  return (
    <div
      className="sim-panel"
      onClick={onExpand}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Expand ${title}`}
    >
      <div className="sim-panel__header">
        <span className="sim-panel__icon" aria-hidden="true">{icon}</span>
        <h3 className="sim-panel__title">{title}</h3>
        <span className="sim-panel__expand" aria-hidden="true">⤢</span>
      </div>
      <div className="sim-panel__body">
        {children}
      </div>
    </div>
  );
}
