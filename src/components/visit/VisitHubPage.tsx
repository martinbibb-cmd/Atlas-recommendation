/**
 * VisitHubPage
 *
 * The "Visit Hub" — the entry point when opening an existing visit.
 *
 * Renders differently based on the visit lifecycle state:
 *
 *   VISIT IN PROGRESS (survey not yet complete)
 *     - Lifecycle card: "VISIT IN PROGRESS"
 *     - Primary CTA: Continue survey
 *     - Secondary (locked): Customer summary, Send customer portal,
 *       Engineer handoff, Present to customer
 *
 *   READY TO COMPLETE (survey done, visit not formally closed)
 *     - Lifecycle card: "READY TO COMPLETE"
 *     - Primary CTAs: Continue survey · Complete visit
 *     - Secondary: Customer summary, Send customer portal,
 *       Engineer handoff, Present to customer
 *
 *   VISIT COMPLETED (completed_at is set)
 *     - Lifecycle card: "VISIT COMPLETED" + timestamp
 *     - Primary CTA: Review handoff
 *     - Secondary: Customer summary, Send customer portal, Engineer handoff
 *     - More tools (collapsible): Present to customer, Technical detail
 */

import { useEffect, useRef, useState } from 'react';
import { getVisit, saveVisit, deleteVisit, visitDisplayLabel, isSurveyComplete, isVisitCompleted, type VisitMeta } from '../../lib/visits/visitApi';
import { listReportsForVisit, saveReport } from '../../lib/reports/reportApi';
import { generateReportTitle } from '../../lib/reports/generateReportTitle';
import { generatePortalToken } from '../../lib/portal/portalToken';
import { buildPortalUrl } from '../../lib/portal/portalUrl';
import { runEngine } from '../../engine/Engine';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import { toEngineInput } from '../../ui/fullSurvey/FullSurveyModelV1';
import { sanitiseModelForEngine } from '../../ui/fullSurvey/sanitiseModelForEngine';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import { buildCanonicalReportPayload } from '../../features/reports/adapters/buildCanonicalReportPayload';
import { VoiceNotesPanel } from '../../features/voiceNotes/VoiceNotesPanel';
import type { VoiceNote } from '../../features/voiceNotes/voiceNoteTypes';
import { applyAcceptedSuggestions, mergeAppliedSuggestions, mergeFullSurveyUpdates } from '../../features/voiceNotes/applyAcceptedSuggestions';
import { HEAT_SOURCE_OPTIONS, WATER_SOURCE_OPTIONS } from '../../features/survey/recommendation/recommendationTypes';
import VisitReportsList from './VisitReportsList';
import { VisitReplayPanel } from './VisitReplayPanel';
import './VisitHubPage.css';

interface Props {
  visitId: string;
  onBack: () => void;
  /** Route to the full survey stepper (resume / edit). */
  onResumeSurvey: () => void;
  /** Open the in-room presentation for this visit. */
  onOpenPresentation: () => void;
  /** Print the customer summary for this visit. */
  onPrintSummary?: () => void;
  /** Open a specific report by ID. */
  onOpenReport: (reportId: string) => void;
  /** Open the pre-install engineer route for this visit. */
  onOpenEngineerRoute?: () => void;
  /** Open the Atlas Insight Pack for this visit (requires quotes to be collected). */
  onOpenInsightPack?: () => void;
  /** Open the completed-visit handoff review page. */
  onOpenHandoffReview?: () => void;
}

// Delay (ms) between opening the print dialog and launching the email client,
// giving the browser time to render the print preview before the email client
// takes window focus.
const PRINT_DIALOG_DELAY_MS = 400;

// ─── Engine run metadata key in working_payload ───────────────────────────────

const ENGINE_RUN_META_KEY = '_atlasEngineRunMeta';

interface EngineRunMeta {
  runAt: string;
  output: EngineOutputV1;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeDate(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function addressDisplay(meta: VisitMeta): string {
  return visitDisplayLabel(meta);
}

/** Returns the lifecycle-state label shown in the hub status badge. */
function hubLifecycleLabel(meta: VisitMeta): string {
  if (isVisitCompleted(meta)) return 'Visit completed';
  if (isSurveyComplete(meta)) return 'Ready to complete';
  return 'Visit in progress';
}

/** Returns a CSS modifier key for the hub lifecycle badge. */
function hubLifecycleKey(meta: VisitMeta): string {
  if (isVisitCompleted(meta)) return 'visit_completed';
  if (isSurveyComplete(meta)) return 'ready_to_complete';
  return 'visit_in_progress';
}

// ─── Completed-state preview derivation ──────────────────────────────────────

/**
 * Returns a short human-readable label for the current heat source
 * captured in the system builder step.
 */
function heatSourceLabel(heatSource: string | null | undefined): string | null {
  if (!heatSource) return null;
  const map: Record<string, string> = {
    combi:         'Combi boiler',
    system:        'System boiler',
    regular:       'Regular boiler',
    storage_combi: 'Storage combi boiler',
  };
  return map[heatSource] ?? null;
}

interface CustomerPreview {
  currentSystem: string | null;
  plannedSystem: string | null;
}

/**
 * Derives a two-line customer-facing preview from the working payload.
 * Returns null strings when insufficient data is available.
 */
function deriveCustomerPreview(payload: Partial<FullSurveyModelV1>): CustomerPreview {
  const systemBuilder = payload.fullSurvey?.systemBuilder;
  const recommendation = payload.fullSurvey?.recommendation;

  // Current system — derive from the surveyed system builder state.
  let currentSystem: string | null = null;
  if (systemBuilder?.heatSource) {
    const label = heatSourceLabel(systemBuilder.heatSource);
    if (label) {
      const age = systemBuilder.boilerAgeYears;
      const agePart = age != null
        ? `, approx. ${age} year${age !== 1 ? 's' : ''} old`
        : '';
      currentSystem = `${label}${agePart}`;
    }
  }

  // Planned system — derive from the recommendation step.
  let plannedSystem: string | null = null;
  if (recommendation?.heatSource) {
    const heatOpt = HEAT_SOURCE_OPTIONS.find(o => o.value === recommendation.heatSource);
    const waterOpt = recommendation.waterSource
      ? WATER_SOURCE_OPTIONS.find(o => o.value === recommendation.waterSource)
      : null;
    const parts: string[] = [];
    if (heatOpt) parts.push(heatOpt.label);
    if (waterOpt && recommendation.waterSource !== 'keep_existing') parts.push(waterOpt.label);
    if (parts.length > 0) plannedSystem = parts.join(' + ');
  }

  return { currentSystem, plannedSystem };
}

interface EngineerPreviewCounts {
  bedrooms: number | null;
  keyObjects: number;
  emitterType: string | null;
  captureNotes: number;
}

/**
 * Derives count-based engineer preview stats from the working payload.
 */
function deriveEngineerPreviewCounts(
  payload: Partial<FullSurveyModelV1>,
  voiceNotes: VoiceNote[],
): EngineerPreviewCounts {
  const systemBuilder = payload.fullSurvey?.systemBuilder;

  // Bedrooms — available as a top-level field on EngineInputV2_3.
  const bedrooms = payload.bedrooms ?? null;

  // Key objects — count the distinct items present in the system builder.
  let keyObjects = 0;
  if (systemBuilder?.heatSource) keyObjects++;
  if (systemBuilder?.dhwType) keyObjects++;
  if (systemBuilder?.cylinderAgeBand) keyObjects++;
  if (systemBuilder?.emitters) keyObjects++;

  // Emitter type — use the existing emitters field.
  const emitterMap: Record<string, string> = {
    radiators_standard: 'Standard radiators',
    radiators_designer: 'Designer radiators',
    underfloor:         'Underfloor heating',
    mixed:              'Mixed (radiators + UFH)',
  };
  const emitterType = systemBuilder?.emitters
    ? (emitterMap[systemBuilder.emitters] ?? systemBuilder.emitters)
    : null;

  return { bedrooms, keyObjects, emitterType, captureNotes: voiceNotes.length };
}

// ─── Completed preview card components ───────────────────────────────────────

function CustomerSummaryPreviewCard({ preview }: { preview: CustomerPreview }) {
  return (
    <div className="visit-hub__preview-card" data-testid="customer-summary-preview-card">
      <p className="visit-hub__preview-card-label">Customer summary preview</p>
      <div className="visit-hub__preview-card-body">
        <div className="visit-hub__preview-row">
          <span className="visit-hub__preview-row-icon">🏠</span>
          <div>
            <p className="visit-hub__preview-row-heading">What we found</p>
            <p className="visit-hub__preview-row-text">
              {preview.currentSystem ?? 'Current system details not recorded'}
            </p>
          </div>
        </div>
        <div className="visit-hub__preview-row">
          <span className="visit-hub__preview-row-icon">🔧</span>
          <div>
            <p className="visit-hub__preview-row-heading">What&rsquo;s planned</p>
            <p className="visit-hub__preview-row-text">
              {preview.plannedSystem ?? 'Recommendation not yet recorded'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EngineerHandoffPreviewCard({ counts }: { counts: EngineerPreviewCounts }) {
  return (
    <div className="visit-hub__preview-card" data-testid="engineer-handoff-preview-card">
      <p className="visit-hub__preview-card-label">Engineer handoff preview</p>
      <div className="visit-hub__preview-card-stats">
        <div className="visit-hub__preview-stat">
          <span className="visit-hub__preview-stat-value">
            {counts.bedrooms != null ? counts.bedrooms : '—'}
          </span>
          <span className="visit-hub__preview-stat-label">Bedrooms</span>
        </div>
        <div className="visit-hub__preview-stat">
          <span className="visit-hub__preview-stat-value">{counts.keyObjects}</span>
          <span className="visit-hub__preview-stat-label">Key objects</span>
        </div>
        <div className="visit-hub__preview-stat">
          <span className="visit-hub__preview-stat-value">{counts.captureNotes}</span>
          <span className="visit-hub__preview-stat-label">Capture notes</span>
        </div>
      </div>
      {counts.emitterType && (
        <p className="visit-hub__preview-emitter">
          <span className="visit-hub__preview-emitter-label">Emitters</span>
          {counts.emitterType}
        </p>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HubHeader({ meta, onBack, onReferenceChange }: { meta: VisitMeta; onBack: () => void; onReferenceChange: (ref: string) => void }) {
  const label = hubLifecycleLabel(meta);
  const statusKey = hubLifecycleKey(meta);
  const [editing, setEditing] = useState(false);
  const [draftRef, setDraftRef] = useState(meta.visit_reference ?? '');
  const shortId = meta.id.slice(-8).toUpperCase();

  function handleSave() {
    setEditing(false);
    onReferenceChange(draftRef.trim());
  }  return (
    <div className="visit-hub__header">
      <button
        className="visit-hub__back-btn"
        onClick={onBack}
        aria-label="Back to visit list"
      >
        ←
      </button>
      <div className="visit-hub__header-body">
        {editing ? (
          <div className="visit-hub__ref-edit">
            <label className="visit-hub__ref-label" htmlFor="visit-hub-ref-input">
              Lead reference
            </label>
            <input
              id="visit-hub-ref-input"
              className="visit-hub__ref-input"
              type="text"
              value={draftRef}
              onChange={(e) => setDraftRef(e.target.value)}
              placeholder="e.g. Lead 12345, Job 678"
              aria-label="Lead reference"
              aria-describedby="visit-hub-ref-hint"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                else if (e.key === 'Escape') setEditing(false);
              }}
            />
            <span id="visit-hub-ref-hint" className="visit-hub__ref-hint">
              Add your own lead, job, or customer reference
            </span>
            <button className="visit-hub__ref-save-btn" onClick={handleSave}>Save</button>
            <button className="visit-hub__ref-cancel-btn" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        ) : (
          <h1 className="visit-hub__address">
            {addressDisplay(meta)}
            <button
              className="visit-hub__ref-edit-btn"
              onClick={() => { setDraftRef(meta.visit_reference ?? ''); setEditing(true); }}
              aria-label={meta.visit_reference ? 'Edit lead reference' : 'Add lead reference'}
              title={meta.visit_reference ? 'Edit lead reference' : 'Add lead reference'}
            >
              {meta.visit_reference ? ' ✏ Edit ref' : ' + Add ref'}
            </button>
          </h1>
        )}
        {meta.visit_reference && (
          <p className="visit-hub__visit-id" aria-label={`Internal visit ID: ${shortId}`}>
            Visit ···{shortId}
          </p>
        )}
        {meta.customer_name && (
          <p className="visit-hub__customer">{meta.customer_name}</p>
        )}
        <div className="visit-hub__meta-row">
          <span
            className={`visit-hub__status-badge visit-hub__status-badge--${statusKey}`}
            aria-label={`Status: ${label}`}
          >
            {label}
          </span>
          <span className="visit-hub__updated">
            Updated {formatRelativeDate(meta.updated_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

function HubActions({
  meta,
  onResumeSurvey,
  onOpenPresentation,
  onPrintSummary,
  onEmailSummary,
  onSaveVisitLocally,
  onOpenEngineerRoute,
  onOpenInsightPack,
  onOpenHandoffReview,
  onExportVisitPack,
  onCompleteVisit,
  isCompleting,
  completingError,
  portalUrl,
  portalLoading,
  hasQuotes,
}: {
  meta: VisitMeta;
  onResumeSurvey: () => void;
  onOpenPresentation: () => void;
  onPrintSummary?: () => void;
  onEmailSummary?: () => void;
  onSaveVisitLocally?: () => void;
  onOpenEngineerRoute?: () => void;
  onOpenInsightPack?: () => void;
  onOpenHandoffReview?: () => void;
  onExportVisitPack?: () => void;
  onCompleteVisit: () => void;
  isCompleting: boolean;
  completingError: string | null;
  portalUrl?: string;
  portalLoading?: boolean;
  hasQuotes?: boolean;
}) {
  const surveyDone = isSurveyComplete(meta);
  const visitDone = isVisitCompleted(meta);

  function handleSendPortal() {
    if (!portalUrl) return;
    const subject = encodeURIComponent('Your personalised heating advice');
    const body = encodeURIComponent(
      `Hi,\n\nPlease follow the link below to view your personalised heating advice:\n\n${portalUrl}\n\n` +
      `This gives you access to your full heating recommendation, the options we considered, and your next steps.\n\nKind regards`,
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
  }

  // ── Lifecycle status card ──────────────────────────────────────────────────

  const lifecycleKey = hubLifecycleKey(meta);
  const lifecycleLabel = hubLifecycleLabel(meta);

  const lifecycleCard = (
    <div className={`visit-hub__lifecycle-card visit-hub__lifecycle-card--${lifecycleKey}`}>
      <span className="visit-hub__lifecycle-label">{lifecycleLabel.toUpperCase()}</span>
      {visitDone && meta.completed_at && (
        <span className="visit-hub__lifecycle-sub">
          Completed {formatDateTime(meta.completed_at)}
        </span>
      )}
      {!visitDone && !surveyDone && (
        <span className="visit-hub__lifecycle-sub">Survey incomplete</span>
      )}
      {!visitDone && surveyDone && (
        <span className="visit-hub__lifecycle-sub">Survey complete · ready for sign-off</span>
      )}
    </div>
  );

  // ── Portal button label ────────────────────────────────────────────────────

  const portalBtnLabel = portalLoading
    ? '⏳ Preparing portal…'
    : '📮 Send portal via email';

  // ── COMPLETED state ────────────────────────────────────────────────────────

  if (visitDone) {
    return (
      <div className="visit-hub__actions">
        {lifecycleCard}

        {/* Primary actions */}
        <div className="visit-hub__actions-primary">
          <p className="visit-hub__section-label">Customer outputs</p>

          <button
            className="visit-hub__action-btn visit-hub__action-btn--primary"
            onClick={onOpenPresentation}
            aria-label="Present to customer"
            data-testid="present-to-customer-btn"
          >
            ▶ Present to customer
          </button>

          {onPrintSummary && (
            <button
              className="visit-hub__action-btn visit-hub__action-btn--secondary"
              onClick={onPrintSummary}
              aria-label="Download customer PDF"
              data-testid="download-customer-pdf-btn"
            >
              📄 Download customer PDF
            </button>
          )}

          {onEmailSummary && (
            <button
              className="visit-hub__action-btn visit-hub__action-btn--secondary"
              onClick={onEmailSummary}
              aria-label="Send customer PDF"
              data-testid="send-customer-pdf-btn"
            >
              📧 Send customer PDF
            </button>
          )}

          <button
            className="visit-hub__action-btn visit-hub__action-btn--secondary"
            onClick={handleSendPortal}
            aria-label="Send customer portal link"
            data-testid="send-portal-btn"
            disabled={!portalUrl || portalLoading}
            aria-disabled={!portalUrl || portalLoading}
          >
            {portalBtnLabel}
          </button>
        </div>

        {/* Operational actions */}
        <div className="visit-hub__actions-secondary">
          <p className="visit-hub__section-label">Operational</p>

          {onOpenEngineerRoute && (
            <button
              className="visit-hub__action-btn visit-hub__action-btn--secondary"
              onClick={onOpenEngineerRoute}
              aria-label="Open engineer handoff"
              data-testid="open-engineer-route-btn"
            >
              🔧 Engineer handoff
            </button>
          )}

          {onOpenInsightPack && (
            <button
              className="visit-hub__action-btn visit-hub__action-btn--secondary"
              onClick={onOpenInsightPack}
              aria-label="Open insight view"
              data-testid="open-insight-pack-btn"
            >
              📊 Insight view{hasQuotes ? '' : ' · Add quotes for full detail'}
            </button>
          )}

          {onExportVisitPack && (
            <button
              className="visit-hub__action-btn visit-hub__action-btn--secondary"
              onClick={onExportVisitPack}
              aria-label="Export visit pack"
              data-testid="export-visit-pack-btn"
            >
              📦 Export visit pack
            </button>
          )}
        </div>

        {/* Diagnostics — always visible */}
        <div className="visit-hub__more-tools" data-testid="diagnostics-section">
          <p className="visit-hub__section-label">Diagnostics</p>
          <div className="visit-hub__more-tools-body">
            {onOpenHandoffReview && (
              <button
                className="visit-hub__action-btn visit-hub__action-btn--secondary"
                onClick={onOpenHandoffReview}
                aria-label="Review completed-visit handoff"
                data-testid="open-handoff-review-btn"
              >
                🤝 Review handoff
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── READY TO COMPLETE state (survey done, visit not yet completed) ──────────

  if (surveyDone) {
    return (
      <div className="visit-hub__actions">
        {lifecycleCard}

        {/* Primary group */}
        <button
          className="visit-hub__action-btn visit-hub__action-btn--secondary"
          onClick={onResumeSurvey}
          aria-label="Continue survey"
        >
          ✏ Continue survey
        </button>

        {completingError && (
          <p className="visit-hub__complete-error" role="alert">{completingError}</p>
        )}

        <button
          className="visit-hub__action-btn visit-hub__action-btn--complete"
          onClick={onCompleteVisit}
          disabled={isCompleting}
          aria-disabled={isCompleting}
          data-testid="complete-visit-btn"
        >
          {isCompleting ? '⏳ Completing…' : '✔ Complete visit'}
        </button>

        {/* Secondary group — available but visually muted */}
        <div className="visit-hub__actions-secondary">
          <p className="visit-hub__section-label">Handoff tools</p>

          {onPrintSummary && (
            <button
              className="visit-hub__action-btn visit-hub__action-btn--secondary"
              onClick={onPrintSummary}
              aria-label="Download customer PDF"
            >
              📄 Download customer PDF
            </button>
          )}

          {onEmailSummary && (
            <button
              className="visit-hub__action-btn visit-hub__action-btn--secondary"
              onClick={onEmailSummary}
              aria-label="Send customer PDF"
              data-testid="send-customer-pdf-btn"
            >
              📧 Send customer PDF
            </button>
          )}

          {onSaveVisitLocally && (
            <button
              className="visit-hub__action-btn visit-hub__action-btn--secondary"
              onClick={onSaveVisitLocally}
              aria-label="Save visit data locally"
              data-testid="save-visit-locally-btn"
            >
              💾 Save visit locally
            </button>
          )}

          <button
            className="visit-hub__action-btn visit-hub__action-btn--secondary"
            onClick={handleSendPortal}
            aria-label="Send customer portal link"
            data-testid="send-portal-btn"
            disabled={!portalUrl || portalLoading}
            aria-disabled={!portalUrl || portalLoading}
          >
            {portalBtnLabel}
          </button>

          {onOpenEngineerRoute && (
            <button
              className="visit-hub__action-btn visit-hub__action-btn--secondary"
              onClick={onOpenEngineerRoute}
              aria-label="Open engineer handoff"
              data-testid="open-engineer-route-btn"
            >
              🔧 Engineer handoff
            </button>
          )}

          <button
            className="visit-hub__action-btn visit-hub__action-btn--secondary"
            onClick={onOpenPresentation}
            aria-label="Present to customer"
          >
            ▶ Present to customer
          </button>

          {onOpenInsightPack && (
            <button
              className="visit-hub__action-btn visit-hub__action-btn--secondary"
              onClick={onOpenInsightPack}
              aria-label="Open insight view"
              data-testid="open-insight-pack-btn"
            >
              📊 Insight view{hasQuotes ? '' : ' · Add quotes for full detail'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── IN PROGRESS state (survey not yet done) ────────────────────────────────

  return (
    <div className="visit-hub__actions">
      {lifecycleCard}

      {/* Primary */}
      <button
        className="visit-hub__action-btn visit-hub__action-btn--primary"
        onClick={onResumeSurvey}
        aria-label="Continue survey"
      >
        ▶ Continue survey
      </button>

      {/* Secondary group — all disabled until survey is complete */}
      <div className="visit-hub__actions-secondary visit-hub__actions-secondary--locked">
        <p className="visit-hub__section-label">Available after survey</p>

        {onPrintSummary && (
          <button
            className="visit-hub__action-btn visit-hub__action-btn--secondary"
            disabled
            aria-disabled="true"
            aria-label="Download customer PDF — complete survey first"
          >
            📄 Download customer PDF
          </button>
        )}

        {onEmailSummary && (
          <button
            className="visit-hub__action-btn visit-hub__action-btn--secondary"
            disabled
            aria-disabled="true"
            aria-label="Send customer PDF — complete survey first"
          >
            📧 Send customer PDF
          </button>
        )}

        {onSaveVisitLocally && (
          <button
            className="visit-hub__action-btn visit-hub__action-btn--secondary"
            disabled
            aria-disabled="true"
            aria-label="Save visit locally — complete survey first"
          >
            💾 Save visit locally
          </button>
        )}

        <button
          className="visit-hub__action-btn visit-hub__action-btn--secondary"
          disabled
          aria-disabled="true"
          aria-label="Send portal via email — complete survey first"
        >
          📮 Send portal via email
        </button>

        {onOpenEngineerRoute && (
          <button
            className="visit-hub__action-btn visit-hub__action-btn--secondary"
            disabled
            aria-disabled="true"
            aria-label="Engineer handoff — complete survey first"
            data-testid="open-engineer-route-btn"
          >
            🔧 Engineer handoff
          </button>
        )}

        <button
          className="visit-hub__action-btn visit-hub__action-btn--secondary"
          disabled
          aria-disabled="true"
          aria-label="Present to customer — complete survey first"
        >
          ▶ Present to customer
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VisitHubPage({
  visitId,
  onBack,
  onResumeSurvey,
  onOpenPresentation,
  onPrintSummary,
  onOpenReport,
  onOpenEngineerRoute,
  onOpenInsightPack,
  onOpenHandoffReview,
}: Props) {
  const [meta, setMeta] = useState<VisitMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalUrl, setPortalUrl] = useState<string | undefined>();
  const [portalLoading, setPortalLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completingError, setCompletingError] = useState<string | null>(null);
  const completingRef = useRef(false);
  // Keep the working_payload so we can create a report (for portal) if none exists yet.
  const workingPayloadRef = useRef<Record<string, unknown> | null>(null);
  // Voice notes — loaded from working_payload and saved back on change.
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  // Whether this visit's working payload contains contractor quotes.
  const [hasQuotes, setHasQuotes] = useState(false);
  // Engine run metadata.
  const [engineRunAt, setEngineRunAt] = useState<string | null>(null);
  const [lastEngineOutput, setLastEngineOutput] = useState<EngineOutputV1 | null>(null);
  const [isEngineRunning, setIsEngineRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getVisit(visitId)
      .then((visit) => {
        if (cancelled) return;
        const { working_payload, ...metaFields } = visit;
        setMeta(metaFields);
        workingPayloadRef.current = working_payload;
        // Hydrate voice notes from the persisted working payload.
        const payload = working_payload as Partial<FullSurveyModelV1> | null;
        const persisted = payload?.fullSurvey?.voiceNotes;
        if (Array.isArray(persisted)) setVoiceNotes(persisted);
        // Check if contractor quotes were collected in the survey.
        const quotes = payload?.fullSurvey?.quotes;
        setHasQuotes(Array.isArray(quotes) && quotes.length > 0);
        // Restore any persisted engine run metadata.
        const engineMeta = (working_payload as Record<string, unknown>)?.[ENGINE_RUN_META_KEY];
        if (engineMeta && typeof engineMeta === 'object') {
          const m = engineMeta as Partial<EngineRunMeta>;
          if (typeof m.runAt === 'string') setEngineRunAt(m.runAt);
          if (m.output) setLastEngineOutput(m.output as unknown as EngineOutputV1);
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visitId]);

  // Generate a signed portal URL from the latest report for this visit.
  // If no report exists yet and the survey is complete, create one first so
  // the portal is always available after survey completion.
  useEffect(() => {
    if (loading) return; // Wait until the visit is loaded.
    if (!meta || !isSurveyComplete(meta)) return; // Portal only for complete surveys.

    let cancelled = false;
    setPortalLoading(true);

    listReportsForVisit(visitId)
      .then(async (reports) => {
        if (cancelled) return;

        let reportId: string;
        if (reports.length > 0) {
          reportId = reports[0].id;
        } else {
          // No report yet — create one from the working payload so the portal link
          // is available without requiring the user to go through the printout flow.
          const payload = workingPayloadRef.current;
          if (!payload || Object.keys(payload).length === 0) return;
          // The working_payload is persisted as FullSurveyModelV1 by VisitPage — the same
          // two-step cast (unknown → FullSurveyModelV1) used in App.tsx is the correct pattern
          // here since VisitDetail.working_payload is typed as Record<string, unknown>.
          const survey = payload as unknown as FullSurveyModelV1;
          const engineInput = toEngineInput(sanitiseModelForEngine(survey));
          const { engineOutput } = runEngine(engineInput);
          const saved = await saveReport({
            title: generateReportTitle({
              postcode: engineInput.postcode ?? null,
              customerName: meta?.customer_name ?? null,
              addressLine1: meta?.address_line_1 ?? null,
              recommendedSystem: engineOutput.recommendation?.primary ?? null,
            }),
            postcode: engineInput.postcode ?? null,
            visit_id: visitId,
            status: 'complete',
            payload: buildCanonicalReportPayload({
              surveyData: survey,
              engineInput,
              engineOutput,
              decisionSynthesis: null,
              runMeta: { source: 'visit_hub' },
            }),
          });
          if (cancelled) return;
          reportId = saved.id;
        }

        const token = await generatePortalToken(reportId);
        if (!cancelled) {
          setPortalUrl(buildPortalUrl(reportId, window.location.origin, token));
        }
      })
      .catch((err) => { console.warn('[Atlas] Could not generate portal URL for visit hub:', err); })
      .finally(() => { if (!cancelled) setPortalLoading(false); });

    return () => {
      cancelled = true;
    };
  }, [visitId, meta, loading]);

  function handleReferenceChange(newRef: string) {
    if (!meta) return;
    const trimmed = newRef.trim() || null;
    setMeta({ ...meta, visit_reference: trimmed });
    saveVisit(visitId, { visit_reference: trimmed ?? '' }).catch(() => {/* best effort */});
  }

  function handleVisitCompleted(completedAt: string) {
    if (!meta) return;
    setMeta({ ...meta, completed_at: completedAt, completion_method: 'manual_pwa' });
  }

  async function handleCompleteVisit() {
    if (!meta || !isSurveyComplete(meta) || completingRef.current) return;
    completingRef.current = true;
    setCompleting(true);
    setCompletingError(null);
    const completedAt = new Date().toISOString();
    try {
      await saveVisit(visitId, {
        completed_at: completedAt,
        completion_method: 'manual_pwa',
        status: 'recommendation_ready',
      });
      handleVisitCompleted(completedAt);
    } catch (err) {
      setCompletingError(err instanceof Error ? err.message : 'Could not complete visit. Please try again.');
    } finally {
      completingRef.current = false;
      setCompleting(false);
    }
  }

  function handleDeleteRequest() {
    setDeleteConfirm(true);
  }

  function handleDeleteCancel() {
    setDeleteConfirm(false);
  }

  function handleDeleteConfirm() {
    setDeleting(true);
    deleteVisit(visitId)
      .then(() => { onBack(); })
      .catch((err: unknown) => {
        setDeleting(false);
        setDeleteConfirm(false);
        setError(err instanceof Error ? err.message : String(err));
      });
  }

  /** Persist updated voice notes into the visit's working_payload. */
  function handleNotesChange(updated: VoiceNote[]) {
    setVoiceNotes(updated);
    // Merge into the existing working payload so we don't overwrite other fields.
    const existing = (workingPayloadRef.current ?? {}) as Partial<FullSurveyModelV1>;

    // Gather all accepted suggestions across all notes.
    const allAccepted = updated.flatMap(n =>
      n.suggestions.filter(s => s.status === 'accepted'),
    );

    // Apply accepted suggestions to survey fields with full provenance tracking.
    const { updates: noteUpdates, applied: newApplied } = applyAcceptedSuggestions(
      allAccepted,
      existing,
    );

    // Preserve any previously applied records not in the new set — mergeAppliedSuggestions
    // de-duplicates by sourceSuggestionId and preserves overriddenByManual state.
    const mergedApplied = mergeAppliedSuggestions(
      existing.fullSurvey?.appliedNoteSuggestions ?? [],
      newApplied,
    );

    // Remove applied records whose originating suggestion is no longer accepted.
    const acceptedIds = new Set(allAccepted.map(s => s.id));
    const activeApplied = mergedApplied.filter(a => acceptedIds.has(a.sourceSuggestionId));

    const merged: Partial<FullSurveyModelV1> = mergeFullSurveyUpdates(existing, {
      ...noteUpdates,
      fullSurvey: {
        ...existing.fullSurvey,
        ...(noteUpdates.fullSurvey ?? {}),
        voiceNotes: updated,
        acceptedNoteSuggestions: allAccepted,
        appliedNoteSuggestions: activeApplied,
      },
    });
    workingPayloadRef.current = merged as Record<string, unknown>;
    saveVisit(visitId, { working_payload: merged as Record<string, unknown> }).catch(() => {/* best effort */});
  }

  /** Re-run the engine on the current working payload and persist the result. */
  async function handleRerunEngine() {
    const payload = workingPayloadRef.current;
    if (!payload || Object.keys(payload).length === 0 || isEngineRunning) return;
    setIsEngineRunning(true);
    try {
      const survey = payload as unknown as FullSurveyModelV1;
      const engineInput = toEngineInput(sanitiseModelForEngine(survey));
      const { engineOutput } = runEngine(engineInput);
      const runAt = new Date().toISOString();
      const engineMeta: EngineRunMeta = { runAt, output: engineOutput };
      const updated = { ...payload, [ENGINE_RUN_META_KEY]: engineMeta };
      workingPayloadRef.current = updated;
      setEngineRunAt(runAt);
      setLastEngineOutput(engineOutput);
      saveVisit(visitId, { working_payload: updated }).catch(() => {/* best effort */});
    } finally {
      setIsEngineRunning(false);
    }
  }

  /** Trigger a browser download of the last engine result as JSON. */
  function handleDownloadEngineJson() {
    if (!lastEngineOutput) return;
    const filename = `atlas-engine-result-${visitId.slice(-8).toUpperCase()}.json`;
    const blob = new Blob([JSON.stringify(lastEngineOutput, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Open the default email client asking the user to attach the customer
   * summary PDF that was just downloaded.
   * Also triggers the print page so the PDF lands in the downloads folder
   * before the email client opens.
   */
  function handleEmailSummary() {
    if (!meta) return;
    // Trigger PDF download/print so the file is ready to attach.
    if (onPrintSummary) onPrintSummary();
    const subject = encodeURIComponent(`Your Atlas visit summary – ${visitDisplayLabel(meta)}`);
    const body = encodeURIComponent(
      `Please find your personalised heating summary attached.\n\n` +
      `Your summary PDF has been saved to your device — please attach it to this email.\n\n` +
      (portalUrl
        ? `You can also view your summary online:\n${portalUrl}\n\n`
        : '') +
      `Generated by Atlas on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
    );
    // Small delay so the print dialog has time to open before the email client takes focus.
    setTimeout(() => { window.open(`mailto:?subject=${subject}&body=${body}`, '_self'); }, PRINT_DIALOG_DELAY_MS);
  }

  /**
   * Save the visit workspace locally as a JSON file.
   * Uses the same visit-pack export as handleExportVisitPack so the engineer
   * has a portable copy of the full visit data on their device.
   */
  function handleSaveVisitLocally() {
    handleExportVisitPack();
  }

  /** Export the full visit workspace as a JSON pack for internal use. */
  function handleExportVisitPack() {
    if (!meta) return;
    const visitRef = meta.visit_reference ?? visitId.slice(-8).toUpperCase();
    const filename = `atlas-visit-pack-${visitRef}.json`;
    const pack = {
      visitId: meta.id,
      visitReference: meta.visit_reference,
      exportedAt: new Date().toISOString(),
      meta,
      workingPayload: workingPayloadRef.current,
      engineOutput: lastEngineOutput,
    };
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="visit-hub__loading" role="status" aria-live="polite">
        Loading visit…
      </div>
    );
  }

  if (error || meta === null) {
    return (
      <div className="visit-hub__error" role="alert">
        <p>Could not load visit{error ? `: ${error}` : '.'}</p>
        <button className="cta-btn" onClick={onBack}>
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="visit-hub">
      <HubHeader meta={meta} onBack={onBack} onReferenceChange={handleReferenceChange} />

      <div className="visit-hub__body">
        <HubActions
          meta={meta}
          onResumeSurvey={onResumeSurvey}
          onOpenPresentation={onOpenPresentation}
          onPrintSummary={onPrintSummary}
          onEmailSummary={handleEmailSummary}
          onSaveVisitLocally={handleSaveVisitLocally}
          onOpenEngineerRoute={onOpenEngineerRoute}
          onOpenInsightPack={onOpenInsightPack}
          onOpenHandoffReview={onOpenHandoffReview}
          onExportVisitPack={handleExportVisitPack}
          onCompleteVisit={handleCompleteVisit}
          isCompleting={completing}
          completingError={completingError}
          portalUrl={portalUrl}
          portalLoading={portalLoading}
          hasQuotes={hasQuotes}
        />

        {/* ── Lifecycle-aware body panels ────────────────────────────────────── */}

        {isVisitCompleted(meta) ? (
          /* Completed: show output preview cards; survey-assist is closed */
          <>
            {/* Closed-survey hint — informs the engineer that capture is finalised */}
            <p
              className="visit-hub__body-hint"
              data-testid="visit-hub-body-completed-hint"
            >
              Survey capture is closed. This visit has been formally completed.
            </p>

            {/* Customer summary preview — read-only, derived from session data */}
            <CustomerSummaryPreviewCard
              preview={deriveCustomerPreview(
                workingPayloadRef.current as Partial<FullSurveyModelV1>,
              )}
            />

            {/* Engineer handoff preview — read-only, count-based */}
            <EngineerHandoffPreviewCard
              counts={deriveEngineerPreviewCounts(
                workingPayloadRef.current as Partial<FullSurveyModelV1>,
                voiceNotes,
              )}
            />

            {/* Survey record — demoted behind a collapse; not customer-facing */}
            <details className="visit-hub__section-collapse" data-testid="survey-record-collapse">
              <summary className="visit-hub__section-collapse-summary">
                🔍 Survey record{voiceNotes.length > 0 ? ` · ${voiceNotes.length} note${voiceNotes.length !== 1 ? 's' : ''}` : ''}
              </summary>
              <VisitReplayPanel
                survey={workingPayloadRef.current as FullSurveyModelV1 | null}
                voiceNotes={voiceNotes}
              />
            </details>
          </>
        ) : isSurveyComplete(meta) ? (
          /* Ready to complete: notes are captured; collapse survey-assist */
          <>
            <p className="visit-hub__section-label" data-testid="visit-hub-body-ready-label">
              Survey assist
            </p>
            <details className="visit-hub__section-collapse" data-testid="engineer-notes-collapse">
              <summary className="visit-hub__section-collapse-summary">
                🎤 Engineer notes{voiceNotes.length > 0 ? ` · ${voiceNotes.length} captured` : ''}
              </summary>
              <VoiceNotesPanel
                visitId={visitId}
                notes={voiceNotes}
                onChange={handleNotesChange}
              />
            </details>
            <VisitReplayPanel
              survey={workingPayloadRef.current as FullSurveyModelV1 | null}
              voiceNotes={voiceNotes}
            />
          </>
        ) : (
          /* In progress: survey-assist panels are primary */
          <>
            <p className="visit-hub__section-label" data-testid="visit-hub-body-in-progress-label">
              Survey assist
            </p>
            <VoiceNotesPanel
              visitId={visitId}
              notes={voiceNotes}
              onChange={handleNotesChange}
            />
            <VisitReplayPanel
              survey={workingPayloadRef.current as FullSurveyModelV1 | null}
              voiceNotes={voiceNotes}
            />
          </>
        )}

        {/* Engine section — last run timestamp, re-run, and JSON download */}
        <details className="visit-hub__engine-section" data-testid="engine-section">
          <summary className="visit-hub__engine-section-summary">
            ⚙️ Engine{engineRunAt ? ` · Last run ${formatRelativeDate(engineRunAt)}` : ''}
          </summary>
          <div className="visit-hub__engine-section-body">
            <p className="visit-hub__engine-run-stamp" data-testid="engine-run-stamp">
              {engineRunAt
                ? `Last engine run: ${formatDateTime(engineRunAt)}`
                : 'Engine has not been run for this visit session.'}
            </p>
            <div className="visit-hub__engine-actions">
              <button
                className="visit-hub__action-btn visit-hub__action-btn--secondary"
                onClick={() => { void handleRerunEngine(); }}
                disabled={isEngineRunning || !workingPayloadRef.current || Object.keys(workingPayloadRef.current ?? {}).length === 0}
                aria-disabled={isEngineRunning}
                data-testid="rerun-engine-btn"
              >
                {isEngineRunning ? '⏳ Running…' : '🔄 Re-run engine'}
              </button>
              {lastEngineOutput && (
                <button
                  className="visit-hub__action-btn visit-hub__action-btn--secondary"
                  onClick={handleDownloadEngineJson}
                  data-testid="download-engine-json-btn"
                  aria-label="Download engine result JSON"
                >
                  ⬇ Download engine result JSON
                </button>
              )}
            </div>
          </div>
        </details>

        {/* Internal diagnostics — collapsed by default; not customer-facing */}
        <details className="visit-hub__internal-diagnostics" data-testid="internal-diagnostics-section">
          <summary className="visit-hub__internal-diagnostics-summary">
            🔬 Internal diagnostics
          </summary>
          <VisitReportsList visitId={visitId} onOpenReport={onOpenReport} internalOnly />
        </details>

        <div className="visit-hub__danger-zone">
          {deleteConfirm ? (
            <div className="visit-hub__delete-confirm" role="alertdialog" aria-modal="true" aria-label="Confirm visit deletion">
              <p className="visit-hub__delete-confirm-msg">
                Permanently delete this visit and all its reports? This cannot be undone.
              </p>
              <div className="visit-hub__delete-confirm-actions">
                <button
                  className="visit-hub__delete-confirm-btn"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  aria-disabled={deleting}
                  aria-label="Confirm deletion"
                >
                  {deleting ? 'Deleting…' : 'Yes, delete visit'}
                </button>
                <button
                  className="visit-hub__delete-cancel-btn"
                  onClick={handleDeleteCancel}
                  disabled={deleting}
                  aria-label="Cancel deletion"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="visit-hub__delete-btn"
              onClick={handleDeleteRequest}
              aria-label="Delete this visit"
            >
              🗑 Delete visit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
