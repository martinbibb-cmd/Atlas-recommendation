import { describe, expect, it } from 'vitest';
import type {
  FollowUpEvidenceCapturePlanV1,
  FollowUpScanHandoffV1,
  SurveyFollowUpTaskV1,
} from '../../../specification/followUps';
import type { EngineerJobPackV1 } from '../../../specification/handover';
import type { SpecificationReadinessV1 } from '../../../specification/readiness';
import { buildOperationalDigest } from '../buildOperationalDigest';

function makeEngineerJobPack(): EngineerJobPackV1 {
  return {
    jobPackVersion: 'v1',
    jobSummary: [],
    fitThis: [],
    removeThis: [],
    checkThis: [],
    discussWithCustomer: [],
    locationsAndRoutes: [
      {
        text: 'Check inhibitor dosing at plant location',
        confidence: 'needs_survey',
        location: {
          locationId: 'unknown:plant_location',
          label: 'Needs survey',
          type: 'unknown',
          confidence: 'needs_survey',
          evidenceRefs: [],
        },
      },
    ],
    commissioning: [],
    unresolvedBeforeInstall: [],
    doNotMiss: [],
    locationsToConfirm: [],
  };
}

describe('buildOperationalDigest', () => {
  it('merges duplicate operational intents and aggregates dependencies/evidence', () => {
    const tasks: SurveyFollowUpTaskV1[] = [
      {
        taskId: 'follow_up_001',
        title: 'Confirm inhibitor dosing',
        description: 'Readiness blocker: Confirm inhibitor dosing before install.',
        source: 'readiness_blocker',
        priority: 'blocker',
        assignedRole: 'surveyor',
        relatedLineIds: ['line_1'],
        relatedMaterialIds: ['material_1'],
        relatedLocationIds: ['unknown:plant_location'],
        suggestedEvidenceType: 'scan_pin',
        visibility: ['installer_only'],
        resolved: false,
      },
      {
        taskId: 'follow_up_002',
        title: 'Confirm inhibitor dosing',
        description: 'Resolve unresolved check: Confirm inhibitor dosing with customer notes.',
        source: 'unresolved_check',
        priority: 'important',
        assignedRole: 'surveyor',
        relatedLineIds: ['line_1'],
        relatedMaterialIds: [],
        relatedLocationIds: ['unknown:plant_location'],
        suggestedEvidenceType: 'customer_confirmation',
        visibility: ['customer_action_required'],
        resolved: false,
      },
    ];

    const readiness: SpecificationReadinessV1 = {
      readyForOfficeReview: false,
      readyForInstallerHandover: false,
      readyForMaterialsOrdering: false,
      blockingReasons: ['Confirm inhibitor dosing before install.'],
      warnings: [],
      unresolvedChecks: ['Confirm inhibitor dosing with customer notes.'],
      confidenceSummary: {
        specificationLines: { confirmed: 0, inferred: 0, needs_survey: 0, total: 0 },
        materialsSchedule: { confirmed: 0, inferred: 0, needs_survey: 0, total: 0 },
        engineerLocations: { confirmed: 0, inferred: 0, needs_survey: 0, unknown: 0, total: 0 },
      },
    };

    const evidencePlan: FollowUpEvidenceCapturePlanV1 = {
      planId: 'follow_up_evidence_plan_v1_x',
      tasks,
      requiredEvidence: [
        {
          evidenceId: 'evidence_001',
          taskIds: ['follow_up_001'],
          evidenceType: 'scan_pin',
          prompt: 'Drop an Atlas Scan pin at the confirmed on-site location.',
          targetLocation: 'Location to confirm on survey',
          required: true,
          acceptanceCriteria: ['Pin label clearly identifies what was located.'],
          linkedLineIds: ['line_1'],
          linkedMaterialIds: ['material_1'],
          visibility: ['installer_only'],
        },
      ],
      optionalEvidence: [],
      unresolvedAfterCapture: [],
    };

    const scanHandoff: FollowUpScanHandoffV1 = {
      handoffId: 'follow_up_scan_handoff_v1_x',
      sourcePlanId: evidencePlan.planId,
      createdAt: '2026-05-14T00:00:00.000Z',
      captureItems: [],
      unresolvedDependencies: [
        {
          dependencyId: 'dependency_001',
          evidenceId: 'evidence_dependency_001',
          prompt: 'Confirm customer consent for access and disruption windows.',
          dependencyType: 'customer_confirmation',
          linkedTaskIds: ['follow_up_002'],
          priority: 'important',
        },
      ],
    };

    const digest = buildOperationalDigest({
      tasks,
      readiness,
      evidencePlan,
      scanHandoff,
      engineerJobPack: makeEngineerJobPack(),
    });

    expect(digest.items).toHaveLength(1);
    const first = digest.items[0];
    expect(first.title).toBe('Confirm inhibitor dosing');
    expect(first.linkedTaskIds).toEqual(['follow_up_001', 'follow_up_002']);
    expect(first.evidenceRequired).toHaveLength(1);
    expect(first.unresolvedDependencies.some((entry) => /customer consent/i.test(entry))).toBe(true);
    expect(first.locationState).toBe('needs_survey');
  });
});
