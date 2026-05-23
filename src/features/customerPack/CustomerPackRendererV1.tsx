import type { CustomerEvidencePackV1 } from '../legoTechnix/customerEvidence/CustomerEvidencePackV1';
import { CustomerPackSectionRendererV1 } from './CustomerPackSectionRendererV1';
import './customerPackRendererV1.css';

export interface CustomerPackRendererV1Props {
  readonly pack: CustomerEvidencePackV1;
}

export function CustomerPackRendererV1({ pack }: CustomerPackRendererV1Props) {
  return (
    <article className="cprv1-document" data-testid="cprv1-document">
      <header className="cprv1-cover" data-testid="cprv1-cover">
        <p className="cprv1-cover__eyebrow">Customer evidence pack</p>
        <h1 className="cprv1-cover__title">{pack.systemLabel}</h1>
        <p className="cprv1-cover__summary" data-testid="cprv1-recommendation-summary">
          {pack.recommendationSummary}
        </p>
      </header>

      <div className="cprv1-sections">
        {pack.sections.map((section, index) => (
          <CustomerPackSectionRendererV1 key={section.id} section={section} index={index} />
        ))}
      </div>
    </article>
  );
}
