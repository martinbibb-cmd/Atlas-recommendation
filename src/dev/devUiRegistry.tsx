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
import LifestyleInteractive from '../components/visualizers/LifestyleInteractive';
import InteractiveComfortClock from '../components/visualizers/InteractiveComfortClock';
import GlassBoxPanel from '../components/visualizers/GlassBoxPanel';
import EfficiencyCurve from '../components/visualizers/EfficiencyCurve';
import FootprintXRay from '../components/visualizers/FootprintXRay';
import FastChoiceStepper from '../components/stepper/FastChoiceStepper';
import FullSurveyStepper from '../components/stepper/FullSurveyStepper';
import PresentationAuditPage from '../components/audit/PresentationAuditPage';
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
  | 'audit'
  | 'deprecated';

export type DevUiStatus = 'canonical' | 'active' | 'experimental' | 'deprecated';

export interface DevUiRegistryItem {
  /** Unique identifier for this entry. */
  id: string;
  /** Human-readable label shown in the browser. */
  commonName: string;
  /** Exact source file name (including extension). */
  fileName: string;
  /** Relative path from repo root. */
  filePath: string;
  /** Functional category for filtering. */
  category: DevUiCategory;
  /**
   * Lifecycle status.
   * - canonical  – the definitive, production-live surface for its category
   * - active     – in use, not yet promoted to canonical
   * - experimental – work-in-progress / preview
   * - deprecated  – scheduled for removal; still browsable for review
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
    fileName: 'ExplainersHubPage.tsx',
    filePath: 'src/explainers/ExplainersHubPage.tsx',
    category: 'simulator',
    status: 'canonical',
    notes:
      'The canonical System Simulator / System Lab experience. ' +
      'Only this surface and SimulatorDashboard may use the "Simulator" label.',
    render: () => <ExplainersHubPage onBack={() => undefined} />,
  },

  // ── Visualisers ────────────────────────────────────────────────────────────
  {
    id: 'lifestyle-interactive',
    commonName: 'Lifestyle Interactive',
    fileName: 'LifestyleInteractive.tsx',
    filePath: 'src/components/visualizers/LifestyleInteractive.tsx',
    category: 'visualiser',
    status: 'active',
    render: () => <LifestyleInteractive />,
  },
  {
    id: 'interactive-comfort-clock',
    commonName: 'Comfort Clock',
    fileName: 'InteractiveComfortClock.tsx',
    filePath: 'src/components/visualizers/InteractiveComfortClock.tsx',
    category: 'visualiser',
    status: 'active',
    render: () => <InteractiveComfortClock />,
  },
  {
    id: 'glass-box-panel',
    commonName: 'Glass Box Panel',
    fileName: 'GlassBoxPanel.tsx',
    filePath: 'src/components/visualizers/GlassBoxPanel.tsx',
    category: 'visualiser',
    status: 'active',
    render: () => <GlassBoxPanel results={runEngine(DEV_DEMO_INPUT)} />,
  },
  {
    id: 'efficiency-curve',
    commonName: 'Efficiency Curve',
    fileName: 'EfficiencyCurve.tsx',
    filePath: 'src/components/visualizers/EfficiencyCurve.tsx',
    category: 'visualiser',
    status: 'active',
    render: () => <EfficiencyCurve />,
  },
  {
    id: 'footprint-xray',
    commonName: 'Footprint X-Ray',
    fileName: 'FootprintXRay.tsx',
    filePath: 'src/components/visualizers/FootprintXRay.tsx',
    category: 'visualiser',
    status: 'active',
    notes: 'Rendered with demo values: Mixergy 180 L vs conventional 210 L.',
    render: () => <FootprintXRay mixergyLitres={180} conventionalLitres={210} />,
  },

  // ── Journeys ────────────────────────────────────────────────────────────────
  {
    id: 'fast-choice-stepper',
    commonName: 'Fast Choice Stepper',
    fileName: 'FastChoiceStepper.tsx',
    filePath: 'src/components/stepper/FastChoiceStepper.tsx',
    category: 'journey',
    status: 'active',
    render: () => <FastChoiceStepper onBack={() => undefined} />,
  },
  {
    id: 'full-survey-stepper',
    commonName: 'Full Survey Stepper',
    fileName: 'FullSurveyStepper.tsx',
    filePath: 'src/components/stepper/FullSurveyStepper.tsx',
    category: 'journey',
    status: 'active',
    render: () => <FullSurveyStepper onBack={() => undefined} />,
  },

  // ── Audit ───────────────────────────────────────────────────────────────────
  {
    id: 'presentation-audit',
    commonName: 'Presentation Audit',
    fileName: 'PresentationAuditPage.tsx',
    filePath: 'src/components/audit/PresentationAuditPage.tsx',
    category: 'audit',
    status: 'active',
    notes: 'Internal audit surface for the presentation engine. Normally accessed via ?audit=1.',
    render: () => <PresentationAuditPage />,
  },
];
