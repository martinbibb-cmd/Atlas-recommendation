/**
 * devRouteRegistry.ts
 *
 * Centralised developer-visible route registry for Atlas.
 *
 * Maps every known UI surface to its real access path (pathname, query flags or
 * internal journey state). All entries are manually maintained — do NOT infer
 * routes from import graphs or AST analysis.
 *
 * If a route is genuinely unknown mark it routeKind: 'unknown' rather than
 * inventing a value.
 */

import type { DevUiRouteKind, DevUiAccess } from './devUiRegistry';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DevRouteLifecycle = 'canonical' | 'active' | 'legacy_dev_only' | 'retired';

export interface DevRouteMeta {
  /** Matches DevUiRegistryItem.codeName. */
  codeName: string;
  /** Absolute pathname if the surface has a URL path route (e.g. '/floor-plan-tool'). */
  routePath?: string;
  /** Query flag(s) that activate this surface, e.g. ['lab=1']. */
  queryFlags?: string[];
  /** Ready-to-paste example URL for browser / Copilot use. */
  fullRouteExample?: string;
  /** Canonical replacement route when this surface is retired or legacy-only. */
  replacementRoute?: string;
  /** How this surface is reached. */
  routeKind: DevUiRouteKind;
  /** Who may access this surface in production. */
  access: DevUiAccess;
  /** Route lifecycle for inventory/discovery audits. */
  lifecycle?: DevRouteLifecycle;
  /** Canonical owning surface/domain for this route. */
  canonicalOwner?: string;
}

export type DevRouteAuditStatus = 'production' | 'dev_only' | 'retired' | 'unrouted';

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * Every developer-visible surface with its real route details resolved from
 * App.tsx.  Keep in sync with the query-flag detections at the top of App.tsx
 * and the journey switch inside the main render.
 */
export const DEV_ROUTE_REGISTRY: DevRouteMeta[] = [
  // ── Production routes ─────────────────────────────────────────────────────
  {
    codeName: 'ExplainersHubPage',
    queryFlags: ['lab=1'],
    fullRouteExample: '/?lab=1',
    routeKind: 'query_flag',
    access: 'production',
  },
  {
    codeName: 'HouseSimulatorPage',
    queryFlags: ['house-simulator=1'],
    fullRouteExample: '/?house-simulator=1',
    routeKind: 'query_flag',
    access: 'production',
    lifecycle: 'canonical',
    canonicalOwner: 'simulator',
  },
  {
    codeName: 'CanonicalPresentationPage',
    queryFlags: ['presentation=1'],
    fullRouteExample: '/?presentation=1',
    routeKind: 'query_flag',
    access: 'production',
  },
  {
    codeName: 'PresentationDeckMode',
    queryFlags: ['deck=1'],
    fullRouteExample: '/?deck=1',
    routeKind: 'query_flag',
    access: 'production',
  },
  {
    codeName: 'AtlasExplorerPage',
    queryFlags: ['explorer=1'],
    fullRouteExample: '/?explorer=1',
    routeKind: 'query_flag',
    access: 'review',
  },
  {
    codeName: 'FloorPlanBuilder',
    routePath: '/floor-plan-tool',
    fullRouteExample: '/floor-plan-tool',
    routeKind: 'path',
    access: 'production',
  },
  {
    codeName: 'ReportPage',
    routePath: '/report/:id',
    fullRouteExample: '/report/<report-id>',
    routeKind: 'path',
    access: 'production',
  },
  {
    codeName: 'CustomerPortalPage',
    routePath: '/portal/:reference',
    fullRouteExample: '/portal/<reference>?token=<signed-token>',
    routeKind: 'path',
    access: 'production',
    lifecycle: 'canonical',
    canonicalOwner: 'portal',
  },
  {
    codeName: 'UnifiedSimulatorView',
    fullRouteExample: '/?insight-pack=1 (legacy diagnostics)',
    replacementRoute: '/?house-simulator=1',
    routeKind: 'derived',
    access: 'legacy_dev_only',
    lifecycle: 'legacy_dev_only',
  },
  {
    codeName: 'VisitHomeDashboard',
    queryFlags: ['visit-home=1'],
    fullRouteExample: 'workspace dashboard → open visit → Visit Home Dashboard',
    routeKind: 'derived',
    access: 'production',
  },
  {
    codeName: 'WorkspaceSettingsPage',
    routePath: '/workspace/settings',
    fullRouteExample: '/workspace/settings or /dev/workspace-settings',
    routeKind: 'path',
    access: 'production',
  },
  {
    codeName: 'InstallationSpecificationPage',
    routePath: '/installation-specification',
    queryFlags: ['installation-specification=1'],
    fullRouteExample: '/installation-specification',
    routeKind: 'path',
    access: 'production',
  },

  // ── Development / QA routes ───────────────────────────────────────────────
  {
    codeName: 'PresentationAuditPage',
    queryFlags: ['audit=1'],
    fullRouteExample: '/?audit=1',
    routeKind: 'query_flag',
    access: 'dev_only',
  },
  {
    codeName: 'WorkspaceVisitLifecycleHarness',
    queryFlags: ['workspace-lifecycle-qa=1'],
    fullRouteExample: '/?workspace-lifecycle-qa=1',
    routeKind: 'query_flag',
    access: 'dev_only',
  },
  {
    codeName: 'PhysicsVisualGallery',
    queryFlags: ['gallery=1'],
    fullRouteExample: '/?gallery=1',
    routeKind: 'query_flag',
    access: 'dev_only',
  },
  {
    codeName: 'DevMenuPage',
    routePath: '/dev/devmenu',
    queryFlags: ['devmenu=1 (legacy)'],
    fullRouteExample: '/dev/devmenu',
    routeKind: 'path',
    access: 'dev_only',
  },
  {
    codeName: 'ComponentDiscoveryPanel',
    routePath: '/dev/inspector',
    fullRouteExample: '/dev/inspector or /dev/component-discovery',
    routeKind: 'path',
    access: 'dev_only',
  },
  {
    codeName: 'StorageDiagnosticsPanel',
    fullRouteExample: '/dev/devmenu → 💾 Storage tab',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'WelcomePackDevPreview',
    routePath: '/dev/welcome-pack',
    fullRouteExample: '/dev/welcome-pack',
    routeKind: 'path',
    access: 'dev_only',
  },
  {
    codeName: 'DevPortalFixturePage',
    routePath: '/dev/portal-fixtures',
    fullRouteExample: '/dev/portal-fixtures',
    routeKind: 'path',
    access: 'dev_only',
  },
  {
    codeName: 'LibraryCoverageAuditPanel',
    fullRouteExample: '/dev/welcome-pack → Diagnostics · /dev/portal-fixtures → workflow',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'LibraryAuthoringBacklogPanel',
    fullRouteExample: '/dev/welcome-pack → Diagnostics · /dev/portal-fixtures → workflow',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'LibraryProjectionQaPanel',
    fullRouteExample: '/dev/welcome-pack → Diagnostics · /dev/portal-fixtures → workflow',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'LibraryRepairQueuePanel',
    fullRouteExample: '/dev/portal-fixtures → workflow → Library Projection QA',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'ImplementationPackReviewPanel',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'SpecificationLineReviewPanel',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'InstallationScopePackReviewPanel',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'ScopePackHandoverPreviewPanel',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'EngineerJobPackPreviewPanel',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'MaterialsScheduleReviewPanel',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'SpecificationReadinessPanel',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'SurveyFollowUpTaskPanel',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'FollowUpEvidencePlanPanel',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'FollowUpScanHandoffPanel',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'ScanHandoffEnvelopePreviewPanel',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'WorkflowStorageModeSelector',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step',
    routeKind: 'derived',
    access: 'dev_only',
  },

  // ── Internal journey-state surfaces (no URL change) ──────────────────────
  {
    codeName: 'FastChoiceStepper',
    fullRouteExample: 'landing → "Quick check" card',
    routeKind: 'derived',
    access: 'production',
  },
  {
    codeName: 'FullSurveyStepper',
    fullRouteExample: 'landing → "Full survey" card',
    routeKind: 'derived',
    access: 'production',
  },
  {
    codeName: 'LabShell',
    fullRouteExample: 'landing → "System Lab" card',
    routeKind: 'derived',
    access: 'production',
  },

  // ── Derived / embedded surfaces (no standalone route) ────────────────────
  {
    codeName: 'LifestyleInteractive',
    fullRouteExample: 'unresolved — legacy visualiser preview',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'GlassBoxPanel',
    fullRouteExample: 'unresolved — embedded in simulator',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'EfficiencyCurve',
    fullRouteExample: 'unresolved — embedded in simulator',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'FootprintXRay',
    fullRouteExample: 'unresolved — embedded in simulator',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'DrawOffWorkbench',
    fullRouteExample: 'unresolved — embedded in System Lab',
    routeKind: 'derived',
    access: 'dev_only',
  },
  {
    codeName: 'VisitHubPage',
    fullRouteExample: 'legacy journey state: visit-hub',
    replacementRoute: 'visit-home',
    routeKind: 'derived',
    access: 'legacy_dev_only',
  },
  {
    codeName: 'VisitHomeUnifiedSimulatorRoute',
    fullRouteExample: 'legacy journey state: unified-simulator',
    replacementRoute: '/?house-simulator=1',
    routeKind: 'derived',
    access: 'legacy_dev_only',
    lifecycle: 'legacy_dev_only',
  },
  {
    codeName: 'InsightPackDeck',
    fullRouteExample: 'legacy journey state: insight-pack',
    replacementRoute: '/portal/<reference>?token=<signed-token>',
    routeKind: 'derived',
    access: 'legacy_dev_only',
    lifecycle: 'legacy_dev_only',
  },
  {
    codeName: 'PortalJourneyPrintPack',
    fullRouteExample: 'journey state: library-pdf (Visit Home → Supporting PDF CTA)',
    routeKind: 'derived',
    access: 'production',
    lifecycle: 'canonical',
    canonicalOwner: 'pdf',
  },
  {
    codeName: 'CustomerAdvicePrintPack',
    fullRouteExample: 'legacy journey state: framework-print',
    replacementRoute: 'library-pdf',
    routeKind: 'derived',
    access: 'legacy_dev_only',
    lifecycle: 'legacy_dev_only',
  },
  {
    codeName: 'AtlasFrameworkPrintPage',
    fullRouteExample: 'legacy journey state: framework-print (blueprint summary)',
    replacementRoute: 'library-pdf',
    routeKind: 'derived',
    access: 'legacy_dev_only',
    lifecycle: 'legacy_dev_only',
  },

  // ── Retired routes (excluded from normal navigation) ──────────────────────
  {
    codeName: 'ReportView',
    queryFlags: ['report=1'],
    fullRouteExample: '/?report=1 (retired)',
    replacementRoute: '/report/<report-id>',
    routeKind: 'query_flag',
    access: 'retired',
    lifecycle: 'retired',
  },
  {
    codeName: 'SurveyPrintoutPage',
    queryFlags: ['print=survey'],
    fullRouteExample: '/?print=survey (retired)',
    replacementRoute: 'library-pdf',
    routeKind: 'query_flag',
    access: 'retired',
    lifecycle: 'retired',
  },
  {
    codeName: 'CustomerRecommendationPrint',
    queryFlags: ['print=survey&internal=1'],
    fullRouteExample: '/?print=survey&internal=1 (retired internal print)',
    replacementRoute: 'library-pdf',
    routeKind: 'query_flag',
    access: 'retired',
    lifecycle: 'retired',
  },
  {
    codeName: 'HandoffArrivalPage',
    queryFlags: ['handoff=1'],
    fullRouteExample: '/?handoff=1 (retired)',
    replacementRoute: 'visit-home',
    routeKind: 'query_flag',
    access: 'retired',
    lifecycle: 'retired',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns route metadata for a surface by its codeName, or undefined. */
export function getRouteMetaForSurface(codeName: string): DevRouteMeta | undefined {
  return DEV_ROUTE_REGISTRY.find(r => r.codeName === codeName);
}

/** Builds the full route example string for display / copy. */
export function buildFullRouteExample(meta: DevRouteMeta): string {
  if (meta.fullRouteExample != null) return meta.fullRouteExample;
  if (meta.queryFlags != null && meta.queryFlags.length > 0) {
    return '/?' + meta.queryFlags.join('&');
  }
  if (meta.routePath != null) return meta.routePath;
  return 'unresolved';
}

/** Returns true if the surface is reached via a URL query flag. */
export function isFlagRoute(meta: DevRouteMeta): boolean {
  return meta.routeKind === 'query_flag';
}

/** Returns true if the surface is accessible in production. */
export function isProductionRoute(meta: DevRouteMeta): boolean {
  return meta.access === 'production';
}

/** Maps a route metadata record into discovery audit status buckets. */
export function getRouteAuditStatus(meta: DevRouteMeta | undefined): DevRouteAuditStatus {
  if (meta == null) return 'unrouted';
  if (meta.access === 'production') return 'production';
  if (meta.access === 'retired') return 'retired';
  return 'dev_only';
}

/** Fast lookup map for codeName → route metadata. */
export function buildRouteAuditIndex(): ReadonlyMap<string, DevRouteMeta> {
  return new Map(DEV_ROUTE_REGISTRY.map(meta => [meta.codeName, meta]));
}
