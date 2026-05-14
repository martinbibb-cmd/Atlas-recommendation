import type { WorkflowVisibility } from '../../workflow/visibility/WorkflowVisibilityV1';

export type SurveyFollowUpTaskSource =
  | 'readiness_blocker'
  | 'unresolved_check'
  | 'material_needs_survey'
  | 'unknown_location'
  | 'missing_qualification';

export type SurveyFollowUpTaskPriority = 'blocker' | 'important' | 'optional';

export type SurveyFollowUpTaskAssignedRole = 'surveyor' | 'office' | 'engineer';

export type SurveyFollowUpTaskEvidenceType =
  | 'photo'
  | 'measurement'
  | 'note'
  | 'qualification_check'
  | 'customer_confirmation'
  | 'scan_pin';

export interface SurveyFollowUpTaskV1 {
  readonly taskId: string;
  readonly title: string;
  readonly description: string;
  readonly source: SurveyFollowUpTaskSource;
  readonly priority: SurveyFollowUpTaskPriority;
  readonly assignedRole: SurveyFollowUpTaskAssignedRole;
  readonly relatedSectionKey?: string;
  readonly relatedLineIds: readonly string[];
  readonly relatedMaterialIds: readonly string[];
  readonly relatedLocationIds: readonly string[];
  readonly suggestedEvidenceType: SurveyFollowUpTaskEvidenceType;
  readonly visibility: readonly WorkflowVisibility[];
  readonly resolved: boolean;
}
