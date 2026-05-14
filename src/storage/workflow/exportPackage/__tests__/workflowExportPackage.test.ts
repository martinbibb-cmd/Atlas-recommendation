import { describe, expect, it } from 'vitest';
import {
  WORKFLOW_EXPORT_PACKAGE_SCHEMA,
  WORKFLOW_EXPORT_PACKAGE_VERSION,
  WORKFLOW_EXPORT_REQUIRED_FILES,
  buildWorkflowExportFolderName,
  buildWorkflowExportPackage,
  exportPackageAsJsonBlob,
  importPackageFromJsonBlob,
} from '..';
import { WORKFLOW_SCHEMA_VERSION, type PersistedImplementationWorkflowV1 } from '../../PersistedImplementationWorkflowV1';

function makeWorkflowState(visitReference = 'fixture:system_unvented_2bath'): PersistedImplementationWorkflowV1 {
  const now = '2026-05-13T10:00:00.000Z';
  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    visitReference,
    createdAt: now,
    updatedAt: now,
    packSnapshot: {
      recommendedScenarioId: 'system_unvented_cylinder',
      fixtureId: 'system_unvented_2bath',
    },
    resolutionSimulation: {
      resolvedTaskIds: ['task-1'],
      capturedEvidenceIds: ['ev-1'],
      resolvedDependencyIds: [],
      changeLog: [],
    },
    scopePackStatuses: { standard_unvented_cylinder_install: 'accepted' },
    specLineStatuses: { 'line-1': 'accepted' },
    materialsReviewState: {
      confirmedIds: ['mat-1'],
      rejectedIds: [],
      flaggedIds: [],
    },
  };
}

function makePackage(exportedAt = '2026-05-13T10:00:00.000Z') {
  const payload = {
    workflowState: makeWorkflowState(),
    implementationPack: { packVersion: 'v1', recommendedScenarioId: 'system_unvented_cylinder' } as never,
    specificationLines: [{ lineId: 'line-1', label: 'Line 1' }] as never,
    scopePacks: [{ packId: 'scope-1', reviewStatus: 'accepted' }] as never,
    materialsSchedule: [{ materialId: 'mat-1', label: 'Material 1' }] as never,
    engineerJobPack: { jobPackVersion: 'v1', jobSummary: [] } as never,
    followUpTasks: [{ taskId: 'task-1', title: 'Task 1', resolved: false }] as never,
    scanHandoffPreview: { envelopeId: 'env-1' } as never,
    customerSummary: { recommendedScenarioId: 'system_unvented_cylinder', headline: 'Summary' } as never,
    portalVisitContext: {
      portalReference: 'portal-ref',
      workspaceId: 'workspace-1',
      brandId: 'atlas-default',
      visitReference: 'visit-1',
      customerDisplayLabel: 'The Smith household',
      addressSummary: '3-bed semi in Portsmouth',
      propertyFacts: ['2 bathrooms'],
      usageFacts: ['3-person household'],
      recommendationSummary: 'Summary',
      selectedScenarioId: 'system_unvented_cylinder',
      accessMode: 'workspace_preview',
      personalDataMode: 'full_customer_record',
    },
  };
  return buildWorkflowExportPackage({
    payload,
    source: {
      target: 'local_only',
      surface: 'dev_portal_fixture:system_unvented_2bath',
    },
    exportedAt,
  });
}

describe('workflow export package', () => {
  it('builds package with all required files', () => {
    const pkg = makePackage();
    const names = Object.keys(pkg.files).sort();
    expect(names).toEqual([...WORKFLOW_EXPORT_REQUIRED_FILES].sort());
  });

  it('manifest includes schema/version/date/source', () => {
    const pkg = makePackage('2026-05-13T10:00:00.000Z');
    const manifest = pkg.files['manifest.json'] as Record<string, unknown>;

    expect(manifest['schema']).toBe(WORKFLOW_EXPORT_PACKAGE_SCHEMA);
    expect(manifest['version']).toBe(WORKFLOW_EXPORT_PACKAGE_VERSION);
    expect(manifest['exportedAt']).toBe('2026-05-13T10:00:00.000Z');
    expect(manifest['source']).toEqual({
      target: 'local_only',
      surface: 'dev_portal_fixture:system_unvented_2bath',
    });
  });

  it('exports a personal-data-light portal visit context by default', () => {
    const pkg = makePackage();
    const portalVisitContext = pkg.files['portal-visit-context.json'] as Record<string, unknown>;

    expect(portalVisitContext['personalDataMode']).toBe('address_summary');
    expect(portalVisitContext['customerDisplayLabel']).toBe('The Smith household');
    expect(portalVisitContext['addressSummary']).toBe('3-bed semi in Portsmouth');
  });

  it('import validates schema', async () => {
    const pkg = makePackage();
    const badBlob = new Blob([JSON.stringify({ ...pkg, schema: 'wrong.schema' })], { type: 'application/json' });
    const imported = await importPackageFromJsonBlob(badBlob);
    expect(imported.ok).toBe(false);
  });

  it('does not include customer PDF binary files', () => {
    const pkg = makePackage();
    const hasPdf = Object.keys(pkg.files).some((name) => name.toLowerCase().endsWith('.pdf'));
    expect(hasPdf).toBe(false);
  });

  it('Google Drive target can reuse the same package schema', async () => {
    const pkg = buildWorkflowExportPackage({
      payload: {
        workflowState: makeWorkflowState(),
        implementationPack: { packVersion: 'v1', recommendedScenarioId: 'system_unvented_cylinder' } as never,
        specificationLines: [{ lineId: 'line-1', label: 'Line 1' }] as never,
        scopePacks: [{ packId: 'scope-1', reviewStatus: 'accepted' }] as never,
        materialsSchedule: [{ materialId: 'mat-1', label: 'Material 1' }] as never,
        engineerJobPack: { jobPackVersion: 'v1', jobSummary: [] } as never,
        followUpTasks: [{ taskId: 'task-1', title: 'Task 1', resolved: false }] as never,
        scanHandoffPreview: { envelopeId: 'env-1' } as never,
        customerSummary: { recommendedScenarioId: 'system_unvented_cylinder', headline: 'Summary' } as never,
        portalVisitContext: {
          portalReference: 'portal-ref',
          workspaceId: 'workspace-1',
          brandId: 'atlas-default',
          visitReference: 'visit-1',
          propertyFacts: ['2 bathrooms'],
          usageFacts: ['3-person household'],
          recommendationSummary: 'Summary',
          selectedScenarioId: 'system_unvented_cylinder',
          accessMode: 'workspace_preview',
          personalDataMode: 'none',
        },
      },
      source: { target: 'google_drive', surface: 'workspace_google_drive' },
      exportedAt: '2026-05-13T11:00:00.000Z',
    });
    const blob = exportPackageAsJsonBlob(pkg);
    const imported = await importPackageFromJsonBlob(blob);
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      const manifest = imported.pkg.files['manifest.json'] as Record<string, unknown>;
      expect((manifest['source'] as Record<string, unknown>)['target']).toBe('google_drive');
    }
  });

  it('is deterministic except timestamp', () => {
    const a = makePackage('2026-05-13T10:00:00.000Z');
    const b = makePackage('2026-05-13T11:00:00.000Z');

    const normalize = (pkg: ReturnType<typeof makePackage>) => {
      const copy = JSON.parse(JSON.stringify(pkg));
      (copy.files['manifest.json'] as Record<string, unknown>)['exportedAt'] = '__timestamp__';
      copy.folderName = buildWorkflowExportFolderName('fixture:system_unvented_2bath', '__timestamp__');
      (copy.files['manifest.json'] as Record<string, unknown>)['folderName'] = copy.folderName;
      return copy;
    };

    expect(normalize(a)).toEqual(normalize(b));
  });
});
