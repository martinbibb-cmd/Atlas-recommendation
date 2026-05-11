/**
 * PortalJourneyPrintPack.tsx
 *
 * A4-friendly print renderer for the open-vented → sealed + unvented portal
 * journey path.
 *
 * Design rules
 * ────────────
 *   - No interactive controls (no buttons, tabs, accordions)
 *   - No dev labels or raw engine identifiers visible to the customer
 *   - Diagrams rendered in print-safe mode (printSafe prop)
 *   - Page budget: 4–6 A4 pages
 *   - Content sourced from PortalJourneyPrintModelV1 — same content IDs as
 *     the portal journey sections
 */

import type { PortalJourneyPrintModelV1, PortalJourneyPrintSectionV1 } from './buildPortalJourneyPrintModel';
import { DiagramRenderer } from '../../diagrams/DiagramRenderer';
import './portalJourneyPrintPack.css';

// ─── Diagram ID mapping ───────────────────────────────────────────────────────
// Map suggestedDiagramIds from registry entries to the DiagramRenderer IDs.

const REGISTRY_DIAGRAM_ID_MAP: Record<string, string> = {
  'diagram-open-to-sealed': 'open_vented_to_unvented',
  'diagram-pressure-vs-storage': 'pressure_vs_storage',
  'diagram-unvented-safety': 'open_vented_to_unvented',
};

function resolveRendererDiagramId(registryId: string | undefined): string | null {
  if (!registryId) return null;
  return REGISTRY_DIAGRAM_ID_MAP[registryId] ?? null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface PrintCoverProps {
  cover: PortalJourneyPrintModelV1['cover'];
  pageNumber: number;
}

function PrintCover({ cover, pageNumber }: PrintCoverProps) {
  return (
    <section
      className="pjpp-page pjpp-page--cover"
      aria-label="Supporting Insight cover"
      data-testid="pjpp-cover"
      data-page={pageNumber}
    >
      <header className="pjpp-cover-header">
        {cover.brandName ? (
          <p className="pjpp-cover-brand" data-testid="pjpp-cover-brand">
            {cover.brandName}
          </p>
        ) : null}
        <h1 className="pjpp-cover-title" data-testid="pjpp-cover-title">
          {cover.title}
        </h1>
        <p className="pjpp-cover-summary" data-testid="pjpp-cover-summary">
          {cover.summary}
        </p>
      </header>

      {cover.customerFacts.length > 0 ? (
        <aside className="pjpp-cover-facts" aria-label="Your home" data-testid="pjpp-cover-facts">
          <p className="pjpp-cover-facts__label">Your home</p>
          <ul className="pjpp-cover-facts__list">
            {cover.customerFacts.map((fact, i) => (
              <li key={i} className="pjpp-cover-facts__item">
                {fact}
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </section>
  );
}

interface PrintSectionProps {
  section: PortalJourneyPrintSectionV1;
  pageNumber: number;
}

function PrintSection({ section, pageNumber }: PrintSectionProps) {
  const rendererDiagramId = resolveRendererDiagramId(section.diagramId);

  return (
    <section
      className={`pjpp-page pjpp-section pjpp-section--${section.sectionId}`}
      aria-labelledby={`pjpp-section-heading-${section.sectionId}`}
      data-testid={`pjpp-section-${section.sectionId}`}
      data-page={pageNumber}
    >
      <h2
        id={`pjpp-section-heading-${section.sectionId}`}
        className="pjpp-section__heading"
      >
        {section.heading}
      </h2>

      <p className="pjpp-section__summary">{section.summary}</p>

      {section.items.length > 0 ? (
        <ul className="pjpp-section__items" data-testid={`pjpp-items-${section.sectionId}`}>
          {section.items.map((item, i) => (
            <li key={i} className="pjpp-section__item">
              {item}
            </li>
          ))}
        </ul>
      ) : null}

      {rendererDiagramId ? (
        <figure
          className="pjpp-section__diagram"
          data-testid={`pjpp-diagram-${section.sectionId}`}
          data-print-safe="true"
        >
          <DiagramRenderer
            diagramId={rendererDiagramId}
            printSafe
            reducedMotion
          />
        </figure>
      ) : null}
    </section>
  );
}

interface PrintNextStepsProps {
  nextSteps: PortalJourneyPrintModelV1['nextSteps'];
  pageNumber: number;
}

function PrintNextSteps({ nextSteps, pageNumber }: PrintNextStepsProps) {
  return (
    <section
      className="pjpp-page pjpp-next-steps"
      aria-labelledby="pjpp-next-steps-heading"
      data-testid="pjpp-next-steps"
      data-page={pageNumber}
    >
      <h2 id="pjpp-next-steps-heading" className="pjpp-section__heading">
        Next steps
      </h2>

      <ol className="pjpp-next-steps__list" data-testid="pjpp-next-steps-list">
        {nextSteps.map((step, i) => (
          <li key={i} className="pjpp-next-steps__item">
            <strong className="pjpp-next-steps__label">{step.label}</strong>
            <p className="pjpp-next-steps__body">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

interface PrintQrDestinationsProps {
  qrDestinations: PortalJourneyPrintModelV1['qrDestinations'];
  pageNumber: number;
}

function PrintQrDestinations({ qrDestinations, pageNumber }: PrintQrDestinationsProps) {
  return (
    <section
      className="pjpp-page pjpp-qr-destinations"
      aria-labelledby="pjpp-qr-heading"
      data-testid="pjpp-qr-destinations"
      data-page={pageNumber}
    >
      <h2 id="pjpp-qr-heading" className="pjpp-section__heading">
        Go deeper
      </h2>

      <p className="pjpp-qr-destinations__intro">
        Scan each QR code for a diagram-guided walkthrough on your device.
      </p>

      <ul className="pjpp-qr-destinations__list" data-testid="pjpp-qr-list">
        {qrDestinations.map((dest, i) => (
          <li key={i} className="pjpp-qr-destination" data-testid={`pjpp-qr-item-${i}`}>
            <div
              className="pjpp-qr-destination__placeholder"
              aria-label={`QR code for: ${dest.heading}`}
              data-print-safe="true"
            />
            <div className="pjpp-qr-destination__text">
              <p className="pjpp-qr-destination__heading">{dest.heading}</p>
              <p className="pjpp-qr-destination__note">{dest.note}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface PortalJourneyPrintPackProps {
  model: PortalJourneyPrintModelV1;
}

/**
 * PortalJourneyPrintPack
 *
 * Renders the supporting PDF for the open-vented → sealed + unvented portal
 * journey.  Designed for A4 print output:
 *   - No interactive controls
 *   - No dev labels or raw engine identifiers
 *   - Diagrams in print-safe mode
 *   - Page budget respected (max 6 pages)
 */
export function PortalJourneyPrintPack({ model }: PortalJourneyPrintPackProps) {
  let pageCounter = 1;

  return (
    <article
      className="pjpp-document"
      data-testid="pjpp-document"
      data-print-safe="true"
      aria-label="Supporting Insight PDF"
    >
      <PrintCover cover={model.cover} pageNumber={pageCounter++} />

      {model.sections.map((section) => (
        <PrintSection
          key={section.sectionId}
          section={section}
          pageNumber={pageCounter++}
        />
      ))}

      <PrintNextSteps nextSteps={model.nextSteps} pageNumber={pageCounter++} />

      <PrintQrDestinations
        qrDestinations={model.qrDestinations}
        pageNumber={pageCounter}
      />
    </article>
  );
}
