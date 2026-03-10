/**
 * ExplainersHubPage — entry point for the lab simulator.
 *
 * PR6: Added SimulatorStepper setup journey before the simulator dashboard.
 * The stepper captures system type, components, water services, building
 * physics, and condition — then opens the simulator with the chosen config.
 */

import { useState } from 'react';
import SimulatorDashboard from './lego/simulator/SimulatorDashboard';
import SimulatorStepper from './lego/simulator/SimulatorStepper';
import type { StepperConfig } from './lego/simulator/SimulatorStepper';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onBack?: () => void;
}

// ─── View ─────────────────────────────────────────────────────────────────────

export default function ExplainersHubPage({ onBack }: Props) {
  const [config, setConfig] = useState<StepperConfig | null>(null);

  // Stepper complete → show simulator dashboard with the chosen system.
  if (config !== null) {
    return (
      <div className="hub-page">
        <div className="hub-page__header">
          {onBack && (
            <button className="hub-back-btn" onClick={onBack}>← Back</button>
          )}
          <button
            className="hub-back-btn"
            onClick={() => setConfig(null)}
            aria-label="Return to setup"
          >
            ⚙ Setup
          </button>
          <div>
            <h1 className="hub-page__title">Simulator Dashboard</h1>
            <p className="hub-page__subtitle">Physics-first heating system simulator</p>
          </div>
        </div>

        <SimulatorDashboard initialSystemChoice={config.systemChoice} />
      </div>
    );
  }

  // Show stepper first.
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

      <SimulatorStepper onComplete={(cfg) => setConfig(cfg)} />
    </div>
  );
}
