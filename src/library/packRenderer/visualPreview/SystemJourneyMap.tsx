import { PreviewIcon, type PreviewIconName } from './PreviewIcon';

export interface SystemJourneyStep {
  id: string;
  label: string;
  icon: PreviewIconName;
  description?: string;
}

export interface SystemJourneyMapProps {
  steps: readonly SystemJourneyStep[];
}

export function SystemJourneyMap({ steps }: SystemJourneyMapProps) {
  return (
    <section className="atlas-storyboard-panel" aria-labelledby="atlas-storyboard-journey-title">
      <div className="atlas-storyboard-panel__header">
        <p className="atlas-storyboard-panel__eyebrow">Journey map</p>
        <h2 id="atlas-storyboard-journey-title" className="atlas-storyboard-panel__title">
          Home now → What changes → What you may notice → How to use it → What to keep safe → Go deeper
        </h2>
      </div>
      <ol className="atlas-storyboard-journey" data-testid="storyboard-journey-map">
        {steps.map((step) => (
          <li key={step.id} className="atlas-storyboard-journey__step">
            <div className="atlas-storyboard-journey__badge">
              <PreviewIcon name={step.icon} className="atlas-storyboard-journey__icon" />
            </div>
            <div>
              <p className="atlas-storyboard-journey__label">{step.label}</p>
              {step.description ? <p className="atlas-storyboard-journey__description">{step.description}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
