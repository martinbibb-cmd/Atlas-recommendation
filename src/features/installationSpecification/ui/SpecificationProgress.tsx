/**
 * SpecificationProgress.tsx
 *
 * Blue-pill stepper progress bar for the Installation Specification.
 *
 * Renders:
 *  - A horizontal fill bar (0 → 100 %) driven by the current step index.
 *  - A scrollable row of blue pill step labels.
 *    Active step = solid blue, completed steps = green, future = grey.
 */

export interface SpecificationProgressProps {
  /** Ordered list of step display labels. */
  steps: string[];
  /** Zero-based index of the currently active step. */
  currentStep: number;
}

export function SpecificationProgress({
  steps,
  currentStep,
}: SpecificationProgressProps) {
  const totalSteps = steps.length;
  const pct =
    totalSteps <= 1
      ? 100
      : Math.round((currentStep / (totalSteps - 1)) * 100);

  return (
    <div className="qp-progress">
      <div className="qp-progress__bar-track">
        <div
          className="qp-progress__bar-fill"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Installation specification progress"
        />
      </div>
      <div className="qp-progress__steps" role="list">
        {steps.map((step, i) => {
          let modifier: string;
          if (i === currentStep) {
            modifier = 'active';
          } else if (i < currentStep) {
            modifier = 'complete';
          } else {
            modifier = 'pending';
          }
          return (
            <span
              key={step}
              role="listitem"
              className={`qp-progress__step qp-progress__step--${modifier}`}
              aria-current={i === currentStep ? 'step' : undefined}
            >
              {step}
            </span>
          );
        })}
      </div>
    </div>
  );
}
