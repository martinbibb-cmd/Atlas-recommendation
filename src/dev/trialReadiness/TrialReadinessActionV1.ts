export type TrialReadinessAreaV1 =
  | 'portal'
  | 'workspace'
  | 'storage'
  | 'implementation'
  | 'scan'
  | 'test_quality';

export type TrialReadinessPriorityV1 = 'blocker' | 'high' | 'medium' | 'low';

export type TrialReadinessSourceV1 = 'release_gate' | 'lint' | 'manual_review' | 'known_gap';

export type TrialReadinessStatusV1 = 'open' | 'in_progress' | 'done' | 'accepted_risk';

export interface TrialReadinessActionV1 {
  readonly actionId: string;
  readonly title: string;
  readonly area: TrialReadinessAreaV1;
  readonly priority: TrialReadinessPriorityV1;
  readonly source: TrialReadinessSourceV1;
  readonly status: TrialReadinessStatusV1;
}

export interface TrialReadinessLintStatusV1 {
  readonly hasFailures: boolean;
  readonly failureCount?: number;
}
