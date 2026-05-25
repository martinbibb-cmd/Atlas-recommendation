import type { CustomerEvidencePackV1 } from '../legoTechnix/customerEvidence/CustomerEvidencePackV1';
import { CUSTOMER_EVIDENCE_SECTION_IDS_V1 } from '../legoTechnix/customerEvidence/CustomerEvidenceSectionV1';
import { CustomerPackSectionRendererV1 } from './CustomerPackSectionRendererV1';
import './customerPackRendererV1.css';

export interface CustomerPackRendererV1Props {
  readonly pack: CustomerEvidencePackV1;
}

export function CustomerPackRendererV1({ pack }: CustomerPackRendererV1Props) {
  // Apply deterministic canonical ordering and exclude sections with no evidence content.
  const contentSections = CUSTOMER_EVIDENCE_SECTION_IDS_V1
    .map((id) => pack.sections.find((s) => s.id === id))
    .filter(
      (section): section is NonNullable<typeof section> =>
        section !== undefined &&
        (section.cards.length > 0 ||
          section.warnings.length > 0 ||
          section.timelineSummaries.length > 0),
    );

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

      <div className="cprv1-sections">
        {contentSections.map((section, index) => (
          <CustomerPackSectionRendererV1 key={section.id} section={section} index={index} />
        ))}
      </div>
    </article>
  );
}
