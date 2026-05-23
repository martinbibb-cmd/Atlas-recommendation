import type { CustomerEvidencePackV1 } from '../legoTechnix/customerEvidence/CustomerEvidencePackV1';
import { CustomerPackSectionRendererV1 } from './CustomerPackSectionRendererV1';
import { buildCustomerRecommendationEvidenceV1 } from './customerPackCopyBuildersV1';
import './customerPackRendererV1.css';

export interface CustomerPackRendererV1Props {
  readonly pack: CustomerEvidencePackV1;
}

export function CustomerPackRendererV1({ pack }: CustomerPackRendererV1Props) {
  const recommendationEvidence = buildCustomerRecommendationEvidenceV1(pack);

  return (
    <article
      className="cprv1-document"
      data-testid="cprv1-document"
      data-visual-tokens="customer-pack-v1"
      data-layout-mode="print-and-portal"
    >
      <header className="cprv1-cover" data-testid="cprv1-cover">
        <p className="cprv1-cover__eyebrow">Homeowner heating summary</p>
        <h1 className="cprv1-cover__title">{pack.systemLabel}</h1>
        <p className="cprv1-cover__summary" data-testid="cprv1-recommendation-summary">
          {pack.recommendationSummary}
        </p>
      </header>

      <section className="cprv1-recommendation-evidence" data-testid="cprv1-recommendation-evidence">
        <h2 className="cprv1-section__heading">Why this system suits your home</h2>
        <dl className="cprv1-recommendation-evidence__list">
          <div>
            <dt className="cprv1-section__eyebrow">Chosen system label</dt>
            <dd>{recommendationEvidence.chosenSystemLabel}</dd>
          </div>
          <div>
            <dt className="cprv1-section__eyebrow">Why it fits this household</dt>
            <dd>{recommendationEvidence.whyItFitsThisHome}</dd>
          </div>
          <div>
            <dt className="cprv1-section__eyebrow">What Atlas simulated</dt>
            <dd>{recommendationEvidence.whatAtlasSimulated}</dd>
          </div>
          <div>
            <dt className="cprv1-section__eyebrow">What remains to be confirmed</dt>
            <dd>{recommendationEvidence.whatRemainsToBeConfirmed}</dd>
          </div>
        </dl>
      </section>

      <div className="cprv1-sections">
        {pack.sections.map((section, index) => (
          <CustomerPackSectionRendererV1 key={section.id} section={section} index={index} />
        ))}
      </div>
    </article>
  );
}
