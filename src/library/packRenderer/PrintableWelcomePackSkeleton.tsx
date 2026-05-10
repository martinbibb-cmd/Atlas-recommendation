import type { PrintableWelcomePackSectionV1, PrintableWelcomePackViewModelV1 } from './PrintableWelcomePackViewModelV1';
import { getPrintEquivalentForAsset } from '../printEquivalents/getPrintEquivalentForAsset';
import { DiagramRenderer } from '../diagrams/DiagramRenderer';
import { getDiagramsForConcepts } from '../diagrams/diagramLookup';
import './printableWelcomePack.css';

export interface PrintableWelcomePackSkeletonProps {
  viewModel: PrintableWelcomePackViewModelV1;
}

const HIDE_WHEN_EMPTY = new Set<PrintableWelcomePackSectionV1['sectionId']>([
  'safety_and_compliance',
  'optional_technical_appendix',
]);

function renderAssetPlaceholders(assetIds: string[], sectionId: PrintableWelcomePackSectionV1['sectionId']) {
  if (assetIds.length === 0) {
    return <p className="pwps-placeholder-note">Content pending: no assets planned for this section yet.</p>;
  }

  return (
    <ul className="pwps-asset-list" aria-label={`${sectionId} asset placeholders`}>
      {assetIds.map((assetId) => {
        const printEquivalent = getPrintEquivalentForAsset(assetId);
        if (printEquivalent) {
          return (
            <li key={assetId} className="pwps-asset-card pwps-asset-card--print-equivalent" data-testid={`pwps-print-equivalent-${assetId}`}>
              <strong className="pwps-asset-card__title">{printEquivalent.printTitle}</strong>
              <span className="pwps-asset-card__id">{assetId}</span>
              <p className="pwps-asset-card__summary">{printEquivalent.summary}</p>
              <ol className="pwps-asset-card__steps">
                {printEquivalent.steps.map((step) => (
                  <li key={`${assetId}-${step}`}>{step}</li>
                ))}
              </ol>
              <p className="pwps-asset-card__labels">
                <strong>Labels:</strong>
                {' '}
                {printEquivalent.labels.join(', ')}
              </p>
              <p className="pwps-asset-card__a11y">
                <strong>Accessibility:</strong>
                {' '}
                {printEquivalent.accessibilityNotes}
              </p>
              {printEquivalent.qrDeepDiveLabel ? (
                <p className="pwps-asset-card__qr-label">
                  <strong>Deep dive:</strong>
                  {' '}
                  {printEquivalent.qrDeepDiveLabel}
                </p>
              ) : null}
            </li>
          );
        }

        return (
          <li key={assetId} className="pwps-asset-card" data-testid={`pwps-asset-placeholder-${assetId}`}>
            <strong className="pwps-asset-card__title">Asset placeholder</strong>
            <span className="pwps-asset-card__id">{assetId}</span>
            <span className="pwps-asset-card__note">Content pending: static print treatment will replace interactive media.</span>
          </li>
        );
      })}
    </ul>
  );
}

function renderPrintSafeDiagram(conceptIds: string[], sectionId: PrintableWelcomePackSectionV1['sectionId']) {
  const firstMatchingDiagram = getDiagramsForConcepts(conceptIds)[0];
  if (!firstMatchingDiagram) {
    return null;
  }

  return (
    <figure className="pwps-asset-card pwps-asset-card--print-equivalent" data-testid={`pwps-diagram-${sectionId}-${firstMatchingDiagram.diagramId}`}>
      <strong className="pwps-asset-card__title">{firstMatchingDiagram.title}</strong>
      <DiagramRenderer diagramId={firstMatchingDiagram.diagramId} printSafe reducedMotion />
      <figcaption className="pwps-asset-card__summary">{firstMatchingDiagram.whatThisMeans}</figcaption>
    </figure>
  );
}

export function PrintableWelcomePackSkeleton({ viewModel }: PrintableWelcomePackSkeletonProps) {
  const sectionById = new Map(viewModel.sections.map((section) => [section.sectionId, section]));
  const orderedSections = [
    'calm_summary',
    'why_this_fits',
    'living_with_the_system',
    'relevant_explainers',
    'safety_and_compliance',
    'optional_technical_appendix',
    'next_steps',
  ] as const;

  return (
    <article className="pwps-document pwps-print-friendly" data-testid="pwps-document">
      <header className="pwps-cover">
        <h1 className="pwps-title">{viewModel.title}</h1>
        <p className="pwps-subtitle">{viewModel.subtitle}</p>
        <dl className="pwps-meta" aria-label="Pack metadata">
          <div>
            <dt>Pack ID</dt>
            <dd>{viewModel.packId}</dd>
          </div>
          <div>
            <dt>Archetype</dt>
            <dd>{viewModel.archetypeId}</dd>
          </div>
          <div>
            <dt>Scenario</dt>
            <dd>{viewModel.recommendedScenarioId}</dd>
          </div>
          <div>
            <dt>Pages</dt>
            <dd>{viewModel.pageEstimate.usedPages} / {viewModel.pageEstimate.maxPages}</dd>
          </div>
        </dl>
      </header>

      {orderedSections.map((sectionId) => {
        const section = sectionById.get(sectionId);
        if (!section) {
          return null;
        }

        if (HIDE_WHEN_EMPTY.has(sectionId) && section.assetIds.length === 0 && section.conceptIds.length === 0) {
          return null;
        }

        return (
          <section key={section.sectionId} className={`pwps-section pwps-section--${section.sectionId}`} aria-labelledby={`pwps-heading-${section.sectionId}`}>
            <h2 id={`pwps-heading-${section.sectionId}`} className="pwps-section-heading">
              {section.title}
            </h2>
            <p className="pwps-purpose">{section.purpose}</p>
            <p className="pwps-placeholder">{section.placeholderText}</p>
            {renderAssetPlaceholders(section.assetIds, section.sectionId)}
            {renderPrintSafeDiagram(section.conceptIds, section.sectionId)}
          </section>
        );
      })}

      <section className="pwps-section pwps-section--qr" aria-labelledby="pwps-heading-qr">
        <h2 id="pwps-heading-qr" className="pwps-section-heading">QR and deeper detail</h2>
        {viewModel.qrDestinations.length === 0 ? (
          <p className="pwps-placeholder-note">Content pending: no deferred QR destinations in this pack.</p>
        ) : (
          <ul className="pwps-qr-list">
            {viewModel.qrDestinations.map((item) => (
              <li
                key={`${item.assetId}:${item.destination}`}
                className="pwps-qr-item"
                data-testid={`pwps-asset-placeholder-${item.assetId}`}
              >
                <p><strong>Asset:</strong> {item.assetId}</p>
                <p><strong>Destination:</strong> {item.destination}</p>
                <p><strong>Status:</strong> Content pending.</p>
                <p><strong>Reason:</strong> {item.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="pwps-print-notes" aria-label="Print notes">
        <h2 className="pwps-section-heading">Print notes</h2>
        <ul>
          {viewModel.printNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </aside>
    </article>
  );
}
