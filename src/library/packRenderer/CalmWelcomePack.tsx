import type { CalmWelcomePackSectionV1, CalmWelcomePackViewModelV1 } from './CalmWelcomePackViewModelV1';
import { DiagramRenderer } from '../diagrams/DiagramRenderer';
import { getDiagramById } from '../diagrams/diagramExplanationRegistry';
import { educationalSequenceRules } from '../sequencing/educationalSequenceRules';
import { cardPriorityClass, cardPriorityAriaLabel, priorityFromSequenceStage } from '../ui/hierarchy';
import './calmWelcomePack.css';

export interface CalmWelcomePackProps {
  viewModel: CalmWelcomePackViewModelV1;
  printSafe?: boolean;
}

function renderCards(section: CalmWelcomePackSectionV1) {
  return (
    <ul className="cwpr-card-list">
      {section.cards.map((card) => {
        const rule = educationalSequenceRules.find((r) => r.conceptId === card.conceptId);
        const priority = priorityFromSequenceStage(rule?.sequenceStage ?? 'technical_detail');
        const priorityCls = cardPriorityClass(priority);
        const ariaLabel = cardPriorityAriaLabel(card.title, priority);
        return (
          <li
            key={`${section.sectionId}:${card.assetId ?? 'no-asset'}:${card.conceptId ?? card.title}`}
            className={`cwpr-card ${priorityCls}`}
            data-priority={priority}
          >
            <h3 className="cwpr-card-title" aria-label={ariaLabel}>{card.title}</h3>
            <p className="cwpr-card-summary">{card.summary}</p>
            {card.safetyNotice ? <p className="cwpr-card-safety">{card.safetyNotice}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

export function CalmWelcomePack({ viewModel, printSafe = false }: CalmWelcomePackProps) {
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

      {viewModel.customerFacingSections.map((section) => {
        if (section.cards.length === 0) {
          return null;
        }

        const sectionDiagramId = viewModel.diagramsBySection?.[section.sectionId]?.[0];
        const sectionDiagramExplanation = sectionDiagramId ? getDiagramById(sectionDiagramId) : undefined;

        return (
          <section
            key={section.sectionId}
            className={`cwpr-section cwpr-section--${section.sectionId}`}
            aria-labelledby={`cwpr-heading-${section.sectionId}`}
          >
            <h2 id={`cwpr-heading-${section.sectionId}`} className="cwpr-section-heading">{section.title}</h2>
            {renderCards(section)}
            {sectionDiagramId ? (
              <figure
                className="cwpr-diagram"
                data-testid={`cwpr-diagram-${section.sectionId}-${sectionDiagramId}`}
              >
                <DiagramRenderer diagramId={sectionDiagramId} printSafe={printSafe} />
                {sectionDiagramExplanation?.whatThisMeans ? (
                  <figcaption className="cwpr-diagram-caption">
                    {sectionDiagramExplanation.whatThisMeans}
                  </figcaption>
                ) : null}
              </figure>
            ) : null}
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
