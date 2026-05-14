import { describe, expect, it } from 'vitest';
import type { FollowUpEvidenceCapturePlanV1, SurveyFollowUpTaskV1 } from '../../index';
import { buildFollowUpScanHandoff } from '../buildFollowUpScanHandoff';

function makeTask(overrides: Partial<SurveyFollowUpTaskV1>): SurveyFollowUpTaskV1 {
  return {
    taskId: 'follow_up_001',
    title: 'Confirm unresolved survey item',
    description: 'Readiness blocker: survey evidence required.',
    source: 'readiness_blocker',
    priority: 'important',
    assignedRole: 'surveyor',
    relatedLineIds: [],
    relatedMaterialIds: [],
    relatedLocationIds: [],
    suggestedEvidenceType: 'note',
    resolved: false,
    ...overrides,
  };
}

function makePlan(overrides: Partial<FollowUpEvidenceCapturePlanV1> = {}): FollowUpEvidenceCapturePlanV1 {
  const tasks: SurveyFollowUpTaskV1[] = overrides.tasks
    ? [...overrides.tasks]
    : [
        makeTask({
          taskId: 'follow_up_001',
          title: 'Confirm tundish/discharge route',
          priority: 'blocker',
          suggestedEvidenceType: 'photo',
        }),
        makeTask({
          taskId: 'follow_up_002',
          title: 'Confirm unknown plant/cylinder location',
          priority: 'important',
          source: 'unknown_location',
          suggestedEvidenceType: 'scan_pin',
        }),
        makeTask({
          taskId: 'follow_up_003',
          title: 'Confirm G3-qualified installer availability',
          priority: 'blocker',
          source: 'missing_qualification',
          assignedRole: 'office',
          suggestedEvidenceType: 'qualification_check',
        }),
      ];

  return {
    planId: 'follow_up_evidence_plan_v1_fixture',
    tasks,
    requiredEvidence: [
      {
        evidenceId: 'evidence_tundish',
        taskIds: ['follow_up_001'],
        evidenceType: 'photo',
        prompt: 'Take photos of the full discharge route including tundish.',
        targetLocation: 'Discharge route',
        required: true,
        acceptanceCriteria: ['Tundish is visible in at least one image.'],
        linkedLineIds: ['line_tundish'],
        linkedMaterialIds: [],
      },
      {
        evidenceId: 'evidence_unknown_location',
        taskIds: ['follow_up_002'],
        evidenceType: 'scan_pin',
        prompt: 'Drop an Atlas Scan pin at the confirmed on-site location.',
        targetLocation: 'Location to confirm on survey',
        required: true,
        acceptanceCriteria: ['Scan pin is placed at the exact install/check location.'],
        linkedLineIds: [],
        linkedMaterialIds: [],
      },
      {
        evidenceId: 'evidence_qualification',
        taskIds: ['follow_up_003'],
        evidenceType: 'qualification_check',
        prompt: 'Confirm installer qualification status (G3/MCS as applicable).',
        required: true,
        acceptanceCriteria: ['Qualification evidence is attached or verified against records.'],
        linkedLineIds: [],
        linkedMaterialIds: [],
      },
    ],
    optionalEvidence: [
      {
        evidenceId: 'evidence_optional_note',
        taskIds: ['follow_up_002'],
        evidenceType: 'note',
        prompt: 'Record survey note resolving plant location access constraints.',
        targetLocation: 'Location to confirm on survey',
        required: false,
        acceptanceCriteria: ['Survey note clearly resolves what remains unknown.'],
        linkedLineIds: [],
        linkedMaterialIds: [],
      },
    ],
    unresolvedAfterCapture: ['follow_up_003'],
    ...overrides,
  };
}

describe('buildFollowUpScanHandoff', () => {
  it('maps required tundish photo evidence into a capture item', () => {
    const handoff = buildFollowUpScanHandoff(makePlan());

    const captureItem = handoff.captureItems.find((item) => item.evidenceId === 'evidence_tundish');
    expect(captureItem).toMatchObject({
      captureMode: 'photo',
      priority: 'blocker',
      targetLocation: 'Discharge route',
      linkedTaskIds: ['follow_up_001'],
    });
  });

  it('keeps unknown-location scan pins as capture items', () => {
    const handoff = buildFollowUpScanHandoff(makePlan());

    expect(handoff.captureItems).toContainEqual(
      expect.objectContaining({
        evidenceId: 'evidence_unknown_location',
        captureMode: 'scan_pin',
        targetLocation: 'Location to confirm on survey',
      }),
    );
  });

  it('moves qualification checks into unresolved dependencies', () => {
    const handoff = buildFollowUpScanHandoff(makePlan());

    expect(handoff.captureItems.find((item) => item.evidenceId === 'evidence_qualification')).toBeUndefined();
    expect(handoff.unresolvedDependencies).toContainEqual(
      expect.objectContaining({
        evidenceId: 'evidence_qualification',
        dependencyType: 'qualification_check',
        linkedTaskIds: ['follow_up_003'],
      }),
    );
  });

  it('assigns stable ids and ordering for the same plan', () => {
    const plan = makePlan();
    const first = buildFollowUpScanHandoff(plan);
    const second = buildFollowUpScanHandoff(plan);

    expect(first.handoffId).toBe(second.handoffId);
    expect(first.captureItems.map((item) => item.captureItemId)).toEqual(
      second.captureItems.map((item) => item.captureItemId),
    );
    expect(first.captureItems.map((item) => item.evidenceId)).toEqual([
      'evidence_tundish',
      'evidence_unknown_location',
      'evidence_optional_note',
    ]);
    expect(first.unresolvedDependencies.map((item) => item.dependencyId)).toEqual(
      second.unresolvedDependencies.map((item) => item.dependencyId),
    );
  });
});
