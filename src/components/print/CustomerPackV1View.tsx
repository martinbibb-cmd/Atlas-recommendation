/**
 * CustomerPackV1View.tsx
 *
 * Mind PR 35 — Render CustomerPackV1 from decision truth.
 *
 * Renders the 8-section decision-first customer pack.  All content comes
 * from a pre-built CustomerPackV1 — this component contains no recommendation
 * logic, no scoring, and no data re-derivation.
 *
 * Architecture:
 *   CustomerPackV1 → [this component] → branded A4-printable output
 *
 * Design rules:
 *  - No Math.random() — all content deterministic from the pack contract.
 *  - No new recommendation logic — all sections rendered verbatim from pack.
 *  - BrandProvider wraps the output so CSS custom properties (--atlas-brand-*)
 *    apply.  Brand changes style only; it cannot change content.
 *  - Separate page card per logical section group for A4 print safety.
 *  - Terminology: follows docs/atlas-terminology.md.
 */

import type { CustomerPackV1 } from '../../contracts/CustomerPackV1';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import {
  BrandProvider,
  BrandedHeader,
  BrandedFooter,
} from '../../features/branding';
import type { BrandProfileV1 } from '../../features/branding';
import { buildCustomerPackV1 } from '../../engine/modules/buildCustomerPackV1';
import type { BuildCustomerPackContext } from '../../engine/modules/buildCustomerPackV1';
import './CustomerPackV1View.css';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CustomerPackV1ViewProps {
  /**
   * The canonical decision output — source of truth for all pack content.
   * Used alongside scenarios to build or receive the CustomerPackV1.
   */
  decision: AtlasDecisionV1;
  /** All evaluated scenarios — required to build the pack when pack is absent. */
  scenarios: ScenarioResult[];
  /**
   * Pre-built pack.  When provided, used directly — no rebuild.
   * When absent, the pack is built from decision + scenarios via buildCustomerPackV1.
   */
  pack?: CustomerPackV1;
  /** Optional portal URL shown in the close section. */
  portalUrl?: string;
  /** Visit date string shown in the toolbar title. */
  visitDate?: string;
  /** Called when the user clicks Back in the screen toolbar. */
  onBack?: () => void;
  /**
   * Optional brand ID for white-label output.
   * When provided, BrandProvider resolves this brand's profile.
   */
  brandId?: string;
  /**
   * Optional raw BrandProfileV1 for direct injection (bypasses brandId lookup).
   * Useful in tests and Storybook.  Takes precedence over brandId.
   */
  brandProfile?: BrandProfileV1;
}

// ─── Section components ───────────────────────────────────────────────────────

/** Section 1 — The recommendation. */
function DecisionSection({ section }: { section: CustomerPackV1['decision'] }) {
  return (
    <section
      className="cpv1-decision"
      aria-label="Recommendation"
      data-testid="cpv1-decision"
    >
      <p className="cpv1-decision__system-label" data-testid="cpv1-system-label">
        {section.recommendedSystemLabel}
      </p>
      <h1 className="cpv1-decision__headline" data-testid="cpv1-headline">
        {section.headline}
      </h1>
      <p className="cpv1-decision__summary" data-testid="cpv1-summary">
        {section.summary}
      </p>
    </section>
  );
}

/** Section 2 — Why this works. */
function WhyThisWorksSection({ section }: { section: CustomerPackV1['whyThisWorks'] }) {
  if (section.reasons.length === 0) return null;
  return (
    <section
      aria-label="Why this works"
      data-testid="cpv1-why-this-works"
    >
      <p className="cpv1-section-label">Why this works</p>
      <ul className="cpv1-why-list" aria-label="Reasons">
        {section.reasons.map((reason) => (
          <li key={reason} className="cpv1-why-list__item">
            <span className="cpv1-why-list__check" aria-hidden="true">✓</span>
            {reason}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Section 3 — Anti-default. */
function AntiDefaultSection({ section }: { section: CustomerPackV1['antiDefault'] }) {
  return (
    <section
      aria-label="Why this system"
      data-testid="cpv1-anti-default"
    >
      <p className="cpv1-section-label">Why this system</p>
      <div className="cpv1-anti-default">
        <p className="cpv1-anti-default__narrative" data-testid="cpv1-anti-default-narrative">
          {section.narrative}
        </p>
        {section.evidencePoints.length > 0 && (
          <ul
            className="cpv1-anti-default__evidence"
            aria-label="Physics evidence"
            data-testid="cpv1-anti-default-evidence"
          >
            {section.evidencePoints.map((point) => (
              <li key={point} className="cpv1-anti-default__evidence-item">
                {point}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Section 4 — Daily benefits. */
function DailyBenefitsSection({ section }: { section: CustomerPackV1['dailyBenefits'] }) {
  if (section.outcomes.length === 0) return null;
  return (
    <section
      aria-label="Daily benefits"
      data-testid="cpv1-daily-benefits"
    >
      <p className="cpv1-section-label">Daily benefits</p>
      <ul className="cpv1-outcomes-list" aria-label="Day-to-day outcomes">
        {section.outcomes.map((outcome) => (
          <li key={outcome} className="cpv1-outcomes-list__item">
            {outcome}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Section 5 — Full system scope. */
function FullSystemSection({ section }: { section: CustomerPackV1['fullSystem'] }) {
  return (
    <section
      aria-label="Full system"
      data-testid="cpv1-full-system"
    >
      <p className="cpv1-section-label">Full system</p>

      {section.includedItems.length > 0 && (
        <>
          <p className="cpv1-subheading">What is included</p>
          <ul className="cpv1-scope-list" aria-label="Included items" data-testid="cpv1-included-items">
            {section.includedItems.map((item) => (
              <li key={item} className="cpv1-scope-list__item">{item}</li>
            ))}
          </ul>
        </>
      )}

      {section.requiredWorks.length > 0 && (
        <>
          <p className="cpv1-subheading" style={{ marginTop: '0.75rem' }}>Installation works</p>
          <ul className="cpv1-works-list" aria-label="Required works" data-testid="cpv1-required-works">
            {section.requiredWorks.map((work) => (
              <li key={work} className="cpv1-works-list__item">{work}</li>
            ))}
          </ul>
        </>
      )}

      {section.compatibilityNotes.length > 0 && (
        <div className="cpv1-compat-notes" aria-label="Compatibility notes" data-testid="cpv1-compat-notes">
          {section.compatibilityNotes.map((note) => (
            <p key={note} className="cpv1-compat-note">{note}</p>
          ))}
        </div>
      )}
    </section>
  );
}

/** Section 6 — Daily use guidance. */
function DailyUseSection({ section }: { section: CustomerPackV1['dailyUse'] }) {
  if (section.guidance.length === 0) return null;
  return (
    <section
      aria-label="Daily use"
      data-testid="cpv1-daily-use"
    >
      <p className="cpv1-section-label">Daily use</p>
      <ul className="cpv1-guidance-list" aria-label="Daily use guidance">
        {section.guidance.map((item) => (
          <li key={item} className="cpv1-guidance-list__item">{item}</li>
        ))}
      </ul>
    </section>
  );
}

/** Section 7 — Future path. */
function FuturePathSection({ section }: { section: CustomerPackV1['futurePath'] }) {
  if (section.upgradePaths.length === 0) return null;
  return (
    <section
      aria-label="Future path"
      data-testid="cpv1-future-path"
    >
      <p className="cpv1-section-label">Future path</p>
      <ul className="cpv1-future-list" aria-label="Upgrade paths">
        {section.upgradePaths.map((path) => (
          <li key={path} className="cpv1-future-list__item">{path}</li>
        ))}
      </ul>
    </section>
  );
}

/** Section 8 — Close / CTA. */
function CloseSection({ section }: { section: CustomerPackV1['close'] }) {
  return (
    <section
      aria-label="Next steps"
      data-testid="cpv1-close"
    >
      <p className="cpv1-section-label">Next steps</p>
      <div className="cpv1-close">
        <p className="cpv1-close__next-step" data-testid="cpv1-next-step">
          {section.nextStep}
        </p>
        {section.portalUrl ? (
          <a
            className="cpv1-close__portal-link"
            href={section.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="cpv1-portal-link"
          >
            {section.portalUrl}
          </a>
        ) : (
          <p
            className="cpv1-close__portal-placeholder"
            data-testid="cpv1-portal-placeholder"
          >
            Your portal link will be shared by your installer.
          </p>
        )}
      </div>
    </section>
  );
}

// ─── Inner content (BrandProvider-wrapped) ────────────────────────────────────

interface ContentProps {
  pack:      CustomerPackV1;
  visitDate?: string;
  onBack?:   () => void;
}

function CustomerPackV1Content({ pack, visitDate, onBack }: ContentProps) {
  const packTitle = `Customer recommendation${visitDate ? ` — ${visitDate}` : ''}`;

  return (
    <div className="cpv1-wrap" data-testid="cpv1-wrap">

      {/* Branded header */}
      <BrandedHeader />

      {/* Screen toolbar */}
      <div className="cpv1-toolbar" data-testid="cpv1-toolbar">
        {onBack && (
          <button
            type="button"
            className="cpv1-toolbar__back"
            onClick={onBack}
            data-testid="cpv1-back-button"
            aria-label="Back"
          >
            ← Back
          </button>
        )}
        <span className="cpv1-toolbar__title" data-testid="cpv1-toolbar-title">
          {packTitle}
        </span>
        <button
          type="button"
          className="cpv1-toolbar__print"
          onClick={() => window.print()}
          data-testid="cpv1-print-button"
          aria-label="Print recommendation"
        >
          Print
        </button>
      </div>

      {/* Document */}
      <div className="cpv1-document" data-testid="cpv1-document">

        {/* Page 1 — Decision + Why this works + Anti-default */}
        <div className="cpv1-page" data-testid="cpv1-page-1">
          <DecisionSection    section={pack.decision} />
          <WhyThisWorksSection section={pack.whyThisWorks} />
          <AntiDefaultSection  section={pack.antiDefault} />
        </div>

        {/* Page 2 — Daily benefits + Full system */}
        <div className="cpv1-page" data-testid="cpv1-page-2">
          <DailyBenefitsSection section={pack.dailyBenefits} />
          <FullSystemSection    section={pack.fullSystem} />
        </div>

        {/* Page 3 — Daily use + Future path + Close */}
        <div className="cpv1-page" data-testid="cpv1-page-3">
          <DailyUseSection    section={pack.dailyUse} />
          <FuturePathSection  section={pack.futurePath} />
          <CloseSection       section={pack.close} />
        </div>

      </div>

      {/* Branded footer */}
      <BrandedFooter />
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

/**
 * CustomerPackV1View
 *
 * Branded A4-printable render of the 8-section decision-first customer pack.
 *
 * Usage:
 *   // Pre-built pack:
 *   <CustomerPackV1View decision={decision} scenarios={scenarios} pack={pack} />
 *
 *   // Auto-build from decision + scenarios:
 *   <CustomerPackV1View decision={decision} scenarios={scenarios} />
 *
 *   // With brand:
 *   <CustomerPackV1View decision={decision} scenarios={scenarios} brandId="my-brand" />
 */
export function CustomerPackV1View({
  decision,
  scenarios,
  pack: packProp,
  portalUrl,
  visitDate,
  onBack,
  brandId,
  brandProfile,
}: CustomerPackV1ViewProps) {
  const context: BuildCustomerPackContext = { portalUrl };

  // Use pre-built pack when available; otherwise build from decision + scenarios
  const pack = packProp ?? buildCustomerPackV1(decision, scenarios, context);

  return (
    <BrandProvider brandId={brandId} profile={brandProfile}>
      <CustomerPackV1Content
        pack={pack}
        visitDate={visitDate}
        onBack={onBack}
      />
    </BrandProvider>
  );
}
