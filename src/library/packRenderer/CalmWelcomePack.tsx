import type { CalmWelcomePackSectionV1, CalmWelcomePackViewModelV1 } from './CalmWelcomePackViewModelV1';
import './calmWelcomePack.css';

export interface CalmWelcomePackProps {
  viewModel: CalmWelcomePackViewModelV1;
}

const SECTION_ORDER: CalmWelcomePackSectionV1['sectionId'][] = [
  'calm_summary',
  'why_this_fits',
  'living_with_the_system',
  'relevant_explainers',
  'safety_and_compliance',
  'optional_technical_appendix',
  'next_steps',
];

function getSectionById(
  sections: CalmWelcomePackViewModelV1['customerFacingSections'],
  sectionId: CalmWelcomePackSectionV1['sectionId'],
) {
  return sections.find((section) => section.sectionId === sectionId);
}

function renderCards(section: CalmWelcomePackSectionV1) {
  return (
    <ul className="cwpr-card-list">
      {section.cards.map((card) => (
        <li
          key={`${section.sectionId}:${card.assetId ?? 'no-asset'}:${card.conceptId ?? card.title}`}
          className="cwpr-card"
        >
          <h3 className="cwpr-card-title">{card.title}</h3>
          <p className="cwpr-card-summary">{card.summary}</p>
          {card.safetyNotice ? <p className="cwpr-card-safety">{card.safetyNotice}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export function CalmWelcomePack({ viewModel }: CalmWelcomePackProps) {
  if (!viewModel.readiness.safeForCustomer) {
    return (
      <section className="cwpr-blocking-panel cwpr-print-friendly" aria-labelledby="cwpr-blocking-title" data-testid="cwpr-blocking-panel">
        <h2 id="cwpr-blocking-title">Customer pack unavailable</h2>
        <p>This calm welcome pack is not ready for customer sharing yet.</p>
      </section>
    );
  }

  return (
    <article className="cwpr-document cwpr-print-friendly" data-testid="cwpr-document">
      <header className="cwpr-header">
        {(viewModel.brandName || viewModel.brandLogoUrl) ? (
          <div className="cwpr-brand-header" data-testid="cwpr-brand-header">
            {viewModel.brandLogoUrl ? (
              <img
                className="cwpr-brand-logo"
                src={viewModel.brandLogoUrl}
                alt={viewModel.brandName ? `${viewModel.brandName} logo` : 'Brand logo'}
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
            {viewModel.brandName ? <p className="cwpr-brand-name">{viewModel.brandName}</p> : null}
          </div>
        ) : null}
        <h1 className="cwpr-title">{viewModel.title}</h1>
      </header>

      {SECTION_ORDER.map((sectionId) => {
        const section = getSectionById(viewModel.customerFacingSections, sectionId);
        if (!section || section.cards.length === 0) {
          return null;
        }

        return (
          <section
            key={section.sectionId}
            className={`cwpr-section cwpr-section--${section.sectionId}`}
            aria-labelledby={`cwpr-heading-${section.sectionId}`}
          >
            <h2 id={`cwpr-heading-${section.sectionId}`} className="cwpr-section-heading">{section.title}</h2>
            {renderCards(section)}
          </section>
        );
      })}

      <section className="cwpr-section cwpr-section--qr" aria-labelledby="cwpr-heading-qr">
        <h2 id="cwpr-heading-qr" className="cwpr-section-heading">QR and deeper detail</h2>
        {viewModel.qrDestinations.length === 0 ? (
          <p className="cwpr-qr-note">No additional QR deep-detail references are included in this pack.</p>
        ) : (
          <ul className="cwpr-qr-list">
            {viewModel.qrDestinations.map((item) => (
              <li key={`${item.assetId}:${item.destination}`} className="cwpr-qr-item">
                <p><strong>{item.title}</strong></p>
                <p>QR destination label: {item.destination}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(viewModel.brandContactLabel || viewModel.generatedAt || viewModel.visitReference) ? (
        <footer className="cwpr-footer" data-testid="cwpr-brand-footer">
          {viewModel.brandContactLabel ? <p className="cwpr-footer-line">Contact: {viewModel.brandContactLabel}</p> : null}
          {viewModel.visitReference ? <p className="cwpr-footer-line">Reference: {viewModel.visitReference}</p> : null}
          {viewModel.generatedAt ? <p className="cwpr-footer-line">Generated: {viewModel.generatedAt}</p> : null}
        </footer>
      ) : null}
    </article>
  );
}
