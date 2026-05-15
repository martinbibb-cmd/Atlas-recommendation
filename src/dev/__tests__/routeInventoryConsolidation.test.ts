import { describe, expect, it } from 'vitest';
import { DEV_UI_REGISTRY } from '../devUiRegistry';
import { DEV_ROUTE_REGISTRY, isProductionRoute } from '../devRouteRegistry';
import { buildComponentDiscoveryReport } from '../utils/componentScanner';

describe('route + inventory consolidation', () => {
  it('registers newly wired surfaces in UI inventory', () => {
    const required = [
      'VisitHomeDashboard',
      'LibraryCoverageAuditPanel',
      'LibraryAuthoringBacklogPanel',
      'LibraryProjectionQaPanel',
      'LibraryRepairQueuePanel',
      'UnifiedSimulatorView',
      'WorkspaceVisitLifecycleHarness',
      'WorkspaceSettingsPage',
      'DevPortalFixturePage',
      'ImplementationPackReviewPanel',
      'SpecificationLineReviewPanel',
      'InstallationScopePackReviewPanel',
    ];

    const codeNames = new Set(DEV_UI_REGISTRY.map((item) => item.codeName));
    for (const codeName of required) {
      expect(codeNames.has(codeName)).toBe(true);
    }
  });

  it('keeps dev-only QA surfaces out of production access', () => {
    const devOnly = [
      'DevPortalFixturePage',
      'WorkspaceVisitLifecycleHarness',
      'LibraryCoverageAuditPanel',
      'LibraryAuthoringBacklogPanel',
      'LibraryProjectionQaPanel',
      'LibraryRepairQueuePanel',
      'ComponentDiscoveryPanel',
    ];

    for (const codeName of devOnly) {
      const route = DEV_ROUTE_REGISTRY.find((entry) => entry.codeName === codeName);
      expect(route?.access).toBe('dev_only');
    }
  });

  it('marks legacy report/print/handoff routes as retired and excluded from production navigation', () => {
    const retired = [
      'ReportView',
      'SurveyPrintoutPage',
      'CustomerRecommendationPrint',
      'HandoffArrivalPage',
    ];

    for (const codeName of retired) {
      const route = DEV_ROUTE_REGISTRY.find((entry) => entry.codeName === codeName);
      expect(route?.access).toBe('retired');
      expect(route ? isProductionRoute(route) : true).toBe(false);
    }
  });

  it('classifies newly wired pages as routed rather than unrouted', () => {
    const report = buildComponentDiscoveryReport({
      candidateFilePaths: [
        'src/features/workspace/WorkspaceSettingsPage.tsx',
        'src/dev/DevPortalFixturePage.tsx',
      ],
      routeRegistry: DEV_ROUTE_REGISTRY,
      uiRegistry: DEV_UI_REGISTRY,
    });

    expect(report.routeAuditRows.map((row) => row.status).sort()).toEqual(['dev_only', 'production']);
    expect(report.counts.unrouted).toBe(0);
  });
});
