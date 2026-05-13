import type { WorkspaceLifecycleReleaseReportV1 } from '../workspaceQa/buildWorkspaceLifecycleReleaseReport';
import type {
  TrialReadinessActionV1,
  TrialReadinessAreaV1,
  TrialReadinessLintStatusV1,
  TrialReadinessPriorityV1,
} from './TrialReadinessActionV1';

const PRIORITY_RANK: Record<TrialReadinessPriorityV1, number> = {
  blocker: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const SEEDED_BASE_ACTIONS: readonly TrialReadinessActionV1[] = [
  {
    actionId: 'portal-mobile-fixture-journey-review',
    title: 'visually review portal fixture journeys on mobile',
    area: 'portal',
    priority: 'medium',
    source: 'manual_review',
    status: 'open',
  },
  {
    actionId: 'workspace-create-join-flow',
    title: 'verify workspace create/join flow',
    area: 'workspace',
    priority: 'high',
    source: 'manual_review',
    status: 'open',
  },
  {
    actionId: 'storage-local-export-import-round-trip',
    title: 'verify local export/import round trip',
    area: 'storage',
    priority: 'high',
    source: 'manual_review',
    status: 'open',
  },
  {
    actionId: 'portal-supporting-pdf-print-output',
    title: 'verify supporting PDF print output',
    area: 'portal',
    priority: 'medium',
    source: 'manual_review',
    status: 'open',
  },
  {
    actionId: 'implementation-open-vented-and-heat-pump-fixtures',
    title: 'verify implementation workflow on open-vented and heat-pump fixtures',
    area: 'implementation',
    priority: 'high',
    source: 'manual_review',
    status: 'open',
  },
  {
    actionId: 'scan-handoff-payload-shape-ios',
    title: 'verify Scan handoff payload shape with iOS repo',
    area: 'scan',
    priority: 'high',
    source: 'manual_review',
    status: 'open',
  },
];

function inferAreaFromIssue(issue: string): TrialReadinessAreaV1 {
  const normalized = issue.toLowerCase();
  if (normalized.includes('scan') || normalized.includes('handoff')) return 'scan';
  if (normalized.includes('workspace')) return 'workspace';
  if (normalized.includes('storage') || normalized.includes('export') || normalized.includes('import')) return 'storage';
  if (normalized.includes('portal') || normalized.includes('brand') || normalized.includes('customer')) return 'portal';
  if (normalized.includes('lint') || normalized.includes('test')) return 'test_quality';
  return 'implementation';
}

function sortByPriority(actions: readonly TrialReadinessActionV1[]): TrialReadinessActionV1[] {
  return [...actions].sort((left, right) => {
    const rankDelta = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
    if (rankDelta !== 0) return rankDelta;
    return left.title.localeCompare(right.title);
  });
}

function withUniqueActionIds(actions: readonly TrialReadinessActionV1[]): TrialReadinessActionV1[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    if (seen.has(action.actionId)) return false;
    seen.add(action.actionId);
    return true;
  });
}

function includesGoogleDriveMissingWarning(releaseReport: WorkspaceLifecycleReleaseReportV1): boolean {
  return releaseReport.warnings.some((warning) => warning.toLowerCase().includes('google drive integration is not configured'));
}

export function buildTrialReadinessActions(
  releaseReport: WorkspaceLifecycleReleaseReportV1,
  lintStatus: TrialReadinessLintStatusV1,
  manualKnownGaps: readonly TrialReadinessActionV1[] = [],
): readonly TrialReadinessActionV1[] {
  const actions: TrialReadinessActionV1[] = [];

  actions.push(
    ...releaseReport.blockingIssues.map((issue, index) => ({
      actionId: `release-gate-blocker-${index + 1}`,
      title: issue,
      area: inferAreaFromIssue(issue),
      priority: 'blocker' as const,
      source: 'release_gate' as const,
      status: 'open' as const,
    })),
  );

  if (lintStatus.hasFailures) {
    const suffix = lintStatus.failureCount ? ` (${lintStatus.failureCount})` : '';
    actions.push({
      actionId: 'lint-clean-remaining-repo-wide-failures',
      title: `clean remaining repo-wide lint failures${suffix}`,
      area: 'test_quality',
      priority: 'high',
      source: 'lint',
      status: 'open',
    });
  }

  actions.push(...SEEDED_BASE_ACTIONS, ...manualKnownGaps);

  if (includesGoogleDriveMissingWarning(releaseReport)) {
    actions.push({
      actionId: 'storage-google-drive-known-gap',
      title: 'accept Google Drive integration gap for trial and use local-only export fallback',
      area: 'storage',
      priority: 'low',
      source: 'known_gap',
      status: 'accepted_risk',
    });
  }

  return sortByPriority(withUniqueActionIds(actions));
}
