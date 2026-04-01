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

export interface DevRouteMeta {
  /** Matches DevUiRegistryItem.codeName. */
  codeName: string;
  /** Absolute pathname if the surface has a URL path route (e.g. '/floor-plan-tool'). */
  routePath?: string;
  /** Query flag(s) that activate this surface, e.g. ['lab=1']. */
  queryFlags?: string[];
  /** Ready-to-paste example URL for browser / Copilot use. */
  fullRouteExample?: string;
  /** How this surface is reached. */
  routeKind: DevUiRouteKind;
  /** Who may access this surface in production. */
  access: DevUiAccess;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * Every developer-visible surface with its real route details resolved from
 * App.tsx.  Keep in sync with the query-flag detections at the top of App.tsx
 * and the journey switch inside the main render.
 */
export const DEV_ROUTE_REGISTRY: DevRouteMeta[] = [
  // ── Query-flag surfaces ──────────────────────────────────────────────────
  {
    codeName: 'ExplainersHubPage',
    queryFlags: ['lab=1'],
    fullRouteExample: '/?lab=1',
    routeKind: 'query_flag',
    access: 'production',
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
    codeName: 'PresentationAuditPage',
    queryFlags: ['audit=1'],
    fullRouteExample: '/?audit=1',
    routeKind: 'query_flag',
    access: 'dev_only',
  },
  {
    codeName: 'AtlasExplorerPage',
    queryFlags: ['explorer=1'],
    fullRouteExample: '/?explorer=1',
    routeKind: 'query_flag',
    access: 'review',
  },
  {
    codeName: 'PhysicsVisualGallery',
    queryFlags: ['gallery=1'],
    fullRouteExample: '/?gallery=1',
    routeKind: 'query_flag',
    access: 'dev_only',
  },
  {
    codeName: 'ReportView',
    queryFlags: ['report=1'],
    fullRouteExample: '/?report=1',
    routeKind: 'query_flag',
    access: 'dev_only',
  },
  {
    codeName: 'DevMenuPage',
    queryFlags: ['devmenu=1'],
    fullRouteExample: '/?devmenu=1',
    routeKind: 'query_flag',
    access: 'dev_only',
  },

  // ── Pathname routes ──────────────────────────────────────────────────────
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
    fullRouteExample: 'unresolved — embedded in simulator',
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
