import { AnalogyCard, EducationalCard, SafetyNoticeCard, TrustRecoveryCard } from '../../ui';
import type { EducationalContentV1 } from '../../content/EducationalContentV1';

export interface SequencedConceptCardPreviewProps {
  order: number;
  title: string;
  summary: string;
  content?: EducationalContentV1;
  sectionTitle: string;
  storyboardLabel?: string;
}

function getSequenceLabel(order: number, sectionTitle: string) {
  return `Step ${order} · ${sectionTitle}`;
}

export function SequencedConceptCardPreview({
  order,
  title,
  summary,
  content,
  sectionTitle,
  storyboardLabel,
}: SequencedConceptCardPreviewProps) {
  const analogy = content?.analogyOptions.find((option) => option.family !== 'none') ?? content?.analogyOptions[0];
  const sequenceLabel = getSequenceLabel(order, sectionTitle);

  if (content?.safetyNotice) {
    return (
      <div data-testid={`storyboard-sequenced-card-${order}`} data-sequence-order={order}>
        {storyboardLabel && <p className="atlas-storyboard-card-label">{storyboardLabel}</p>}
        <SafetyNoticeCard
          title={title}
          message={summary}
          whatToDoNext={content.livingWithSystemGuidance ?? content.safetyNotice}
          ariaLabel={sequenceLabel}
        />
      </div>
    );
  }

  if (analogy) {
    return (
      <div data-testid={`storyboard-sequenced-card-${order}`} data-sequence-order={order}>
        {storyboardLabel && <p className="atlas-storyboard-card-label">{storyboardLabel}</p>}
        <AnalogyCard
          title={title}
          analogy={analogy.explanation}
          whereItWorks={analogy.whereItWorks}
          whereItBreaks={analogy.whereItBreaks}
          ariaLabel={sequenceLabel}
        />
      </div>
    );
  }

  if (content?.commonMisunderstanding || content?.livingWithSystemGuidance) {
    return (
      <div data-testid={`storyboard-sequenced-card-${order}`} data-sequence-order={order}>
        {storyboardLabel && <p className="atlas-storyboard-card-label">{storyboardLabel}</p>}
        <TrustRecoveryCard
          title={title}
          thisCanHappen={content.commonMisunderstanding || summary}
          whatItMeans={content.plainEnglishSummary || summary}
          whatToDoNext={content.livingWithSystemGuidance || 'Use the next pack step when you are ready for more detail.'}
          ariaLabel={sequenceLabel}
        />
      </div>
    );
  }

  return (
    <div data-testid={`storyboard-sequenced-card-${order}`} data-sequence-order={order}>
      {storyboardLabel && <p className="atlas-storyboard-card-label">{storyboardLabel}</p>}
      <EducationalCard
        title={title}
        summary={summary}
        eyebrow={sequenceLabel}
        tone="fact"
        ariaLabel={sequenceLabel}
      />
    </div>
  );
}
