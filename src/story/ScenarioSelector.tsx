/**
 * ScenarioSelector.tsx
 *
 * Grid of scenario cards. The advisor clicks one to enter Story Mode for
 * the selected scenario.
 */
import type { StoryScenario } from './scenarioRegistry';
import { STORY_SCENARIOS } from './scenarioRegistry';

interface Props {
  onSelect: (scenarioId: string) => void;
}

export default function ScenarioSelector({ onSelect }: Props) {
  return (
    <div className="story-selector">
      <h2>Select a scenario</h2>
      <p className="story-selector__subtitle">
        Choose the situation that best describes the conversation.
      </p>
      <div className="story-scenario-grid">
        {STORY_SCENARIOS.map((scenario: StoryScenario) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            onSelect={() => onSelect(scenario.id)}
          />
        ))}
        <PlaceholderCard
          title="Heat pump enquiry"
          description="Assess whether an air source heat pump is viable for this property."
        />
      </div>
    </div>
  );
}

function ScenarioCard({
  scenario,
  onSelect,
}: {
  scenario: StoryScenario;
  onSelect: () => void;
}) {
  return (
    <div className="story-scenario-card" onClick={onSelect} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}>
      <h3 className="story-scenario-card__title">{scenario.title}</h3>
      <p className="story-scenario-card__description">{scenario.description}</p>
      <button className="cta-btn story-scenario-card__cta" onClick={e => { e.stopPropagation(); onSelect(); }}>
        Start →
      </button>
    </div>
  );
}

function PlaceholderCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="story-scenario-card story-scenario-card--placeholder" aria-disabled="true">
      <h3 className="story-scenario-card__title">{title}</h3>
      <p className="story-scenario-card__description">{description}</p>
      <button className="cta-btn story-scenario-card__cta" disabled>
        Coming soon
      </button>
    </div>
  );
}
