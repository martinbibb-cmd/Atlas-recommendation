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
import { buildLockedAiHandoffText } from '../../engine/modules/buildAiHandoffPayload';
import { buildCustomerSummary } from '../../engine/modules/buildCustomerSummary';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import { HeroBlockView }                     from '../presentation/blocks/HeroBlockView';
import { FactsBlockView }                    from '../presentation/blocks/FactsBlockView';
import { CustomerNeedResolutionBlockView }   from '../presentation/blocks/CustomerNeedResolutionBlockView';
import { ProblemBlockView }                  from '../presentation/blocks/ProblemBlockView';
import { SolutionBlockView }                 from '../presentation/blocks/SolutionBlockView';
import { DailyUseBlockView }                 from '../presentation/blocks/DailyUseBlockView';
import { IncludedScopeBlockView }            from '../presentation/blocks/IncludedScopeBlockView';
import { SystemWorkExplainerBlockView }      from '../presentation/blocks/SystemWorkExplainerBlockView';
import { WarningBlockView }                  from '../presentation/blocks/WarningBlockView';
import { FutureUpgradeBlockView }            from '../presentation/blocks/FutureUpgradeBlockView';
import { SpatialProofBlockView }             from '../presentation/blocks/SpatialProofBlockView';
import type {
  HeroBlock,
  FactsBlock,
  CustomerNeedResolutionBlock,
  ProblemBlock,
  SolutionBlock,
  DailyUseBlock,
  IncludedScopeBlock,
  SystemWorkExplainerBlock,
  WarningBlock,
  FutureUpgradeBlock,
  SpatialProofBlock,
} from '../../contracts/VisualBlock';
import { TechnicalAuditAppendix } from './TechnicalAuditAppendix';
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
  /**
   * Pre-built locked customer summary. When provided, this is used directly
   * as the source for the AI handoff text and print summary copy.
   * When absent, CustomerAdvicePrintPack builds it internally via
   * buildCustomerSummary(decision, scenarios).
   */
  lockedSummary?: CustomerSummaryV1;
  /**
   * When false (default), `problem` type blocks (combi rejection prose,
   * kW/ΔT maths, "why your home needs stored hot water" essays) are not
   * rendered in the print pack. Set to true only for portal / AI handoff
   * surfaces that need the full technical comparison.
   */
  showRejectedOptionProof?: boolean;
  /**
   * When false (default), the AI handoff section is rendered as a compact
   * heading + copy prompt only — the full instruction text is not printed.
   * Set to true to print the full AI payload (portal and AI summary export only).
   */
  printFullAiHandoff?: boolean;
  /**
   * When true, renders the TechnicalAuditAppendix as the final section of
   * the document — a dense machine-readable log for surveyor / engineer use.
   * Default false.
   */
  showTechnicalAudit?: boolean;
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
 * portal_cta is handled separately in the main component.
 */
function renderBlockContent(block: VisualBlock): React.ReactElement | null {
  switch (block.type) {
    case 'hero':                    return <HeroBlockView                   block={block as HeroBlock} />;
    case 'facts':                   return <FactsBlockView                  block={block as FactsBlock} />;
    case 'customer_need_resolution': return <CustomerNeedResolutionBlockView block={block as CustomerNeedResolutionBlock} />;
    case 'problem':                 return <ProblemBlockView                block={block as ProblemBlock} />;
    case 'solution':                return <SolutionBlockView               block={block as SolutionBlock} />;
    case 'daily_use':               return <DailyUseBlockView               block={block as DailyUseBlock} />;
    case 'included_scope':          return <IncludedScopeBlockView          block={block as IncludedScopeBlock} />;
    case 'system_work_explainer':   return <SystemWorkExplainerBlockView    block={block as SystemWorkExplainerBlock} />;
    case 'warning':                 return <WarningBlockView                block={block as WarningBlock} />;
    case 'future_upgrade':          return <FutureUpgradeBlockView          block={block as FutureUpgradeBlock} />;
    case 'spatial_proof':           return <SpatialProofBlockView           block={block as SpatialProofBlock} />;
    case 'portal_cta':              return null; // handled separately in the main component
    default:                        return null;
  }
}

/** Maps a warning block's severity to a CSS modifier class for page tinting. */
function warningModifier(block: VisualBlock): string {
  if (block.type !== 'warning') return '';
  return `capp-page--warning-${(block as WarningBlock).severity}`;
}

// ─── Block categorisation ─────────────────────────────────────────────────────

/**
 * Pillar 1 — Identity: blocks that establish property context and priorities.
 * Rendered on the Executive Summary page.
 */
const IDENTITY_BLOCK_TYPES = new Set<VisualBlock['type']>([
  'hero',
  'facts',
  'customer_need_resolution',
]);

/**
 * Pillar 4 — Roadmap: future upgrade paths.
 * Rendered on the Comparison & Roadmap page.
 */
const ROADMAP_BLOCK_TYPES = new Set<VisualBlock['type']>(['future_upgrade']);

/**
 * Technical blocks: installation requirements, warnings, work explainer, spatial proof.
 * Rendered on the Technical Blueprint page.
 */
const TECHNICAL_BLOCK_TYPES = new Set<VisualBlock['type']>([
  'included_scope',
  'system_work_explainer',
  'warning',
  'daily_use',
  'spatial_proof',
]);

interface CategorisedBlocks {
  identity:  VisualBlock[];
  verdict:   VisualBlock[];   // solution, problem (if shown)
  roadmap:   VisualBlock[];
  technical: VisualBlock[];
  cta:       PortalCtaBlock | null;
}

function categoriseBlocks(blocks: VisualBlock[], showRejected: boolean): CategorisedBlocks {
  const result: CategorisedBlocks = { identity: [], verdict: [], roadmap: [], technical: [], cta: null };
  for (const b of blocks) {
    if (b.type === 'portal_cta') { result.cta = b as PortalCtaBlock; continue; }
    if (b.type === 'problem' && !showRejected)               continue;
    if (IDENTITY_BLOCK_TYPES.has(b.type))                    { result.identity.push(b);  continue; }
    if (ROADMAP_BLOCK_TYPES.has(b.type))                     { result.roadmap.push(b);   continue; }
    if (TECHNICAL_BLOCK_TYPES.has(b.type))                   { result.technical.push(b); continue; }
    result.verdict.push(b); // solution, problem (when shown)
  }
  return result;
}

// ─── Themed block wrapper ─────────────────────────────────────────────────────

/**
 * Renders a block with its canonical data-testid inside a themed-block section.
 * Preserves the `capp-block-{type}` testid pattern used by tests.
 */
function ThemedBlock({ block }: { block: VisualBlock }) {
  const content = renderBlockContent(block);
  if (!content) return null;
  const extra = block.type === 'warning' ? ` ${warningModifier(block)}` : '';
  return (
    <section
      className={`capp-themed-block${extra}`}
      data-testid={`capp-block-${block.type}`}
      data-block-id={block.id}
      aria-label={block.title}
    >
      {content}
    </section>
  );
}

// ─── Supplementary sections ───────────────────────────────────────────────────

/**
 * At-a-Glance panel — compact property stats for the Executive Summary sidebar.
 * Pulls from decision.supportingFacts (occupants, bathrooms, cylinder volume)
 * and energyMetrics (peak heat load kW).
 *
 * Pillar 1 additions:
 *  - Cylinder volume is shown when present in supportingFacts.
 *  - Condition band badge is shown when the system is 'at_risk' or 'worn'.
 *  - Volume gap advisory is shown when occupants ≥ 4 and cylinder volume ≤ 150 L,
 *    highlighting that the Mixergy selection is a logical necessity.
 */
function AtAGlancePanel({ decision }: { decision: AtlasDecisionV1 }) {
  const stats: Array<{ label: string; value: string | number }> = [];

  // Heat loss kW — prefer energyMetrics, fall back to supportingFacts
  const peakLoad = decision.energyMetrics?.peakLoadKw;
  if (peakLoad != null) {
    stats.push({ label: 'Heat loss', value: `${peakLoad.toFixed(1)} kW` });
  }

  let occupantCount: number | null = null;
  let cylinderVolumeLitres: number | null = null;

  // Occupants, bathrooms, and cylinder volume from supportingFacts
  for (const fact of decision.supportingFacts) {
    const key = fact.label.toLowerCase();
    if (key.includes('occupant') || key.includes('person') || key.includes('resident')) {
      stats.push({ label: fact.label, value: fact.value });
      const n = typeof fact.value === 'number' ? fact.value : parseInt(String(fact.value), 10);
      if (!isNaN(n)) occupantCount = n;
    } else if (key.includes('bathroom') || key.includes('shower room')) {
      stats.push({ label: fact.label, value: fact.value });
    } else if (
      key.includes('cylinder') ||
      key === 'tank volume' ||
      key === 'dhw volume' ||
      key === 'storage volume' ||
      (key.includes('volume') && key.includes('litre'))
    ) {
      stats.push({ label: fact.label, value: fact.value });
      const n = typeof fact.value === 'number'
        ? fact.value
        : parseInt(String(fact.value).replace(/[^\d]/g, ''), 10);
      if (!isNaN(n)) cylinderVolumeLitres = n;
    }
  }

  // Condition band — show when at_risk or worn for explicit customer visibility
  const condition = decision.lifecycle.currentSystem.condition;
  const isConditionVisible = condition === 'at_risk' || condition === 'worn';

  // Volume gap — flag when cylinder is undersized relative to occupancy
  const hasVolumeGap =
    occupantCount !== null &&
    cylinderVolumeLitres !== null &&
    occupantCount >= 4 &&
    cylinderVolumeLitres <= 150;

  // Only render if we have something to show
  if (stats.length === 0 && !isConditionVisible) return null;

  return (
    <aside className="capp-at-a-glance" aria-label="At-a-glance property stats" data-testid="capp-at-a-glance">
      <p className="capp-at-a-glance__heading">At a glance</p>
      <ul className="capp-at-a-glance__list">
        {stats.map((s) => (
          <li key={s.label} className="capp-at-a-glance__item">
            <span className="capp-at-a-glance__label">{s.label}</span>
            <span className="capp-at-a-glance__value">{s.value}</span>
          </li>
        ))}
      </ul>
      {isConditionVisible && (
        <p
          className={`capp-at-a-glance__condition-badge capp-at-a-glance__condition-badge--${condition}`}
          data-testid="capp-at-a-glance-condition"
        >
          Condition band: {condition.replace('_', ' ')}
        </p>
      )}
      {hasVolumeGap && (
        <p className="capp-at-a-glance__volume-gap" data-testid="capp-at-a-glance-volume-gap">
          Volume gap — cylinder may be undersized for this household size.
        </p>
      )}
    </aside>
  );
}

/**
 * Comparison section — Atlas Pick vs alternatives for the Verdict & Roadmap page.
 * Shows only scenarios that differ from the recommended one.
 */
function ComparisonSection({ decision, scenarios }: { decision: AtlasDecisionV1; scenarios: ScenarioResult[] }) {
  if (scenarios.length <= 1) return null;

  const SYSTEM_LABEL: Record<ScenarioResult['system']['type'], string> = {
    combi:   'Combi boiler',
    system:  'System boiler',
    regular: 'Regular boiler',
    ashp:    'Air source heat pump',
  };

  return (
    <section className="capp-comparison" aria-label="Atlas Pick vs alternatives" data-testid="capp-comparison">
      <p className="capp-comparison__heading">Atlas Pick vs alternatives</p>
      <div className="capp-comparison__grid">
        {scenarios.map((scenario) => {
          const isAtlasPick = scenario.scenarioId === decision.recommendedScenarioId;
          return (
            <div
              key={scenario.scenarioId}
              className={`capp-comparison__card${isAtlasPick ? ' capp-comparison__card--pick' : ''}`}
            >
              {isAtlasPick && (
                <span className="capp-comparison__badge">Atlas Pick</span>
              )}
              <p className="capp-comparison__system-name">
                {SYSTEM_LABEL[scenario.system.type] ?? scenario.system.type}
              </p>
              <p className="capp-comparison__system-summary">{scenario.system.summary}</p>
              {scenario.keyBenefits.length > 0 && (
                <ul className="capp-comparison__benefits" aria-label="Key benefits">
                  {scenario.keyBenefits.slice(0, 2).map((b) => (
                    <li key={b} className="capp-comparison__benefit">✓ {b}</li>
                  ))}
                </ul>
              )}
              {scenario.keyConstraints.length > 0 && (
                <ul className="capp-comparison__constraints" aria-label="Constraints">
                  {scenario.keyConstraints.slice(0, 2).map((c) => (
                    <li key={c} className="capp-comparison__constraint">· {c}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Avoided Risks section — surfaces risks the recommendation mitigates.
 */
function AvoidedRisksSection({ avoidedRisks }: { avoidedRisks: string[] }) {
  if (avoidedRisks.length === 0) return null;
  return (
    <section className="capp-avoided-risks" aria-label="Avoided risks" data-testid="capp-avoided-risks">
      <p className="capp-avoided-risks__heading">Avoided risks</p>
      <ul className="capp-avoided-risks__list">
        {avoidedRisks.map((risk) => (
          <li key={risk} className="capp-avoided-risks__item">
            <span className="capp-avoided-risks__shield" aria-hidden="true">🛡</span>
            {risk}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Requirements section — lists must-have compliance and required scope items
 * for the Technical Blueprint page.
 */
function RequirementsSection({ decision }: { decision: AtlasDecisionV1 }) {
  const required = decision.quoteScope.filter(
    (item) =>
      item.status === 'required' ||
      (item.status === 'included' && item.category === 'compliance'),
  );
  if (required.length === 0 && decision.compatibilityWarnings.length === 0) return null;

  return (
    <section className="capp-requirements" aria-label="Requirements checklist" data-testid="capp-requirements">
      <p className="capp-requirements__heading">Requirements</p>
      <ul className="capp-requirements__list">
        {required.map((item) => (
          <li key={item.id} className="capp-requirements__item">
            <span className="capp-requirements__marker" aria-hidden="true">■</span>
            {item.label}
          </li>
        ))}
        {decision.compatibilityWarnings.map((w, i) => (
          <li key={`warn-${i}`} className="capp-requirements__item capp-requirements__item--advisory">
            <span className="capp-requirements__marker" aria-hidden="true">!</span>
            {w}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Installation complexity badge derived from the quote scope.
 *
 * Pillar 1 addition: when the existing system is 'at_risk', a note about
 * system cleaning and corrosion protection is appended to the description —
 * reflecting that a "straightforward swap" may involve necessary protection work.
 */
function InstallComplexityBadge({ decision }: { decision: AtlasDecisionV1 }) {
  const HIGH_COMPLEXITY_CATEGORIES = new Set(['pipework', 'electrical', 'investigation']);
  const isHigh = decision.quoteScope.some((item) =>
    HIGH_COMPLEXITY_CATEGORIES.has(item.category) && item.status !== 'optional',
  );
  const isAtRisk = decision.lifecycle.currentSystem.condition === 'at_risk';
  const label = isHigh ? 'Higher complexity' : 'Low disruption';
  const cssClass = isHigh ? 'capp-complexity--high' : 'capp-complexity--low';
  const cleaningNote = isAtRisk
    ? ' System cleaning and corrosion protection are recommended before or during installation.'
    : '';
  const desc = isHigh
    ? `This installation involves pipework, electrical, or investigation work — allow additional time.${cleaningNote}`
    : `Straightforward swap — minimal disruption expected.${cleaningNote}`;

  return (
    <aside className={`capp-complexity ${cssClass}`} aria-label="Installation complexity" data-testid="capp-complexity">
      <span className="capp-complexity__label">{label}</span>
      <span className="capp-complexity__desc">{desc}</span>
    </aside>
  );
}

/**
 * AI-Ready Context Block — structured text block for AI querying.
 * Placed in each page footer area (collapsed by default in screen view).
 * Format: User Goal · Constraint · Efficiency Trap · Physics Verdict ·
 *         Mixergy Bridge (when applicable) · Improvement Pathway ·
 *         Three-Year Roadmap (when at_risk).
 *
 * Updated AI-Ready Context Block additions (Four Pillar framework):
 *  - "Mixergy Bridge" field: when the recommended system is stored hot water
 *    and a pressure-constraint flag is raised, frames the tank-fed supply
 *    positively as the reason for the Mixergy selection.
 *  - "Three-Year Roadmap" field: when the existing system is at_risk and a
 *    stored system is recommended, summarises the Year 1 / Year 2 / Year 3
 *    capital programme in a single machine-readable line.
 */
function AiContextBlock({
  decision,
  recommendedScenario,
}: {
  decision: AtlasDecisionV1;
  recommendedScenario?: ScenarioResult;
}) {
  const userGoal = decision.keyReasons[0] ?? '';
  const constraint = decision.hardConstraints?.[0] ?? decision.compatibilityWarnings[0] ?? '';
  const efficiencyTrap = decision.performancePenalties?.[0] ?? '';
  const physicsVerdict = decision.summary;
  const improvementPath = decision.futureUpgradePaths[0] ?? '';

  // Mixergy Bridge — positive framing of tank-fed supply pressure constraint
  const isStoredSystem =
    recommendedScenario?.system.type === 'system' ||
    recommendedScenario?.system.type === 'regular';
  const mixeryBridge =
    isStoredSystem && recommendedScenario?.physicsFlags.pressureConstraint
      ? 'Stored hot water cylinder selected because it operates from tank-fed supply pressures — mains-pressure ready for future improvement.'
      : '';

  // Three-Year Roadmap context — triggered by at_risk condition on stored system
  const isAtRisk = decision.lifecycle.currentSystem.condition === 'at_risk';
  const roadmapContext =
    isAtRisk && isStoredSystem
      ? 'Year 1: new system + system clean. Year 2: radiator upgrade to lower flow temperature. Year 3: pipework optimisation for heat pump pathway.'
      : '';

  const hasContent = userGoal || constraint || physicsVerdict;
  if (!hasContent) return null;

  return (
    <section className="capp-ai-context" aria-label="AI context block" data-testid="capp-ai-context">
      <p className="capp-ai-context__heading">Atlas context for AI assistants</p>
      <dl className="capp-ai-context__fields">
        {userGoal && (
          <>
            <dt className="capp-ai-context__term">User Goal</dt>
            <dd className="capp-ai-context__desc">{userGoal}</dd>
          </>
        )}
        {constraint && (
          <>
            <dt className="capp-ai-context__term">Constraint</dt>
            <dd className="capp-ai-context__desc">{constraint}</dd>
          </>
        )}
        {efficiencyTrap && (
          <>
            <dt className="capp-ai-context__term">Efficiency Trap</dt>
            <dd className="capp-ai-context__desc">{efficiencyTrap}</dd>
          </>
        )}
        {physicsVerdict && (
          <>
            <dt className="capp-ai-context__term">Physics Verdict</dt>
            <dd className="capp-ai-context__desc">{physicsVerdict}</dd>
          </>
        )}
        {mixeryBridge && (
          <>
            <dt className="capp-ai-context__term">Mixergy Bridge</dt>
            <dd className="capp-ai-context__desc">{mixeryBridge}</dd>
          </>
        )}
        {improvementPath && (
          <>
            <dt className="capp-ai-context__term">Improvement Pathway</dt>
            <dd className="capp-ai-context__desc">{improvementPath}</dd>
          </>
        )}
        {roadmapContext && (
          <>
            <dt className="capp-ai-context__term">Three-Year Roadmap</dt>
            <dd className="capp-ai-context__desc">{roadmapContext}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

// ─── Pillar 2: Mixergy Bridge Panel ──────────────────────────────────────────

/**
 * MixeryBridgePanel — Pillar 2 Verdict.
 *
 * Frames a pressure-constraint physics flag as the positive reason for the
 * Mixergy cylinder selection, replacing the old pattern of flagging low pressure
 * as a "problem to be tested".
 *
 * Narrative: Mixergy operates efficiently from tank-fed supply pressures upward,
 * providing an immediate upgrade while remaining mains-pressure ready for future.
 *
 * Rendered only when: stored system type (system/regular) AND
 *                     physicsFlags.pressureConstraint is true.
 */
function MixeryBridgePanel({
  recommendedScenario,
}: {
  recommendedScenario: ScenarioResult | undefined;
}) {
  if (!recommendedScenario) return null;
  const isStoredSystem =
    recommendedScenario.system.type === 'system' ||
    recommendedScenario.system.type === 'regular';
  if (!isStoredSystem || !recommendedScenario.physicsFlags.pressureConstraint) return null;

  return (
    <section
      className="capp-mixery-bridge"
      aria-label="Why Mixergy cylinder"
      data-testid="capp-mixery-bridge"
    >
      <p className="capp-mixery-bridge__heading">Why Mixergy?</p>
      <p className="capp-mixery-bridge__body">
        Mixergy is selected because it operates efficiently from tank-fed supply pressures
        upward — an immediate upgrade for your current setup. If your external mains supply
        is ever improved, the system is already mains-pressure ready.
      </p>
    </section>
  );
}

// ─── Pillar 2: Radiator Upsell Panel ─────────────────────────────────────────

/**
 * RadiatorUpsellPanel — Pillar 2 Verdict.
 *
 * Highlights the current high flow temperature (physicsFlags.highTempRequired)
 * or undersized primary pipework (physicsFlags.hydraulicLimit) as a
 * future-proofing barrier. Frames a radiator upgrade programme as the path
 * toward condensing-mode efficiency and heat-pump readiness.
 *
 * Uses hedged language for pipework claims per atlas-terminology.md §14.
 *
 * Rendered only when: physicsFlags.highTempRequired OR physicsFlags.hydraulicLimit.
 */
function RadiatorUpsellPanel({
  recommendedScenario,
}: {
  recommendedScenario: ScenarioResult | undefined;
}) {
  if (!recommendedScenario) return null;
  const { highTempRequired, hydraulicLimit } = recommendedScenario.physicsFlags;
  if (!highTempRequired && !hydraulicLimit) return null;

  return (
    <section
      className="capp-radiator-upsell"
      aria-label="Future-proofing: radiator upgrade"
      data-testid="capp-radiator-upsell"
    >
      <p className="capp-radiator-upsell__heading">Future-proofing: radiator upgrade</p>
      {highTempRequired && (
        <p className="capp-radiator-upsell__body">
          Your current system requires a high flow temperature to heat the existing
          radiators. Upgrading key radiators to allow a lower flow temperature unlocks
          condensing-mode efficiency and prepares the system for lower-temperature
          technologies in future.
        </p>
      )}
      {hydraulicLimit && (
        <p className="capp-radiator-upsell__body">
          Your current primary pipework may need upgrading to support a future air source
          heat pump — confirm against the selected model's primary flow rate requirements.
        </p>
      )}
    </section>
  );
}

// ─── Pillar 3: Simultaneous Use Panel ────────────────────────────────────────

/**
 * SimultaneousUsePanel — Pillar 3 Technical Blueprint.
 *
 * Shown for stored-hot-water systems when the household has 4 or more occupants.
 * Illustrates how stored hot water allows concurrent draws without the efficiency
 * degradation that on-demand systems experience on short draws.
 *
 * Rendered only when: stored system type AND occupants ≥ 4.
 */
function SimultaneousUsePanel({
  decision,
  recommendedScenario,
}: {
  decision: AtlasDecisionV1;
  recommendedScenario: ScenarioResult | undefined;
}) {
  if (!recommendedScenario) return null;
  const isStoredSystem =
    recommendedScenario.system.type === 'system' ||
    recommendedScenario.system.type === 'regular';
  if (!isStoredSystem) return null;

  const occupantFact = decision.supportingFacts.find(
    (f) =>
      f.label.toLowerCase().includes('occupant') ||
      f.label.toLowerCase().includes('person') ||
      f.label.toLowerCase().includes('resident'),
  );
  const occupantCount =
    typeof occupantFact?.value === 'number'
      ? occupantFact.value
      : parseInt(String(occupantFact?.value ?? '0'), 10);
  if (isNaN(occupantCount) || occupantCount < 4) return null;

  return (
    <section
      className="capp-simultaneous-use"
      aria-label="Simultaneous use scenario"
      data-testid="capp-simultaneous-use"
    >
      <p className="capp-simultaneous-use__heading">
        Simultaneous use: {occupantCount} people
      </p>
      <p className="capp-simultaneous-use__body">
        Stored hot water allows multiple outlets to draw simultaneously from the
        cylinder. On-demand hot water can show significant efficiency degradation
        on short draws — stored systems avoid this because heat is already in
        reserve, and concurrent use does not reduce delivery temperature.
      </p>
    </section>
  );
}

// ─── Pillar 3: Mixer Shower Compatibility Section ─────────────────────────────

/**
 * MixerShowerCompatibilitySection — Pillar 3 Technical Blueprint.
 *
 * Shown when the shower compatibility note identifies a balanced-supply
 * requirement (warningKey === 'mixer_balanced_supply'). Warns that a
 * Thermostatic Mixer Valve (TMV) designed for tank-fed systems may require
 * a balanced supply check when transitioning to a mains-fed or unvented supply.
 *
 * The title "Thermostatic mixer valve (TMV) compatibility check" is deliberately
 * distinct from the WarningBlock title so there is no duplicate heading when both
 * the VisualBlock warning and this section are rendered.
 *
 * Rendered only when: showerCompatibilityNote.warningKey === 'mixer_balanced_supply'.
 */
function MixerShowerCompatibilitySection({ decision }: { decision: AtlasDecisionV1 }) {
  const note = decision.showerCompatibilityNote;
  if (!note || note.warningKey !== 'mixer_balanced_supply') return null;

  return (
    <section
      className="capp-mixer-shower-check"
      aria-label="Thermostatic mixer valve compatibility check"
      data-testid="capp-mixer-shower-check"
    >
      <p className="capp-mixer-shower-check__heading">
        Thermostatic mixer valve (TMV) compatibility check
      </p>
      <p className="capp-mixer-shower-check__summary">{note.customerSummary}</p>
    </section>
  );
}

// ─── Pillar 4: Three-Year Roadmap Section ─────────────────────────────────────

/**
 * ThreeYearRoadmapSection — Pillar 4 Roadmap.
 *
 * Shown when the existing system is at_risk and the recommendation is a
 * stored-hot-water system. Converts "at risk" status into a structured
 * three-year capital programme:
 *
 *  Year 1 — Install recommended system + system clean and corrosion protection.
 *  Year 2 — Radiator upgrade programme (when highTempRequired flag is raised).
 *  Year 3 — Pipework optimisation to clear the path for an air source heat pump
 *            (when hydraulicLimit flag or ASHP appears in futureUpgradePaths).
 *
 * Rendered only when: lifecycle.currentSystem.condition === 'at_risk' AND
 *                     stored system type (system/regular).
 */
function ThreeYearRoadmapSection({
  decision,
  recommendedScenario,
}: {
  decision: AtlasDecisionV1;
  recommendedScenario: ScenarioResult | undefined;
}) {
  if (!recommendedScenario) return null;
  const isAtRisk = decision.lifecycle.currentSystem.condition === 'at_risk';
  const isStoredSystem =
    recommendedScenario.system.type === 'system' ||
    recommendedScenario.system.type === 'regular';
  if (!isAtRisk || !isStoredSystem) return null;

  const showRadiatorYear = Boolean(recommendedScenario.physicsFlags.highTempRequired);
  const showPipeworkYear = Boolean(
    recommendedScenario.physicsFlags.hydraulicLimit ||
      decision.futureUpgradePaths.some((p) => p.toLowerCase().includes('heat pump')),
  );

  return (
    <section
      className="capp-three-year-roadmap"
      aria-label="Three-year upgrade roadmap"
      data-testid="capp-three-year-roadmap"
    >
      <p className="capp-three-year-roadmap__heading">Three-year upgrade roadmap</p>
      <ol className="capp-three-year-roadmap__list">
        <li className="capp-three-year-roadmap__item" data-testid="capp-roadmap-year-1">
          <span className="capp-three-year-roadmap__year">Year 1</span>
          <span className="capp-three-year-roadmap__action">
            Install {recommendedScenario.system.summary} + system clean and corrosion
            protection.
          </span>
        </li>
        {showRadiatorYear && (
          <li className="capp-three-year-roadmap__item" data-testid="capp-roadmap-year-2">
            <span className="capp-three-year-roadmap__year">Year 2</span>
            <span className="capp-three-year-roadmap__action">
              Radiator upgrade programme — target rooms with highest heat loss to reduce
              system flow temperature toward condensing mode.
            </span>
          </li>
        )}
        {showPipeworkYear && (
          <li className="capp-three-year-roadmap__item" data-testid="capp-roadmap-year-3">
            <span className="capp-three-year-roadmap__year">Year 3</span>
            <span className="capp-three-year-roadmap__action">
              Pipework optimisation — remove flow restrictions and prepare the primary
              circuit for an air source heat pump.
            </span>
          </li>
        )}
      </ol>
    </section>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * CustomerAdvicePrintPack
 *
 * Multi-page customer advice document structured around the Four Atlas Pillars.
 *
 * Page 1 — Executive Summary (Pillar 1: Identity)
 *   Hero/facts/priority blocks + At-a-Glance panel (enhanced: cylinder volume,
 *   condition band badge, volume gap advisory) + AI context block.
 *
 * Page 2 — Comparison & Roadmap (Pillars 2 & 4: Verdict + Roadmap)
 *   Solution blocks + Mixergy Bridge panel + Radiator Upsell panel +
 *   Atlas Pick vs alternatives + Avoided Risks + future upgrade paths +
 *   Three-Year Roadmap section (when at_risk) + AI context block.
 *
 * Page 3 — Technical Blueprint (Pillar 2: Verdict / Pillar 3: Experience)
 *   Requirements checklist + scope/warning/spatial blocks +
 *   Simultaneous Use panel + Mixer Shower Compatibility section +
 *   installation complexity badge (enhanced: cleaning note when at_risk) +
 *   AI context block.
 *
 * Portal CTA page — unchanged from previous design.
 *
 * Screen view: toolbar with Back + Print, then stacked A4 pages with shadow.
 * Print view:  toolbar hidden, pages fill the physical paper with margins.
 */
export function CustomerAdvicePrintPack({
  decision,
  scenarios,
  visualBlocks,
  portalUrl,
  visitDate,
  onBack,
  lockedSummary,
  showRejectedOptionProof = false,
  printFullAiHandoff = false,
  showTechnicalAudit = false,
}: CustomerAdvicePrintPackProps) {
  const packTitle = `Atlas advice pack${visitDate ? ` — ${visitDate}` : ''}`;
  const headline  = decision.headline;
  const summary   = lockedSummary ?? buildCustomerSummary(decision, scenarios);
  const aiHandoff = buildLockedAiHandoffText(summary);

  // Derive recommended scenario once — used by physics-driven conditional panels.
  const recommendedScenario = scenarios.find(
    (s) => s.scenarioId === decision.recommendedScenarioId,
  );

  const { identity, verdict, roadmap, technical, cta } = categoriseBlocks(
    visualBlocks,
    showRejectedOptionProof,
  );

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

        {/* Empty state — shown only when no blocks have been built yet */}
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

        {visualBlocks.length > 0 && (
          <>
            {/* ── Page 1: Executive Summary (Identity) ── */}
            <section
              className="capp-page capp-page--hero capp-page--identity"
              data-testid="capp-page-identity"
              aria-label="Executive Summary"
            >
              <p className="capp-page__label capp-page__label--pillar">
                Pillar 1 · Identity — Executive Summary
              </p>

              {/* Identity blocks: hero, facts, customer_need_resolution */}
              {identity.map((block) => (
                <ThemedBlock key={block.id} block={block} />
              ))}

              {/* At-a-Glance property stats sidebar */}
              <AtAGlancePanel decision={decision} />

              {/* AI-Ready Context Block */}
              <AiContextBlock decision={decision} recommendedScenario={recommendedScenario} />

              <footer className="capp-page__footer" aria-hidden="true">
                {headline}{visitDate ? ` · ${visitDate}` : ''}
              </footer>
            </section>

            {/* ── Page 2: Comparison & Roadmap (Verdict + Roadmap) ── */}
            <section
              className="capp-page capp-page--verdict-roadmap"
              data-testid="capp-page-verdict"
              aria-label="Comparison and Roadmap"
            >
              <p className="capp-page__label capp-page__label--pillar">
                Pillars 2 & 4 · Verdict & Roadmap — Comparison
              </p>

              {/* Verdict blocks: solution, problem (if shown) */}
              {verdict.map((block) => (
                <ThemedBlock key={block.id} block={block} />
              ))}

              {/* Pillar 2: Mixergy Bridge — positive framing of pressure constraint */}
              <MixeryBridgePanel recommendedScenario={recommendedScenario} />

              {/* Pillar 2: Radiator Upsell — future-proofing via flow temperature */}
              <RadiatorUpsellPanel recommendedScenario={recommendedScenario} />

              {/* Atlas Pick vs alternatives */}
              <ComparisonSection decision={decision} scenarios={scenarios} />

              {/* Avoided Risks */}
              <AvoidedRisksSection avoidedRisks={decision.avoidedRisks} />

              {/* Roadmap blocks: future_upgrade */}
              {roadmap.map((block) => (
                <ThemedBlock key={block.id} block={block} />
              ))}

              {/* Pillar 4: Three-Year Roadmap — structured capital programme for at_risk systems */}
              <ThreeYearRoadmapSection decision={decision} recommendedScenario={recommendedScenario} />

              {/* AI-Ready Context Block */}
              <AiContextBlock decision={decision} recommendedScenario={recommendedScenario} />

              <footer className="capp-page__footer" aria-hidden="true">
                {headline}
              </footer>
            </section>

            {/* ── Page 3: Technical Blueprint ── */}
            <section
              className="capp-page capp-page--technical"
              data-testid="capp-page-technical"
              aria-label="Technical Blueprint"
            >
              <p className="capp-page__label capp-page__label--pillar">
                Pillar 2 · Verdict — Technical Blueprint
              </p>

              {/* Requirements checklist from quote scope */}
              <RequirementsSection decision={decision} />

              {/* Technical blocks: included_scope, system_work_explainer, warning, spatial_proof */}
              {technical.map((block) => (
                <ThemedBlock key={block.id} block={block} />
              ))}

              {/* Pillar 3: Simultaneous Use — stored hot water for high-occupancy households */}
              <SimultaneousUsePanel decision={decision} recommendedScenario={recommendedScenario} />

              {/* Pillar 3: Mixer Shower Compatibility — TMV balanced supply check */}
              <MixerShowerCompatibilitySection decision={decision} />

              {/* Installation complexity summary */}
              <InstallComplexityBadge decision={decision} />

              {/* AI-Ready Context Block */}
              <AiContextBlock decision={decision} recommendedScenario={recommendedScenario} />

              <footer className="capp-page__footer" aria-hidden="true">
                {headline}
              </footer>
            </section>

            {/* ── Portal CTA page ── */}
            {cta && (
              <section
                className="capp-page capp-page--portal-cta"
                data-testid="capp-block-portal_cta"
                data-block-id={cta.id}
                aria-label="Your portal"
              >
                <p className="capp-page__label">Your portal</p>

                {/* Portal CTA heading and supporting points */}
                <div className="customer-deck__block customer-deck__block--portal-cta">
                  <div className="customer-deck__block-body">
                    <h2 className="customer-deck__title">{cta.title}</h2>
                    <p className="customer-deck__outcome">{cta.outcome}</p>
                    {cta.supportingPoints && cta.supportingPoints.length > 0 && (
                      <ul className="customer-deck__supporting-points" aria-label="What you can do">
                        {cta.supportingPoints.slice(0, 3).map((point) => (
                          <li key={point} className="customer-deck__supporting-point">
                            <span className="customer-deck__point-marker" aria-hidden="true">✓</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Compact QR + URL card */}
                <PrintPortalCta portalUrl={portalUrl} />

                {/* AI handoff section */}
                <section
                  className="capp-ai-handoff"
                  aria-label="AI depth section"
                  data-testid="capp-ai-handoff"
                >
                  <div className="capp-ai-handoff__header">
                    <span className="capp-ai-handoff__icon" aria-hidden="true">✦</span>
                    <span className="capp-ai-handoff__title">Want to understand this in more detail?</span>
                    <span className="capp-ai-handoff__hint">
                      {printFullAiHandoff
                        ? 'Copy the text below into ChatGPT, Claude, or Gemini to explore the reasoning behind this recommendation'
                        : 'Your installer can share a full AI summary via your portal link above. We can also include a machine-readable AI summary inside this PDF as an optional export.'}
                    </span>
                  </div>
                  {printFullAiHandoff && (
                    <pre
                      className="capp-ai-handoff__text"
                      data-testid="capp-ai-handoff-text"
                    >
                      {aiHandoff}
                    </pre>
                  )}
                </section>

                <footer className="capp-page__footer" aria-hidden="true">
                  {headline}{visitDate ? ` · ${visitDate}` : ''}
                </footer>
              </section>
            )}
          </>
        )}

        {showTechnicalAudit && (
          <TechnicalAuditAppendix decision={decision} scenarios={scenarios} />
        )}
      </div>
    </div>
  );
}

export default CustomerAdvicePrintPack;
