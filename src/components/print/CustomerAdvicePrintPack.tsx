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
import type { AiHandoffPayload } from '../../contracts/AiHandoffPayload';
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

// ─── AI handoff builder ───────────────────────────────────────────────────────

const ASSISTANT_INTRODUCTION =
  'Atlas has helped me understand your home, your current heating and hot-water setup, ' +
  'and the recommendation you have been given.\n\n' +
  'Use the information below to help explain the advice in plain English. You may also ' +
  'use trusted external sources to check general facts, such as heating physics, ' +
  'manufacturer technical documents, warranty terms, regulatory guidance, and consumer ' +
  'protections.\n\n' +
  'You are independent of Atlas. You should also be aware that AI systems can make ' +
  'mistakes or overstate certainty. Do not invent missing facts. If something is unclear, ' +
  'say what needs checking and recommend that the customer confirms it with their ' +
  'installer, surveyor, manufacturer, energy supplier, or relevant specialist.';

const VALIDATION_POLICY = [
  'Explain the Atlas recommendation in plain English.',
  'Use the supplied Atlas payload as the primary case-specific source.',
  'Use external sources only to validate general claims, not to invent missing survey facts.',
  'Do not treat marketing claims as technical evidence.',
  'Prefer official or technically authoritative sources.',
  'Separate confirmed facts from assumptions.',
  'Flag anything that requires site verification.',
  'Do not provide financial, legal, or regulatory certainty unless supported by an official source.',
  'If sources conflict, say so.',
].join('\n');

const TRUSTED_SOURCE_CATEGORIES: string[] = [
  'Manufacturer installation manuals',
  'Manufacturer technical data sheets',
  'Manufacturer warranty terms',
  'British Gas warranty / terms and conditions where relevant',
  'Energy Saving Trust guidance',
  'Ofgem guidance',
  'FCA guidance where finance/credit/payment products are discussed',
  'Ofcom guidance only where communications/connectivity claims are relevant',
  'Building Regulations / competent person scheme guidance where relevant',
  'Water Regulations / G3 unvented hot-water guidance where relevant',
  'Metering or network operator guidance where relevant',
];

const SOURCE_USE_RULES: string[] = [
  'Use manufacturer documents for product limits, clearances, warranties, compatible controls, and installation requirements.',
  'Use Energy Saving Trust or official energy guidance for general efficiency/savings context.',
  'Use Ofgem for energy supplier, tariff, meter, and consumer energy rights questions.',
  'Use FCA for finance, credit, affordability, or regulated payment questions.',
  'Use Ofcom only for broadband/mobile/communications issues connected to smart controls or portal access.',
  'Use British Gas terms only for British Gas cover, warranty, servicing, cancellation, or customer obligation questions.',
  'Avoid relying on sales brochures unless no technical document is available.',
  'Never override site-specific Atlas facts unless there is a clear contradiction that should be checked by a specialist.',
];

/**
 * Assembles a structured AiHandoffPayload from the Atlas decision and scenarios.
 *
 * Static policy fields (introduction, validationPolicy, source rules) instruct
 * external AI assistants how to use the payload responsibly and validate claims
 * against trusted sources. Case-specific fields are derived entirely from
 * AtlasDecisionV1 and ScenarioResult[].
 */
function buildAiHandoffPayload(
  decision: AtlasDecisionV1,
  scenarios: ScenarioResult[],
): AiHandoffPayload {
  const rejected = scenarios.filter((s) => s.scenarioId !== decision.recommendedScenarioId);

  return {
    assistantIntroduction:   ASSISTANT_INTRODUCTION,
    validationPolicy:        VALIDATION_POLICY,
    trustedSourceCategories: TRUSTED_SOURCE_CATEGORIES,
    sourceUseRules:          SOURCE_USE_RULES,

    recommendedHeadline: decision.headline,
    keyReasons:          decision.keyReasons.slice(0, 3),
    rejectedAlternatives: rejected.map((s) => ({
      summary:    s.system.summary,
      constraint: s.keyConstraints[0] ?? 'not suitable for this home',
    })),
    householdFacts: decision.supportingFacts
      .slice(0, 6)
      .map((f) => ({ label: f.label, value: f.value })),
    includedScope:   decision.includedItems.slice(0, 8),
    requiredWorks:   decision.requiredWorks.slice(0, 5),
    warnings:        decision.compatibilityWarnings.slice(0, 3),
    futureUpgrades:  decision.futureUpgradePaths.slice(0, 4),
  };
}

/**
 * Serialises an AiHandoffPayload to a visible, copyable plain-text block.
 *
 * The customer can copy/paste this into any AI assistant (ChatGPT, Claude,
 * Gemini) and ask "Explain this quote to me".
 *
 * Rules:
 *   - Visible text only — no white-on-white hidden content.
 *   - Kept concise: bullets, not paragraphs.
 */
function serialiseAiHandoffPayload(payload: AiHandoffPayload): string {
  const lines: string[] = [
    '=== ATLAS RECOMMENDATION SUMMARY ===',
    '',
    '--- Instructions for the AI assistant ---',
    payload.assistantIntroduction,
    '',
    'When answering the customer:',
    ...payload.validationPolicy.split('\n').map((l) => `• ${l}`),
    '',
    'Trusted source categories:',
    ...payload.trustedSourceCategories.map((c) => `• ${c}`),
    '',
    'Source use rules:',
    ...payload.sourceUseRules.map((r) => `• ${r}`),
    '',
    '--- Case-specific Atlas data ---',
    '',
    `Recommended: ${payload.recommendedHeadline}`,
    '',
  ];

  if (payload.keyReasons.length > 0) {
    lines.push('Why selected:');
    payload.keyReasons.forEach((r) => lines.push(`• ${r}`));
    lines.push('');
  }

  if (payload.rejectedAlternatives.length > 0) {
    lines.push('Rejected alternatives:');
    payload.rejectedAlternatives.forEach((a) => lines.push(`• ${a.summary} — ${a.constraint}`));
    lines.push('');
  }

  if (payload.householdFacts.length > 0) {
    lines.push('Household facts:');
    payload.householdFacts.forEach((f) => lines.push(`• ${f.label}: ${f.value}`));
    lines.push('');
  }

  if (payload.includedScope.length > 0) {
    lines.push('Included scope:');
    payload.includedScope.forEach((i) => lines.push(`• ${i}`));
    lines.push('');
  }

  if (payload.requiredWorks.length > 0) {
    lines.push('Required works:');
    payload.requiredWorks.forEach((w) => lines.push(`• ${w}`));
    lines.push('');
  }

  if (payload.warnings.length > 0) {
    lines.push('Warnings:');
    payload.warnings.forEach((w) => lines.push(`• ${w}`));
    lines.push('');
  }

  if (payload.futureUpgrades.length > 0) {
    lines.push('Future upgrades:');
    payload.futureUpgrades.forEach((p) => lines.push(`• ${p}`));
    lines.push('');
  }

  lines.push('Generated by Atlas — paste into any AI assistant to discuss this recommendation.');

  return lines.join('\n');
}

/**
 * Assembles a compact, visible handoff text from the decision and scenarios.
 *
 * Builds a structured AiHandoffPayload (with evidence-aware policy fields)
 * then serialises it to plain text for copy/paste into any AI assistant.
 */
function buildAiHandoffText(
  decision: AtlasDecisionV1,
  scenarios: ScenarioResult[],
): string {
  return serialiseAiHandoffPayload(buildAiHandoffPayload(decision, scenarios));
}

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
      width: 180,
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
      className="capp-portal-cta__qr-img"
    />
  );
}

// ─── Portal CTA print section ─────────────────────────────────────────────────

/**
 * PrintPortalCta
 *
 * Compact print-safe portal call-to-action.  Rendered as a card within
 * the portal_cta page — not a full A4 page in its own right.
 *
 * Shows the URL as plain text and a QR code image when portalUrl is present.
 * Falls back to a placeholder box when no URL is available.
 *
 * Rules:
 *   - No token generation here — portalUrl must be pre-built by the caller.
 *   - QR code is purely presentational; meaning is carried by the text URL.
 *   - QR minimum size: 30 mm / 113 px at screen resolution.
 */
function PrintPortalCta({ portalUrl }: { portalUrl?: string }) {
  return (
    <div className="capp-portal-cta" data-testid="capp-portal-cta-section">
      <div className="capp-portal-cta__qr-area" aria-label="Portal QR code">
        {portalUrl ? (
          <QRCodeImage url={portalUrl} />
        ) : (
          <p className="capp-portal-cta__qr-placeholder" aria-label="QR code placeholder">
            QR code<br />will appear<br />here
          </p>
        )}
      </div>

      <div className="capp-portal-cta__text">
        <p className="capp-portal-cta__heading">Open your portal</p>
        <p className="capp-portal-cta__sub">
          See the interactive model, explore alternatives, and share your recommendation.
        </p>
        {portalUrl ? (
          <>
            <a
              className="capp-portal-cta__url"
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="capp-portal-url"
            >
              Open your portal online
            </a>
            <span className="capp-portal-cta__url-raw" data-testid="capp-portal-url-raw">
              {portalUrl}
            </span>
          </>
        ) : (
          <p className="capp-portal-cta__url capp-portal-cta__url--placeholder" data-testid="capp-portal-url-placeholder">
            Your portal link will be shared by your installer.
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
 * Renders the customer advice pack from VisualBlock[].  Each content block
 * occupies one A4 page.  The portal_cta block is rendered as a compact
 * card at the end of the document rather than a full blank page.
 *
 * Screen view: toolbar with Back + Print, then stacked A4 pages with shadow.
 * Print view:  toolbar hidden, pages fill the physical paper with margins.
 *
 * The AI handoff summary is appended within the portal_cta section so the
 * customer can copy/paste it into any AI assistant without hidden content.
 */
export function CustomerAdvicePrintPack({
  decision,
  scenarios,
  visualBlocks,
  portalUrl,
  visitDate,
  onBack,
}: CustomerAdvicePrintPackProps) {
  const packTitle    = `Atlas advice pack${visitDate ? ` — ${visitDate}` : ''}`;
  const headline     = decision.headline;
  const aiHandoff    = buildAiHandoffText(decision, scenarios);

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
          const ctaBlock    = isPortalCta ? (block as PortalCtaBlock) : null;
          const modifier    = pageModifier(block);
          const label       = SECTION_LABELS[block.type] ?? '';
          const isLast      = index === visualBlocks.length - 1;

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
                  {/* Portal CTA heading and supporting points */}
                  <div className="customer-deck__block customer-deck__block--portal-cta">
                    <div className="customer-deck__block-body">
                      <h2 className="customer-deck__title">{ctaBlock?.title ?? 'Open your portal'}</h2>
                      <p className="customer-deck__outcome">{ctaBlock?.outcome ?? 'Explore the interactive model, costs, and comparison in your portal.'}</p>
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

                  {/* Compact QR + URL card — not a full blank page */}
                  <PrintPortalCta portalUrl={portalUrl} />

                  {/* AI handoff — visible, copyable summary for any AI assistant */}
                  <section
                    className="capp-ai-handoff"
                    aria-label="AI handoff summary"
                    data-testid="capp-ai-handoff"
                  >
                    <div className="capp-ai-handoff__header">
                      <span className="capp-ai-handoff__icon" aria-hidden="true">✦</span>
                      <span className="capp-ai-handoff__title">AI handoff summary</span>
                      <span className="capp-ai-handoff__hint">Copy and paste into ChatGPT, Claude, or Gemini</span>
                    </div>
                    <pre className="capp-ai-handoff__text">{aiHandoff}</pre>
                  </section>
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
