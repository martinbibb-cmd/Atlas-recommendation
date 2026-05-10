import { PrintActionCard } from '../ui';

type HeadingLevel = 2 | 3 | 4 | 5 | 6;

export interface CustomerConfusionChecklistProps {
  journeyLabel: string;
  confusionRisks: readonly string[];
  assumptions: readonly string[];
  reinforcements: readonly string[];
  headingLevel?: HeadingLevel;
}

export function CustomerConfusionChecklist({
  journeyLabel,
  confusionRisks,
  assumptions,
  reinforcements,
  headingLevel = 4,
}: CustomerConfusionChecklistProps) {
  return (
    <PrintActionCard
      title={`${journeyLabel} confusion checklist`}
      ariaLabel={`${journeyLabel} confusion checklist`}
      headingLevel={headingLevel}
      steps={[
        ...confusionRisks.map((risk) => `Could still confuse: ${risk}`),
        ...assumptions.map((assumption) => `Assumption to validate: ${assumption}`),
        ...reinforcements.map((need) => `Expectation to reinforce: ${need}`),
      ]}
      note="Use this checklist during handover to reduce avoidable call-backs and protect trust."
    />
  );
}
