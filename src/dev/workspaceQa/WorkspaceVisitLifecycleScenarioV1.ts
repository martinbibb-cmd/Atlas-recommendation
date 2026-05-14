import type { BrandResolutionSource, WorkspaceSessionStatus, AtlasVisitOwnershipV1 } from '../../auth/profile';
import type { PersistedImplementationWorkflowV1 } from '../../storage/workflow/PersistedImplementationWorkflowV1';
import { WORKFLOW_SCHEMA_VERSION } from '../../storage/workflow/PersistedImplementationWorkflowV1';
import type { WorkflowStorageTarget } from '../../storage/workflow/WorkflowStorageAdapterV1';
import { buildWorkflowExportPackage } from '../../storage/workflow/exportPackage/buildWorkflowExportPackage';
import { exportPackageAsJsonBlob, importPackageFromJsonBlob } from '../../storage/workflow/exportPackage/jsonBlob';
import type { WorkflowExportPackageV1 } from '../../storage/workflow/exportPackage/WorkflowExportPackageV1';

export const WORKSPACE_VISIT_LIFECYCLE_TIMELINE = [
  'Create',
  'Survey',
  'Recommend',
  'Present',
  'Export',
  'Implementation',
  'Follow-up',
  'Revisit',
] as const;

export type WorkspaceVisitLifecycleStage = (typeof WORKSPACE_VISIT_LIFECYCLE_TIMELINE)[number];
export type WorkspaceVisitLifecycleState = 'pending' | 'active' | 'done' | 'blocked';
export type ReadinessState = 'blocked' | 'ready' | 'complete';

export interface WorkspaceVisitLifecycleProgressEntryV1 {
  readonly stage: WorkspaceVisitLifecycleStage;
  readonly state: WorkspaceVisitLifecycleState;
  readonly note?: string;
}

export interface WorkspaceVisitReadinessProgressEntryV1 {
  readonly key: 'workspace' | 'survey' | 'recommendation' | 'export' | 'implementation' | 'follow_up' | 'revisit';
  readonly state: ReadinessState;
  readonly note: string;
}

export interface WorkspaceVisitFollowUpResolutionStateV1 {
  readonly handoffVisitReference: string;
  readonly unresolvedTaskCount: number;
  readonly resolvedTaskCount: number;
  readonly revisitVisitReference?: string;
  readonly revisitWorkspaceId?: string;
  readonly revisitBrandId?: string;
}

export interface WorkspaceVisitLifecycleScenarioV1 {
  readonly id:
    | 'new_demo_visit'
    | 'authenticated_no_workspace_blocked'
    | 'workspace_owned_visit'
    | 'open_vented_conversion'
    | 'heat_pump_path'
    | 'revisit_follow_up_path'
    | 'export_import_path';
  readonly label: string;
  readonly session: {
    readonly status: WorkspaceSessionStatus;
    readonly workspaceId?: string;
    readonly workspaceName?: string;
    readonly atlasUserId?: string;
    readonly activeBrandId: string;
    readonly brandResolutionSource: BrandResolutionSource;
    readonly storageTarget: WorkflowStorageTarget;
  };
  readonly visit: {
    readonly visitReference: string;
    readonly workspaceId?: string;
    readonly brandId?: string;
    readonly ownership?: AtlasVisitOwnershipV1;
  };
  readonly lifecycleProgression: readonly WorkspaceVisitLifecycleProgressEntryV1[];
  readonly readinessProgression: readonly WorkspaceVisitReadinessProgressEntryV1[];
  readonly customerOutputBrandId: string;
  readonly followUpResolutionState: WorkspaceVisitFollowUpResolutionStateV1;
  readonly workflowState: PersistedImplementationWorkflowV1;
}

export interface WorkspaceVisitExportPackageStatusV1 {
  readonly packageBuilt: boolean;
  readonly importSucceeded: boolean;
  readonly includesOwnershipMetadata: boolean;
  readonly includesBrandMetadata: boolean;
  readonly importPreservedOwnership: boolean;
  readonly importPreservedBrand: boolean;
}

export interface WorkspaceVisitLifecycleValidationChecksV1 {
  readonly visitHasWorkspaceId: boolean;
  readonly visitHasBrandId: boolean;
  readonly exportContainsOwnershipMetadata: boolean;
  readonly implementationWorkflowResolvesCorrectly: boolean;
  readonly customerOutputsUseResolvedBrand: boolean;
  readonly followUpHandoffContainsCorrectVisitOwnership: boolean;
}

export interface WorkspaceVisitLifecycleSummaryV1 {
  readonly ownershipValid: boolean;
  readonly brandingValid: boolean;
  readonly storageValid: boolean;
  readonly workflowValid: boolean;
  readonly exportValid: boolean;
}

export interface WorkspaceVisitLifecycleEvaluationV1 {
  readonly checks: WorkspaceVisitLifecycleValidationChecksV1;
  readonly summary: WorkspaceVisitLifecycleSummaryV1;
  readonly exportPackageStatus: WorkspaceVisitExportPackageStatusV1;
  readonly lifecyclePassed: boolean;
}

const BASE_CREATED_AT = '2026-05-13T10:00:00.000Z';
const BASE_UPDATED_AT = '2026-05-13T10:10:00.000Z';

function makeOwnership(
  visitReference: string,
  workspaceId: string,
  atlasUserId: string,
  storageTarget: WorkflowStorageTarget,
): AtlasVisitOwnershipV1 {
  return {
    visitReference,
    workspaceId,
    createdByUserId: atlasUserId,
    visibleToRoles: ['owner', 'admin', 'surveyor'],
    storageTarget,
  };
}

function makeWorkflowState(
  visitReference: string,
  ownership: AtlasVisitOwnershipV1 | undefined,
): PersistedImplementationWorkflowV1 {
  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    visitReference,
    createdAt: BASE_CREATED_AT,
    updatedAt: BASE_UPDATED_AT,
    packSnapshot: {
      recommendedScenarioId: 'system_unvented_cylinder',
      fixtureId: 'workspace_qa_fixture',
    },
    resolutionSimulation: {
      resolvedTaskIds: ['task-1'],
      capturedEvidenceIds: ['evidence-1'],
      resolvedDependencyIds: ['dependency-1'],
      changeLog: [],
    },
    scopePackStatuses: { 'scope-1': 'accepted' },
    specLineStatuses: { 'line-1': 'accepted' },
    materialsReviewState: {
      confirmedIds: ['material-1'],
      rejectedIds: [],
      flaggedIds: [],
    },
    ...(ownership !== undefined ? { ownership } : {}),
  };
}

function makeLifecycleProgression(
  doneUntil: WorkspaceVisitLifecycleStage,
  overrides: Partial<Record<WorkspaceVisitLifecycleStage, WorkspaceVisitLifecycleProgressEntryV1>> = {},
): readonly WorkspaceVisitLifecycleProgressEntryV1[] {
  const doneIndex = WORKSPACE_VISIT_LIFECYCLE_TIMELINE.indexOf(doneUntil);
  return WORKSPACE_VISIT_LIFECYCLE_TIMELINE.map((stage, index) => {
    const existing = overrides[stage];
    if (existing) return existing;
    if (index < doneIndex) return { stage, state: 'done' };
    if (index === doneIndex) return { stage, state: 'active' };
    return { stage, state: 'pending' };
  });
}

const VISIT_REFERENCE = {
  demo: 'visit:workspace-qa-demo-001',
  blocked: 'visit:workspace-qa-blocked-001',
  owned: 'visit:workspace-qa-owned-001',
  openVented: 'visit:workspace-qa-open-vented-001',
  heatPump: 'visit:workspace-qa-heat-pump-001',
  revisit: 'visit:workspace-qa-revisit-001',
  exportImport: 'visit:workspace-qa-export-import-001',
} as const;

const OWNERSHIP_OWNED = makeOwnership(VISIT_REFERENCE.owned, 'workspace_alpha', 'atlas_user_alpha', 'local_only');
const OWNERSHIP_OPEN_VENTED = makeOwnership(VISIT_REFERENCE.openVented, 'workspace_alpha', 'atlas_user_alpha', 'local_only');
const OWNERSHIP_HEAT_PUMP = makeOwnership(VISIT_REFERENCE.heatPump, 'workspace_alpha', 'atlas_user_alpha', 'local_only');
const OWNERSHIP_REVISIT = makeOwnership(VISIT_REFERENCE.revisit, 'workspace_alpha', 'atlas_user_alpha', 'local_only');
const OWNERSHIP_EXPORT = makeOwnership(VISIT_REFERENCE.exportImport, 'workspace_alpha', 'atlas_user_alpha', 'local_only');

export const WORKSPACE_VISIT_LIFECYCLE_SCENARIOS_V1: readonly WorkspaceVisitLifecycleScenarioV1[] = [
  {
    id: 'new_demo_visit',
    label: 'New demo visit',
    session: {
      status: 'unauthenticated_demo',
      activeBrandId: 'atlas-default',
      brandResolutionSource: 'atlas_default',
      storageTarget: 'disabled',
    },
    visit: {
      visitReference: VISIT_REFERENCE.demo,
      brandId: 'atlas-default',
    },
    lifecycleProgression: makeLifecycleProgression('Survey'),
    readinessProgression: [
      { key: 'workspace', state: 'blocked', note: 'No authenticated workspace session.' },
      { key: 'survey', state: 'ready', note: 'Survey can continue in demo mode.' },
      { key: 'recommendation', state: 'ready', note: 'Recommendation can be previewed in demo mode.' },
      { key: 'export', state: 'blocked', note: 'Export disabled for unowned demo visit.' },
      { key: 'implementation', state: 'blocked', note: 'Implementation workflow not persisted in demo mode.' },
      { key: 'follow_up', state: 'blocked', note: 'Follow-up handoff requires workspace ownership.' },
      { key: 'revisit', state: 'blocked', note: 'Revisit requires an owned visit identity.' },
    ],
    customerOutputBrandId: 'atlas-default',
    followUpResolutionState: {
      handoffVisitReference: VISIT_REFERENCE.demo,
      unresolvedTaskCount: 0,
      resolvedTaskCount: 0,
    },
    workflowState: makeWorkflowState(VISIT_REFERENCE.demo, undefined),
  },
  {
    id: 'authenticated_no_workspace_blocked',
    label: 'Authenticated / no workspace blocked',
    session: {
      status: 'authenticated_no_workspace',
      atlasUserId: 'atlas_user_beta',
      activeBrandId: 'atlas-default',
      brandResolutionSource: 'atlas_default',
      storageTarget: 'disabled',
    },
    visit: {
      visitReference: VISIT_REFERENCE.blocked,
      brandId: 'atlas-default',
    },
    lifecycleProgression: makeLifecycleProgression('Create', {
      Survey: { stage: 'Survey', state: 'blocked', note: 'Workspace selection required before survey lifecycle begins.' },
      Recommend: { stage: 'Recommend', state: 'blocked', note: 'Cannot recommend without workspace ownership context.' },
      Present: { stage: 'Present', state: 'blocked', note: 'Presentation blocked until workspace assignment.' },
      Export: { stage: 'Export', state: 'blocked', note: 'Export package blocked without ownership metadata.' },
      Implementation: { stage: 'Implementation', state: 'blocked', note: 'Implementation blocked without workspace.' },
      'Follow-up': { stage: 'Follow-up', state: 'blocked', note: 'Follow-up blocked without owned visit.' },
      Revisit: { stage: 'Revisit', state: 'blocked', note: 'Revisit blocked without owned visit identity.' },
    }),
    readinessProgression: [
      { key: 'workspace', state: 'blocked', note: 'User is authenticated but has no active workspace.' },
      { key: 'survey', state: 'blocked', note: 'Survey blocked pending workspace assignment.' },
      { key: 'recommendation', state: 'blocked', note: 'Recommendation blocked until workspace gate passes.' },
      { key: 'export', state: 'blocked', note: 'Ownership metadata cannot be generated.' },
      { key: 'implementation', state: 'blocked', note: 'Workflow cannot resolve without ownership metadata.' },
      { key: 'follow_up', state: 'blocked', note: 'Follow-up handoff disabled without ownership.' },
      { key: 'revisit', state: 'blocked', note: 'Revisit disabled without ownership.' },
    ],
    customerOutputBrandId: 'atlas-default',
    followUpResolutionState: {
      handoffVisitReference: VISIT_REFERENCE.blocked,
      unresolvedTaskCount: 0,
      resolvedTaskCount: 0,
    },
    workflowState: makeWorkflowState(VISIT_REFERENCE.blocked, undefined),
  },
  {
    id: 'workspace_owned_visit',
    label: 'Workspace-owned visit',
    session: {
      status: 'workspace_active',
      workspaceId: 'workspace_alpha',
      workspaceName: 'Workspace Alpha',
      atlasUserId: 'atlas_user_alpha',
      activeBrandId: 'alpha_brand',
      brandResolutionSource: 'workspace_default',
      storageTarget: 'local_only',
    },
    visit: {
      visitReference: VISIT_REFERENCE.owned,
      workspaceId: 'workspace_alpha',
      brandId: 'alpha_brand',
      ownership: OWNERSHIP_OWNED,
    },
    lifecycleProgression: makeLifecycleProgression('Implementation', {
      Create: { stage: 'Create', state: 'done' },
      Survey: { stage: 'Survey', state: 'done' },
      Recommend: { stage: 'Recommend', state: 'done' },
      Present: { stage: 'Present', state: 'done' },
      Export: { stage: 'Export', state: 'done' },
      Implementation: { stage: 'Implementation', state: 'active', note: 'Implementation workflow resolving with workspace ownership.' },
    }),
    readinessProgression: [
      { key: 'workspace', state: 'complete', note: 'Workspace ownership resolved.' },
      { key: 'survey', state: 'complete', note: 'Survey complete.' },
      { key: 'recommendation', state: 'complete', note: 'Recommendation accepted.' },
      { key: 'export', state: 'ready', note: 'Export package can include ownership + brand metadata.' },
      { key: 'implementation', state: 'ready', note: 'Implementation workflow resolved and actionable.' },
      { key: 'follow_up', state: 'ready', note: 'Follow-up handoff linked to visit identity.' },
      { key: 'revisit', state: 'ready', note: 'Revisit route can be created from same ownership context.' },
    ],
    customerOutputBrandId: 'alpha_brand',
    followUpResolutionState: {
      handoffVisitReference: VISIT_REFERENCE.owned,
      unresolvedTaskCount: 1,
      resolvedTaskCount: 3,
    },
    workflowState: makeWorkflowState(VISIT_REFERENCE.owned, OWNERSHIP_OWNED),
  },
  {
    id: 'open_vented_conversion',
    label: 'Open-vented conversion',
    session: {
      status: 'workspace_active',
      workspaceId: 'workspace_alpha',
      workspaceName: 'Workspace Alpha',
      atlasUserId: 'atlas_user_alpha',
      activeBrandId: 'alpha_brand',
      brandResolutionSource: 'workspace_default',
      storageTarget: 'local_only',
    },
    visit: {
      visitReference: VISIT_REFERENCE.openVented,
      workspaceId: 'workspace_alpha',
      brandId: 'alpha_brand',
      ownership: OWNERSHIP_OPEN_VENTED,
    },
    lifecycleProgression: makeLifecycleProgression('Follow-up', {
      'Follow-up': { stage: 'Follow-up', state: 'active', note: 'Open-vented conversion follow-up checks in progress.' },
    }),
    readinessProgression: [
      { key: 'workspace', state: 'complete', note: 'Workspace ownership resolved.' },
      { key: 'survey', state: 'complete', note: 'Open-vented baseline captured.' },
      { key: 'recommendation', state: 'complete', note: 'Conversion recommendation issued.' },
      { key: 'export', state: 'complete', note: 'Export generated with ownership + brand context.' },
      { key: 'implementation', state: 'complete', note: 'Implementation handoff sent.' },
      { key: 'follow_up', state: 'ready', note: 'Follow-up actions pending final evidence.' },
      { key: 'revisit', state: 'ready', note: 'Revisit can be scheduled if conversion evidence changes.' },
    ],
    customerOutputBrandId: 'alpha_brand',
    followUpResolutionState: {
      handoffVisitReference: VISIT_REFERENCE.openVented,
      unresolvedTaskCount: 2,
      resolvedTaskCount: 5,
    },
    workflowState: makeWorkflowState(VISIT_REFERENCE.openVented, OWNERSHIP_OPEN_VENTED),
  },
  {
    id: 'heat_pump_path',
    label: 'Heat pump path',
    session: {
      status: 'workspace_active',
      workspaceId: 'workspace_alpha',
      workspaceName: 'Workspace Alpha',
      atlasUserId: 'atlas_user_alpha',
      activeBrandId: 'alpha_brand',
      brandResolutionSource: 'workspace_default',
      storageTarget: 'local_only',
    },
    visit: {
      visitReference: VISIT_REFERENCE.heatPump,
      workspaceId: 'workspace_alpha',
      brandId: 'alpha_brand',
      ownership: OWNERSHIP_HEAT_PUMP,
    },
    lifecycleProgression: makeLifecycleProgression('Implementation', {
      Implementation: { stage: 'Implementation', state: 'active', note: 'Heat pump implementation workflow in progress.' },
    }),
    readinessProgression: [
      { key: 'workspace', state: 'complete', note: 'Workspace ownership resolved.' },
      { key: 'survey', state: 'complete', note: 'Heat pump suitability survey complete.' },
      { key: 'recommendation', state: 'complete', note: 'Heat pump recommendation approved.' },
      { key: 'export', state: 'complete', note: 'Export package created for installer handoff.' },
      { key: 'implementation', state: 'ready', note: 'Implementation ready with ownership metadata.' },
      { key: 'follow_up', state: 'ready', note: 'Follow-up tasks linked to visit identity.' },
      { key: 'revisit', state: 'ready', note: 'Revisit route available for post-install optimization.' },
    ],
    customerOutputBrandId: 'alpha_brand',
    followUpResolutionState: {
      handoffVisitReference: VISIT_REFERENCE.heatPump,
      unresolvedTaskCount: 1,
      resolvedTaskCount: 4,
    },
    workflowState: makeWorkflowState(VISIT_REFERENCE.heatPump, OWNERSHIP_HEAT_PUMP),
  },
  {
    id: 'revisit_follow_up_path',
    label: 'Revisit / follow-up path',
    session: {
      status: 'workspace_active',
      workspaceId: 'workspace_alpha',
      workspaceName: 'Workspace Alpha',
      atlasUserId: 'atlas_user_alpha',
      activeBrandId: 'alpha_brand',
      brandResolutionSource: 'workspace_default',
      storageTarget: 'local_only',
    },
    visit: {
      visitReference: VISIT_REFERENCE.revisit,
      workspaceId: 'workspace_alpha',
      brandId: 'alpha_brand',
      ownership: OWNERSHIP_REVISIT,
    },
    lifecycleProgression: makeLifecycleProgression('Revisit', {
      Revisit: { stage: 'Revisit', state: 'active', note: 'Revisit opened from follow-up handoff.' },
    }),
    readinessProgression: [
      { key: 'workspace', state: 'complete', note: 'Workspace ownership intact across revisit.' },
      { key: 'survey', state: 'complete', note: 'Initial survey completed.' },
      { key: 'recommendation', state: 'complete', note: 'Recommendation completed.' },
      { key: 'export', state: 'complete', note: 'Export completed and re-imported.' },
      { key: 'implementation', state: 'complete', note: 'Implementation workflow completed.' },
      { key: 'follow_up', state: 'complete', note: 'Follow-up tasks resolved.' },
      { key: 'revisit', state: 'ready', note: 'Revisit keeps the same workspace and brand ownership.' },
    ],
    customerOutputBrandId: 'alpha_brand',
    followUpResolutionState: {
      handoffVisitReference: VISIT_REFERENCE.revisit,
      unresolvedTaskCount: 0,
      resolvedTaskCount: 6,
      revisitVisitReference: VISIT_REFERENCE.revisit,
      revisitWorkspaceId: 'workspace_alpha',
      revisitBrandId: 'alpha_brand',
    },
    workflowState: makeWorkflowState(VISIT_REFERENCE.revisit, OWNERSHIP_REVISIT),
  },
  {
    id: 'export_import_path',
    label: 'Export / import path',
    session: {
      status: 'workspace_active',
      workspaceId: 'workspace_alpha',
      workspaceName: 'Workspace Alpha',
      atlasUserId: 'atlas_user_alpha',
      activeBrandId: 'alpha_brand',
      brandResolutionSource: 'workspace_default',
      storageTarget: 'local_only',
    },
    visit: {
      visitReference: VISIT_REFERENCE.exportImport,
      workspaceId: 'workspace_alpha',
      brandId: 'alpha_brand',
      ownership: OWNERSHIP_EXPORT,
    },
    lifecycleProgression: makeLifecycleProgression('Export', {
      Export: { stage: 'Export', state: 'active', note: 'Export package generated and validated via import round-trip.' },
      Implementation: { stage: 'Implementation', state: 'pending' },
      'Follow-up': { stage: 'Follow-up', state: 'pending' },
      Revisit: { stage: 'Revisit', state: 'pending' },
    }),
    readinessProgression: [
      { key: 'workspace', state: 'complete', note: 'Workspace ownership resolved.' },
      { key: 'survey', state: 'complete', note: 'Survey complete.' },
      { key: 'recommendation', state: 'complete', note: 'Recommendation complete.' },
      { key: 'export', state: 'ready', note: 'Export package undergoing ownership/brand metadata checks.' },
      { key: 'implementation', state: 'ready', note: 'Implementation awaits import confirmation.' },
      { key: 'follow_up', state: 'ready', note: 'Follow-up linkage prepared.' },
      { key: 'revisit', state: 'ready', note: 'Revisit can open from imported package identity.' },
    ],
    customerOutputBrandId: 'alpha_brand',
    followUpResolutionState: {
      handoffVisitReference: VISIT_REFERENCE.exportImport,
      unresolvedTaskCount: 2,
      resolvedTaskCount: 2,
    },
    workflowState: makeWorkflowState(VISIT_REFERENCE.exportImport, OWNERSHIP_EXPORT),
  },
];

function toExportPackage(
  scenario: WorkspaceVisitLifecycleScenarioV1,
): WorkflowExportPackageV1 {
  return buildWorkflowExportPackage({
    payload: {
      workflowState: scenario.workflowState,
      implementationPack: { packVersion: 'v1', recommendedScenarioId: 'system_unvented_cylinder' } as never,
      specificationLines: [{ lineId: 'line-1', label: 'Line 1', status: 'accepted' }] as never,
      scopePacks: [{ packId: 'scope-1', reviewStatus: 'accepted' }] as never,
      materialsSchedule: [{ materialId: 'mat-1', label: 'Material 1' }] as never,
      engineerJobPack: { jobPackVersion: 'v1', jobSummary: [] } as never,
      followUpTasks: [{ taskId: 'task-1', title: 'Task 1', resolved: false }] as never,
      scanHandoffPreview: { envelopeId: 'env-1' } as never,
      customerSummary: { recommendedScenarioId: 'system_unvented_cylinder', headline: 'Summary' } as never,
      portalVisitContext: {
        portalReference: scenario.id,
        workspaceId: scenario.session.activeWorkspace?.workspaceId ?? 'workspace-preview',
        brandId: scenario.session.activeBrandId,
        visitReference: scenario.workflowState.visitReference,
        propertyFacts: ['2 bathrooms'],
        usageFacts: ['3-person household'],
        recommendationSummary: 'Summary',
        selectedScenarioId: 'system_unvented_cylinder',
        accessMode: 'workspace_preview',
        personalDataMode: 'none',
      },
    },
    source: {
      target: scenario.session.storageTarget,
      surface: `workspace_visit_lifecycle_harness:${scenario.id}`,
    },
    ...(scenario.visit.ownership !== undefined ? { ownership: scenario.visit.ownership } : {}),
    brandContext: {
      brandId: scenario.session.activeBrandId,
      resolutionSource: scenario.session.brandResolutionSource,
      ...(scenario.session.workspaceId !== undefined ? { workspaceId: scenario.session.workspaceId } : {}),
      ...(scenario.session.workspaceName !== undefined ? { workspaceName: scenario.session.workspaceName } : {}),
    },
  });
}

function hasDoneOrActiveImplementation(
  scenario: WorkspaceVisitLifecycleScenarioV1,
): boolean {
  const implementation = scenario.lifecycleProgression.find((entry) => entry.stage === 'Implementation');
  return implementation !== undefined && (implementation.state === 'done' || implementation.state === 'active');
}

function hasImplementationReadiness(
  scenario: WorkspaceVisitLifecycleScenarioV1,
): boolean {
  const implementation = scenario.readinessProgression.find((entry) => entry.key === 'implementation');
  return implementation !== undefined && (implementation.state === 'ready' || implementation.state === 'complete');
}

export async function evaluateWorkspaceVisitLifecycleScenario(
  scenario: WorkspaceVisitLifecycleScenarioV1,
): Promise<WorkspaceVisitLifecycleEvaluationV1> {
  const pkg = toExportPackage(scenario);
  const manifest = pkg.files['manifest.json'] as Record<string, unknown>;
  const imported = await importPackageFromJsonBlob(exportPackageAsJsonBlob(pkg));

  const importedManifest: Record<string, unknown> | null =
    imported.ok ? (imported.pkg.files['manifest.json'] as Record<string, unknown>) : null;

  const exportPackageStatus: WorkspaceVisitExportPackageStatusV1 = {
    packageBuilt: true,
    importSucceeded: imported.ok,
    includesOwnershipMetadata: manifest['ownership'] !== undefined,
    includesBrandMetadata: manifest['brandContext'] !== undefined,
    importPreservedOwnership:
      importedManifest !== null &&
      JSON.stringify(importedManifest['ownership'] ?? null) === JSON.stringify(manifest['ownership'] ?? null),
    importPreservedBrand:
      importedManifest !== null &&
      JSON.stringify(importedManifest['brandContext'] ?? null) === JSON.stringify(manifest['brandContext'] ?? null),
  };

  const checkVisitHasWorkspaceId =
    typeof scenario.visit.workspaceId === 'string' && scenario.visit.workspaceId.trim().length > 0;
  const checkVisitHasBrandId =
    typeof scenario.visit.brandId === 'string' && scenario.visit.brandId.trim().length > 0;
  const checkImplementationWorkflowResolvesCorrectly =
    hasDoneOrActiveImplementation(scenario) &&
    hasImplementationReadiness(scenario) &&
    scenario.workflowState.schemaVersion === WORKFLOW_SCHEMA_VERSION;
  const checkCustomerOutputsUseResolvedBrand =
    scenario.customerOutputBrandId === scenario.session.activeBrandId;
  const checkFollowUpHandoffContainsCorrectVisitOwnership =
    scenario.followUpResolutionState.handoffVisitReference === scenario.visit.visitReference &&
    (scenario.followUpResolutionState.revisitVisitReference === undefined ||
      scenario.followUpResolutionState.revisitVisitReference === scenario.visit.visitReference) &&
    (scenario.followUpResolutionState.revisitWorkspaceId === undefined ||
      scenario.followUpResolutionState.revisitWorkspaceId === scenario.visit.workspaceId) &&
    (scenario.followUpResolutionState.revisitBrandId === undefined ||
      scenario.followUpResolutionState.revisitBrandId === scenario.visit.brandId);

  const checks: WorkspaceVisitLifecycleValidationChecksV1 = {
    visitHasWorkspaceId: checkVisitHasWorkspaceId,
    visitHasBrandId: checkVisitHasBrandId,
    exportContainsOwnershipMetadata: exportPackageStatus.includesOwnershipMetadata,
    implementationWorkflowResolvesCorrectly: checkImplementationWorkflowResolvesCorrectly,
    customerOutputsUseResolvedBrand: checkCustomerOutputsUseResolvedBrand,
    followUpHandoffContainsCorrectVisitOwnership: checkFollowUpHandoffContainsCorrectVisitOwnership,
  };

  const summary: WorkspaceVisitLifecycleSummaryV1 = {
    ownershipValid:
      checks.visitHasWorkspaceId &&
      checks.followUpHandoffContainsCorrectVisitOwnership &&
      scenario.session.status === 'workspace_active',
    brandingValid:
      checks.visitHasBrandId &&
      checks.customerOutputsUseResolvedBrand,
    storageValid:
      (scenario.session.status === 'workspace_active' && scenario.session.storageTarget !== 'disabled') ||
      (scenario.session.status !== 'workspace_active' && scenario.session.storageTarget === 'disabled'),
    workflowValid: checks.implementationWorkflowResolvesCorrectly,
    exportValid:
      checks.exportContainsOwnershipMetadata &&
      exportPackageStatus.importSucceeded &&
      exportPackageStatus.importPreservedOwnership &&
      exportPackageStatus.importPreservedBrand,
  };

  return {
    checks,
    summary,
    exportPackageStatus,
    lifecyclePassed:
      Object.values(summary).every(Boolean) &&
      Object.values(checks).every(Boolean),
  };
}

export function getWorkspaceVisitLifecycleScenariosV1(): readonly WorkspaceVisitLifecycleScenarioV1[] {
  return WORKSPACE_VISIT_LIFECYCLE_SCENARIOS_V1;
}

export function getWorkspaceVisitLifecycleScenarioV1(
  id: WorkspaceVisitLifecycleScenarioV1['id'],
): WorkspaceVisitLifecycleScenarioV1 {
  const scenario = WORKSPACE_VISIT_LIFECYCLE_SCENARIOS_V1.find((item) => item.id === id);
  if (!scenario) {
    throw new Error(`Unknown workspace visit lifecycle QA scenario: ${id}`);
  }
  return scenario;
}
