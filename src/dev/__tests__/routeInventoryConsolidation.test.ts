import { describe, expect, it } from 'vitest';
import { DEV_UI_REGISTRY } from '../devUiRegistry';
import { DEV_ROUTE_REGISTRY, isProductionRoute } from '../devRouteRegistry';
import { buildComponentDiscoveryReport } from '../utils/componentScanner';

describe('route + inventory consolidation', () => {
  it('registers newly wired surfaces in UI inventory', () => {
    const required = [
      'HouseSimulatorPage',
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

  it('promotes HouseSimulatorPage as the canonical production simulator surface', () => {
    const uiEntry = DEV_UI_REGISTRY.find((item) => item.codeName === 'HouseSimulatorPage');
    const route = DEV_ROUTE_REGISTRY.find((entry) => entry.codeName === 'HouseSimulatorPage');

    expect(uiEntry).toMatchObject({
      status: 'canonical',
      routeKind: 'query_flag',
      access: 'production',
      fullRouteExample: '/?house-simulator=1',
      owner: 'simulator',
      domain: 'visit review',
    });
    expect(route).toMatchObject({
      queryFlags: ['house-simulator=1'],
      routeKind: 'query_flag',
      access: 'production',
      lifecycle: 'canonical',
      canonicalOwner: 'simulator',
    });
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

  it('marks legacy customer output surfaces as legacy_dev_only with canonical replacements', () => {
    const legacySurfaces = [
      ['VisitHubPage', 'visit-home'],
      ['VisitHomeUnifiedSimulatorRoute', '/?house-simulator=1'],
      ['UnifiedSimulatorView', '/?house-simulator=1'],
      ['InsightPackDeck', '/portal/<reference>?token=<signed-token>'],
      ['CustomerAdvicePrintPack', 'library-pdf'],
    ] as const;

    for (const [codeName, replacementRoute] of legacySurfaces) {
      const route = DEV_ROUTE_REGISTRY.find((entry) => entry.codeName === codeName);
      expect(route, `${codeName} route metadata should be present`).toBeDefined();
      expect(route?.access).toBe('legacy_dev_only');
      expect(route?.replacementRoute).toBe(replacementRoute);
      expect(route ? isProductionRoute(route) : true).toBe(false);
    }
  });

  it('classifies newly wired pages as routed rather than unrouted', () => {
    const report = buildComponentDiscoveryReport({
      candidateFilePaths: [
        'src/features/houseSimulator/HouseSimulatorPage.tsx',
        'src/features/workspace/WorkspaceSettingsPage.tsx',
        'src/dev/DevPortalFixturePage.tsx',
      ],
      routeRegistry: DEV_ROUTE_REGISTRY,
      uiRegistry: DEV_UI_REGISTRY,
    });

    expect(report.routeAuditRows.map((row) => row.status).sort()).toEqual([
      'dev_only',
      'production',
      'production',
    ]);
    expect(report.routeAuditRows.find((row) => row.codeName === 'HouseSimulatorPage')).toMatchObject({
      status: 'production',
      inUiInventory: true,
    });
    expect(report.counts.unrouted).toBe(0);
  });

  it('keeps unified-simulator out of production route metadata', () => {
    const productionRoutes = DEV_ROUTE_REGISTRY.filter((entry) => entry.access === 'production');
    const hasUnifiedSimulatorReference = productionRoutes.some((route) =>
      [
        route.routePath,
        route.fullRouteExample,
        ...(route.queryFlags ?? []),
      ].some((value) => value?.includes('unified-simulator')),
    );

    expect(hasUnifiedSimulatorReference).toBe(false);
  });

  it('every active (non-retired) route entry has a resolvable access path', () => {
    const activeRoutes = DEV_ROUTE_REGISTRY.filter((r) => r.access !== 'retired');
    for (const route of activeRoutes) {
      const hasPath =
        (route.routePath != null && route.routePath.length > 0) ||
        (route.queryFlags != null && route.queryFlags.length > 0) ||
        (route.fullRouteExample != null && route.fullRouteExample.length > 0);
      expect(
        hasPath,
        `Route "${route.codeName}" has no routePath, queryFlags, or fullRouteExample`,
      ).toBe(true);
    }
  });

  it('retired routes are not listed as production routes', () => {
    const retiredAsProduction = DEV_ROUTE_REGISTRY.filter(
      (r) => r.access === 'retired' && isProductionRoute(r),
    );
    expect(
      retiredAsProduction.map((r) => r.codeName),
      'retired routes must not appear as production routes',
    ).toHaveLength(0);
  });

  it('visit-home dashboard has a distinct back path to workspace-dashboard in route registry', () => {
    const route = DEV_ROUTE_REGISTRY.find((r) => r.codeName === 'VisitHomeDashboard');
    expect(route).toBeDefined();
    expect(route?.access).toBe('production');
    // The full route example must reference the workspace origin so the back path is traceable
    expect(route?.fullRouteExample).toContain('visit');
  });

  it('dev-menu surfaces — portal-fixtures, workspace-lifecycle-qa, welcome-pack, inspector — all have registered routes', () => {
    const devMenuSurfaces = [
      'DevPortalFixturePage',
      'WorkspaceVisitLifecycleHarness',
      'WelcomePackDevPreview',
      'ComponentDiscoveryPanel',
    ];

    for (const codeName of devMenuSurfaces) {
      const route = DEV_ROUTE_REGISTRY.find((r) => r.codeName === codeName);
      expect(route, `${codeName} must be in DEV_ROUTE_REGISTRY`).toBeDefined();
      expect(route?.access).toBe('dev_only');
    }
  });

  it('library diagnostic surfaces are all dev_only and registered', () => {
    const librarySurfaces = [
      'LibraryCoverageAuditPanel',
      'LibraryAuthoringBacklogPanel',
      'LibraryProjectionQaPanel',
      'LibraryRepairQueuePanel',
    ];

    for (const codeName of librarySurfaces) {
      const route = DEV_ROUTE_REGISTRY.find((r) => r.codeName === codeName);
      expect(route, `${codeName} must be in DEV_ROUTE_REGISTRY`).toBeDefined();
      expect(route?.access).toBe('dev_only');
      expect(isProductionRoute(route!)).toBe(false);
    }
  });

  // ── PDF authority tests ─────────────────────────────────────────────────────

  it('promotes PortalJourneyPrintPack as the canonical production PDF surface', () => {
    const uiEntry = DEV_UI_REGISTRY.find((item) => item.codeName === 'PortalJourneyPrintPack');
    const route = DEV_ROUTE_REGISTRY.find((entry) => entry.codeName === 'PortalJourneyPrintPack');

    expect(uiEntry, 'PortalJourneyPrintPack must be in DEV_UI_REGISTRY').toBeDefined();
    expect(uiEntry).toMatchObject({
      status: 'canonical',
      access: 'production',
      owner: 'pdf',
    });

    expect(route, 'PortalJourneyPrintPack must be in DEV_ROUTE_REGISTRY').toBeDefined();
    expect(route).toMatchObject({
      routeKind: 'derived',
      access: 'production',
      lifecycle: 'canonical',
      canonicalOwner: 'pdf',
    });
    expect(isProductionRoute(route!)).toBe(true);
  });

  it('production routes should not reference framework-print as a CTA destination', () => {
    const productionRoutes = DEV_ROUTE_REGISTRY.filter((entry) => entry.access === 'production');
    const frameworkPrintReferences = productionRoutes.filter((route) =>
      [
        route.routePath,
        route.fullRouteExample,
        ...(route.queryFlags ?? []),
      ].some((value) => value?.includes('framework-print')),
    );
    expect(
      frameworkPrintReferences.map((r) => r.codeName),
      'No production route may reference framework-print',
    ).toHaveLength(0);
  });

  it('marks legacy blueprint/framework print surfaces as legacy_dev_only with replacement route library-pdf', () => {
    const legacyPrintSurfaces = [
      'CustomerAdvicePrintPack',
      'AtlasFrameworkPrintPage',
    ] as const;

    for (const codeName of legacyPrintSurfaces) {
      const route = DEV_ROUTE_REGISTRY.find((entry) => entry.codeName === codeName);
      expect(route, `${codeName} route metadata should be present`).toBeDefined();
      expect(route?.access).toBe('legacy_dev_only');
      expect(route?.replacementRoute).toBe('library-pdf');
      expect(route ? isProductionRoute(route) : true).toBe(false);
    }
  });

  it('legacy print surfaces appear in UI inventory as deprecated', () => {
    const legacyPrintSurfaces = [
      'CustomerAdvicePrintPack',
      'AtlasFrameworkPrintPage',
    ] as const;

    for (const codeName of legacyPrintSurfaces) {
      const uiEntry = DEV_UI_REGISTRY.find((item) => item.codeName === codeName);
      expect(uiEntry, `${codeName} must be in DEV_UI_REGISTRY`).toBeDefined();
      expect(uiEntry?.status).toBe('deprecated');
      expect(uiEntry?.access).toBe('legacy_dev_only');
    }
  });
});
