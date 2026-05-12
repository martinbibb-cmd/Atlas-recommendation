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
import { buildSurveyFollowUpTasks } from '../specification/followUps';
import SurveyFollowUpTaskPanel from '../components/dev/SurveyFollowUpTaskPanel';
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
  };
}

type ImplementationPackTabKey =
  | 'pack_summary'
  | 'scope_packs'
  | 'specification_lines'
  | 'engineer_job_pack'
  | 'materials_schedule'
  | 'handover_preview';

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
  const [implementationPackTab, setImplementationPackTab] = useState<ImplementationPackTabKey>('pack_summary');

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
      setImplementationPackTab('pack_summary');
      setActive({
        fixture,
        initialView,
        implementationReview: {
          implementationPack,
          specificationLines,
          scopePacks,
          materialsSchedule,
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

      const { implementationPack, specificationLines, scopePacks, materialsSchedule } = reviewState;
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
      const supportingPdfJourneyTypeForFixture = getSupportingPdfJourneyType(active.fixture);
      const supportingPdfModel = supportingPdfJourneyTypeForFixture != null
        ? buildSupportingPdfModel(active.fixture)
        : null;

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

          <div style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
            <section
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem' }}
              data-testid="dev-implementation-pack-summary"
            >
              <strong>Recommendation scenario:</strong>{' '}
              <span data-testid="dev-implementation-pack-recommendation">{implementationPack.recommendedScenarioId}</span>
            </section>

            <section
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem' }}
              data-testid="dev-implementation-pack-customer-insight"
            >
              <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Customer Insight</h2>
              <CustomerPortalPage
                reference="dev-fixture"
                devFixtureInput={active.fixture.engineInput}
                devInitialViewMode="insight"
                showDevTraceLabelsOverride={true}
              />
            </section>

            <section
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem' }}
              data-testid="dev-implementation-pack-supporting-pdf"
            >
              <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Supporting PDF</h2>
              {supportingPdfModel ? (
                <PortalJourneyPrintPack model={supportingPdfModel} />
              ) : (
                <p style={{ margin: 0 }}>Supporting PDF preview is not configured for this fixture.</p>
              )}
            </section>

            <section
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem' }}
              data-testid="dev-implementation-pack-panel"
            >
              <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Implementation Pack</h2>
              <div style={{ marginBottom: '0.75rem' }}>
                <SpecificationReadinessPanel readiness={specificationReadiness} />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <SurveyFollowUpTaskPanel
                  tasks={surveyFollowUpTasks}
                  lines={specificationLines}
                  materials={materialsSchedule}
                  engineerJobPack={engineerJobPack}
                />
              </div>
              <div
                style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}
                role="tablist"
                aria-label="Implementation pack tabs"
                data-testid="dev-implementation-pack-tabs"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={implementationPackTab === 'pack_summary'}
                  onClick={() => setImplementationPackTab('pack_summary')}
                  className="dev-portal-fixture__btn"
                  data-testid="dev-implementation-pack-tab-pack-summary"
                >
                  Pack summary
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={implementationPackTab === 'scope_packs'}
                  onClick={() => setImplementationPackTab('scope_packs')}
                  className="dev-portal-fixture__btn"
                  data-testid="dev-implementation-pack-tab-scope-packs"
                >
                  Scope packs
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={implementationPackTab === 'specification_lines'}
                  onClick={() => setImplementationPackTab('specification_lines')}
                  className="dev-portal-fixture__btn"
                  data-testid="dev-implementation-pack-tab-specification-lines"
                >
                  Specification lines
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={implementationPackTab === 'engineer_job_pack'}
                  onClick={() => setImplementationPackTab('engineer_job_pack')}
                  className="dev-portal-fixture__btn"
                  data-testid="dev-implementation-pack-tab-engineer-job-pack"
                >
                  Engineer job pack
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={implementationPackTab === 'materials_schedule'}
                  onClick={() => setImplementationPackTab('materials_schedule')}
                  className="dev-portal-fixture__btn"
                  data-testid="dev-implementation-pack-tab-materials-schedule"
                >
                  Materials schedule
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={implementationPackTab === 'handover_preview'}
                  onClick={() => setImplementationPackTab('handover_preview')}
                  className="dev-portal-fixture__btn"
                  data-testid="dev-implementation-pack-tab-handover-preview"
                >
                  Handover preview
                </button>
              </div>
              {implementationPackTab === 'pack_summary' ? (
                <ImplementationPackReviewPanel pack={implementationPack.pack} />
              ) : implementationPackTab === 'scope_packs' ? (
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
              ) : implementationPackTab === 'specification_lines' ? (
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
              ) : implementationPackTab === 'engineer_job_pack' ? (
                <EngineerJobPackPreviewPanel jobPack={engineerJobPack} />
              ) : implementationPackTab === 'materials_schedule' ? (
                <MaterialsScheduleReviewPanel
                  materials={materialsSchedule}
                  lines={specificationLines}
                />
              ) : (
                <ScopePackHandoverPreviewPanel handover={scopePackHandover} />
              )}
            </section>
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
