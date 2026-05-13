import { describe, expect, it } from 'vitest';
import {
  evaluateWorkspaceVisitLifecycleScenario,
  getWorkspaceVisitLifecycleScenarioV1,
} from '../WorkspaceVisitLifecycleScenarioV1';

describe('WorkspaceVisitLifecycleScenarioV1', () => {
  it('workspace-owned visit passes lifecycle', async () => {
    const scenario = getWorkspaceVisitLifecycleScenarioV1('workspace_owned_visit');
    const evaluation = await evaluateWorkspaceVisitLifecycleScenario(scenario);

    expect(evaluation.lifecyclePassed).toBe(true);
    expect(evaluation.summary.ownershipValid).toBe(true);
    expect(evaluation.summary.workflowValid).toBe(true);
    expect(evaluation.summary.exportValid).toBe(true);
  });

  it('no-workspace flow blocks correctly', async () => {
    const scenario = getWorkspaceVisitLifecycleScenarioV1('authenticated_no_workspace_blocked');
    const evaluation = await evaluateWorkspaceVisitLifecycleScenario(scenario);

    expect(scenario.session.status).toBe('authenticated_no_workspace');
    expect(scenario.lifecycleProgression.some((entry) => entry.state === 'blocked')).toBe(true);
    expect(scenario.readinessProgression.some((entry) => entry.state === 'blocked')).toBe(true);
    expect(evaluation.summary.ownershipValid).toBe(false);
    expect(evaluation.checks.visitHasWorkspaceId).toBe(false);
  });

  it('export/import preserves ownership', async () => {
    const scenario = getWorkspaceVisitLifecycleScenarioV1('export_import_path');
    const evaluation = await evaluateWorkspaceVisitLifecycleScenario(scenario);

    expect(evaluation.exportPackageStatus.importSucceeded).toBe(true);
    expect(evaluation.exportPackageStatus.includesOwnershipMetadata).toBe(true);
    expect(evaluation.exportPackageStatus.importPreservedOwnership).toBe(true);
  });

  it('revisit preserves workspace + brand', async () => {
    const scenario = getWorkspaceVisitLifecycleScenarioV1('revisit_follow_up_path');
    const evaluation = await evaluateWorkspaceVisitLifecycleScenario(scenario);

    expect(scenario.followUpResolutionState.revisitWorkspaceId).toBe(scenario.visit.workspaceId);
    expect(scenario.followUpResolutionState.revisitBrandId).toBe(scenario.visit.brandId);
    expect(evaluation.checks.customerOutputsUseResolvedBrand).toBe(true);
    expect(evaluation.summary.brandingValid).toBe(true);
  });

  it('follow-up preserves visit identity', async () => {
    const scenario = getWorkspaceVisitLifecycleScenarioV1('revisit_follow_up_path');
    const evaluation = await evaluateWorkspaceVisitLifecycleScenario(scenario);

    expect(scenario.followUpResolutionState.handoffVisitReference).toBe(scenario.visit.visitReference);
    expect(scenario.followUpResolutionState.revisitVisitReference).toBe(scenario.visit.visitReference);
    expect(evaluation.checks.followUpHandoffContainsCorrectVisitOwnership).toBe(true);
  });
});
