/**
 * devUiRegistry.tsx
 *
 * Central manifest of all Atlas UI surfaces for the developer component browser.
 *
 * Each entry is curated — do NOT auto-generate this list from the filesystem.
 * Add entries intentionally and keep commonName, fileName and filePath in sync
 * with the actual source files.
 *
 * NOT customer-facing. Accessible via the Dev Menu (/dev/devmenu or legacy ?devmenu=1).
 */

import type { ReactNode } from 'react';
import ExplainersHubPage from '../explainers/ExplainersHubPage';
import PrototypeComposerPage from '../legacy/systemComposerPrototype/PrototypeComposerPage';
import LifestyleInteractive from '../legacy/dayPainterPrototype/LifestyleInteractive';
import LifestyleInteractiveCompare from '../legacy/dayPainterPrototype/LifestyleInteractiveCompare';
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
import HouseSimulatorPage from '../features/houseSimulator/HouseSimulatorPage';
import { WorkspaceVisitLifecycleHarness } from './workspaceQa';
import PhoneFirstQaHarness from './PhoneFirstQaHarness';
import { PortalJourneyPrintPack } from '../library/portal/pdf/PortalJourneyPrintPack';
import { buildPortalJourneyPrintModel } from '../library/portal/pdf/buildPortalJourneyPrintModel';
import {
  getVisualEducationLibrarySurface,
  VISUAL_EDUCATION_LIBRARY_QA_HUB,
} from './visualEducationLibrary';
import { buildCanonicalRegistry } from './canonicalRegistry';
import { buildLegacyRegistry } from './legacyRegistry';
import { buildExperimentalRegistry } from './experimentalRegistry';

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
 * - legacy_dev_only – deprecated surface kept only for explicit legacy diagnostics
 * - fallback   – used as a fallback / degraded path
 * - review     – still under evaluation; not yet production-confirmed
 */
export type DevUiAccess = 'production' | 'dev_only' | 'legacy_dev_only' | 'fallback' | 'review' | 'retired';

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
  /** Team or discipline responsible for the surface. */
  owner?: string;
  /** Product domain where the surface is authoritative. */
  domain?: string;

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

  // ── Rendering layer ────────────────────────────────────────────────────────

  /**
   * Which rendering architecture this surface uses.
   *
   * - scene_grammar   – uses CustomerJourneyPackV1 / LibraryStorySceneV1 scene-first composition
   * - transitional    – partially scene-aware but still imports or exposes legacy renderer paths
   * - legacy_sections – driven by old card / section / report patterns; no scene grammar
   *
   * Surfaces without this field have not yet been assessed.
   *
   * The goal is for all canonical/active customer-facing surfaces to reach scene_grammar.
   */
  renderingLayer?: 'scene_grammar' | 'transitional' | 'legacy_sections';

  /**
   * Set to true when this active surface still imports or can render a legacy component.
   * Shown as a dev warning in the UI Inventory so the renderer leakage is visible.
   */
  legacyRendererLeak?: boolean;
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
    sourceFiles: ['src/explainers/ExplainersHubPage.tsx', 'src/legacy/systemComposerPrototype/simulator/SimulatorDashboard.tsx'],
    includeInCopyBox: true,
    render: () => <ExplainersHubPage onBack={() => undefined} />,
  },
  {
    id: 'house-simulator-page',
    commonName: 'House Simulator',
    codeName: 'HouseSimulatorPage',
    fileName: 'HouseSimulatorPage.tsx',
    filePath: 'src/features/houseSimulator/HouseSimulatorPage.tsx',
    category: 'simulator',
    status: 'canonical',
    notes:
      'Canonical production house simulator for Visit Review. ' +
      'Authoritative simulator surface for /?house-simulator=1 and Visit Home CTA routing.',
    routeKind: 'query_flag',
    queryFlags: ['house-simulator=1'],
    fullRouteExample: '/?house-simulator=1',
    access: 'production',
    owner: 'simulator',
    domain: 'visit review',
    sourceFiles: [
      'src/features/houseSimulator/HouseSimulatorPage.tsx',
      'src/features/houseSimulator/buildHouseSimulatorViewModel.ts',
    ],
    usedByRoutes: ['VisitHomeDashboard'],
    includeInCopyBox: true,
    render: () => <HouseSimulatorPage onBack={() => undefined} surveyData={DEV_DEMO_INPUT} />,
  },

  // ── Legacy System Composer (archived prototype — NOT LegoTechnix) ───────────
  {
    id: 'legacy-prototype-composer',
    commonName: 'Legacy Prototype Composer (Archived)',
    codeName: 'PrototypeComposerPage',
    fileName: 'PrototypeComposerPage.tsx',
    filePath: 'src/legacy/systemComposerPrototype/PrototypeComposerPage.tsx',
    category: 'simulator',
    status: 'deprecated',
    notes:
      'Archived system-composer prototype retained for explicit legacy diagnostics only. ' +
      'NOT LegoTechnix — the active LegoTechnix simulation engine lives in src/features/legoTechnix/ ' +
      'and is accessed via the lego-technix-debug-projection-page entry.',
    routeKind: 'derived',
    access: 'legacy_dev_only',
    domain: 'legacy/systemComposerPrototype',
    sourceFiles: [
      'src/legacy/systemComposerPrototype/PrototypeComposerPage.tsx',
      'src/legacy/systemComposerPrototype/builder/BuilderShell.tsx',
    ],
    includeInCopyBox: false,
    renderingLayer: 'legacy_sections',
    render: () => <PrototypeComposerPage onBack={() => undefined} />,
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
      'Rendered here with demo inputs in vertical (non-deck) mode. ' +
      'RENDERING LAYER NOTE: currently driven by legacy section/card patterns ' +
      '(buildCanonicalPresentation → CanonicalPresentationModel). ' +
      'Target architecture is scene-grammar composition from CustomerJourneyPackV1.',
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
    renderingLayer: 'legacy_sections',
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
    filePath: 'src/legacy/dayPainterPrototype/LifestyleInteractive.tsx',
    category: 'visualiser',
    status: 'deprecated',
    notes:
      'Legacy Day Painter visualiser. Deprecated in favour of the canonical Explainers Hub experience.',
    routeKind: 'derived',
    fullRouteExample: 'unresolved — legacy visualiser preview',
    access: 'legacy_dev_only',
    domain: 'legacy/dayPainterPrototype',
    parentCodeName: 'ExplainersHubPage',
    render: () => <LifestyleInteractive />,
  },
  {
    id: 'lifestyle-interactive-compare',
    commonName: 'Lifestyle Compare (2-System)',
    codeName: 'LifestyleInteractiveCompare',
    fileName: 'LifestyleInteractiveCompare.tsx',
    filePath: 'src/legacy/dayPainterPrototype/LifestyleInteractiveCompare.tsx',
    category: 'visualiser',
    status: 'deprecated',
    notes:
      'Legacy Day Painter compare prototype retained only for archived diagnostics.',
    routeKind: 'unknown',
    access: 'legacy_dev_only',
    domain: 'legacy/dayPainterPrototype',
    sourceFiles: [
      'src/legacy/dayPainterPrototype/LifestyleInteractiveCompare.tsx',
      'src/legacy/dayPainterPrototype/CompareSystemPicker.tsx',
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
  {
    id: 'workspace-visit-lifecycle-harness',
    commonName: 'Workspace Visit Lifecycle QA Harness',
    codeName: 'WorkspaceVisitLifecycleHarness',
    fileName: 'WorkspaceVisitLifecycleHarness.tsx',
    filePath: 'src/dev/workspaceQa/WorkspaceVisitLifecycleHarness.tsx',
    category: 'audit',
    status: 'experimental',
    notes:
      'Deterministic QA surface for workspace-scoped visit lifecycle, ownership, branding, storage and export/import checks.',
    routeKind: 'query_flag',
    queryFlags: ['workspace-lifecycle-qa=1'],
    fullRouteExample: '/?workspace-lifecycle-qa=1',
    access: 'dev_only',
    render: () => <WorkspaceVisitLifecycleHarness />,
  },
  {
    id: 'phone-first-qa-harness',
    commonName: 'Phone customer QA',
    codeName: 'PhoneFirstQaHarness',
    fileName: 'PhoneFirstQaHarness.tsx',
    filePath: 'src/dev/PhoneFirstQaHarness.tsx',
    category: 'audit',
    status: 'active',
    notes:
      'Phone-first QA harness for customer-facing portal, simulator, deep-link landing, and reading preferences checks.',
    routeKind: 'query_flag',
    queryFlags: ['phone-customer-qa=1'],
    fullRouteExample: '/?phone-customer-qa=1',
    access: 'dev_only',
    render: () => <PhoneFirstQaHarness />,
  },
  {
    id: 'lego-technix-debug-projection-page',
    commonName: 'LegoTechnix Debug Projection Surface',
    codeName: 'LegoTechnixDebugProjectionPage',
    fileName: 'LegoTechnixDebugProjectionPage.tsx',
    filePath: 'src/features/legoTechnix/debug/LegoTechnixDebugProjectionPage.tsx',
    category: 'audit',
    status: 'active',
    notes:
      'Dev-only engineering projection renderer for canonical LegoTechnix systems and timeline scrubbing. ' +
      'ACTIVE feature — NOT the legacy system-composer prototype. ' +
      'LegoTechnix is a pure simulation/data engine in src/features/legoTechnix/ with no legacy palette dependency. ' +
      'The legacy palette UI lives only in Visuals Gallery → Legacy System Composer Palette (Archived).',
    routeKind: 'query_flag',
    queryFlags: ['lego-technix-debug=1'],
    fullRouteExample: '/?lego-technix-debug=1',
    access: 'dev_only',
    domain: 'features/legoTechnix',
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>LegoTechnixDebugProjectionPage — open via /?lego-technix-debug=1.</div>,
  },
  {
    id: 'component-discovery-panel',
    commonName: 'Component Discovery',
    codeName: 'ComponentDiscoveryPanel',
    fileName: 'ComponentDiscoveryPanel.tsx',
    filePath: 'src/components/dev/ComponentDiscoveryPanel.tsx',
    category: 'utility',
    status: 'active',
    notes:
      'Developer route auditor for page surfaces plus unrouted component discovery across visual/dev candidates.',
    routeKind: 'path',
    routePath: '/dev/inspector',
    fullRouteExample: '/dev/inspector',
    access: 'dev_only',
    render: () => (
      <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>
        ComponentDiscoveryPanel — open via /dev/inspector or Dev Menu → Component Discovery.
      </div>
    ),
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
  {
    id: 'visit-home-dashboard',
    commonName: 'Visit Home Dashboard',
    codeName: 'VisitHomeDashboard',
    fileName: 'VisitHomeDashboard.tsx',
    filePath: 'src/features/visitHome/VisitHomeDashboard.tsx',
    category: 'journey',
    status: 'active',
    notes: 'Primary post-survey visit dashboard. Opens simulator, customer portal, supporting PDF, and implementation workflow.',
    routeKind: 'derived',
    fullRouteExample: 'workspace dashboard → open visit → Visit Home Dashboard',
    access: 'production',
    includeInCopyBox: true,
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>VisitHomeDashboard — open an active visit from Workspace Dashboard.</div>,
  },
  {
    id: 'workspace-settings-page',
    commonName: 'Workspace Settings',
    codeName: 'WorkspaceSettingsPage',
    fileName: 'WorkspaceSettingsPage.tsx',
    filePath: 'src/features/workspace/WorkspaceSettingsPage.tsx',
    category: 'journey',
    status: 'active',
    notes: 'Workspace admin controls (policy, onboarding, branding, exports).',
    routeKind: 'path',
    routePath: '/workspace/settings',
    fullRouteExample: '/workspace/settings',
    access: 'production',
    includeInCopyBox: true,
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>WorkspaceSettingsPage — preview requires workspace session context.</div>,
  },
  {
    id: 'dev-portal-fixture-page',
    commonName: 'Portal Fixtures',
    codeName: 'DevPortalFixturePage',
    fileName: 'DevPortalFixturePage.tsx',
    filePath: 'src/dev/DevPortalFixturePage.tsx',
    category: 'audit',
    status: 'active',
    notes: 'Dev-only fixture diagnostics for legacy, library, and implementation surfaces. Not production portal.',
    routeKind: 'path',
    routePath: '/dev/portal-fixtures',
    fullRouteExample: '/dev/portal-fixtures',
    access: 'dev_only',
    childElementIds: [
      'library-projection-qa-panel',
      'library-coverage-audit-panel',
      'library-authoring-backlog-panel',
      'implementation-pack-review-panel',
    ],
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>DevPortalFixturePage — open via /dev/portal-fixtures.</div>,
  },
  {
    id: 'customer-pack-preview-page',
    commonName: 'Customer Pack Preview',
    codeName: 'CustomerPackPreviewPage',
    fileName: 'CustomerPackPreviewPage.tsx',
    filePath: 'src/dev/CustomerPackPreviewPage.tsx',
    category: 'audit',
    status: 'active',
    notes: 'Dev preview for evidence-driven CustomerEvidencePackV1 pipeline. Selects canonical template, runs full pipeline, and renders via CustomerPackRendererV1 with print/PDF export.',
    routeKind: 'path',
    routePath: '/dev/customer-pack-preview',
    fullRouteExample: '/dev/customer-pack-preview',
    access: 'dev_only',
    includeInCopyBox: true,
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>CustomerPackPreviewPage — open via /dev/customer-pack-preview.</div>,
  },
  {
    id: 'customer-portal-preview-page',
    commonName: 'Customer Portal Preview (Prod-like)',
    codeName: 'CustomerPortalPreviewPage',
    fileName: 'CustomerPortalPreviewPage.tsx',
    filePath: 'src/dev/CustomerPortalPreviewPage.tsx',
    category: 'audit',
    status: 'active',
    notes: 'Dev production-like customer portal preview route. Renders CustomerPortalPage in production portal mode using fixture input. Not DevPortalFixturePage.',
    routeKind: 'path',
    routePath: '/dev/customer-portal-preview',
    fullRouteExample: '/dev/customer-portal-preview',
    access: 'dev_only',
    includeInCopyBox: true,
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>CustomerPortalPreviewPage — open via /dev/customer-portal-preview.</div>,
  },
  {
    id: 'library-explorer-page',
    commonName: 'Library Explorer',
    codeName: 'LibraryExplorerPage',
    fileName: 'LibraryExplorerPage.tsx',
    filePath: 'src/library/dev/LibraryExplorerPage.tsx',
    category: 'audit',
    status: 'canonical',
    notes: 'Canonical library browser for concepts, journeys, diagrams, animations, lived-experience cards, print fallbacks, and projection status.',
    routeKind: 'path',
    routePath: '/dev/library-explorer',
    queryFlags: ['library-explorer=1'],
    fullRouteExample: '/dev/library-explorer',
    access: 'dev_only',
    parentCodeName: 'DevPortalFixturePage',
    includeInCopyBox: true,
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>LibraryExplorerPage — open via /dev/library-explorer.</div>,
  },
  {
    id: VISUAL_EDUCATION_LIBRARY_QA_HUB.id,
    commonName: VISUAL_EDUCATION_LIBRARY_QA_HUB.commonName,
    codeName: VISUAL_EDUCATION_LIBRARY_QA_HUB.codeName,
    fileName: 'VisualEducationLibraryQaHubPage.tsx',
    filePath: 'src/library/dev/VisualEducationLibraryQaHubPage.tsx',
    category: 'audit',
    status: 'canonical',
    notes: `${VISUAL_EDUCATION_LIBRARY_QA_HUB.description} Canonical visual authority hub for library-first routes.`,
    routeKind: 'path',
    routePath: VISUAL_EDUCATION_LIBRARY_QA_HUB.routePath,
    queryFlags: [VISUAL_EDUCATION_LIBRARY_QA_HUB.queryFlag],
    fullRouteExample: VISUAL_EDUCATION_LIBRARY_QA_HUB.routePath,
    access: 'dev_only',
    parentCodeName: 'DevPortalFixturePage',
    childElementIds: [
      'visual-primitive-gallery',
      'visual-topology-gallery',
      'analogy-overlay-gallery',
      'sealed-unvented-explainer-slice',
      'diagram-fixture-page',
    ],
    includeInCopyBox: true,
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>VisualEducationLibraryQaHubPage — open via /dev/visual-education-library.</div>,
  },
  {
    id: 'diagram-fixture-page',
    commonName: 'Diagram Fixture',
    codeName: 'DiagramFixturePage',
    fileName: 'DiagramFixturePage.tsx',
    filePath: 'src/library/dev/DiagramFixturePage.tsx',
    category: 'audit',
    status: 'canonical',
    notes: 'Dev visual QA fixture showing mobile-width and print-width versions of all registered diagrams.',
    routeKind: 'path',
    routePath: '/dev/diagram-fixture',
    queryFlags: ['diagram-fixture=1'],
    fullRouteExample: '/dev/diagram-fixture',
    access: 'dev_only',
    parentCodeName: 'VisualEducationLibraryQaHubPage',
    includeInCopyBox: true,
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>DiagramFixturePage — open via /dev/diagram-fixture.</div>,
  },
  {
    id: getVisualEducationLibrarySurface('VisualPrimitiveGallery').id,
    commonName: getVisualEducationLibrarySurface('VisualPrimitiveGallery').commonName,
    codeName: getVisualEducationLibrarySurface('VisualPrimitiveGallery').codeName,
    fileName: 'VisualPrimitiveGallery.tsx',
    filePath: 'src/library/visualPrimitives/VisualPrimitiveGallery.tsx',
    category: 'audit',
    status: 'canonical',
    notes: `Visual Education Library — ${getVisualEducationLibrarySurface('VisualPrimitiveGallery').description}`,
    routeKind: 'path',
    routePath: getVisualEducationLibrarySurface('VisualPrimitiveGallery').routePath,
    queryFlags: [getVisualEducationLibrarySurface('VisualPrimitiveGallery').queryFlag],
    fullRouteExample: getVisualEducationLibrarySurface('VisualPrimitiveGallery').routePath,
    access: 'dev_only',
    parentCodeName: 'VisualEducationLibraryQaHubPage',
    includeInCopyBox: true,
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>VisualPrimitiveGallery — open via /dev/visual-primitive-gallery.</div>,
  },
  {
    id: getVisualEducationLibrarySurface('VisualTopologyGallery').id,
    commonName: getVisualEducationLibrarySurface('VisualTopologyGallery').commonName,
    codeName: getVisualEducationLibrarySurface('VisualTopologyGallery').codeName,
    fileName: 'VisualTopologyGallery.tsx',
    filePath: 'src/library/visualTopologies/VisualTopologyGallery.tsx',
    category: 'audit',
    status: 'canonical',
    notes: `Visual Education Library — ${getVisualEducationLibrarySurface('VisualTopologyGallery').description}`,
    routeKind: 'path',
    routePath: getVisualEducationLibrarySurface('VisualTopologyGallery').routePath,
    queryFlags: [getVisualEducationLibrarySurface('VisualTopologyGallery').queryFlag],
    fullRouteExample: getVisualEducationLibrarySurface('VisualTopologyGallery').routePath,
    access: 'dev_only',
    parentCodeName: 'VisualEducationLibraryQaHubPage',
    includeInCopyBox: true,
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>VisualTopologyGallery — open via /dev/visual-topology-gallery.</div>,
  },
  {
    id: getVisualEducationLibrarySurface('AnalogyOverlayGallery').id,
    commonName: getVisualEducationLibrarySurface('AnalogyOverlayGallery').commonName,
    codeName: getVisualEducationLibrarySurface('AnalogyOverlayGallery').codeName,
    fileName: 'AnalogyOverlayGallery.tsx',
    filePath: 'src/library/analogyOverlays/AnalogyOverlayGallery.tsx',
    category: 'audit',
    status: 'canonical',
    notes: `Visual Education Library — ${getVisualEducationLibrarySurface('AnalogyOverlayGallery').description}`,
    routeKind: 'path',
    routePath: getVisualEducationLibrarySurface('AnalogyOverlayGallery').routePath,
    queryFlags: [getVisualEducationLibrarySurface('AnalogyOverlayGallery').queryFlag],
    fullRouteExample: getVisualEducationLibrarySurface('AnalogyOverlayGallery').routePath,
    access: 'dev_only',
    parentCodeName: 'VisualEducationLibraryQaHubPage',
    includeInCopyBox: true,
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>AnalogyOverlayGallery — open via /dev/analogy-overlay-gallery.</div>,
  },
  {
    id: getVisualEducationLibrarySurface('SealedUnventedExplainerSlicePage').id,
    commonName: getVisualEducationLibrarySurface('SealedUnventedExplainerSlicePage').commonName,
    codeName: getVisualEducationLibrarySurface('SealedUnventedExplainerSlicePage').codeName,
    fileName: 'SealedUnventedExplainerSlicePage.tsx',
    filePath: 'src/library/dev/SealedUnventedExplainerSlicePage.tsx',
    category: 'audit',
    status: 'active',
    notes: `Visual Education Library — ${getVisualEducationLibrarySurface('SealedUnventedExplainerSlicePage').description}`,
    routeKind: 'path',
    routePath: getVisualEducationLibrarySurface('SealedUnventedExplainerSlicePage').routePath,
    queryFlags: [getVisualEducationLibrarySurface('SealedUnventedExplainerSlicePage').queryFlag],
    fullRouteExample: getVisualEducationLibrarySurface('SealedUnventedExplainerSlicePage').routePath,
    access: 'dev_only',
    parentCodeName: 'VisualEducationLibraryQaHubPage',
    includeInCopyBox: true,
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>SealedUnventedExplainerSlicePage — open via /dev/sealed-unvented-explainer-slice.</div>,
  },
  {
    id: 'unified-simulator-view',
    commonName: 'Portal Unified View Wrapper',
    codeName: 'UnifiedSimulatorView',
    fileName: 'UnifiedSimulatorView.tsx',
    filePath: 'src/components/simulator/UnifiedSimulatorView.tsx',
    category: 'simulator',
    status: 'deprecated',
    notes: 'Legacy portal insight wrapper retained for explicit legacy diagnostics only; canonical production simulator is house-simulator.',
    routeKind: 'derived',
    fullRouteExample: '/?insight-pack=1 (legacy diagnostics only)',
    access: 'legacy_dev_only',
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>UnifiedSimulatorView — legacy diagnostic only; open via /?insight-pack=1.</div>,
  },
  {
    id: 'library-coverage-audit-panel',
    commonName: 'Library Coverage QA',
    codeName: 'LibraryCoverageAuditPanel',
    fileName: 'LibraryCoverageAuditPanel.tsx',
    filePath: 'src/library/coverage/LibraryCoverageAuditPanel.tsx',
    category: 'audit',
    status: 'active',
    notes: 'Library concept coverage diagnostics. Mounted in welcome-pack diagnostics and portal fixtures workflow.',
    routeKind: 'derived',
    fullRouteExample: '/dev/welcome-pack → Diagnostics · /dev/portal-fixtures → workflow',
    access: 'dev_only',
    parentCodeName: 'DevPortalFixturePage',
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>LibraryCoverageAuditPanel — open via welcome-pack diagnostics or portal fixtures workflow.</div>,
  },
  {
    id: 'library-authoring-backlog-panel',
    commonName: 'Library Authoring Backlog',
    codeName: 'LibraryAuthoringBacklogPanel',
    fileName: 'LibraryAuthoringBacklogPanel.tsx',
    filePath: 'src/library/coverage/backlog/LibraryAuthoringBacklogPanel.tsx',
    category: 'audit',
    status: 'active',
    notes: 'Authoring backlog generated from coverage gaps.',
    routeKind: 'derived',
    fullRouteExample: '/dev/welcome-pack → Diagnostics · /dev/portal-fixtures → workflow',
    access: 'dev_only',
    parentCodeName: 'DevPortalFixturePage',
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>LibraryAuthoringBacklogPanel — open via diagnostics surfaces.</div>,
  },
  {
    id: 'library-projection-qa-panel',
    commonName: 'Library Projection QA',
    codeName: 'LibraryProjectionQaPanel',
    fileName: 'LibraryProjectionQaPanel.tsx',
    filePath: 'src/library/projections/dev/LibraryProjectionQaPanel.tsx',
    category: 'audit',
    status: 'active',
    notes: 'Per-audience projection QA for customer/surveyor/office/engineer/audit outputs.',
    routeKind: 'derived',
    fullRouteExample: '/dev/welcome-pack → Diagnostics · /dev/portal-fixtures → workflow',
    access: 'dev_only',
    parentCodeName: 'DevPortalFixturePage',
    childElementIds: ['library-repair-queue-panel'],
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>LibraryProjectionQaPanel — open via diagnostics surfaces.</div>,
  },
  {
    id: 'library-repair-queue-panel',
    commonName: 'Library Repair Queue',
    codeName: 'LibraryRepairQueuePanel',
    fileName: 'LibraryRepairQueuePanel.tsx',
    filePath: 'src/library/projections/qa/repairQueue/LibraryRepairQueuePanel.tsx',
    category: 'audit',
    status: 'active',
    notes: 'Review queue generated from projection safety repair suggestions.',
    routeKind: 'derived',
    fullRouteExample: '/dev/portal-fixtures → Library Projection QA',
    access: 'dev_only',
    parentCodeName: 'LibraryProjectionQaPanel',
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>LibraryRepairQueuePanel — open from Library Projection QA.</div>,
  },
  {
    id: 'pdf-comparison-qa-panel',
    commonName: 'PDF Comparison QA',
    codeName: 'PdfComparisonQaPanel',
    fileName: 'PdfComparisonQaPanel.tsx',
    filePath: 'src/library/pdfQa/PdfComparisonQaPanel.tsx',
    category: 'audit',
    status: 'active',
    notes: 'Deterministic QA surface for validating canonical library PDF against legacy outputs and customer-trust rules. Mounted in welcome-pack diagnostics.',
    routeKind: 'derived',
    fullRouteExample: '/dev/welcome-pack → Diagnostics',
    access: 'dev_only',
    parentCodeName: 'WelcomePackDevPreview',
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>PdfComparisonQaPanel — open via welcome-pack diagnostics.</div>,
  },
  {
    id: 'implementation-pack-review-panel',
    commonName: 'Implementation Pack Review',
    codeName: 'ImplementationPackReviewPanel',
    fileName: 'ImplementationPackReviewPanel.tsx',
    filePath: 'src/components/dev/ImplementationPackReviewPanel.tsx',
    category: 'audit',
    status: 'active',
    routeKind: 'derived',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step 3',
    access: 'dev_only',
    parentCodeName: 'DevPortalFixturePage',
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>ImplementationPackReviewPanel — open from portal fixtures workflow.</div>,
  },
  {
    id: 'specification-line-review-panel',
    commonName: 'Specification Line Review',
    codeName: 'SpecificationLineReviewPanel',
    fileName: 'SpecificationLineReviewPanel.tsx',
    filePath: 'src/components/dev/SpecificationLineReviewPanel.tsx',
    category: 'audit',
    status: 'active',
    routeKind: 'derived',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step 4',
    access: 'dev_only',
    parentCodeName: 'DevPortalFixturePage',
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>SpecificationLineReviewPanel — open from portal fixtures workflow.</div>,
  },
  {
    id: 'installation-scope-pack-review-panel',
    commonName: 'Installation Scope Pack Review',
    codeName: 'InstallationScopePackReviewPanel',
    fileName: 'InstallationScopePackReviewPanel.tsx',
    filePath: 'src/components/dev/InstallationScopePackReviewPanel.tsx',
    category: 'audit',
    status: 'active',
    routeKind: 'derived',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step 5',
    access: 'dev_only',
    parentCodeName: 'DevPortalFixturePage',
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>InstallationScopePackReviewPanel — open from portal fixtures workflow.</div>,
  },
  {
    id: 'materials-schedule-review-panel',
    commonName: 'Materials Schedule Review',
    codeName: 'MaterialsScheduleReviewPanel',
    fileName: 'MaterialsScheduleReviewPanel.tsx',
    filePath: 'src/components/dev/MaterialsScheduleReviewPanel.tsx',
    category: 'audit',
    status: 'active',
    routeKind: 'derived',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step 6',
    access: 'dev_only',
    parentCodeName: 'DevPortalFixturePage',
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>MaterialsScheduleReviewPanel — open from portal fixtures workflow.</div>,
  },
  {
    id: 'scope-pack-handover-preview-panel',
    commonName: 'Scope Pack Handover Preview',
    codeName: 'ScopePackHandoverPreviewPanel',
    fileName: 'ScopePackHandoverPreviewPanel.tsx',
    filePath: 'src/components/dev/ScopePackHandoverPreviewPanel.tsx',
    category: 'audit',
    status: 'active',
    routeKind: 'derived',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step 5',
    access: 'dev_only',
    parentCodeName: 'DevPortalFixturePage',
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>ScopePackHandoverPreviewPanel — open from portal fixtures workflow.</div>,
  },
  {
    id: 'engineer-job-pack-preview-panel',
    commonName: 'Engineer Job Pack Preview',
    codeName: 'EngineerJobPackPreviewPanel',
    fileName: 'EngineerJobPackPreviewPanel.tsx',
    filePath: 'src/components/dev/EngineerJobPackPreviewPanel.tsx',
    category: 'audit',
    status: 'active',
    routeKind: 'derived',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step 5',
    access: 'dev_only',
    parentCodeName: 'DevPortalFixturePage',
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>EngineerJobPackPreviewPanel — open from portal fixtures workflow.</div>,
  },
  {
    id: 'specification-readiness-panel',
    commonName: 'Specification Readiness',
    codeName: 'SpecificationReadinessPanel',
    fileName: 'SpecificationReadinessPanel.tsx',
    filePath: 'src/components/dev/SpecificationReadinessPanel.tsx',
    category: 'audit',
    status: 'active',
    routeKind: 'derived',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step 7',
    access: 'dev_only',
    parentCodeName: 'DevPortalFixturePage',
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>SpecificationReadinessPanel — open from portal fixtures workflow.</div>,
  },
  {
    id: 'survey-follow-up-task-panel',
    commonName: 'Survey Follow-up Tasks',
    codeName: 'SurveyFollowUpTaskPanel',
    fileName: 'SurveyFollowUpTaskPanel.tsx',
    filePath: 'src/components/dev/SurveyFollowUpTaskPanel.tsx',
    category: 'audit',
    status: 'active',
    routeKind: 'derived',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step 8',
    access: 'dev_only',
    parentCodeName: 'DevPortalFixturePage',
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>SurveyFollowUpTaskPanel — open from portal fixtures workflow.</div>,
  },
  {
    id: 'follow-up-evidence-plan-panel',
    commonName: 'Follow-up Evidence Plan',
    codeName: 'FollowUpEvidencePlanPanel',
    fileName: 'FollowUpEvidencePlanPanel.tsx',
    filePath: 'src/components/dev/FollowUpEvidencePlanPanel.tsx',
    category: 'audit',
    status: 'active',
    routeKind: 'derived',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step 8',
    access: 'dev_only',
    parentCodeName: 'DevPortalFixturePage',
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>FollowUpEvidencePlanPanel — open from portal fixtures workflow.</div>,
  },
  {
    id: 'follow-up-scan-handoff-panel',
    commonName: 'Follow-up Scan Handoff',
    codeName: 'FollowUpScanHandoffPanel',
    fileName: 'FollowUpScanHandoffPanel.tsx',
    filePath: 'src/components/dev/FollowUpScanHandoffPanel.tsx',
    category: 'audit',
    status: 'active',
    routeKind: 'derived',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step 8',
    access: 'dev_only',
    parentCodeName: 'DevPortalFixturePage',
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>FollowUpScanHandoffPanel — open from portal fixtures workflow.</div>,
  },
  {
    id: 'scan-handoff-envelope-preview-panel',
    commonName: 'Scan Handoff Envelope Preview',
    codeName: 'ScanHandoffEnvelopePreviewPanel',
    fileName: 'ScanHandoffEnvelopePreviewPanel.tsx',
    filePath: 'src/components/dev/ScanHandoffEnvelopePreviewPanel.tsx',
    category: 'audit',
    status: 'active',
    routeKind: 'derived',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step 8',
    access: 'dev_only',
    parentCodeName: 'DevPortalFixturePage',
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>ScanHandoffEnvelopePreviewPanel — open from portal fixtures workflow.</div>,
  },
  {
    id: 'workflow-storage-mode-selector',
    commonName: 'Workflow Storage Mode Selector',
    codeName: 'WorkflowStorageModeSelector',
    fileName: 'WorkflowStorageModeSelector.tsx',
    filePath: 'src/components/dev/WorkflowStorageModeSelector.tsx',
    category: 'audit',
    status: 'active',
    routeKind: 'derived',
    fullRouteExample: '/dev/portal-fixtures → implementation workflow step 11',
    access: 'dev_only',
    parentCodeName: 'DevPortalFixturePage',
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>WorkflowStorageModeSelector — open from portal fixtures workflow.</div>,
  },

  // ── Customer Portal ─────────────────────────────────────────────────────────
  {
    id: 'customer-portal-page',
    commonName: 'Customer Portal',
    codeName: 'CustomerPortalPage',
    fileName: 'CustomerPortalPage.tsx',
    filePath: 'src/components/portal/CustomerPortalPage.tsx',
    category: 'journey',
    status: 'canonical',
    notes:
      'Canonical customer-facing recommendation portal. ' +
      'The only production path for customer-facing visit output. ' +
      'All legacy insight-pack / blueprint customer outputs defer to this surface. ' +
      'RENDERING LAYER NOTE: customer output now renders through canonical scene grammar ' +
      'using CustomerSceneDeck sourced from CustomerPresentationScene[] / storyScene.composition.',
    routeKind: 'path',
    routePath: '/portal/:reference',
    fullRouteExample: '/portal/<reference>?token=<signed-token>',
    access: 'production',
    owner: 'portal',
    domain: 'customer review',
    sourceFiles: [
      'src/components/portal/CustomerPortalPage.tsx',
      'src/portal/customerJourney/CustomerPortalJourneyComposer.tsx',
      'src/components/portal/selectors/buildPortalJourneyModel.ts',
    ],
    includeInCopyBox: true,
    renderingLayer: 'scene_grammar',
    legacyRendererLeak: false,
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>CustomerPortalPage — open via /portal/{'<reference>'}?token={'<signed-token>'}. Use /dev/customer-portal-preview for production-like fixture QA.</div>,
  },

  // ── PDF / Print surfaces ────────────────────────────────────────────────────
  {
    id: 'portal-journey-print-pack',
    commonName: 'Supporting PDF',
    codeName: 'PortalJourneyPrintPack',
    fileName: 'PortalJourneyPrintPack.tsx',
    filePath: 'src/library/portal/pdf/PortalJourneyPrintPack.tsx',
    category: 'report',
    status: 'canonical',
    notes:
      'Canonical production customer-supporting PDF surface. ' +
      'Reached via journey state library-pdf. ' +
      'Visit Home Supporting PDF CTA routes here. ' +
      'Presentation print action routes here. ' +
      'All legacy framework-print / CustomerAdvicePrintPack outputs defer to this surface. ' +
      'RENDERING LAYER NOTE: consumes canonical CustomerPresentationScene[] and renders via ' +
      'CustomerScenePrint to preserve the same scene order and narrative rhythm as the portal.',
    routeKind: 'derived',
    fullRouteExample: 'Visit Home → Supporting PDF CTA → library-pdf journey',
    access: 'production',
    owner: 'pdf',
    domain: 'visit review',
    sourceFiles: [
      'src/library/portal/pdf/PortalJourneyPrintPack.tsx',
      'src/library/portal/pdf/buildPortalJourneyPrintModel.ts',
    ],
    usedByRoutes: ['VisitHomeDashboard'],
    includeInCopyBox: true,
    renderingLayer: 'scene_grammar',
    legacyRendererLeak: false,
    render: () => (
      <PortalJourneyPrintPack
        model={buildPortalJourneyPrintModel({
          selectedSectionIds: [],
          recommendationSummary: 'Sealed system with unvented cylinder is recommended for your home.',
          customerFacts: ['3 people in the home', '1 bathroom', 'Property: SW1A 1AA'],
          journeyType: 'open_vented',
        })}
      />
    ),
  },
  {
    id: 'customer-advice-print-pack',
    commonName: 'Customer Advice Print Pack (Legacy)',
    codeName: 'CustomerAdvicePrintPack',
    fileName: 'CustomerAdvicePrintPack.tsx',
    filePath: 'src/legacy/customerOutputPrototype/CustomerAdvicePrintPack.tsx',
    category: 'deprecated',
    status: 'deprecated',
    notes:
      'Legacy customer advice print surface (?print=survey). ' +
      'Superseded by PortalJourneyPrintPack (library-pdf). ' +
      'Retained for explicit legacy diagnostics only. ' +
      'No production CTA should reference framework-print or this surface.',
    routeKind: 'derived',
    fullRouteExample: '/?print=survey (legacy — retired route)',
    access: 'legacy_dev_only',
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>CustomerAdvicePrintPack — legacy diagnostics only. Canonical PDF output is PortalJourneyPrintPack (library-pdf).</div>,
  },
  {
    id: 'atlas-framework-print-page',
    commonName: 'Atlas Framework Print Page (Legacy)',
    codeName: 'AtlasFrameworkPrintPage',
    fileName: 'AtlasFrameworkPrintPage.tsx',
    filePath: 'src/legacy/customerOutputPrototype/AtlasFrameworkPrintPage.tsx',
    category: 'deprecated',
    status: 'deprecated',
    notes:
      'Legacy blueprint-style technical print summary. ' +
      'Superseded by PortalJourneyPrintPack (library-pdf). ' +
      'Retained only for dev reference. ' +
      'No production CTA should reference this surface.',
    routeKind: 'derived',
    fullRouteExample: 'legacy journey state: framework-print (blueprint summary)',
    access: 'legacy_dev_only',
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>AtlasFrameworkPrintPage — legacy dev-only. Canonical PDF output is PortalJourneyPrintPack (library-pdf).</div>,
  },

  // ── Legacy customer output surfaces (insight-pack family) ───────────────────
  {
    id: 'insight-pack-deck',
    commonName: 'Insight Pack Deck',
    codeName: 'InsightPackDeck',
    fileName: 'InsightPackDeck.tsx',
    filePath: 'src/legacy/customerOutputPrototype/insightPack/InsightPackDeck.tsx',
    category: 'deprecated',
    status: 'deprecated',
    notes:
      'Legacy multi-screen customer recommendation deck. ' +
      'Superseded by CustomerPortalPage. ' +
      'Retained for explicit legacy diagnostics only via /?insight-pack=1. ' +
      'No production CTA should reference this surface.',
    routeKind: 'derived',
    fullRouteExample: '/?insight-pack=1 (legacy diagnostics only)',
    access: 'legacy_dev_only',
    sourceFiles: [
      'src/legacy/customerOutputPrototype/insightPack/InsightPackDeck.tsx',
      'src/legacy/customerOutputPrototype/insightPack/buildInsightPackFromEngine.ts',
    ],
    render: () => <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>InsightPackDeck — legacy diagnostics only. Canonical customer output is CustomerPortalPage (/portal/{'<reference>'}).</div>,
  },
];

export const DEV_CANONICAL_REGISTRY = buildCanonicalRegistry(DEV_UI_REGISTRY);
export const DEV_LEGACY_REGISTRY = buildLegacyRegistry(DEV_UI_REGISTRY);
export const DEV_EXPERIMENTAL_REGISTRY = buildExperimentalRegistry(DEV_UI_REGISTRY);
