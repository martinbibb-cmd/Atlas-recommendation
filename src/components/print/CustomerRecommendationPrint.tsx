/**
 * CustomerRecommendationPrint.tsx
 *
 * Premium A4 customer recommendation document.
 *
 * Design intent — this document should feel like:
 *   • Confident (not defensive)
 *   • Clear in under 10 seconds
 *   • Credible without being technical
 *   • Worth showing to a partner / landlord
 *
 * Layout (A4 portrait, 12-column grid, 24px margins):
 *   Header band  (~25%) — recommendation anchor
 *   Body         (~50%) — story (7 cols) + evidence (5 cols)
 *   Footer       (~25%) — portal CTA + QR code
 *
 * Data source:
 *   Bound exclusively to CanonicalPresentationModel (buildCanonicalPresentation).
 *   No raw survey fields; no engineering jargon in user-facing copy.
 *
 * Rules:
 *   - Max 3 bullets per story section.
 *   - No "not recorded" — hide missing fields instead.
 *   - No default comparison block — only rendered when a comparison option exists.
 *   - No Math.random() — deterministic.
 */

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  buildCanonicalPresentation,
  type CanonicalPresentationModel,
} from '../presentation/buildCanonicalPresentation';
import type { FullEngineResult, EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { RecommendationResult } from '../../engine/recommendation/RecommendationModel';
import type { PrioritiesState } from '../../features/survey/priorities/prioritiesTypes';
import './CustomerRecommendationPrint.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  result: FullEngineResult;
  input: EngineInputV2_3;
  recommendationResult?: RecommendationResult;
  prioritiesState?: PrioritiesState;
  /** Portal URL to encode as a QR code. */
  portalUrl?: string;
  /** Customer name, if known. */
  customerName?: string;
  /** Visit date string. */
  visitDate?: string;
  /** Called when the user clicks Back (screen only). */
  onBack?: () => void;
}

// ─── QR code image ────────────────────────────────────────────────────────────

function QRCodeImage({ url }: { url: string }) {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!url || !imgRef.current) return;
    QRCode.toDataURL(url, {
      width: 220,
      margin: 1,
      color: { dark: '#1a202c', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then(dataUrl => {
        if (!cancelled && imgRef.current) imgRef.current.src = dataUrl;
      })
      .catch(() => {/* silently fail — QR is a convenience */});
    return () => { cancelled = true; };
  }, [url]);

  return (
    <img
      ref={imgRef}
      className="crp-footer__qr-img"
      alt="QR code linking to your interactive home heating recommendation"
      width={110}
      height={110}
    />
  );
}

// ─── Derive presentation data ─────────────────────────────────────────────────

/**
 * Build the human-readable system name from the top-ranked physics option.
 * Falls back to a neutral label when the ranking is empty.
 */
function resolveSystemName(model: CanonicalPresentationModel): string {
  const top = model.page3.items[0];
  return top?.label ?? 'Recommended system';
}

/**
 * Build up to 3 "why recommended" bullets from the top option's reason lines.
 * Draws on demandFitNote, waterFitNote, infrastructureFitNote, energyFitNote
 * (in that order) and trims to at most 3 items.
 */
function buildWhyBullets(model: CanonicalPresentationModel): string[] {
  const top = model.page3.items[0];
  if (!top) return [];
  const candidates = [
    top.demandFitNote,
    top.waterFitNote,
    top.infrastructureFitNote,
    top.energyFitNote,
  ].filter((n): n is string => typeof n === 'string' && n.trim().length > 0);
  return candidates.slice(0, 3);
}

/**
 * Build up to 4 outcome-language improvement bullets from the top shortlisted
 * option's bestPerformanceUpgrades list.
 */
function buildImprovementBullets(model: CanonicalPresentationModel): string[] {
  const top = model.page4Plus.options[0];
  if (!top) return [];
  return top.bestPerformanceUpgrades.slice(0, 4);
}

/**
 * Resolve the optional comparison candidate — the second-ranked physics option.
 * Returns null when there is no meaningful alternative to show.
 */
function resolveComparisonCandidate(
  model: CanonicalPresentationModel,
): { label: string; reasonLine: string } | null {
  const second = model.page3.items[1];
  if (!second || second.overallScore === 0) return null;
  return { label: second.label, reasonLine: second.reasonLine };
}

/**
 * Build required-work items from the top shortlisted option.
 */
function buildRequiredWork(model: CanonicalPresentationModel): string[] {
  const top = model.page4Plus.options[0];
  if (!top) return [];
  return top.requiredWork;
}

/**
 * Build recommended (optional) work items from the top shortlisted option's
 * bestPerformanceUpgrades list — capped at 4.
 */
function buildRecommendedWork(model: CanonicalPresentationModel): string[] {
  const top = model.page4Plus.options[0];
  if (!top) return [];
  return top.bestPerformanceUpgrades.slice(0, 4);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SummaryChip {
  icon: string;
  label: string;
  value: string;
}

function SummaryChips({ chips }: { chips: SummaryChip[] }) {
  return (
    <div className="crp-header__chips" aria-label="Recommendation summary">
      {chips.map(chip => (
        <div key={chip.label} className="crp-chip">
          <span className="crp-chip__icon" aria-hidden="true">{chip.icon}</span>
          <span className="crp-chip__label">{chip.label}:</span>
          <span className="crp-chip__value">{chip.value}</span>
        </div>
      ))}
    </div>
  );
}

interface FactBlock {
  icon: string;
  heading: string;
  rows: Array<{ label: string; value: string }>;
}

function FactsBlock({ block }: { block: FactBlock }) {
  return (
    <div className="crp-facts" aria-label={block.heading}>
      <p className="crp-facts__heading">
        <span aria-hidden="true">{block.icon}</span>
        {block.heading}
      </p>
      <div className="crp-facts__rows">
        {block.rows.map(row => (
          <div key={row.label} className="crp-fact-row">
            <span className="crp-fact-row__label">{row.label}</span>
            <span className="crp-fact-row__value">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomerRecommendationPrint({
  result,
  input,
  recommendationResult,
  prioritiesState,
  portalUrl,
  customerName,
  visitDate,
  onBack,
}: Props) {
  const model = buildCanonicalPresentation(result, input, recommendationResult, prioritiesState);
  const { page1, page4Plus } = model;

  // ── Derived presentation data ───────────────────────────────────────────

  const systemName     = resolveSystemName(model);
  const whyBullets     = buildWhyBullets(model);
  const improvements   = buildImprovementBullets(model);
  const comparison     = resolveComparisonCandidate(model);
  const requiredWork   = buildRequiredWork(model);
  const recommendedWork = buildRecommendedWork(model);

  const topDetail = page4Plus.options[0] ?? null;

  const today = visitDate ?? new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // ── Summary chips ───────────────────────────────────────────────────────

  const { home, house, currentSystem } = page1;

  const occupancyText = (() => {
    const occupancy = input.occupancyCount ?? 2;
    const bathrooms = input.bathroomCount ?? 1;
    return `${occupancy} ${occupancy === 1 ? 'person' : 'people'}, ${bathrooms} ${bathrooms === 1 ? 'bathroom' : 'bathrooms'}`;
  })();

  const demandText = home.peakSimultaneousOutlets >= 2
    ? 'Multiple outlets at once'
    : 'Single outlet at a time';

  const bestForText = topDetail?.dhwArchitecture === 'on_demand'
    ? 'On-demand hot water'
    : 'Tank-fed hot water';

  const summaryChips: SummaryChip[] = [
    { icon: '✔', label: 'Best for',    value: bestForText },
    { icon: '✔', label: 'Household',   value: occupancyText },
    { icon: '✔', label: 'Demand',      value: demandText },
    { icon: '✔', label: 'Confidence',  value: 'Based on survey data' },
  ];

  // ── Fact blocks ─────────────────────────────────────────────────────────

  /**
   * Hide rows whose value is empty, a placeholder dash, or a "not recorded" label.
   * Spec rule: "Never show not recorded — if missing, hide it."
   */
  const PLACEHOLDER_DASH = '—';
  const NOT_RECORDED_RE = /not recorded/i;
  const isVisibleRow = (row: { value: string }): boolean =>
    row.value !== '' && row.value !== PLACEHOLDER_DASH && !NOT_RECORDED_RE.test(row.value);

  const homeFactRows = [
    { label: 'Heat loss',   value: house.heatLossLabel },
    { label: 'Insulation',  value: house.insulationLabel },
    { label: 'Walls',       value: house.wallTypeLabel },
  ].filter(isVisibleRow);

  const householdFactRows = [
    { label: 'Occupants',  value: `${input.occupancyCount ?? 2} ${(input.occupancyCount ?? 2) === 1 ? 'person' : 'people'}` },
    { label: 'Bathrooms',  value: `${input.bathroomCount ?? 1} ${(input.bathroomCount ?? 1) === 1 ? 'bathroom' : 'bathrooms'}` },
    { label: 'Peak demand', value: home.peakOutletsLabel },
  ].filter(isVisibleRow);

  const currentSystemRows: Array<{ label: string; value: string }> = [];
  if (currentSystem.systemTypeLabel) {
    currentSystemRows.push({ label: 'Current system', value: currentSystem.systemTypeLabel });
  }
  if (currentSystem.dhwArchitecture === 'standard_cylinder' || currentSystem.dhwArchitecture === 'mixergy') {
    currentSystemRows.push({ label: 'Hot water',  value: 'Tank-fed hot water' });
  } else if (currentSystem.dhwArchitecture === 'on_demand') {
    currentSystemRows.push({ label: 'Hot water',  value: 'On-demand hot water' });
  }
  if (currentSystem.ageLabel) {
    currentSystemRows.push({ label: 'Age', value: currentSystem.ageLabel });
  }

  // ── Portal URL display ───────────────────────────────────────────────────

  const displayUrl = portalUrl ?? window.location.href;

  return (
    <div className="crp-wrap">

      {/* ── Screen toolbar (hidden on print) ───────────────────────────── */}
      <div className="crp-toolbar" aria-hidden="false">
        {onBack && (
          <button type="button" className="crp-toolbar__back" onClick={onBack}>
            ← Back
          </button>
        )}
        <span className="crp-toolbar__label">
          {customerName ? `Recommendation for ${customerName}` : 'Customer Recommendation'}
        </span>
        <button
          type="button"
          className="crp-toolbar__print"
          onClick={() => window.print()}
        >
          🖨 Print / Save PDF
        </button>
      </div>

      {/* ── A4 page ─────────────────────────────────────────────────────── */}
      <div className="crp-page" data-testid="customer-recommendation-print">

        {/* ════════════════════════════════════════════════════════════════
            HEADER BAND
            ════════════════════════════════════════════════════════════════ */}
        <header className="crp-header" aria-label="Recommendation header">

          {/* Left — dominant recommendation anchor */}
          <div className="crp-header__left">
            <p className="crp-header__eyebrow">
              <span className="crp-header__brand">ATLAS</span>
              <span className="crp-header__recommended-pill">Recommended</span>
            </p>
            <p className="crp-header__title">
              Our recommendation for your home
              {customerName ? ` — ${customerName}` : ''}
            </p>
            <h1 className="crp-header__system-name">{systemName}</h1>
            {model.page3.items[0]?.reasonLine && (
              <p className="crp-header__reason">
                {model.page3.items[0].reasonLine}
              </p>
            )}
            <p className="crp-header__reassurance">
              This is the option we would choose for this home.
            </p>
          </div>

          {/* Right — summary chips */}
          <SummaryChips chips={summaryChips} />

        </header>

        {/* ════════════════════════════════════════════════════════════════
            BODY
            ════════════════════════════════════════════════════════════════ */}
        <div className="crp-body">

          {/* ── LEFT COLUMN — the story ──────────────────────────────── */}
          <div className="crp-col--story">

            {/* A. Why Atlas suggested this */}
            {whyBullets.length > 0 && (
              <section className="crp-section" aria-label="Why this system suits your home">
                <h2 className="crp-section__title">Why this system suits your home</h2>
                <ul className="crp-list" aria-label="Recommendation reasons">
                  {whyBullets.map((bullet, i) => (
                    <li key={i} className="crp-list__item crp-list__item--green">
                      <span className="crp-list__icon" aria-hidden="true">✔</span>
                      {bullet}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* B. What this improves day to day */}
            {improvements.length > 0 && (
              <section className="crp-section" aria-label="What this improves day to day">
                <h2 className="crp-section__title">What this improves day to day</h2>
                <ul className="crp-list" aria-label="Day-to-day improvements">
                  {improvements.map((item, i) => (
                    <li key={i} className="crp-list__item">
                      <span className="crp-list__icon" aria-hidden="true">✔</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* C. Other options considered — conditional only */}
            {comparison && (
              <section className="crp-section" aria-label="Other options considered">
                <h2 className="crp-section__title">Other options considered</h2>
                <div className="crp-comparison" aria-label={comparison.label}>
                  <p className="crp-comparison__heading">Option considered</p>
                  <p className="crp-comparison__name">{comparison.label}</p>
                  <p className="crp-comparison__note">{comparison.reasonLine}</p>
                </div>
              </section>
            )}

          </div>

          {/* ── RIGHT COLUMN — the evidence ─────────────────────────────── */}
          <div className="crp-col--evidence">

            {/* A. What we found */}
            <section className="crp-section" aria-label="What we found">
              <h2 className="crp-section__title">What we found</h2>

              <FactsBlock block={{ icon: '🏠', heading: 'Home', rows: homeFactRows }} />

              <FactsBlock block={{ icon: '👥', heading: 'Household', rows: householdFactRows }} />

              {currentSystemRows.length > 0 && (
                <FactsBlock block={{ icon: '🔧', heading: 'Current system', rows: currentSystemRows }} />
              )}
            </section>

            {/* B. Work required */}
            {(requiredWork.length > 0 || recommendedWork.length > 0) && (
              <section className="crp-section" aria-label="Work required">
                <h2 className="crp-section__title">Work required</h2>

                {requiredWork.length > 0 && (
                  <div className="crp-work-section crp-work-section--required">
                    <p className="crp-work-section__label">Required</p>
                    <ul className="crp-list" aria-label="Required work">
                      {requiredWork.map((item, i) => (
                        <li key={i} className="crp-list__item">
                          <span className="crp-list__icon" aria-hidden="true">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {recommendedWork.length > 0 && (
                  <div className="crp-work-section crp-work-section--recommended">
                    <p className="crp-work-section__label">Recommended</p>
                    <ul className="crp-list" aria-label="Recommended work">
                      {recommendedWork.map((item, i) => (
                        <li key={i} className="crp-list__item crp-list__item--green">
                          <span className="crp-list__icon" aria-hidden="true">✔</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            FOOTER
            ════════════════════════════════════════════════════════════════ */}
        <footer className="crp-footer" aria-label="Next steps">

          {/* Left — next steps CTA */}
          <div>
            <p className="crp-footer__cta-heading">Next step</p>
            <ul className="crp-footer__cta-list" aria-label="Portal actions">
              <li className="crp-footer__cta-item">→ See the full explanation</li>
              <li className="crp-footer__cta-item">→ Compare options</li>
              <li className="crp-footer__cta-item">→ Explore the simulator</li>
              <li className="crp-footer__cta-item">→ Revisit your recommendation</li>
            </ul>
            <p className="crp-footer__decision-line">
              This recommendation is based on how your home is used today and how the system performs in real conditions.
              {today && <> · {today}</>}
            </p>
          </div>

          {/* Right — QR code */}
          {portalUrl && (
            <div className="crp-footer__qr" aria-label="Portal QR code">
              <QRCodeImage url={displayUrl} />
              <p className="crp-footer__qr-caption">Your portal</p>
              <p className="crp-footer__qr-url">
                <a href={displayUrl} target="_blank" rel="noopener noreferrer">
                  {displayUrl}
                </a>
              </p>
            </div>
          )}

        </footer>

      </div>
    </div>
  );
}
