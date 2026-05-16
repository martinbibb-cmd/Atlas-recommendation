import { DEFAULT_PERMISSIONS_BY_ROLE } from '../../auth/profile';
import type { WorkspaceMemberPermission, WorkspaceMemberRole } from '../../auth/profile';
import type { CardStatus } from './VisitHomeDashboard';

export type VisitHomeActionRole = WorkspaceMemberRole | 'customer-preview';

export type VisitHomeActionId =
  | 'review-survey'
  | 'customer-portal'
  | 'supporting-pdf'
  | 'run-simulator'
  | 'implementation-workflow'
  | 'resolve-follow-ups'
  | 'export-handover-package'
  | 'workspace-controls';

export interface VisitHomeActionProjectionItem {
  readonly actionId: VisitHomeActionId;
  readonly status: CardStatus;
  readonly reasonLabel?: string;
}

export interface VisitHomeActionProjection {
  readonly visibleActions: readonly VisitHomeActionProjectionItem[];
  readonly hiddenActions: readonly VisitHomeActionProjectionItem[];
  readonly blockedActions: readonly VisitHomeActionProjectionItem[];
}

export interface BuildVisitHomeActionProjectionInput {
  readonly workspaceRole?: VisitHomeActionRole;
  readonly workspacePermissions?: readonly WorkspaceMemberPermission[];
  readonly visitReadiness: {
    readonly hasVisit: boolean;
    readonly hasRecommendation: boolean;
    readonly hasAcceptedScenario: boolean;
    readonly hasSurveyModel: boolean;
  };
  readonly libraryProjectionSafety: {
    readonly unsafe: boolean;
    readonly reasons?: readonly string[];
  };
  readonly implementationReadiness: {
    readonly installationSpecOptionCount: number;
  };
  readonly availableOutputs: {
    readonly hasPortalUrl: boolean;
    readonly hasInsightPack: boolean;
    readonly hasSupportingPdf: boolean;
    readonly hasHandoffReview: boolean;
    readonly hasExportPackage: boolean;
  };
}

const BLOCK_REASON_LIBRARY_SAFETY = 'Library safety needs review';
const BLOCK_REASON_VISIT_MISSING = 'Visit data missing';
const BLOCK_REASON_RECOMMENDATION_MISSING = 'Recommendation not available';

const ALL_ACTION_IDS: readonly VisitHomeActionId[] = [
  'review-survey',
  'customer-portal',
  'supporting-pdf',
  'run-simulator',
  'implementation-workflow',
  'resolve-follow-ups',
  'export-handover-package',
  'workspace-controls',
];

const ROLE_ACTIONS: Readonly<Record<VisitHomeActionRole, readonly VisitHomeActionId[]>> = {
  owner: ALL_ACTION_IDS,
  admin: ALL_ACTION_IDS,
  surveyor: [
    'review-survey',
    'run-simulator',
    'resolve-follow-ups',
  ],
  office: [
    'review-survey',
    'supporting-pdf',
    'implementation-workflow',
    'export-handover-package',
  ],
  engineer: [
    'implementation-workflow',
    'resolve-follow-ups',
  ],
  viewer: [
    'customer-portal',
    'supporting-pdf',
    'run-simulator',
  ],
  'customer-preview': [
    'customer-portal',
    'supporting-pdf',
    'run-simulator',
  ],
};

const REQUIRED_PERMISSION_BY_ACTION: Readonly<
  Partial<Record<VisitHomeActionId, WorkspaceMemberPermission>>
> = {
  'review-survey': 'view_visits',
  'customer-portal': 'view_visits',
  'supporting-pdf': 'view_visits',
  'run-simulator': 'view_visits',
  'implementation-workflow': 'review_specification',
  'resolve-follow-ups': 'use_scan_handoff',
  'export-handover-package': 'export_workflows',
  'workspace-controls': 'manage_workspace',
};

function normaliseRole(role: VisitHomeActionRole | undefined): VisitHomeActionRole {
  return role ?? 'viewer';
}

function resolvePermissions(
  role: VisitHomeActionRole,
  permissions?: readonly WorkspaceMemberPermission[],
): readonly WorkspaceMemberPermission[] {
  if (permissions != null) return permissions;
  return role === 'customer-preview' ? DEFAULT_PERMISSIONS_BY_ROLE.viewer : DEFAULT_PERMISSIONS_BY_ROLE[role];
}

function buildStatusAndReason(
  actionId: VisitHomeActionId,
  input: BuildVisitHomeActionProjectionInput,
): { status: CardStatus; reasonLabel?: string } {
  const hasRecommendation = input.visitReadiness.hasRecommendation;
  const hasVisit = input.visitReadiness.hasVisit;
  const hasAcceptedScenario = input.visitReadiness.hasAcceptedScenario;
  const hasSurveyModel = input.visitReadiness.hasSurveyModel;
  const libraryUnsafe = input.libraryProjectionSafety.unsafe;

  switch (actionId) {
    case 'review-survey':
      if (!hasVisit) return { status: 'blocked', reasonLabel: BLOCK_REASON_VISIT_MISSING };
      if (!hasRecommendation && hasVisit) return { status: 'needs-review' };
      if (!hasRecommendation) return { status: 'blocked', reasonLabel: BLOCK_REASON_RECOMMENDATION_MISSING };
      return { status: 'ready' };
    case 'customer-portal':
      if (libraryUnsafe) return { status: 'blocked', reasonLabel: BLOCK_REASON_LIBRARY_SAFETY };
      if (!hasVisit) return { status: 'blocked', reasonLabel: BLOCK_REASON_VISIT_MISSING };
      if (!hasRecommendation) return { status: 'blocked', reasonLabel: BLOCK_REASON_RECOMMENDATION_MISSING };
      if (!input.availableOutputs.hasPortalUrl && !input.availableOutputs.hasInsightPack) return { status: 'needs-review' };
      return { status: 'ready' };
    case 'supporting-pdf':
      if (libraryUnsafe) return { status: 'blocked', reasonLabel: BLOCK_REASON_LIBRARY_SAFETY };
      if (!hasVisit) return { status: 'blocked', reasonLabel: BLOCK_REASON_VISIT_MISSING };
      if (!hasRecommendation) return { status: 'blocked', reasonLabel: BLOCK_REASON_RECOMMENDATION_MISSING };
      if (!input.availableOutputs.hasSupportingPdf) return { status: 'needs-review' };
      return { status: 'ready' };
    case 'run-simulator':
      if (!hasVisit) return { status: 'blocked', reasonLabel: BLOCK_REASON_VISIT_MISSING };
      if (!hasRecommendation) return { status: 'blocked', reasonLabel: BLOCK_REASON_RECOMMENDATION_MISSING };
      if (!hasAcceptedScenario || !hasSurveyModel) return { status: 'needs-review' };
      return { status: 'ready' };
    case 'implementation-workflow':
      if (!hasVisit) return { status: 'blocked', reasonLabel: BLOCK_REASON_VISIT_MISSING };
      if (!hasRecommendation) return { status: 'blocked', reasonLabel: BLOCK_REASON_RECOMMENDATION_MISSING };
      if (input.implementationReadiness.installationSpecOptionCount > 0) return { status: 'ready' };
      return { status: 'needs-review' };
    case 'resolve-follow-ups':
      if (!hasVisit) return { status: 'blocked', reasonLabel: BLOCK_REASON_VISIT_MISSING };
      if (!hasRecommendation) return { status: 'blocked', reasonLabel: BLOCK_REASON_RECOMMENDATION_MISSING };
      if (input.availableOutputs.hasHandoffReview) return { status: 'ready' };
      return { status: 'needs-review' };
    case 'export-handover-package':
      if (!hasVisit) return { status: 'blocked', reasonLabel: BLOCK_REASON_VISIT_MISSING };
      if (!hasRecommendation) return { status: 'blocked', reasonLabel: BLOCK_REASON_RECOMMENDATION_MISSING };
      return input.availableOutputs.hasExportPackage
        ? { status: 'ready' }
        : { status: 'needs-review' };
    case 'workspace-controls':
      return { status: 'ready' };
    default:
      return { status: 'blocked', reasonLabel: 'Action unavailable.' };
  }
}

export function buildVisitHomeActionProjection(
  input: BuildVisitHomeActionProjectionInput,
): VisitHomeActionProjection {
  const role = normaliseRole(input.workspaceRole);
  const permissions = new Set(resolvePermissions(role, input.workspacePermissions));
  const allowedByRole = new Set(ROLE_ACTIONS[role]);

  const visibleActions: VisitHomeActionProjectionItem[] = [];
  const hiddenActions: VisitHomeActionProjectionItem[] = [];
  const blockedActions: VisitHomeActionProjectionItem[] = [];

  for (const actionId of ALL_ACTION_IDS) {
    const roleAllowsAction = allowedByRole.has(actionId);
    const requiredPermission = REQUIRED_PERMISSION_BY_ACTION[actionId];
    const permissionAllowsAction =
      requiredPermission == null || permissions.has(requiredPermission);
    const statusAndReason = buildStatusAndReason(actionId, input);

    if (!roleAllowsAction) {
      hiddenActions.push({
        actionId,
        status: 'dev-only',
        reasonLabel: 'Not available for this role.',
      });
      continue;
    }

    if (!permissionAllowsAction) {
      const blocked = {
        actionId,
        status: 'blocked' as const,
        reasonLabel: 'Permission not granted for this workspace role.',
      };
      visibleActions.push(blocked);
      blockedActions.push(blocked);
      continue;
    }

    const projected = {
      actionId,
      status: statusAndReason.status,
      reasonLabel: statusAndReason.reasonLabel,
    };
    visibleActions.push(projected);
    if (projected.status === 'blocked') {
      blockedActions.push(projected);
    }
  }

  return {
    visibleActions,
    hiddenActions,
    blockedActions,
  };
}
