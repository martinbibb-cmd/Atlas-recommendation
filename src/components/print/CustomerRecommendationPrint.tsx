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
  FAMILY_TO_OPTION_IDS,
  type CanonicalPresentationModel,
  type SystemComparisonBlock,
  type PhysicsRankingItem,
  type ShortlistedOptionDetail,
} from '../presentation/buildCanonicalPresentation';
import { ALL_OBJECTIVES } from '../../engine/recommendation/RecommendationModel';
import type { FullEngineResult, EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { RecommendationResult } from '../../engine/recommendation/RecommendationModel';
import type { PrioritiesState } from '../../features/survey/priorities/prioritiesTypes';
import { PRIORITY_META } from '../../features/survey/priorities/prioritiesTypes';
import type { ApplianceFamily } from '../../engine/topology/SystemTopology';
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
  /**
   * The ApplianceFamily the engineer agreed with the customer as Option 1.
   * When provided, the print shows the matching ranking item and shortlist
   * option rather than always defaulting to the engine's top-ranked entry.
   */
  selectedOption1Family?: string;
  /**
   * The ApplianceFamily the engineer agreed with the customer as Option 2.
   * When provided, the print shows the matching ranking item and shortlist
   * option rather than always defaulting to the engine's second-ranked entry.
   */
  selectedOption2Family?: string;
  /**
   * When true, renders the per-option engineering breakdown section (raw
   * objective scores, caveats, and priority alignment).  This section is
   * intended for engineer QA review only and must not appear in the
   * customer-facing print by default.
   *
   * Defaults to false — omit in all customer-facing contexts.
   */
  showEngineeringDetails?: boolean;
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
 * Resolve the ranking item for a given family, falling back to the item at
 * fallbackIndex when no match is found.
 */
function resolveRankingItemByFamily(
  model: CanonicalPresentationModel,
  family: string | undefined,
  fallbackIndex: number,
): PhysicsRankingItem | null {
  if (family) {
    const found = model.page3.items.find(i => i.family === family);
    if (found) return found;
  }
  return model.page3.items[fallbackIndex] ?? null;
}

/**
 * Resolve the shortlisted option detail for a given family, falling back to
 * the option at fallbackIndex when no match is found.
 */
function resolveOptionDetailByFamily(
  model: CanonicalPresentationModel,
  family: string | undefined,
  fallbackIndex: number,
): ShortlistedOptionDetail | null {
  if (family) {
    const ids = (FAMILY_TO_OPTION_IDS[family as ApplianceFamily] as readonly string[] | undefined) ?? [];
    const found = model.page4Plus.options.find(o => ids.includes(o.family));
    if (found) return found;
  }
  return model.page4Plus.options[fallbackIndex] ?? null;
}

/**
 * Build the human-readable system name from the supplied ranking item.
 * Falls back to a neutral label when the item is absent.
 */
function resolveSystemName(topRankingItem: PhysicsRankingItem | null): string {
  return topRankingItem?.label ?? 'Recommended system';
}

/**
 * Build up to 3 "why recommended" bullets from the supplied ranking item.
 * Draws on demandFitNote, waterFitNote, infrastructureFitNote, energyFitNote
 * (in that order) and trims to at most 3 items.
 */
function buildWhyBullets(topRankingItem: PhysicsRankingItem | null): string[] {
  if (!topRankingItem) return [];
  const candidates = [
    topRankingItem.demandFitNote,
    topRankingItem.waterFitNote,
    topRankingItem.infrastructureFitNote,
    topRankingItem.energyFitNote,
  ].filter((n): n is string => typeof n === 'string' && n.trim().length > 0);
  return candidates.slice(0, 3);
}

/**
 * Build up to 4 outcome-language improvement bullets from the supplied
 * shortlisted option's bestPerformanceUpgrades list.
 */
function buildImprovementBullets(topDetail: ShortlistedOptionDetail | null): string[] {
  if (!topDetail) return [];
  return topDetail.bestPerformanceUpgrades.slice(0, 4);
}

/**
 * Resolve the optional comparison candidate — the option 2 ranking item.
 * Returns null when there is no meaningful alternative to show.
 */
function resolveComparisonCandidate(
  opt2RankingItem: PhysicsRankingItem | null,
): { label: string; reasonLine: string } | null {
  if (!opt2RankingItem || opt2RankingItem.overallScore === 0) return null;
  return { label: opt2RankingItem.label, reasonLine: opt2RankingItem.reasonLine };
}

/**
 * Build required-work items from the supplied shortlisted option.
 */
function buildRequiredWork(topDetail: ShortlistedOptionDetail | null): string[] {
  if (!topDetail) return [];
  return topDetail.requiredWork;
}

/**
 * Build recommended (optional) work items from the supplied shortlisted
 * option's bestPerformanceUpgrades list — capped at 4.
 */
function buildRecommendedWork(topDetail: ShortlistedOptionDetail | null): string[] {
  if (!topDetail) return [];
  return topDetail.bestPerformanceUpgrades.slice(0, 4);
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

// ─── Ranking breakdown ────────────────────────────────────────────────────────

const PRINT_OBJECTIVE_LABELS: Record<string, string> = {
  performance:    'Performance',
  reliability:    'Reliability',
  longevity:      'Longevity',
  ease_of_control:'Ease of control',
  eco:            'Eco / efficiency',
  disruption:     'Installation',
  space:          'Space',
};

/**
 * Maps PriorityKey to the nearest RecommendationObjective for scoring.
 * 'cost_tendency' and 'future_compatibility' have no exact counterpart in the
 * engine's objective set, so both use 'eco' as the closest available proxy:
 *   - cost_tendency → eco (energy efficiency and carbon footprint strongly
 *     correlate with running costs for gas/heat-pump systems)
 *   - future_compatibility → eco (clean-energy readiness tracks eco score;
 *     heat pumps score highest on both)
 * If the engine exposes dedicated cost_tendency or future_readiness objectives
 * in the future, update this mapping accordingly.
 */
const PRIORITY_KEY_TO_OBJECTIVE_PRINT: Record<string, string> = {
  performance:          'performance',
  reliability:          'reliability',
  longevity:            'longevity',
  disruption:           'disruption',
  eco:                  'eco',
  cost_tendency:        'eco',        // proxy — see comment above
  future_compatibility: 'eco',        // proxy — see comment above
};

/**
 * RankingBreakdownBlock — printed engineering breakdown for a single ranked option.
 * Shows objective scores, demand fit notes, and priority alignment.
 */
function RankingBreakdownBlock({
  rankingItem,
  prioritiesState,
  optionNumber,
}: {
  rankingItem: PhysicsRankingItem;
  prioritiesState: PrioritiesState | undefined;
  optionNumber: number;
}) {
  const selectedPriorities = prioritiesState?.selected ?? [];

  return (
    <section className="crp-ranking-breakdown" aria-label={`Engineering breakdown: ${rankingItem.label}`}>
      <h2 className="crp-section__title">
        Option {optionNumber} engineering breakdown — {rankingItem.label}
      </h2>

      {/* Status and caveat */}
      {rankingItem.caveats.length > 0 && (
        <div className="crp-ranking-breakdown__caveats">
          <p className="crp-ranking-breakdown__caveats-heading">⚠ Constraints</p>
          <ul className="crp-ranking-breakdown__caveat-list">
            {rankingItem.caveats.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}

      {/* Pure engineering scores */}
      <div className="crp-ranking-breakdown__section">
        <p className="crp-ranking-breakdown__sub-heading">Pure engineering (0–100)</p>
        <div className="crp-ranking-obj-grid">
          {ALL_OBJECTIVES.map(obj => {
            const score = rankingItem.objectiveScores[obj] ?? 0;
            return (
              <div key={obj} className="crp-ranking-obj-row">
                <span className="crp-ranking-obj-row__label">{PRINT_OBJECTIVE_LABELS[obj] ?? obj}</span>
                <div className="crp-ranking-obj-row__bar-wrap">
                  <div
                    className="crp-ranking-obj-row__bar"
                    style={{ width: `${score}%` }}
                    role="meter"
                    aria-valuenow={score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <span className="crp-ranking-obj-row__score">{score}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Water demand fit */}
      {(rankingItem.demandFitNote || rankingItem.waterFitNote || rankingItem.demandWaterLabel) && (
        <div className="crp-ranking-breakdown__section">
          <p className="crp-ranking-breakdown__sub-heading">Water demand fit</p>
          <ul className="crp-ranking-breakdown__notes">
            {rankingItem.demandFitNote && <li>{rankingItem.demandFitNote}</li>}
            {rankingItem.waterFitNote && <li>{rankingItem.waterFitNote}</li>}
            {rankingItem.demandWaterLabel && <li>{rankingItem.demandWaterLabel}</li>}
            {rankingItem.mainsWaterLabel && <li>{rankingItem.mainsWaterLabel}</li>}
            {rankingItem.energyFitNote && <li>{rankingItem.energyFitNote}</li>}
          </ul>
        </div>
      )}

      {/* Priority alignment */}
      {selectedPriorities.length > 0 && (
        <div className="crp-ranking-breakdown__section">
          <p className="crp-ranking-breakdown__sub-heading">Your priorities — how this option scores</p>
          <div className="crp-ranking-priority-grid">
            {selectedPriorities.map(key => {
              const meta = PRIORITY_META.find(m => m.key === key);
              const objKey = PRIORITY_KEY_TO_OBJECTIVE_PRINT[key] ?? 'performance';
              const score  = rankingItem.objectiveScores[objKey as keyof typeof rankingItem.objectiveScores] ?? 0;
              return (
                <div key={key} className="crp-ranking-priority-row">
                  <span className="crp-ranking-priority-row__label">
                    {meta?.emoji} {meta?.label ?? key}
                  </span>
                  <div className="crp-ranking-obj-row__bar-wrap">
                    <div className="crp-ranking-obj-row__bar" style={{ width: `${score}%` }} />
                  </div>
                  <span className="crp-ranking-obj-row__score">{score}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </section>
  );
}

function SystemComparisonTable({ comparison }: { comparison: SystemComparisonBlock }) {
  const { current, proposed } = comparison;
  return (
    <section className="crp-section crp-section--comparison" aria-label="Current vs proposed system">
      <h2 className="crp-section__title">Current vs proposed system</h2>
      <div className="crp-comparison-table" aria-label="Comparison table">

        {/* Column headers */}
        <div className="crp-comparison-table__header crp-comparison-table__header--current">
          <span className="crp-comparison-table__system-label">Current: {current.label}</span>
        </div>
        <div className="crp-comparison-table__header crp-comparison-table__header--proposed">
          <span className="crp-comparison-table__system-label">Proposed: {proposed.label}</span>
        </div>

        {/* Benefits row */}
        <div className="crp-comparison-table__cell crp-comparison-table__cell--current">
          <p className="crp-comparison-table__row-heading">Benefits</p>
          <ul className="crp-list" aria-label={`Benefits of ${current.label}`}>
            {current.benefits.map((b, i) => (
              <li key={i} className="crp-list__item">
                <span className="crp-list__icon" aria-hidden="true">✔</span>
                {b}
              </li>
            ))}
            {current.benefits.length === 0 && (
              <li className="crp-list__item" style={{ color: '#718096', fontStyle: 'italic' }}>No specific benefits recorded</li>
            )}
          </ul>
        </div>
        <div className="crp-comparison-table__cell crp-comparison-table__cell--proposed">
          <p className="crp-comparison-table__row-heading">Benefits</p>
          <ul className="crp-list" aria-label={`Benefits of ${proposed.label}`}>
            {proposed.benefits.map((b, i) => (
              <li key={i} className="crp-list__item crp-list__item--green">
                <span className="crp-list__icon" aria-hidden="true">✔</span>
                {b}
              </li>
            ))}
            {proposed.benefits.length === 0 && (
              <li className="crp-list__item" style={{ color: '#718096', fontStyle: 'italic' }}>No specific benefits recorded</li>
            )}
          </ul>
        </div>

        {/* Limitations row */}
        <div className="crp-comparison-table__cell crp-comparison-table__cell--current">
          <p className="crp-comparison-table__row-heading">Limitations</p>
          <ul className="crp-list" aria-label={`Limitations of ${current.label}`}>
            {current.limitations.map((l, i) => (
              <li key={i} className="crp-list__item crp-list__item--amber">
                <span className="crp-list__icon" aria-hidden="true">⚠</span>
                {l}
              </li>
            ))}
            {current.limitations.length === 0 && (
              <li className="crp-list__item" style={{ color: '#718096', fontStyle: 'italic' }}>No limitations recorded</li>
            )}
          </ul>
        </div>
        <div className="crp-comparison-table__cell crp-comparison-table__cell--proposed">
          <p className="crp-comparison-table__row-heading">Limitations</p>
          <ul className="crp-list" aria-label={`Limitations of ${proposed.label}`}>
            {proposed.limitations.map((l, i) => (
              <li key={i} className="crp-list__item crp-list__item--amber">
                <span className="crp-list__icon" aria-hidden="true">⚠</span>
                {l}
              </li>
            ))}
            {proposed.limitations.length === 0 && (
              <li className="crp-list__item" style={{ color: '#718096', fontStyle: 'italic' }}>No limitations recorded</li>
            )}
          </ul>
        </div>

      </div>
    </section>
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
  selectedOption1Family,
  selectedOption2Family,
  showEngineeringDetails = false,
}: Props) {
  const model = buildCanonicalPresentation(result, input, recommendationResult, prioritiesState);
  const { page1 } = model;

  // ── Resolve Option 1 and Option 2 using the families agreed in-room ─────
  // Falls back to the engine's default order when no deck selection was made.
  const topRankingItem = resolveRankingItemByFamily(model, selectedOption1Family, 0);
  const topDetail      = resolveOptionDetailByFamily(model, selectedOption1Family, 0);
  const opt2RankingItem = resolveRankingItemByFamily(model, selectedOption2Family, 1);
  const opt2Detail      = resolveOptionDetailByFamily(model, selectedOption2Family, 1);

  // ── Derived presentation data ────────────────────────────────────────────

  const systemName      = resolveSystemName(topRankingItem);
  const whyBullets      = buildWhyBullets(topRankingItem);
  const improvements    = buildImprovementBullets(topDetail);
  const comparison      = resolveComparisonCandidate(opt2RankingItem);
  const requiredWork    = buildRequiredWork(topDetail);
  const recommendedWork = buildRecommendedWork(topDetail);
  const { systemComparison } = model;

  // Use the OptionCardV1 label for Option 2 wherever it appears so the name
  // is consistent throughout the document (header, comparison snippet, etc.).
  const option2Label = opt2Detail?.label ?? comparison?.label;

  const opt2WhyBullets: string[] = opt2RankingItem
    ? ([
        opt2RankingItem.demandFitNote,
        opt2RankingItem.waterFitNote,
        opt2RankingItem.infrastructureFitNote,
        opt2RankingItem.energyFitNote,
      ] as (string | undefined)[])
        .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
        .slice(0, 3)
    : [];

  const opt2Improvements  = opt2Detail ? opt2Detail.bestPerformanceUpgrades.slice(0, 4) : [];
  const opt2RequiredWork  = opt2Detail ? opt2Detail.requiredWork : [];

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
              <span className="crp-header__brand" aria-hidden="true"></span>
              <span className="crp-header__recommended-pill">Recommended</span>
            </p>
            <p className="crp-header__title">
              Our recommendation for your home
              {customerName ? ` — ${customerName}` : ''}
            </p>
            <h1 className="crp-header__system-name">{systemName}</h1>
            {topRankingItem?.reasonLine && (
              <p className="crp-header__reason">
                {topRankingItem.reasonLine}
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
            {comparison && option2Label && (
              <section className="crp-section" aria-label="Other options considered">
                <h2 className="crp-section__title">Other options considered</h2>
                <div className="crp-comparison" aria-label={option2Label}>
                  <p className="crp-comparison__name">{option2Label}</p>
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
            COMPARISON — current vs proposed (full width, conditional)
            ════════════════════════════════════════════════════════════════ */}
        {systemComparison && (
          <div className="crp-comparison-row" data-testid="system-comparison-block">
            <SystemComparisonTable comparison={systemComparison} />
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            ENGINEERING BREAKDOWN — ranked options detail
            Engineer QA only — hidden in default customer-facing print.
            Enable by passing showEngineeringDetails={true}.
            ════════════════════════════════════════════════════════════════ */}
        {showEngineeringDetails && topRankingItem && (
          <div className="crp-engineering-section" data-testid="engineering-breakdown">
            <RankingBreakdownBlock
              rankingItem={topRankingItem}
              prioritiesState={prioritiesState}
              optionNumber={1}
            />
            {opt2RankingItem && opt2RankingItem.overallScore > 0 && (
              <RankingBreakdownBlock
                rankingItem={opt2RankingItem}
                prioritiesState={prioritiesState}
                optionNumber={2}
              />
            )}
          </div>
        )}

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
          <div className="crp-footer__qr" aria-label="Portal QR code">
            <QRCodeImage url={displayUrl} />
            <p className="crp-footer__qr-caption">Your portal</p>
            <p className="crp-footer__qr-url">
              <a href={displayUrl} target="_blank" rel="noopener noreferrer">
                {displayUrl}
              </a>
            </p>
          </div>

        </footer>

        {/* ════════════════════════════════════════════════════════════════
            OPTION 2 — second shortlisted option (new print page, conditional)
            ════════════════════════════════════════════════════════════════ */}
        {opt2Detail != null && (
          <div className="crp-option2-section" data-testid="option2-section">

            <header className="crp-option2-header" aria-label="Option 2 header">
              <p className="crp-option2-header__label">Option 2</p>
              <h2 className="crp-option2-header__name">{opt2Detail.label}</h2>
              {opt2RankingItem?.reasonLine && (
                <p className="crp-option2-header__reason">{opt2RankingItem.reasonLine}</p>
              )}
            </header>

            <div className="crp-body">

              {/* Left — why + improvements */}
              <div className="crp-col--story">

                {opt2WhyBullets.length > 0 && (
                  <section className="crp-section" aria-label="Why this system suits your home">
                    <h2 className="crp-section__title">Why this system suits your home</h2>
                    <ul className="crp-list" aria-label="Recommendation reasons">
                      {opt2WhyBullets.map((bullet, i) => (
                        <li key={i} className="crp-list__item crp-list__item--green">
                          <span className="crp-list__icon" aria-hidden="true">✔</span>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {opt2Improvements.length > 0 && (
                  <section className="crp-section" aria-label="What this improves day to day">
                    <h2 className="crp-section__title">What this improves day to day</h2>
                    <ul className="crp-list" aria-label="Day-to-day improvements">
                      {opt2Improvements.map((item, i) => (
                        <li key={i} className="crp-list__item">
                          <span className="crp-list__icon" aria-hidden="true">✔</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

              </div>

              {/* Right — work required */}
              <div className="crp-col--evidence">

                {(opt2RequiredWork.length > 0 || opt2Improvements.length > 0) && (
                  <section className="crp-section" aria-label="Work required">
                    <h2 className="crp-section__title">Work required</h2>

                    {opt2RequiredWork.length > 0 && (
                      <div className="crp-work-section crp-work-section--required">
                        <p className="crp-work-section__label">Required</p>
                        <ul className="crp-list" aria-label="Required work">
                          {opt2RequiredWork.map((item, i) => (
                            <li key={i} className="crp-list__item">
                              <span className="crp-list__icon" aria-hidden="true">•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {opt2Improvements.length > 0 && (
                      <div className="crp-work-section crp-work-section--recommended">
                        <p className="crp-work-section__label">Recommended</p>
                        <ul className="crp-list" aria-label="Recommended work">
                          {opt2Improvements.map((item, i) => (
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

          </div>
        )}

      </div>
    </div>
  );
}
