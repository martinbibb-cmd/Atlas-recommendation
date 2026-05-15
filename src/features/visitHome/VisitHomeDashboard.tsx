/**
 * VisitHomeDashboard.tsx
 *
 * Visit Home Dashboard Shell — the intuitive front door for a completed visit.
 *
 * Shows all outputs from an Atlas visit as status-aware cards:
 *   1. Recommendation summary     (customer · engine · ready/needs-review/blocked)
 *   2. Customer portal / Insight  (customer · workflow · ready/blocked)
 *   3. Daily hot-water simulator  (surveyor/engineer · simulator · ready)
 *   4. Supporting PDF             (customer/office · library · ready/blocked)
 *   5. Implementation workflow    (engineer · workflow · ready/blocked)
 *   6. Follow-up / scan handoff   (engineer · workflow · ready/blocked)
 *   7. Export package             (office · workflow · ready/blocked)
 *
 * Plus a Journey card derived from the engine output / archetype detection.
 *
 * DESIGN RULES:
 *   - No engine, simulator, portal, PDF, or implementation logic.
 *   - All CTAs call existing handlers — no new routes.
 *   - Status badges use: ready / needs-review / blocked / dev-only
 *   - Blocked cards show the status badge; the CTA is disabled (no broken links).
 *   - Audience badges: customer / surveyor / office / engineer
 *   - Source badges: engine / library / workflow / simulator
 */

import type { CSSProperties } from 'react';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import { detectVisitJourney } from './detectVisitJourney';
import './VisitHomeDashboard.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CardStatus = 'ready' | 'needs-review' | 'blocked' | 'dev-only';
export type CardAudience = 'customer' | 'surveyor' | 'office' | 'engineer';
export type CardSource = 'engine' | 'library' | 'workflow' | 'simulator';

export interface VisitHomeDashboardProps {
  /** Active visit ID — used to derive availability of outputs. */
  visitId?: string;
  /** Completed engine input for this visit. */
  engineInput?: EngineInputV2_3;
  /** Engine output derived from the latest survey. */
  engineOutput?: EngineOutputV1;
  /** Evaluated scenario results for this visit. */
  scenarios?: ScenarioResult[];
  /** Full survey model from the most recent draft. */
  surveyModel?: FullSurveyModelV1;
  /**
   * Signed portal URL, if one has been generated for the active visit.
   * When absent the Customer Portal card shows 'needs-review'.
   */
  portalUrl?: string;
  /**
   * Number of installation specification options saved for this visit.
   * When > 0 the Implementation Workflow card shows 'ready'.
   */
  installationSpecOptionCount?: number;

  // ── Library safety ─────────────────────────────────────────────────────────

  /**
   * When true the library projection is not safe for customer output.
   * Forces the Supporting PDF and Customer Portal / Insight cards to 'blocked'
   * so the surveyor cannot accidentally share unsafe educational content.
   */
  libraryUnsafe?: boolean;
  /**
   * Human-readable reasons why the library is blocked.
   * Shown as supplementary text on blocked PDF / portal cards.
   */
  libraryBlockReasons?: readonly string[];

  // ── Continue-where-you-left-off ────────────────────────────────────────────

  /**
   * Label for the last surface opened from this dashboard (e.g. 'Simulator').
   * When provided, a "Continue" banner is shown at the top of the dashboard.
   */
  lastSurface?: string;
  /** Opens the last surface the user was on. Only called when lastSurface is set. */
  onContinueLastSurface?: () => void;

  // ── CTA handlers (all delegate to existing App.tsx journeys) ─────────────

  /** Open the Simulator Dashboard (journey = 'simulator'). */
  onOpenSimulator: () => void;
  /** Open the in-room Presentation (journey = 'presentation'). */
  onOpenPresentation: () => void;
  /** Print the supporting PDF (journey = 'framework-print'). */
  onPrintSummary: () => void;
  /** Open the Installation Specification stepper (journey = 'installation-specification'). */
  onOpenInstallationSpecification: () => void;
  /** Open the Atlas Insight Pack (journey = 'insight-pack'). */
  onOpenInsightPack?: () => void;
  /** Open the completed-visit handoff review (journey = 'visit-handoff'). */
  onOpenHandoffReview?: () => void;
  /** Open the pre-install engineer route (journey = 'engineer'). */
  onOpenEngineerRoute?: () => void;
  /**
   * Trigger a local export-package download for the active visit.
   * When absent the Export package card is still shown but its CTA is disabled.
   */
  onExportPackage?: () => void;
  /** Navigate back (typically to workspace-dashboard). */
  onBack: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<CardStatus, CSSProperties & { label: string }> = {
  'ready':        { label: 'Ready',         background: '#f0fdf4', color: '#166534', borderColor: '#86efac' },
  'needs-review': { label: 'Needs review',  background: '#fffbeb', color: '#92400e', borderColor: '#fcd34d' },
  'blocked':      { label: 'Blocked',       background: '#fef2f2', color: '#991b1b', borderColor: '#fca5a5' },
  'dev-only':     { label: 'Dev only',      background: '#f8fafc', color: '#64748b', borderColor: '#e2e8f0' },
};

const AUDIENCE_COLOURS: Record<CardAudience, { bg: string; color: string }> = {
  customer:  { bg: '#eff6ff', color: '#1d4ed8' },
  surveyor:  { bg: '#f5f3ff', color: '#6d28d9' },
  office:    { bg: '#ecfdf5', color: '#065f46' },
  engineer:  { bg: '#fff7ed', color: '#9a3412' },
};

const SOURCE_COLOURS: Record<CardSource, { bg: string; color: string }> = {
  engine:    { bg: '#f0f9ff', color: '#0369a1' },
  library:   { bg: '#fdf4ff', color: '#7e22ce' },
  workflow:  { bg: '#f0fdf4', color: '#15803d' },
  simulator: { bg: '#fff1f2', color: '#be123c' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CardStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className="vhd-badge vhd-badge--status"
      style={{ background: s.background, color: s.color, borderColor: s.borderColor as string }}
    >
      {s.label}
    </span>
  );
}

function AudienceBadge({ audience }: { audience: CardAudience }) {
  const s = AUDIENCE_COLOURS[audience];
  return (
    <span
      className="vhd-badge vhd-badge--audience"
      style={{ background: s.bg, color: s.color }}
    >
      {audience}
    </span>
  );
}

function SourceBadge({ source }: { source: CardSource }) {
  const s = SOURCE_COLOURS[source];
  return (
    <span
      className="vhd-badge vhd-badge--source"
      style={{ background: s.bg, color: s.color }}
    >
      {source}
    </span>
  );
}

interface DashboardCardProps {
  'data-testid'?: string;
  icon: string;
  title: string;
  description: string;
  status: CardStatus;
  audience: CardAudience[];
  source: CardSource;
  ctaLabel: string;
  onCta: (() => void) | undefined;
}

function DashboardCard({
  'data-testid': testId,
  icon,
  title,
  description,
  status,
  audience,
  source,
  ctaLabel,
  onCta,
}: DashboardCardProps) {
  const isBlocked = status === 'blocked';
  return (
    <div
      className={`vhd-card${isBlocked ? ' vhd-card--blocked' : ''}`}
      data-testid={testId}
      data-status={status}
    >
      <div className="vhd-card__header">
        <span className="vhd-card__icon" aria-hidden="true">{icon}</span>
        <StatusBadge status={status} />
      </div>
      <h3 className="vhd-card__title">{title}</h3>
      <p className="vhd-card__description">{description}</p>
      <div className="vhd-card__meta">
        {audience.map((a) => <AudienceBadge key={a} audience={a} />)}
        <SourceBadge source={source} />
      </div>
      <button
        type="button"
        className="vhd-card__cta"
        onClick={onCta}
        disabled={isBlocked || onCta == null}
        aria-disabled={isBlocked || onCta == null}
        data-testid={testId ? `${testId}-cta` : undefined}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VisitHomeDashboard({
  visitId,
  engineInput,
  engineOutput,
  scenarios,
  surveyModel,
  portalUrl,
  installationSpecOptionCount = 0,
  libraryUnsafe = false,
  libraryBlockReasons,
  lastSurface,
  onContinueLastSurface,
  onOpenSimulator,
  onOpenPresentation,
  onPrintSummary,
  onOpenInstallationSpecification,
  onOpenInsightPack,
  onOpenHandoffReview,
  // onOpenEngineerRoute is accepted for future use but not currently wired to a card
  onExportPackage,
  onBack,
}: VisitHomeDashboardProps) {
  // ── Derive card statuses from available data ───────────────────────────────

  const hasEngineData = engineOutput != null && engineInput != null;
  const hasVisit = visitId != null;

  const recommendationStatus: CardStatus = hasEngineData
    ? 'ready'
    : hasVisit
    ? 'needs-review'
    : 'blocked';

  const portalStatus: CardStatus = libraryUnsafe
    ? 'blocked'
    : portalUrl != null
    ? 'ready'
    : hasEngineData
    ? 'needs-review'
    : 'blocked';

  const simulatorStatus: CardStatus = hasEngineData ? 'ready' : 'needs-review';

  const pdfStatus: CardStatus = libraryUnsafe
    ? 'blocked'
    : hasEngineData
    ? 'ready'
    : 'blocked';

  const implementationStatus: CardStatus = installationSpecOptionCount > 0
    ? 'ready'
    : hasEngineData
    ? 'needs-review'
    : 'blocked';

  const handoffStatus: CardStatus = hasVisit && hasEngineData ? 'ready' : 'blocked';

  const exportStatus: CardStatus = hasVisit && hasEngineData ? 'ready' : 'blocked';

  // ── Journey card detection ─────────────────────────────────────────────────

  const systemCircuit =
    surveyModel?.fullSurvey?.heatingCondition?.systemCircuitType ??
    (surveyModel?.currentSystem?.heatingSystemType as 'open_vented' | 'sealed' | 'unknown' | undefined);
  const journeyInfo = detectVisitJourney(engineOutput, scenarios, systemCircuit);

  // ── Property title for display ─────────────────────────────────────────────

  const propertyTitle = engineInput?.postcode
    ? engineInput.postcode
    : visitId
    ? `Visit ${visitId.slice(-8).toUpperCase()}`
    : 'Current visit';

  // ── Stable portal CTA — avoids inline arrow on every render ───────────────

  const handleOpenPortal = portalUrl != null
    ? () => { window.open(portalUrl, '_blank', 'noopener,noreferrer'); }
    : undefined;

  return (
    <div className="vhd-root">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="vhd-header">
        <button
          type="button"
          className="back-btn vhd-header__back"
          onClick={onBack}
          data-testid="visit-home-back"
        >
          ← Back
        </button>
        <div>
          <h1 className="vhd-header__title">Visit Dashboard</h1>
          <p className="vhd-header__subtitle">{propertyTitle}</p>
        </div>
      </div>

      {/* ── Continue-where-you-left-off banner ─────────────────────────────── */}
      {lastSurface != null && onContinueLastSurface != null && (
        <div className="vhd-continue-banner" data-testid="visit-home-continue-banner">
          <span>Continue: <strong>{lastSurface}</strong></span>
          <button
            type="button"
            className="vhd-continue-banner__btn"
            onClick={onContinueLastSurface}
            data-testid="visit-home-continue-btn"
          >
            Continue →
          </button>
        </div>
      )}

      {/* ── Journey card ───────────────────────────────────────────────────── */}
      {journeyInfo.archetype != null && (
        <div
          className="vhd-journey-card"
          data-testid="visit-journey-card"
          data-archetype={journeyInfo.archetype}
        >
          <span className="vhd-journey-card__icon" aria-hidden="true">
            {journeyInfo.icon}
          </span>
          <div>
            <div className="vhd-journey-card__label">{journeyInfo.label}</div>
            <div className="vhd-journey-card__description">{journeyInfo.description}</div>
          </div>
        </div>
      )}

      {/* ── Card grid ──────────────────────────────────────────────────────── */}
      <div className="vhd-grid">

        {/* 1. Recommendation summary */}
        <DashboardCard
          data-testid="card-recommendation"
          icon="🎯"
          title="Recommendation summary"
          description="In-room presentation of the engine-derived recommendation with evidence and scenarios."
          status={recommendationStatus}
          audience={['customer', 'surveyor']}
          source="engine"
          ctaLabel="Open presentation →"
          onCta={hasEngineData ? onOpenPresentation : undefined}
        />

        {/* 2. Customer portal / Insight */}
        <DashboardCard
          data-testid="card-portal"
          icon="🔗"
          title="Customer portal / Insight"
          description={
            libraryUnsafe && libraryBlockReasons && libraryBlockReasons.length > 0
              ? `Blocked: ${libraryBlockReasons[0]}`
              : 'Shareable customer portal link with QR code and personalised Atlas Insight Pack.'
          }
          status={portalStatus}
          audience={['customer']}
          source="workflow"
          ctaLabel={onOpenInsightPack != null ? 'Open Insight Pack →' : 'Portal ready →'}
          onCta={onOpenInsightPack ?? handleOpenPortal}
        />

        {/* 3. Daily hot-water simulator */}
        <DashboardCard
          data-testid="card-simulator"
          icon="📊"
          title="Daily hot-water simulator"
          description="Physics-driven 24-hour demand and system response charts for in-room explanation."
          status={simulatorStatus}
          audience={['surveyor', 'engineer']}
          source="simulator"
          ctaLabel="Open simulator →"
          onCta={onOpenSimulator}
        />

        {/* 4. Supporting PDF */}
        <DashboardCard
          data-testid="card-pdf"
          icon="📄"
          title="Supporting PDF"
          description={
            libraryUnsafe && libraryBlockReasons && libraryBlockReasons.length > 0
              ? `Blocked: ${libraryBlockReasons[0]}`
              : 'Customer-facing print pack with recommendation, scenarios, and library explainers.'
          }
          status={pdfStatus}
          audience={['customer', 'office']}
          source="library"
          ctaLabel="Print summary →"
          onCta={hasEngineData ? onPrintSummary : undefined}
        />

        {/* 5. Implementation workflow */}
        <DashboardCard
          data-testid="card-implementation"
          icon="🔧"
          title="Implementation workflow"
          description={
            installationSpecOptionCount > 0
              ? `Installation specification — ${installationSpecOptionCount} option${installationSpecOptionCount === 1 ? '' : 's'} saved.`
              : 'Installation specification stepper — scope, materials, and commissioning checklist.'
          }
          status={implementationStatus}
          audience={['engineer']}
          source="workflow"
          ctaLabel={installationSpecOptionCount > 0 ? 'Review specification →' : 'Start specification →'}
          onCta={hasEngineData ? onOpenInstallationSpecification : undefined}
        />

        {/* 6. Follow-up evidence / scan handoff */}
        <DashboardCard
          data-testid="card-handoff"
          icon="📱"
          title="Follow-up evidence / scan handoff"
          description="Post-visit handoff review with captured scan evidence and engineer notes."
          status={handoffStatus}
          audience={['engineer', 'office']}
          source="workflow"
          ctaLabel="Review handoff →"
          onCta={onOpenHandoffReview}
        />

        {/* 7. Export package */}
        <DashboardCard
          data-testid="card-export"
          icon="📦"
          title="Export package"
          description="Full workflow export including recommendation, portal context, and specification."
          status={exportStatus}
          audience={['office']}
          source="workflow"
          ctaLabel="Export package →"
          onCta={onExportPackage}
        />

      </div>
    </div>
  );
}

export default VisitHomeDashboard;
