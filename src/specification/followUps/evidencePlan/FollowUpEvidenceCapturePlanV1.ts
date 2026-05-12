import type { SurveyFollowUpTaskV1 } from '../SurveyFollowUpTaskV1';

export type FollowUpEvidenceCaptureType =
  | 'photo'
  | 'measurement'
  | 'scan_pin'
  | 'note'
  | 'qualification_check'
  | 'customer_confirmation';

export interface FollowUpEvidenceCaptureItemV1 {
  readonly evidenceId: string;
  readonly taskIds: readonly string[];
  readonly evidenceType: FollowUpEvidenceCaptureType;
  readonly prompt: string;
  readonly targetLocation?: string;
  readonly required: boolean;
  readonly acceptanceCriteria: readonly string[];
  readonly linkedLineIds: readonly string[];
  readonly linkedMaterialIds: readonly string[];
}

export interface FollowUpEvidenceCapturePlanV1 {
  readonly planId: string;
  readonly visitReference?: string;
  readonly tasks: readonly SurveyFollowUpTaskV1[];
  readonly requiredEvidence: readonly FollowUpEvidenceCaptureItemV1[];
  readonly optionalEvidence: readonly FollowUpEvidenceCaptureItemV1[];
  readonly unresolvedAfterCapture: readonly string[];
}
