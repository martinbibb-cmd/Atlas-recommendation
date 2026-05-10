import '../educationalUi.css';

type HeadingLevel = 2 | 3 | 4 | 5 | 6;

function renderHeading(level: HeadingLevel, title: string) {
  switch (level) {
    case 2:
      return <h2 className="atlas-edu-step-sequence__title">{title}</h2>;
    case 3:
      return <h3 className="atlas-edu-step-sequence__title">{title}</h3>;
    case 4:
      return <h4 className="atlas-edu-step-sequence__title">{title}</h4>;
    case 5:
      return <h5 className="atlas-edu-step-sequence__title">{title}</h5>;
    default:
      return <h6 className="atlas-edu-step-sequence__title">{title}</h6>;
  }
}

export interface StepSequenceProps {
  steps: readonly string[];
  title?: string;
  label?: string;
  ariaLabel?: string;
  headingLevel?: HeadingLevel;
}

export function StepSequence({
  steps,
  title,
  label = 'Step sequence',
  ariaLabel,
  headingLevel = 3,
}: StepSequenceProps) {
  return (
    <section className="atlas-edu-step-sequence" aria-label={ariaLabel ?? label}>
      <p className="atlas-edu-step-sequence__label">{label}</p>
      {title ? renderHeading(headingLevel, title) : null}
      <ol className="atlas-edu-step-sequence__list">
        {steps.map((step) => (
          <li key={step} className="atlas-edu-step-sequence__item">
            <span className="atlas-edu-step-sequence__item-text">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
