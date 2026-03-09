/**
 * ExplainersHubPage — entry point for the lab simulator.
 *
 * PR1: Replaced the House View / Advanced Builder split with a single
 * Simulator Dashboard (4-panel layout).
 *
 * Navigation uses local state (no router).
 */

import SimulatorDashboard from './lego/simulator/SimulatorDashboard';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onBack?: () => void;
}

// ─── View ─────────────────────────────────────────────────────────────────────

export default function ExplainersHubPage({ onBack }: Props) {
  return (
    <div className="hub-page">
      <div className="hub-page__header">
        {onBack && (
          <button className="hub-back-btn" onClick={onBack}>← Back</button>
        )}
        <div>
          <h1 className="hub-page__title">Simulator Dashboard</h1>
          <p className="hub-page__subtitle">Physics-first heating system simulator</p>
        </div>
      </div>

      <SimulatorDashboard />
    </div>
  );
}
