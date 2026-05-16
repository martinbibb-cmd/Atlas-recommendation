/**
 * VisitHomeDashboard.tsx
 *
 * Visit Home Dashboard Shell — workspace-first post-survey review surface.
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
 *   - No engine, simulator, portal, PDF, scan, or implementation logic.
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
import type { WorkspaceMemberPermission } from '../../auth/profile';
import {
  buildVisitHomeActionProjection,
  type VisitHomeActionId,
  type VisitHomeActionRole,
} from './buildVisitHomeActionProjection';
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
  /** Active workspace role used to project visible Visit Home actions. */
  workspaceRole?: VisitHomeActionRole;
  /** Active workspace permissions used to project blocked actions and reasons. */
  workspacePermissions?: readonly WorkspaceMemberPermission[];

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
  onPrintSummary?: () => void;
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
  variant?: 'default' | 'feature';
  blockedReason?: string;
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
  variant = 'default',
  blockedReason,
}: DashboardCardProps) {
  const isBlocked = status === 'blocked';
  const cardClassName = [
    'vhd-card',
    isBlocked ? 'vhd-card--blocked' : '',
    variant === 'feature' ? 'vhd-card--feature' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={cardClassName}
      data-testid={testId}
      data-status={status}
    >
      <div className="vhd-card__header">
        <span className="vhd-card__icon" aria-hidden="true">{icon}</span>
        <StatusBadge status={status} />
      </div>
      <h3 className="vhd-card__title">{title}</h3>
      <p className="vhd-card__description">{description}</p>
      {isBlocked && blockedReason != null && (
        <p className="vhd-card__reason" data-testid={testId ? `${testId}-blocked-reason` : undefined}>
          {blockedReason}
        </p>
      )}
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
  workspaceRole,
  workspacePermissions,
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
  onOpenEngineerRoute,
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
    : onPrintSummary != null && hasVisit && hasEngineData
    ? 'ready'
    : 'needs-review';

  const implementationStatus: CardStatus = installationSpecOptionCount > 0
    ? 'ready'
    : hasEngineData
    ? 'needs-review'
    : 'blocked';

  const handoffStatus: CardStatus = hasVisit && hasEngineData ? 'ready' : 'blocked';

  const exportStatus: CardStatus = hasVisit && hasEngineData ? 'ready' : 'blocked';
  const actionProjection = buildVisitHomeActionProjection({
    workspaceRole,
    workspacePermissions,
    visitReadiness: {
      hasVisit,
      hasEngineData,
    },
    libraryProjectionSafety: {
      unsafe: libraryUnsafe,
      reasons: libraryBlockReasons,
    },
    implementationReadiness: {
      installationSpecOptionCount,
    },
    availableOutputs: {
      hasPortalUrl: portalUrl != null,
      hasInsightPack: onOpenInsightPack != null,
      hasSupportingPdf: onPrintSummary != null,
      hasHandoffReview: onOpenHandoffReview != null,
      hasExportPackage: onExportPackage != null,
    },
  });
  const actionStateById = new Map(
    actionProjection.visibleActions.map((action) => [action.actionId, action]),
  );
  const isActionVisible = (actionId: VisitHomeActionId): boolean => actionStateById.has(actionId);
  const actionStatus = (actionId: VisitHomeActionId, fallback: CardStatus): CardStatus =>
    actionStateById.get(actionId)?.status ?? fallback;
  const actionReason = (actionId: VisitHomeActionId): string | undefined =>
    actionStateById.get(actionId)?.reasonLabel;
  const canTriggerAction = (
    actionId: VisitHomeActionId,
    fallback: CardStatus,
    triggerMode: 'ready-only' | 'ready-or-needs-review' | 'not-blocked' = 'ready-only',
  ): boolean => {
    const status = actionStatus(actionId, fallback);
    if (triggerMode === 'not-blocked') return status !== 'blocked';
    if (triggerMode === 'ready-or-needs-review') return status === 'ready' || status === 'needs-review';
    return status === 'ready';
  };
  const implementationActionStatus = actionStatus('implementation-workflow', implementationStatus);

  const visibleActionStatuses: CardStatus[] = actionProjection.visibleActions
    .map((action) => action.status)
    .filter((status) => status !== 'dev-only');
  const readinessCounts = visibleActionStatuses.reduce(
    (counts, status) => {
      if (status === 'ready') counts.ready += 1;
      if (status === 'needs-review') counts.needsReview += 1;
      if (status === 'blocked') counts.blocked += 1;
      return counts;
    },
    { ready: 0, needsReview: 0, blocked: 0 },
  );
  const readyCount = readinessCounts.ready;
  const needsReviewCount = readinessCounts.needsReview;
  const blockedCount = readinessCounts.blocked;

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
    <div
      className="vhd-root vhd-layout vhd-layout--workspace-default vhd-layout--mobile-fallback"
      data-testid="visit-home-layout-root"
    >
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
          <h1 className="vhd-header__title">Review this visit</h1>
          <p className="vhd-header__subtitle">{propertyTitle}</p>
          <p className="vhd-header__workflow">
            Atlas Mind is the review workspace for recommendation, customer portal, simulator, and handover.
          </p>
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

      {/* ── Workspace rails ────────────────────────────────────────────────── */}
      <div className="vhd-workspace vhd-workspace--three-rail" data-testid="visit-home-workspace-layout">
        <aside className="vhd-rail vhd-rail--left">
          {journeyInfo.archetype != null && isActionVisible('review-survey') && (
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
                <button
                  type="button"
                  className="vhd-inline-action"
                  onClick={canTriggerAction('review-survey', recommendationStatus) ? onOpenPresentation : undefined}
                  disabled={!canTriggerAction('review-survey', recommendationStatus)}
                  data-testid="visit-home-open-customer-journey"
                >
                  Open customer journey →
                </button>
              </div>
            </div>
          )}

          <div className="vhd-readiness-panel" data-testid="visit-home-readiness-panel">
            <h2 className="vhd-panel-title">Readiness status</h2>
            <ul className="vhd-readiness-list">
              <li><strong>{readyCount}</strong> ready</li>
              <li><strong>{needsReviewCount}</strong> needs review</li>
              <li><strong>{blockedCount}</strong> blocked</li>
            </ul>
          </div>

          {isActionVisible('review-survey') && (
            <DashboardCard
              data-testid="card-recommendation"
              icon="🎯"
              title="Recommendation summary"
              description="Review the recommendation with evidence and scenario context before customer handover."
              status={actionStatus('review-survey', recommendationStatus)}
              blockedReason={actionReason('review-survey')}
              audience={['customer', 'surveyor']}
              source="engine"
              ctaLabel="Review recommendation →"
              onCta={canTriggerAction('review-survey', recommendationStatus) ? onOpenPresentation : undefined}
            />
          )}
        </aside>

        <main className="vhd-main-area">
          <div className="vhd-main-grid">
            {isActionVisible('customer-portal') && (
              <DashboardCard
                data-testid="card-portal"
                icon="🔗"
                title="Customer portal / Insight"
                description="Customer portal and Atlas Insight Pack for review before sharing."
                status={actionStatus('customer-portal', portalStatus)}
                blockedReason={actionReason('customer-portal')}
                audience={['customer']}
                source="workflow"
                ctaLabel={onOpenInsightPack != null ? 'Open Insight Pack →' : 'Portal ready →'}
                onCta={canTriggerAction('customer-portal', portalStatus, 'not-blocked') ? (onOpenInsightPack ?? handleOpenPortal) : undefined}
              />
            )}

            {isActionVisible('supporting-pdf') && (
              <DashboardCard
                data-testid="card-pdf"
                icon="📄"
                title="Supporting PDF"
                description="Customer-facing print pack with recommendation, scenarios, and explainers."
                status={actionStatus('supporting-pdf', pdfStatus)}
                blockedReason={actionReason('supporting-pdf')}
                audience={['customer', 'office']}
                source="library"
                ctaLabel="Print summary →"
                onCta={canTriggerAction('supporting-pdf', pdfStatus) ? onPrintSummary : undefined}
              />
            )}

            {isActionVisible('run-simulator') && (
              <DashboardCard
                data-testid="card-simulator"
                icon="📊"
                title="Daily hot-water simulator"
                description="Run the 24-hour demand and system response simulator during review."
                status={actionStatus('run-simulator', simulatorStatus)}
                blockedReason={actionReason('run-simulator')}
                audience={['surveyor', 'engineer']}
                source="simulator"
                ctaLabel="Run daily-use simulator →"
                onCta={canTriggerAction('run-simulator', simulatorStatus, 'not-blocked') ? onOpenSimulator : undefined}
                variant="feature"
              />
            )}
          </div>
        </main>

        <aside className="vhd-rail vhd-rail--right">
          {isActionVisible('implementation-workflow') && (
            <DashboardCard
              data-testid="card-implementation"
              icon="🔧"
              title="Implementation workflow"
              description={
                installationSpecOptionCount > 0
                  ? `Installation specification — ${installationSpecOptionCount} option${installationSpecOptionCount === 1 ? '' : 's'} saved.`
                  : 'Prepare scope, materials, and commissioning checklist for delivery.'
              }
              status={implementationActionStatus}
              blockedReason={actionReason('implementation-workflow')}
              audience={['engineer']}
              source="workflow"
              ctaLabel="Prepare implementation pack →"
              onCta={canTriggerAction('implementation-workflow', implementationStatus, 'ready-or-needs-review')
                ? onOpenInstallationSpecification
                : undefined}
            />
          )}

          {isActionVisible('resolve-follow-ups') && (
            <DashboardCard
              data-testid="card-handoff"
              icon="📱"
              title="Follow-up and handoff"
              description="Review post-visit handoff details and linked captured evidence."
              status={actionStatus('resolve-follow-ups', handoffStatus)}
              blockedReason={actionReason('resolve-follow-ups')}
              audience={['engineer', 'office']}
              source="workflow"
              ctaLabel="Review handoff →"
              onCta={canTriggerAction('resolve-follow-ups', handoffStatus, 'not-blocked') ? onOpenHandoffReview : undefined}
            />
          )}

          {isActionVisible('export-handover-package') && (
            <DashboardCard
              data-testid="card-export"
              icon="📦"
              title="Export package"
              description="Export recommendation, portal context, and implementation pack for office handover."
              status={actionStatus('export-handover-package', exportStatus)}
              blockedReason={actionReason('export-handover-package')}
              audience={['office']}
              source="workflow"
              ctaLabel="Export handover package →"
              onCta={canTriggerAction('export-handover-package', exportStatus, 'not-blocked') ? onExportPackage : undefined}
            />
          )}

          <div className="vhd-readiness-panel" data-testid="visit-home-scan-entry-note">
            <h2 className="vhd-panel-title">Capture and import split</h2>
            <p className="vhd-panel-copy">
              Atlas Scan remains the capture/import entry point for survey evidence, photos, pins, and notes.
            </p>
            <p className="vhd-panel-copy">
              Atlas Mind is the review workspace for recommendation, customer portal, simulator, and handover.
            </p>
          </div>

          {isActionVisible('workspace-controls') && (
            <div className="vhd-admin-actions" data-testid="visit-home-admin-actions">
              <h2 className="vhd-panel-title">Admin actions</h2>
              <button
                type="button"
                className="vhd-inline-action"
                onClick={onOpenEngineerRoute}
                disabled={onOpenEngineerRoute == null}
              >
                Open engineer route →
              </button>
            </div>
          )}
        </aside>
      </div>
      <p className="vhd-mobile-fallback-note" data-testid="visit-home-mobile-fallback-note">
        Phone fallback is single-column only and supports quick review when away from desk or tablet.
      </p>
    </div>
  );
}

export default VisitHomeDashboard;
