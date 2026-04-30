/**
 * devUiRegistry.tsx
 *
 * Central manifest of all Atlas UI surfaces for the developer component browser.
 *
 * Each entry is curated — do NOT auto-generate this list from the filesystem.
 * Add entries intentionally and keep commonName, fileName and filePath in sync
 * with the actual source files.
 *
 * NOT customer-facing. Only accessible via the Dev Menu (?devmenu=1 URL flag).
 */

import type { ReactNode } from 'react';
import ExplainersHubPage from '../explainers/ExplainersHubPage';
import LegoBuildingSetPage from '../explainers/lego/LegoBuildingSetPage';
import LifestyleInteractive from '../components/visualizers/LifestyleInteractive';
import LifestyleInteractiveCompare from '../components/visualizers/LifestyleInteractiveCompare';
import GlassBoxPanel from '../components/visualizers/GlassBoxPanel';
import EfficiencyCurve from '../components/visualizers/EfficiencyCurve';
import FootprintXRay from '../components/visualizers/FootprintXRay';
import FastChoiceStepper from '../components/stepper/FastChoiceStepper';
import FullSurveyStepper from '../components/stepper/FullSurveyStepper';
import PresentationAuditPage from '../components/audit/PresentationAuditPage';
import DrawOffWorkbench from '../components/lab/DrawOffWorkbench';
import LabShell from '../components/lab/LabShell';
import AtlasExplorerPage from '../components/explorer/AtlasExplorerPage';
import CanonicalPresentationPage from '../components/presentation/CanonicalPresentationPage';
import { runEngine } from '../engine/Engine';
import type { EngineInputV2_3 } from '../engine/schema/EngineInputV2_3';

// ─── Demo input ───────────────────────────────────────────────────────────────

/**
 * Realistic UK combi scenario used to seed components that require engine output.
 * 3-bed semi, 3 occupants, 1 bathroom, struggling combi — identical to the
 * CONSOLE_DEMO_INPUT used elsewhere in App.tsx.
 */
const DEV_DEMO_INPUT: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 1.8,
  mainsDynamicFlowLpm: 14,
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  bathroomCount: 1,
  occupancyCount: 3,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  occupancySignature: 'professional',
  buildingMass: 'medium',
  highOccupancy: false,
  preferCombi: true,
  currentHeatSourceType: 'combi',
};

// ─── Type definitions ─────────────────────────────────────────────────────────

export type DevUiCategory =
  | 'simulator'
  | 'visualiser'
  | 'journey'
  | 'presentation'
  | 'assessment'
  | 'report'
  | 'utility'
  | 'audit'
  | 'deprecated'
  | 'unknown';

export type DevUiStatus = 'canonical' | 'active' | 'experimental' | 'review' | 'duplicate' | 'deprecated' | 'remove';

/**
 * Who may access this surface.
 * - production – reachable by real users in production
 * - dev_only   – developer / internal access only (query flag or dev menu)
 * - fallback   – used as a fallback / degraded path
 * - review     – still under evaluation; not yet production-confirmed
 */
export type DevUiAccess = 'production' | 'dev_only' | 'fallback' | 'review';

/**
 * How this surface is reached.
 * - path        – absolute URL pathname (e.g. /floor-plan-tool)
 * - query_flag  – URL query param (e.g. ?lab=1)
 * - derived     – reached through internal state / journey (no URL change)
 * - unknown     – route not yet resolved — do not invent a value
 */
export type DevUiRouteKind = 'path' | 'query_flag' | 'derived' | 'unknown';

export interface DevUiRegistryItem {
  /** Unique identifier for this entry. */
  id: string;
  /** Human-readable label shown in the browser. Falls back to codeName if not yet assigned. */
  commonName: string;
  /** Exact export/component name in the source file (e.g. ExplainersHubPage). */
  codeName: string;
  /** Exact source file name (including extension). */
  fileName: string;
  /** Relative path from repo root. */
  filePath: string;
  /** Functional category for filtering. */
  category: DevUiCategory;
  /**
   * Lifecycle status.
   * - canonical   – the definitive, production-live surface for its category
   * - active      – in use, not yet promoted to canonical
   * - experimental – work-in-progress / preview
   * - review      – needs decision: keep, rename, or remove
   * - duplicate   – a second surface that overlaps with a canonical one
   * - deprecated  – scheduled for removal; still browsable for review
   * - remove      – confirmed for deletion
   */
  status: DevUiStatus;
  /** Optional human note explaining the component's purpose or deprecation reason. */
  notes?: string;
  /**
   * Returns the component rendered with sensible preview defaults.
   * Required onBack/navigation props receive a noop here; the preview page
   * provides its own back button.
   */
  render: () => ReactNode;

  // ── Route / access metadata ────────────────────────────────────────────────

  /** Absolute pathname if the surface has a URL path route. */
  routePath?: string;
  /** URL query flag(s) that activate this surface, e.g. ['lab=1']. */
  queryFlags?: string[];
  /** Ready-to-paste full route example, e.g. '/?lab=1'. */
  fullRouteExample?: string;
  /** How this surface is reached. Default: 'unknown'. */
  routeKind?: DevUiRouteKind;
  /** Who may access this surface. Default: 'dev_only'. */
  access?: DevUiAccess;

  // ── Hierarchy metadata ─────────────────────────────────────────────────────

  /** codeName of the parent surface that contains or leads to this one. */
  parentCodeName?: string;
  /** IDs of child surfaces contained within this surface. */
  childElementIds?: string[];
  /** Additional source files used by this surface (beyond the main fileName). */
  sourceFiles?: string[];
  /** Route IDs or codeNames of surfaces that link into this one. */
  usedByRoutes?: string[];

  // ── Copy-box ──────────────────────────────────────────────────────────────

  /** Include this item in the copy-box output. Also included if status=canonical or access=production. */
  includeInCopyBox?: boolean;
  /** Override label used in copy-box output. Defaults to commonName. */
  copyLabel?: string;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * The curated manifest of Atlas UI surfaces.
 *
 * Ordering: canonical surfaces first, then by category, then alphabetically.
 */
export const DEV_UI_REGISTRY: DevUiRegistryItem[] = [
  // ── Simulator ──────────────────────────────────────────────────────────────
  {
    id: 'explainers-hub',
    commonName: 'Real Simulator',
    codeName: 'ExplainersHubPage',
    fileName: 'ExplainersHubPage.tsx',
    filePath: 'src/explainers/ExplainersHubPage.tsx',
    category: 'simulator',
    status: 'canonical',
    notes:
      'The canonical System Simulator / System Lab experience. ' +
      'Only this surface and SimulatorDashboard may use the "Simulator" label.',
    routeKind: 'query_flag',
    queryFlags: ['lab=1'],
    fullRouteExample: '/?lab=1',
    access: 'production',
    childElementIds: ['lab-shell', 'draw-off-workbench'],
    sourceFiles: ['src/explainers/ExplainersHubPage.tsx', 'src/explainers/lego/simulator/SimulatorDashboard.tsx'],
    includeInCopyBox: true,
    render: () => <ExplainersHubPage onBack={() => undefined} />,
  },

  // ── Lego Building Set ──────────────────────────────────────────────────────
  {
    id: 'lego-building-set',
    commonName: 'Lego Building Set',
    codeName: 'LegoBuildingSetPage',
    fileName: 'LegoBuildingSetPage.tsx',
    filePath: 'src/explainers/lego/LegoBuildingSetPage.tsx',
    category: 'simulator',
    status: 'active',
    notes:
      'Interactive drag-and-drop workbench for assembling heating systems from ' +
      'first-principles blocks — boilers, cylinders, emitters and controls. ' +
      'Accessible from the main landing page.',
    routeKind: 'derived',
    access: 'production',
    sourceFiles: [
      'src/explainers/lego/LegoBuildingSetPage.tsx',
      'src/explainers/lego/builder/BuilderShell.tsx',
    ],
    includeInCopyBox: false,
    render: () => <LegoBuildingSetPage onBack={() => undefined} />,
  },

  // ── Presentation ──────────────────────────────────────────────────────────
  {
    id: 'canonical-presentation',
    commonName: 'Presentation Deck',
    codeName: 'CanonicalPresentationPage',
    fileName: 'CanonicalPresentationPage.tsx',
    filePath: 'src/components/presentation/CanonicalPresentationPage.tsx',
    category: 'presentation',
    status: 'canonical',
    notes:
      'Full multi-page recommendation presentation shown to customers. ' +
      'Rendered here with demo inputs in vertical (non-deck) mode.',
    routeKind: 'query_flag',
    queryFlags: ['presentation=1'],
    fullRouteExample: '/?presentation=1',
    access: 'production',
    sourceFiles: [
      'src/components/presentation/CanonicalPresentationPage.tsx',
      'src/components/presentation/PresentationDeck.tsx',
      'src/components/presentation/buildCanonicalPresentation.ts',
    ],
    usedByRoutes: ['full-survey-stepper'],
    includeInCopyBox: true,
    render: () => (
      <CanonicalPresentationPage
        result={runEngine(DEV_DEMO_INPUT)}
        input={DEV_DEMO_INPUT}
        deckMode={false}
      />
    ),
  },

  // ── Visualisers ────────────────────────────────────────────────────────────
  {
    id: 'lifestyle-interactive',
    commonName: 'Lifestyle Interactive',
    codeName: 'LifestyleInteractive',
    fileName: 'LifestyleInteractive.tsx',
    filePath: 'src/components/visualizers/LifestyleInteractive.tsx',
    category: 'visualiser',
    status: 'active',
    routeKind: 'derived',
    fullRouteExample: 'unresolved — embedded in simulator',
    access: 'dev_only',
    parentCodeName: 'ExplainersHubPage',
    render: () => <LifestyleInteractive />,
  },
  {
    id: 'lifestyle-interactive-compare',
    commonName: 'Lifestyle Compare (2-System)',
    codeName: 'LifestyleInteractiveCompare',
    fileName: 'LifestyleInteractiveCompare.tsx',
    filePath: 'src/components/visualizers/LifestyleInteractiveCompare.tsx',
    category: 'visualiser',
    status: 'experimental',
    notes:
      '2-system side-by-side comparison using the same 24-hour occupancy painter. ' +
      'Both systems receive an identical demand timeline; only system response differs. ' +
      'All chart data from LifestyleSimulationModule.hourlyData — No Theatre rule enforced.',
    routeKind: 'unknown',
    access: 'dev_only',
    sourceFiles: [
      'src/components/visualizers/LifestyleInteractiveCompare.tsx',
      'src/components/compare/CompareSystemPicker.tsx',
      'src/engine/modules/LifestyleSimulationModule.ts',
    ],
    render: () => <LifestyleInteractiveCompare />,
  },
  {
    id: 'glass-box-panel',
    commonName: 'Glass Box Panel',
    codeName: 'GlassBoxPanel',
    fileName: 'GlassBoxPanel.tsx',
    filePath: 'src/components/visualizers/GlassBoxPanel.tsx',
    category: 'visualiser',
    status: 'active',
    routeKind: 'derived',
    fullRouteExample: 'unresolved — embedded in simulator',
    access: 'dev_only',
    parentCodeName: 'ExplainersHubPage',
    render: () => <GlassBoxPanel results={runEngine(DEV_DEMO_INPUT)} />,
  },
  {
    id: 'efficiency-curve',
    commonName: 'Efficiency Curve',
    codeName: 'EfficiencyCurve',
    fileName: 'EfficiencyCurve.tsx',
    filePath: 'src/components/visualizers/EfficiencyCurve.tsx',
    category: 'visualiser',
    status: 'active',
    routeKind: 'derived',
    fullRouteExample: 'unresolved — embedded in simulator',
    access: 'dev_only',
    parentCodeName: 'ExplainersHubPage',
    render: () => <EfficiencyCurve />,
  },
  {
    id: 'footprint-xray',
    commonName: 'Footprint X-Ray',
    codeName: 'FootprintXRay',
    fileName: 'FootprintXRay.tsx',
    filePath: 'src/components/visualizers/FootprintXRay.tsx',
    category: 'visualiser',
    status: 'active',
    notes: 'Rendered with demo values: Mixergy 180 L vs conventional 210 L.',
    routeKind: 'derived',
    fullRouteExample: 'unresolved — embedded in simulator',
    access: 'dev_only',
    parentCodeName: 'ExplainersHubPage',
    render: () => <FootprintXRay mixergyLitres={180} conventionalLitres={210} />,
  },

  // ── Journeys ────────────────────────────────────────────────────────────────
  {
    id: 'fast-choice-stepper',
    commonName: 'Fast Choice Stepper',
    codeName: 'FastChoiceStepper',
    fileName: 'FastChoiceStepper.tsx',
    filePath: 'src/components/stepper/FastChoiceStepper.tsx',
    category: 'journey',
    status: 'active',
    routeKind: 'derived',
    fullRouteExample: 'landing → "Quick check" card',
    access: 'production',
    usedByRoutes: ['explainers-hub'],
    includeInCopyBox: true,
    render: () => <FastChoiceStepper onBack={() => undefined} />,
  },
  {
    id: 'full-survey-stepper',
    commonName: 'Full Survey Stepper',
    codeName: 'FullSurveyStepper',
    fileName: 'FullSurveyStepper.tsx',
    filePath: 'src/components/stepper/FullSurveyStepper.tsx',
    category: 'journey',
    status: 'active',
    notes: 'The canonical technical input journey. Feeds System Lab and the Presentation Deck.',
    routeKind: 'derived',
    fullRouteExample: 'landing → "Full survey" card',
    access: 'production',
    usedByRoutes: ['lab-shell', 'canonical-presentation'],
    includeInCopyBox: true,
    render: () => <FullSurveyStepper onBack={() => undefined} />,
  },

  // ── Assessment / Lab ────────────────────────────────────────────────────────
  {
    id: 'lab-shell',
    commonName: 'System Lab',
    codeName: 'LabShell',
    fileName: 'LabShell.tsx',
    filePath: 'src/components/lab/LabShell.tsx',
    category: 'assessment',
    status: 'active',
    notes: 'Full System Lab shell with tabbed view. Normally accessed after completing a survey.',
    routeKind: 'derived',
    fullRouteExample: 'landing → "System Lab" card',
    access: 'production',
    childElementIds: ['draw-off-workbench'],
    usedByRoutes: ['full-survey-stepper'],
    includeInCopyBox: true,
    render: () => <LabShell onHome={() => undefined} engineInput={DEV_DEMO_INPUT} />,
  },
  {
    id: 'draw-off-workbench',
    commonName: 'Hot Water Workbench',
    codeName: 'DrawOffWorkbench',
    fileName: 'DrawOffWorkbench.tsx',
    filePath: 'src/components/lab/DrawOffWorkbench.tsx',
    category: 'assessment',
    status: 'active',
    notes: 'Visual draw-off workbench showing hot water performance by system type. Part of System Lab.',
    routeKind: 'derived',
    fullRouteExample: 'unresolved — embedded in System Lab',
    access: 'dev_only',
    parentCodeName: 'LabShell',
    render: () => <DrawOffWorkbench />,
  },
  {
    id: 'atlas-explorer',
    commonName: 'System Explorer',
    codeName: 'AtlasExplorerPage',
    fileName: 'AtlasExplorerPage.tsx',
    filePath: 'src/components/explorer/AtlasExplorerPage.tsx',
    category: 'assessment',
    status: 'review',
    notes: 'Advanced physics explorer with system diagram, heat source panel and room breakdown. Normally accessed via ?explorer=1.',
    routeKind: 'query_flag',
    queryFlags: ['explorer=1'],
    fullRouteExample: '/?explorer=1',
    access: 'review',
    includeInCopyBox: true,
    render: () => <AtlasExplorerPage onBack={() => undefined} />,
  },

  // ── Audit ───────────────────────────────────────────────────────────────────
  {
    id: 'presentation-audit',
    commonName: 'Presentation Audit',
    codeName: 'PresentationAuditPage',
    fileName: 'PresentationAuditPage.tsx',
    filePath: 'src/components/audit/PresentationAuditPage.tsx',
    category: 'audit',
    status: 'active',
    notes: 'Internal audit surface for the presentation engine. Normally accessed via ?audit=1.',
    routeKind: 'query_flag',
    queryFlags: ['audit=1'],
    fullRouteExample: '/?audit=1',
    access: 'dev_only',
    includeInCopyBox: true,
    render: () => <PresentationAuditPage />,
  },

  // ── Visit Workspaces ────────────────────────────────────────────────────────
  {
    id: 'visit-workspace-home',
    commonName: 'Visit Workspaces',
    codeName: 'WorkspaceHomePage',
    fileName: 'WorkspaceHomePage.tsx',
    filePath: 'src/features/workspace/WorkspaceHomePage.tsx',
    category: 'journey',
    status: 'active',
    notes: 'Local / Drive workspace home page. Import scan captures, open recent workspaces. No DB write until publish.',
    routeKind: 'path',
    routePath: '/workspace',
    fullRouteExample: '/workspace',
    access: 'production',
    childElementIds: ['visit-workspace-detail'],
    includeInCopyBox: true,
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>WorkspaceHomePage — preview requires a live /workspace route</div>,
  },
  {
    id: 'visit-workspace-detail',
    commonName: 'Workspace Detail',
    codeName: 'WorkspaceDetailPage',
    fileName: 'WorkspaceDetailPage.tsx',
    filePath: 'src/features/workspace/WorkspaceDetailPage.tsx',
    category: 'journey',
    status: 'active',
    notes: 'Single workspace detail view. Shows captured evidence, action buttons, status badges.',
    routeKind: 'path',
    routePath: '/workspace/:id',
    fullRouteExample: '/workspace/<workspace-id>',
    access: 'production',
    parentCodeName: 'WorkspaceHomePage',
    includeInCopyBox: true,
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>WorkspaceDetailPage — preview requires a workspace ID from /workspace</div>,
  },
];
