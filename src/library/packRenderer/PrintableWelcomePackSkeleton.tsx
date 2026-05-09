import type { PrintableWelcomePackSectionV1, PrintableWelcomePackViewModelV1 } from './PrintableWelcomePackViewModelV1';
import './printableWelcomePack.css';

export interface PrintableWelcomePackSkeletonProps {
  viewModel: PrintableWelcomePackViewModelV1;
}

function renderAssetPlaceholders(assetIds: string[], sectionId: PrintableWelcomePackSectionV1['sectionId']) {
  if (assetIds.length === 0) {
    return <p className="pwps-placeholder-note">Content pending: no assets planned for this section yet.</p>;
  }

  return (
    <ul className="pwps-asset-list" aria-label={`${sectionId} asset placeholders`}>
      {assetIds.map((assetId) => (
        <li key={assetId} className="pwps-asset-card" data-testid={`pwps-asset-placeholder-${assetId}`}>
          <strong className="pwps-asset-card__title">Asset placeholder</strong>
          <span className="pwps-asset-card__id">{assetId}</span>
          <span className="pwps-asset-card__note">Content pending: static print treatment will replace interactive media.</span>
        </li>
      ))}
    </ul>
  );
}

function renderSectionHeading(section: PrintableWelcomePackSectionV1): string {
  switch (section.sectionId) {
    case 'calm_summary':
      return 'What Atlas found';
    case 'why_this_fits':
      return 'Why this fits';
    case 'living_with_the_system':
      return 'Living with your system';
    case 'relevant_explainers':
      return 'Relevant explainers';
    case 'safety_and_compliance':
      return 'Safety and compliance';
    case 'optional_technical_appendix':
      return 'Optional technical appendix';
    case 'next_steps':
      return 'Next steps';
    default:
      return section.title;
  }
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

        if (sectionId === 'safety_and_compliance' && section.assetIds.length === 0 && section.conceptIds.length === 0) {
          return null;
        }

        if (sectionId === 'optional_technical_appendix' && section.assetIds.length === 0 && section.conceptIds.length === 0) {
          return null;
        }

        return (
          <section key={section.sectionId} className={`pwps-section pwps-section--${section.sectionId}`} aria-labelledby={`pwps-heading-${section.sectionId}`}>
            <h2 id={`pwps-heading-${section.sectionId}`} className="pwps-section-heading">
              {renderSectionHeading(section)}
            </h2>
            <p className="pwps-purpose">{section.purpose}</p>
            <p className="pwps-placeholder">{section.placeholderText}</p>
            {renderAssetPlaceholders(section.assetIds, section.sectionId)}
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

export default PrintableWelcomePackSkeleton;
