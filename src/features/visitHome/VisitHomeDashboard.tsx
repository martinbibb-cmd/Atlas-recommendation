/**
 * VisitHomeDashboard.tsx
 *
 * Visit Home Dashboard Shell — workspace-first post-survey review surface.
 *
 * Shows all outputs from an Atlas visit as status-aware cards:
 *   1. Recommendation summary     (customer · engine · ready/needs-review/blocked)
 *   2. Customer portal            (customer · workflow · ready/blocked)
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
import { useRef } from 'react';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { WorkspaceMemberPermission } from '../../auth/profile';
import {
  createEmptyGeneratedOutputs,
  isLegacyVisitReadinessMode,
  normaliseGeneratedOutputs,
  projectVisitReadiness,
  type GeneratedOutputsV1,
  type VisitEnvelopeReadinessProjectionV1,
  type VisitReviewLifecycleState,
} from '../../lib/storage/visitReviewLifecycle';
import {
  buildVisitHomeActionProjection,
  type VisitHomeActionId,
  type VisitHomeActionRole,
} from './buildVisitHomeActionProjection';
import { buildVisitHomeViewModel } from './buildVisitHomeViewModel';
import {
  computeVisitHydrationState,
  HYDRATION_STATE_DISPLAY,
} from './computeVisitHydrationState';
import './VisitHomeDashboard.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CardStatus = 'ready' | 'needs-review' | 'blocked' | 'dev-only';
export type CardAudience = 'customer' | 'surveyor' | 'office' | 'engineer';
export type CardSource = 'engine' | 'library' | 'workflow' | 'simulator';
export type VisitSelectorSource = 'local' | 'workflow' | 'demo';
export type VisitPackageIntegrityStatus = 'verified' | 'modified' | 'unverified';
type ActionableState = {
  why: string;
  actionDescription: string;
  nextStep: string;
};

export interface VisitHomeImportResultSummary {
  readonly integrityStatus: VisitPackageIntegrityStatus;
  readonly warnings?: readonly string[];
}

export interface VisitHomeExportResultSummary {
  readonly includedItems: readonly string[];
}

export interface VisitHomeSessionStatus {
  readonly tone: 'success' | 'warning' | 'error';
  readonly message: string;
  readonly type?: 'import' | 'export' | 'session';
  readonly importSummary?: VisitHomeImportResultSummary;
  readonly exportSummary?: VisitHomeExportResultSummary;
}

export interface VisitSelectorEntry {
  readonly visitId: string;
  readonly label: string;
  readonly source: VisitSelectorSource;
}

export interface VisitHomeDashboardProps {
  /** Active visit ID — used to derive availability of outputs. */
  visitId?: string;
  /** Completed engine input for this visit. */
  engineInput?: EngineInputV2_3;
  /** Engine output derived from the latest survey. */
  engineOutput?: EngineOutputV1;
  /** Evaluated scenario results for this visit. */
  scenarios?: ScenarioResult[];
  /** Canonical accepted scenario for this visit recommendation state boundary. */
  acceptedScenario?: ScenarioResult;
  /** Canonical recommendation summary used across review surfaces. */
  recommendationSummary?: CustomerSummaryV1;
  /** Full survey model from the most recent draft. */
  surveyModel?: FullSurveyModelV1;
  /**
   * Signed portal URL, if one has been generated for the active visit.
   * When absent the Customer Portal card shows 'needs-review'.
   */
  portalUrl?: string;
  /** Canonical lifecycle state restored from persisted visit snapshot. */
  lifecycleState?: VisitReviewLifecycleState;
  /** Optional canonical VisitEnvelope proposal boundary projection. */
  visitEnvelope?: VisitEnvelopeReadinessProjectionV1;
  /** Canonical generated output registry restored from persisted visit snapshot. */
  generatedOutputs?: Partial<GeneratedOutputsV1>;
  /** Canonical generated output flags restored from persisted visit snapshot. */
  hasPortalOutput?: boolean;
  hasSupportingPdfOutput?: boolean;
  hasHandoffOutput?: boolean;
  hasReachedExportedState?: boolean;
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
   * Forces the Supporting PDF and Customer Portal cards to 'blocked'
   * so the surveyor cannot accidentally share unsafe educational content.
   */
  libraryUnsafe?: boolean;
  /**
   * Human-readable reasons why the library is blocked.
   * Shown as supplementary text on blocked PDF / portal cards.
   */
  libraryBlockReasons?: readonly string[];
  /**
   * When true the supporting PDF customer-readiness gate is blocked by PDF QA.
   */
  supportingPdfUnsafe?: boolean;
  /**
   * Exact PDF QA blocking reasons for the supporting PDF card.
   */
  supportingPdfBlockReasons?: readonly string[];

  // ── Continue-where-you-left-off ────────────────────────────────────────────

  /**
   * Label for the last surface opened from this dashboard (e.g. 'Simulator').
   * When provided, a "Continue" banner is shown at the top of the dashboard.
   */
  lastSurface?: string;
  /** Opens the last surface the user was on. Only called when lastSurface is set. */
  onContinueLastSurface?: () => void;

  // ── Visit lifecycle controls ───────────────────────────────────────────────

  /**
   * Whether a local save exists for the current visitId that can be resumed.
   * When true the "Resume saved visit" control is shown.
   */
  hasSavedLocalVisit?: boolean;
  /** Trigger Atlas Scan package import (routes to receive-scan). */
  onImportScanPackage?: () => void;
  /**
   * Import a canonical Atlas visit package from a file.
   * Called with the File chosen by the user from the hidden file input.
   */
  onImportWorkflowPackage?: (file: File) => void;
  /** Explicitly save the current visit state to local storage. */
  onSaveLocally?: () => void;
  /** Resume the locally saved visit state. Only shown when hasSavedLocalVisit is true. */
  onResumeLocalVisit?: () => void;
  /** Clear the current review session and return to workspace. */
  onClearSession?: () => void;
  /** Open the existing visit search (workspace visit list). */
  onOpenExistingVisit?: () => void;
  /** Start with a hydrated demo review fixture. */
  onStartDemoReview?: () => void;
  /** Open demo fixtures browser. */
  onOpenDemoFixtures?: () => void;
  /** Continue survey capture for the current visit. */
  onContinueSurvey?: () => void;
  /** Trigger recommendation generation from current survey data. */
  onRunRecommendation?: () => void;
  /** Generate and persist customer portal output artifact for this visit. */
  onGenerateCustomerPortal?: () => void;
  /** Generate and persist supporting PDF output artifact for this visit. */
  onGenerateSupportingPdf?: () => void;
  /** Optional visit selector entries shown in lifecycle entry states. */
  visitSelectorEntries?: readonly VisitSelectorEntry[];
  /** Open a selected visit from the lightweight browser. */
  onSelectVisit?: (visitId: string) => void;
  /** Optional session save/resume status surface shown in the session controls panel. */
  localSessionStatus?: VisitHomeSessionStatus | null;
  /** Dev-only build marker shown in the header when provided. */
  devBuildMarker?: string;

  // ── CTA handlers (all delegate to existing App.tsx journeys) ─────────────

  /** Open the Simulator Dashboard (journey = 'simulator'). */
  onOpenSimulator: () => void;
  /** Open the in-room Presentation (journey = 'presentation'). */
  onOpenPresentation: () => void;
  /** Print the supporting PDF (journey = 'library-pdf'). */
  onPrintSummary?: () => void;
  /** Open the Installation Specification stepper (journey = 'installation-specification'). */
  onOpenInstallationSpecification: () => void;
  /** Open the completed-visit handoff review (journey = 'visit-handoff'). */
  onOpenHandoffReview?: () => void;
  /** Open the pre-install engineer route (journey = 'engineer'). */
  onOpenEngineerRoute?: () => void;
  /**
   * Trigger a local export-package download for the active visit.
   * When absent the Export package card is still shown but its CTA is disabled.
   */
  onExportPackage?: () => void;
  /**
   * Open the customer portal using the packaged CustomerJourneyPackV1.
   * When provided and the packaged journey content is available (customerJourneyPack.generated),
   * the portal card shows "Open customer portal →" and calls this handler instead of
   * opening a portal URL or generating a new portal artifact.
   */
  onOpenPortalFromPackage?: () => void;
  /** Open Atlas Scan using packaged canonical visit launch payload. */
  onOpenScanFromPackage?: () => void;
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
const REASON_VISIT_DATA_MISSING = 'Visit data missing';
const REASON_PERMISSION_NOT_GRANTED = 'Permission not granted for this workspace role.';
const REASON_LIBRARY_SAFETY_REVIEW = 'Library safety needs review';
const PDF_QA_BLOCKED_PREFIX = 'PDF QA blocked:';
function isPDFQABlocked(reason: string | undefined): boolean {
  if (reason == null || reason.length === 0) return false;
  return reason
    .split(' • ')
    .some((entry) => entry.trim().startsWith(PDF_QA_BLOCKED_PREFIX));
}

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

const IMPORT_RESULT_BADGE_STYLES: Record<
VisitPackageIntegrityStatus,
{ readonly label: string; readonly background: string; readonly borderColor: string; readonly color: string }
> = {
  verified: {
    label: 'Verified',
    background: '#f0fdf4',
    borderColor: '#86efac',
    color: '#166534',
  },
  modified: {
    label: 'Modified',
    background: '#fff7ed',
    borderColor: '#fdba74',
    color: '#9a3412',
  },
  unverified: {
    label: 'Unverified',
    background: '#fffbeb',
    borderColor: '#fcd34d',
    color: '#92400e',
  },
};

function ImportResultBadge({ integrityStatus }: { integrityStatus: VisitPackageIntegrityStatus }) {
  const style = IMPORT_RESULT_BADGE_STYLES[integrityStatus];
  return (
    <span
      className="vhd-import-result-badge"
      style={{
        background: style.background,
        borderColor: style.borderColor,
        color: style.color,
      }}
      data-testid="visit-home-import-result-badge"
    >
      {style.label}
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
  highlights?: readonly string[];
  actionableState?: ActionableState;
}

/**
 * Builds simulator card highlights from existing recommendation hydration data.
 */
function buildSimulatorHighlights(
  keyExpectationDelta: string,
  firstConstraint?: string,
): readonly string[] {
  return [
    `Expectation summary: ${keyExpectationDelta}`,
    firstConstraint != null
      ? `Hot-water and recovery highlight: ${firstConstraint}`
      : 'Hot-water and recovery highlight: Review hot-water demand and recovery behaviour in the simulator timeline.',
  ];
}

function normaliseGeneratedOutputsWithLegacyFlags(input: {
  generatedOutputs?: Partial<GeneratedOutputsV1>;
  hasPortalOutput?: boolean;
  hasSupportingPdfOutput?: boolean;
  hasHandoffOutput?: boolean;
  portalUrl?: string;
  hasPrintSummary: boolean;
  hasHandoffHandler: boolean;
}): GeneratedOutputsV1 {
  const fallbackOutputs = createEmptyGeneratedOutputs();
  return normaliseGeneratedOutputs({
    ...(input.generatedOutputs ?? fallbackOutputs),
    portal: input.generatedOutputs?.portal ?? { generated: input.hasPortalOutput ?? (input.portalUrl != null) },
    pdf: input.generatedOutputs?.pdf ?? { generated: input.hasSupportingPdfOutput ?? input.hasPrintSummary },
    handoff: input.generatedOutputs?.handoff ?? { generated: input.hasHandoffOutput ?? input.hasHandoffHandler },
  });
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
  highlights,
  actionableState,
}: DashboardCardProps) {
  const isBlocked = status === 'blocked';
  const audienceLabel = audience
    .map((entry) => entry.replace('-', ' '))
    .join(' / ');
  const cardClassName = [
    'vhd-card',
    isBlocked ? 'vhd-card--blocked' : '',
    variant === 'feature' ? 'vhd-card--feature' : '',
    `vhd-card--status-${status}`,
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
      {actionableState != null && (
        <div className="vhd-card__actionable" data-testid={testId ? `${testId}-actionable` : undefined}>
          <p className="vhd-card__actionable-row">
            <strong>Why:</strong> {actionableState.why}
          </p>
          <p className="vhd-card__actionable-row">
            <strong>Action:</strong> {actionableState.actionDescription}
          </p>
          <p className="vhd-card__actionable-row">
            <strong>Next step:</strong> {actionableState.nextStep}
          </p>
        </div>
      )}
      {highlights != null && highlights.length > 0 && (
        <ul className="vhd-card__highlights">
          {highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      )}
      <p className="vhd-card__context">
        For <strong>{audienceLabel}</strong> · Source: <strong>{source}</strong>
      </p>
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
  acceptedScenario,
  recommendationSummary,
  surveyModel,
  portalUrl,
  lifecycleState,
  visitEnvelope,
  generatedOutputs,
  hasPortalOutput,
  hasSupportingPdfOutput,
  hasHandoffOutput,
  hasReachedExportedState,
  installationSpecOptionCount = 0,
  workspaceRole,
  workspacePermissions,
  libraryUnsafe = false,
  libraryBlockReasons,
  supportingPdfUnsafe = false,
  supportingPdfBlockReasons,
  lastSurface,
  onContinueLastSurface,
  hasSavedLocalVisit = false,
  onImportScanPackage,
  onImportWorkflowPackage,
  onSaveLocally,
  onResumeLocalVisit,
  onClearSession,
  onOpenExistingVisit,
  onStartDemoReview,
  onOpenDemoFixtures,
  onContinueSurvey,
  onRunRecommendation,
  onGenerateCustomerPortal,
  onGenerateSupportingPdf,
  visitSelectorEntries = [],
  onSelectVisit,
  localSessionStatus = null,
  devBuildMarker,
  onOpenSimulator,
  onOpenPresentation,
  onPrintSummary,
  onOpenInstallationSpecification,
  onOpenHandoffReview,
  onOpenEngineerRoute,
  onExportPackage,
  onOpenPortalFromPackage,
  onOpenScanFromPackage,
  onBack,
}: VisitHomeDashboardProps) {
  // ── Hidden file input ref for visit package import ────────────────────────
  const workflowFileInputRef = useRef<HTMLInputElement>(null);

  // ── Derive card statuses from available data ───────────────────────────────

  const hasVisit = visitId != null;
  const mergedOutputs = normaliseGeneratedOutputsWithLegacyFlags({
    generatedOutputs,
    hasPortalOutput,
    hasSupportingPdfOutput,
    hasHandoffOutput,
    portalUrl,
    hasPrintSummary: onPrintSummary != null,
    hasHandoffHandler: onOpenHandoffReview != null,
  });
  const projectedReadiness = projectVisitReadiness(
    visitEnvelope,
    mergedOutputs,
    lifecycleState,
  );
  const legacyReadinessMode = isLegacyVisitReadinessMode(visitEnvelope, lifecycleState);
  const portalOutputAvailable = projectedReadiness.portalOutputAvailable;
  const supportingPdfOutputAvailable = projectedReadiness.supportingPdfOutputAvailable;
  const handoffOutputAvailable = projectedReadiness.handoffOutputAvailable
    || (legacyReadinessMode && mergedOutputs.handoff.generated);
  const exportOutputAvailable = projectedReadiness.exportOutputAvailable || hasReachedExportedState === true;
  const viewModel = buildVisitHomeViewModel({
    engineResult: engineOutput,
    acceptedScenario,
    scenarios,
    surveyModel,
    recommendationSummary,
    lifecycleState,
    visitEnvelope,
    generatedOutputs: mergedOutputs,
    workflowReadiness: {
      hasVisit,
      libraryUnsafe,
      supportingPdfUnsafe,
      installationSpecOptionCount,
    },
    outputAvailability: {
      hasPortalOutput: projectedReadiness.portalOutputAvailable,
      hasSupportingPdfOutput: projectedReadiness.supportingPdfOutputAvailable,
      hasHandoffReview: handoffOutputAvailable,
      hasExportPackage: exportOutputAvailable,
    },
    simulatorAvailability: {
      hasSimulatorSurface: onOpenSimulator != null,
    },
  });

  const recommendationStatus: CardStatus = viewModel.recommendationStatus;
  const portalStatus: CardStatus = viewModel.portalStatus;
  const simulatorStatus: CardStatus = viewModel.simulatorStatus;
  const pdfStatus: CardStatus = viewModel.supportingPdfStatus;
  const implementationStatus: CardStatus = viewModel.implementationStatus;
  const handoffStatus: CardStatus = viewModel.handoffStatus;
  const exportStatus: CardStatus = viewModel.exportStatus;
  const deliverySurfacesUnlocked = projectedReadiness.deliverySurfacesUnlocked
    || (legacyReadinessMode && viewModel.hasRecommendation);

  const portalDescription = viewModel.portalMissingMessage
    ?? 'Customer-safe portal for review before sharing.';
  const supportingPdfDescription = viewModel.supportingPdfMissingMessage
    ?? 'Customer-facing print pack with recommendation, scenarios, and explainers.';
  const actionProjection = buildVisitHomeActionProjection({
    workspaceRole,
    workspacePermissions,
    visitReadiness: {
      hasVisit,
      hasRecommendation: viewModel.hasRecommendation,
      hasAcceptedScenario: viewModel.hasAcceptedScenario,
      hasSurveyModel: viewModel.hasSurveyModel,
      deliverySurfacesUnlocked,
    },
    libraryProjectionSafety: {
      unsafe: libraryUnsafe,
      reasons: libraryBlockReasons,
    },
    implementationReadiness: {
      installationSpecOptionCount,
    },
    supportingPdfReadiness: {
      unsafe: supportingPdfUnsafe,
      reasons: supportingPdfBlockReasons,
    },
    availableOutputs: {
      hasPortalUrl: projectedReadiness.portalOutputAvailable,
      hasSupportingPdf: projectedReadiness.supportingPdfOutputAvailable,
      hasHandoffReview: handoffOutputAvailable,
      hasExportPackage: exportOutputAvailable,
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
  const buildActionableState = (
    actionId: VisitHomeActionId,
    status: CardStatus,
    reason: string | undefined,
  ): ActionableState | undefined => {
    if (status !== 'blocked' && status !== 'needs-review') return undefined;
      if (reason === REASON_VISIT_DATA_MISSING) {
        return {
          why: 'This step is blocked because no active visit data is loaded for review.',
          actionDescription: 'Open visit',
          nextStep: 'Open visit',
        };
      }
      if (reason === REASON_PERMISSION_NOT_GRANTED) {
        return {
          why: 'Your current workspace role does not allow this action.',
          actionDescription: 'Switch workspace role or request access',
          nextStep: 'Switch workspace role or request access',
        };
      }
    switch (actionId) {
      case 'review-survey':
        return {
          why: status === 'needs-review'
            ? 'A visit exists, but recommendation evidence has not been generated yet.'
            : 'Recommendation evidence is not available for this visit.',
          actionDescription: 'Generate recommendation',
          nextStep: 'Generate recommendation',
        };
      case 'customer-portal':
        if (reason === REASON_LIBRARY_SAFETY_REVIEW) {
          return {
            why: 'Customer portal content is blocked by library safety checks.',
            actionDescription: 'Review library safety blockers',
            nextStep: 'Review library safety blockers',
          };
        }
        return {
          why: status === 'needs-review'
            ? 'A recommendation exists, but the customer portal has not been generated yet.'
            : 'Recommendation output is not accepted or available for portal generation.',
          actionDescription: 'Generate customer portal',
          nextStep: 'Generate customer portal',
        };
      case 'supporting-pdf':
        if (reason === REASON_LIBRARY_SAFETY_REVIEW || isPDFQABlocked(reason)) {
          return {
            why: 'The supporting PDF is blocked by customer-readiness or library safety checks.',
            actionDescription: 'Fix PDF readiness blockers',
            nextStep: 'Fix PDF readiness blockers',
          };
        }
        return {
          why: status === 'needs-review'
            ? 'A recommendation exists, but the supporting PDF has not been generated yet.'
            : 'Recommendation output is not accepted or available for PDF generation.',
          actionDescription: 'Generate supporting PDF',
          nextStep: 'Generate supporting PDF',
        };
      case 'run-simulator':
        return {
          why: status === 'needs-review'
            ? 'Simulator playback is available, but recommendation inputs still need review.'
            : 'The simulator needs recommendation-ready visit data first.',
          actionDescription: 'Generate recommendation',
          nextStep: 'Generate recommendation',
        };
      case 'implementation-workflow':
        return {
          why: status === 'needs-review'
            ? 'Recommendation is ready, but no installation specification options are saved yet.'
            : 'Implementation workflow requires recommendation-ready visit data.',
          actionDescription: 'Prepare implementation pack',
          nextStep: 'Prepare implementation pack',
        };
      case 'resolve-follow-ups':
        return {
          why: status === 'needs-review'
            ? 'Handoff follow-up output has not been generated for this visit yet.'
            : 'Follow-up review requires recommendation-ready visit data.',
          actionDescription: 'Review handoff',
          nextStep: 'Review handoff',
        };
      case 'export-handover-package':
        return {
          why: status === 'needs-review'
            ? 'A handover package export has not been generated for this visit yet.'
            : 'Export requires recommendation-ready visit data.',
          actionDescription: 'Export handover package',
          nextStep: 'Export handover package',
        };
      case 'workspace-controls':
        return {
          why: 'Workspace controls are currently unavailable for this role.',
          actionDescription: 'Switch workspace role or request access',
          nextStep: 'Switch workspace role or request access',
        };
      default:
        return undefined;
    }
  };
  const actionableStateFor = (actionId: VisitHomeActionId, fallbackStatus: CardStatus) =>
    buildActionableState(actionId, actionStatus(actionId, fallbackStatus), actionReason(actionId));
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
  const customerJourneyPackStatus: CardStatus = mergedOutputs.customerJourneyPack?.generated
    ? 'ready'
    : viewModel.hasRecommendation
    ? 'needs-review'
    : 'blocked';
  const journeyInfo = viewModel.journeyInfo;
  const keyExpectationDelta = viewModel.hero.keyExpectationDelta;
  const recommendationHeroVisible = viewModel.hasRecommendation || viewModel.hasAcceptedScenario;

  // ── Hydration state ────────────────────────────────────────────────────────

  const hydrationState = computeVisitHydrationState({
    hasVisit,
    lifecycleState,
    hasRecommendation: viewModel.hasRecommendation,
    hasAcceptedScenario: viewModel.hasAcceptedScenario,
    hasSurveyModel: viewModel.hasSurveyModel,
    hasHandoffReview: onOpenHandoffReview != null,
    hasExportPackage: onExportPackage != null,
  });
  const hydrationDisplay = HYDRATION_STATE_DISPLAY[hydrationState];
  const showLifecycleEntryPanel = hydrationState === 'no-visit' || hydrationState === 'survey-in-progress';
  const deliveryActionIds: VisitHomeActionId[] = [
    'implementation-workflow',
    'resolve-follow-ups',
    'export-handover-package',
  ];
  const hasVisibleDeliveryActions = deliveryActionIds.some((actionId) => isActionVisible(actionId));

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

  // ── Packaged portal availability ──────────────────────────────────────────
  // When the customerJourneyPack artifact is generated we can open the portal
  // directly from the packaged content rather than requiring a fresh portal URL.

  const packagedPortalAvailable = mergedOutputs.customerJourneyPack?.generated === true;
  const effectivePortalCtaLabel = portalOutputAvailable || packagedPortalAvailable
    ? 'Open customer portal →'
    : 'Generate customer portal →';
  const effectivePortalCta = (() => {
    if (!canTriggerAction('customer-portal', portalStatus, 'not-blocked')) return undefined;
    if (portalOutputAvailable) return handleOpenPortal;
    if (packagedPortalAvailable && onOpenPortalFromPackage != null) return onOpenPortalFromPackage;
    return onGenerateCustomerPortal;
  })();

  // ── Visit package file input handler ──────────────────────────────────────

  function handleWorkflowFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file != null && onImportWorkflowPackage != null) {
      onImportWorkflowPackage(file);
    }
    // Reset so the same file can be re-selected after a rejection
    e.target.value = '';
  }

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
          {devBuildMarker ? (
            <p
              className="vhd-header__workflow"
              style={{ color: '#7c2d12', fontWeight: 600 }}
              data-testid="visit-home-dev-build-marker"
            >
              {devBuildMarker}
            </p>
          ) : null}
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

      {/* ── Visit hydration status banner ──────────────────────────────────── */}
      <div
        className={`vhd-hydration-banner vhd-hydration-banner--${hydrationDisplay.tone}`}
        data-testid="visit-home-hydration-banner"
        data-hydration-state={hydrationState}
      >
        <span className="vhd-hydration-banner__label">{hydrationDisplay.label}</span>
        <span className="vhd-hydration-banner__description">{hydrationDisplay.description}</span>
      </div>

      {/* ── Lifecycle entry panel (no-visit / survey-in-progress) ─────────── */}
      {showLifecycleEntryPanel && (
        <div className="vhd-empty-state" data-testid="visit-home-empty-state">
          <p className="vhd-empty-state__heading">
            {hydrationState === 'no-visit' ? 'Start a review session' : 'Continue this visit'}
          </p>
          <p className="vhd-empty-state__copy">
            {hydrationState === 'no-visit'
              ? 'Import an Atlas Scan package or Atlas visit package, open an existing visit, or start with a demo to load review data.'
              : 'Continue survey capture, resume Atlas Scan import, or generate recommendation to hydrate this review workspace.'}
          </p>
          <div className="vhd-empty-state__actions">
            {hydrationState === 'survey-in-progress' && onContinueSurvey != null && (
              <button
                type="button"
                className="vhd-empty-state__cta vhd-empty-state__cta--primary"
                onClick={onContinueSurvey}
                data-testid="visit-home-continue-survey-cta"
              >
                📝 Continue survey
              </button>
            )}
            {onImportScanPackage != null && (
              <button
                type="button"
                className={`vhd-empty-state__cta${hydrationState === 'survey-in-progress' ? ' vhd-empty-state__cta--secondary' : ''}`}
                onClick={onImportScanPackage}
                data-testid="visit-home-import-scan-cta"
              >
                📥 Resume Atlas Scan import
              </button>
            )}
            {hydrationState === 'survey-in-progress' && onRunRecommendation != null && (
              <button
                type="button"
                className="vhd-empty-state__cta vhd-empty-state__cta--primary"
                onClick={onRunRecommendation}
                data-testid="visit-home-run-recommendation-cta"
              >
                ⭐ Generate recommendation
              </button>
            )}
            {onImportWorkflowPackage != null && (
              <>
                <button
                  type="button"
                  className="vhd-empty-state__cta"
                  onClick={() => workflowFileInputRef.current?.click()}
                  data-testid="visit-home-import-workflow-cta"
                >
                  📂 Import visit package
                </button>
                  <input
                  ref={workflowFileInputRef}
                  type="file"
                  accept=".atlasvisit.json,.atlasvisit.pdf,application/pdf"
                  style={{ display: 'none' }}
                  aria-hidden="true"
                  data-testid="visit-home-workflow-file-input"
                  onChange={handleWorkflowFileChange}
                />
              </>
            )}
            {onOpenExistingVisit != null && (
              <button
                type="button"
                className="vhd-empty-state__cta"
                onClick={onOpenExistingVisit}
                data-testid="visit-home-open-existing-cta"
              >
                🔍 Open existing visit
              </button>
            )}
            {onStartDemoReview != null && (
              <button
                type="button"
                className="vhd-empty-state__cta vhd-empty-state__cta--secondary"
                onClick={onStartDemoReview}
                data-testid="visit-home-start-demo-cta"
              >
                🎬 Start demo review
              </button>
            )}
            {onOpenDemoFixtures != null && (
              <button
                type="button"
                className="vhd-empty-state__cta"
                onClick={onOpenDemoFixtures}
                data-testid="visit-home-open-demo-fixtures-cta"
              >
                🧪 Open demo fixtures
              </button>
            )}
          </div>
          {visitSelectorEntries.length > 0 && onSelectVisit != null && (
            <div className="vhd-readiness-panel" data-testid="visit-home-selector-panel">
              <h2 className="vhd-panel-title">Open existing visit</h2>
              <div className="vhd-local-controls__actions">
                {visitSelectorEntries.map((entry) => (
                  <button
                    key={`${entry.source}:${entry.visitId}`}
                    type="button"
                    className="vhd-inline-action"
                    onClick={() => onSelectVisit(entry.visitId)}
                    data-testid={`visit-home-selector-${entry.source}-${entry.visitId}`}
                  >
                    {entry.label} ({entry.source})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Workspace rails ────────────────────────────────────────────────── */}
      <div className="vhd-workspace vhd-workspace--three-rail" data-testid="visit-home-workspace-layout">
        <aside className="vhd-rail vhd-rail--left">
          <section className="vhd-recommendation-hero" data-testid="visit-home-recommendation-hero">
            <div className="vhd-recommendation-hero__header">
              <h2 className="vhd-panel-title">Recommended system</h2>
              <StatusBadge status={viewModel.hero.confidenceReadiness} />
            </div>
            {recommendationHeroVisible ? (
              <>
                <p className="vhd-recommendation-hero__system">{viewModel.hero.selectedSystem}</p>
                <div className="vhd-recommendation-hero__meta">
                  <span><strong>Journey:</strong> {viewModel.hero.journeyArchetype}</span>
                  <span>
                    <strong>Confidence / readiness:</strong> {STATUS_STYLES[viewModel.hero.confidenceReadiness].label}
                  </span>
                </div>
                <p className="vhd-recommendation-hero__delta">
                  <strong>Key expectation delta:</strong> {keyExpectationDelta}
                </p>
              </>
            ) : (
              <>
                <p className="vhd-recommendation-hero__system">Recommendation pending</p>
                <p className="vhd-recommendation-hero__delta">
                  <strong>Key expectation delta:</strong> Capture complete recommendation inputs to hydrate this summary.
                </p>
              </>
            )}
          </section>

          <div className="vhd-readiness-panel" data-testid="visit-home-readiness-panel">
            <h2 className="vhd-panel-title">Readiness summary</h2>
            <ul className="vhd-readiness-list">
              <li><strong>{readyCount}</strong> ready</li>
              <li><strong>{needsReviewCount}</strong> needs review</li>
              <li><strong>{blockedCount}</strong> blocked</li>
              <li data-testid="visit-home-customer-journey-pack-status">
                <strong>Customer journey pack:</strong> {STATUS_STYLES[customerJourneyPackStatus].label}
              </li>
            </ul>
          </div>

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

          <div className="vhd-readiness-panel" data-testid="visit-home-expectation-highlights">
            <h2 className="vhd-panel-title">Expectation highlights</h2>
            <p className="vhd-panel-copy">
              {keyExpectationDelta}
            </p>
            {viewModel.hero.keyConstraints.length > 0 && (
              <ul className="vhd-readiness-list">
                {viewModel.hero.keyConstraints.map((constraint) => (
                  <li key={constraint}>{constraint}</li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <main className="vhd-main-area">
          <section className="vhd-section" data-testid="visit-home-section-customer-review">
            <h2 className="vhd-section__title">Customer review</h2>
            <div className="vhd-main-grid">
              {isActionVisible('review-survey') && (
                <DashboardCard
                  data-testid="card-recommendation"
                  icon="🎯"
                  title="Lived experience explanations"
                  description="Review recommendation evidence and lived experience explanations before customer handover."
                  status={actionStatus('review-survey', recommendationStatus)}
                  blockedReason={actionReason('review-survey')}
                  actionableState={actionableStateFor('review-survey', recommendationStatus)}
                  audience={['customer', 'surveyor']}
                  source="engine"
                  ctaLabel="Review recommendation →"
                  onCta={canTriggerAction('review-survey', recommendationStatus) ? onOpenPresentation : undefined}
                />
              )}

              {isActionVisible('customer-portal') && (
                <DashboardCard
                  data-testid="card-portal"
                  icon="🔗"
                  title="Customer portal"
                  description={portalDescription}
                  status={actionStatus('customer-portal', portalStatus)}
                  blockedReason={actionReason('customer-portal')}
                  actionableState={actionableStateFor('customer-portal', portalStatus)}
                  audience={['customer']}
                  source="workflow"
                  ctaLabel={effectivePortalCtaLabel}
                  onCta={effectivePortalCta}
                />
              )}

              {isActionVisible('supporting-pdf') && (
                <DashboardCard
                  data-testid="card-pdf"
                  icon="📄"
                  title="Library supporting PDF"
                  description={supportingPdfDescription}
                  status={actionStatus('supporting-pdf', pdfStatus)}
                  blockedReason={actionReason('supporting-pdf')}
                  actionableState={actionableStateFor('supporting-pdf', pdfStatus)}
                  audience={['customer', 'office']}
                  source="library"
                  ctaLabel={supportingPdfOutputAvailable ? 'Print summary →' : 'Generate supporting PDF →'}
                  onCta={canTriggerAction('supporting-pdf', pdfStatus, 'not-blocked')
                    ? (supportingPdfOutputAvailable ? onPrintSummary : onGenerateSupportingPdf)
                    : undefined}
                />
              )}
            </div>
          </section>

          <section className="vhd-section" data-testid="visit-home-section-technical-review">
            <h2 className="vhd-section__title">Technical review</h2>
            <div className="vhd-main-grid">
              {isActionVisible('run-simulator') && (
                <DashboardCard
                  data-testid="card-simulator"
                  icon="📊"
                  title="Open house simulator"
                  description="Interactive daily-use simulator. Uses the current house-simulator surface."
                  status={actionStatus('run-simulator', simulatorStatus)}
                  blockedReason={actionReason('run-simulator')}
                  actionableState={actionableStateFor('run-simulator', simulatorStatus)}
                  audience={['surveyor', 'engineer']}
                  source="simulator"
                  ctaLabel="Open house simulator →"
                  onCta={canTriggerAction('run-simulator', simulatorStatus, 'not-blocked') ? onOpenSimulator : undefined}
                  variant="feature"
                  highlights={buildSimulatorHighlights(
                    viewModel.hero.keyExpectationDelta,
                    viewModel.hero.keyConstraints[0],
                  )}
                />
              )}
            </div>
          </section>
        </main>

        <aside className="vhd-rail vhd-rail--right">
          {hasVisibleDeliveryActions && (
            <section className="vhd-section" data-testid="visit-home-section-delivery-handover">
              <h2 className="vhd-section__title">Delivery / handover</h2>
              <div className="vhd-rail vhd-rail--nested">
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
                    actionableState={actionableStateFor('implementation-workflow', implementationStatus)}
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
                    actionableState={actionableStateFor('resolve-follow-ups', handoffStatus)}
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
                    actionableState={actionableStateFor('export-handover-package', exportStatus)}
                    audience={['office']}
                    source="workflow"
                    ctaLabel="Export handover package →"
                    onCta={canTriggerAction('export-handover-package', exportStatus, 'not-blocked') ? onExportPackage : undefined}
                  />
                )}
              </div>
            </section>
          )}

          <div className="vhd-readiness-panel" data-testid="visit-home-scan-entry-note">
            <h2 className="vhd-panel-title">Capture and import split</h2>
            <p className="vhd-panel-copy">
              Atlas Scan remains the capture/import entry point for survey evidence, photos, pins, and notes.
            </p>
            <p className="vhd-panel-copy">
              Atlas Mind is the review workspace for recommendation, customer portal, simulator, and handover.
            </p>
            {onImportScanPackage != null && (
              <button
                type="button"
                className="vhd-inline-action"
                style={{ marginTop: '0.5rem' }}
                onClick={onImportScanPackage}
                data-testid="visit-home-scan-import-cta"
              >
                Import Atlas Scan package →
              </button>
            )}
            {onOpenScanFromPackage != null && (
              <button
                type="button"
                className="vhd-inline-action"
                style={{ marginTop: '0.5rem' }}
                onClick={onOpenScanFromPackage}
                data-testid="visit-home-scan-launch-cta"
              >
                Open in Atlas Scan →
              </button>
            )}
          </div>

          {/* ── Local visit controls ──────────────────────────────────────── */}
          {(onSaveLocally != null || onResumeLocalVisit != null || onClearSession != null || onImportWorkflowPackage != null) && (
            <div className="vhd-readiness-panel vhd-local-controls" data-testid="visit-home-local-controls">
              <h2 className="vhd-panel-title">Visit session</h2>
              <div className="vhd-local-controls__actions">
                {onSaveLocally != null && (
                  <button
                    type="button"
                    className="vhd-inline-action"
                    onClick={onSaveLocally}
                    data-testid="visit-home-save-locally"
                  >
                    💾 Save visit locally
                  </button>
                )}
                {hasSavedLocalVisit && onResumeLocalVisit != null && (
                  <button
                    type="button"
                    className="vhd-inline-action"
                    onClick={onResumeLocalVisit}
                    data-testid="visit-home-resume-local"
                  >
                    ↩ Resume saved visit
                  </button>
                )}
                {onImportWorkflowPackage != null && (
                  <>
                    <button
                      type="button"
                      className="vhd-inline-action"
                      onClick={() => workflowFileInputRef.current?.click()}
                      data-testid="visit-home-import-workflow-controls-cta"
                    >
                      📂 Import visit package
                    </button>
                    {/* File input is shared with the empty-state one; only render if not already rendered */}
                    {hydrationState !== 'no-visit' && (
                      <input
                        ref={workflowFileInputRef}
                        type="file"
                        accept=".atlasvisit.json,.atlasvisit.pdf,application/pdf"
                        style={{ display: 'none' }}
                        aria-hidden="true"
                        data-testid="visit-home-workflow-file-input-controls"
                        onChange={handleWorkflowFileChange}
                      />
                    )}
                  </>
                )}
                {onClearSession != null && (
                  <button
                    type="button"
                    className="vhd-inline-action vhd-inline-action--destructive"
                    onClick={onClearSession}
                    data-testid="visit-home-clear-session"
                  >
                    ✕ Clear review session
                  </button>
                )}
              </div>
              {localSessionStatus != null ? (
                <div
                  data-testid="visit-home-local-session-status"
                  className={`vhd-session-status vhd-session-status--${localSessionStatus.tone}`}
                >
                  {localSessionStatus.type === 'import' && localSessionStatus.importSummary != null ? (
                    <>
                      <div className="vhd-session-status__header">
                        <strong>Import result</strong>
                        <ImportResultBadge integrityStatus={localSessionStatus.importSummary.integrityStatus} />
                      </div>
                      <p className="vhd-session-status__message">{localSessionStatus.message}</p>
                      {localSessionStatus.importSummary.warnings != null && localSessionStatus.importSummary.warnings.length > 0 && (
                        <ul className="vhd-session-status__list" data-testid="visit-home-import-warning-list">
                          {localSessionStatus.importSummary.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      )}
                      <p className="vhd-session-status__next-step">
                        Next step: Review imported visit details before continuing to customer-facing outputs.
                      </p>
                    </>
                  ) : null}
                  {localSessionStatus.type === 'export' && localSessionStatus.exportSummary != null ? (
                    <>
                      <div className="vhd-session-status__header">
                        <strong>Export complete</strong>
                      </div>
                      <p className="vhd-session-status__message">{localSessionStatus.message}</p>
                      {localSessionStatus.exportSummary.includedItems.length > 0 && (
                        <>
                          <p className="vhd-session-status__next-step">Package includes:</p>
                          <ul className="vhd-session-status__list" data-testid="visit-home-export-include-list">
                            {localSessionStatus.exportSummary.includedItems.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </>
                  ) : null}
                  {(localSessionStatus.type == null || localSessionStatus.type === 'session') ? (
                    <p className="vhd-session-status__message">{localSessionStatus.message}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

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
