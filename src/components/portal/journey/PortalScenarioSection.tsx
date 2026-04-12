/**
 * PortalScenarioSection.tsx
 *
 * Section F — "Try your own what-if scenarios."
 *
 * Simulator exploration comes after the recommendation and proof, not before.
 * Framed as curiosity/exploration — not doubt about the recommendation.
 * Each scenario is a CTA that launches the existing simulator flow.
 */

import type { JourneyScenario } from '../types/portalJourney.types';

interface Props {
  scenarios: JourneyScenario[];
  /** Callback when a scenario CTA is activated. Launches the simulator. */
  onLaunchScenario: (scenarioId: string) => void;
}

export default function PortalScenarioSection({ scenarios, onLaunchScenario }: Props) {
  if (scenarios.length === 0) return null;

  return (
    <section
      className="portal-section portal-journey-scenarios"
      aria-labelledby="portal-scenarios-heading"
      data-testid="portal-scenario-section"
    >
      <h2 className="portal-section__heading" id="portal-scenarios-heading">
        See how it behaves in your home
      </h2>

      <p className="portal-section__intro">
        The recommendation is based on your survey. Use these prompts to explore
        how the system performs under different conditions — without changing the advice.
      </p>

      <div className="portal-scenarios__grid" data-testid="portal-scenarios-grid">
        {scenarios.map((scenario) => (
          <div
            key={scenario.id}
            className="portal-scenario-card"
            data-testid={`portal-scenario-${scenario.id}`}
          >
            <h3 className="portal-scenario-card__title">{scenario.title}</h3>
            <p className="portal-scenario-card__description">{scenario.description}</p>
            <button
              className="portal-scenario-card__cta"
              onClick={() => onLaunchScenario(scenario.id)}
              data-testid={`portal-scenario-cta-${scenario.id}`}
            >
              Explore this scenario
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
