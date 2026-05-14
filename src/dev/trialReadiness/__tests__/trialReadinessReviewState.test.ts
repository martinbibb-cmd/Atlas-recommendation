import { describe, expect, it } from 'vitest';
import type { TrialReadinessActionV1 } from '../TrialReadinessActionV1';
import {
  addTrialReadinessActionNote,
  mergeGeneratedActionsWithReviewState,
  updateTrialReadinessActionStatus,
} from '../trialReadinessReviewState';

const GENERATED_ACTIONS: readonly TrialReadinessActionV1[] = [
  {
    actionId: 'workspace-create-join-flow',
    title: 'verify workspace create/join flow',
    area: 'workspace',
    priority: 'high',
    source: 'manual_review',
    status: 'open',
  },
];

describe('trialReadinessReviewState', () => {
  it('updates status for a trial readiness action', () => {
    const updated = updateTrialReadinessActionStatus([], 'workspace-create-join-flow', 'in_progress', '2026-01-01T00:00:00Z');
    expect(updated).toEqual([
      {
        actionId: 'workspace-create-join-flow',
        status: 'in_progress',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ]);
  });

  it('adds reviewer note while preserving action status', () => {
    const withStatus = updateTrialReadinessActionStatus([], 'workspace-create-join-flow', 'accepted_risk', '2026-01-01T00:00:00Z');
    const withNote = addTrialReadinessActionNote(
      withStatus,
      'workspace-create-join-flow',
      'Accepted for pilot with fallback in place',
      '2026-01-01T00:01:00Z',
    );

    expect(withNote[0]?.status).toBe('accepted_risk');
    expect(withNote[0]?.reviewerNote).toBe('Accepted for pilot with fallback in place');
  });

  it('merges review state into generated actions', () => {
    const reviewState = updateTrialReadinessActionStatus([], 'workspace-create-join-flow', 'done', '2026-01-01T00:00:00Z');
    const merged = mergeGeneratedActionsWithReviewState(GENERATED_ACTIONS, reviewState);

    expect(merged[0]?.status).toBe('done');
    expect(merged[0]?.actionId).toBe('workspace-create-join-flow');
  });
});
