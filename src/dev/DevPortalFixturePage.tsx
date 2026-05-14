/**
 * DevPortalFixturePage.tsx
 *
 * Dev-only route: /dev/portal-fixtures
 *
 * Provides a fixture launcher for the customer portal so portal features can be
 * tested without a live visit record or signed token.
 *
 * Each fixture button opens the real CustomerPortalPage (same
 * CustomerPortalPage / InsightPackDeck path) with a pre-built EngineInputV2_3
 * injected via the devFixtureInput prop, bypassing API and token validation.
 *
 * Production safety:
 *   - Route is registered only in DEV_ROUTE_REGISTRY as access: 'dev_only'.
 *   - No real tokens are generated.
 *   - No visit records are created or modified.
 *   - No persistence of fixture data.
 */

import { useState } from 'react';
import CustomerPortalPage from '../components/portal/CustomerPortalPage';
import type { EngineInputV2_3 } from '../engine/schema/EngineInputV2_3';
import type { EngineInputV2_3Contract } from '../contracts/EngineInputV2_3';
import { runEngine } from '../engine/Engine';
import { buildScenariosFromEngineOutput } from '../engine/modules/buildScenariosFromEngineOutput';
import { buildDecisionFromScenarios } from '../engine/modules/buildDecisionFromScenarios';
import { buildCustomerSummary } from '../engine/modules/buildCustomerSummary';
import { buildPortalJourneyPrintModel } from '../library/portal/pdf/buildPortalJourneyPrintModel';
import { PortalJourneyPrintPack } from '../library/portal/pdf/PortalJourneyPrintPack';
import { assessSupportingPdfReadiness } from '../library/portal/pdf/supportingPdfReadiness';
import { SUPPORTED_DIAGRAM_RENDERER_IDS } from '../library/diagrams/DiagramRenderer';
import { sectionsForMode } from '../features/insightPack/canonicalSections';
import { buildSuggestedImplementationPack } from '../specification/buildSuggestedImplementationPack';
import ImplementationPackReviewPanel from '../components/dev/ImplementationPackReviewPanel';
import { buildSpecificationLinesFromImplementationPack } from '../specification/specLines';
import type { SpecificationLineV1 } from '../specification/specLines';
import SpecificationLineReviewPanel from '../components/dev/SpecificationLineReviewPanel';
import { buildInstallationScopePacks } from '../specification/scopePacks';
import type { InstallationScopePackV1 } from '../specification/scopePacks';
import InstallationScopePackReviewPanel from '../components/dev/InstallationScopePackReviewPanel';
import { buildEngineerJobPack, buildScopePackHandover } from '../specification/handover';
import ScopePackHandoverPreviewPanel from '../components/dev/ScopePackHandoverPreviewPanel';
import EngineerJobPackPreviewPanel from '../components/dev/EngineerJobPackPreviewPanel';
import { buildSuggestedMaterialsSchedule } from '../specification/materials';
import type { SuggestedMaterialLineV1 } from '../specification/materials';
import MaterialsScheduleReviewPanel from '../components/dev/MaterialsScheduleReviewPanel';
import SpecificationReadinessPanel from '../components/dev/SpecificationReadinessPanel';
import { assessSpecificationReadiness } from '../specification/readiness';
import {
  buildFollowUpEvidenceCapturePlan,
  buildFollowUpScanHandoff,
  buildScanHandoffEnvelopePreview,
  buildSurveyFollowUpTasks,
} from '../specification/followUps';
import SurveyFollowUpTaskPanel from '../components/dev/SurveyFollowUpTaskPanel';
import FollowUpEvidencePlanPanel from '../components/dev/FollowUpEvidencePlanPanel';
import FollowUpScanHandoffPanel from '../components/dev/FollowUpScanHandoffPanel';
import ScanHandoffEnvelopePreviewPanel from '../components/dev/ScanHandoffEnvelopePreviewPanel';
import WorkflowStorageModeSelector from '../components/dev/WorkflowStorageModeSelector';
import { buildOperationalDigest, OperationalDigestPanel } from '../workflow/operationalDigest';
import {
  buildChecklistLinesFromReadinessChecks,
  buildInstallerWorkflowProjection,
  buildReadinessChecksFromSpecificationReadiness,
} from '../workflow/visibility/buildWorkflowProjections';
import { WorkspaceSessionGuard, useWorkspaceSession, useOptionalWorkspaceBrandSession } from '../auth/profile';
import {
  WORKFLOW_SCHEMA_VERSION,
  buildWorkflowExportPackage,
  type PersistedImplementationWorkflowV1,
} from '../storage/workflow';
import type { AtlasVisitOwnershipV1 } from '../auth/profile';
import './devPortalFixture.css';

// ─── Fixture definitions ──────────────────────────────────────────────────────

export type PortalFixtureId =
  | 'system_unvented_2bath'
  | 'combi_1bath'
  | 'heat_pump_low_temp'
  | 'water_pressure_constraint'
  | 'open_vented_to_sealed_unvented';

export interface PortalFixture {
  id: PortalFixtureId;
  label: string;
  description: string;
  engineInput: EngineInputV2_3;
}

const WORKFLOW_VISIBLE_ROLES: AtlasVisitOwnershipV1['visibleToRoles'] = [
  'owner',
  'admin',
  'surveyor',
  'engineer',
  'office',
  'viewer',
];

// eslint-disable-next-line react-refresh/only-export-components
export const PORTAL_FIXTURES: PortalFixture[] = [
  {
    id: 'system_unvented_2bath',
    label: 'System boiler + unvented cylinder, 2 bathrooms',
    description: '4-person household with 2 bathrooms and peak concurrent demand — tests stored hot-water routing and PressureVsStoragePortalSection.',
    engineInput: {
      postcode: 'M1 1AA',
      dynamicMainsPressure: 2.5,
      mainsDynamicFlowLpm: 18,
      primaryPipeDiameter: 22,
      heatLossWatts: 9000,
      radiatorCount: 12,
      bathroomCount: 2,
      occupancyCount: 4,
      peakConcurrentOutlets: 2,
      hasLoftConversion: false,
      returnWaterTemp: 45,
      occupancySignature: 'professional',
      buildingMass: 'medium',
      highOccupancy: true,
      preferCombi: false,
      currentHeatSourceType: 'system',
      dhwStorageType: 'unvented',
      currentSystem: { boiler: { type: 'system', ageYears: 12 } },
    },
  },
  {
    id: 'combi_1bath',
    label: 'Combi replacement, 1 bathroom',
    description: '2-person household with a single bathroom — tests standard combi replacement path.',
    engineInput: {
      postcode: 'SW1A 1AA',
      dynamicMainsPressure: 1.8,
      mainsDynamicFlowLpm: 14,
      primaryPipeDiameter: 22,
      heatLossWatts: 7000,
      radiatorCount: 8,
      bathroomCount: 1,
      occupancyCount: 2,
      hasLoftConversion: false,
      returnWaterTemp: 50,
      occupancySignature: 'professional',
      buildingMass: 'medium',
      highOccupancy: false,
      preferCombi: true,
      currentHeatSourceType: 'combi',
      dhwStorageType: 'none',
    },
  },
  {
    id: 'heat_pump_low_temp',
    label: 'Heat pump, low-temperature radiators',
    description: 'Well-insulated 3-person home with outdoor space confirmed — tests heat-pump recommendation path.',
    engineInput: {
      postcode: 'EH1 1AA',
      dynamicMainsPressure: 2.0,
      mainsDynamicFlowLpm: 16,
      primaryPipeDiameter: 28,
      heatLossWatts: 5000,
      radiatorCount: 10,
      bathroomCount: 2,
      occupancyCount: 3,
      hasLoftConversion: false,
      returnWaterTemp: 40,
      occupancySignature: 'steady_home',
      buildingMass: 'heavy',
      highOccupancy: false,
      preferCombi: false,
      currentHeatSourceType: 'regular',
      hasOutdoorSpaceForHeatPump: true,
      productConstraints: { allowHeatPump: true },
      dhwStorageType: 'heat_pump_cylinder',
    },
  },
  {
    id: 'water_pressure_constraint',
    label: 'Water pressure constraint',
    description: 'Low dynamic mains pressure (0.8 bar) and low flow rate (7 L/min) — tests pressure-limiter portal section.',
    engineInput: {
      postcode: 'LS1 1AA',
      dynamicMainsPressure: 0.8,
      mainsDynamicFlowLpm: 7,
      primaryPipeDiameter: 22,
      heatLossWatts: 8000,
      radiatorCount: 10,
      bathroomCount: 1,
      occupancyCount: 2,
      hasLoftConversion: false,
      returnWaterTemp: 48,
      occupancySignature: 'professional',
      buildingMass: 'medium',
      highOccupancy: false,
      preferCombi: false,
      currentHeatSourceType: 'combi',
      dhwStorageType: 'none',
    },
  },
  {
    id: 'open_vented_to_sealed_unvented',
    label: 'Open-vented to sealed + unvented',
    description: 'Older regular boiler with open-vented circuit — tests sealed-system conversion portal path.',
    engineInput: {
      postcode: 'B1 1AA',
      dynamicMainsPressure: 2.2,
      mainsDynamicFlowLpm: 15,
      primaryPipeDiameter: 28,
      heatLossWatts: 10000,
      radiatorCount: 14,
      bathroomCount: 2,
      occupancyCount: 4,
      hasLoftConversion: false,
      returnWaterTemp: 60,
      occupancySignature: 'steady_home',
      buildingMass: 'heavy',
      highOccupancy: true,
      preferCombi: false,
      currentHeatSourceType: 'regular',
      dhwStorageType: 'vented',
      currentSystem: {
        boiler: { type: 'regular', ageYears: 18 },
        heatingSystemType: 'open_vented',
      },
    },
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FixtureCardProps {
  fixture: PortalFixture;
  onOpen: (fixture: PortalFixture, initialView?: 'insight' | 'presentation' | 'pdf_comparison' | 'implementation_pack') => void;
}

const ENABLE_LIBRARY_SUPPORTING_PDF_DEV_REPLACEMENT = import.meta.env.DEV;
const INSIGHT_PRINT_SECTIONS_PER_PAGE = 2;
const OPEN_VENTED_RECOMMENDATION_SUMMARY = 'Sealed system with unvented cylinder — the right route for this home.';
const HEAT_PUMP_RECOMMENDATION_SUMMARY = 'Heat pump with low-temperature radiators — a steady comfort fit for this home.';
const OPEN_VENTED_SUPPORTING_PDF_SECTION_IDS = ['CON_A01', 'CON_C02', 'CON_C01'] as const;
const HEAT_PUMP_SUPPORTING_PDF_SECTION_IDS = ['CON_E02', 'CON_H01', 'CON_H04', 'CON_G01', 'CON_I01_DAY_TO_DAY'] as const;
const INSTALLER_BLOCKING_REASON_PATTERNS: readonly RegExp[] = [
  /^Safety\/compliance check unresolved:/i,
  /^Installer validation unresolved:/i,
  /^Heat pump emitter review unresolved:/i,
  /^Location to confirm on survey in /i,
  /^Unknown location in /i,
];
// Contract pipe diameters are normalized to standard primary sizes.
const PIPE_SIZE_THRESHOLD_35MM = 35;
const PIPE_SIZE_THRESHOLD_28MM = 28;
const PIPE_SIZE_THRESHOLD_22MM = 22;

function isOpenVentedFixture(fixture: PortalFixture): boolean {
  return fixture.id === 'open_vented_to_sealed_unvented';
}

function isHeatPumpFixture(fixture: PortalFixture): boolean {
  return fixture.id === 'heat_pump_low_temp';
}

type SupportingPdfJourneyType = 'open_vented' | 'heat_pump';

function getSupportingPdfJourneyType(fixture: PortalFixture): SupportingPdfJourneyType | null {
  if (isOpenVentedFixture(fixture)) return 'open_vented';
  if (isHeatPumpFixture(fixture)) return 'heat_pump';
  return null;
}

function FixtureCard({ fixture, onOpen }: FixtureCardProps) {
  const [copied, setCopied] = useState(false);

  const showSupportingPdfPreviewAction =
    ENABLE_LIBRARY_SUPPORTING_PDF_DEV_REPLACEMENT
    && getSupportingPdfJourneyType(fixture) != null;

  function handleCopyUrl() {
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}/dev/portal-fixtures`
      : '/dev/portal-fixtures';
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="dev-portal-fixture__card" data-testid="fixture-card" data-fixture-id={fixture.id}>
      <div className="dev-portal-fixture__card-body">
        <h3 className="dev-portal-fixture__card-title">{fixture.label}</h3>
        <p className="dev-portal-fixture__card-desc">{fixture.description}</p>
      </div>
      <div className="dev-portal-fixture__card-actions">
        <button
          type="button"
          className="dev-portal-fixture__btn dev-portal-fixture__btn--primary"
          onClick={() => onOpen(fixture)}
          data-testid={`fixture-open-${fixture.id}`}
        >
          Open portal
        </button>
        <button
          type="button"
          className="dev-portal-fixture__btn"
          onClick={() => onOpen(fixture, 'insight')}
          data-testid={`fixture-insight-${fixture.id}`}
        >
          Open Insight
        </button>
        <button
          type="button"
          className="dev-portal-fixture__btn"
          onClick={() => onOpen(fixture, 'presentation')}
          data-testid={`fixture-presentation-${fixture.id}`}
        >
          Open In-room presentation
        </button>
        <button
          type="button"
          className="dev-portal-fixture__btn"
          onClick={() => onOpen(fixture, 'implementation_pack')}
          data-testid={`fixture-implementation-${fixture.id}`}
        >
          Open implementation pack
        </button>
        {showSupportingPdfPreviewAction ? (
          <button
            type="button"
            className="dev-portal-fixture__btn"
            onClick={() => onOpen(fixture, 'pdf_comparison')}
            data-testid={`fixture-pdf-comparison-${fixture.id}`}
          >
            Open PDF comparison
          </button>
        ) : null}
        <button
          type="button"
          className="dev-portal-fixture__btn dev-portal-fixture__btn--copy"
          onClick={handleCopyUrl}
          data-testid={`fixture-copy-url-${fixture.id}`}
        >
          {copied ? 'Copied!' : 'Copy portal URL'}
        </button>
      </div>
    </div>
  );
}

// ─── Workflow step collapsible ────────────────────────────────────────────────

interface WorkflowStepProps {
  stepNumber: number;
  title: string;
  testId: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  complete?: boolean;
}

function WorkflowStep({
  stepNumber,
  title,
  testId,
  children,
  defaultExpanded = true,
  complete = false,
}: WorkflowStepProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div
      style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', background: '#fff', overflow: 'hidden' }}
      data-testid={testId}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        data-testid={`${testId}-toggle`}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '0.65rem 0.75rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.9rem',
          fontWeight: 600,
        }}
      >
        <span style={{ color: '#64748b', fontSize: '0.8rem', minWidth: '1.4rem' }}>{stepNumber}.</span>
        <span style={{ flex: 1 }}>{title}</span>
        {complete ? (
          <span
            style={{
              borderRadius: 999,
              padding: '0.1rem 0.45rem',
              fontSize: '0.7rem',
              fontWeight: 700,
              background: '#dcfce7',
              color: '#166534',
            }}
            data-testid={`${testId}-complete`}
          >
            Complete ✓
          </span>
        ) : null}
        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded ? (
        <div style={{ padding: '0 0.75rem 0.75rem' }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DevPortalFixturePageProps {
  onBack?: () => void;
}

interface ActiveFixture {
  fixture: PortalFixture;
  initialView?: 'insight' | 'presentation' | 'pdf_comparison' | 'implementation_pack';
  implementationReview?: {
    implementationPack: ReturnType<typeof buildImplementationPackForFixture>;
    specificationLines: SpecificationLineV1[];
    scopePacks: InstallationScopePackV1[];
    materialsSchedule: SuggestedMaterialLineV1[];
    resolutionSimulation: {
      resolvedTaskIds: string[];
      capturedEvidenceIds: string[];
      resolvedDependencyIds: string[];
    };
  };
}

type SupportingPdfPreviewMode = 'current_insight_pdf' | 'library_supporting_pdf';

function buildSupportingPdfModel(fixture: PortalFixture) {
  const journeyType = getSupportingPdfJourneyType(fixture);
  if (journeyType == null) {
    throw new Error(`No supporting PDF journey configured for fixture: ${fixture.id}`);
  }
  const bathroomCount = fixture.engineInput.bathroomCount ?? 2;
  const occupancyCount = fixture.engineInput.occupancyCount ?? 3;
  if (journeyType === 'heat_pump') {
    return buildPortalJourneyPrintModel({
      journeyType: 'heat_pump',
      selectedSectionIds: [...HEAT_PUMP_SUPPORTING_PDF_SECTION_IDS],
      recommendationSummary: HEAT_PUMP_RECOMMENDATION_SUMMARY,
      customerFacts: [
        `${occupancyCount}-person household`,
        `${bathroomCount} bathroom${bathroomCount !== 1 ? 's' : ''}`,
        'Heat pump with low-temperature radiators',
      ],
    });
  }

  return buildPortalJourneyPrintModel({
    journeyType: 'open_vented',
    selectedSectionIds: [...OPEN_VENTED_SUPPORTING_PDF_SECTION_IDS],
    recommendationSummary: OPEN_VENTED_RECOMMENDATION_SUMMARY,
    customerFacts: [
      `${occupancyCount}-person household`,
      `${bathroomCount} bathroom${bathroomCount !== 1 ? 's' : ''}`,
      'Regular boiler, open-vented circuit',
    ],
  });
}

function inferColdWaterSource(input: EngineInputV2_3): NonNullable<EngineInputV2_3Contract['services']>['coldWaterSource'] {
  if (input.currentSystem?.heatingSystemType === 'open_vented' || input.dhwStorageType === 'vented') {
    return 'loft_tank';
  }
  return 'mains_true';
}

function mapEngineInputToContract(input: EngineInputV2_3): EngineInputV2_3Contract {
  let primaryPipeSizeMm: EngineInputV2_3Contract['infrastructure']['primaryPipeSizeMm'] = 15;
  if (input.primaryPipeDiameter >= PIPE_SIZE_THRESHOLD_35MM) {
    primaryPipeSizeMm = 35;
  } else if (input.primaryPipeDiameter >= PIPE_SIZE_THRESHOLD_28MM) {
    primaryPipeSizeMm = 28;
  } else if (input.primaryPipeDiameter >= PIPE_SIZE_THRESHOLD_22MM) {
    primaryPipeSizeMm = 22;
  }

  let occupancySignature: EngineInputV2_3Contract['occupancy']['signature'] = 'professional';
  if (input.occupancySignature === 'steady_home' || input.occupancySignature === 'steady') {
    occupancySignature = 'steady';
  } else if (input.occupancySignature === 'shift_worker' || input.occupancySignature === 'shift') {
    occupancySignature = 'shift';
  }

  const coldWaterSource: NonNullable<EngineInputV2_3Contract['services']>['coldWaterSource'] =
    input.coldWaterSource ?? inferColdWaterSource(input);

  let architecture: EngineInputV2_3Contract['dhw']['architecture'] = 'unknown';
  if (input.dhwStorageType === 'mixergy') {
    architecture = 'stored_mixergy';
  } else if (input.dhwStorageType === 'none' || input.currentHeatSourceType === 'combi') {
    architecture = 'on_demand';
  } else if (
    input.dhwStorageType === 'unvented'
    || input.dhwStorageType === 'vented'
    || input.dhwStorageType === 'heat_pump_cylinder'
  ) {
    architecture = 'stored_standard';
  }

  return {
    infrastructure: {
      primaryPipeSizeMm,
    },
    property: {
      peakHeatLossKw: Math.max(0, Math.round((input.heatLossWatts / 1000) * 10) / 10),
    },
    occupancy: {
      signature: occupancySignature,
      peakConcurrentOutlets: input.peakConcurrentOutlets ?? 1,
    },
    dhw: {
      architecture,
    },
    services: {
      mainsDynamicPressureBar: input.dynamicMainsPressureBar ?? input.dynamicMainsPressure,
      mainsDynamicFlowLpm: input.mainsDynamicFlowLpm,
      coldWaterSource,
    },
    currentSystem: {
      boiler: {
        type:
          input.currentSystem?.boiler?.type
          ?? (input.currentHeatSourceType === 'combi'
            ? 'combi'
            : input.currentHeatSourceType === 'system'
              ? 'system'
              : input.currentHeatSourceType === 'regular'
                ? 'regular'
                : 'unknown'),
        ageYears: input.currentSystem?.boiler?.ageYears,
      },
    },
  };
}

function buildImplementationPackForFixture(fixture: PortalFixture) {
  const engineResult = runEngine(fixture.engineInput);
  const scenarios = buildScenariosFromEngineOutput(engineResult.engineOutput);
  if (scenarios.length === 0) {
    throw new Error(`No scenarios available for fixture: ${fixture.id}`);
  }

  const rawType = fixture.engineInput.currentHeatSourceType;
  const boilerType: 'combi' | 'system' | 'regular' =
    rawType === 'system' || rawType === 'regular' ? rawType : 'combi';

  const decision = buildDecisionFromScenarios({
    scenarios,
    boilerType,
    ageYears: fixture.engineInput.currentSystem?.boiler?.ageYears ?? 0,
    occupancyCount: fixture.engineInput.occupancyCount,
    bathroomCount: fixture.engineInput.bathroomCount,
    showerCompatibilityNote: engineResult.engineOutput.showerCompatibilityNote,
  });

  const customerSummary = buildCustomerSummary(decision, scenarios);
  const surveyInput = mapEngineInputToContract(fixture.engineInput);
  const pack = buildSuggestedImplementationPack({
    atlasDecision: decision,
    customerSummary,
    engineOutput: engineResult.engineOutput,
    surveyInput,
  });

  return {
    pack,
    recommendedScenarioId: decision.recommendedScenarioId,
    customerSummary,
  };
}

/**
 * DevPortalFixturePage
 *
 * Dev-only fixture launcher for the customer portal.
 * Renders at /dev/portal-fixtures — not reachable from any customer route.
 */
export default function DevPortalFixturePage({ onBack }: DevPortalFixturePageProps) {
  const [active, setActive] = useState<ActiveFixture | null>(null);
  const [previewMode, setPreviewMode] = useState<SupportingPdfPreviewMode>('current_insight_pdf');
  const workspaceSession = useWorkspaceSession();
  const workspaceBrandSession = useOptionalWorkspaceBrandSession();

  function handleOpen(fixture: PortalFixture, initialView?: 'insight' | 'presentation' | 'pdf_comparison' | 'implementation_pack') {
    const supportingPdfJourneyType = getSupportingPdfJourneyType(fixture);
    const shouldOpenComparisonShell =
      ENABLE_LIBRARY_SUPPORTING_PDF_DEV_REPLACEMENT
      && supportingPdfJourneyType != null
      && (initialView === 'insight' || initialView === 'pdf_comparison');
    if (shouldOpenComparisonShell) {
      setPreviewMode(initialView === 'pdf_comparison' ? 'library_supporting_pdf' : 'current_insight_pdf');
    }
    if (initialView === 'implementation_pack') {
      const implementationPack = buildImplementationPackForFixture(fixture);
      const specificationLines = buildSpecificationLinesFromImplementationPack(implementationPack.pack);
      const scopePacks = buildInstallationScopePacks(specificationLines, implementationPack.pack);
      const materialsSchedule = buildSuggestedMaterialsSchedule(scopePacks, specificationLines, implementationPack.pack);
      setActive({
        fixture,
        initialView,
        implementationReview: {
          implementationPack,
          specificationLines,
          scopePacks,
          materialsSchedule,
          resolutionSimulation: {
            resolvedTaskIds: [],
            capturedEvidenceIds: [],
            resolvedDependencyIds: [],
          },
        },
      });
      return;
    }
    setActive({ fixture, initialView });
  }

  function handleBackToLauncher() {
    setActive(null);
  }

  function handleLibraryPreviewPrint() {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  }

  if (active !== null) {
    const supportingPdfJourneyType = getSupportingPdfJourneyType(active.fixture);
    const showInsightPdfComparison =
      ENABLE_LIBRARY_SUPPORTING_PDF_DEV_REPLACEMENT
      && supportingPdfJourneyType != null
      && (active.initialView === 'insight' || active.initialView === 'pdf_comparison');

    // Supporting PDF preview — toggles between current Insight print path and
    // the library-driven supporting PDF preview for safe dev comparison.
    if (showInsightPdfComparison) {
      const printModel = buildSupportingPdfModel(active.fixture);
      const expectedRecommendationSummary =
        supportingPdfJourneyType === 'heat_pump'
          ? HEAT_PUMP_RECOMMENDATION_SUMMARY
          : OPEN_VENTED_RECOMMENDATION_SUMMARY;
      const currentInsightEstimatedPages = Math.ceil(
        sectionsForMode('in-room').length / INSIGHT_PRINT_SECTIONS_PER_PAGE,
      );
      const readiness = assessSupportingPdfReadiness({
        model: printModel,
        expectedRecommendationSummary,
        maxCustomerPages: printModel.pageEstimate.maxPages,
        requiredDiagramSectionIds:
          supportingPdfJourneyType === 'heat_pump'
            ? ['warm_not_hot_radiators']
            : ['what_changes', 'pressure_vs_storage', 'unvented_safety'],
        requiredDiagramRendererIds:
          supportingPdfJourneyType === 'heat_pump'
            ? ['warm_vs_hot_radiators', 'heat_pump_defrost']
            : [],
        availableDiagramRendererIds: SUPPORTED_DIAGRAM_RENDERER_IDS,
        printSafeLayoutPass: true,
        accessibilityBasicsPass: true,
        insightFallbackAvailable: true,
      });
      return (
        <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
          <div style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
            <button
              type="button"
              className="back-btn"
              onClick={handleBackToLauncher}
              data-testid="dev-fixture-back"
            >
              ← Back to fixtures
            </button>
            <span
              className="atlas-dev-notice"
              style={{ margin: 0 }}
              data-testid="dev-fixture-active-label"
            >
              🔬 Insight PDF dev comparison — not customer data · {active.fixture.label}
            </span>
          </div>

          <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
            <section
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}
              data-testid="dev-insight-pdf-toggle"
            >
              <button
                type="button"
                className="dev-portal-fixture__btn"
                onClick={() => setPreviewMode('current_insight_pdf')}
                aria-pressed={previewMode === 'current_insight_pdf'}
                data-testid="dev-insight-pdf-toggle-current"
              >
                Current Insight PDF
              </button>
              <button
                type="button"
                className="dev-portal-fixture__btn"
                onClick={() => setPreviewMode('library_supporting_pdf')}
                aria-pressed={previewMode === 'library_supporting_pdf'}
                data-testid="dev-insight-pdf-toggle-library"
              >
                Library Supporting PDF preview
              </button>
              {previewMode === 'library_supporting_pdf' ? (
                <button
                  type="button"
                  className="dev-portal-fixture__btn dev-portal-fixture__btn--primary"
                  onClick={handleLibraryPreviewPrint}
                  data-testid="dev-supporting-pdf-print"
                >
                  Browser print preview
                </button>
              ) : null}
            </section>

            <section
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem' }}
              data-testid="dev-insight-pdf-comparison-panel"
            >
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Insight PDF comparison</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: '0.35rem' }}>Metric</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: '0.35rem' }}>Current Insight PDF</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: '0.35rem' }}>Library Supporting PDF preview</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>Page count (in-room print estimate)</td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>{currentInsightEstimatedPages}</td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>{printModel.pageEstimate.usedPages}</td>
                  </tr>
                  <tr>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>Raw engine text present</td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>Yes</td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>No</td>
                  </tr>
                  <tr>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>Diagrams present</td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>Yes</td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>Yes</td>
                  </tr>
                  <tr>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>Content pending</td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>No</td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem' }}>No</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.35rem' }}>Customer readability notes</td>
                    <td style={{ padding: '0.35rem' }}>Rich but dense; carries legacy Insight layout and terminology.</td>
                    <td style={{ padding: '0.35rem' }}>Short pages, plain language, and consistent journey sequencing.</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem' }}
              data-testid="dev-supporting-pdf-readiness-panel"
            >
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Replacement readiness</h2>
              <p style={{ margin: '0 0 0.5rem' }}>
                Ready to replace:{' '}
                <strong data-testid="dev-supporting-pdf-ready-value">{readiness.ready ? 'Yes' : 'No'}</strong>
              </p>

              <h3 style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>Blocking reasons</h3>
              {readiness.blockingReasons.length > 0 ? (
                <ul style={{ margin: '0 0 0.5rem', paddingLeft: '1.1rem' }} data-testid="dev-supporting-pdf-blocking-reasons">
                  {readiness.blockingReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: '0 0 0.5rem' }} data-testid="dev-supporting-pdf-blocking-reasons-none">None</p>
              )}

              <h3 style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>Warnings</h3>
              {readiness.warnings.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '1.1rem' }} data-testid="dev-supporting-pdf-warnings">
                  {readiness.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0 }} data-testid="dev-supporting-pdf-warnings-none">None</p>
              )}
            </section>

            {previewMode === 'current_insight_pdf' ? (
              <CustomerPortalPage
                reference="dev-fixture"
                devFixtureInput={active.fixture.engineInput}
                devInitialViewMode="insight"
                showDevTraceLabelsOverride={true}
              />
            ) : (
              <div
                style={{ padding: '2rem', background: '#e5e7eb' }}
                data-testid="dev-supporting-pdf-preview"
              >
                <PortalJourneyPrintPack model={printModel} />
              </div>
            )}
          </div>
        </div>
      );
    }

    if (active.initialView === 'implementation_pack') {
      const reviewState = active.implementationReview;
      if (!reviewState) {
        throw new Error(`Missing implementation review state for fixture: ${active.fixture.id}`);
      }

      const {
        implementationPack,
        specificationLines,
        scopePacks,
        materialsSchedule,
        resolutionSimulation,
      } = reviewState;
      const scopePackHandover = buildScopePackHandover(
        scopePacks,
        specificationLines,
        implementationPack.pack,
      );
      const engineerJobPack = buildEngineerJobPack(
        scopePackHandover,
        implementationPack.pack,
        specificationLines,
        mapEngineInputToContract(active.fixture.engineInput),
        undefined,
      );
      const specificationReadiness = assessSpecificationReadiness({
        implementationPack: implementationPack.pack,
        specificationLines,
        scopePacks,
        handover: scopePackHandover,
        engineerJobPack,
        materialsSchedule,
      });
      const surveyFollowUpTasks = buildSurveyFollowUpTasks(
        specificationReadiness,
        specificationLines,
        materialsSchedule,
        engineerJobPack,
      );
      const followUpEvidencePlan = buildFollowUpEvidenceCapturePlan(
        surveyFollowUpTasks,
        engineerJobPack,
        specificationLines,
        materialsSchedule,
      );
      const followUpScanHandoff = buildFollowUpScanHandoff(followUpEvidencePlan);
      const scanHandoffEnvelopePreview = buildScanHandoffEnvelopePreview(followUpScanHandoff);
      const resolvedTaskSet = new Set(resolutionSimulation.resolvedTaskIds);
      const capturedEvidenceSet = new Set(resolutionSimulation.capturedEvidenceIds);
      const resolvedDependencySet = new Set(resolutionSimulation.resolvedDependencyIds);

      const requiredEvidenceByTask = new Map<string, string[]>();
      for (const evidenceItem of followUpEvidencePlan.requiredEvidence) {
        for (const taskId of evidenceItem.taskIds) {
          const existing = requiredEvidenceByTask.get(taskId) ?? [];
          existing.push(evidenceItem.evidenceId);
          requiredEvidenceByTask.set(taskId, existing);
        }
      }

      const dependencyByTask = new Map<string, string[]>();
      for (const dependency of followUpScanHandoff.unresolvedDependencies) {
        for (const taskId of dependency.linkedTaskIds) {
          const existing = dependencyByTask.get(taskId) ?? [];
          existing.push(dependency.dependencyId);
          dependencyByTask.set(taskId, existing);
        }
      }

      const isTaskCompletelyResolved = (taskId: string): boolean => {
        if (resolvedTaskSet.has(taskId)) return true;
        const requiredEvidenceIds = requiredEvidenceByTask.get(taskId) ?? [];
        if (requiredEvidenceIds.length === 0) return false;
        const hasAllRequiredEvidence = requiredEvidenceIds.every((evidenceId) => capturedEvidenceSet.has(evidenceId));
        if (!hasAllRequiredEvidence) return false;
        const dependencyIds = dependencyByTask.get(taskId) ?? [];
        return dependencyIds.every((dependencyId) => resolvedDependencySet.has(dependencyId));
      };

      const simulatedTasks = surveyFollowUpTasks.map((task) => ({
        ...task,
        resolved: isTaskCompletelyResolved(task.taskId),
      }));

      const blockerTaskIdsByReason = new Map<string, string[]>();
      for (const task of surveyFollowUpTasks) {
        if (!task.description.startsWith('Readiness blocker: ')) continue;
        const reason = task.description.replace(/^Readiness blocker:\s*/, '');
        const existing = blockerTaskIdsByReason.get(reason) ?? [];
        existing.push(task.taskId);
        blockerTaskIdsByReason.set(reason, existing);
      }

      const simulatedBlockingReasons = specificationReadiness.blockingReasons.filter((reason) => {
        const linkedTaskIds = blockerTaskIdsByReason.get(reason);
        if (!linkedTaskIds || linkedTaskIds.length === 0) return true;
        return linkedTaskIds.some((taskId) => !isTaskCompletelyResolved(taskId));
      });

      const simulatedUnresolvedDependencies = followUpScanHandoff.unresolvedDependencies.filter(
        (dependency) => !resolvedDependencySet.has(dependency.dependencyId),
      );

      const simulatedReadiness = {
        ...specificationReadiness,
        readyForOfficeReview: simulatedBlockingReasons.length === 0,
        readyForInstallerHandover: !simulatedBlockingReasons.some((reason) => INSTALLER_BLOCKING_REASON_PATTERNS
          .some((pattern) => pattern.test(reason)),
        ),
        readyForMaterialsOrdering: !simulatedBlockingReasons.some((reason) =>
          /^Material needs survey confirmation:/i.test(reason),
        ),
        blockingReasons: simulatedBlockingReasons,
      };

      const simulatedEvidencePlan = {
        ...followUpEvidencePlan,
        tasks: simulatedTasks,
        unresolvedAfterCapture: simulatedUnresolvedDependencies.flatMap((dependency) => dependency.linkedTaskIds),
      };
      const simulatedScanHandoff = {
        ...followUpScanHandoff,
        unresolvedDependencies: simulatedUnresolvedDependencies,
      };
      const operationalDigest = buildOperationalDigest({
        tasks: simulatedTasks,
        readiness: simulatedReadiness,
        evidencePlan: simulatedEvidencePlan,
        scanHandoff: simulatedScanHandoff,
        engineerJobPack,
      });
      const readinessChecks = buildReadinessChecksFromSpecificationReadiness(simulatedReadiness);
      const checklistLines = buildChecklistLinesFromReadinessChecks(readinessChecks);
      const installerWorkflowProjection = buildInstallerWorkflowProjection({
        followUpTasks: simulatedTasks,
        readinessChecks,
        evidenceRequirements: [
          ...simulatedEvidencePlan.requiredEvidence,
          ...simulatedEvidencePlan.optionalEvidence,
        ],
        operationalDigest,
        checklistLines,
      });
      const projectedReadiness = {
        ...simulatedReadiness,
        blockingReasons: installerWorkflowProjection.readinessChecks
          .filter((check) => check.severity === 'blocker')
          .map((check) => check.text),
        warnings: installerWorkflowProjection.readinessChecks
          .filter((check) => check.severity === 'warning')
          .map((check) => check.text),
        unresolvedChecks: installerWorkflowProjection.readinessChecks
          .filter((check) => check.severity === 'info')
          .map((check) => check.text),
      };
      const unresolvedTaskCount = simulatedTasks.filter((task) => !task.resolved).length;
      const requiredEvidenceTotal = followUpEvidencePlan.requiredEvidence.length;
      const capturedRequiredEvidenceCount = followUpEvidencePlan.requiredEvidence
        .filter((evidence) => capturedEvidenceSet.has(evidence.evidenceId)).length;
      const blockerResolvedCount = specificationReadiness.blockingReasons.length - simulatedBlockingReasons.length;
      const baseReadyGateCount = Number(specificationReadiness.readyForOfficeReview)
        + Number(specificationReadiness.readyForInstallerHandover)
        + Number(specificationReadiness.readyForMaterialsOrdering);
      const simulatedReadyGateCount = Number(simulatedReadiness.readyForOfficeReview)
        + Number(simulatedReadiness.readyForInstallerHandover)
        + Number(simulatedReadiness.readyForMaterialsOrdering);

      const blockerCount = simulatedReadiness.blockingReasons.length;
      const scanCount = requiredEvidenceTotal - capturedRequiredEvidenceCount;
      const unresolvedDependencyCount = simulatedUnresolvedDependencies.length;
      const nextActionMessage =
        blockerCount > 0
          ? 'Complete follow-up tasks first'
          : scanCount > 0
            ? 'Capture missing evidence'
            : unresolvedDependencyCount > 0
              ? 'Confirm qualification/customer dependencies'
              : 'Ready for office review';

      // ─── Persisted workflow snapshot (passed to storage selector) ──────────
      const now = new Date().toISOString();
      const visitReference = `fixture:${active.fixture.id}`;
      const workflowOwnership: AtlasVisitOwnershipV1 | undefined =
        workspaceSession.status === 'workspace_active'
          && workspaceSession.activeWorkspace !== null
          && workspaceSession.atlasUserProfile !== null
          ? {
              visitReference,
              workspaceId: workspaceSession.activeWorkspace.workspaceId,
              createdByUserId: workspaceSession.atlasUserProfile.atlasUserId,
              visibleToRoles: WORKFLOW_VISIBLE_ROLES,
              storageTarget: workspaceSession.storageTarget,
            }
          : undefined;
      const persistedWorkflowSnapshot: PersistedImplementationWorkflowV1 = {
        schemaVersion: WORKFLOW_SCHEMA_VERSION,
        visitReference,
        createdAt: now,
        updatedAt: now,
        packSnapshot: {
          recommendedScenarioId: implementationPack.recommendedScenarioId,
          fixtureId: active.fixture.id,
        },
        resolutionSimulation: {
          resolvedTaskIds: [...resolutionSimulation.resolvedTaskIds],
          capturedEvidenceIds: [...resolutionSimulation.capturedEvidenceIds],
          resolvedDependencyIds: [...resolutionSimulation.resolvedDependencyIds],
          changeLog: [],
        },
        scopePackStatuses: Object.fromEntries(
          scopePacks.map((p) => [p.packId, p.reviewStatus]),
        ),
        specLineStatuses: Object.fromEntries(
          specificationLines.map((l) => [l.lineId, l.status]),
        ),
        materialsReviewState: {
          confirmedIds: [],
          rejectedIds: [],
          flaggedIds: [],
        },
        ...(workflowOwnership !== undefined ? { ownership: workflowOwnership } : {}),
      };
      const workflowExportPackage = buildWorkflowExportPackage({
        payload: {
          workflowState: persistedWorkflowSnapshot,
          implementationPack: implementationPack.pack,
          specificationLines,
          scopePacks,
          materialsSchedule,
          engineerJobPack,
          followUpTasks: simulatedTasks,
          scanHandoffPreview: scanHandoffEnvelopePreview,
          customerSummary: implementationPack.customerSummary,
        },
        source: {
          target: 'local_only',
          surface: `dev_portal_fixture:${active.fixture.id}`,
        },
        ...(workflowOwnership !== undefined ? { ownership: workflowOwnership } : {}),
        ...(workspaceBrandSession !== null
          ? {
              brandContext: {
                brandId: workspaceBrandSession.activeBrandId,
                resolutionSource: workspaceBrandSession.resolutionSource,
                ...(workspaceBrandSession.activeWorkspace !== null
                  ? {
                      workspaceId: workspaceBrandSession.activeWorkspace.workspaceId,
                      workspaceName: workspaceBrandSession.activeWorkspace.name,
                    }
                  : {}),
              },
            }
          : {}),
      });

      return (
        <div style={{ background: '#f8fafc', minHeight: '100vh' }} data-testid="dev-implementation-pack-shell">
          <div style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
            <button
              type="button"
              className="back-btn"
              onClick={handleBackToLauncher}
              data-testid="dev-fixture-back"
            >
              ← Back to fixtures
            </button>
            <span
              className="atlas-dev-notice"
              style={{ margin: 0 }}
              data-testid="dev-fixture-active-label"
            >
              🔬 Implementation pack review — not customer data · {active.fixture.label}
            </span>
          </div>

          <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }} data-testid="dev-implementation-pack-panel">
            <WorkspaceSessionGuard showWorkspaceActiveState />
            {/* ── Workspace brand session ───────────────────────────────────── */}
            {workspaceBrandSession !== null && (
              <section
                style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '0.75rem', padding: '0.75rem' }}
                data-testid="dev-workspace-brand-session"
              >
                <strong style={{ fontSize: '0.85rem', color: '#166534' }}>Workspace Brand Session</strong>
                <div style={{ marginTop: '0.375rem', fontSize: '0.8125rem', display: 'grid', gap: '0.125rem' }}>
                  {workspaceBrandSession.activeWorkspace !== null && (
                    <span><strong>Workspace:</strong> {workspaceBrandSession.activeWorkspace.name}</span>
                  )}
                  <span><strong>Brand:</strong> {workspaceBrandSession.activeBrandProfile.companyName} <code style={{ fontSize: '0.75rem', background: '#dcfce7', padding: '1px 4px', borderRadius: 3 }}>{workspaceBrandSession.activeBrandId}</code></span>
                  <span><strong>Resolution:</strong> {workspaceBrandSession.resolutionSource.replace(/_/g, ' ')}</span>
                  {workspaceBrandSession.warnings.length > 0 && (
                    <details>
                      <summary style={{ cursor: 'pointer', color: '#92400e', fontWeight: 600 }}>
                        ⚠ {workspaceBrandSession.warnings.length} warning{workspaceBrandSession.warnings.length !== 1 ? 's' : ''}
                      </summary>
                      <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem', fontSize: '0.8rem', color: '#92400e' }}>
                        {workspaceBrandSession.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </section>
            )}
            {/* ── Workflow summary ─────────────────────────────────────────── */}
            <section
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem' }}
              data-testid="dev-workflow-summary"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '0.9rem' }}>Recommendation:</strong>
                <code
                  style={{ fontSize: '0.82rem', background: '#f1f5f9', borderRadius: 4, padding: '0.1rem 0.35rem' }}
                  data-testid="dev-implementation-pack-recommendation"
                >
                  {implementationPack.recommendedScenarioId}
                </code>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                <span
                  style={{
                    borderRadius: 999,
                    padding: '0.15rem 0.55rem',
                    fontWeight: 600,
                    background: simulatedReadiness.readyForOfficeReview ? '#dcfce7' : '#fee2e2',
                    color: simulatedReadiness.readyForOfficeReview ? '#166534' : '#991b1b',
                  }}
                  data-testid="dev-workflow-summary-office-ready"
                >
                  Office {simulatedReadiness.readyForOfficeReview ? '✓' : '✗'}
                </span>
                <span
                  style={{
                    borderRadius: 999,
                    padding: '0.15rem 0.55rem',
                    fontWeight: 600,
                    background: simulatedReadiness.readyForInstallerHandover ? '#dcfce7' : '#fee2e2',
                    color: simulatedReadiness.readyForInstallerHandover ? '#166534' : '#991b1b',
                  }}
                  data-testid="dev-workflow-summary-installer-ready"
                >
                  Installer {simulatedReadiness.readyForInstallerHandover ? '✓' : '✗'}
                </span>
                <span
                  style={{
                    borderRadius: 999,
                    padding: '0.15rem 0.55rem',
                    fontWeight: 600,
                    background: simulatedReadiness.readyForMaterialsOrdering ? '#dcfce7' : '#fee2e2',
                    color: simulatedReadiness.readyForMaterialsOrdering ? '#166534' : '#991b1b',
                  }}
                  data-testid="dev-workflow-summary-materials-ready"
                >
                  Materials {simulatedReadiness.readyForMaterialsOrdering ? '✓' : '✗'}
                </span>
                <span style={{ background: '#f1f5f9', borderRadius: 999, padding: '0.15rem 0.55rem' }}>
                  Blockers: <strong data-testid="dev-workflow-summary-blocker-count">{simulatedReadiness.blockingReasons.length}</strong>
                </span>
                <span style={{ background: '#f1f5f9', borderRadius: 999, padding: '0.15rem 0.55rem' }}>
                  Follow-ups: <strong data-testid="dev-workflow-summary-follow-up-count">{unresolvedTaskCount}</strong>
                </span>
                <span style={{ background: '#f1f5f9', borderRadius: 999, padding: '0.15rem 0.55rem' }}>
                  Scan items: <strong data-testid="dev-workflow-summary-scan-capture-count">{scanCount}</strong>
                </span>
                <span style={{ background: '#f1f5f9', borderRadius: 999, padding: '0.15rem 0.55rem' }}>
                  Unresolved: <strong data-testid="dev-workflow-summary-unresolved-count">{simulatedUnresolvedDependencies.length}</strong>
                </span>
                <span style={{ background: '#f1f5f9', borderRadius: 999, padding: '0.15rem 0.55rem' }}>
                  Blockers resolved: <strong data-testid="dev-workflow-summary-blockers-resolved">{blockerResolvedCount}/{specificationReadiness.blockingReasons.length}</strong>
                </span>
                <span style={{ background: '#f1f5f9', borderRadius: 999, padding: '0.15rem 0.55rem' }}>
                  Evidence captured: <strong data-testid="dev-workflow-summary-evidence-captured">{capturedRequiredEvidenceCount}/{requiredEvidenceTotal}</strong>
                </span>
                <span style={{ background: '#f1f5f9', borderRadius: 999, padding: '0.15rem 0.55rem' }}>
                  Readiness gates: <strong data-testid="dev-workflow-summary-readiness-progression">{baseReadyGateCount}/3 → {simulatedReadyGateCount}/3</strong>
                </span>
              </div>
            </section>

            {/* ── Next action banner ───────────────────────────────────────── */}
            <div
              style={{
                borderRadius: '0.75rem',
                padding: '0.65rem 0.75rem',
                fontWeight: 600,
                fontSize: '0.88rem',
                background: blockerCount > 0 ? '#fef2f2' : scanCount > 0 || unresolvedDependencyCount > 0 ? '#fffbeb' : '#f0fdf4',
                color: blockerCount > 0 ? '#991b1b' : scanCount > 0 || unresolvedDependencyCount > 0 ? '#92400e' : '#166534',
                border: `1px solid ${blockerCount > 0 ? '#fecaca' : scanCount > 0 || unresolvedDependencyCount > 0 ? '#fde68a' : '#bbf7d0'}`,
              }}
              data-testid="dev-workflow-next-action"
            >
              {nextActionMessage}
            </div>

            {/* ── Storage mode ─────────────────────────────────────────────── */}
            <WorkflowStorageModeSelector
              workflowState={persistedWorkflowSnapshot}
              workflowExportPackage={workflowExportPackage}
            />

            {/* ── Step 1: Readiness ────────────────────────────────────────── */}
            <WorkflowStep
              stepNumber={1}
              title="Readiness"
              testId="dev-workflow-step-readiness"
              complete={simulatedReadiness.blockingReasons.length === 0}
            >
              <SpecificationReadinessPanel readiness={projectedReadiness} />
            </WorkflowStep>

            {/* ── Step 2: Follow-up tasks ──────────────────────────────────── */}
            <WorkflowStep
              stepNumber={2}
              title="Follow-up tasks"
              testId="dev-workflow-step-follow-up-tasks"
              complete={unresolvedTaskCount === 0}
            >
              <div style={{ marginBottom: '0.65rem' }}>
                <OperationalDigestPanel digest={installerWorkflowProjection.operationalDigest} />
              </div>
              <SurveyFollowUpTaskPanel
                tasks={installerWorkflowProjection.followUpTasks}
                lines={specificationLines}
                materials={materialsSchedule}
                engineerJobPack={engineerJobPack}
                onToggleResolved={(taskId) =>
                  setActive((current) => {
                    if (current?.implementationReview == null) return current;
                    const ids = current.implementationReview.resolutionSimulation.resolvedTaskIds;
                    const nextIds = ids.includes(taskId)
                      ? ids.filter((id) => id !== taskId)
                      : [...ids, taskId];
                    return {
                      ...current,
                      implementationReview: {
                        ...current.implementationReview,
                        resolutionSimulation: {
                          ...current.implementationReview.resolutionSimulation,
                          resolvedTaskIds: nextIds,
                        },
                      },
                    };
                  })}
              />
            </WorkflowStep>

            {/* ── Step 3: Scan evidence plan ───────────────────────────────── */}
            <WorkflowStep
              stepNumber={3}
              title="Scan evidence plan"
              testId="dev-workflow-step-scan-evidence"
              complete={scanCount === 0 && unresolvedDependencyCount === 0}
            >
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <FollowUpEvidencePlanPanel
                  plan={simulatedEvidencePlan}
                  engineerJobPack={engineerJobPack}
                  capturedEvidenceIds={resolutionSimulation.capturedEvidenceIds}
                  onToggleCaptured={(evidenceId) =>
                    setActive((current) => {
                      if (current?.implementationReview == null) return current;
                      const ids = current.implementationReview.resolutionSimulation.capturedEvidenceIds;
                      const nextIds = ids.includes(evidenceId)
                        ? ids.filter((id) => id !== evidenceId)
                        : [...ids, evidenceId];
                      return {
                        ...current,
                        implementationReview: {
                          ...current.implementationReview,
                          resolutionSimulation: {
                            ...current.implementationReview.resolutionSimulation,
                            capturedEvidenceIds: nextIds,
                          },
                        },
                      };
                    })}
                />
                <FollowUpScanHandoffPanel
                  handoff={followUpScanHandoff}
                  resolvedDependencyIds={resolutionSimulation.resolvedDependencyIds}
                  onToggleDependencyResolved={(dependencyId) =>
                    setActive((current) => {
                      if (current?.implementationReview == null) return current;
                      const ids = current.implementationReview.resolutionSimulation.resolvedDependencyIds;
                      const nextIds = ids.includes(dependencyId)
                        ? ids.filter((id) => id !== dependencyId)
                        : [...ids, dependencyId];
                      return {
                        ...current,
                        implementationReview: {
                          ...current.implementationReview,
                          resolutionSimulation: {
                            ...current.implementationReview.resolutionSimulation,
                            resolvedDependencyIds: nextIds,
                          },
                        },
                      };
                    })}
                />
                <ScanHandoffEnvelopePreviewPanel envelope={scanHandoffEnvelopePreview} />
              </div>
            </WorkflowStep>

            {/* ── Step 4: Scope packs (collapsed) ─────────────────────────── */}
            <WorkflowStep stepNumber={4} title="Scope packs" testId="dev-workflow-step-scope-packs" defaultExpanded={false}>
              <InstallationScopePackReviewPanel
                packs={scopePacks}
                lines={specificationLines}
                onPacksChange={(nextScopePacks) =>
                  setActive((current) => {
                    if (current?.implementationReview == null) return current;
                    return {
                      ...current,
                      implementationReview: {
                        ...current.implementationReview,
                        scopePacks: nextScopePacks,
                      },
                    };
                  })}
              />
            </WorkflowStep>

            {/* ── Step 5: Specification lines (collapsed) ──────────────────── */}
            <WorkflowStep stepNumber={5} title="Specification lines" testId="dev-workflow-step-specification-lines" defaultExpanded={false}>
              <SpecificationLineReviewPanel
                lines={specificationLines}
                onLinesChange={(nextLines) =>
                  setActive((current) => {
                    if (current?.implementationReview == null) return current;
                    return {
                      ...current,
                      implementationReview: {
                        ...current.implementationReview,
                        specificationLines: nextLines,
                      },
                    };
                  })}
              />
            </WorkflowStep>

            {/* ── Step 6: Materials schedule (collapsed) ───────────────────── */}
            <WorkflowStep stepNumber={6} title="Materials schedule" testId="dev-workflow-step-materials-schedule" defaultExpanded={false}>
              <MaterialsScheduleReviewPanel
                materials={materialsSchedule}
                lines={specificationLines}
              />
            </WorkflowStep>

            {/* ── Step 7: Engineer job pack (collapsed) ────────────────────── */}
            <WorkflowStep stepNumber={7} title="Engineer job pack" testId="dev-workflow-step-engineer-job-pack" defaultExpanded={false}>
              <EngineerJobPackPreviewPanel jobPack={engineerJobPack} />
            </WorkflowStep>

            {/* ── Step 8: Handover preview (collapsed) ─────────────────────── */}
            <WorkflowStep stepNumber={8} title="Handover preview" testId="dev-workflow-step-handover-preview" defaultExpanded={false}>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <ImplementationPackReviewPanel pack={implementationPack.pack} />
                <ScopePackHandoverPreviewPanel handover={scopePackHandover} />
              </div>
            </WorkflowStep>
          </div>
        </div>
      );
    }

    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
        <div style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
          <button
            type="button"
            className="back-btn"
            onClick={handleBackToLauncher}
            data-testid="dev-fixture-back"
          >
            ← Back to fixtures
          </button>
          <span
            className="atlas-dev-notice"
            style={{ margin: 0 }}
            data-testid="dev-fixture-active-label"
          >
            🔬 Dev fixture portal — not customer data · {active.fixture.label}
          </span>
        </div>
        <CustomerPortalPage
          reference="dev-fixture"
          devFixtureInput={active.fixture.engineInput}
          devInitialViewMode={active.initialView as 'insight' | 'presentation' | undefined}
          showDevTraceLabelsOverride={true}
        />
      </div>
    );
  }

  return (
    <div className="dev-portal-fixture" data-testid="dev-portal-fixture-launcher">
      <header className="dev-portal-fixture__header">
        {onBack && (
          <button type="button" className="back-btn" onClick={onBack} data-testid="dev-fixture-page-back">
            ← Back
          </button>
        )}
        <div className="dev-portal-fixture__banner" data-testid="dev-fixture-banner">
          <span aria-hidden="true">🔬</span>
          <strong>Dev fixture portal — not customer data</strong>
          <span>Select a fixture to open the real portal renderer with pre-built engine input. No tokens, no API calls, no persistence.</span>
        </div>
        <h1 className="dev-portal-fixture__heading">Portal Fixture Launcher</h1>
        <p className="dev-portal-fixture__subheading">
          Each fixture opens the real <code>CustomerPortalPage</code> / <code>InsightPackDeck</code> path using a fixed engine input.
          Use these to test portal features without a live visit or signed token.
        </p>
      </header>

      <ul className="dev-portal-fixture__list" role="list" data-testid="fixture-list">
        {PORTAL_FIXTURES.map((fixture) => (
          <li key={fixture.id}>
            <FixtureCard fixture={fixture} onOpen={handleOpen} />
          </li>
        ))}
      </ul>
    </div>
  );
}
