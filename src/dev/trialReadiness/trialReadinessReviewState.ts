import type { TrialReadinessActionV1, TrialReadinessStatusV1 } from './TrialReadinessActionV1';

export interface TrialReadinessActionReviewStateV1 {
  readonly actionId: string;
  readonly status: TrialReadinessStatusV1;
  readonly reviewerNote?: string;
  readonly updatedAt: string;
}

export function updateTrialReadinessActionStatus(
  reviewState: readonly TrialReadinessActionReviewStateV1[],
  actionId: string,
  status: TrialReadinessStatusV1,
  updatedAt: string,
): readonly TrialReadinessActionReviewStateV1[] {
  const existing = reviewState.find((entry) => entry.actionId === actionId);
  const nextEntry: TrialReadinessActionReviewStateV1 = {
    actionId,
    status,
    reviewerNote: existing?.reviewerNote,
    updatedAt,
  };

  if (!existing) {
    return [...reviewState, nextEntry];
  }

  return reviewState.map((entry) => (entry.actionId === actionId ? nextEntry : entry));
}

export function addTrialReadinessActionNote(
  reviewState: readonly TrialReadinessActionReviewStateV1[],
  actionId: string,
  reviewerNote: string,
  updatedAt: string,
): readonly TrialReadinessActionReviewStateV1[] {
  const existing = reviewState.find((entry) => entry.actionId === actionId);
  const normalizedNote = reviewerNote.trim();
  const nextEntry: TrialReadinessActionReviewStateV1 = {
    actionId,
    status: existing?.status ?? 'open',
    reviewerNote: normalizedNote.length === 0 ? undefined : reviewerNote,
    updatedAt,
  };

  if (!existing) {
    return [...reviewState, nextEntry];
  }

  return reviewState.map((entry) => (entry.actionId === actionId ? nextEntry : entry));
}

export function mergeGeneratedActionsWithReviewState(
  generatedActions: readonly TrialReadinessActionV1[],
  reviewState: readonly TrialReadinessActionReviewStateV1[],
): readonly TrialReadinessActionV1[] {
  if (reviewState.length === 0) return generatedActions;
  const reviewStateByActionId = new Map(reviewState.map((entry) => [entry.actionId, entry]));
  return generatedActions.map((action) => {
    const reviewEntry = reviewStateByActionId.get(action.actionId);
    if (!reviewEntry) return action;
    return {
      ...action,
      status: reviewEntry.status,
    };
  });
}
