import { PrintSafePanel, StepSequence } from '../ui';

type HeadingLevel = 2 | 3 | 4 | 5 | 6;

export interface JourneyComparisonPanelProps {
  headingLevel?: HeadingLevel;
}

export function JourneyComparisonPanel({
  headingLevel = 3,
}: JourneyComparisonPanelProps) {
  return (
    <PrintSafePanel
      title="Journey comparison panel"
      intro="Each journey keeps the same educational flow while adjusting format and pacing to match customer accessibility preferences."
      ariaLabel="Journey comparison panel"
      headingLevel={headingLevel}
    >
      <StepSequence
        title="Print-first"
        label="Accessibility mode"
        headingLevel={4}
        ariaLabel="Print-first adaptation"
        steps={[
          'Keep key actions visible in one glance.',
          'Avoid hover-only content and animation dependencies.',
          'Use short action lists that remain clear on paper.',
        ]}
      />
      <StepSequence
        title="Dyslexia"
        label="Accessibility mode"
        headingLevel={4}
        ariaLabel="Dyslexia adaptation"
        steps={[
          'Use one idea per sentence and short paragraphs.',
          'Repeat key terms consistently without jargon drift.',
          'Pair each warning with one clear next action.',
        ]}
      />
      <StepSequence
        title="ADHD"
        label="Accessibility mode"
        headingLevel={4}
        ariaLabel="ADHD adaptation"
        steps={[
          'Keep section goals explicit and visible.',
          'Use compact cards with progressive disclosure.',
          'Place trust-recovery guidance near expectation cards.',
        ]}
      />
      <StepSequence
        title="Reduced motion"
        label="Accessibility mode"
        headingLevel={4}
        ariaLabel="Reduced motion adaptation"
        steps={[
          'All information remains available in static card states.',
          'No meaning depends on animated transitions.',
          'Print-safe and reduced-motion paths stay equivalent.',
        ]}
      />
    </PrintSafePanel>
  );
}
