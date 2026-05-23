import type { CustomerEvidenceMetricV1 } from '../legoTechnix/customerEvidence/CustomerEvidenceMetricV1';
import type { CustomerEvidenceCardV1 } from '../legoTechnix/customerEvidence/CustomerEvidenceCardV1';
import { CustomerConfidenceBadgeV1 } from './CustomerConfidenceBadgeV1';
import { CustomerTimelineRendererV1 } from './CustomerTimelineRendererV1';

export interface CustomerEvidenceCardRendererV1Props {
  readonly card: CustomerEvidenceCardV1;
}

function formatMetricValue(metric: CustomerEvidenceMetricV1): string {
  const value = `${metric.value}`;
  return metric.unit ? `${value} ${metric.unit}` : value;
}

export function CustomerEvidenceCardRendererV1({ card }: CustomerEvidenceCardRendererV1Props) {
  return (
    <article
      className={`cprv1-card cprv1-card--${card.type}`}
      data-testid={`cprv1-card-${card.type}`}
    >
      <header className="cprv1-card__header">
        <div>
          <h3 className="cprv1-card__title">{card.heading}</h3>
          <p className="cprv1-card__summary">{card.summary}</p>
        </div>
        {card.confidenceWording ? <CustomerConfidenceBadgeV1 wording={card.confidenceWording} /> : null}
      </header>

      {card.metrics.length > 0 ? (
        <dl className="cprv1-metrics" data-testid="cprv1-card-metrics">
          {card.metrics.map((metric, metricIndex) => (
            <div
              key={`${metric.label}-${metricIndex}`}
              className="cprv1-metrics__item"
            >
              <dt className="cprv1-metrics__label">{metric.label}</dt>
              <dd className="cprv1-metrics__value">{formatMetricValue(metric)}</dd>
              <dd className="cprv1-metrics__confidence">
                <CustomerConfidenceBadgeV1 wording={metric.confidenceWording} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {card.warnings.length > 0 ? (
        <ul className="cprv1-warning-list" data-testid="cprv1-card-warnings">
          {card.warnings.map((warning, index) => (
            <li
              key={`${warning.message}-${index}`}
              className={`cprv1-warning-chip cprv1-warning-chip--${warning.severity}`}
              data-severity={warning.severity}
              data-category={warning.category}
            >
              <span className="cprv1-warning-chip__severity">{warning.severity}</span>
              <span>{warning.message}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {card.timelineEntries?.length ? (
        <CustomerTimelineRendererV1 entries={card.timelineEntries} heading="Timeline summary" />
      ) : null}
    </article>
  );
}
