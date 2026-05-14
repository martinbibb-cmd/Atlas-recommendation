import type {
  FollowUpEvidenceCaptureType,
  SurveyFollowUpTaskAssignedRole,
  SurveyFollowUpTaskPriority,
} from '../../specification/followUps';
import type { WorkflowVisibility } from '../visibility/WorkflowVisibilityV1';

export type OperationalDigestInstallPhaseV1 = 'survey' | 'coordination' | 'installation';

export type OperationalLocationStateV1 =
  | 'confirmed'
  | 'inferred'
  | 'needs_survey'
  | 'unresolved';

export interface EvidenceRequirementV1 {
  readonly evidenceId: string;
  readonly evidenceType: FollowUpEvidenceCaptureType;
  readonly prompt: string;
  readonly required: boolean;
  readonly targetLocation?: string;
  readonly acceptanceCriteria: readonly string[];
  readonly linkedLineIds: readonly string[];
  readonly linkedMaterialIds: readonly string[];
  readonly visibility: readonly WorkflowVisibility[];
}

export interface OperationalIntentGroupV1 {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly owner: SurveyFollowUpTaskAssignedRole;
  readonly installPhase: OperationalDigestInstallPhaseV1;
  readonly severity: SurveyFollowUpTaskPriority;
  readonly linkedTaskIds: readonly string[];
  readonly evidenceRequired: readonly EvidenceRequirementV1[];
  readonly unresolvedDependencies: readonly string[];
  readonly locationState: OperationalLocationStateV1;
  readonly visibility: readonly WorkflowVisibility[];
}

export interface OperationalDigestV1 {
  readonly digestVersion: 'v1';
  readonly generatedAt: string;
  readonly primaryItemLimit: number;
  readonly totalItems: number;
  readonly items: readonly OperationalIntentGroupV1[];
}
