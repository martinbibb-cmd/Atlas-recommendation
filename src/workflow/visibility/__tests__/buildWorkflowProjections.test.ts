import { describe, expect, it } from 'vitest';
import type { FollowUpEvidenceCaptureItemV1, SurveyFollowUpTaskV1 } from '../../../specification/followUps';
import type { OperationalDigestV1 } from '../../operationalDigest';
import type { ChecklistLineV1, ReadinessCheckV1 } from '../WorkflowVisibilityV1';
import {
  buildAuditWorkflowProjection,
  buildCustomerWorkflowProjection,
  buildInstallerWorkflowProjection,
  buildOfficeWorkflowProjection,
} from '../buildWorkflowProjections';

function makeFollowUpTasks(): SurveyFollowUpTaskV1[] {
  return [
    {
      taskId: 'follow_up_001',
      title: 'Confirm inhibitor dosing',
      description: 'Readiness blocker: Confirm inhibitor dosing before install.',
      source: 'readiness_blocker',
      priority: 'blocker',
      assignedRole: 'surveyor',
      relatedLineIds: [],
      relatedMaterialIds: [],
      relatedLocationIds: [],
      suggestedEvidenceType: 'note',
      visibility: ['installer_only'],
      resolved: false,
    },
    {
      taskId: 'follow_up_002',
      title: 'System water quality treatment may be required',
      description: 'Resolve unresolved check: system water quality treatment may be required.',
      source: 'unresolved_check',
      priority: 'important',
      assignedRole: 'surveyor',
      relatedLineIds: [],
      relatedMaterialIds: [],
      relatedLocationIds: [],
      suggestedEvidenceType: 'customer_confirmation',
      visibility: ['customer_summary'],
      resolved: false,
    },
    {
      taskId: 'follow_up_003',
      title: 'Confirm G3-qualified installer availability',
      description: 'Missing required qualification: G3 Unvented Hot Water Installer.',
      source: 'missing_qualification',
      priority: 'blocker',
      assignedRole: 'office',
      relatedLineIds: [],
      relatedMaterialIds: [],
      relatedLocationIds: [],
      suggestedEvidenceType: 'qualification_check',
      visibility: ['office_only', 'compliance_audit'],
      resolved: false,
    },
  ];
}

function makeReadinessChecks(): ReadinessCheckV1[] {
  return [
    {
      checkId: 'check_1',
      text: 'Confirm inhibitor dosing before install.',
      severity: 'blocker',
      visibility: ['installer_only'],
    },
    {
      checkId: 'check_2',
      text: 'Installer certification confirmed.',
      severity: 'info',
      visibility: ['customer_summary'],
    },
  ];
}

function makeEvidenceRequirements(): FollowUpEvidenceCaptureItemV1[] {
  return [
    {
      evidenceId: 'evidence_001',
      taskIds: ['follow_up_001'],
      evidenceType: 'note',
      prompt: 'Record inhibitor dosing notes.',
      required: true,
      acceptanceCriteria: ['Dosing plan is recorded.'],
      linkedLineIds: [],
      linkedMaterialIds: [],
      visibility: ['installer_only'],
    },
    {
      evidenceId: 'evidence_002',
      taskIds: ['follow_up_003'],
      evidenceType: 'qualification_check',
      prompt: 'Confirm installer qualification status (G3/MCS as applicable).',
      required: true,
      acceptanceCriteria: ['Qualification evidence is attached.'],
      linkedLineIds: [],
      linkedMaterialIds: [],
      visibility: ['office_only', 'compliance_audit'],
    },
  ];
}

function makeOperationalDigest(): OperationalDigestV1 {
  return {
    digestVersion: 'v1',
    generatedAt: '2026-05-14T00:00:00.000Z',
    primaryItemLimit: 12,
    totalItems: 3,
    items: [
      {
        id: 'intent_1',
        title: 'Confirm inhibitor dosing',
        summary: 'Confirm inhibitor dosing before install.',
        owner: 'surveyor',
        installPhase: 'installation',
        severity: 'blocker',
        linkedTaskIds: ['follow_up_001'],
        evidenceRequired: [
          {
            evidenceId: 'evidence_001',
            evidenceType: 'note',
            prompt: 'Record inhibitor dosing notes.',
            required: true,
            acceptanceCriteria: ['Dosing plan is recorded.'],
            linkedLineIds: [],
            linkedMaterialIds: [],
            visibility: ['installer_only'],
          },
        ],
        unresolvedDependencies: [],
        locationState: 'unresolved',
        visibility: ['installer_only'],
      },
      {
        id: 'intent_2',
        title: 'System water quality treatment may be required',
        summary: 'This may affect customer outcomes.',
        owner: 'surveyor',
        installPhase: 'survey',
        severity: 'important',
        linkedTaskIds: ['follow_up_002'],
        evidenceRequired: [],
        unresolvedDependencies: [],
        locationState: 'needs_survey',
        visibility: ['customer_summary'],
      },
      {
        id: 'intent_3',
        title: 'Confirm G3-qualified installer availability',
        summary: 'Qualification required before install.',
        owner: 'office',
        installPhase: 'coordination',
        severity: 'blocker',
        linkedTaskIds: ['follow_up_003'],
        evidenceRequired: [
          {
            evidenceId: 'evidence_002',
            evidenceType: 'qualification_check',
            prompt: 'Confirm installer qualification status (G3/MCS as applicable).',
            required: true,
            acceptanceCriteria: ['Qualification evidence is attached.'],
            linkedLineIds: [],
            linkedMaterialIds: [],
            visibility: ['office_only', 'compliance_audit'],
          },
        ],
        unresolvedDependencies: [],
        locationState: 'confirmed',
        visibility: ['office_only', 'compliance_audit'],
      },
    ],
  };
}

function makeChecklistLines(): ChecklistLineV1[] {
  return [
    {
      lineId: 'line_1',
      label: 'Confirm inhibitor dosing before install.',
      visibility: ['installer_only'],
    },
    {
      lineId: 'line_2',
      label: 'Installer certification confirmed.',
      visibility: ['customer_summary'],
    },
  ];
}

describe('buildWorkflowProjection audience filters', () => {
  const canonical = {
    followUpTasks: makeFollowUpTasks(),
    readinessChecks: makeReadinessChecks(),
    evidenceRequirements: makeEvidenceRequirements(),
    operationalDigest: makeOperationalDigest(),
    checklistLines: makeChecklistLines(),
  };

  it('customer projection excludes installer/internal mechanics and includes summary/action lines', () => {
    const projection = buildCustomerWorkflowProjection(canonical);
    expect(projection.followUpTasks.map((task) => task.taskId)).toEqual(['follow_up_002']);
    expect(projection.operationalDigest.items.map((item) => item.id)).toEqual(['intent_2']);
  });

  it('installer projection includes installer + customer lines but excludes office-only qualification records', () => {
    const projection = buildInstallerWorkflowProjection(canonical);
    expect(projection.followUpTasks.map((task) => task.taskId)).toEqual(['follow_up_001', 'follow_up_002']);
    expect(projection.followUpTasks.some((task) => task.taskId === 'follow_up_003')).toBe(false);
  });

  it('office projection includes installer and office policy lines', () => {
    const projection = buildOfficeWorkflowProjection(canonical);
    expect(projection.followUpTasks.map((task) => task.taskId)).toEqual([
      'follow_up_001',
      'follow_up_002',
      'follow_up_003',
    ]);
  });

  it('audit projection includes compliance-audit records', () => {
    const projection = buildAuditWorkflowProjection(canonical);
    expect(projection.operationalDigest.items.some((item) => item.id === 'intent_3')).toBe(true);
    expect(projection.evidenceRequirements.some((item) => item.evidenceId === 'evidence_002')).toBe(true);
  });
});
