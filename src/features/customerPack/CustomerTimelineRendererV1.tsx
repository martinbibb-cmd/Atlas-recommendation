import type { CustomerEvidenceTimelineV1 } from '../legoTechnix/customerEvidence/CustomerEvidenceTimelineV1';

export interface CustomerTimelineRendererV1Props {
  readonly entries: readonly CustomerEvidenceTimelineV1[];
  readonly heading?: string;
}

function formatTimelineOffset(offsetSeconds: number): string {
  if (offsetSeconds >= 3600) {
    const hours = Math.floor(offsetSeconds / 3600);
    const minutes = Math.floor((offsetSeconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  if (offsetSeconds >= 60) {
    return `${Math.floor(offsetSeconds / 60)}m`;
  }

  return `${offsetSeconds}s`;
}

export function CustomerTimelineRendererV1({
  entries,
  heading = 'Timeline summary',
}: CustomerTimelineRendererV1Props) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="cprv1-timeline" data-testid="cprv1-timeline">
      <p className="cprv1-timeline__heading">{heading}</p>
      <ol className="cprv1-timeline__list">
        {entries.map((entry) => (
          <li
            key={`${entry.offsetSeconds}-${entry.label}`}
            className="cprv1-timeline__item"
            data-testid="cprv1-timeline-entry"
          >
            <span className="cprv1-timeline__offset">{formatTimelineOffset(entry.offsetSeconds)}</span>
            <div className="cprv1-timeline__content">
              <p className="cprv1-timeline__label">{entry.label}</p>
              <p className="cprv1-timeline__description">{entry.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
