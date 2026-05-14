import { describe, expect, it } from 'vitest';
import type { EngineerJobPackV1 } from '../../../handover';
import type { SuggestedMaterialLineV1 } from '../../../materials';
import type { SpecificationLineV1 } from '../../../specLines';
import type { SurveyFollowUpTaskV1 } from '../../SurveyFollowUpTaskV1';
import { buildFollowUpEvidenceCapturePlan } from '../buildFollowUpEvidenceCapturePlan';

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
    visibility: ['installer_only'],
    resolved: false,
    ...overrides,
  };
}

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
        text: 'Confirm boiler location',
        confidence: 'needs_survey',
        location: {
          locationId: 'unknown:boiler_location',
          label: 'Needs survey',
          type: 'unknown',
          confidence: 'needs_survey',
          evidenceRefs: [],
        },
      },
      {
        text: 'Confirm discharge route',
        confidence: 'needs_survey',
        location: {
          locationId: 'discharge_route:discharge_route',
          label: 'Discharge route',
          type: 'discharge_route',
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

function makeSpecificationLines(): SpecificationLineV1[] {
  return [
    {
      lineId: 'line_tundish',
      sectionKey: 'safety_compliance',
      sourceRecommendationId: 'rec_1',
      label: 'Tundish discharge route',
      description: 'Confirm discharge route and termination.',
      lineType: 'required_validation',
      status: 'needs_check',
      confidence: 'needs_survey',
      reason: 'Requires on-site confirmation',
      customerVisible: false,
      engineerVisible: true,
      officeVisible: true,
      linkedRiskIds: [],
      linkedValidationIds: [],
    },
    {
      lineId: 'line_expansion',
      sectionKey: 'hot_water',
      sourceRecommendationId: 'rec_2',
      label: 'Expansion vessel sizing',
      description: 'Confirm expansion vessel sizing basis.',
      lineType: 'required_validation',
      status: 'needs_check',
      confidence: 'needs_survey',
      reason: 'Requires measurement',
      customerVisible: false,
      engineerVisible: true,
      officeVisible: true,
      linkedRiskIds: [],
      linkedValidationIds: [],
    },
  ];
}

function makeMaterials(): SuggestedMaterialLineV1[] {
  return [
    {
      materialId: 'material_expansion_vessel',
      sourceLineIds: ['line_expansion'],
      category: 'hot_water',
      label: 'Expansion vessel',
      confidence: 'needs_survey',
      requiredForInstall: true,
      customerVisible: false,
      engineerVisible: true,
      officeVisible: true,
      notes: [],
      unresolvedChecks: [],
    },
  ];
}

describe('buildFollowUpEvidenceCapturePlan', () => {
  it('tundish task produces photo evidence for discharge route', () => {
    const tasks: SurveyFollowUpTaskV1[] = [
      makeTask({
        taskId: 'follow_up_001',
        title: 'Confirm tundish/discharge route',
        description: 'Readiness blocker: confirm tundish and discharge route.',
        suggestedEvidenceType: 'photo',
        relatedLineIds: ['line_tundish'],
        relatedLocationIds: ['discharge_route:discharge_route'],
      }),
    ];

    const plan = buildFollowUpEvidenceCapturePlan(
      tasks,
      makeEngineerJobPack(),
      makeSpecificationLines(),
      makeMaterials(),
    );

    const evidence = plan.requiredEvidence.find((item) => item.taskIds.includes('follow_up_001'));
    expect(evidence?.evidenceType).toBe('photo');
    expect(evidence?.targetLocation).toBe('Discharge route');
  });

  it('expansion vessel task produces measurement and check evidence', () => {
    const tasks: SurveyFollowUpTaskV1[] = [
      makeTask({
        taskId: 'follow_up_002',
        title: 'Confirm expansion vessel sizing basis',
        description: 'Material requires survey confirmation: Expansion vessel',
        suggestedEvidenceType: 'measurement',
        relatedLineIds: ['line_expansion'],
        relatedMaterialIds: ['material_expansion_vessel'],
      }),
    ];

    const plan = buildFollowUpEvidenceCapturePlan(
      tasks,
      makeEngineerJobPack(),
      makeSpecificationLines(),
      makeMaterials(),
    );

    const measurement = plan.requiredEvidence.find(
      (item) => item.taskIds.includes('follow_up_002') && item.evidenceType === 'measurement',
    );
    const check = [...plan.requiredEvidence, ...plan.optionalEvidence].find(
      (item) => item.taskIds.includes('follow_up_002') && item.evidenceType === 'note',
    );

    expect(measurement).toBeDefined();
    expect(check).toBeDefined();
  });

  it('unknown location task produces scan pin and photo evidence', () => {
    const tasks: SurveyFollowUpTaskV1[] = [
      makeTask({
        taskId: 'follow_up_003',
        title: 'Confirm unknown plant/cylinder location',
        description: 'Location to confirm on survey.',
        source: 'unknown_location',
        suggestedEvidenceType: 'scan_pin',
        relatedLocationIds: ['unknown:boiler_location'],
      }),
    ];

    const plan = buildFollowUpEvidenceCapturePlan(
      tasks,
      makeEngineerJobPack(),
      makeSpecificationLines(),
      makeMaterials(),
    );

    const scanPin = plan.requiredEvidence.find(
      (item) => item.taskIds.includes('follow_up_003') && item.evidenceType === 'scan_pin',
    );
    const photo = plan.requiredEvidence.find(
      (item) => item.taskIds.includes('follow_up_003') && item.evidenceType === 'photo',
    );

    expect(scanPin).toBeDefined();
    expect(photo).toBeDefined();
  });

  it('qualification task produces qualification_check evidence', () => {
    const tasks: SurveyFollowUpTaskV1[] = [
      makeTask({
        taskId: 'follow_up_004',
        title: 'Confirm G3-qualified installer availability',
        description: 'Missing required qualification: G3 Unvented Hot Water Installer.',
        source: 'missing_qualification',
        assignedRole: 'office',
        suggestedEvidenceType: 'qualification_check',
      }),
    ];

    const plan = buildFollowUpEvidenceCapturePlan(
      tasks,
      makeEngineerJobPack(),
      makeSpecificationLines(),
      makeMaterials(),
    );

    const qualificationEvidence = plan.requiredEvidence.find(
      (item) => item.taskIds.includes('follow_up_004') && item.evidenceType === 'qualification_check',
    );

    expect(qualificationEvidence).toBeDefined();
    expect(plan.unresolvedAfterCapture).toContain('follow_up_004');
  });

  it('is deterministic for the same inputs', () => {
    const tasks: SurveyFollowUpTaskV1[] = [
      makeTask({
        taskId: 'follow_up_001',
        title: 'Confirm tundish/discharge route',
        description: 'Readiness blocker: confirm tundish and discharge route.',
        suggestedEvidenceType: 'photo',
        relatedLineIds: ['line_tundish'],
      }),
      makeTask({
        taskId: 'follow_up_002',
        title: 'Confirm expansion vessel sizing basis',
        description: 'Material requires survey confirmation: Expansion vessel',
        suggestedEvidenceType: 'measurement',
        relatedLineIds: ['line_expansion'],
        relatedMaterialIds: ['material_expansion_vessel'],
      }),
      makeTask({
        taskId: 'follow_up_003',
        title: 'Confirm unknown plant/cylinder location',
        description: 'Location to confirm on survey.',
        source: 'unknown_location',
        suggestedEvidenceType: 'scan_pin',
      }),
      makeTask({
        taskId: 'follow_up_004',
        title: 'Confirm G3-qualified installer availability',
        description: 'Missing required qualification: G3 Unvented Hot Water Installer.',
        source: 'missing_qualification',
        assignedRole: 'office',
        suggestedEvidenceType: 'qualification_check',
      }),
    ];

    const first = buildFollowUpEvidenceCapturePlan(
      tasks,
      makeEngineerJobPack(),
      makeSpecificationLines(),
      makeMaterials(),
    );
    const second = buildFollowUpEvidenceCapturePlan(
      tasks,
      makeEngineerJobPack(),
      makeSpecificationLines(),
      makeMaterials(),
    );

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
