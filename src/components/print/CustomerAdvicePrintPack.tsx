/**
 * CustomerAdvicePrintPack.tsx
 *
 * PR27 — Customer advice pack print/PDF output.
 *
 * Generates a print-friendly advice pack from the same VisualBlock[] /
 * AtlasDecisionV1 truth used by the deck and portal, replacing the old
 * report-shaped output as the primary customer print surface.
 *
 * Design intent:
 *   - One block per physical page (A4 portrait)
 *   - Visual-first: large icon, short title, one-sentence outcome
 *   - Warnings/advisories visible but softened (not alarming)
 *   - Spatial proof included only when present in visualBlocks
 *   - Portal CTA includes link/QR placeholder when portalUrl is provided
 *
 * Rules:
 *   - No new recommendation logic — all content from VisualBlock[]
 *   - No duplicate report-specific copy
 *   - No customer-facing diagnostic/internal artefacts
 *   - Print CSS separate and predictable (CustomerAdvicePrintPack.css)
 *   - No Math.random()
 */

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import type { VisualBlock, PortalCtaBlock } from '../../contracts/VisualBlock';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { PortalLaunchContext } from '../../contracts/PortalLaunchContext';
import { HeroBlockView }          from '../presentation/blocks/HeroBlockView';
import { FactsBlockView }         from '../presentation/blocks/FactsBlockView';
import { ProblemBlockView }       from '../presentation/blocks/ProblemBlockView';
import { SolutionBlockView }      from '../presentation/blocks/SolutionBlockView';
import { DailyUseBlockView }      from '../presentation/blocks/DailyUseBlockView';
import { IncludedScopeBlockView } from '../presentation/blocks/IncludedScopeBlockView';
import { WarningBlockView }       from '../presentation/blocks/WarningBlockView';
import { FutureUpgradeBlockView } from '../presentation/blocks/FutureUpgradeBlockView';
import { SpatialProofBlockView }  from '../presentation/blocks/SpatialProofBlockView';
import type {
  HeroBlock,
  FactsBlock,
  ProblemBlock,
  SolutionBlock,
  DailyUseBlock,
  IncludedScopeBlock,
  WarningBlock,
  FutureUpgradeBlock,
  SpatialProofBlock,
} from '../../contracts/VisualBlock';
import '../presentation/CustomerDeck.css';
import './CustomerAdvicePrintPack.css';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CustomerAdvicePrintPackProps {
  /** Canonical decision output — source of truth for all pack content. */
  decision: AtlasDecisionV1;
  /** All evaluated scenarios — used alongside decision for block content. */
  scenarios: ScenarioResult[];
  /**
   * Ordered visual blocks from buildVisualBlocks().
   * This is the single source of truth consumed by both the deck and this pack.
   */
  visualBlocks: VisualBlock[];
  /**
   * Optional portal launch context for the CTA block.
   * When provided, the portal URL area renders with a link/QR placeholder.
   */
  portalLaunchContext?: PortalLaunchContext;
  /**
   * Signed portal URL for the QR code / print link.
   * When provided, the portal CTA section shows the URL and a QR code image.
   * When absent, a placeholder box is shown instead.
   */
  portalUrl?: string;
  /** Visit date string, shown in the pack footer and on-screen title. */
  visitDate?: string;
  /** Called when the user clicks Back on the screen toolbar. */
  onBack?: () => void;
}

// ─── QR code image ────────────────────────────────────────────────────────────

function QRCodeImage({ url }: { url: string }) {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!url || !imgRef.current) return;
    QRCode.toDataURL(url, {
      width: 144,
      margin: 1,
      color: { dark: '#1a202c', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((dataUrl) => {
        if (!cancelled && imgRef.current) imgRef.current.src = dataUrl;
      })
      .catch(() => {/* best-effort — QR unavailable is not fatal */});
    return () => { cancelled = true; };
  }, [url]);

  return (
    <img
      ref={imgRef}
      alt="Portal QR code"
      width={72}
      height={72}
    />
  );
}

// ─── Portal CTA print section ─────────────────────────────────────────────────

/**
 * PrintPortalCta
 *
 * Print-safe portal call-to-action.  Renders inside the portal_cta block page.
 * Shows the URL as plain text and a QR code image when portalUrl is present.
 * Falls back to a placeholder box when no URL is available.
 *
 * Rules:
 *   - No token generation here — portalUrl must be pre-built by the caller.
 *   - QR code is purely presentational; meaning is carried by the text URL.
 */
function PrintPortalCta({ portalUrl }: { portalUrl?: string }) {
  return (
    <div className="capp-portal-cta" data-testid="capp-portal-cta-section">
      <div className="capp-portal-cta__text">
        <p className="capp-portal-cta__heading">Open your portal</p>
        <p className="capp-portal-cta__sub">
          See the interactive model, explore alternatives, and share your recommendation.
        </p>
        {portalUrl ? (
          <p className="capp-portal-cta__url" data-testid="capp-portal-url">
            {portalUrl}
          </p>
        ) : (
          <p className="capp-portal-cta__url capp-portal-cta__url--placeholder" data-testid="capp-portal-url-placeholder">
            Your portal link will be shared by your installer.
          </p>
        )}
      </div>

      <div className="capp-portal-cta__qr-area" aria-label="Portal QR code">
        {portalUrl ? (
          <QRCodeImage url={portalUrl} />
        ) : (
          <p className="capp-portal-cta__qr-placeholder" aria-label="QR code placeholder">
            QR code<br />will appear<br />here
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Block renderer ───────────────────────────────────────────────────────────

/**
 * Renders the appropriate block view for a given VisualBlock.
 * portal_cta is handled separately in renderBlockPage to allow the
 * print CTA section to be appended within the same page.
 */
function renderBlockContent(block: VisualBlock): React.ReactElement | null {
  switch (block.type) {
    case 'hero':           return <HeroBlockView           block={block as HeroBlock} />;
    case 'facts':          return <FactsBlockView          block={block as FactsBlock} />;
    case 'problem':        return <ProblemBlockView        block={block as ProblemBlock} />;
    case 'solution':       return <SolutionBlockView       block={block as SolutionBlock} />;
    case 'daily_use':      return <DailyUseBlockView       block={block as DailyUseBlock} />;
    case 'included_scope': return <IncludedScopeBlockView  block={block as IncludedScopeBlock} />;
    case 'warning':        return <WarningBlockView        block={block as WarningBlock} />;
    case 'future_upgrade': return <FutureUpgradeBlockView  block={block as FutureUpgradeBlock} />;
    case 'spatial_proof':  return <SpatialProofBlockView   block={block as SpatialProofBlock} />;
    case 'portal_cta':     return null; // handled separately in renderBlockPage
    default:               return null;
  }
}

/** Maps a block type to a page-level modifier class for tinting. */
function pageModifier(block: VisualBlock): string {
  if (block.type === 'hero')        return 'capp-page--hero';
  if (block.type === 'portal_cta')  return 'capp-page--portal-cta';
  if (block.type === 'warning') {
    const w = block as WarningBlock;
    return `capp-page--warning-${w.severity}`;
  }
  return '';
}

/** Human-readable section label for the top of each page. */
const SECTION_LABELS: Partial<Record<VisualBlock['type'], string>> = {
  hero:           'Recommendation',
  facts:          'Your home',
  problem:        'Current system',
  solution:       'Why this works',
  daily_use:      'Day-to-day life',
  included_scope: 'What is included',
  warning:        'Something to consider',
  future_upgrade: 'Future options',
  portal_cta:     'Your portal',
  spatial_proof:  'Where the work happens',
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * CustomerAdvicePrintPack
 *
 * Renders the customer advice pack from VisualBlock[].  Each block occupies
 * one A4 page with a page-break-after so the pack prints cleanly as a PDF.
 *
 * Screen view: toolbar with Back + Print, then stacked A4 pages with shadow.
 * Print view:  toolbar hidden, pages fill the physical paper with margins.
 */
export function CustomerAdvicePrintPack({
  decision,
  scenarios: _scenarios,
  visualBlocks,
  portalUrl,
  visitDate,
  onBack,
}: CustomerAdvicePrintPackProps) {
  const packTitle = `Atlas advice pack${visitDate ? ` — ${visitDate}` : ''}`;
  const headline  = decision.headline;

  return (
    <div className="capp-wrap" data-testid="capp-wrap">
      {/* ── Screen toolbar ── */}
      <div className="capp-toolbar" data-testid="capp-toolbar">
        {onBack && (
          <button
            className="capp-toolbar__back"
            type="button"
            onClick={onBack}
            data-testid="capp-back-button"
          >
            ← Back
          </button>
        )}
        <button
          className="capp-toolbar__print"
          type="button"
          onClick={() => window.print()}
          data-testid="capp-print-button"
        >
          🖨 Print / Save PDF
        </button>
        <span className="capp-toolbar__title">{packTitle}</span>
      </div>

      {/* ── Document ── */}
      <div className="capp-document" data-testid="capp-document">
        {visualBlocks.length === 0 && (
          <section
            className="capp-page capp-page--empty"
            data-testid="capp-empty-state"
            aria-label="Advice pack not yet available"
          >
            <p className="capp-page__label">Advice pack</p>
            <div className="customer-deck__block">
              <div className="customer-deck__block-body">
                <h2 className="customer-deck__title">Pack not yet available</h2>
                <p className="customer-deck__outcome">
                  The advice pack will be ready once the survey has been completed and a recommendation generated.
                </p>
              </div>
            </div>
          </section>
        )}
        {visualBlocks.map((block, index) => {
          const isPortalCta = block.type === 'portal_cta';
          const ctaBlock = isPortalCta ? (block as PortalCtaBlock) : null;
          const modifier = pageModifier(block);
          const label    = SECTION_LABELS[block.type] ?? '';
          const isLast   = index === visualBlocks.length - 1;

          return (
            <section
              key={block.id}
              className={`capp-page${modifier ? ` ${modifier}` : ''}`}
              data-testid={`capp-block-${block.type}`}
              data-block-id={block.id}
              aria-label={label || block.title}
            >
              {/* Section label */}
              {label && (
                <p className="capp-page__label" aria-hidden="true">{label}</p>
              )}

              {/* Block content — portal_cta handled inline below */}
              {isPortalCta ? (
                <>
                  {/* Portal CTA heading from the block */}
                  <div className="customer-deck__block customer-deck__block--portal-cta">
                    <div className="customer-deck__block-body">
                      <h2 className="customer-deck__title">{ctaBlock?.title ?? 'Open your portal'}</h2>
                      <p  className="customer-deck__outcome">{ctaBlock?.outcome ?? 'Explore the interactive model, costs, and comparison in your portal.'}</p>
                      {ctaBlock?.supportingPoints && ctaBlock.supportingPoints.length > 0 && (
                        <ul className="customer-deck__supporting-points" aria-label="What you can do">
                          {ctaBlock.supportingPoints.slice(0, 3).map((point) => (
                            <li key={point} className="customer-deck__supporting-point">
                              <span className="customer-deck__point-marker" aria-hidden="true">✓</span>
                              {point}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Print-safe portal CTA */}
                  <PrintPortalCta portalUrl={portalUrl} />
                </>
              ) : (
                renderBlockContent(block)
              )}

              {/* Footer strip */}
              <footer className="capp-page__footer" aria-hidden="true">
                {headline}
                {isLast && visitDate ? ` · ${visitDate}` : ''}
              </footer>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default CustomerAdvicePrintPack;
