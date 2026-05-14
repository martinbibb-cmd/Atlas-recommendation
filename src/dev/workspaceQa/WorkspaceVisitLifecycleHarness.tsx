import { useEffect, useMemo, useRef, useState } from 'react';
import {
  evaluateWorkspaceVisitLifecycleScenario,
  getWorkspaceVisitLifecycleScenariosV1,
  type WorkspaceVisitLifecycleEvaluationV1,
  type WorkspaceVisitLifecycleProgressEntryV1,
  type WorkspaceVisitReadinessProgressEntryV1,
} from './WorkspaceVisitLifecycleScenarioV1';
import {
  buildWorkspaceLifecycleReleaseReport,
  buildWorkspaceLifecycleReleaseScenarioCheckFromLifecycleScenario,
  type WorkspaceLifecycleReleaseReportV1,
  type WorkspaceLifecycleReleaseStatusV1,
} from './buildWorkspaceLifecycleReleaseReport';
import {
  addTrialReadinessActionNote,
  buildLimitedTrialPlan,
  buildTrialFeedbackSummary,
  buildTrialReadinessPack,
  buildTrialReadinessSummary,
  buildTrialReadinessActions,
  LocalTrialReadinessReviewStorageAdapter,
  LocalTrialFeedbackStorageAdapter,
  mergeGeneratedActionsWithReviewState,
  updateTrialReadinessActionStatus,
  type PersistedTrialReadinessReviewV1,
  type PersistedTrialFeedbackV1,
  type TrialFeedbackEntryV1,
  type TrialReadinessActionV1,
  type TrialReadinessActionReviewStateV1,
  type TrialReadinessLintStatusV1,
  type TrialReadinessSummaryV1,
  type TrialReadinessStatusV1,
  type LimitedTrialPlanV1,
  type TrialFeedbackSummaryV1,
} from '../trialReadiness';
import {
  TrialFeedbackPanel,
} from '../trialReadiness/feedback/TrialFeedbackPanel';
import { buildTrialFeedbackSnapshot } from '../trialReadiness/feedback/trialFeedbackHelpers';

interface WorkspaceVisitLifecycleHarnessProps {
  readonly onBack?: () => void;
}

const TRIAL_READINESS_LINT_STATUS: TrialReadinessLintStatusV1 = {
  hasFailures: true,
};

const TRIAL_READINESS_STATUS_OPTIONS: readonly TrialReadinessStatusV1[] = [
  'open',
  'in_progress',
  'done',
  'accepted_risk',
];

function formatEnumLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function stringArraysEqual(values: readonly string[], nextValues: readonly string[]): boolean {
  return values.length === nextValues.length && values.every((value, index) => value === nextValues[index]);
}

function didSummaryChange(
  baseline: TrialReadinessSummaryV1,
  next: TrialReadinessSummaryV1,
): boolean {
  return (
    baseline.overallRecommendation !== next.overallRecommendation ||
    baseline.plainEnglishSummary !== next.plainEnglishSummary ||
    !stringArraysEqual(baseline.blockers, next.blockers) ||
    !stringArraysEqual(baseline.recommendedBeforeTrial, next.recommendedBeforeTrial) ||
    !stringArraysEqual(baseline.recommendedDuringTrial, next.recommendedDuringTrial)
  );
}

function didLimitedTrialPlanChange(
  baseline: LimitedTrialPlanV1,
  next: LimitedTrialPlanV1,
): boolean {
  return (
    baseline.trialRecommendation !== next.trialRecommendation ||
    baseline.suggestedTesterCount !== next.suggestedTesterCount ||
    !stringArraysEqual(baseline.requiredPreTrialChecks, next.requiredPreTrialChecks) ||
    !stringArraysEqual(baseline.stopCriteria, next.stopCriteria)
  );
}

function StatusPill({
  ok,
  passLabel = 'pass',
  failLabel = 'fail',
}: {
  ok: boolean;
  passLabel?: string;
  failLabel?: string;
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: ok ? '#dcfce7' : '#fee2e2',
        color: ok ? '#166534' : '#991b1b',
      }}
    >
      {ok ? passLabel : failLabel}
    </span>
  );
}

function ReleaseStatusPill({ status }: { status: WorkspaceLifecycleReleaseStatusV1 }) {
  const palette: Record<WorkspaceLifecycleReleaseStatusV1, { background: string; color: string }> = {
    pass: { background: '#dcfce7', color: '#166534' },
    warn: { background: '#fef3c7', color: '#92400e' },
    fail: { background: '#fee2e2', color: '#991b1b' },
  };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: palette[status].background,
        color: palette[status].color,
      }}
    >
      {status}
    </span>
  );
}

function LifecycleRow({ entry }: { entry: WorkspaceVisitLifecycleProgressEntryV1 }) {
  const colorByState: Record<WorkspaceVisitLifecycleProgressEntryV1['state'], string> = {
    pending: '#64748b',
    active: '#1d4ed8',
    done: '#166534',
    blocked: '#991b1b',
  };
  return (
    <tr>
      <td style={{ padding: '4px 8px', fontSize: 12 }}>{entry.stage}</td>
      <td style={{ padding: '4px 8px', fontSize: 12, color: colorByState[entry.state], fontWeight: 700 }}>{entry.state}</td>
      <td style={{ padding: '4px 8px', fontSize: 12, color: '#475569' }}>{entry.note ?? '—'}</td>
    </tr>
  );
}

function ReadinessRow({ entry }: { entry: WorkspaceVisitReadinessProgressEntryV1 }) {
  const colorByState: Record<WorkspaceVisitReadinessProgressEntryV1['state'], string> = {
    blocked: '#991b1b',
    ready: '#1d4ed8',
    complete: '#166534',
  };
  return (
    <tr>
      <td style={{ padding: '4px 8px', fontSize: 12 }}>{entry.key.replace(/_/g, ' ')}</td>
      <td style={{ padding: '4px 8px', fontSize: 12, color: colorByState[entry.state], fontWeight: 700 }}>{entry.state}</td>
      <td style={{ padding: '4px 8px', fontSize: 12, color: '#475569' }}>{entry.note}</td>
    </tr>
  );
}

export default function WorkspaceVisitLifecycleHarness({ onBack }: WorkspaceVisitLifecycleHarnessProps) {
  const scenarios = useMemo(() => getWorkspaceVisitLifecycleScenariosV1(), []);
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? 'new_demo_visit');
  const activeScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === scenarioId) ?? scenarios[0],
    [scenarioId, scenarios],
  );
  const [evaluationState, setEvaluationState] = useState<{
    readonly scenarioId: string;
    readonly value: WorkspaceVisitLifecycleEvaluationV1;
  } | null>(null);
  const [releaseReport, setReleaseReport] = useState<WorkspaceLifecycleReleaseReportV1 | null>(null);
  const [trialReadinessReviewState, setTrialReadinessReviewState] = useState<readonly TrialReadinessActionReviewStateV1[]>([]);
  const evaluation = evaluationState?.scenarioId === activeScenario?.id ? evaluationState.value : null;

  // ── Trial feedback state ───────────────────────────────────────────────────
  const feedbackStorageAdapter = useMemo(() => new LocalTrialFeedbackStorageAdapter(), []);
  const [feedbackEntries, setFeedbackEntries] = useState<readonly TrialFeedbackEntryV1[]>([]);
  const [feedbackSnapshot, setFeedbackSnapshot] = useState<PersistedTrialFeedbackV1 | null>(null);
  const feedbackLoadedRef = useRef(false);

  // ── Trial readiness review persistence ────────────────────────────────────
  const reviewStorageAdapter = useMemo(() => new LocalTrialReadinessReviewStorageAdapter(), []);
  /** ISO 8601 timestamp when this review session was opened. */
  const reviewGeneratedAtRef = useRef<string>(new Date().toISOString());
  /**
   * Set to true once the initial localStorage load attempt has completed,
   * so the auto-save effect does not overwrite a prior session before load
   * has finished.
   */
  const reviewLoadedRef = useRef(false);

  // Load saved review state on mount
  useEffect(() => {
    let active = true;
    void reviewStorageAdapter.loadReviewState().then((result) => {
      if (!active) return;
      reviewLoadedRef.current = true;
      if (result.ok) {
        reviewGeneratedAtRef.current = result.snapshot.generatedAt;
        setTrialReadinessReviewState(result.snapshot.reviewState);
      }
    });
    return () => {
      active = false;
    };
  }, [reviewStorageAdapter]);

  // Auto-save whenever review state changes (after initial load)
  useEffect(() => {
    if (!reviewLoadedRef.current) return;
    // Skip saving an empty state — let clearReviewState() keep storage clear.
    if (trialReadinessReviewState.length === 0) return;
    const snapshot: PersistedTrialReadinessReviewV1 = {
      schemaVersion: '1.0',
      generatedAt: reviewGeneratedAtRef.current,
      reviewState: trialReadinessReviewState,
      updatedAt: new Date().toISOString(),
    };
    void reviewStorageAdapter.saveReviewState(snapshot);
  }, [trialReadinessReviewState, reviewStorageAdapter]);

  // Load saved feedback on mount
  useEffect(() => {
    let active = true;
    void feedbackStorageAdapter.load().then((result) => {
      if (!active) return;
      feedbackLoadedRef.current = true;
      if (result.ok) {
        setFeedbackSnapshot(result.snapshot);
        setFeedbackEntries(result.snapshot.entries);
      }
    });
    return () => {
      active = false;
    };
  }, [feedbackStorageAdapter]);

  // Auto-save feedback whenever entries change (after initial load)
  useEffect(() => {
    if (!feedbackLoadedRef.current) return;
    const next = buildTrialFeedbackSnapshot(feedbackEntries, feedbackSnapshot);
    setFeedbackSnapshot(next);
    void feedbackStorageAdapter.save(next);
    // feedbackSnapshot intentionally omitted from deps to avoid a cycle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedbackEntries, feedbackStorageAdapter]);

  useEffect(() => {
    let active = true;
    if (!activeScenario) return () => {
      active = false;
    };
    (async () => {
      const next = await evaluateWorkspaceVisitLifecycleScenario(activeScenario);
      if (active) {
        setEvaluationState({
          scenarioId: activeScenario.id,
          value: next,
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [activeScenario]);

  useEffect(() => {
    let active = true;
    void Promise.all(
      scenarios.map(async (scenario) => ({
        scenario,
        evaluation: await evaluateWorkspaceVisitLifecycleScenario(scenario),
      })),
    ).then((results) => {
      if (!active) return;
      setReleaseReport(
        buildWorkspaceLifecycleReleaseReport(
          results.map(({ scenario, evaluation: nextEvaluation }) =>
            buildWorkspaceLifecycleReleaseScenarioCheckFromLifecycleScenario(scenario, nextEvaluation),
          ),
        ),
      );
    });
    return () => {
      active = false;
    };
  }, [scenarios]);

  function handleExportReleaseGateReport() {
    if (!releaseReport) return;
    const blob = new Blob([JSON.stringify(releaseReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'release-gate-report.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const trialReadinessGeneratedActions = useMemo(
    () => (releaseReport ? buildTrialReadinessActions(releaseReport, TRIAL_READINESS_LINT_STATUS, []) : []),
    [releaseReport],
  );
  const trialReadinessActions = useMemo(
    () => mergeGeneratedActionsWithReviewState(trialReadinessGeneratedActions, trialReadinessReviewState),
    [trialReadinessGeneratedActions, trialReadinessReviewState],
  );
  const trialReadinessReviewStateByActionId = useMemo(
    () => new Map(trialReadinessReviewState.map((entry) => [entry.actionId, entry])),
    [trialReadinessReviewState],
  );
  const openTrialReadinessActions = useMemo(
    () => trialReadinessActions.filter((action) => action.status !== 'done'),
    [trialReadinessActions],
  );
  const doneTrialReadinessActions = useMemo(
    () => trialReadinessActions.filter((action) => action.status === 'done'),
    [trialReadinessActions],
  );
  const liveBlockerCount = useMemo(
    () =>
      trialReadinessActions.filter(
        (action) => action.priority === 'blocker' && action.status !== 'done' && action.status !== 'accepted_risk',
      ).length,
    [trialReadinessActions],
  );
  const baseTrialDecisionSummary = useMemo<TrialReadinessSummaryV1 | null>(
    () => (releaseReport ? buildTrialReadinessSummary({ releaseGateReport: releaseReport, trialReadinessActions }) : null),
    [releaseReport, trialReadinessActions],
  );
  const baseLimitedTrialPlan = useMemo<LimitedTrialPlanV1 | null>(
    () =>
      releaseReport && baseTrialDecisionSummary
        ? buildLimitedTrialPlan({
            releaseGateReport: releaseReport,
            trialReadinessSummary: baseTrialDecisionSummary,
            trialReadinessActions,
            workspaceLifecycleScenarios: scenarios,
          })
        : null,
    [baseTrialDecisionSummary, releaseReport, scenarios, trialReadinessActions],
  );
  const trialFeedbackSummary = useMemo<TrialFeedbackSummaryV1 | null>(
    () => (baseLimitedTrialPlan ? buildTrialFeedbackSummary(feedbackEntries, baseLimitedTrialPlan) : null),
    [baseLimitedTrialPlan, feedbackEntries],
  );
  const trialDecisionSummary = useMemo<TrialReadinessSummaryV1 | null>(
    () =>
      releaseReport
        ? buildTrialReadinessSummary({
            releaseGateReport: releaseReport,
            trialReadinessActions,
            trialFeedbackSummary: trialFeedbackSummary ?? undefined,
          })
        : null,
    [releaseReport, trialFeedbackSummary, trialReadinessActions],
  );
  const limitedTrialPlan = useMemo<LimitedTrialPlanV1 | null>(
    () =>
      releaseReport && trialDecisionSummary
        ? buildLimitedTrialPlan({
            releaseGateReport: releaseReport,
            trialReadinessSummary: trialDecisionSummary,
            trialReadinessActions,
            workspaceLifecycleScenarios: scenarios,
            trialFeedbackSummary: trialFeedbackSummary ?? undefined,
          })
        : null,
    [releaseReport, scenarios, trialDecisionSummary, trialFeedbackSummary, trialReadinessActions],
  );
  const feedbackAffectsReadiness = useMemo(() => {
    if (feedbackEntries.length === 0 || trialFeedbackSummary === null) return false;
    if (!baseTrialDecisionSummary || !trialDecisionSummary || !baseLimitedTrialPlan || !limitedTrialPlan) return false;
    return (
      didSummaryChange(baseTrialDecisionSummary, trialDecisionSummary) ||
      didLimitedTrialPlanChange(baseLimitedTrialPlan, limitedTrialPlan)
    );
  }, [
    baseLimitedTrialPlan,
    baseTrialDecisionSummary,
    feedbackEntries.length,
    limitedTrialPlan,
    trialDecisionSummary,
    trialFeedbackSummary,
  ]);

  function handleTrialReadinessStatusChange(actionId: string, status: TrialReadinessStatusV1) {
    setTrialReadinessReviewState((current) =>
      updateTrialReadinessActionStatus(current, actionId, status, new Date().toISOString()),
    );
  }

  function handleTrialReadinessNoteChange(actionId: string, reviewerNote: string) {
    setTrialReadinessReviewState((current) =>
      addTrialReadinessActionNote(current, actionId, reviewerNote, new Date().toISOString()),
    );
  }

  function handleClearTrialReadinessReview() {
    void reviewStorageAdapter.clearReviewState().then(() => {
      reviewGeneratedAtRef.current = new Date().toISOString();
      setTrialReadinessReviewState([]);
    });
  }

  async function handleExportReviewStateJson() {
    // Persist the current state before exporting so the download reflects it.
    const snapshot: PersistedTrialReadinessReviewV1 = {
      schemaVersion: '1.0',
      generatedAt: reviewGeneratedAtRef.current,
      reviewState: trialReadinessReviewState,
      updatedAt: new Date().toISOString(),
    };
    await reviewStorageAdapter.saveReviewState(snapshot);
    const exportResult = await reviewStorageAdapter.exportReviewState();
    if (!exportResult.ok) return;
    const blob = new Blob([exportResult.json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'trial-readiness-review-state.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); // 1 s grace period for the browser to trigger the download
  }

  function handleImportReviewStateJson(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const json = reader.result as string;
      void reviewStorageAdapter.importReviewState(json).then((result) => {
        if (!result.ok) return;
        reviewGeneratedAtRef.current = result.snapshot.generatedAt;
        setTrialReadinessReviewState(result.snapshot.reviewState);
      });
    };
    // Reset the input before reading so the same file can be re-imported if
    // the user selects it again while the previous read is still in progress.
    event.target.value = '';
    reader.readAsText(file);
  }

  function handleExportTrialReadinessActions() {
    if (!releaseReport) return;
    const reviewPayload = trialReadinessGeneratedActions.map((action) => ({
      action,
      reviewState: trialReadinessReviewStateByActionId.get(action.actionId) ?? null,
    }));
    const blob = new Blob([JSON.stringify(reviewPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'trial-readiness-review.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleExportTrialReadinessPack() {
    if (!releaseReport) return;
    const pack = buildTrialReadinessPack({
      releaseGateReport: releaseReport,
      trialReadinessActions,
      trialReadinessReviewState,
      workspaceLifecycleScenarios: scenarios,
      trialFeedbackEntries: feedbackEntries,
    });
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'trial-readiness-pack.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleExportTrialDecisionSummary() {
    if (!trialDecisionSummary) return;
    const blob = new Blob([JSON.stringify(trialDecisionSummary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'trial-readiness-summary.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleExportLimitedTrialPlan() {
    if (!limitedTrialPlan) return;
    const blob = new Blob([JSON.stringify(limitedTrialPlan, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'limited-trial-plan.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleExportFeedbackJson() {
    const snapshot = buildTrialFeedbackSnapshot(feedbackEntries, feedbackSnapshot);
    await feedbackStorageAdapter.save(snapshot);
    const exportResult = await feedbackStorageAdapter.exportJson();
    if (!exportResult.ok) return;
    const blob = new Blob([exportResult.json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'trial-feedback.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleImportFeedbackJson(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const json = reader.result as string;
      void feedbackStorageAdapter.importJson(json).then((result) => {
        if (!result.ok) return;
        setFeedbackSnapshot(result.snapshot);
        setFeedbackEntries(result.snapshot.entries);
      });
    };
    event.target.value = '';
    reader.readAsText(file);
  }

  function handleClearFeedback() {
    void feedbackStorageAdapter.clear().then(() => {
      setFeedbackSnapshot(null);
      setFeedbackEntries([]);
      feedbackLoadedRef.current = true;
    });
  }

  const releaseReadinessRows: readonly [string, WorkspaceLifecycleReleaseStatusV1][] = releaseReport
    ? [
        ['customer portal', releaseReport.trialReadiness.customerPortal],
        ['implementation workflow', releaseReport.trialReadiness.implementationWorkflow],
        ['workspace ownership', releaseReport.trialReadiness.workspaceOwnership],
        ['storage export', releaseReport.trialReadiness.storageExport],
        ['scan follow-up', releaseReport.trialReadiness.scanFollowUp],
      ]
    : [];

  function renderTrialReadinessActionRow(action: TrialReadinessActionV1, doneRow: boolean) {
    return (
      <tr
        key={action.actionId}
        data-testid={
          doneRow
            ? `workspace-qa-trial-readiness-done-row-${action.actionId}`
            : `workspace-qa-trial-readiness-row-${action.actionId}`
        }
      >
        <td style={{ padding: '4px 8px', fontSize: 12 }} data-testid={`workspace-qa-trial-readiness-priority-${action.actionId}`}>
          {action.priority}
        </td>
        <td style={{ padding: '4px 8px', fontSize: 12 }}>{action.area.replace(/_/g, ' ')}</td>
        <td style={{ padding: '4px 8px', fontSize: 12 }}>{action.source.replace(/_/g, ' ')}</td>
        <td style={{ padding: '4px 8px', fontSize: 12 }}>
          <select
            value={action.status}
            onChange={(event) =>
              handleTrialReadinessStatusChange(action.actionId, event.target.value as TrialReadinessStatusV1)
            }
            style={{ fontFamily: 'monospace', fontSize: 12, padding: '2px 6px' }}
            data-testid={`workspace-qa-trial-readiness-status-${action.actionId}`}
          >
            {TRIAL_READINESS_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </td>
        <td style={{ padding: '4px 8px', fontSize: 12, color: '#475569' }}>
          <span>{action.title}</span>
          {action.status === 'accepted_risk' ? (
            <span
              style={{
                marginLeft: 8,
                display: 'inline-block',
                padding: '1px 8px',
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                background: '#fef3c7',
                color: '#92400e',
              }}
              data-testid={`workspace-qa-trial-readiness-accepted-risk-${action.actionId}`}
            >
              Accepted risk
            </span>
          ) : null}
        </td>
        <td style={{ padding: '4px 8px', fontSize: 12 }}>
          <input
            type="text"
            value={trialReadinessReviewStateByActionId.get(action.actionId)?.reviewerNote ?? ''}
            onChange={(event) => handleTrialReadinessNoteChange(action.actionId, event.target.value)}
            placeholder="Add reviewer note"
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, padding: '2px 6px' }}
            data-testid={`workspace-qa-trial-readiness-note-${action.actionId}`}
          />
        </td>
      </tr>
    );
  }

  if (!activeScenario) {
    return (
      <div style={{ padding: 24, fontFamily: 'monospace' }}>
        <strong>No workspace lifecycle QA scenarios found.</strong>
      </div>
    );
  }

  return (
    <div
      style={{ fontFamily: 'monospace', maxWidth: 1100, margin: '0 auto', padding: 24, display: 'grid', gap: 12 }}
      data-testid="workspace-visit-lifecycle-harness"
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{ fontSize: 12, padding: '4px 12px' }}
            data-testid="workspace-visit-lifecycle-harness-back"
          >
            ← Back
          </button>
        )}
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>Workspace Visit Lifecycle QA Harness</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 12 }}>
            Deterministic dev-only lifecycle verification for workspace-scoped visits.
          </p>
        </div>
      </header>

      <section style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
        <label htmlFor="workspace-qa-scenario" style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>
          Scenario
        </label>
        <select
          id="workspace-qa-scenario"
          value={activeScenario.id}
          onChange={(event) => setScenarioId(event.target.value as typeof activeScenario.id)}
          style={{ fontFamily: 'monospace', fontSize: 12, padding: '4px 8px', width: '100%' }}
          data-testid="workspace-visit-lifecycle-scenario-select"
        >
          {scenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.label}
            </option>
          ))}
        </select>
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Current state</h2>
        <div style={{ display: 'grid', gap: 4, fontSize: 12 }}>
          <div data-testid="workspace-qa-current-workspace">
            <strong>Current workspace:</strong> {activeScenario.session.workspaceName ?? 'none'}
            {activeScenario.session.workspaceId ? ` (${activeScenario.session.workspaceId})` : ''}
          </div>
          <div data-testid="workspace-qa-active-brand">
            <strong>Active brand:</strong> {activeScenario.session.activeBrandId} ({activeScenario.session.brandResolutionSource})
          </div>
          <div data-testid="workspace-qa-visit-ownership">
            <strong>Visit ownership:</strong> {activeScenario.visit.ownership ? `${activeScenario.visit.ownership.workspaceId} / ${activeScenario.visit.ownership.createdByUserId}` : 'unowned'}
          </div>
          <div data-testid="workspace-qa-storage-target">
            <strong>Storage target:</strong> {activeScenario.session.storageTarget}
          </div>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Lifecycle progression</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="workspace-qa-lifecycle-progression">
          <thead>
            <tr style={{ textAlign: 'left', fontSize: 11, color: '#64748b' }}>
              <th style={{ padding: '4px 8px' }}>Stage</th>
              <th style={{ padding: '4px 8px' }}>State</th>
              <th style={{ padding: '4px 8px' }}>Note</th>
            </tr>
          </thead>
          <tbody>
            {activeScenario.lifecycleProgression.map((entry) => (
              <LifecycleRow key={entry.stage} entry={entry} />
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Readiness progression</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="workspace-qa-readiness-progression">
          <thead>
            <tr style={{ textAlign: 'left', fontSize: 11, color: '#64748b' }}>
              <th style={{ padding: '4px 8px' }}>Gate</th>
              <th style={{ padding: '4px 8px' }}>State</th>
              <th style={{ padding: '4px 8px' }}>Note</th>
            </tr>
          </thead>
          <tbody>
            {activeScenario.readinessProgression.map((entry) => (
              <ReadinessRow key={entry.key} entry={entry} />
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }} data-testid="workspace-qa-export-package-status">
        <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Export package status</h2>
        {evaluation === null ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Evaluating export package…</p>
        ) : (
          <div style={{ display: 'grid', gap: 6, fontSize: 12 }}>
            <div><strong>Package built:</strong> <StatusPill ok={evaluation.exportPackageStatus.packageBuilt} /></div>
            <div><strong>Import round-trip:</strong> <StatusPill ok={evaluation.exportPackageStatus.importSucceeded} /></div>
            <div><strong>Ownership metadata:</strong> <StatusPill ok={evaluation.exportPackageStatus.includesOwnershipMetadata} /></div>
            <div><strong>Brand metadata:</strong> <StatusPill ok={evaluation.exportPackageStatus.includesBrandMetadata} /></div>
            <div><strong>Ownership preserved on import:</strong> <StatusPill ok={evaluation.exportPackageStatus.importPreservedOwnership} /></div>
            <div><strong>Brand preserved on import:</strong> <StatusPill ok={evaluation.exportPackageStatus.importPreservedBrand} /></div>
          </div>
        )}
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }} data-testid="workspace-qa-follow-up-resolution-state">
        <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Follow-up resolution state</h2>
        <div style={{ display: 'grid', gap: 4, fontSize: 12 }}>
          <div><strong>Handoff visit reference:</strong> {activeScenario.followUpResolutionState.handoffVisitReference}</div>
          <div><strong>Resolved tasks:</strong> {activeScenario.followUpResolutionState.resolvedTaskCount}</div>
          <div><strong>Unresolved tasks:</strong> {activeScenario.followUpResolutionState.unresolvedTaskCount}</div>
          <div><strong>Revisit reference:</strong> {activeScenario.followUpResolutionState.revisitVisitReference ?? '—'}</div>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }} data-testid="workspace-qa-validation-checks">
        <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Validation checks</h2>
        {evaluation === null ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Running validation checks…</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, fontSize: 12 }}>
            <li>visit has workspaceId <StatusPill ok={evaluation.checks.visitHasWorkspaceId} /></li>
            <li>visit has brandId <StatusPill ok={evaluation.checks.visitHasBrandId} /></li>
            <li>export contains ownership metadata <StatusPill ok={evaluation.checks.exportContainsOwnershipMetadata} /></li>
            <li>implementation workflow resolves correctly <StatusPill ok={evaluation.checks.implementationWorkflowResolvesCorrectly} /></li>
            <li>customer outputs use resolved brand <StatusPill ok={evaluation.checks.customerOutputsUseResolvedBrand} /></li>
            <li>follow-up handoff contains correct visit ownership <StatusPill ok={evaluation.checks.followUpHandoffContainsCorrectVisitOwnership} /></li>
          </ul>
        )}
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }} data-testid="workspace-qa-pass-fail-summary">
        <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>Pass / fail summary</h2>
        {evaluation === null ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Preparing summary…</p>
        ) : (
          <div style={{ display: 'grid', gap: 6, fontSize: 12 }}>
            <div><strong>ownership valid:</strong> <StatusPill ok={evaluation.summary.ownershipValid} /></div>
            <div><strong>branding valid:</strong> <StatusPill ok={evaluation.summary.brandingValid} /></div>
            <div><strong>storage valid:</strong> <StatusPill ok={evaluation.summary.storageValid} /></div>
            <div><strong>workflow valid:</strong> <StatusPill ok={evaluation.summary.workflowValid} /></div>
            <div><strong>export valid:</strong> <StatusPill ok={evaluation.summary.exportValid} /></div>
            <div data-testid="workspace-qa-lifecycle-passed">
              <strong>lifecycle passed:</strong>{' '}
              <StatusPill ok={evaluation.lifecyclePassed} passLabel="pass" failLabel="fail" />
            </div>
          </div>
        )}
      </section>

      <section
        style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, display: 'grid', gap: 12 }}
        data-testid="workspace-qa-release-gate-report"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 14 }}>Release Gate Report</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Trial-readiness summary for the full workspace lifecycle harness.</p>
          </div>
          <button
            type="button"
            onClick={handleExportReleaseGateReport}
            disabled={releaseReport === null}
            style={{ fontSize: 12, padding: '4px 12px' }}
            data-testid="workspace-qa-release-gate-export-json"
          >
            Export JSON
          </button>
        </div>

        {releaseReport === null ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Building release gate report…</p>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 4, fontSize: 12 }}>
              <div data-testid="workspace-qa-release-gate-overall-status">
                <strong>Overall status:</strong> <ReleaseStatusPill status={releaseReport.overallStatus} />
              </div>
              <div><strong>Generated:</strong> {releaseReport.generatedAt}</div>
            </div>

            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>Scenario results</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="workspace-qa-release-gate-scenarios">
                <thead>
                  <tr style={{ textAlign: 'left', fontSize: 11, color: '#64748b' }}>
                    <th style={{ padding: '4px 8px' }}>Scenario</th>
                    <th style={{ padding: '4px 8px' }}>Status</th>
                    <th style={{ padding: '4px 8px' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {releaseReport.scenarioResults.map((result) => (
                    <tr key={result.scenarioId}>
                      <td style={{ padding: '4px 8px', fontSize: 12 }}>{result.label}</td>
                      <td style={{ padding: '4px 8px', fontSize: 12 }}>
                        <ReleaseStatusPill status={result.status} />
                      </td>
                      <td style={{ padding: '4px 8px', fontSize: 12, color: '#475569' }}>
                        {[...result.blockingIssues, ...result.warnings].join(' ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>Trial readiness checklist</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="workspace-qa-release-gate-readiness">
                <thead>
                  <tr style={{ textAlign: 'left', fontSize: 11, color: '#64748b' }}>
                    <th style={{ padding: '4px 8px' }}>Capability</th>
                    <th style={{ padding: '4px 8px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {releaseReadinessRows.map(([label, status]) => (
                    <tr key={label}>
                      <td style={{ padding: '4px 8px', fontSize: 12 }}>{label}</td>
                      <td style={{ padding: '4px 8px', fontSize: 12 }}>
                        <ReleaseStatusPill status={status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>Blocking issues</h3>
                {releaseReport.blockingIssues.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>No blocking issues.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, fontSize: 12 }}>
                    {releaseReport.blockingIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>Warnings</h3>
                {releaseReport.warnings.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>No warnings.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, fontSize: 12 }}>
                    {releaseReport.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>Next actions</h3>
                {releaseReport.recommendedNextActions.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>No follow-up actions required.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, fontSize: 12 }}>
                    {releaseReport.recommendedNextActions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      <section
        style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, display: 'grid', gap: 12 }}
        data-testid="workspace-qa-trial-readiness-actions"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 14 }}>Trial Readiness Checklist</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
              Ordered hardening actions from release gate results and known trial gaps.
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#334155' }} data-testid="workspace-qa-trial-readiness-blocker-count">
              Live blockers open: {liveBlockerCount}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleExportTrialReadinessActions}
              disabled={releaseReport === null}
              style={{ fontSize: 12, padding: '4px 12px' }}
              data-testid="workspace-qa-trial-readiness-export-json"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={handleExportTrialReadinessPack}
              disabled={releaseReport === null}
              style={{ fontSize: 12, padding: '4px 12px' }}
              data-testid="workspace-qa-trial-readiness-export-pack"
            >
              Export trial readiness pack
            </button>
            <button
              type="button"
              onClick={() => void handleExportReviewStateJson()}
              disabled={trialReadinessReviewState.length === 0}
              style={{ fontSize: 12, padding: '4px 12px' }}
              data-testid="workspace-qa-trial-readiness-export-review-state"
            >
              Export review state
            </button>
            <label
              style={{ fontSize: 12, padding: '4px 12px', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: 4 }}
              data-testid="workspace-qa-trial-readiness-import-review-state-label"
            >
              Import review state
              <input
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={handleImportReviewStateJson}
                data-testid="workspace-qa-trial-readiness-import-review-state-input"
              />
            </label>
            <button
              type="button"
              onClick={handleClearTrialReadinessReview}
              disabled={trialReadinessReviewState.length === 0}
              style={{ fontSize: 12, padding: '4px 12px' }}
              data-testid="workspace-qa-trial-readiness-clear-review"
            >
              Clear review
            </button>
          </div>
        </div>

        {releaseReport === null ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Building trial readiness checklist…</p>
        ) : trialReadinessGeneratedActions.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>No trial readiness actions open.</p>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="workspace-qa-trial-readiness-table">
              <thead>
                <tr style={{ textAlign: 'left', fontSize: 11, color: '#64748b' }}>
                  <th style={{ padding: '4px 8px' }}>Priority</th>
                  <th style={{ padding: '4px 8px' }}>Area</th>
                  <th style={{ padding: '4px 8px' }}>Source</th>
                  <th style={{ padding: '4px 8px' }}>Status</th>
                  <th style={{ padding: '4px 8px' }}>Action</th>
                  <th style={{ padding: '4px 8px' }}>Reviewer note</th>
                </tr>
              </thead>
              <tbody>
                {openTrialReadinessActions.map((action: TrialReadinessActionV1) => renderTrialReadinessActionRow(action, false))}
              </tbody>
            </table>

            <details data-testid="workspace-qa-trial-readiness-done-section">
              <summary style={{ cursor: 'pointer', fontSize: 12, color: '#334155' }}>
                Done ({doneTrialReadinessActions.length})
              </summary>
              {doneTrialReadinessActions.length === 0 ? (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>No completed actions.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }} data-testid="workspace-qa-trial-readiness-done-table">
                  <thead>
                    <tr style={{ textAlign: 'left', fontSize: 11, color: '#64748b' }}>
                      <th style={{ padding: '4px 8px' }}>Priority</th>
                      <th style={{ padding: '4px 8px' }}>Area</th>
                      <th style={{ padding: '4px 8px' }}>Source</th>
                      <th style={{ padding: '4px 8px' }}>Status</th>
                      <th style={{ padding: '4px 8px' }}>Action</th>
                      <th style={{ padding: '4px 8px' }}>Reviewer note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doneTrialReadinessActions.map((action) => renderTrialReadinessActionRow(action, true))}
                  </tbody>
                </table>
              )}
            </details>
          </>
        )}
      </section>

      <section
        style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, display: 'grid', gap: 10 }}
        data-testid="workspace-qa-trial-decision-summary"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 14 }}>Trial decision summary</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
              Human-readable recommendation for whether to start a limited real-world tester cohort.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportTrialDecisionSummary}
            disabled={trialDecisionSummary === null}
            style={{ fontSize: 12, padding: '4px 12px' }}
            data-testid="workspace-qa-trial-readiness-export-summary"
          >
            Export JSON
          </button>
        </div>

        {trialDecisionSummary === null ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Building trial decision summary…</p>
        ) : (
          <div style={{ display: 'grid', gap: 8, fontSize: 12 }}>
            <div data-testid="workspace-qa-trial-decision-recommendation">
              <strong>Overall recommendation:</strong> {formatEnumLabel(trialDecisionSummary.overallRecommendation)}
            </div>
            <div data-testid="workspace-qa-trial-feedback-influence-note">
              <strong>Trial feedback currently affects readiness:</strong>{' '}
              {feedbackAffectsReadiness ? 'yes' : 'no'}
            </div>
            <div>
              <strong>Summary:</strong> {trialDecisionSummary.plainEnglishSummary}
            </div>
            <div>
              <strong>Blockers:</strong> {trialDecisionSummary.blockers.length}
            </div>
            <div>
              <strong>Accepted risks:</strong> {trialDecisionSummary.acceptedRisks.length}
            </div>
          </div>
        )}
      </section>

      <section
        style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, display: 'grid', gap: 10 }}
        data-testid="workspace-qa-limited-trial-plan"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 14 }}>Limited trial plan</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
              Controlled first-tester plan generated from trial readiness and scenario gates.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportLimitedTrialPlan}
            disabled={limitedTrialPlan === null}
            style={{ fontSize: 12, padding: '4px 12px' }}
            data-testid="workspace-qa-limited-trial-plan-export-json"
          >
            Export JSON
          </button>
        </div>

        {limitedTrialPlan === null ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Building limited trial plan…</p>
        ) : (
          <div style={{ display: 'grid', gap: 8, fontSize: 12 }}>
            <div data-testid="workspace-qa-limited-trial-plan-recommendation">
              <strong>Trial recommendation:</strong> {formatEnumLabel(limitedTrialPlan.trialRecommendation)}
            </div>
            <div data-testid="workspace-qa-limited-trial-plan-tester-count">
              <strong>Suggested tester count:</strong> {limitedTrialPlan.suggestedTesterCount}
            </div>
            <div>
              <strong>Eligible scenarios:</strong> {limitedTrialPlan.eligibleScenarios.length}
            </div>
            <div>
              <strong>Excluded scenarios:</strong> {limitedTrialPlan.excludedScenarios.length}
            </div>
            <div>
              <strong>Stop criteria:</strong> {limitedTrialPlan.stopCriteria.length}
            </div>
          </div>
        )}
      </section>

      <TrialFeedbackPanel
        entries={feedbackEntries}
        limitedTrialPlan={limitedTrialPlan}
        scenarios={scenarios}
        activeScenarioId={activeScenario.id}
        onEntriesChange={setFeedbackEntries}
        onExport={() => { void handleExportFeedbackJson(); }}
        onImport={handleImportFeedbackJson}
        onClear={handleClearFeedback}
      />
    </div>
  );
}
