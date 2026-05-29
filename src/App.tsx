import { useState, useEffect, lazy, Suspense, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import FastChoiceStepper from './components/stepper/FastChoiceStepper';
import FullSurveyStepper from './components/stepper/FullSurveyStepper';
import Footer from './components/Footer';
import ScopePage from './components/governance/ScopePage';
import MethodologyPage from './components/governance/MethodologyPage';
import NeutralityPage from './components/governance/NeutralityPage';
import PrivacyPage from './components/governance/PrivacyPage';
import ExplainersHubPage from './explainers/ExplainersHubPage';
import LabShell from './components/lab/LabShell';
import HouseSimulatorPage from './features/houseSimulator/HouseSimulatorPage';
import LabQuickInputsPanel from './components/lab/LabQuickInputsPanel';
import LabPrintCustomer from './components/lab/LabPrintCustomer';
import LabPrintTechnical from './components/lab/LabPrintTechnical';
import LabPrintComparison from './components/lab/LabPrintComparison';
import { buildScenariosFromEngineOutput } from './engine/modules/buildScenariosFromEngineOutput';
import { buildDecisionFromScenarios } from './engine/modules/buildDecisionFromScenarios';
import { buildCustomerSummary } from './engine/modules/buildCustomerSummary';

import FloorPlanBuilder from './components/floorplan/FloorPlanBuilder';
import PrototypeComposerPage from './legacy/systemComposerPrototype/PrototypeComposerPage';
import HeatLossCalculator from './components/heatloss/HeatLossCalculator';
import BuildingHeightCheck from './components/measurements/BuildingHeightCheck';
import AtlasExplorerPage from './components/explorer/AtlasExplorerPage';
import VisitPage from './components/visit/VisitPage';
import RecentVisitsList from './components/visit/RecentVisitsList';
import EngineerPreinstallPage from './components/engineer/EngineerPreinstallPage';
import { SpatialTwinPage } from './features/spatialTwin/routes/SpatialTwinPage';
import ReportPage from './components/reportpage/ReportPage';
import CustomerPortalPage from './components/portal/CustomerPortalPage';
import GlobalMenuShell from './components/shell/GlobalMenuShell';

import { getVisit, saveVisit, type VisitMeta } from './lib/visits/visitApi';
import { VisitProvider } from './features/visits/VisitProvider';
import { createAtlasVisit } from './features/visits/createAtlasVisit';
import type { AtlasVisit } from './features/visits/createAtlasVisit';
import { retrieveActiveVisit, storeActiveVisit } from './features/visits/visitStore';
import { BrandProvider } from './features/branding/BrandProvider';
import { StartVisitPanel } from './features/visits/StartVisitPanel';
import { DEFAULT_BRAND_ID } from './features/branding/brandProfiles';
import { TenantOnboardingPage } from './features/tenants/TenantOnboardingPage';
import { useWorkspaceFromHost } from './features/tenants/useWorkspaceFromHost';
import { listReportsForVisit, saveReport } from './lib/reports/reportApi';
import { generateReportTitle } from './lib/reports/generateReportTitle';
import { generatePortalToken } from './lib/portal/portalToken';
import type { EngineInputV2_3 } from './engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from './ui/fullSurvey/FullSurveyModelV1';
import { toEngineInput } from './ui/fullSurvey/FullSurveyModelV1';
import { sanitiseModelForEngine } from './ui/fullSurvey/sanitiseModelForEngine';
import { runEngine } from './engine/Engine';
import { buildCanonicalReportPayload } from './features/reports/adapters/buildCanonicalReportPayload';
import { getMissingLabFields } from './lib/lab/getMissingLabFields';
import { mergeLabQuickInputs } from './lib/lab/mergeLabQuickInputs';
import { parsePortalPath } from './lib/portal/portalUrl';
import type { DerivedFloorplanOutput } from './components/floorplan/floorplanDerivations';
import CanonicalPresentationPage from './components/presentation/CanonicalPresentationPage';
import type { HeatLossState } from './features/survey/heatLoss/heatLossTypes';
import type { PrioritiesState } from './features/survey/priorities/prioritiesTypes';
import type { RecommendationState } from './features/survey/recommendation/recommendationTypes';
import type { ApplianceFamily } from './engine/topology/SystemTopology';
import { buildPortalUrl } from './lib/portal/portalUrl';
import { openUrlInSystemBrowser } from './lib/navigation/pwaExternalNavigation';
import PhysicsVisualGallery from './components/physics-visuals/preview/PhysicsVisualGallery';
import PresentationAuditPage from './components/audit/PresentationAuditPage';
import DevMenuPage from './components/dev/DevMenuPage';
import ComponentDiscoveryPanel from './components/dev/ComponentDiscoveryPanel';
import ScanImportHarness from './features/scanImport/dev/ScanImportHarness';
import ScanPackageImportFlow from './features/scanImport/ui/ScanPackageImportFlow';
import ReceiveScanPage from './features/scanImport/ui/ReceiveScanPage';
import ScanSessionListPage from './features/scanImport/ui/ScanSessionListPage';
import { ScanHandoffReceivePage } from './features/scanHandoff';
import { getScanCapture } from './features/scanHandoff/scanHandoffStore';
import { LegoTechnixDebugProjectionPage } from './features/legoTechnix/debug';
import { resetDemoData, DEMO_VISIT_IDS } from './dev/demoSeed';
import WorkspaceHomePage from './features/workspace/WorkspaceHomePage';
import WorkspaceDetailPage from './features/workspace/WorkspaceDetailPage';
import WorkspaceDashboard from './features/workspace/WorkspaceDashboard';
import WorkspaceSettingsPage from './features/workspace/WorkspaceSettingsPage';
import VisitHandoffReviewPage from './features/visitHandoff/components/VisitHandoffReviewPage';
import CustomerSummaryPrintPage from './features/visitHandoff/components/CustomerSummaryPrintPage';
import EngineerSummaryPrintPage from './features/visitHandoff/components/EngineerSummaryPrintPage';
import { SAMPLE_VISIT_HANDOFF_PACK } from './features/visitHandoff/fixtures/sampleVisitHandoffPack';
import { buildHandoffPackFromSurvey } from './features/visitHandoff/parser/buildHandoffPackFromSurvey';
import InsightPackDeck from './legacy/customerOutputPrototype/insightPack/InsightPackDeck';
import VisitDetailView from './features/scanImport/ui/VisitDetailView';
import { buildInsightPackFromEngine } from './legacy/customerOutputPrototype/insightPack/buildInsightPackFromEngine';
import type { InsightPackSurveyContext } from './legacy/customerOutputPrototype/insightPack/buildInsightPackFromEngine';
import type { QuoteInput } from './legacy/customerOutputPrototype/insightPack/insightPack.types';
import type { LifecycleBoilerType } from './contracts/LifecycleAssessment';
import type { EngineOutputV1 } from './contracts/EngineOutputV1';
import type { AtlasDecisionV1 } from './contracts/AtlasDecisionV1';
import type { PortalVisitContextV1 } from './contracts/PortalVisitContextV1';
import type { ScenarioResult } from './contracts/ScenarioResult';
import type { CustomerSummaryV1 } from './contracts/CustomerSummaryV1';
import {
  writeVersionedCache,
  readVersionedCache,
} from './lib/storage/versionedCache';
import {
  clearAtlasCache,
  ATLAS_CACHE_KEY_SESSION,
  ATLAS_CACHE_KEY_VISIT,
  ATLAS_CACHE_SCHEMA_VERSION,
} from './lib/storage/atlasCacheKeys';
import { trackVisitCompleted } from './features/analytics/analyticsTracker';
import AnalyticsDashboard from './features/analytics/AnalyticsDashboard';
import { ExternalVisitManifestPanel } from './features/externalFiles/ExternalVisitManifestPanel';
import { ActiveUserProvider } from './features/userProfiles/ActiveUserProvider';
import { useActiveUser } from './features/userProfiles/useActiveUser';
import { useRolePermissions } from './features/userProfiles/useRolePermissions';
import { UserProfilePanel } from './features/userProfiles/UserProfilePanel';
import { AtlasAuthProvider } from './auth/AtlasAuthProvider';
import { RequireAuth } from './auth/RequireAuth';
import { useAtlasAuth } from './auth/useAtlasAuth';
import {
  isVisualEducationLibraryQaHubRoute,
  resolveActiveVisualEducationLibrarySurface,
} from './dev/visualEducationLibrary';
import {
  DEFAULT_PERMISSIONS_BY_ROLE,
  type WorkspaceMemberRole,
  type WorkspaceMembershipV1,
  WorkspaceSessionProvider,
  useWorkspaceSession,
  WorkspaceSessionGuard,
  WorkspaceBrandSessionProvider,
  useWorkspaceBrandSession,
} from './auth/profile';
import { upsertVisitIdentity } from './visits/visitIdentityStore';
import { SpecificationErrorBoundary } from './features/installationSpecification/ui/SpecificationErrorBoundary';
import { buildCurrentInstallationSummaryFromCanonicalSurvey } from './features/installationSpecification/model/buildCurrentInstallationSummaryFromCanonicalSurvey';
import type { CanonicalCurrentSystemSummary } from './features/installationSpecification/ui/installationSpecificationUiTypes';
import type { InstallationSpecificationOptionV1 } from './features/installationSpecification/model/QuoteInstallationPlanV1';
import {
  buildPersistedAtlasVisitV2,
  saveVisitAtomically,
  readPersistedAtlasVisitV2,
  clearPersistedAtlasVisitV2,
  type PersistedAtlasVisitV2,
} from './lib/storage/persistedAtlasVisitV2';
import {
  buildGeneratedOutputDependencyProjection,
  buildVisitEnvelopeReadinessProjection,
  isArtifactStaleForActiveSnapshot,
  DEFAULT_ATLAS_VISIT_JOURNEY_STATE,
  type CanonicalRecommendationSnapshotV1,
  createEmptyGeneratedOutputs,
  deriveLifecycleStateFromSnapshot,
  isRecommendationReadyForLifecycle,
  normaliseGeneratedOutputs,
  transitionAtlasVisitJourney,
  withGeneratedPortalOutput,
  type GeneratedOutputsV1,
  type VisitReviewLifecycleEvent,
  type VisitReviewLifecycleState,
} from './lib/storage/visitReviewLifecycle';
import { WelcomePackDevPreview } from './library/dev/WelcomePackDevPreview';
import { LibraryExplorerPage } from './library/dev/LibraryExplorerPage';
import { VisualEducationLibraryQaHubPage } from './library/dev/VisualEducationLibraryQaHubPage';
import { DiagramFixturePage } from './library/dev/DiagramFixturePage';
import { SealedUnventedExplainerSlicePage } from './library/dev/SealedUnventedExplainerSlicePage';
import { VisualPrimitiveGallery } from './library/visualPrimitives/VisualPrimitiveGallery';
import { VisualTopologyGallery } from './library/visualTopologies/VisualTopologyGallery';
import { AnalogyOverlayGallery } from './library/analogyOverlays/AnalogyOverlayGallery';
import DevPortalFixturePage from './dev/DevPortalFixturePage';
import CustomerPortalPreviewPage from './dev/CustomerPortalPreviewPage';
import CustomerPackPreviewPage from './dev/CustomerPackPreviewPage';
import PhoneFirstQaHarness from './dev/PhoneFirstQaHarness';
import { WorkspaceVisitLifecycleHarness } from './dev/workspaceQa';
import { VisitHomeDashboard } from './features/visitHome/VisitHomeDashboard';
import type {
  VisitSelectorEntry,
} from './features/visitHome/VisitHomeDashboard';
import {
  appendPackageOpenHistory,
  buildExportConfirmationStatus,
  buildImportFailureStatus,
  buildPackageImportStatusMessage,
  buildWorkflowQaChecklist,
  toImportSurfaceLabel,
  type LocalSessionStatus,
  type VisitPackageOpenHistoryEntry,
  type WorkflowImportFailureDiagnostic,
  type WorkflowImportSurface,
} from './features/visitHome/workflowStabilisation';
import { canShowVisitHomeExportPackageAction } from './features/visitHome/visitHomeExportAvailability';
import { resolveCustomerPdfDownloadBaseName } from './features/visitHome/resolveCustomerPdfDownloadBaseName';
import {
  formatVisitReference,
  resolveCanonicalVisitExportState,
  resolveVisitSessionReference,
  type VisitRecommendationSnapshotLike,
} from './features/visitHome/resolveCanonicalVisitExportState';
import { VisitHomeUnifiedSimulatorRoute } from './features/visitHome/VisitHomeUnifiedSimulatorRoute';
import { buildAppHomeNewVisitEntryState } from './features/visitHome/appHomeVisitEntry';
import {
  runLibraryPdfBootState,
  type LibraryPdfBootResult,
  type LibraryPdfHydratedSnapshot,
} from './features/visitHome/libraryPdfBootState';
import { buildCanonicalRecommendationSnapshot } from './lib/storage/canonicalRecommendationSnapshot';
import {
  buildVisitHomeCustomerArtifactsState,
  resolvePackagedPortalEngineInput,
} from './features/visitHome/customerArtifactsState';
import {
  buildCanonicalVisitPackage,
  buildVisitPackagePdfEnvelope,
  parseCanonicalVisitPackageFromPdfEnvelope,
  parseCanonicalVisitPackage,
  renderVisitPackagePdfDocument,
  type CanonicalVisitPackageIntegrityResult,
  type CanonicalVisitPackageV1,
} from './features/visitPackage';
import { PortalJourneyPrintPack } from './library/portal/pdf/PortalJourneyPrintPack';
import {
  buildCustomerJourneyPack,
  buildCustomerJourneyPackGeneratedOutput,
  inferCustomerJourneyTypeFromSystemContext,
  isFallbackOnlyCustomerPdf,
  resolveRecommendationIntentCategory,
  resolveRecommendationConceptSelection,
  readCustomerJourneyPackFromGeneratedOutputs,
} from './library/portal/pdf/buildPortalJourneyPrintModel';
import type { SurveySystemConditionV1 } from './library/portal/pdf/buildPortalJourneyPrintModel';
import { resolveCustomerDocumentSourceV1 } from './library/portal/pdf/CustomerDocumentSourceV1';
import { buildCalmWelcomePackFromAtlasDecision } from './library/packRenderer';
import { buildLibraryAudienceProjection } from './library/projections';
import type { LibraryContentProjectionV1 } from './library/projections';
import type { PortalLaunchPayloadV1 } from './features/portalLaunch';
import {
  buildScanLaunchPayload,
  prepareScanLaunchRoute,
} from './features/scanLaunch';

// Lazy-load InstallationSpecificationPage so that any runtime crash during import
// or render is caught by SpecificationErrorBoundary rather than blanking the app.
const InstallationSpecificationPage = lazy(() =>
  import('./features/installationSpecification/ui/InstallationSpecificationPage').then(
    (m) => ({ default: m.InstallationSpecificationPage }),
  ),
);

// Visible fallback shown while InstallationSpecificationPage is loading.
const specificationLoadingFallback = (
  <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>
    Loading specification…
  </div>
);
import './App.css';

/**
 * Maps a broad heat-source family (including 'ashp' / 'other' which are not
 * valid LifecycleBoilerType values) to the nearest lifecycle-compatible type.
 * Falls back to 'regular' for anything that isn't a gas boiler variant.
 */
function toLifecycleBoilerType(
  value: 'combi' | 'system' | 'regular' | 'ashp' | 'other' | undefined,
): LifecycleBoilerType {
  if (value === 'combi' || value === 'system' || value === 'regular') {
    return value;
  }
  return 'regular';
}

function formatSavedAgo(updatedAt: string): string {
  const savedMs = new Date(updatedAt).getTime();
  if (!Number.isFinite(savedMs)) return 'just now';
  const deltaMins = Math.max(0, Math.round((Date.now() - savedMs) / 60000));
  if (deltaMins <= 1) return 'just now';
  if (deltaMins < 60) return `${deltaMins} mins ago`;
  const hours = Math.round(deltaMins / 60);
  return `${hours}h ago`;
}

const CUSTOMER_PACK_FILENAME_SUFFIX = '-customer-pack.pdf';

function hasText(value: string | null | undefined): value is string {
  return value != null && value.trim().length > 0;
}

function normalizeScenarioId(value: string | undefined): string | undefined {
  if (!hasText(value)) return undefined;
  return value.trim().toLowerCase();
}

function mapScenarioIdToTopologyId(value: string | undefined): string | undefined {
  const normalized = normalizeScenarioId(value);
  if (normalized == null) return undefined;
  if (normalized.includes('ashp') || normalized.includes('heat_pump') || normalized.includes('gshp')) return 'heat_pump';
  if (normalized.includes('combi')) return 'combi';
  if (normalized.includes('mixergy')) return 'mixergy';
  if (normalized.includes('thermal_store')) return 'thermal_store';
  if (normalized.includes('system')) return 'sealed_system_unvented';
  if (normalized.includes('regular') || normalized.includes('open_vented')) return 'open_vented';
  return undefined;
}

function mapEnginePrimaryToTopologyId(value: string | undefined): string | undefined {
  const normalized = normalizeScenarioId(value);
  if (normalized === 'ashp' || normalized === 'heat_pump') return 'heat_pump';
  if (normalized === 'combi') return 'combi';
  if (normalized === 'system') return 'sealed_system_unvented';
  if (normalized === 'regular') return 'open_vented';
  return undefined;
}

function resolveAuthorityIntegrityIssues(input: {
  readonly selectedScenarioId?: string;
  readonly exportDecision?: AtlasDecisionV1;
  readonly exportCustomerSummary?: CustomerSummaryV1;
  readonly currentSnapshot: VisitRecommendationSnapshotLike | null;
  readonly activeCanonicalPackage?: CanonicalVisitPackageV1 | null;
}): string[] {
  const issues: string[] = [];
  const selectedScenarioId = normalizeScenarioId(input.selectedScenarioId);
  const decisionScenarioId = normalizeScenarioId(input.exportDecision?.recommendedScenarioId);
  const summaryScenarioId = normalizeScenarioId(input.exportCustomerSummary?.recommendedScenarioId);
  const snapshotScenarioId = normalizeScenarioId(
    input.currentSnapshot?.acceptedScenarioId ?? input.currentSnapshot?.decision?.recommendedScenarioId,
  );
  if (selectedScenarioId != null && snapshotScenarioId != null && selectedScenarioId !== snapshotScenarioId) {
    issues.push('selected scenario diverges from canonical snapshot scenario');
  }
  if (selectedScenarioId != null && decisionScenarioId != null && selectedScenarioId !== decisionScenarioId) {
    issues.push('selected scenario diverges from export decision scenario');
  }
  if (selectedScenarioId != null && summaryScenarioId != null && selectedScenarioId !== summaryScenarioId) {
    issues.push('selected scenario diverges from export customer summary scenario');
  }

  const topologyFromScenario = mapScenarioIdToTopologyId(selectedScenarioId ?? decisionScenarioId ?? summaryScenarioId);
  const topologyFromEngine = mapEnginePrimaryToTopologyId(input.currentSnapshot?.engineOutput?.recommendation?.primary);
  if (
    topologyFromScenario != null
    && topologyFromEngine != null
    && topologyFromScenario !== topologyFromEngine
  ) {
    issues.push(
      `export topology mismatch (${topologyFromScenario} vs ${topologyFromEngine})`,
    );
  }

  const practicalOutcomesText = [
    input.exportDecision?.summary ?? '',
    ...(input.exportDecision?.dayToDayOutcomes ?? []),
  ].join(' ').toLowerCase();
  if (
    topologyFromScenario === 'combi'
    && /(stored hot water|hot water cylinder|unvented cylinder|sealed heating)/.test(practicalOutcomesText)
  ) {
    issues.push('combi recommendation conflicts with stored-hot-water practical outcomes');
  }

  const packagedScenarioId = normalizeScenarioId(
    input.activeCanonicalPackage?.proposalTruth?.selectedScenarioId
      ?? input.activeCanonicalPackage?.proposalTruth?.decision?.recommendedScenarioId
      ?? input.activeCanonicalPackage?.proposalTruth?.customerSummary?.recommendedScenarioId,
  );
  if (
    packagedScenarioId != null
    && snapshotScenarioId != null
    && packagedScenarioId !== snapshotScenarioId
  ) {
    issues.push('export is using a stale package snapshot');
  }
  const activeSnapshotId = input.currentSnapshot?.recommendationSnapshot?.snapshotId;
  const packagedSnapshotId =
    input.activeCanonicalPackage?.recommendationAuthority?.snapshotId
    ?? input.activeCanonicalPackage?.importExportMetadata.recommendationSnapshot?.snapshotId;
  if (
    hasText(packagedSnapshotId)
    && hasText(activeSnapshotId)
    && packagedSnapshotId !== activeSnapshotId
  ) {
    issues.push('export package recommendation snapshot diverges from active snapshot authority');
  }
  const outputs = input.currentSnapshot?.generatedOutputs;
  if (outputs != null) {
    if (isArtifactStaleForActiveSnapshot(outputs.portal, activeSnapshotId)) {
      issues.push('portal artifact is stale for active recommendation snapshot');
    }
    if (isArtifactStaleForActiveSnapshot(outputs.pdf, activeSnapshotId)) {
      issues.push('pdf artifact is stale for active recommendation snapshot');
    }
    if (isArtifactStaleForActiveSnapshot(outputs.customerJourneyPack, activeSnapshotId)) {
      issues.push('customer journey pack artifact is stale for active recommendation snapshot');
    }
    if (isArtifactStaleForActiveSnapshot(outputs.simulatorReview, activeSnapshotId)) {
      issues.push('simulator artifact is stale for active recommendation snapshot');
    }
    if (isArtifactStaleForActiveSnapshot(outputs.handoff, activeSnapshotId)) {
      issues.push('handoff artifact is stale for active recommendation snapshot');
    }
  }
  return issues;
}

function resolveExportRecommendationId(input: {
  readonly selectedScenarioId?: string;
  readonly exportDecision?: AtlasDecisionV1;
  readonly exportCustomerSummary?: CustomerSummaryV1;
}): string {
  return (
    normalizeScenarioId(
      input.selectedScenarioId
      ?? input.exportDecision?.recommendedScenarioId
      ?? input.exportCustomerSummary?.recommendedScenarioId,
    )
    ?? 'unknown'
  );
}

function resolveReviewRecommendationId(snapshot: VisitRecommendationSnapshotLike | null): string {
  return (
    normalizeScenarioId(snapshot?.acceptedScenarioId ?? snapshot?.decision?.recommendedScenarioId)
    ?? 'unknown'
  );
}

function buildExportBlockedMessage(input: {
  readonly reviewRecommendationId: string;
  readonly exportRecommendationId: string;
  readonly snapshotChecksum: string;
  readonly mismatchReasons: readonly string[];
}): string {
  const primaryReason = input.mismatchReasons[0] ?? 'unknown mismatch';
  return (
    'Export blocked: recommendation/evidence mismatch. ' +
    `review recommendation id=${input.reviewRecommendationId}; ` +
    `export recommendation id=${input.exportRecommendationId}; ` +
    `snapshot checksum=${input.snapshotChecksum}; ` +
    `mismatch reason=${primaryReason}.`
  );
}

function toSafeDownloadBaseName(value: string): string {
  const trimmed = value.trim();
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return safe.length > 0 ? safe : 'atlas-visit';
}

function invalidateGeneratedArtifacts(
  outputs: Partial<GeneratedOutputsV1> | undefined,
): GeneratedOutputsV1 {
  const normalised = normaliseGeneratedOutputs(outputs);
  return {
    ...normalised,
    portal: { generated: false },
    pdf: { generated: false },
    customerJourneyPack: { generated: false },
    simulatorReview: { generated: false },
    handoff: { generated: false },
  };
}

function withArtifactSnapshotId(
  outputs: Partial<GeneratedOutputsV1> | undefined,
  snapshotId: string | undefined,
): GeneratedOutputsV1 {
  const normalised = normaliseGeneratedOutputs(outputs);
  if (!hasText(snapshotId)) {
    return normalised;
  }
  return {
    portal: { ...normalised.portal, snapshotId },
    pdf: { ...normalised.pdf, snapshotId },
    customerJourneyPack: normalised.customerJourneyPack == null
      ? normalised.customerJourneyPack
      : { ...normalised.customerJourneyPack, snapshotId },
    simulatorReview: { ...normalised.simulatorReview, snapshotId },
    handoff: { ...normalised.handoff, snapshotId },
  };
}

function buildImportedVisitId(visitReference: string | undefined): string {
  const importSuffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Date.now().toString(36);
  return `imported_${toSafeDownloadBaseName(visitReference ?? 'visit').toLowerCase()}_${importSuffix}`;
}

type PersistedPortalVisitContext = Pick<PortalVisitContextV1, 'addressSummary' | 'personalDataMode'>;

function isLegacyJourney(journey: Journey): boolean {
  return (
    journey === 'insight-pack'
    || journey === 'framework-print'
    || journey === 'unified-simulator'
  );
}

function buildSurveySystemConditionFromModel(
  surveyModel: FullSurveyModelV1 | undefined,
): SurveySystemConditionV1 | undefined {
  if (surveyModel == null) return undefined;
  const heatingCondition = surveyModel.fullSurvey?.heatingCondition;
  const recommendation = surveyModel.fullSurvey?.recommendation;
  const currentSystem = surveyModel.currentSystem;
  const systemAgeYears = currentSystem?.boiler?.ageYears;
  const surveyCondition: SurveySystemConditionV1 = {
    bleedWaterColour: heatingCondition?.bleedWaterColour,
    coldSpots: heatingCondition?.radiatorsColdAtBottom,
    unevenHeating: heatingCondition?.radiatorsHeatingUnevenly,
    magneticDebrisEvidence: heatingCondition?.magneticDebrisEvidence,
    systemNoisyOrInconsistent: heatingCondition?.boilerCavitationOrNoise,
    systemAgeYears,
    filterPresent: surveyModel.hasMagneticFilter,
    installerFlushStrategy: recommendation?.powerflush ?? null,
    recentlyCleaned: currentSystem?.conditionSignals?.cleaningHistory === 'recently_cleaned',
  };
  return surveyCondition;
}

function enrichGeneratedOutputsWithCustomerJourneyPack(input: {
  readonly generatedOutputs?: Partial<GeneratedOutputsV1>;
  readonly surveyModel?: FullSurveyModelV1;
  readonly engineInput?: EngineInputV2_3;
  readonly customerSummary?: CustomerSummaryV1;
  readonly decision?: AtlasDecisionV1;
  readonly activeSnapshotId?: string;
  readonly portalVisitContext?: PersistedPortalVisitContext;
  readonly generatedAt?: string;
  readonly scenarios?: ScenarioResult[];
}): GeneratedOutputsV1 {
  const outputs = withArtifactSnapshotId(input.generatedOutputs, input.activeSnapshotId);
  if (input.surveyModel == null || input.engineInput == null || input.customerSummary == null) {
    return outputs;
  }
  const recommendedScenarioId =
    input.decision?.recommendedScenarioId ?? input.customerSummary.recommendedScenarioId;
  const recommendationIntent = resolveRecommendationIntentCategory({
    recommendedScenarioId,
    currentHeatSourceType: input.engineInput.currentHeatSourceType,
    currentSystemHeatingType: input.surveyModel.currentSystem?.heatingSystemType,
    dhwStorageType: input.engineInput.dhwStorageType,
  });
  const inferredJourneyType = inferCustomerJourneyTypeFromSystemContext({
    currentHeatSourceType: input.engineInput.currentHeatSourceType,
    currentSystemHeatingType: input.surveyModel.currentSystem?.heatingSystemType,
    dhwStorageType: input.engineInput.dhwStorageType,
    recommendedScenarioId,
  });
  const surveyCondition = buildSurveySystemConditionFromModel(input.surveyModel);
  const routedSelection = resolveRecommendationConceptSelection({
    selectedSectionIds: [],
    recommendationSummary: input.customerSummary.headline,
    customerFacts: [],
    journeyType: inferredJourneyType,
    recommendationIntent,
    surveyCondition,
  });
  if (
    import.meta.env.DEV
    && recommendationIntent === 'combi_replacement'
    && routedSelection.conceptTags.includes('stored_hot_water_recovery_timeline')
  ) {
    console.error('[Atlas] Non-canonical routing: combi recommendation received cylinder recovery concept tags.');
  }
  let audienceProjection: LibraryContentProjectionV1 | undefined;
  if (input.decision != null && input.customerSummary != null && input.scenarios != null && input.scenarios.length > 0) {
    try {
      const { calmViewModel } = buildCalmWelcomePackFromAtlasDecision({
        customerSummary: input.customerSummary,
        atlasDecision: input.decision,
        scenarios: input.scenarios,
      });
      audienceProjection = buildLibraryAudienceProjection({
        calmViewModel,
        operationalDigest: { digestVersion: 'v1', generatedAt: new Date().toISOString(), primaryItemLimit: 0, totalItems: 0, items: [] },
        educationalContent: [],
        audience: 'customer',
      });
    } catch {
      // Library projection failed — build customer pack without audience filtering.
    }
  }
  const customerJourneyPack = buildCustomerJourneyPack({
    selectedSectionIds: routedSelection.selectedSectionIds,
    educationalConceptTags: routedSelection.conceptTags,
    recommendationSummary: input.customerSummary.headline,
    customerFacts: [
      input.engineInput.occupancyCount != null
        ? `${input.engineInput.occupancyCount} ${input.engineInput.occupancyCount === 1 ? 'person' : 'people'} in the home`
        : null,
      input.engineInput.bathroomCount != null
        ? `${input.engineInput.bathroomCount} bathroom${input.engineInput.bathroomCount === 1 ? '' : 's'}`
        : null,
      input.engineInput.postcode ? `Property: ${input.engineInput.postcode}` : null,
    ].filter((fact): fact is string => fact != null),
    journeyType: inferredJourneyType,
    recommendationIntent,
    visitContext: input.portalVisitContext,
    surveyCondition,
    audienceProjection,
    liveExperienceExplanations: [
      input.decision?.dayToDayOutcomes[0],
      input.customerSummary.plainEnglishDecision,
      input.customerSummary.whyThisWins[0],
    ].filter((value): value is string => value != null && value.trim().length > 0),
  });
  return {
    ...outputs,
    customerJourneyPack: buildCustomerJourneyPackGeneratedOutput({
      customerJourneyPack,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      snapshotId: input.activeSnapshotId,
    }),
  };
}

/** Detect /dev/devmenu or ?devmenu=1 — renders the developer component browser. */
const DEV_MENU_ENABLED =
  typeof window !== 'undefined' &&
  (
    window.location.pathname === '/dev/devmenu' ||
    new URLSearchParams(window.location.search).get('devmenu') === '1'
  );

/** Detect ?lab=1 feature flag — renders Demo Lab directly for previewing. */
const LAB_MODE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('lab') === '1';

/**
 * Detect ?house-simulator=1 — renders the new customer-facing House Simulator
 * surface directly.  The existing lab/workbench at /?lab=1 is unchanged.
 */
const HOUSE_SIMULATOR_MODE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('house-simulator') === '1';

/**
 * Detect ?print=<view> — renders a dedicated print layout directly.
 * Supported values: 'customer' | 'technical' | 'comparison'
 */
const PRINT_VIEW =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('print')
    : null;

/**
 * Detect ?report=1 — legacy report demo route (now retired notice).
 * This is the single entry point for the print pipeline.
 */
const REPORT_MODE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('report') === '1';

/**
 * Detect ?presentation=1 — renders CanonicalPresentationPage directly with demo data.
 * Useful for in-room demo and development.
 */
const PRESENTATION_MODE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('presentation') === '1';

/**
 * Detect ?deck=1 — renders the swipeable PresentationDeck directly with demo data.
 * Use alongside ?presentation=1 or standalone to preview the deck experience.
 */
const DECK_MODE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('deck') === '1';

/**
 * Detect ?gallery=1 — renders the Physics Visual Library gallery directly.
 * Developer/review surface for previewing animation components.
 */
const GALLERY_MODE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('gallery') === '1';

/**
 * Detect ?audit=1 — renders the Presentation Audit Page directly.
 * Developer/review surface for inspecting all golden scenarios and rule violations.
 */
const AUDIT_MODE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('audit') === '1';

/**
 * Detect ?atlas-capture=1 — renders the on-device capture view (VisitDetailView)
 * for building a SessionCaptureV2 capture session directly in the browser.
 * This is the primary entry point for the SessionCaptureV2 visit flow.
 */
const ATLAS_CAPTURE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('atlas-capture') === '1';

/**
 * Detect ?scan-import=1 — renders the Scan Import Dev Harness directly.
 * Developer/review surface for testing scan bundle ingestion.
 * Not visible in production UX.
 */
const SCAN_IMPORT_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('scan-import') === '1';

/**
 * Detect ?workspace-lifecycle-qa=1 — renders the workspace visit lifecycle
 * QA harness for deterministic ownership/branding/export/follow-up validation.
 * Dev-only surface; not customer-facing.
 */
const WORKSPACE_LIFECYCLE_QA_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('workspace-lifecycle-qa') === '1';

/**
 * Detect ?phone-customer-qa=1 — renders the phone-first customer QA harness
 * for portal, simulator, deep-link landing, and reading preferences review.
 */
const PHONE_CUSTOMER_QA_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('phone-customer-qa') === '1';

/**
 * Detect ?lego-technix-debug=1 — renders the sanctioned LegoTechnix
 * projection/debug surface for deterministic engine inspection.
 */
const LEGO_TECHNIX_DEBUG_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('lego-technix-debug') === '1';

/**
 * Detect ?scan-package=1 — renders the Atlas Scan package import flow.
 * Production import UI for ingesting Atlas Scan export packages.
 */
const SCAN_PACKAGE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('scan-package') === '1';

/**
 * Detect ?receive-scan=1 — renders the Web Share Target receive page.
 * Set by the service worker after it stores a shared scan file in IndexedDB.
 */
const RECEIVE_SCAN_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('receive-scan') === '1';

/**
 * Detect ?my-scans=1 — renders the My Scans management page.
 * Lists all scan sessions (local IDB + server) for the engineer.
 */
const MY_SCANS_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('my-scans') === '1';

/**
 * Detect ?handoff=1 — retired legacy handoff query route.
 * Kept only to show a retired-route notice.
 */
const HANDOFF_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('handoff') === '1';

/**
 * Detect ?visitId=<id> — opens Visit Home for the given visit ID on load.
 *
 * Used by Atlas Scan iOS (and other handoff sources) to open a specific visit
 * directly when launching Atlas Mind.  Takes precedence over cached session
 * state but yields to URL-mode routes (ENGINEER_VISIT_ID, INITIAL_REPORT_ID,
 * SCAN_PACKAGE_ENABLED, RECEIVE_SCAN_ENABLED, etc.) which render before the
 * main App state machine is reached.
 *
 * Examples:
 *   /?visitId=visit_abc123          — open Visit Home for that visit
 *   /?scan-package=1&visitId=xyz    — import scan, then return to that visit
 */
const INITIAL_VISIT_ID_PARAM =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('visitId')
    : null;

/**
 * Detect ?visit-handoff=1 — renders the completed-visit handoff review page.
 * Shows customer and engineer read-only review surfaces from a VisitHandoffPack.
 * Loads the built-in dev fixture by default; supports upload/paste JSON in-page.
 */
const VISIT_HANDOFF_REVIEW_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('visit-handoff') === '1';

/**
 * Detect ?customer-share=1 — renders the customer-safe printable summary from a
 * VisitHandoffPack.  This is the shareable, print-first customer output.
 * Loads the built-in dev fixture by default; supports upload/paste JSON in-page.
 */
const CUSTOMER_SHARE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('customer-share') === '1';

/**
 * Detect ?engineer-share=1 — renders the engineer-facing compact install-prep
 * handoff page from a VisitHandoffPack.  Dense, print-first, read-only.
 * Loads the built-in dev fixture by default; supports upload/paste JSON in-page.
 */
const ENGINEER_SHARE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('engineer-share') === '1';

/**
 * Detect ?insight-pack=1 — retired legacy insight-pack route.
 * Kept only to redirect users to current customer-safe routes.
 */
const INSIGHT_PACK_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('insight-pack') === '1';

/**
 * Detect ?create-workspace=1 — renders the Workspace Onboarding page.
 * Allows a product customer to create a new Atlas workspace from the UI.
 */
const CREATE_WORKSPACE_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('create-workspace') === '1';

/**
 * Detect ?visit-home=1 — renders the Visit Home Dashboard Shell.
 * Front-door overview of all outputs for the active visit.
 * Requires an active visit with engine data to show ready-state cards.
 */
const VISIT_HOME_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('visit-home') === '1';

/** Detect ?library-pdf=1 — opens supporting PDF route directly (new-page launch). */
const LIBRARY_PDF_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('library-pdf') === '1';

/**
 * Detect ?cacheBust=1 — clears all Atlas-owned localStorage keys and reloads
 * the app cleanly.  Useful for support / debugging when local state becomes stale.
 * The reload removes the query param from the URL so it does not loop.
 */
if (
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('cacheBust') === '1'
) {
  clearAtlasCache();
  console.info('[Atlas] Cache busted — all Atlas local state cleared.');
  // Remove ?cacheBust=1 so the page does not loop.
  const cleanUrl = window.location.pathname + window.location.hash;
  window.location.replace(cleanUrl);
}

/**
 * Demo engine input used by the report mode (?report=1) and presentation demo (?presentation=1).
 * Produces a realistic UK combi scenario for demonstration:
 *   - 3-bed semi, 3 occupants, 1 bathroom, standard mains pressure
 *   - Combi boiler (current) with high heat loss — the "struggling combi" scenario
 */
const CONSOLE_DEMO_INPUT: EngineInputV2_3 = {
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

type Journey = 'app-home' | 'landing' | 'workspace-dashboard' | 'visit-home' | 'visit' | 'visit-handoff' | 'fast' | 'remote-survey' | 'scope' | 'methodology' | 'neutrality' | 'privacy' | 'lab' | 'lab-quick-inputs' | 'simulator' | 'unified-simulator' | 'house-simulator' | 'floor-plan' | 'heat-loss' | 'building-height' | 'explorer' | 'report' | 'presentation' | 'portal-from-package' | 'gallery' | 'dev-menu' | 'prototype-composer' | 'printout' | 'framework-print' | 'library-pdf' | 'engineer' | 'insight-pack' | 'receive-scan' | 'external-files' | 'user-profile' | 'installation-specification';

interface VisitRecommendationSnapshot {
  visitId: string;
  visitReference?: string;
  recommendationSnapshot?: CanonicalRecommendationSnapshotV1;
  engineOutput?: EngineOutputV1;
  scenarios?: ScenarioResult[];
  decision?: AtlasDecisionV1;
  customerSummary?: CustomerSummaryV1;
  acceptedScenarioId?: string;
  lifecycleState: VisitReviewLifecycleState;
  generatedOutputs: GeneratedOutputsV1;
  portalVisitContext?: PersistedPortalVisitContext;
}

const FLOOR_PLAN_TOOL_MODE =
  typeof window !== 'undefined' && window.location.pathname === '/floor-plan-tool';

/** Detect /report/:id path — renders a saved report by ID. */
const REPORT_PATH_MATCH =
  typeof window !== 'undefined'
    ? window.location.pathname.match(/^\/report\/([^/]+)$/)
    : null;
const INITIAL_REPORT_ID = REPORT_PATH_MATCH ? REPORT_PATH_MATCH[1] : null;

/** Detect /visit/:visitId/engineer path — renders the pre-install engineer route. */
const ENGINEER_PATH_MATCH =
  typeof window !== 'undefined'
    ? window.location.pathname.match(/^\/visit\/([^/]+)\/engineer$/)
    : null;
const ENGINEER_VISIT_ID = ENGINEER_PATH_MATCH ? ENGINEER_PATH_MATCH[1] : null;

/** Detect /visit/:visitId/twin path — renders the Spatial Twin feature. */
const TWIN_PATH_MATCH =
  typeof window !== 'undefined'
    ? window.location.pathname.match(/^\/visit\/([^/]+)\/twin$/)
    : null;
const TWIN_VISIT_ID = TWIN_PATH_MATCH ? TWIN_PATH_MATCH[1] : null;

/** Detect /portal/:reference path — renders the customer portal. */
const PORTAL_REFERENCE =
  typeof window !== 'undefined'
    ? parsePortalPath(window.location.pathname)
    : null;

/** Extract the signed portal token from ?token=... when on a portal path. */
const PORTAL_TOKEN =
  typeof window !== 'undefined' && PORTAL_REFERENCE != null
    ? new URLSearchParams(window.location.search).get('token') ?? undefined
    : undefined;

/** Detect ?explorer=1 — allows access to the System Explorer via hidden route. */
const EXPLORER_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('explorer') === '1';

/** Detect /workspace — renders the Visit Workspace home page. */
const WORKSPACE_HOME =
  typeof window !== 'undefined' && window.location.pathname === '/workspace';

/** Detect /workspace/settings (and dev alias) — renders workspace admin controls. */
const WORKSPACE_SETTINGS_HOME =
  typeof window !== 'undefined' &&
  (
    window.location.pathname === '/workspace/settings' ||
    window.location.pathname === '/dev/workspace-settings'
  );

/** Detect /analytics — renders the tenant-level KPI dashboard. */
const ANALYTICS_HOME =
  typeof window !== 'undefined' && window.location.pathname === '/analytics';

/** Detect /workspace/:id — renders a single workspace detail page. */
const WORKSPACE_DETAIL_MATCH =
  typeof window !== 'undefined'
    ? window.location.pathname.match(/^\/workspace\/([^/]+)$/)
    : null;
const WORKSPACE_DETAIL_ID = WORKSPACE_DETAIL_MATCH ? WORKSPACE_DETAIL_MATCH[1] : null;

/**
 * Detect ?review=1 — auto-opens the evidence review screen on
 * /workspace/:id pages reached immediately after a package import.
 */
const WORKSPACE_AUTO_REVIEW =
  typeof window !== 'undefined' &&
  WORKSPACE_DETAIL_ID != null &&
  new URLSearchParams(window.location.search).get('review') === '1';

/**
 * Detect /receive-scan path — renders the typed ScanToMindHandoffV1 receive page.
 * Atlas Scan iOS navigates here after constructing a typed handoff payload, passing
 * the serialised JSON as ?payload=<URL-encoded JSON>.
 * Distinct from ?receive-scan=1 (Web Share Target file reception).
 */
const RECEIVE_SCAN_HANDOFF_PATH =
  typeof window !== 'undefined' && window.location.pathname === '/receive-scan';

/**
 * Detect /dev/welcome-pack — renders the dev-only composed welcome-pack preview.
 * This route exercises plan + content + printable skeleton composition with fixtures.
 */
const WELCOME_PACK_DEV_PREVIEW_PATH =
  typeof window !== 'undefined' && window.location.pathname === '/dev/welcome-pack';

/**
 * Detect /dev/portal-fixtures — renders the dev-only portal fixture launcher.
 * Allows the customer portal to be tested without a live visit record or signed token.
 */
const PORTAL_FIXTURE_DEV_PATH =
  typeof window !== 'undefined' && window.location.pathname === '/dev/portal-fixtures';

/**
 * Detect /dev/customer-portal-preview or ?customer-portal-preview=1 —
 * renders a production-like CustomerPortalPage preview using fixture data.
 */
const CUSTOMER_PORTAL_PREVIEW_DEV_PATH =
  typeof window !== 'undefined' &&
  (
    window.location.pathname === '/dev/customer-portal-preview'
    || new URLSearchParams(window.location.search).get('customer-portal-preview') === '1'
  );

/**
 * Detect /dev/customer-pack-preview or ?customer-pack-preview=1 —
 * renders the evidence-driven CustomerPackRendererV1 via the canonical preview pipeline.
 */
const CUSTOMER_PACK_PREVIEW_DEV_PATH =
  typeof window !== 'undefined' &&
  (
    window.location.pathname === '/dev/customer-pack-preview'
    || new URLSearchParams(window.location.search).get('customer-pack-preview') === '1'
  );

/**
 * Detect /dev/library-explorer or ?library-explorer=1 —
 * renders the dev/customer content Library Explorer.
 */
const LIBRARY_EXPLORER_DEV_PATH =
  typeof window !== 'undefined' &&
  (
    window.location.pathname === '/dev/library-explorer'
    || new URLSearchParams(window.location.search).get('library-explorer') === '1'
  );

/**
 * Detect /dev/diagram-fixture or ?diagram-fixture=1 —
 * renders side-by-side mobile and print diagram QA fixtures.
 */
const DIAGRAM_FIXTURE_DEV_PATH =
  typeof window !== 'undefined' &&
  (
    window.location.pathname === '/dev/diagram-fixture'
    || new URLSearchParams(window.location.search).get('diagram-fixture') === '1'
  );

/** Detect any visual education library route or query flag. */
const ACTIVE_VISUAL_EDUCATION_LIBRARY_SURFACE =
  typeof window !== 'undefined'
    ? resolveActiveVisualEducationLibrarySurface(window.location)
    : null;

/** Detect /dev/visual-education-library or ?visual-education-library=1. */
const VISUAL_EDUCATION_LIBRARY_QA_HUB_PATH =
  typeof window !== 'undefined' && isVisualEducationLibraryQaHubRoute(window.location);

/** Detect /dev/inspector or /dev/component-discovery — renders Component Discovery utility directly. */
const DEV_INSPECTOR_PATH =
  typeof window !== 'undefined' &&
  (
    window.location.pathname === '/dev/inspector' ||
    window.location.pathname === '/dev/component-discovery'
  );

/**
 * Detect /installation-specification path or ?installation-specification=1 — renders the Atlas
 * Installation Specification visual stepper shell.
 *
 * This is a lab/dev route for the initial PR; it establishes the stepper flow
 * only and does not alter the existing recommendation engine.
 *
 * Examples:
 *   /installation-specification               — path-based entry (e.g. from VisitHubPage)
 *   /?installation-specification=1            — query-param flag for quick dev access
 */
const INSTALLATION_SPECIFICATION_ENABLED =
  typeof window !== 'undefined' &&
  (
    window.location.pathname === '/installation-specification' ||
    new URLSearchParams(window.location.search).get('installation-specification') === '1'
  );

function CanonicalPresentationRoute({
  engineInput,
  onBack,
  onOpenSimulator,
  onPrint,
  heatLossState,
  prioritiesState,
  onOptionsChange,
}: {
  engineInput: EngineInputV2_3;
  onBack: () => void;
  onOpenSimulator?: () => void;
  onPrint?: () => void;
  heatLossState?: HeatLossState;
  prioritiesState?: PrioritiesState;
  onOptionsChange?: (opt1Family: ApplianceFamily | null, opt2Family: ApplianceFamily | null) => void;
}) {
  const result = runEngine(engineInput);

  // Build the locked CustomerSummaryV1 projection so GeminiAISummary only
  // sees lockedSummary fields — no ranked options, no raw survey context.
  const lockedSummary = (() => {
    try {
      const scenarios = buildScenariosFromEngineOutput(result.engineOutput);
      if (scenarios.length === 0) return undefined;
      const decision = buildDecisionFromScenarios({
        scenarios,
        boilerType:     toLifecycleBoilerType(engineInput.currentHeatSourceType),
        ageYears:       engineInput.currentSystem?.boiler?.ageYears ?? 0,
        occupancyCount: engineInput.occupancyCount,
        bathroomCount:  engineInput.bathroomCount,
        showerCompatibilityNote: result.engineOutput.showerCompatibilityNote,
      });
      return buildCustomerSummary(decision, scenarios);
    } catch {
      return undefined;
    }
  })();

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      zIndex: 10,
    }}>
      <div style={{ padding: '0.5rem 1rem', flexShrink: 0 }}>
        <button className="back-btn" onClick={onBack}>← Back</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <CanonicalPresentationPage
          result={result}
          input={engineInput}
          recommendationResult={result.recommendationResult}
          onOpenSimulator={onOpenSimulator}
          onPrint={onPrint}
          heatLossState={heatLossState}
          prioritiesState={prioritiesState}
          onOptionsChange={onOptionsChange}
          lockedSummary={lockedSummary}
        />
      </div>
    </div>
  );
}

function RetiredRouteNotice({
  backLabel = '← Back',
  onBack,
  title = 'Retired route',
  children,
}: {
  backLabel?: string;
  onBack: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '1rem' }}>
      <button className="back-btn" onClick={onBack}>{backLabel}</button>
      <div style={{ maxWidth: 760, marginTop: '1rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function dispatchVisitJourneyEvent(
  currentState: VisitReviewLifecycleState | undefined,
  event: VisitReviewLifecycleEvent,
): VisitReviewLifecycleState {
  const effectiveCurrentState = currentState ?? DEFAULT_ATLAS_VISIT_JOURNEY_STATE;
  const transition = transitionAtlasVisitJourney(effectiveCurrentState, event);
  if (!transition.accepted && import.meta.env.DEV) {
    console.warn('[Atlas] Rejected visit journey event', {
      currentState: effectiveCurrentState,
      event: event.type,
    });
  }
  return transition.state;
}

function AppInner() {
  // ── Mobile-state persistence: restore session cache on load ───────────────
  // Read once at component initialisation (before first render) so restored
  // values can be used as useState initialisers without a re-render flash.
  const _restoredSession = (() => {
    if (
      FLOOR_PLAN_TOOL_MODE ||
      ENGINEER_VISIT_ID != null ||
      INITIAL_REPORT_ID != null
    ) {
      // URL-driven routes take precedence over cached state.
      return null;
    }
    return readVersionedCache<{ journey: string }>(
      ATLAS_CACHE_KEY_SESSION,
      ATLAS_CACHE_SCHEMA_VERSION,
    );
  })();
  const _restoredVisit = (() => {
    if (ENGINEER_VISIT_ID != null) return null;
    return readVersionedCache<{ visitId: string }>(
      ATLAS_CACHE_KEY_VISIT,
      ATLAS_CACHE_SCHEMA_VERSION,
    );
  })();

  // Small notice shown when cache is restored or found to be stale.
  const [cacheNotice, setCacheNotice] = useState<'restored' | 'stale' | null>(
    () => (_restoredSession !== null || _restoredVisit !== null ? 'restored' : null),
  );

  const [journey, setJourney] = useState<Journey>(() => {
    if (FLOOR_PLAN_TOOL_MODE)            return 'floor-plan';
    if (ENGINEER_VISIT_ID != null)       return 'engineer';
    if (INITIAL_REPORT_ID != null)       return 'report';
    if (LIBRARY_PDF_ENABLED)             return 'library-pdf';
    // ?visitId= deep-link: open Visit Home directly without restoring cached state.
    if (INITIAL_VISIT_ID_PARAM != null)  return 'visit-home';
    // ?visit-home=1: open visit home dashboard directly.
    if (VISIT_HOME_ENABLED)              return 'visit-home';
    return 'app-home';
  });
  /** Active report ID for the /report/:id route. */
  const [activeReportId, setActiveReportId] = useState<string | null>(INITIAL_REPORT_ID);
  const [fullSurveyPrefill, setFullSurveyPrefill] = useState<Partial<EngineInputV2_3> | undefined>();
  /** Controls whether the visits search panel is open on the home screen. */
  const [showVisitsPanel, setShowVisitsPanel] = useState(false);
  /**
   * Partial engine input accumulated before opening the Simulator.
   * Populated by Fast Choice / home entry; merged with quick-input values
   * before the simulator opens.
   */
  const [labPartialInput, setLabPartialInput] = useState<Partial<EngineInputV2_3>>({});
  /** Completed engine input passed to the Simulator Dashboard and LabShell. */
  const [labEngineInput, setLabEngineInput] = useState<EngineInputV2_3 | undefined>();
  /**
   * Full survey model captured from the most recent survey draft.
   * Used to derive the canonical current-system summary for the
   * Installation Specification stepper via buildCurrentInstallationSummaryFromCanonicalSurvey.
   */
  const [labFullSurveyModel, setLabFullSurveyModel] = useState<FullSurveyModelV1 | undefined>();
  /**
   * Specification options accumulated across the active visit.
   * Passed to InstallationSpecificationPage as existingOptions and updated
   * each time the surveyor taps Finish inside the stepper.
   */
  const [labInstallationSpecifications, setLabInstallationSpecifications] = useState<InstallationSpecificationOptionV1[]>([]);
  /**
   * Heat-loss survey state captured from the most recent full survey draft.
   * Passed to the presentation layer so the Your House quadrant can show the
   * perimeter snapshot and roof orientation (PR8a/PR8b/PR8c).
   */
  const [labHeatLossState, setLabHeatLossState] = useState<HeatLossState | undefined>();
  /**
   * Priorities state captured from the most recent full survey draft.
   * Passed to the presentation layer so the Your Priorities quadrant shows
   * the selected chips (PR8a).
   */
  const [labPrioritiesState, setLabPrioritiesState] = useState<PrioritiesState | undefined>();
  /**
   * Recommendation state from the final survey step.
   * Retained for future TechnicalSummaryPrint; the customer-facing print now
   * derives its content entirely from the canonical presentation model.
   */
  const [, setLabRecommendationState] = useState<RecommendationState | undefined>();
  /**
   * Contractor quotes collected in the Quotes survey step.
   * Fed into buildInsightPackFromEngine() to generate the Atlas Insight Pack.
   */
  const [labQuotes, setLabQuotes] = useState<QuoteInput[]>([]);
  /**
   * Journey to return to from the legacy /?insight-pack=1 diagnostic path.
   * Always 'simulator' since the only production callers have been removed;
   * this value is kept so the dev-only insight-pack block still compiles.
   */
  const insightPackFromJourney: Journey = 'simulator';
  /**
   * The journey that last opened the simulator, used to navigate Back correctly.
   * When the simulator is opened from the recommendation/survey pages, Back
   * should return there instead of going to the landing page.
   */
  const [simulatorFromJourney, setSimulatorFromJourney] = useState<Journey>('landing');
  /**
   * The journey that last opened the presentation, used to navigate Back correctly.
   */
  const [presentationFromJourney, setPresentationFromJourney] = useState<Journey>('simulator');
  /**
   * The last sub-journey opened from the Visit Home Dashboard, used for the
   * "continue where you left off" banner.  Cleared when returning to visit-home.
   */
  const [lastOpenedFromHome, setLastOpenedFromHome] = useState<{ label: string; journey: Journey } | null>(null);
  const [floorPlanSystemType, setFloorPlanSystemType] = useState<'combi' | 'system' | 'regular' | 'heat_pump' | undefined>();
  /**
   * Latest floor-plan derived output captured from FloorPlanBuilder.
   * Passed to ExplainersHubPage so the simulator and advice surfaces can show
   * which physics assumptions are informed by the floor plan.
   */
  const [floorplanOutput, setFloorplanOutput] = useState<DerivedFloorplanOutput | undefined>();
  /** Active visit ID — set when the user starts or opens a visit. */
  const [activeVisitId, setActiveVisitId] = useState<string | undefined>(
    ENGINEER_VISIT_ID ?? INITIAL_VISIT_ID_PARAM ?? _restoredVisit?.value?.visitId ?? undefined,
  );
  const [activeVisitMeta, setActiveVisitMeta] = useState<VisitMeta | null>(null);
  const [visitRecoveryPrompt, setVisitRecoveryPrompt] = useState<{
    visitId: string;
    updatedAt: string;
    restoredFromTemp: boolean;
  } | null>(null);
  const [hydratedPersistedVisitId, setHydratedPersistedVisitId] = useState<string | null>(null);
  /**
   * Active AtlasVisit — carries the visitId and attached brandId for the
   * current visit session.  Initialized from sessionStorage so that a
   * page reload after a branded visit (e.g. receive-scan) restores the brand.
   */
  const [activeAtlasVisit, setActiveAtlasVisit] = useState<AtlasVisit | null>(() => {
    if (ENGINEER_VISIT_ID !== null) return null;
    return retrieveActiveVisit();
  });
  /** Controls whether the new-visit panel is open. */
  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);
  /**
   * Handoff pack for the 'visit-handoff' journey.
   * Set to null so the VisitHandoffReviewPage shows its built-in loader
   * until the user pastes/uploads a pack (or one is supplied programmatically).
   */
  const [activeHandoffPack, setActiveHandoffPack] = useState<import('./features/visitHandoff/types/visitHandoffPack').VisitHandoffPack | null>(null);
  /**
   * Signed portal URL for the printout journey — generated from the latest
   * report for the active visit.  Uses report ID + HMAC token so the customer
   * portal can validate the link.
   */
  const [labPortalUrl, setLabPortalUrl] = useState<string | undefined>();
  const [labPortalVisitContext, setLabPortalVisitContext] = useState<PersistedPortalVisitContext | undefined>();
  const [visitRecommendationSnapshot, setVisitRecommendationSnapshot] = useState<VisitRecommendationSnapshot | null>(null);
  // Ref mirror prevents stale-closure reads inside persistence effects and callbacks
  // that intentionally do not depend on the full snapshot object.
  const visitRecommendationSnapshotRef = useRef<VisitRecommendationSnapshot | null>(null);
  const [localSessionStatus, setLocalSessionStatus] = useState<LocalSessionStatus | null>(null);
  const [packageOpenHistory, setPackageOpenHistory] = useState<VisitPackageOpenHistoryEntry[]>([]);
  const [lastImportFailure, setLastImportFailure] = useState<WorkflowImportFailureDiagnostic | null>(null);
  const [importedWorkflowVisitIds, setImportedWorkflowVisitIds] = useState<string[]>([]);
  /**
   * Canonical visit package most recently imported. Retained so the
   * portal-from-package journey can build a PortalLaunchPayloadV1 without
   * re-parsing the file. Cleared when the review session is cleared.
   */
  const [activeCanonicalPackage, setActiveCanonicalPackage] = useState<CanonicalVisitPackageV1 | null>(null);
  /**
   * Active portal launch payload constructed from the canonical package.
   * Set by the onOpenPortalFromPackage handler and consumed by the
   * 'portal-from-package' journey rendering. Cleared with the session.
   */
  const [activePortalLaunchPayload, setActivePortalLaunchPayload] = useState<PortalLaunchPayloadV1 | null>(null);
  const [libraryPdfBootState, setLibraryPdfBootState] = useState<LibraryPdfBootResult | null>(null);

  /**
   * Resolves the active workspace from the browser host once on mount.
   * Drives the host-brand fallback for BrandProvider and the default workspace
   * selection in StartVisitPanel when accessed via a branded subdomain.
   * Priority: active visit brandId > host workspace brandId > atlas-default.
   */
  const hostResolution = useWorkspaceFromHost();

  /** Active user profile — used for workspace defaults and visit attribution. */
  const { activeUser } = useActiveUser();
  const { userProfile: atlasUserProfile, currentWorkspace } = useAtlasAuth();
  const workspaceSession = useWorkspaceSession();

  /**
   * Workspace brand session — resolves the active brand from workspace policy,
   * user preferences, and the host-derived route brand.
   * Priority: locked → workspace default; route_override > user_preference > workspace_default.
   */
  const workspaceBrandSession = useWorkspaceBrandSession();

  /** Role-based UI permission flags derived from the active user's role. */
  const {
    canCreateVisit,
    canManageWorkspace,
    canViewAnalytics,
    canEditBranding,
    effectiveRole,
  } = useRolePermissions();
  const canAccessWorkspaceSettings = effectiveRole === 'owner' || effectiveRole === 'admin';

  /**
   * Gate the workspace dashboard behind an explicit authorised-access check.
   * Allowed when:
   *   - a local user profile is active (activeUser), OR
   *   - a Firebase/Atlas authenticated profile is present (atlasUserProfile), OR
   *   - the dev-menu flag is set (?devmenu=1 or /dev/devmenu).
   * Guest field users who land here accidentally are redirected to the
   * GuestFallback inside WorkspaceDashboard.
   */
  const canAccessWorkspaceDashboard =
    activeUser !== null ||
    atlasUserProfile !== null ||
    DEV_MENU_ENABLED;

  const appHomeNewVisitState = buildAppHomeNewVisitEntryState({
    canCreateVisit,
    workspaceStatus: workspaceSession.status,
  });

  const workspaceSettingsRole = useMemo<WorkspaceMemberRole>(() => {
    switch (effectiveRole) {
      case 'owner':
      case 'admin':
      case 'engineer':
      case 'viewer':
        return effectiveRole;
      case 'sales':
        return 'office';
      default:
        if (
          currentWorkspace !== null &&
          atlasUserProfile !== null &&
          currentWorkspace.ownerAtlasUserId === atlasUserProfile.atlasUserId
        ) {
          return 'owner';
        }
        return 'viewer';
    }
  }, [atlasUserProfile, currentWorkspace, effectiveRole]);

  const workspaceSettingsMembership = useMemo<WorkspaceMembershipV1 | null>(() => {
    if (workspaceSession.activeWorkspace === null) {
      return null;
    }

    const sessionMemberUserId =
      activeUser?.userId ??
      atlasUserProfile?.atlasUserId ??
      workspaceSession.activeWorkspace.ownerUserId;
    const sessionMembership =
      workspaceSession.activeWorkspace.members.find(
        (member) => member.userId === sessionMemberUserId,
      ) ?? null;

    if (sessionMembership !== null) {
      return sessionMembership;
    }

    return {
      workspaceId: workspaceSession.activeWorkspace.workspaceId,
      userId: sessionMemberUserId,
      role: workspaceSettingsRole,
      permissions: DEFAULT_PERMISSIONS_BY_ROLE[workspaceSettingsRole],
    };
  }, [activeUser?.userId, atlasUserProfile, workspaceSession.activeWorkspace, workspaceSettingsRole]);

  const workspaceSettingsWorkspace = useMemo(() => {
    if (workspaceSession.activeWorkspace === null) {
      return null;
    }

    const workspace =
      hostResolution.workspaceSlug === undefined
        ? workspaceSession.activeWorkspace
        : {
            ...workspaceSession.activeWorkspace,
            slug: hostResolution.workspaceSlug,
          };

    if (
      workspaceSession.workspaceSource === 'local_applied' ||
      workspaceSettingsMembership === null ||
      workspace.members.some((member) => member.userId === workspaceSettingsMembership.userId)
    ) {
      return workspace;
    }

    return {
      ...workspace,
      members: [...workspace.members, workspaceSettingsMembership],
    };
  }, [
    hostResolution.workspaceSlug,
    workspaceSession.activeWorkspace,
    workspaceSession.workspaceSource,
    workspaceSettingsMembership,
  ]);

  // ── Session persistence: write journey + visitId to versioned cache ────────
  // These effects run whenever journey or activeVisitId changes, keeping the
  // cache up-to-date so a mobile reload can restore the user's last position.
  // Print/lab/dev-only routes are excluded to avoid polluting the cache with
  // transient states that are not meaningful to restore.
  const PERSISTED_JOURNEYS: Journey[] = [
    'visit', 'visit-home', 'remote-survey', 'simulator',
  ];

  useEffect(() => {
    if (PERSISTED_JOURNEYS.includes(journey)) {
      writeVersionedCache(
        ATLAS_CACHE_KEY_SESSION,
        ATLAS_CACHE_SCHEMA_VERSION,
        { journey },
        activeVisitId != null ? { visitId: activeVisitId } : undefined,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey, activeVisitId]);

  useEffect(() => {
    if (activeVisitId != null) {
      // Store visitId only in metadata (envelope header); value is kept minimal.
      writeVersionedCache(
        ATLAS_CACHE_KEY_VISIT,
        ATLAS_CACHE_SCHEMA_VERSION,
        { visitId: activeVisitId },
        { visitId: activeVisitId },
      );
    }
  }, [activeVisitId]);

  // Auto-dismiss the cache-restore notice after 4 s.
  useEffect(() => {
    if (cacheNotice === null) return;
    const timer = setTimeout(() => setCacheNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [cacheNotice]);

  useEffect(() => {
    if (localSessionStatus === null) return;
    const timer = setTimeout(() => setLocalSessionStatus(null), 5000);
    return () => clearTimeout(timer);
  }, [localSessionStatus]);

  useEffect(() => {
    visitRecommendationSnapshotRef.current = visitRecommendationSnapshot;
  }, [visitRecommendationSnapshot]);

  useEffect(() => {
    if (journey !== 'library-pdf' || !LIBRARY_PDF_ENABLED) {
      setLibraryPdfBootState(null);
      return;
    }
    let cancelled = false;
    async function bootLibraryPdf(): Promise<void> {
      let finalState: LibraryPdfBootResult = {
        status: 'blocked',
        message: 'Customer PDF could not be prepared due to an unexpected error.',
      };
      try {
        const result = await runLibraryPdfBootState({
          visitId: INITIAL_VISIT_ID_PARAM,
          explicitVisitId: hasText(INITIAL_VISIT_ID_PARAM),
          onTransition: (state) => {
            if (!cancelled) setLibraryPdfBootState(state);
          },
          hydrateVisitById: async (visitId): Promise<LibraryPdfHydratedSnapshot | null> => {
            const currentSnapshot = visitRecommendationSnapshotRef.current;
            if (currentSnapshot?.visitId === visitId) {
              return {
                visitId: currentSnapshot.visitId,
                visitReference: currentSnapshot.visitReference,
                recommendationSnapshot: currentSnapshot.recommendationSnapshot,
                engineOutput: currentSnapshot.engineOutput,
                scenarios: currentSnapshot.scenarios,
                decision: currentSnapshot.decision,
                customerSummary: currentSnapshot.customerSummary,
                acceptedScenarioId: currentSnapshot.acceptedScenarioId,
                generatedOutputs: currentSnapshot.generatedOutputs,
                portalVisitContext: currentSnapshot.portalVisitContext,
                surveyModel: labFullSurveyModel,
                engineInput: labEngineInput,
              };
            }
            const restored = readPersistedAtlasVisitV2(visitId).visit;
            if (restored == null) {
              return null;
            }
            return {
              visitId: restored.visitId,
              visitReference: restored.visitReference,
              recommendationSnapshot: restored.recommendationSnapshot,
              engineOutput: restored.engine,
              scenarios: restored.scenarios,
              decision: restored.decision,
              customerSummary: restored.customerSummary,
              acceptedScenarioId: restored.acceptedScenarioId,
              generatedOutputs: restored.generatedOutputs,
              portalVisitContext: restored.portalVisitContext,
              surveyModel: restored.survey,
              engineInput: restored.engineInputSnapshot,
            };
          },
          enrichGeneratedOutputs: (snapshot) =>
            enrichGeneratedOutputsWithCustomerJourneyPack({
              generatedOutputs: snapshot.generatedOutputs,
              surveyModel: snapshot.surveyModel,
              engineInput: snapshot.engineInput,
              customerSummary: snapshot.customerSummary,
              decision: snapshot.decision,
              activeSnapshotId: snapshot.recommendationSnapshot?.snapshotId,
              portalVisitContext: snapshot.portalVisitContext,
              scenarios: snapshot.scenarios,
            }),
          resolveDocumentSource: ({ snapshot, generatedOutputs }) => {
            const normalizedScenarioId = (snapshot.acceptedScenarioId ?? snapshot.decision?.recommendedScenarioId)?.toLowerCase();
            const acceptedScenario =
              normalizedScenarioId == null
                ? undefined
                : snapshot.scenarios?.find((scenario) => scenario.scenarioId.toLowerCase() === normalizedScenarioId);
            return resolveCustomerDocumentSourceV1({
              visitId: snapshot.visitId,
              visitReference: snapshot.visitReference ?? formatVisitReference(snapshot.visitId),
              acceptedScenario,
              acceptedScenarioId: snapshot.acceptedScenarioId,
              decision: snapshot.decision,
              scenarios: snapshot.scenarios,
              customerSummary: snapshot.customerSummary,
              engineInput: snapshot.engineInput,
              engineOutput: snapshot.engineOutput,
              generatedOutputs,
            });
          },
          isFallbackOnlyPrintModel: isFallbackOnlyCustomerPdf,
        });
        if (cancelled) return;
        if (result.status === 'ready') {
          const { hydratedSnapshot, generatedOutputs } = result;
          setActiveVisitId(hydratedSnapshot.visitId);
          setLabPortalUrl(generatedOutputs.portal.url);
          setLabPortalVisitContext(hydratedSnapshot.portalVisitContext);
          if (hydratedSnapshot.surveyModel != null) {
            setLabFullSurveyModel(hydratedSnapshot.surveyModel);
            if (hydratedSnapshot.surveyModel.fullSurvey?.heatLoss) setLabHeatLossState(hydratedSnapshot.surveyModel.fullSurvey.heatLoss);
            if (hydratedSnapshot.surveyModel.fullSurvey?.priorities) setLabPrioritiesState(hydratedSnapshot.surveyModel.fullSurvey.priorities);
            if (hydratedSnapshot.surveyModel.fullSurvey?.quotes) setLabQuotes(hydratedSnapshot.surveyModel.fullSurvey.quotes);
          }
          if (hydratedSnapshot.engineInput != null) {
            setLabEngineInput(hydratedSnapshot.engineInput);
          }
          const recommendationReady = isRecommendationReadyForLifecycle({
            decision: hydratedSnapshot.decision,
            customerSummary: hydratedSnapshot.customerSummary,
            acceptedScenarioId: hydratedSnapshot.acceptedScenarioId,
            engineRecommendationPrimary: hydratedSnapshot.engineOutput?.recommendation?.primary,
          });
          const lifecycleState = deriveLifecycleStateFromSnapshot({
            recommendationReady,
            generatedOutputs,
          });
          setVisitRecommendationSnapshot({
            visitId: hydratedSnapshot.visitId,
            visitReference: hydratedSnapshot.visitReference,
            recommendationSnapshot: hydratedSnapshot.recommendationSnapshot,
            engineOutput: hydratedSnapshot.engineOutput,
            scenarios: hydratedSnapshot.scenarios,
            decision: hydratedSnapshot.decision,
            customerSummary: hydratedSnapshot.customerSummary,
            acceptedScenarioId: hydratedSnapshot.acceptedScenarioId,
            lifecycleState,
            generatedOutputs,
            portalVisitContext: hydratedSnapshot.portalVisitContext,
          });
        }
        finalState = result;
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('[library-pdf] boot failed', error);
        }
      } finally {
        if (!cancelled) {
          setLibraryPdfBootState(finalState);
        }
      }
    }
    void bootLibraryPdf();
    return () => {
      cancelled = true;
    };
  }, [journey]);

  useEffect(() => {
    if (journey !== 'visit-home') return;
    if (lastOpenedFromHome == null) return;
    if (!isLegacyJourney(lastOpenedFromHome.journey)) return;
    setLastOpenedFromHome(null);
  }, [journey, lastOpenedFromHome]);

  useEffect(() => {
    if (!activeVisitId || ENGINEER_VISIT_ID != null) return;
    if (hydratedPersistedVisitId === activeVisitId) return;

    const restored = readPersistedAtlasVisitV2(activeVisitId);
    if (restored.schemaMismatch) {
      setCacheNotice('stale');
    }
    if (!restored.visit) {
      setHydratedPersistedVisitId(activeVisitId);
      return;
    }

    const persisted = restored.visit;
    const generatedOutputs = enrichGeneratedOutputsWithCustomerJourneyPack({
      generatedOutputs: persisted.generatedOutputs,
      surveyModel: persisted.survey,
      engineInput: persisted.engineInputSnapshot,
      customerSummary: persisted.customerSummary,
      decision: persisted.decision,
      activeSnapshotId: persisted.recommendationSnapshot?.snapshotId,
      portalVisitContext: persisted.portalVisitContext,
      generatedAt: persisted.updatedAt,
      scenarios: persisted.scenarios,
    });
    const recommendationReady = isRecommendationReadyForLifecycle({
      decision: persisted.decision,
      customerSummary: persisted.customerSummary,
      acceptedScenarioId: persisted.acceptedScenarioId,
      engineRecommendationPrimary: persisted.engine?.recommendation?.primary,
    });
    const lifecycleState =
      persisted.lifecycleState ??
      deriveLifecycleStateFromSnapshot({
        recommendationReady,
        generatedOutputs,
      });
    setVisitRecommendationSnapshot({
      visitId: persisted.visitId,
      visitReference: persisted.visitReference,
      recommendationSnapshot: persisted.recommendationSnapshot,
      engineOutput: persisted.engine,
      scenarios: persisted.scenarios,
      decision: persisted.decision,
      customerSummary: persisted.customerSummary,
      acceptedScenarioId: persisted.acceptedScenarioId,
      lifecycleState,
      generatedOutputs,
      portalVisitContext: persisted.portalVisitContext,
    });
    setLabPortalUrl(generatedOutputs.portal.url);
    setLabPortalVisitContext(persisted.portalVisitContext);
    setLabFullSurveyModel(persisted.survey);
    if (persisted.survey.fullSurvey?.heatLoss) setLabHeatLossState(persisted.survey.fullSurvey.heatLoss);
    if (persisted.survey.fullSurvey?.priorities) setLabPrioritiesState(persisted.survey.fullSurvey.priorities);
    if (persisted.survey.fullSurvey?.quotes) setLabQuotes(persisted.survey.fullSurvey.quotes);

    if (persisted.engineInputSnapshot != null) {
      setLabEngineInput(persisted.engineInputSnapshot);
    } else if (labEngineInput === undefined) {
      try {
        setLabEngineInput(toEngineInput(sanitiseModelForEngine(persisted.survey)));
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[Atlas] Could not rebuild engine input from recovered visit survey', err);
        }
        // Keep restored survey even if engine input conversion fails.
      }
    }

    setVisitRecoveryPrompt({
      visitId: persisted.visitId,
      updatedAt: persisted.updatedAt,
      restoredFromTemp: restored.restoredFromTemp,
    });
    setHydratedPersistedVisitId(activeVisitId);
  }, [activeVisitId, hydratedPersistedVisitId, labEngineInput]);

  useEffect(() => {
    if (!activeAtlasVisit?.visitId) return;
    if (!activeAtlasVisit.workspaceId || !activeAtlasVisit.atlasUserId) return;
    upsertVisitIdentity(activeAtlasVisit.visitId, activeAtlasVisit.workspaceId, activeAtlasVisit.atlasUserId);
  }, [activeAtlasVisit?.visitId, activeAtlasVisit?.workspaceId, activeAtlasVisit?.atlasUserId]);

  useEffect(() => {
    if (!activeVisitId || !labFullSurveyModel || ENGINEER_VISIT_ID != null) return;

    let sourceInput: EngineInputV2_3 | undefined;
    let engineSnapshot: EngineOutputV1 | undefined;
    let scenariosSnapshot: ScenarioResult[] | undefined;
    let decisionSnapshot: AtlasDecisionV1 | undefined;
    let customerSummarySnapshot: CustomerSummaryV1 | undefined;

    try {
      sourceInput = labEngineInput ?? toEngineInput(sanitiseModelForEngine(labFullSurveyModel));
      const { engineOutput } = runEngine(sourceInput);
      engineSnapshot = engineOutput;
      scenariosSnapshot = buildScenariosFromEngineOutput(engineOutput);
      if (scenariosSnapshot.length > 0) {
        decisionSnapshot = buildDecisionFromScenarios({
          scenarios: scenariosSnapshot,
          boilerType: toLifecycleBoilerType(sourceInput.currentHeatSourceType),
          ageYears: sourceInput.currentSystem?.boiler?.ageYears ?? 0,
          occupancyCount: sourceInput.occupancyCount,
          bathroomCount: sourceInput.bathroomCount,
          showerCompatibilityNote: engineOutput.showerCompatibilityNote,
        });
        customerSummarySnapshot = buildCustomerSummary(decisionSnapshot, scenariosSnapshot);
      }
    } catch {
      // Persist survey even when derived snapshots cannot be computed.
    }

    const existingSnapshot =
      visitRecommendationSnapshotRef.current?.visitId === activeVisitId
        ? visitRecommendationSnapshotRef.current
        : null;
    const generatedOutputs = enrichGeneratedOutputsWithCustomerJourneyPack({
      generatedOutputs: existingSnapshot?.generatedOutputs,
      surveyModel: labFullSurveyModel,
      engineInput: sourceInput ?? labEngineInput,
      customerSummary: customerSummarySnapshot,
      decision: decisionSnapshot,
      activeSnapshotId: existingSnapshot?.recommendationSnapshot?.snapshotId,
      portalVisitContext: labPortalVisitContext,
      scenarios: scenariosSnapshot,
    });
    const lifecycleState = dispatchVisitJourneyEvent(
      existingSnapshot?.lifecycleState,
      { type: 'draft_saved' },
    );
    const persisted: PersistedAtlasVisitV2 = buildPersistedAtlasVisitV2({
      visitId: activeVisitId,
      visitReference: resolveVisitSessionReference(activeVisitMeta, activeVisitId),
      updatedAt: new Date().toISOString(),
      survey: labFullSurveyModel,
      engineInputSnapshot: labEngineInput,
      engine: engineSnapshot,
      decision: decisionSnapshot,
      scenarios: scenariosSnapshot,
      customerSummary: customerSummarySnapshot,
      acceptedScenarioId: decisionSnapshot?.recommendedScenarioId,
      lifecycleState,
      generatedOutputs,
      recommendationSnapshot: existingSnapshot?.recommendationSnapshot,
      portalVisitContext: labPortalVisitContext,
    });
    saveVisitAtomically(persisted);
    setVisitRecommendationSnapshot({
      visitId: activeVisitId,
      visitReference: resolveVisitSessionReference(activeVisitMeta, activeVisitId),
      recommendationSnapshot: existingSnapshot?.recommendationSnapshot,
      engineOutput: engineSnapshot,
      scenarios: scenariosSnapshot,
      decision: decisionSnapshot,
      customerSummary: customerSummarySnapshot,
      acceptedScenarioId: decisionSnapshot?.recommendedScenarioId,
      lifecycleState,
      generatedOutputs,
      portalVisitContext: labPortalVisitContext,
    });
  }, [activeVisitId, activeVisitMeta, labFullSurveyModel, labEngineInput, labPortalVisitContext]);

  function handleEscalate(prefill: Partial<EngineInputV2_3>) {
    setFullSurveyPrefill(prefill);
    setJourney('remote-survey');
  }

  /**
   * Start a new visit — opens the StartVisitPanel overlay.
   * Brand selection and visit creation are handled by StartVisitPanel.
   */
  function handleStartNewVisit() {
    setShowNewVisitDialog(true);
  }

  /** Open an existing visit by ID — routes to Visit Home dashboard. */
  function handleOpenVisit(visitId: string) {
    setActiveVisitId(visitId);
    setJourney('visit-home');
  }

  /**
   * Explicit "save locally" triggered from Visit Home controls.
   * Rebuilds the canonical snapshot from current in-memory state and writes
   * it to localStorage atomically.
   */
  function handleSaveVisitLocally() {
    if (activeVisitId == null || labFullSurveyModel == null) {
      setLocalSessionStatus({ tone: 'error', message: 'Unable to save: no active visit survey in memory.' });
      return;
    }
    let sourceInput: EngineInputV2_3 | undefined;
    let engineSnapshot: EngineOutputV1 | undefined;
    let scenariosSnapshot: ScenarioResult[] | undefined;
    let decisionSnapshot: AtlasDecisionV1 | undefined;
    let customerSummarySnapshot: CustomerSummaryV1 | undefined;
    try {
      sourceInput = labEngineInput ?? toEngineInput(sanitiseModelForEngine(labFullSurveyModel));
      const { engineOutput } = runEngine(sourceInput);
      engineSnapshot = engineOutput;
      scenariosSnapshot = buildScenariosFromEngineOutput(engineOutput);
      if (scenariosSnapshot.length > 0) {
        decisionSnapshot = buildDecisionFromScenarios({
          scenarios: scenariosSnapshot,
          boilerType: toLifecycleBoilerType(sourceInput.currentHeatSourceType),
          ageYears: sourceInput.currentSystem?.boiler?.ageYears ?? 0,
          occupancyCount: sourceInput.occupancyCount,
          bathroomCount: sourceInput.bathroomCount,
          showerCompatibilityNote: engineSnapshot.showerCompatibilityNote,
        });
        customerSummarySnapshot = buildCustomerSummary(decisionSnapshot, scenariosSnapshot);
      }
    } catch {
      // Persist survey even when derived snapshots cannot be computed.
    }
    const acceptedScenarioId = decisionSnapshot?.recommendedScenarioId;
    const currentSnapshot =
      visitRecommendationSnapshot?.visitId === activeVisitId
        ? visitRecommendationSnapshot
        : null;
    const generatedOutputs = enrichGeneratedOutputsWithCustomerJourneyPack({
      generatedOutputs: currentSnapshot?.generatedOutputs,
      surveyModel: labFullSurveyModel,
      engineInput: sourceInput ?? labEngineInput,
      customerSummary: customerSummarySnapshot,
      decision: decisionSnapshot,
      activeSnapshotId: currentSnapshot?.recommendationSnapshot?.snapshotId,
      portalVisitContext: labPortalVisitContext,
      scenarios: scenariosSnapshot,
    });
    const lifecycleState = dispatchVisitJourneyEvent(
      currentSnapshot?.lifecycleState,
      { type: 'draft_saved' },
    );
    const snapshot: PersistedAtlasVisitV2 = buildPersistedAtlasVisitV2({
      visitId: activeVisitId,
      visitReference: resolveVisitSessionReference(activeVisitMeta, activeVisitId),
      updatedAt: new Date().toISOString(),
      survey: labFullSurveyModel,
      engineInputSnapshot: labEngineInput,
      engine: engineSnapshot,
      decision: decisionSnapshot,
      scenarios: scenariosSnapshot,
      customerSummary: customerSummarySnapshot,
      acceptedScenarioId,
      lifecycleState,
      generatedOutputs,
      recommendationSnapshot: currentSnapshot?.recommendationSnapshot,
      portalVisitContext: labPortalVisitContext,
    });
    saveVisitAtomically(snapshot);
    setVisitRecommendationSnapshot({
      visitId: activeVisitId,
      visitReference: snapshot.visitReference,
      recommendationSnapshot: currentSnapshot?.recommendationSnapshot,
      engineOutput: engineSnapshot,
      scenarios: scenariosSnapshot,
      decision: decisionSnapshot,
      customerSummary: customerSummarySnapshot,
      acceptedScenarioId,
      lifecycleState,
      generatedOutputs,
      portalVisitContext: labPortalVisitContext,
    });
    setLocalSessionStatus({
      tone: 'success',
      message: `Saved visit ${snapshot.visitReference ?? formatVisitReference(activeVisitId)} locally.`,
    });
  }

  /**
   * Resume the locally persisted visit state for the active visit ID.
   * Reads from localStorage and rehydrates all relevant in-memory state.
   */
  function handleResumeLocalVisit() {
    if (activeVisitId == null) {
      setLocalSessionStatus({ tone: 'error', message: 'Unable to resume: no active visit selected.' });
      return;
    }
    const restored = readPersistedAtlasVisitV2(activeVisitId);
    if (restored.visit == null) {
      setLocalSessionStatus({ tone: 'error', message: 'No saved local snapshot found for this visit.' });
      return;
    }
    const persisted = restored.visit;
    const generatedOutputs = enrichGeneratedOutputsWithCustomerJourneyPack({
      generatedOutputs: persisted.generatedOutputs,
      surveyModel: persisted.survey,
      engineInput: persisted.engineInputSnapshot,
      customerSummary: persisted.customerSummary,
      decision: persisted.decision,
      activeSnapshotId: persisted.recommendationSnapshot?.snapshotId,
      portalVisitContext: persisted.portalVisitContext,
      scenarios: persisted.scenarios,
      generatedAt: persisted.updatedAt,
    });
    const recommendationReady = isRecommendationReadyForLifecycle({
      decision: persisted.decision,
      customerSummary: persisted.customerSummary,
      acceptedScenarioId: persisted.acceptedScenarioId,
      engineRecommendationPrimary: persisted.engine?.recommendation?.primary,
    });
    const lifecycleState =
      persisted.lifecycleState ??
      deriveLifecycleStateFromSnapshot({
        recommendationReady,
        generatedOutputs,
      });
    setVisitRecommendationSnapshot({
      visitId: persisted.visitId,
      visitReference: persisted.visitReference,
      recommendationSnapshot: persisted.recommendationSnapshot,
      engineOutput: persisted.engine,
      scenarios: persisted.scenarios,
      decision: persisted.decision,
      customerSummary: persisted.customerSummary,
      acceptedScenarioId: persisted.acceptedScenarioId,
      lifecycleState,
      generatedOutputs,
      portalVisitContext: persisted.portalVisitContext,
    });
    setLabPortalUrl(generatedOutputs.portal.url);
    setLabPortalVisitContext(persisted.portalVisitContext);
    setLabFullSurveyModel(persisted.survey);
    if (persisted.survey.fullSurvey?.heatLoss) setLabHeatLossState(persisted.survey.fullSurvey.heatLoss);
    if (persisted.survey.fullSurvey?.priorities) setLabPrioritiesState(persisted.survey.fullSurvey.priorities);
    if (persisted.engineInputSnapshot != null) {
      setLabEngineInput(persisted.engineInputSnapshot);
    } else if (labEngineInput === undefined) {
      try {
        setLabEngineInput(toEngineInput(sanitiseModelForEngine(persisted.survey)));
      } catch {
        // Keep survey even if engine input conversion fails.
      }
    }
    setLocalSessionStatus({
      tone: 'success',
      message: `Resumed saved visit ${persisted.visitReference ?? formatVisitReference(persisted.visitId)}.`,
    });
    // Suppress the auto-hydration effect so it does not re-show the recovery
    // prompt immediately after an explicit resume action.
    setHydratedPersistedVisitId(activeVisitId);
  }

  function hydrateStateFromCanonicalVisitPackage(
    pkg: CanonicalVisitPackageV1,
    importSurface: WorkflowImportSurface,
    integrity: CanonicalVisitPackageIntegrityResult,
  ) {
    const visitIdentity = pkg.visitIdentity;
    const rawVisitId = hasText(visitIdentity.visitId) ? visitIdentity.visitId : undefined;
    const rawVisitReference = hasText(visitIdentity.visitReference) ? visitIdentity.visitReference : undefined;
    const resolvedVisitId = rawVisitId
      ?? buildImportedVisitId(rawVisitReference);
    const resolvedVisitReference = rawVisitReference ?? formatVisitReference(resolvedVisitId);
    let recommendationSummary: CustomerSummaryV1 | undefined =
      pkg.proposalTruth?.customerSummary
      ?? pkg.customerPropertyDetails.customerSummary;
    let derivedDecision: AtlasDecisionV1 | undefined = pkg.proposalTruth?.decision;
    let derivedScenarios: ScenarioResult[] | undefined;
    // If customerSummary is missing but engine input is available, run the engine
    // synchronously so the customer portal can be auto-created immediately on load.
    if (recommendationSummary == null && pkg.engineInputSnapshot != null && pkg.surveyDraft != null) {
      try {
        const sourceInput = pkg.engineInputSnapshot;
        const { engineOutput } = runEngine(sourceInput);
        const scenariosFromPkg = buildScenariosFromEngineOutput(engineOutput);
        if (scenariosFromPkg.length > 0) {
          derivedScenarios = scenariosFromPkg;
          derivedDecision = derivedDecision ?? buildDecisionFromScenarios({
            scenarios: scenariosFromPkg,
            boilerType: toLifecycleBoilerType(sourceInput.currentHeatSourceType),
            ageYears: sourceInput.currentSystem?.boiler?.ageYears ?? 0,
            occupancyCount: sourceInput.occupancyCount,
            bathroomCount: sourceInput.bathroomCount,
            showerCompatibilityNote: engineOutput.showerCompatibilityNote,
          });
          recommendationSummary = buildCustomerSummary(derivedDecision, scenariosFromPkg);
        }
      } catch {
        // Engine failed — proceed with available data; effect 2 will retry.
      }
    }
    const portalVisitContext = pkg.customerPropertyDetails.portalVisitContext != null
      ? {
          addressSummary: pkg.customerPropertyDetails.portalVisitContext.addressSummary,
          personalDataMode: pkg.customerPropertyDetails.portalVisitContext.personalDataMode,
        }
      : undefined;
    const recommendationSnapshot =
      pkg.recommendationAuthority
      ?? pkg.importExportMetadata.recommendationSnapshot;
    const generatedOutputs = enrichGeneratedOutputsWithCustomerJourneyPack({
      generatedOutputs: pkg.generatedOutputStatus?.generatedOutputs,
      surveyModel: pkg.surveyDraft,
      engineInput: pkg.engineInputSnapshot,
      customerSummary: recommendationSummary,
      decision: derivedDecision,
      activeSnapshotId: recommendationSnapshot?.snapshotId,
      portalVisitContext,
      generatedAt: pkg.importExportMetadata.exportedAt,
      scenarios: derivedScenarios,
    });
    const hydratedGeneratedOutputs = generatedOutputs.portal.url === undefined || generatedOutputs.portal.url === null
      ? generatedOutputs
      : {
          ...generatedOutputs,
          portal: {
            ...generatedOutputs.portal,
            url: undefined,
          },
        };
    const recommendationReady = isRecommendationReadyForLifecycle({
      decision: derivedDecision,
      customerSummary: recommendationSummary,
      acceptedScenarioId: pkg.proposalTruth?.selectedScenarioId,
      engineRecommendationPrimary: undefined,
    });
    const lifecycleState =
      pkg.generatedOutputStatus?.lifecycleState
      ?? deriveLifecycleStateFromSnapshot({
        recommendationReady,
        generatedOutputs,
      });
    const importedAt = new Date().toISOString();

    saveVisitAtomically(buildPersistedAtlasVisitV2({
      visitId: resolvedVisitId,
      visitReference: resolvedVisitReference,
      updatedAt: importedAt,
      survey: pkg.surveyDraft,
      engineInputSnapshot: pkg.engineInputSnapshot,
        decision: derivedDecision,
        customerSummary: recommendationSummary,
        acceptedScenarioId: pkg.proposalTruth?.selectedScenarioId,
        lifecycleState,
        generatedOutputs: hydratedGeneratedOutputs,
        recommendationSnapshot,
        portalVisitContext,
      }));

    setImportedWorkflowVisitIds((prev) =>
      prev.includes(resolvedVisitId) ? prev : [...prev, resolvedVisitId],
    );
    setActiveVisitId(resolvedVisitId);
    setLabEngineInput(pkg.engineInputSnapshot);
    setLabFullSurveyModel(pkg.surveyDraft);
    if (pkg.surveyDraft.fullSurvey?.heatLoss) setLabHeatLossState(pkg.surveyDraft.fullSurvey.heatLoss);
    if (pkg.surveyDraft.fullSurvey?.priorities) setLabPrioritiesState(pkg.surveyDraft.fullSurvey.priorities);
    if (pkg.surveyDraft.fullSurvey?.quotes) setLabQuotes(pkg.surveyDraft.fullSurvey.quotes);
    setLabPortalVisitContext(portalVisitContext);
    setLabPortalUrl(undefined);
    setVisitRecommendationSnapshot({
      visitId: resolvedVisitId,
      visitReference: resolvedVisitReference,
      recommendationSnapshot,
      decision: derivedDecision,
      customerSummary: recommendationSummary,
      acceptedScenarioId: pkg.proposalTruth?.selectedScenarioId,
      lifecycleState,
      generatedOutputs: hydratedGeneratedOutputs,
      portalVisitContext,
    });
    setLastOpenedFromHome(null);
    setActiveCanonicalPackage(pkg);
    setActivePortalLaunchPayload(null);
    setLastImportFailure(null);
    setPackageOpenHistory((prev) =>
      appendPackageOpenHistory(prev, {
        visitReference: resolvedVisitReference,
        importedAt,
        sourceLabel: toImportSurfaceLabel(importSurface),
        integrityStatus: integrity.status,
      }),
    );
    setLocalSessionStatus(buildPackageImportStatusMessage(resolvedVisitReference, importSurface, integrity));
    // Suppress the auto-hydration effect so it does not re-show the visit
    // recovery prompt immediately after a canonical package import.
    setHydratedPersistedVisitId(resolvedVisitId);
    setJourney('visit-home');
  }

  async function handleImportCanonicalVisitPackage(
    file: File,
    importSurface: WorkflowImportSurface,
  ) {
    try {
      const fileText = await file.text();
      const parsed = file.name.toLowerCase().endsWith('.pdf')
        ? parseCanonicalVisitPackageFromPdfEnvelope(fileText)
        : parseCanonicalVisitPackage(fileText);
      if (!parsed.ok) {
        setLastImportFailure({
          occurredAt: new Date().toISOString(),
          filename: file.name,
          errors: parsed.errors,
        });
        setLocalSessionStatus(buildImportFailureStatus(parsed.errors));
        return;
      }
      hydrateStateFromCanonicalVisitPackage(parsed.pkg, importSurface, parsed.integrity);
    } catch {
      setLastImportFailure({
        occurredAt: new Date().toISOString(),
        filename: file.name,
        errors: [`unable to read ${file.name}`],
      });
      setLocalSessionStatus({
        tone: 'error',
        type: 'session',
        message: `Package import blocked: unable to read ${file.name}.`,
      });
    }
  }

  function buildCanonicalVisitPackageForCurrentSession(options?: {
    readonly markPdfGenerated?: boolean;
  }): {
    readonly pkg: CanonicalVisitPackageV1;
    readonly now: string;
    readonly visitReference: string;
    readonly exportVisitId: string;
    readonly exportSurveyModel: FullSurveyModelV1;
    readonly currentSnapshot: VisitRecommendationSnapshotLike | null;
    readonly generatedOutputs: GeneratedOutputsV1;
    readonly recommendationSnapshot: CanonicalRecommendationSnapshotV1;
    readonly exportDecision?: AtlasDecisionV1;
    readonly exportCustomerSummary?: CustomerSummaryV1;
    readonly selectedScenarioId?: string;
    readonly exportPortalVisitContext?: PersistedPortalVisitContext;
  } | {
    readonly exportAuthorityDiagnostics: {
      readonly reviewRecommendationId: string;
      readonly exportRecommendationId: string;
      readonly snapshotChecksum: string;
      readonly mismatchReasons: readonly string[];
    };
  } | undefined {
    const savedVisit =
      activeVisitId != null
        ? readPersistedAtlasVisitV2(activeVisitId).visit
        : null;
    const resolvedExportState = resolveCanonicalVisitExportState({
      activeVisitId,
      activeVisitMeta,
      savedVisit,
      activeCanonicalPackage,
      currentSnapshot:
        visitRecommendationSnapshot?.visitId === activeVisitId
          ? visitRecommendationSnapshot
          : null,
      labFullSurveyModel,
      labEngineInput,
      labPortalVisitContext,
    });
    if (resolvedExportState == null) {
      if (import.meta.env.DEV) {
        console.warn('[Atlas] Unable to build canonical visit package for current session', {
          missingVisitId: activeVisitId == null && !hasText(activeCanonicalPackage?.visitIdentity.visitId),
          missingSurveyModel:
            savedVisit?.survey == null
            && activeCanonicalPackage?.surveyDraft == null
            && labFullSurveyModel == null,
        });
      }
      return undefined;
    }
    const {
      exportVisitId,
      exportSurveyModel,
      exportEngineInput: resolvedExportEngineInput,
      exportCustomerSummary: resolvedExportCustomerSummary,
      exportDecision: resolvedExportDecision,
      selectedScenarioId: resolvedSelectedScenarioId,
      exportPortalVisitContext: resolvedExportPortalVisitContext,
      visitReference: resolvedVisitReference,
      generatedOutputsSeed,
      recommendationSnapshot: resolvedRecommendationSnapshot,
      currentSnapshot,
    } = resolvedExportState;
    const now = new Date().toISOString();
    const exportEngineInput = resolvedExportEngineInput;
    let exportCustomerSummary: CustomerSummaryV1 | undefined =
      resolvedExportCustomerSummary;
    let exportDecision: AtlasDecisionV1 | undefined =
      resolvedExportDecision;
    let exportScenarios: ScenarioResult[] | undefined = currentSnapshot?.scenarios;
    // If customerSummary is missing but engine input is available, compute it
    // now so the PDF always renders the library customer document rather than
    // the fallback metadata-only view.
    if (exportCustomerSummary == null && exportEngineInput != null) {
      try {
        const { engineOutput } = runEngine(exportEngineInput);
        const scenariosForExport = buildScenariosFromEngineOutput(engineOutput);
        if (scenariosForExport.length > 0) {
          exportScenarios = exportScenarios ?? scenariosForExport;
          exportDecision = exportDecision ?? buildDecisionFromScenarios({
            scenarios: scenariosForExport,
            boilerType: toLifecycleBoilerType(exportEngineInput.currentHeatSourceType),
            ageYears: exportEngineInput.currentSystem?.boiler?.ageYears ?? 0,
            occupancyCount: exportEngineInput.occupancyCount,
            bathroomCount: exportEngineInput.bathroomCount,
            showerCompatibilityNote: engineOutput.showerCompatibilityNote,
          });
          exportCustomerSummary = buildCustomerSummary(exportDecision, scenariosForExport);
        }
      } catch {
        // Engine failed — export will use available data (may fall back to metadata view).
      }
    }
    const exportPortalVisitContext =
      resolvedExportPortalVisitContext;
    const canonicalPackagePortalVisitContext = activeCanonicalPackage?.customerPropertyDetails.portalVisitContext;
    const selectedScenarioId = resolvedSelectedScenarioId;
    const visitReference = resolvedVisitReference;
    const authorityIntegrityIssues = resolveAuthorityIntegrityIssues({
      selectedScenarioId,
      exportDecision,
      exportCustomerSummary,
      currentSnapshot,
      activeCanonicalPackage,
    });
    const reviewRecommendationId = resolveReviewRecommendationId(currentSnapshot);
    const exportRecommendationId = resolveExportRecommendationId({
      selectedScenarioId,
      exportDecision,
      exportCustomerSummary,
    });
    const authoritySnapshot = resolvedRecommendationSnapshot
      ?? buildCanonicalRecommendationSnapshot({
        visitId: exportVisitId,
        sourceVisitRevision: now,
        selectedScenarioId,
        decision: exportDecision,
        customerSummary: exportCustomerSummary,
        regeneratedFrom: currentSnapshot?.recommendationSnapshot?.snapshotId,
        createdAt: now,
      });
    if (authorityIntegrityIssues.length > 0) {
      if (import.meta.env.DEV) {
        console.error('[Atlas] Export integrity assertion failed', authorityIntegrityIssues);
      }
      return {
        exportAuthorityDiagnostics: {
          reviewRecommendationId,
          exportRecommendationId,
          snapshotChecksum: authoritySnapshot.checksum,
          mismatchReasons: authorityIntegrityIssues,
        },
      };
    }
    const generatedOutputsWithPack = enrichGeneratedOutputsWithCustomerJourneyPack({
      generatedOutputs: generatedOutputsSeed,
      surveyModel: exportSurveyModel,
      engineInput: exportEngineInput,
      customerSummary: exportCustomerSummary,
      decision: exportDecision,
      activeSnapshotId: authoritySnapshot.snapshotId,
      portalVisitContext: exportPortalVisitContext,
      generatedAt: now,
      scenarios: exportScenarios,
    });
    const generatedOutputs: GeneratedOutputsV1 = options?.markPdfGenerated === true
      ? {
          ...generatedOutputsWithPack,
          pdf: {
            ...generatedOutputsWithPack.pdf,
            generated: true,
            generatedAt: now,
            version: generatedOutputsWithPack.pdf.version ?? '1.0',
            status: generatedOutputsWithPack.pdf.status ?? 'generated',
          },
        }
      : generatedOutputsWithPack;
    const pkg = buildCanonicalVisitPackage({
      packageData: {
        visitIdentity: {
          visitId: exportVisitId,
          visitReference,
          updatedAt: now,
        },
        workspaceBrandReference: {
          workspaceId: currentWorkspace?.workspaceId,
          workspaceName: currentWorkspace?.name,
          brandId: activeAtlasVisit?.brandId ?? workspaceBrandSession.activeBrandId,
        },
        customerPropertyDetails: {
          customerSummary: exportCustomerSummary,
          portalVisitContext: canonicalPackagePortalVisitContext,
        },
        surveyDraft: exportSurveyModel,
        engineInputSnapshot: exportEngineInput,
        proposalTruth: {
          decision: exportDecision,
          selectedScenarioId,
          customerSummary: exportCustomerSummary,
        },
        generatedOutputStatus: {
          lifecycleState: currentSnapshot?.lifecycleState,
          generatedOutputs,
        },
        recommendationAuthority: authoritySnapshot,
        importExportMetadata: {
          exportedAt: now,
          source: {
            target: 'local_only',
            surface: 'visit_home_export',
          },
          recommendationSnapshot: authoritySnapshot,
        },
      },
    });
    return {
      pkg,
      now,
      visitReference,
      exportVisitId,
      exportSurveyModel,
      currentSnapshot,
      generatedOutputs,
      recommendationSnapshot: authoritySnapshot,
      exportDecision,
      exportCustomerSummary,
      selectedScenarioId,
      exportPortalVisitContext,
    };
  }

  function handleExportCanonicalVisitPackage() {
    const prepared = buildCanonicalVisitPackageForCurrentSession({ markPdfGenerated: true });
    if (prepared == null) {
      setLocalSessionStatus({ tone: 'error', message: 'Unable to export: no active visit survey in memory.' });
      return;
    }
    if (!('pkg' in prepared)) {
      setLocalSessionStatus({
        tone: 'error',
        message: buildExportBlockedMessage({
          reviewRecommendationId: prepared.exportAuthorityDiagnostics.reviewRecommendationId,
          exportRecommendationId: prepared.exportAuthorityDiagnostics.exportRecommendationId,
          snapshotChecksum: prepared.exportAuthorityDiagnostics.snapshotChecksum,
          mismatchReasons: prepared.exportAuthorityDiagnostics.mismatchReasons,
        }),
      });
      return;
    }
    const {
      pkg,
      now,
      visitReference,
      exportVisitId,
      exportSurveyModel,
      currentSnapshot,
      generatedOutputs,
      recommendationSnapshot,
      exportDecision,
      exportCustomerSummary,
      selectedScenarioId,
      exportPortalVisitContext,
    } = prepared;
    const pdfEnvelope = buildVisitPackagePdfEnvelope({
      packagePayload: pkg,
      generatedAt: now,
      scanPackages: (() => {
        const scanCapture = getScanCapture(exportVisitId);
        return scanCapture != null ? [scanCapture] : undefined;
      })(),
    });
    const filename = `${resolveCustomerPdfDownloadBaseName(activeVisitMeta, visitReference, exportVisitId)}${CUSTOMER_PACK_FILENAME_SUFFIX}`;
    try {
      const pdf = renderVisitPackagePdfDocument(pdfEnvelope);
      const blob = new Blob([pdf], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[Atlas] Customer PDF export failed', err);
      }
      setLocalSessionStatus({
        tone: 'error',
        message: 'Customer PDF export failed. Please try again, or contact support if the problem persists.',
      });
      return;
    }

    setActiveCanonicalPackage(pkg);
    setPackageOpenHistory((prev) =>
      appendPackageOpenHistory(prev, {
        visitReference,
        importedAt: now,
        sourceLabel: 'Visit Home export',
        integrityStatus: 'verified',
      }),
    );

    const lifecycleAfterPresentation = dispatchVisitJourneyEvent(
      currentSnapshot?.lifecycleState,
      { type: 'presentation_generated' },
    );
    const nextSnapshot: VisitRecommendationSnapshot = {
      visitId: exportVisitId,
      visitReference,
      recommendationSnapshot,
      engineOutput: currentSnapshot?.engineOutput,
      scenarios: currentSnapshot?.scenarios,
      decision: exportDecision ?? currentSnapshot?.decision,
      customerSummary: exportCustomerSummary ?? currentSnapshot?.customerSummary,
      acceptedScenarioId: selectedScenarioId ?? currentSnapshot?.acceptedScenarioId,
      lifecycleState: dispatchVisitJourneyEvent(
        lifecycleAfterPresentation,
        { type: 'visit_exported' },
      ),
      generatedOutputs,
      portalVisitContext: exportPortalVisitContext,
    };
    persistActiveVisitSnapshot(nextSnapshot, exportSurveyModel);
    setLocalSessionStatus(buildExportConfirmationStatus(filename, pkg));
  }

  async function handleGenerateRecommendation() {
    if (activeVisitId == null) {
      setLocalSessionStatus({ tone: 'error', message: 'Cannot generate recommendation: no active visit.' });
      return;
    }
    if (labFullSurveyModel == null) {
      setLocalSessionStatus({ tone: 'error', message: 'Cannot generate recommendation: survey is missing.' });
      return;
    }

    const sourceInput = labEngineInput ?? toEngineInput(sanitiseModelForEngine(labFullSurveyModel));
    const surveySnapshot = labFullSurveyModel;

    let engineSnapshot: EngineOutputV1 | undefined;
    let scenariosSnapshot: ScenarioResult[] | undefined;
    let decisionSnapshot: AtlasDecisionV1 | undefined;
    let customerSummarySnapshot: CustomerSummaryV1 | undefined;
    try {
      const { engineOutput } = runEngine(sourceInput);
      engineSnapshot = engineOutput;
      scenariosSnapshot = buildScenariosFromEngineOutput(engineOutput);
      if (scenariosSnapshot.length > 0) {
        decisionSnapshot = buildDecisionFromScenarios({
          scenarios: scenariosSnapshot,
          boilerType: toLifecycleBoilerType(sourceInput.currentHeatSourceType),
          ageYears: sourceInput.currentSystem?.boiler?.ageYears ?? 0,
          occupancyCount: sourceInput.occupancyCount,
          bathroomCount: sourceInput.bathroomCount,
          showerCompatibilityNote: engineOutput.showerCompatibilityNote,
        });
        customerSummarySnapshot = buildCustomerSummary(decisionSnapshot, scenariosSnapshot);
      }
    } catch (err) {
      console.error('[Atlas] Recommendation generation failed:', err);
      setLocalSessionStatus({ tone: 'error', message: 'Recommendation generation failed. Review survey inputs and retry.' });
      return;
    }

    setLabEngineInput(sourceInput);
    setLabFullSurveyModel(surveySnapshot);
    const currentSnapshot =
      visitRecommendationSnapshot?.visitId === activeVisitId
        ? visitRecommendationSnapshot
        : null;
    const regeneratedAt = new Date().toISOString();
    const recommendationSnapshot = buildCanonicalRecommendationSnapshot({
      visitId: activeVisitId,
      sourceVisitRevision: regeneratedAt,
      selectedScenarioId: decisionSnapshot?.recommendedScenarioId,
      decision: decisionSnapshot,
      customerSummary: customerSummarySnapshot,
      regeneratedFrom: currentSnapshot?.recommendationSnapshot?.snapshotId,
      createdAt: regeneratedAt,
    });
    let generatedOutputs = invalidateGeneratedArtifacts(currentSnapshot?.generatedOutputs);
    let lifecycleState = dispatchVisitJourneyEvent(
      currentSnapshot?.lifecycleState,
      { type: 'recommendation_generated' },
    );
    let portalUrl: string | undefined;
    let statusMessage = 'Recommendation generated and visit snapshot refreshed.';

    try {
      const reports = await listReportsForVisit(activeVisitId);
      let reportId: string;
      if (reports.length > 0) {
        reportId = reports[0].id;
      } else {
        const ensuredEngineOutput = engineSnapshot ?? runEngine(sourceInput).engineOutput;
        const saved = await saveReport({
          title: generateReportTitle({
            postcode: sourceInput.postcode ?? null,
            recommendedSystem: ensuredEngineOutput.recommendation?.primary ?? null,
          }),
          postcode: sourceInput.postcode ?? null,
          visit_id: activeVisitId,
          status: 'complete',
          payload: buildCanonicalReportPayload({
            surveyData: surveySnapshot,
            engineInput: sourceInput,
            engineOutput: ensuredEngineOutput,
            decisionSynthesis: null,
            // Marks reports created from Visit Home recommendation generation
            // so downstream consumers can distinguish them from print/visit-hub
            // report creation flows.
            runMeta: { source: 'portal_bootstrap' },
          }),
        });
        reportId = saved.id;
      }
      const token = await generatePortalToken(reportId);
      portalUrl = buildPortalUrl(reportId, window.location.origin, token);
      generatedOutputs = withGeneratedPortalOutput(generatedOutputs, {
        generatedAt: regeneratedAt,
        url: portalUrl,
        snapshotId: recommendationSnapshot.snapshotId,
      });
      lifecycleState = dispatchVisitJourneyEvent(lifecycleState, { type: 'presentation_generated' });
      statusMessage = 'Recommendation generated, portal link refreshed, and customer outputs updated.';
    } catch (err) {
      console.warn('[Atlas] Recommendation generated, but portal output refresh failed:', err);
      statusMessage = 'Recommendation generated. Portal link refresh failed — use Visit Home → Customer portal to regenerate.';
    }

    const nextSnapshot: VisitRecommendationSnapshot = {
      visitId: activeVisitId,
      visitReference: resolveVisitSessionReference(activeVisitMeta, activeVisitId),
      recommendationSnapshot,
      engineOutput: engineSnapshot,
      scenarios: scenariosSnapshot,
      decision: decisionSnapshot,
      customerSummary: customerSummarySnapshot,
      acceptedScenarioId: decisionSnapshot?.recommendedScenarioId,
      lifecycleState,
      generatedOutputs,
      portalVisitContext: labPortalVisitContext,
    };
    setVisitRecommendationSnapshot(nextSnapshot);
    if (portalUrl != null) {
      setLabPortalUrl(portalUrl);
    }
    saveVisitAtomically(buildPersistedAtlasVisitV2({
      visitId: activeVisitId,
      visitReference: resolveVisitSessionReference(activeVisitMeta, activeVisitId),
      updatedAt: regeneratedAt,
      survey: surveySnapshot,
      engineInputSnapshot: sourceInput,
      engine: engineSnapshot,
      decision: decisionSnapshot,
      scenarios: scenariosSnapshot,
      customerSummary: customerSummarySnapshot,
      acceptedScenarioId: decisionSnapshot?.recommendedScenarioId,
      lifecycleState,
      generatedOutputs,
      recommendationSnapshot,
      portalVisitContext: labPortalVisitContext,
    }));
    setLocalSessionStatus({ tone: 'success', message: statusMessage });
  }

  function persistActiveVisitSnapshot(
    snapshot: VisitRecommendationSnapshot,
    surveySnapshot: FullSurveyModelV1,
  ) {
    const generatedOutputs = enrichGeneratedOutputsWithCustomerJourneyPack({
      generatedOutputs: snapshot.generatedOutputs,
      surveyModel: surveySnapshot,
      engineInput: labEngineInput,
      customerSummary: snapshot.customerSummary,
      decision: snapshot.decision,
      activeSnapshotId: snapshot.recommendationSnapshot?.snapshotId,
      portalVisitContext: snapshot.portalVisitContext,
      scenarios: snapshot.scenarios,
    });
    const enrichedSnapshot: VisitRecommendationSnapshot = {
      ...snapshot,
      generatedOutputs,
    };
    saveVisitAtomically(buildPersistedAtlasVisitV2({
      visitId: enrichedSnapshot.visitId,
      visitReference: enrichedSnapshot.visitReference,
      updatedAt: new Date().toISOString(),
      survey: surveySnapshot,
      engineInputSnapshot: labEngineInput,
      engine: enrichedSnapshot.engineOutput,
      decision: enrichedSnapshot.decision,
      scenarios: enrichedSnapshot.scenarios,
      customerSummary: enrichedSnapshot.customerSummary,
      acceptedScenarioId: enrichedSnapshot.acceptedScenarioId,
      lifecycleState: enrichedSnapshot.lifecycleState,
      generatedOutputs,
      recommendationSnapshot: enrichedSnapshot.recommendationSnapshot,
      portalVisitContext: enrichedSnapshot.portalVisitContext,
    }));
    setVisitRecommendationSnapshot(enrichedSnapshot);
    setLabPortalUrl(generatedOutputs.portal.url);
  }

  async function handleGenerateCustomerPortal() {
    if (activeVisitId == null || labFullSurveyModel == null) {
      setLocalSessionStatus({ tone: 'error', message: 'Cannot generate customer portal: visit survey is missing.' });
      return;
    }
    try {
      const engineInput = labEngineInput ?? toEngineInput(sanitiseModelForEngine(labFullSurveyModel));
      if (labEngineInput == null) setLabEngineInput(engineInput);
      const reports = await listReportsForVisit(activeVisitId);
      let reportId: string;
      if (reports.length > 0) {
        reportId = reports[0].id;
      } else {
        const { engineOutput } = runEngine(engineInput);
        const saved = await saveReport({
          title: generateReportTitle({
            postcode: engineInput.postcode ?? null,
            recommendedSystem: engineOutput.recommendation?.primary ?? null,
          }),
          postcode: engineInput.postcode ?? null,
          visit_id: activeVisitId,
          status: 'complete',
          payload: buildCanonicalReportPayload({
            surveyData: labFullSurveyModel,
            engineInput,
            engineOutput,
            decisionSynthesis: null,
            runMeta: { source: 'portal_bootstrap' },
          }),
        });
        reportId = saved.id;
      }
      const token = await generatePortalToken(reportId);
      const portalUrl = buildPortalUrl(reportId, window.location.origin, token);
      const now = new Date().toISOString();
      const currentSnapshot = visitRecommendationSnapshot?.visitId === activeVisitId ? visitRecommendationSnapshot : null;
      const generatedOutputs = enrichGeneratedOutputsWithCustomerJourneyPack({
        generatedOutputs: currentSnapshot?.generatedOutputs,
        surveyModel: labFullSurveyModel,
        engineInput,
        customerSummary: currentSnapshot?.customerSummary,
        decision: currentSnapshot?.decision,
        activeSnapshotId: currentSnapshot?.recommendationSnapshot?.snapshotId,
        portalVisitContext: currentSnapshot?.portalVisitContext ?? labPortalVisitContext,
        generatedAt: now,
        scenarios: currentSnapshot?.scenarios,
      });
      const nextOutputs: GeneratedOutputsV1 = withGeneratedPortalOutput(generatedOutputs, {
        generatedAt: now,
        url: portalUrl,
        snapshotId: currentSnapshot?.recommendationSnapshot?.snapshotId,
      });
      const lifecycleState = dispatchVisitJourneyEvent(
        currentSnapshot?.lifecycleState,
        { type: 'presentation_generated' },
      );
      const nextSnapshot: VisitRecommendationSnapshot = {
        visitId: activeVisitId,
        visitReference: resolveVisitSessionReference(activeVisitMeta, activeVisitId),
        recommendationSnapshot: currentSnapshot?.recommendationSnapshot,
        engineOutput: currentSnapshot?.engineOutput,
        scenarios: currentSnapshot?.scenarios,
        decision: currentSnapshot?.decision,
        customerSummary: currentSnapshot?.customerSummary,
        acceptedScenarioId: currentSnapshot?.acceptedScenarioId,
        lifecycleState,
        generatedOutputs: nextOutputs,
        portalVisitContext: currentSnapshot?.portalVisitContext ?? labPortalVisitContext,
      };
      persistActiveVisitSnapshot(nextSnapshot, labFullSurveyModel);
      setLocalSessionStatus({ tone: 'success', message: 'Customer portal generated and visit outputs updated.' });
    } catch (err) {
      console.error('[Atlas] Could not generate customer portal output', err);
      setLocalSessionStatus({ tone: 'error', message: 'Customer portal generation failed. Please retry.' });
    }
  }

  function handleStartDemoReview(demoVisitId: string = DEMO_VISIT_IDS.completed_won) {
    const demoSurvey = CONSOLE_DEMO_INPUT as unknown as FullSurveyModelV1;
    setActiveVisitId(demoVisitId);
    setLabEngineInput(CONSOLE_DEMO_INPUT);
    setLabFullSurveyModel(demoSurvey);
    try {
      const { engineOutput } = runEngine(CONSOLE_DEMO_INPUT);
      const scenarios = buildScenariosFromEngineOutput(engineOutput);
      const decision = scenarios.length > 0
        ? buildDecisionFromScenarios({
            scenarios,
            boilerType: toLifecycleBoilerType(CONSOLE_DEMO_INPUT.currentHeatSourceType),
            ageYears: CONSOLE_DEMO_INPUT.currentSystem?.boiler?.ageYears ?? 0,
            occupancyCount: CONSOLE_DEMO_INPUT.occupancyCount,
            bathroomCount: CONSOLE_DEMO_INPUT.bathroomCount,
            showerCompatibilityNote: engineOutput.showerCompatibilityNote,
          })
        : undefined;
      const customerSummary = decision != null ? buildCustomerSummary(decision, scenarios) : undefined;
      const now = new Date().toISOString();
      const recommendationSnapshot = buildCanonicalRecommendationSnapshot({
        visitId: demoVisitId,
        sourceVisitRevision: now,
        selectedScenarioId: decision?.recommendedScenarioId,
        decision,
        customerSummary,
        createdAt: now,
      });
      const lifecycleState = dispatchVisitJourneyEvent(
        DEFAULT_ATLAS_VISIT_JOURNEY_STATE,
        { type: 'recommendation_generated' },
      );
      const generatedOutputs = enrichGeneratedOutputsWithCustomerJourneyPack({
        generatedOutputs: createEmptyGeneratedOutputs(),
        surveyModel: demoSurvey,
        engineInput: CONSOLE_DEMO_INPUT,
        customerSummary,
        decision,
        activeSnapshotId: recommendationSnapshot.snapshotId,
        portalVisitContext: labPortalVisitContext,
        scenarios: scenarios,
      });
      setVisitRecommendationSnapshot({
        visitId: demoVisitId,
        visitReference: formatVisitReference(demoVisitId),
        recommendationSnapshot,
        engineOutput,
        scenarios,
        decision,
        customerSummary,
        acceptedScenarioId: decision?.recommendedScenarioId,
        lifecycleState,
        generatedOutputs,
        portalVisitContext: labPortalVisitContext,
      });
      saveVisitAtomically(buildPersistedAtlasVisitV2({
        visitId: demoVisitId,
        visitReference: formatVisitReference(demoVisitId),
        updatedAt: now,
        survey: demoSurvey,
        engineInputSnapshot: CONSOLE_DEMO_INPUT,
        engine: engineOutput,
        decision,
        scenarios,
        customerSummary,
        acceptedScenarioId: decision?.recommendedScenarioId,
        lifecycleState,
        generatedOutputs,
        recommendationSnapshot,
        portalVisitContext: labPortalVisitContext,
      }));
    } catch (err) {
      console.error('[Atlas] Demo recommendation hydration failed:', err);
      // Keep demo survey context even if recommendation snapshots fail.
    }
    setJourney('visit-home');
  }

  function listSavedLocalVisitIds(): string[] {
    const visitIds = new Set<string>();
    try {
      const storageLength = localStorage.length;
      for (let i = 0; i < storageLength; i += 1) {
        const key = localStorage.key(i);
        if (key == null) continue;
        if (!key.startsWith('atlas_visit_') || key.endsWith('_tmp')) continue;
        const visitId = key.replace('atlas_visit_', '');
        if (visitId.length > 0) visitIds.add(visitId);
      }
    } catch {
      if (import.meta.env.DEV) {
        console.warn('[Atlas] Unable to enumerate local saved visits from localStorage.');
      }
      return [];
    }
    return [...visitIds];
  }

  function handleOpenScanFromCanonicalPackage(source: 'app-home' | 'visit-home') {
    if (activeCanonicalPackage == null) {
      setLocalSessionStatus({
        tone: 'error',
        message: 'Open in Atlas Scan is only available after importing a canonical visit package.',
      });
      return;
    }
    const payload = buildScanLaunchPayload(activeCanonicalPackage);
    const prepared = prepareScanLaunchRoute(payload);
    if (source === 'visit-home') {
      setLastOpenedFromHome({ label: 'Atlas Scan launch', journey: 'visit-home' });
    }
    window.location.href = prepared.deepLink;
  }

  /**
   * View recommendation for a completed visit.
   *
   * Loads the visit's working payload, converts it to engine input, and routes
   * directly to the Simulator Dashboard.  Falls back to the survey if the
   * working payload is missing or cannot be converted.
   */
  async function handleOpenPresentation(visitId: string) {
    try {
      const visitDetail = await getVisit(visitId);
      const workingPayload = visitDetail.working_payload;
      if (workingPayload && Object.keys(workingPayload).length > 0) {
        // Basic structural check — working_payload must look like a survey model.
        // If conversion fails, the surrounding try/catch falls through to the survey.
        const survey = workingPayload as unknown as FullSurveyModelV1;
        const engineInput = toEngineInput(sanitiseModelForEngine(survey));
        setActiveVisitId(visitId);
        setLabEngineInput(engineInput);
        // Populate presentation quadrants (house snapshot, priority chips).
        if (survey.fullSurvey?.heatLoss) setLabHeatLossState(survey.fullSurvey.heatLoss);
        if (survey.fullSurvey?.priorities) setLabPrioritiesState(survey.fullSurvey.priorities);
        // Ensure a report is linked to this visit so the portal URL is available
        // when the user returns to the Visit Hub after the presentation.
        void listReportsForVisit(visitId).then((reports) => {
          if (reports.length > 0) return;
          const { engineOutput } = runEngine(engineInput);
          return saveReport({
            title: generateReportTitle({
              postcode: engineInput.postcode ?? null,
              recommendedSystem: engineOutput.recommendation?.primary ?? null,
            }),
            postcode: engineInput.postcode ?? null,
            visit_id: visitId,
            status: 'complete',
            payload: buildCanonicalReportPayload({
              surveyData: survey,
              engineInput,
              engineOutput,
              decisionSynthesis: null,
              runMeta: { source: 'portal_bootstrap' },
            }),
          });
        }).catch(() => {/* best effort */});
        setPresentationFromJourney('visit-home');
        setJourney('presentation');
        return;
      }
    } catch (err) {
      // Log the failure so it is visible in dev tools, then fall back to survey.
      console.error('[Atlas] Could not load visit for presentation', visitId, err);
    }
    // Fallback: no working payload — send back to survey so the user can
    // complete and save it.
    setJourney('visit');
  }

  /**
   * Build a VisitHandoffPack from the current visit's working payload and open
   * the handoff review page.  When the working payload is available the pack is
   * built locally — no JSON upload/paste required.  Falls back gracefully to
   * the review page with an empty pack when the payload is missing.
   */
  async function handleOpenHandoffReview(visitId: string) {
    try {
      const visitDetail = await getVisit(visitId);
      const { working_payload, ...metaFields } = visitDetail;
      const survey = working_payload as unknown as import('./ui/fullSurvey/FullSurveyModelV1').FullSurveyModelV1;
      if (working_payload && (survey.fullSurvey != null || survey.bedrooms != null)) {
        // Extract the cached engine top option from the working payload so the
        // handoff builder can flag any mismatch with the manual recommendation.
        const engineMeta = (working_payload as Record<string, unknown>)?.['_atlasEngineRunMeta'];
        const engineOutput = engineMeta && typeof engineMeta === 'object'
          ? (engineMeta as Record<string, unknown>).output as import('./contracts/EngineOutputV1').EngineOutputV1 | undefined
          : undefined;
        const engineTopOptionId = engineOutput?.recommendation?.primary ?? undefined;
        const pack = buildHandoffPackFromSurvey(
          metaFields,
          survey,
          engineTopOptionId,
        );
        setActiveHandoffPack(pack);
      } else {
        setActiveHandoffPack(null);
      }
    } catch (err) {
      console.warn('[Atlas] Could not build handoff pack for visit', visitId, err);
      setActiveHandoffPack(null);
    }
    setJourney('visit-handoff');
  }

  /**
   * Open the Simulator Dashboard, optionally with a partial engine input already
   * known from Fast Choice.  If simulation-critical fields are missing, route
   * through the quick-input gate first; otherwise open the simulator directly.
   */
  function handleOpenLab(partial: Partial<EngineInputV2_3> = {}) {
    setLabPartialInput(partial);
    const missing = getMissingLabFields(partial);
    if (missing.length > 0) {
      setJourney('lab-quick-inputs');
    } else {
      // All quick-form fields are present.  Merge with safe defaults to fill
      // any remaining required EngineInputV2_3 fields, then route through the
      // fit-map page before opening the simulator.
      const engineInput = mergeLabQuickInputs(partial, {});
      setLabEngineInput(engineInput);
      setJourney('simulator');
    }
  }

  // Derive the canonical current-system summary once, before all early returns.
  // Used by both the INSTALLATION_SPECIFICATION_ENABLED route and the
  // journey === 'installation-specification' branch.
  const canonicalCurrentSystem: CanonicalCurrentSystemSummary | null = useMemo(
    () => labFullSurveyModel
      ? buildCurrentInstallationSummaryFromCanonicalSurvey(labFullSurveyModel)
      : null,
    [labFullSurveyModel],
  );

  const visitSelectorEntries = useMemo<VisitSelectorEntry[]>(() => {
    const entries: VisitSelectorEntry[] = [];
    const seen = new Set<string>();
    for (const visitId of listSavedLocalVisitIds()) {
      const key = `local:${visitId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({
        visitId,
        label: `Saved visit ${formatVisitReference(visitId)}`,
        source: 'local',
      });
    }
    for (const visitId of importedWorkflowVisitIds) {
      const key = `workflow:${visitId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({
        visitId,
        label: `Imported .atlasvisit ${formatVisitReference(visitId)}`,
        source: 'workflow',
      });
    }
    if (import.meta.env.DEV) {
      for (const visitId of Object.values(DEMO_VISIT_IDS)) {
        const key = `demo:${visitId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        entries.push({
          visitId,
          label: `Demo fixture ${formatVisitReference(visitId)}`,
          source: 'demo',
        });
      }
    }
    return entries;
  }, [importedWorkflowVisitIds]);

  if (WORKSPACE_SETTINGS_HOME) {
    return (
      <WorkspaceSettingsPage
        workspace={workspaceSettingsWorkspace}
        actingMembership={workspaceSettingsMembership}
        activeBrandSummary={{
          activeBrandId: workspaceBrandSession.activeBrandId,
          companyName: workspaceBrandSession.activeBrandProfile.companyName,
          resolutionSource: workspaceBrandSession.resolutionSource,
        }}
        sessionStatus={workspaceSession.status}
        onLocalApplySuccess={workspaceSession.refreshActiveWorkspace}
        onBack={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  // /workspace/:id — render a single workspace detail page.
  if (WORKSPACE_DETAIL_ID != null) {
    return (
      <WorkspaceDetailPage
        workspaceId={WORKSPACE_DETAIL_ID}
        autoOpenReview={WORKSPACE_AUTO_REVIEW}
        onBack={() => { window.location.href = '/workspace'; }}
      />
    );
  }

  // /analytics — render the tenant-level KPI analytics dashboard.
  if (ANALYTICS_HOME) {
    return (
      <AnalyticsDashboard
        onBack={() => { window.location.href = window.location.origin; }}
      />
    );
  }

  // /workspace — render the Visit Workspace home page.
  if (WORKSPACE_HOME) {
    return (
      <WorkspaceHomePage
        onOpenWorkspace={(id, openReview) => {
          window.location.href = openReview
            ? `/workspace/${id}?review=1`
            : `/workspace/${id}`;
        }}
        onBack={() => { window.location.href = window.location.origin; }}
      />
    );
  }

  // /portal/:reference — render the customer-facing recommendation portal.
  if (PORTAL_REFERENCE != null) {
    return <CustomerPortalPage reference={PORTAL_REFERENCE} token={PORTAL_TOKEN} />;
  }

  // /receive-scan — render the typed ScanToMindHandoffV1 receive page.
  // Atlas Scan iOS navigates here with ?payload=<URL-encoded JSON>.
  // After a successful receive, open Visit Home for the received visit.
  if (RECEIVE_SCAN_HANDOFF_PATH) {
    return (
      <ScanHandoffReceivePage
        onVisitReady={(visit) => {
          // Persist the AtlasVisit (including brandId) so the App restores
          // the correct brand when navigating to the visit hub.
          const atlasVisit = createAtlasVisit(
            visit.visitId,
            visit.brandId ?? DEFAULT_BRAND_ID,
            activeUser?.userId,
            {
              atlasUserId: atlasUserProfile?.atlasUserId,
              workspaceId: currentWorkspace?.workspaceId,
              storageTarget: workspaceSession.storageTarget,
            },
          );
          storeActiveVisit(atlasVisit);
          window.location.href = `/?visitId=${encodeURIComponent(visit.visitId)}`;
        }}
        onOpenEngineerEvidence={(visit) => {
          const atlasVisit = createAtlasVisit(
            visit.visitId,
            visit.brandId ?? DEFAULT_BRAND_ID,
            activeUser?.userId,
            {
              atlasUserId: atlasUserProfile?.atlasUserId,
              workspaceId: currentWorkspace?.workspaceId,
              storageTarget: workspaceSession.storageTarget,
            },
          );
          storeActiveVisit(atlasVisit);
          window.location.href = `/visit/${encodeURIComponent(visit.visitId)}/engineer`;
        }}
        onCancel={() => { window.location.href = window.location.origin; }}
      />
    );
  }

  // /dev/welcome-pack — render development preview for composed welcome-pack output.
  if (WELCOME_PACK_DEV_PREVIEW_PATH) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
        <div style={{ padding: '0.5rem 1rem' }}>
          <button className="back-btn" onClick={() => { window.location.href = '/'; }}>
            ← Back
          </button>
        </div>
        <WelcomePackDevPreview />
      </div>
    );
  }

  // /dev/portal-fixtures — render dev-only portal fixture launcher.
  // Allows the customer portal to be tested without a live visit or signed token.
  // Not reachable from any customer-facing route.
  if (PORTAL_FIXTURE_DEV_PATH) {
    return (
      <DevPortalFixturePage
        onBack={() => { window.location.href = '/'; }}
      />
    );
  }

  // /dev/customer-portal-preview (or ?customer-portal-preview=1) — production-like customer portal preview.
  if (CUSTOMER_PORTAL_PREVIEW_DEV_PATH) {
    return (
      <CustomerPortalPreviewPage
        onBack={() => { window.location.href = '/'; }}
      />
    );
  }

  // /dev/customer-pack-preview (or ?customer-pack-preview=1) — evidence-driven customer pack preview.
  if (CUSTOMER_PACK_PREVIEW_DEV_PATH) {
    return (
      <CustomerPackPreviewPage
        onBack={() => { window.location.href = '/'; }}
      />
    );
  }

  // /dev/library-explorer (or ?library-explorer=1) — library content asset explorer.
  if (LIBRARY_EXPLORER_DEV_PATH) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
        <div style={{ padding: '0.5rem 1rem' }}>
          <button className="back-btn" onClick={() => { window.location.href = '/dev/devmenu'; }}>
            ← Back
          </button>
        </div>
        <LibraryExplorerPage />
      </div>
    );
  }

  // /dev/visual-education-library (or ?visual-education-library=1) — front door for the visual QA galleries.
  if (VISUAL_EDUCATION_LIBRARY_QA_HUB_PATH) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
        <div style={{ padding: '0.5rem 1rem' }}>
          <button className="back-btn" onClick={() => { window.location.href = '/dev/devmenu'; }}>
            ← Back
          </button>
        </div>
        <VisualEducationLibraryQaHubPage />
      </div>
    );
  }

  // /dev/diagram-fixture (or ?diagram-fixture=1) — visual QA fixture for physical diagram recognisability.
  if (DIAGRAM_FIXTURE_DEV_PATH) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
        <div style={{ padding: '0.5rem 1rem' }}>
          <button className="back-btn" onClick={() => { window.location.href = '/dev/devmenu'; }}>
            ← Back
          </button>
        </div>
        <DiagramFixturePage />
      </div>
    );
  }

  // Visual Education Library — direct routes and query flags for the dev QA galleries.
  if (ACTIVE_VISUAL_EDUCATION_LIBRARY_SURFACE?.codeName === 'VisualPrimitiveGallery') {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
        <div style={{ padding: '0.5rem 1rem' }}>
          <button className="back-btn" onClick={() => { window.location.href = '/dev/devmenu'; }}>
            ← Back
          </button>
        </div>
        <VisualPrimitiveGallery />
      </div>
    );
  }

  if (ACTIVE_VISUAL_EDUCATION_LIBRARY_SURFACE?.codeName === 'VisualTopologyGallery') {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
        <div style={{ padding: '0.5rem 1rem' }}>
          <button className="back-btn" onClick={() => { window.location.href = '/dev/devmenu'; }}>
            ← Back
          </button>
        </div>
        <VisualTopologyGallery />
      </div>
    );
  }

  if (ACTIVE_VISUAL_EDUCATION_LIBRARY_SURFACE?.codeName === 'AnalogyOverlayGallery') {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
        <div style={{ padding: '0.5rem 1rem' }}>
          <button className="back-btn" onClick={() => { window.location.href = '/dev/devmenu'; }}>
            ← Back
          </button>
        </div>
        <AnalogyOverlayGallery />
      </div>
    );
  }

  if (ACTIVE_VISUAL_EDUCATION_LIBRARY_SURFACE?.codeName === 'SealedUnventedExplainerSlicePage') {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
        <div style={{ padding: '0.5rem 1rem' }}>
          <button className="back-btn" onClick={() => { window.location.href = '/dev/devmenu'; }}>
            ← Back
          </button>
        </div>
        <SealedUnventedExplainerSlicePage />
      </div>
    );
  }

  // /dev/inspector — render dev-only component discovery utility.
  if (DEV_INSPECTOR_PATH) {
    return (
      <ComponentDiscoveryPanel
        onBack={() => { window.location.href = '/dev/devmenu'; }}
      />
    );
  }

  // /installation-specification or ?installation-specification=1 — render the Atlas Installation Specification stepper shell.
  if (INSTALLATION_SPECIFICATION_ENABLED) {
    const handleBack = () => { window.history.back(); };
    return (
      <SpecificationErrorBoundary onBack={handleBack}>
        <Suspense fallback={specificationLoadingFallback}>
          <InstallationSpecificationPage
            onBack={handleBack}
            canonicalCurrentSystem={canonicalCurrentSystem}
            origin="direct"
            existingOptions={labInstallationSpecifications.length > 0 ? labInstallationSpecifications : undefined}
            onSave={(option) => {
              setLabInstallationSpecifications((prev) => {
                const idx = prev.findIndex((o) => o.id === option.id);
                if (idx >= 0) {
                  const updated = [...prev];
                  updated[idx] = option;
                  return updated;
                }
                return [...prev, option];
              });
            }}
            onFinish={() => { handleBack(); }}
          />
        </Suspense>
      </SpecificationErrorBoundary>
    );
  }

  // /visit/:visitId/engineer — render the dedicated pre-install engineer route.
  if (ENGINEER_VISIT_ID != null && journey === 'engineer') {
    return (
      <EngineerPreinstallPage
        visitId={ENGINEER_VISIT_ID}
        onBack={() => { window.history.back(); }}
      />
    );
  }

  // /visit/:visitId/twin — render the Spatial Twin feature.
  if (TWIN_VISIT_ID != null) {
    return (
      <SpatialTwinPage
        visitId={TWIN_VISIT_ID}
        onBack={() => { window.history.back(); }}
      />
    );
  }

  // ?report=1 is retired. Keep a safe notice instead of exposing duplicate report paths.
  if (REPORT_MODE_ENABLED) {
    return (
      <RetiredRouteNotice onBack={() => { window.location.href = '/'; }}>
        <p style={{ color: '#475569', marginBottom: '0.75rem' }}>
            The legacy <code>?report=1</code> route is retired.
        </p>
        <p style={{ color: '#475569', marginBottom: 0 }}>
            Use saved report routes (<code>/report/&lt;report-id&gt;</code>) or Visit Home cards for current outputs.
        </p>
      </RetiredRouteNotice>
    );
  }

  // ?deck=1 feature flag — render swipeable PresentationDeck directly with demo data.
  // NOTE: No heatLossState or prioritiesState available — demo input only.
  // Dev provenance badges on each slide indicate which canonical fields are active.
  if (DECK_MODE_ENABLED) {
    const result = runEngine(CONSOLE_DEMO_INPUT);
    return (
      <div style={{ padding: '1rem', background: '#f8fafc', minHeight: '100vh' }}>
        <button className="back-btn" onClick={() => { window.location.href = window.location.pathname; }}>
          ← Back
        </button>
        {import.meta.env.DEV && (
          <p className="atlas-dev-notice">
            🔬 Dev deck — CONSOLE_DEMO_INPUT (no survey heatLossState / prioritiesState)
          </p>
        )}
        <CanonicalPresentationPage
          result={result}
          input={CONSOLE_DEMO_INPUT}
          recommendationResult={result.recommendationResult}
          deckMode={true}
        />
      </div>
    );
  }

  // ?presentation=1 feature flag — render CanonicalPresentationPage directly with demo data.
  // NOTE: No heatLossState or prioritiesState available — demo input only.
  // data-canonical-source attributes on each section trace the canonical fields.
  if (PRESENTATION_MODE_ENABLED) {
    const result = runEngine(CONSOLE_DEMO_INPUT);
    return (
      <div style={{ padding: '1rem', background: '#f8fafc', minHeight: '100vh' }}>
        <button className="back-btn" onClick={() => { window.location.href = window.location.pathname; }}>
          ← Back
        </button>
        {import.meta.env.DEV && (
          <p className="atlas-dev-notice">
            🔬 Dev presentation — CONSOLE_DEMO_INPUT (no survey heatLossState / prioritiesState)
          </p>
        )}
        <CanonicalPresentationPage
          result={result}
          input={CONSOLE_DEMO_INPUT}
          recommendationResult={result.recommendationResult}
        />
      </div>
    );
  }

  // ?gallery=1 feature flag — render Physics Visual Library gallery for review.
  if (GALLERY_MODE_ENABLED) {
    return (
      <div style={{ background: 'var(--surface-page, #f8fafc)', minHeight: '100vh' }}>
        <PhysicsVisualGallery onBack={() => { window.location.href = window.location.pathname; }} />
      </div>
    );
  }

  // ?audit=1 — render Presentation Audit Page for developer scenario review.
  if (AUDIT_MODE_ENABLED) {
    return <PresentationAuditPage />;
  }

  // ?scan-import=1 — render Scan Import Dev Harness for testing scan bundle ingestion.
  if (SCAN_IMPORT_ENABLED) {
    return <ScanImportHarness onBack={() => { window.location.href = window.location.pathname; }} />;
  }

  // ?workspace-lifecycle-qa=1 — deterministic workspace visit lifecycle QA harness.
  if (WORKSPACE_LIFECYCLE_QA_ENABLED) {
    return <WorkspaceVisitLifecycleHarness onBack={() => { window.location.href = window.location.pathname; }} />;
  }

  // ?phone-customer-qa=1 — deterministic phone-first customer QA harness.
  if (PHONE_CUSTOMER_QA_ENABLED) {
    return <PhoneFirstQaHarness onBack={() => { window.location.href = window.location.pathname; }} />;
  }

  // ?lego-technix-debug=1 — deterministic LegoTechnix projection debug renderer.
  if (LEGO_TECHNIX_DEBUG_ENABLED) {
    return <LegoTechnixDebugProjectionPage onBack={() => { window.location.href = window.location.pathname; }} />;
  }

  // ?handoff=1 — retired route, kept only as a legacy notice.
  if (HANDOFF_ENABLED) {
    return (
      <RetiredRouteNotice backLabel="Open Visit Home →" onBack={() => { window.location.href = '/?visit-home=1'; }}>
        <p style={{ color: '#475569', marginBottom: 0 }}>
          This legacy handoff route has been retired. Use Visit Home for canonical customer and handoff outputs.
        </p>
      </RetiredRouteNotice>
    );
  }

  // ?visit-handoff=1 — render completed-visit handoff review (customer + engineer surfaces).
  if (VISIT_HANDOFF_REVIEW_ENABLED) {
    return (
      <VisitHandoffReviewPage
        initialPack={SAMPLE_VISIT_HANDOFF_PACK}
        onBack={() => { window.location.href = window.location.pathname; }}
      />
    );
  }

  // ?customer-share=1 — render customer-safe printable summary from imported handoff pack.
  if (CUSTOMER_SHARE_ENABLED) {
    return (
      <CustomerSummaryPrintPage
        initialPack={SAMPLE_VISIT_HANDOFF_PACK}
        onBack={() => { window.location.href = window.location.pathname; }}
      />
    );
  }

  // ?engineer-share=1 — render engineer compact install-prep handoff from imported handoff pack.
  if (ENGINEER_SHARE_ENABLED) {
    return (
      <EngineerSummaryPrintPage
        initialPack={SAMPLE_VISIT_HANDOFF_PACK}
        onBack={() => { window.location.href = window.location.pathname; }}
      />
    );
  }

  // ?insight-pack=1 — retired route; redirect to current customer-safe surfaces.
  if (INSIGHT_PACK_ENABLED) {
    return (
      <RetiredRouteNotice
        backLabel="Open customer-safe routes →"
        onBack={() => {
          window.location.href = import.meta.env.DEV ? '/dev/customer-pack-preview' : '/?visit-home=1';
        }}
      >
        <p style={{ color: '#475569', marginBottom: 0 }}>
          The legacy <code>?insight-pack=1</code> route is retired. Use Customer Portal / Supporting PDF for customer output,
          or <code>/dev/customer-pack-preview</code> for legacy diagnostics.
        </p>
      </RetiredRouteNotice>
    );
  }

  // ?atlas-capture=1 — render the on-device capture view for building a
  // SessionCaptureV2 session directly in the browser.
  if (ATLAS_CAPTURE_ENABLED) {
    return (
      <VisitDetailView
        onBack={() => { window.location.href = window.location.pathname; }}
        onExported={() => { window.location.href = window.location.pathname; }}
      />
    );
  }

  // ?receive-scan=1 — render the Web Share Target receive page.
  // The service worker sets this param after storing shared file(s) in IDB.
  // After a successful import:
  //   - If ?visitId=X is also present, navigate back to that visit's hub.
  //   - Otherwise, navigate to /workspace where the stored scan session can be reviewed.
  if (RECEIVE_SCAN_ENABLED) {
    const afterReceiveScan = INITIAL_VISIT_ID_PARAM
      ? `${window.location.pathname}?visitId=${encodeURIComponent(INITIAL_VISIT_ID_PARAM)}`
      : '/workspace';
    return (
      <ReceiveScanPage
        onImported={() => { window.location.href = afterReceiveScan; }}
        onCancel={() => { window.location.href = window.location.pathname; }}
      />
    );
  }

  // ?my-scans=1 — render the My Scans management page.
  if (MY_SCANS_ENABLED) {
    return (
      <ScanSessionListPage
        onBack={() => { window.location.href = window.location.pathname; }}
        onOpenSession={(sessionId) => {
          // Navigate to the scan session viewer — reuse receive-scan route with
          // the session ID passed as a query param for future deep-linking.
          window.location.href = `${window.location.pathname}?receive-scan=1&session=${encodeURIComponent(sessionId)}`;
        }}
      />
    );
  }

  // ?scan-package=1 — render Atlas Scan package import flow.
  // After a successful import:
  //   - If ?visitId=X is also present, navigate back to that visit's hub so the
  //     captured evidence is available in context.
  //   - Otherwise, navigate to /workspace where the stored scan session can be reviewed.
  if (SCAN_PACKAGE_ENABLED) {
    const afterScanImport = INITIAL_VISIT_ID_PARAM
      ? `${window.location.pathname}?visitId=${encodeURIComponent(INITIAL_VISIT_ID_PARAM)}`
      : '/workspace';
    return (
      <ScanPackageImportFlow
        onImported={() => { window.location.href = afterScanImport; }}
        onCancel={() => { window.location.href = window.location.pathname; }}
      />
    );
  }

  // /dev/devmenu or ?devmenu=1 — render Developer Component Browser directly.
  if (DEV_MENU_ENABLED) {
    return (
      <DevMenuPage
        onBack={() => { window.location.href = '/'; }}
        onLoadDemoWorkspace={() => { window.location.href = '/'; }}
      />
    );
  }

  // ?create-workspace=1 — render Workspace Onboarding page.
  if (CREATE_WORKSPACE_ENABLED) {
    return (
      <TenantOnboardingPage
        onCancel={() => { window.location.href = window.location.pathname; }}
        onCreated={() => { /* stay on success panel */ }}
        onStartVisit={(slug) => {
          window.location.href = `${window.location.pathname}?start-visit=1&workspace=${encodeURIComponent(slug)}`;
        }}
        onOpenWorkspaceSettings={() => {
          window.location.href = '/workspace/settings';
        }}
      />
    );
  }

  // ?lab=1 feature flag — render Demo Lab directly.
  if (LAB_MODE_ENABLED) {
    return <ExplainersHubPage onBack={() => { window.location.href = window.location.pathname; }} />;
  }

  // ?house-simulator=1 — render the customer-facing House Simulator surface.
  if (HOUSE_SIMULATOR_MODE_ENABLED) {
    return (
      <HouseSimulatorPage
        onBack={() => { window.location.href = window.location.pathname; }}
        surveyData={labEngineInput}
      />
    );
  }

  // ?print=<view> — render dedicated print layout.
  if (PRINT_VIEW === 'customer')   return <LabPrintCustomer />;
  if (PRINT_VIEW === 'technical')  return <LabPrintTechnical />;
  if (PRINT_VIEW === 'comparison') return <LabPrintComparison />;
  if (PRINT_VIEW === 'survey') {
    return (
      <RetiredRouteNotice backLabel="Open supporting PDF route →" onBack={() => { window.location.href = '/?visit-home=1'; }}>
        <p style={{ color: '#475569', marginBottom: 0 }}>
          The legacy survey print route is retired. Use the canonical supporting PDF route:
          {' '}
          <code>?library-pdf=1&amp;visitId=...</code>
        </p>
      </RetiredRouteNotice>
    );
  }

  return (
    <>
      {/* Cache-restore / stale-cache notice — shown briefly after a mobile reload */}
      {cacheNotice !== null && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '1rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: cacheNotice === 'stale' ? '#d97706' : '#2563eb',
            color: '#fff',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            zIndex: 9999,
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          }}
        >
          {cacheNotice === 'restored'
            ? 'Session restored'
            : 'Saved visit format changed — review recovered visit data before discarding'}
        </div>
      )}
      {visitRecoveryPrompt !== null && (
        <div
          role="dialog"
          aria-label="Recovered previous visit"
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '0.75rem',
            padding: '0.9rem',
            width: 'min(22rem, calc(100vw - 2rem))',
            zIndex: 10000,
            boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
          }}
        >
          <p style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>
            Recovered previous visit
          </p>
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: '#334155' }}>
            Visit survey saved {formatSavedAgo(visitRecoveryPrompt.updatedAt)}
            {visitRecoveryPrompt.restoredFromTemp ? ' (recovered from incomplete save)' : ''}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem' }}>
            <button
              type="button"
              className="next-btn"
              onClick={() => {
                setJourney('visit-home');
                setVisitRecoveryPrompt(null);
              }}
            >
              Resume saved visit
            </button>
            <button
              type="button"
              className="back-btn"
              onClick={() => {
                clearPersistedAtlasVisitV2(visitRecoveryPrompt.visitId);
                setLabFullSurveyModel(undefined);
                setLabEngineInput(undefined);
                setLabQuotes([]);
                setLabHeatLossState(undefined);
                setLabPrioritiesState(undefined);
                setVisitRecoveryPrompt(null);
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}
      {/* /report/:id — render a saved report by ID */}
      {journey === 'report' && activeReportId != null && (
        <ReportPage
          reportId={activeReportId}
          onBack={() => {
            setActiveReportId(null);
            // Return to Visit Home if a visit is active; otherwise return to landing.
            if (activeVisitId != null) {
              setJourney('visit-home');
            } else {
              setJourney('landing');
            }
          }}
          onDuplicated={(newId) => {
            setActiveReportId(newId);
          }}
        />
      )}
      {journey === 'fast' && <FastChoiceStepper onBack={() => setJourney('landing')} onEscalate={handleEscalate} onOpenLab={handleOpenLab} />}
      {/* Visit journey area — wrapped with BrandProvider driven by:
           1. activeAtlasVisit.brandId (highest priority — brand set at visit creation time)
           2. workspaceBrandSession.activeBrandId (workspace policy / user pref / route override)
           3. atlas-default (BrandProvider's built-in fallback)
           And VisitProvider to carry visit identity through the journey. */}
      <BrandProvider brandId={activeAtlasVisit?.brandId ?? workspaceBrandSession.activeBrandId}>
      <VisitProvider initialVisit={activeAtlasVisit}>
        {/* Visit Home Dashboard — front-door overview of all outputs for the active visit */}
        {journey === 'visit-home' && (() => {
          const resolveAcceptedScenario = (
            scenarios: import('./contracts/ScenarioResult').ScenarioResult[] | undefined,
            preferredScenarioId?: string,
            fallbackScenarioId?: string,
          ): import('./contracts/ScenarioResult').ScenarioResult | undefined => {
            if (scenarios == null || scenarios.length === 0) return undefined;
            if (preferredScenarioId != null) {
              const match = scenarios.find((scenario) => scenario.scenarioId === preferredScenarioId);
              if (match != null) return match;
            }
            if (fallbackScenarioId != null) {
              const normalizedFallbackId = fallbackScenarioId.toLowerCase();
              return scenarios.find((scenario) => scenario.scenarioId.toLowerCase() === normalizedFallbackId);
            }
            return undefined;
          };
          const canonicalSnapshot =
            activeVisitId != null && visitRecommendationSnapshot?.visitId === activeVisitId
              ? visitRecommendationSnapshot
              : null;
          const generatedOutputs = normaliseGeneratedOutputs(canonicalSnapshot?.generatedOutputs);
          const activeRecommendationSnapshotId = canonicalSnapshot?.recommendationSnapshot?.snapshotId;
          const generatedOutputDependencies = buildGeneratedOutputDependencyProjection(
            generatedOutputs,
            activeRecommendationSnapshotId,
          );
          const staleArtifacts = generatedOutputDependencies.filter((entry) => entry.generated && entry.stale);
          const hasStaleArtifacts = staleArtifacts.length > 0;
          const stalePortalOutput = isArtifactStaleForActiveSnapshot(
            generatedOutputs.portal,
            activeRecommendationSnapshotId,
          );
          const stalePdfOutput = isArtifactStaleForActiveSnapshot(
            generatedOutputs.pdf,
            activeRecommendationSnapshotId,
          );
          const staleJourneyPackOutput = isArtifactStaleForActiveSnapshot(
            generatedOutputs.customerJourneyPack,
            activeRecommendationSnapshotId,
          );
          const lifecycleState: VisitReviewLifecycleState =
            canonicalSnapshot?.lifecycleState ??
            deriveLifecycleStateFromSnapshot({
              recommendationReady: isRecommendationReadyForLifecycle({
                decision: canonicalSnapshot?.decision,
                customerSummary: canonicalSnapshot?.customerSummary,
                acceptedScenarioId: canonicalSnapshot?.acceptedScenarioId,
                engineRecommendationPrimary: canonicalSnapshot?.engineOutput?.recommendation?.primary,
              }),
              generatedOutputs,
            });
          let visitHomeEngineOutput: import('./contracts/EngineOutputV1').EngineOutputV1 | undefined;
          let visitHomeScenarios: import('./contracts/ScenarioResult').ScenarioResult[] | undefined;
          let visitHomeRecommendationSummary: import('./contracts/CustomerSummaryV1').CustomerSummaryV1 | undefined;
          let acceptedScenario: import('./contracts/ScenarioResult').ScenarioResult | undefined;

          if (canonicalSnapshot != null) {
            visitHomeEngineOutput = canonicalSnapshot.engineOutput;
            visitHomeScenarios = canonicalSnapshot.scenarios;
            visitHomeRecommendationSummary = canonicalSnapshot.customerSummary;
            acceptedScenario = resolveAcceptedScenario(
              visitHomeScenarios,
              canonicalSnapshot.acceptedScenarioId ?? canonicalSnapshot.decision?.recommendedScenarioId,
            );
            if (acceptedScenario == null) {
              acceptedScenario = resolveAcceptedScenario(
                visitHomeScenarios,
                canonicalSnapshot.decision?.recommendedScenarioId,
              );
            }
          }

          if (visitHomeEngineOutput == null && labEngineInput != null) {
            try {
              const { engineOutput } = runEngine(labEngineInput);
              visitHomeEngineOutput = engineOutput;
              visitHomeScenarios = buildScenariosFromEngineOutput(engineOutput);
            } catch {
              // Engine failed — both remain undefined; cards will show blocked status
            }
          }

          if (acceptedScenario == null) {
            acceptedScenario = resolveAcceptedScenario(
              visitHomeScenarios,
              undefined,
              visitHomeEngineOutput?.recommendation?.primary,
            );
          }

          const visitEnvelope =
            canonicalSnapshot == null
              ? undefined
              : buildVisitEnvelopeReadinessProjection({
                  visitId: canonicalSnapshot.visitId,
                  visitReference: canonicalSnapshot.visitReference,
                  surveySnapshot: labFullSurveyModel,
                  engineInputSnapshot: labEngineInput,
                  acceptedScenario,
                  selectedScenarioId: canonicalSnapshot.acceptedScenarioId,
                  decision: canonicalSnapshot.decision,
                  customerSummary: canonicalSnapshot.customerSummary,
                  engineOutput: canonicalSnapshot.engineOutput,
                  generatedOutputs,
                });

          // ── Local save check — whether this visitId has a localStorage snapshot ──
          const hasSavedLocalVisit =
            activeVisitId != null &&
            (() => {
              try {
                const result = readPersistedAtlasVisitV2(activeVisitId);
                return result.visit != null;
              } catch {
                return false;
              }
            })();
          const hasSurveyForSupportingPdf =
            labFullSurveyModel != null
            || hasSavedLocalVisit;
          const activeScanCapture =
            activeVisitId != null
              ? getScanCapture(activeVisitId)
              : null;
          const customerJourneyPackGenerated = generatedOutputs.customerJourneyPack?.generated === true;
          const workflowQaChecklist = buildWorkflowQaChecklist({
            hasImportedPackage: activeCanonicalPackage != null,
            canOpenScan: activeCanonicalPackage != null,
            hasScanReturn: activeScanCapture != null,
            hasRegeneratedDeliveryOutputs:
              generatedOutputs.portal.generated || generatedOutputs.pdf.generated || customerJourneyPackGenerated,
            hasExportedPackageAgain: lifecycleState === 'exported',
          });
          const canExportVisitPackage = !hasStaleArtifacts && canShowVisitHomeExportPackageAction({
            hasResolvedVisitId:
              activeVisitId != null || hasText(activeCanonicalPackage?.visitIdentity.visitId),
            hasExportableSurvey:
              labFullSurveyModel != null || activeCanonicalPackage?.surveyDraft != null,
            hasActiveCanonicalPackage: activeCanonicalPackage != null,
            hasActiveVisitId: activeVisitId != null,
            hasCanonicalSnapshot: canonicalSnapshot != null,
            hasRegeneratedDeliveryOutputs:
              generatedOutputs.portal.generated || generatedOutputs.pdf.generated || customerJourneyPackGenerated,
          });
          const customerPdfMissingRequirements: string[] = [];
          const canonicalVisitId = activeCanonicalPackage?.visitIdentity.visitId;
          const hasCanonicalVisitId = hasText(canonicalVisitId);
          const hasAnyRecommendationData =
            activeCanonicalPackage != null
            || activeVisitId != null
            || canonicalSnapshot != null
            || generatedOutputs.portal.generated
            || generatedOutputs.pdf.generated
            || customerJourneyPackGenerated;
          if (activeVisitId == null && !hasCanonicalVisitId) {
            customerPdfMissingRequirements.push('Visit identity is missing.');
          }
          if (labFullSurveyModel == null && activeCanonicalPackage?.surveyDraft == null) {
            customerPdfMissingRequirements.push('Visit survey data is missing.');
          }
          if (!hasAnyRecommendationData) {
            customerPdfMissingRequirements.push('Recommendation output is missing.');
          }
          if (hasStaleArtifacts) {
            customerPdfMissingRequirements.push(
              `Stale recommendation artifacts detected (${staleArtifacts.map((entry) => entry.artifact).join(', ')}). Regeneration required.`,
            );
          }
          const customerPdfUnavailableReasons =
            canExportVisitPackage
              ? []
              : customerPdfMissingRequirements.length > 0
                ? customerPdfMissingRequirements
                : ['Customer PDF package cannot be prepared from the current visit session.'];
          const preparedVisitHomePackage =
            canExportVisitPackage ? buildCanonicalVisitPackageForCurrentSession() : undefined;
          const visitHomeSourcePackage = activeCanonicalPackage
            ?? (
              preparedVisitHomePackage != null && 'pkg' in preparedVisitHomePackage
                ? preparedVisitHomePackage.pkg
                : undefined
            );
          const customerArtifactsState = buildVisitHomeCustomerArtifactsState({
            canExportVisitPackage,
            sourcePackage: visitHomeSourcePackage,
            unavailableReasons: customerPdfUnavailableReasons,
          });
          const packagedPortalEngineInput = resolvePackagedPortalEngineInput({
            liveEngineInput: labEngineInput,
            sourcePackage: visitHomeSourcePackage,
          });

          return (
            <>
              {import.meta.env.DEV && canonicalSnapshot?.recommendationSnapshot != null && (
                <div style={{
                  margin: '0 0 0.75rem',
                  padding: '0.75rem',
                  borderRadius: '0.75rem',
                  border: hasStaleArtifacts ? '1px solid #ef4444' : '1px solid #334155',
                  background: hasStaleArtifacts ? '#fef2f2' : '#f8fafc',
                  color: '#0f172a',
                  fontSize: '0.8rem',
                }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Active recommendation snapshot</div>
                  <div>snapshotId: {canonicalSnapshot.recommendationSnapshot.snapshotId}</div>
                  <div>createdAt: {canonicalSnapshot.recommendationSnapshot.createdAt}</div>
                  <div>regeneratedFrom: {canonicalSnapshot.recommendationSnapshot.regeneratedFrom ?? 'none'}</div>
                  <div>sourceVisitRevision: {canonicalSnapshot.recommendationSnapshot.sourceVisitRevision}</div>
                  <div>checksum: {canonicalSnapshot.recommendationSnapshot.checksum}</div>
                  <div style={{ marginTop: '0.45rem', fontWeight: 600 }}>Artifact lineage</div>
                  {generatedOutputDependencies.map((entry) => (
                    <div key={entry.artifact}>
                      {entry.artifact}: {entry.generated ? 'generated' : 'not generated'}
                      {entry.artifactSnapshotId ? ` · snapshot=${entry.artifactSnapshotId}` : ' · snapshot=missing'}
                      {entry.generated ? ` · ${entry.stale ? 'STALE (blocked)' : 'valid'}` : ''}
                    </div>
                  ))}
                </div>
              )}
              <VisitHomeDashboard
              visitId={activeVisitId}
              engineInput={labEngineInput}
              engineOutput={visitHomeEngineOutput}
              scenarios={visitHomeScenarios}
              acceptedScenario={acceptedScenario}
              recommendationSummary={visitHomeRecommendationSummary}
              surveyModel={labFullSurveyModel}
              lifecycleState={lifecycleState}
              visitEnvelope={visitEnvelope}
              generatedOutputs={generatedOutputs}
              hasSupportingPdfOutput={(!stalePdfOutput && generatedOutputs.pdf.generated) || customerArtifactsState.customerPdfReady}
              portalUrl={!stalePortalOutput ? (generatedOutputs.portal.url ?? labPortalUrl) : undefined}
              installationSpecOptionCount={labInstallationSpecifications.length}
              workspaceRole={workspaceSettingsMembership?.role}
              workspacePermissions={workspaceSettingsMembership?.permissions}
              supportingPdfUnsafe={!customerArtifactsState.customerPdfReady}
              supportingPdfBlockReasons={
                customerArtifactsState.customerPdfBlockReasons.length > 0
                  ? customerArtifactsState.customerPdfBlockReasons
                  : undefined
              }
              lastSurface={lastOpenedFromHome?.label}
              onContinueLastSurface={lastOpenedFromHome != null ? () => setJourney(lastOpenedFromHome.journey) : undefined}
              hasSavedLocalVisit={hasSavedLocalVisit}
              onImportScanPackage={() => setJourney('receive-scan')}
              onImportWorkflowPackage={(file) => {
                void handleImportCanonicalVisitPackage(file, 'visit_home_import');
              }}
              onExportPackage={canExportVisitPackage ? handleExportCanonicalVisitPackage : undefined}
              onSaveLocally={activeVisitId != null && labFullSurveyModel != null ? handleSaveVisitLocally : undefined}
              onResumeLocalVisit={activeVisitId != null ? handleResumeLocalVisit : undefined}
              localSessionStatus={localSessionStatus}
              packageOpenHistory={packageOpenHistory}
              lastImportFailure={lastImportFailure}
              hasInterruptedScanReturn={activeScanCapture != null && !generatedOutputs.handoff.generated}
              onRecoverInterruptedScanReturn={activeVisitId != null ? () => setJourney('receive-scan') : undefined}
              workflowQaChecklist={workflowQaChecklist}
              devBuildMarker={import.meta.env.DEV ? `Dev build · ${new Date().toISOString().slice(0, 10)}` : undefined}
              onClearSession={() => {
                setActiveVisitId(undefined);
                setActiveVisitMeta(null);
                setLastOpenedFromHome(null);
                setLabEngineInput(undefined);
                setLabFullSurveyModel(undefined);
                setVisitRecommendationSnapshot(null);
                setLabPortalVisitContext(undefined);
                setLabPortalUrl(undefined);
                setLocalSessionStatus(null);
                setLastImportFailure(null);
                setActiveCanonicalPackage(null);
                setActivePortalLaunchPayload(null);
                setJourney('app-home');
              }}
              onOpenExistingVisit={() => setJourney('app-home')}
              onContinueSurvey={activeVisitId != null ? () => setJourney('visit') : undefined}
              onRunRecommendation={activeVisitId != null ? handleGenerateRecommendation : undefined}
              onGenerateCustomerPortal={activeVisitId != null ? () => { void handleGenerateCustomerPortal(); } : undefined}
              onDownloadCustomerPdf={customerArtifactsState.customerPdfReady ? handleExportCanonicalVisitPackage : undefined}
              onOpenPortalFromPackage={customerArtifactsState.canOpenPortalFromPackage ? () => {
                if (visitHomeSourcePackage == null || customerArtifactsState.portalLaunchPayload == null) {
                  setLocalSessionStatus({
                    tone: 'error',
                    message: 'Unable to launch portal: missing visit ID or survey data. Open Visit Home, generate recommendation, then retry.',
                  });
                  return;
                }
                const payload = customerArtifactsState.portalLaunchPayload;
                setActiveCanonicalPackage(visitHomeSourcePackage);
                setActivePortalLaunchPayload(payload);
                if (payload.generatedOutputMetadata.hasPortalUrl && payload.generatedOutputMetadata.portalUrl != null) {
                  // Validate that the URL is a safe absolute HTTP/HTTPS URL before opening it.
                  // This prevents javascript: URLs or other injected schemes from compromised packages.
                  try {
                    const parsed = new URL(payload.generatedOutputMetadata.portalUrl);
                    if (parsed.protocol === 'https:' || (import.meta.env.DEV && parsed.protocol === 'http:')) {
                      openUrlInSystemBrowser(payload.generatedOutputMetadata.portalUrl);
                      return;
                    }
                  } catch {
                    // URL parse failure — fall through to in-app journey
                  }
                }
                if (packagedPortalEngineInput != null) {
                  setLastOpenedFromHome({ label: 'Customer portal (package)', journey: 'portal-from-package' });
                  setJourney('portal-from-package');
                } else {
                  setLocalSessionStatus({
                    tone: 'error',
                    message: payload.rebuildRequired
                      ? `Portal rebuild required: ${payload.rebuildWarning ?? 'Journey content unavailable.'}`
                      : 'Portal content is packaged but engine input is missing. Re-import the package to restore it.',
                  });
                }
              } : undefined}
              onOpenScanFromPackage={activeCanonicalPackage != null ? () => {
                handleOpenScanFromCanonicalPackage('visit-home');
              } : undefined}
              onStartDemoReview={import.meta.env.DEV ? handleStartDemoReview : undefined}
              onOpenDemoFixtures={import.meta.env.DEV ? () => setJourney('app-home') : undefined}
              visitSelectorEntries={visitSelectorEntries}
              onSelectVisit={(visitId) => {
                setActiveVisitId(visitId);
                const demoVisitIdSet = import.meta.env.DEV
                  ? new Set<string>(Object.values(DEMO_VISIT_IDS))
                  : new Set<string>();
                if (demoVisitIdSet.has(visitId)) {
                  handleStartDemoReview(visitId);
                  return;
                }
                const restored = readPersistedAtlasVisitV2(visitId);
                if (restored.visit != null) {
                  const generatedOutputs = enrichGeneratedOutputsWithCustomerJourneyPack({
                    generatedOutputs: restored.visit.generatedOutputs,
                    surveyModel: restored.visit.survey,
                    engineInput: restored.visit.engineInputSnapshot,
                    customerSummary: restored.visit.customerSummary,
                    decision: restored.visit.decision,
                    activeSnapshotId: restored.visit.recommendationSnapshot?.snapshotId,
                    portalVisitContext: restored.visit.portalVisitContext,
                    generatedAt: restored.visit.updatedAt,
                    scenarios: restored.visit.scenarios,
                  });
                  const recommendationReady = isRecommendationReadyForLifecycle({
                    decision: restored.visit.decision,
                    customerSummary: restored.visit.customerSummary,
                    acceptedScenarioId: restored.visit.acceptedScenarioId,
                    engineRecommendationPrimary: restored.visit.engine?.recommendation?.primary,
                  });
                  const lifecycleState =
                    restored.visit.lifecycleState ??
                    deriveLifecycleStateFromSnapshot({
                      recommendationReady,
                      generatedOutputs,
                    });
                  setLabFullSurveyModel(restored.visit.survey);
                  setLabPortalVisitContext(restored.visit.portalVisitContext);
                  setLabPortalUrl(generatedOutputs.portal.url);
                  setVisitRecommendationSnapshot({
                    visitId: restored.visit.visitId,
                    visitReference: restored.visit.visitReference,
                    recommendationSnapshot: restored.visit.recommendationSnapshot,
                    engineOutput: restored.visit.engine,
                    scenarios: restored.visit.scenarios,
                    decision: restored.visit.decision,
                    customerSummary: restored.visit.customerSummary,
                    acceptedScenarioId: restored.visit.acceptedScenarioId,
                    lifecycleState,
                    generatedOutputs,
                    portalVisitContext: restored.visit.portalVisitContext,
                  });
                  if (restored.visit.engineInputSnapshot != null) {
                    setLabEngineInput(restored.visit.engineInputSnapshot);
                  } else {
                    try {
                      setLabEngineInput(toEngineInput(sanitiseModelForEngine(restored.visit.survey)));
                    } catch {
                      setLabEngineInput(undefined);
                    }
                  }
                } else {
                  setVisitRecommendationSnapshot(null);
                  setLabPortalUrl(undefined);
                }
                setJourney('visit-home');
              }}
              onOpenSimulator={() => {
                if (activeVisitId != null && labFullSurveyModel != null) {
                  const currentSnapshot = visitRecommendationSnapshot?.visitId === activeVisitId ? visitRecommendationSnapshot : null;
                  const activeSnapshotId = currentSnapshot?.recommendationSnapshot?.snapshotId;
                  if (!hasText(activeSnapshotId)) {
                    setLocalSessionStatus({
                      tone: 'error',
                      message: 'Simulator blocked: stale or missing recommendation snapshot. Regenerate recommendation first.',
                    });
                    return;
                  }
                  const currentOutputs = normaliseGeneratedOutputs(currentSnapshot?.generatedOutputs);
                  const nextSnapshot: VisitRecommendationSnapshot = {
                    visitId: activeVisitId,
                    visitReference: resolveVisitSessionReference(activeVisitMeta, activeVisitId),
                    recommendationSnapshot: currentSnapshot?.recommendationSnapshot,
                    engineOutput: currentSnapshot?.engineOutput,
                    scenarios: currentSnapshot?.scenarios,
                    decision: currentSnapshot?.decision,
                    customerSummary: currentSnapshot?.customerSummary,
                    acceptedScenarioId: currentSnapshot?.acceptedScenarioId,
                    lifecycleState: dispatchVisitJourneyEvent(
                      currentSnapshot?.lifecycleState,
                      { type: 'presentation_generated' },
                    ),
                    generatedOutputs: {
                      ...currentOutputs,
                      simulatorReview: {
                        generated: true,
                        generatedAt: new Date().toISOString(),
                        snapshotId: activeSnapshotId,
                        version: '1.0',
                      },
                    },
                    portalVisitContext: currentSnapshot?.portalVisitContext ?? labPortalVisitContext,
                  };
                  persistActiveVisitSnapshot(nextSnapshot, labFullSurveyModel);
                }
                setLastOpenedFromHome({ label: 'Simulator', journey: 'house-simulator' });
                setSimulatorFromJourney('visit-home');
                setJourney('house-simulator');
              }}
              onOpenPresentation={() => {
                setLastOpenedFromHome({ label: 'Presentation', journey: 'presentation' });
                setPresentationFromJourney('visit-home');
                setJourney('presentation');
              }}
              onPrintSummary={visitHomeEngineOutput != null && hasSurveyForSupportingPdf && !stalePdfOutput && !staleJourneyPackOutput ? () => {
                if (activeVisitId == null) {
                  setLocalSessionStatus({
                    tone: 'error',
                    message: 'Supporting PDF route requires a visit ID. Open a visit and retry.',
                  });
                  return;
                }
                setLastOpenedFromHome({ label: 'Library supporting PDF', journey: 'library-pdf' });
                if (typeof window !== 'undefined') {
                  const nextUrl = new URL(window.location.href);
                  nextUrl.searchParams.set('library-pdf', '1');
                  nextUrl.searchParams.set('visitId', activeVisitId);
                  nextUrl.searchParams.delete('visit-home');
                  const opened = window.open(nextUrl.toString(), '_blank', 'noopener,noreferrer');
                  if (opened != null) return;
                  window.location.href = nextUrl.toString();
                  return;
                }
                setLocalSessionStatus({
                  tone: 'error',
                  message: 'Supporting PDF route requires a visit ID. Open a visit and retry.',
                });
              } : undefined}
              onOpenInstallationSpecification={() => {
                setLastOpenedFromHome({ label: 'Specification', journey: 'installation-specification' });
                setJourney('installation-specification');
              }}
              onOpenHandoffReview={activeVisitId != null ? () => {
                if (activeVisitId != null && labFullSurveyModel != null) {
                  const currentSnapshot = visitRecommendationSnapshot?.visitId === activeVisitId ? visitRecommendationSnapshot : null;
                  const activeSnapshotId = currentSnapshot?.recommendationSnapshot?.snapshotId;
                  if (!hasText(activeSnapshotId)) {
                    setLocalSessionStatus({
                      tone: 'error',
                      message: 'Handoff blocked: stale or missing recommendation snapshot. Regenerate recommendation first.',
                    });
                    return;
                  }
                  const currentOutputs = normaliseGeneratedOutputs(currentSnapshot?.generatedOutputs);
                  const nextSnapshot: VisitRecommendationSnapshot = {
                    visitId: activeVisitId,
                    visitReference: resolveVisitSessionReference(activeVisitMeta, activeVisitId),
                    recommendationSnapshot: currentSnapshot?.recommendationSnapshot,
                    engineOutput: currentSnapshot?.engineOutput,
                    scenarios: currentSnapshot?.scenarios,
                    decision: currentSnapshot?.decision,
                    customerSummary: currentSnapshot?.customerSummary,
                    acceptedScenarioId: currentSnapshot?.acceptedScenarioId,
                    lifecycleState: dispatchVisitJourneyEvent(
                      currentSnapshot?.lifecycleState,
                      { type: 'handoff_prepared' },
                    ),
                    generatedOutputs: {
                      ...currentOutputs,
                      handoff: {
                        generated: true,
                        generatedAt: new Date().toISOString(),
                        snapshotId: activeSnapshotId,
                        version: '1.0',
                      },
                    },
                    portalVisitContext: currentSnapshot?.portalVisitContext ?? labPortalVisitContext,
                  };
                  persistActiveVisitSnapshot(nextSnapshot, labFullSurveyModel);
                }
                setLastOpenedFromHome({ label: 'Handoff Review', journey: 'visit-handoff' });
                void handleOpenHandoffReview(activeVisitId);
              } : undefined}
              onOpenEngineerRoute={activeVisitId != null ? () => {
                setLastOpenedFromHome({ label: 'Engineer Route', journey: 'engineer' });
                setJourney('engineer');
              } : undefined}
              onBack={() => setJourney('app-home')}
            />
            </>
          );
        })()}
        {/* Atlas Scan receive — opened from Visit Hub to import a scan from the iOS app.
             After a successful import, navigate to /workspace so the engineer can review
             the captured evidence.  The scan session is already persisted to IDB at this
             point; /workspace lists all local sessions and opens the evidence review. */}
        {journey === 'receive-scan' && (
          <ReceiveScanPage
            onImported={(draft) => {
              setLabFullSurveyModel(draft as unknown as FullSurveyModelV1);
              setJourney(activeVisitId != null ? 'visit-home' : 'workspace-dashboard');
            }}
            onCancel={() => setJourney(activeVisitId != null ? 'visit-home' : 'workspace-dashboard')}
          />
        )}
        {/* External visit file manifest — opened from Visit Hub to attach file references. */}
        {journey === 'external-files' && activeVisitId != null && (
          <ExternalVisitManifestPanel
            visitId={activeVisitId}
            tenantId={hostResolution.workspaceSlug ?? 'default'}
            onClose={() => setJourney('visit-home')}
          />
        )}
        {/* Installation Specification — opened from Visit Home or QuoteCollectionStep */}
        {journey === 'installation-specification' && (
          <SpecificationErrorBoundary onBack={() => setJourney(activeVisitId != null ? 'visit-home' : 'landing')}>
            <Suspense fallback={specificationLoadingFallback}>
              <InstallationSpecificationPage
                onBack={() => setJourney(activeVisitId != null ? 'visit-home' : 'landing')}
                canonicalCurrentSystem={canonicalCurrentSystem}
                visitId={activeVisitId ?? undefined}
                origin="direct"
                existingOptions={labInstallationSpecifications.length > 0 ? labInstallationSpecifications : undefined}
                onSave={(option) => {
                  setLabInstallationSpecifications((prev) => {
                    const idx = prev.findIndex((o) => o.id === option.id);
                    if (idx >= 0) {
                      const updated = [...prev];
                      updated[idx] = option;
                      return updated;
                    }
                    return [...prev, option];
                  });
                }}
                onFinish={() => { setJourney(activeVisitId != null ? 'visit-home' : 'landing'); }}
              />
            </Suspense>
          </SpecificationErrorBoundary>
        )}
        {/* Completed-visit handoff review — reachable from Visit Home after completion */}
        {journey === 'visit-handoff' && (
          <VisitHandoffReviewPage
            initialPack={activeHandoffPack ?? undefined}
            visitCompleted={true}
            onBack={() => setJourney('visit-home')}
          />
        )}
        {/* Engineer pre-install route — /visit/:visitId/engineer */}
        {journey === 'engineer' && activeVisitId != null && (
          <EngineerPreinstallPage
            visitId={activeVisitId}
            onBack={() => setJourney('visit-home')}
          />
        )}
      {journey === 'visit' && activeVisitId != null && (
        <VisitPage
          visitId={activeVisitId}
          onBack={() => setJourney('visit-home')}
          onDraft={(draft) => {
            // Capture heatLoss and priorities from the visit survey draft so
            // the presentation deck can show the house snapshot and selected
            // priority chips — mirrors the same pattern used by the 'remote-survey' journey.
            if (draft.fullSurvey?.heatLoss) setLabHeatLossState(draft.fullSurvey.heatLoss);
            if (draft.fullSurvey?.priorities) setLabPrioritiesState(draft.fullSurvey.priorities);
            if (draft.fullSurvey?.quotes) setLabQuotes(draft.fullSurvey.quotes);
            // Capture the full survey model so the Installation Specification
            // stepper can display the canonical current-system summary.
            setLabFullSurveyModel(draft);
          }}
          onVisitMetaChange={setActiveVisitMeta}
          onComplete={(engineInput) => {
            // Survey is complete — store engine input for presentation/simulator use,
            // then route to Visit Home so the surveyor has a clear overview of all
            // available outputs before accessing handoff tools.
            setLabEngineInput(engineInput);
            if (activeAtlasVisit) {
              trackVisitCompleted(activeAtlasVisit);
            }
            setJourney('visit-home');
          }}
          onOpenSimulator={(engineInput) => {
            // Direct shortcut from InsightLayerPage — skip fit-map.
            setLabEngineInput(engineInput);
            setSimulatorFromJourney('visit');
            setJourney('simulator');
          }}
          onOpenInsightPack={(engineInput, quotes) => {
            setLabEngineInput(engineInput);
            setLabQuotes(quotes);
            setJourney('visit-home');
          }}
          onOpenFloorPlan={(surveyResults) => {
            const preferCombi = (surveyResults as { preferCombi?: boolean }).preferCombi;
            setFloorPlanSystemType(preferCombi ? 'combi' : 'system');
            setJourney('floor-plan');
          }}
          onOpenHandoffReview={() => { void handleOpenHandoffReview(activeVisitId!); }}
          onOpenInstallationSpecification={() => setJourney('installation-specification')}
          onExitSurvey={() => setJourney('visit-home')}
          onReopenVisit={activeVisitId != null ? async () => {
            try {
              await saveVisit(activeVisitId, { completed_at: null, completion_method: null });
              setJourney('visit-home');
            } catch (err) {
              console.error('[Atlas] Could not reopen visit:', err);
            }
          } : undefined}
          floorplanOutput={floorplanOutput}
        />
      )}
      </VisitProvider>
      </BrandProvider>
      {journey === 'remote-survey' && (
        <FullSurveyStepper
          onBack={() => { setFullSurveyPrefill(undefined); setJourney('landing'); }}
          prefill={fullSurveyPrefill}
          onDraft={(draft) => {
            // Capture heatLoss, priorities and recommendation as they are
            // updated during the survey so they are available for the
            // presentation and printout layers.
            if (draft.fullSurvey?.heatLoss) setLabHeatLossState(draft.fullSurvey.heatLoss);
            if (draft.fullSurvey?.priorities) setLabPrioritiesState(draft.fullSurvey.priorities);
            if (draft.fullSurvey?.recommendation) setLabRecommendationState(draft.fullSurvey.recommendation);
            if (draft.fullSurvey?.quotes) setLabQuotes(draft.fullSurvey.quotes);
            // Capture the full survey model so the Installation Specification
            // stepper can display the canonical current-system summary.
            setLabFullSurveyModel(draft);
          }}
          onComplete={(engineInput) => {
            // Route directly to simulator — fit-map step removed.
            setFullSurveyPrefill(undefined);
            setLabEngineInput(engineInput);
            setSimulatorFromJourney('remote-survey');
            setJourney('simulator');
          }}
          onOpenSimulator={(engineInput) => {
            // Direct shortcut from InsightLayerPage — skip fit-map.
            setFullSurveyPrefill(undefined);
            setLabEngineInput(engineInput);
            setSimulatorFromJourney('remote-survey');
            setJourney('simulator');
          }}
          onOpenInsightPack={(engineInput, quotes) => {
            setFullSurveyPrefill(undefined);
            setLabEngineInput(engineInput);
            setLabQuotes(quotes);
            if (activeVisitId == null || typeof window === 'undefined') {
              setLocalSessionStatus({
                tone: 'error',
                message: 'Supporting PDF route requires an active visit ID.',
              });
              setJourney('visit-home');
              return;
            }
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set('library-pdf', '1');
            nextUrl.searchParams.set('visitId', activeVisitId);
            nextUrl.searchParams.delete('visit-home');
            window.location.href = nextUrl.toString();
          }}
          onOpenFloorPlan={(surveyResults) => {
            const preferCombi = (surveyResults as { preferCombi?: boolean }).preferCombi;
            setFloorPlanSystemType(preferCombi ? 'combi' : 'system');
            setJourney('floor-plan');
          }}
        />
      )}
      {journey === 'scope' && <ScopePage onBack={() => setJourney('landing')} />}
      {journey === 'methodology' && <MethodologyPage onBack={() => setJourney('landing')} />}
      {journey === 'neutrality' && <NeutralityPage onBack={() => setJourney('landing')} />}
      {journey === 'privacy' && <PrivacyPage onBack={() => setJourney('landing')} />}
      {journey === 'lab-quick-inputs' && (
        <LabQuickInputsPanel
          initialInput={labPartialInput}
          missingFields={getMissingLabFields(labPartialInput)}
          onComplete={(completed) => {
            setLabEngineInput(completed);
            setJourney('simulator');
          }}
          onCancel={() => setJourney('landing')}
        />
      )}
      {journey === 'simulator' && (
        <HouseSimulatorPage
          onBack={() => setJourney(simulatorFromJourney)}
          surveyData={labEngineInput}
        />
      )}
      {journey === 'house-simulator' && (
        <HouseSimulatorPage
          onBack={() => setJourney(simulatorFromJourney)}
          surveyData={labEngineInput}
        />
      )}
      {/* Legacy dev-only route — VisitHomeUnifiedSimulatorRoute is no longer reached from
          Visit Home. Retained here for dev/diagnostic access only. */}
      {journey === 'unified-simulator' && (
        <GlobalMenuShell>
          <VisitHomeUnifiedSimulatorRoute
            engineInput={labEngineInput}
            surveyModel={labFullSurveyModel}
            floorplanOutput={floorplanOutput}
            onBack={() => setJourney(simulatorFromJourney)}
            backLabel={simulatorFromJourney}
          />
        </GlobalMenuShell>
      )}
      {journey === 'lab' && <LabShell onHome={() => setJourney('landing')} engineInput={labEngineInput} />}
      {journey === 'presentation' && labEngineInput != null && (
        <CanonicalPresentationRoute
          engineInput={labEngineInput}
          onBack={() => setJourney(presentationFromJourney)}
          onOpenSimulator={() => setJourney('simulator')}
          onPrint={handleExportCanonicalVisitPackage}
          heatLossState={labHeatLossState}
          prioritiesState={labPrioritiesState}
        />
      )}
      {/* Portal from package — opens the canonical portal experience (CustomerPortalPage)
          using the packaged engine input and CustomerJourneyPackV1 content.
          This consumes the packaged CustomerJourneyPackV1 directly so the portal
          shows the same content that was embedded in the exported PDF.
          Back returns to visit-home. */}
      {journey === 'portal-from-package' && (() => {
        if (activePortalLaunchPayload?.generatedOutputMetadata.staleSnapshotBlocked === true) {
          return (
            <RetiredRouteNotice backLabel="Back to Visit Home →" onBack={() => setJourney('visit-home')} title="Portal blocked">
              <p style={{ color: '#475569', marginBottom: 0 }}>
                Packaged portal artifact is stale for the active recommendation snapshot. Regenerate recommendation outputs first.
              </p>
            </RetiredRouteNotice>
          );
        }
        const portalEngineInput = resolvePackagedPortalEngineInput({
          liveEngineInput: labEngineInput,
          sourcePackage: activeCanonicalPackage ?? undefined,
        });
        if (portalEngineInput == null) {
          return null;
        }
        const packagedCustomerJourneyPack =
          activeCanonicalPackage != null
            ? readCustomerJourneyPackFromGeneratedOutputs(
                activeCanonicalPackage.generatedOutputStatus?.generatedOutputs,
              )
            : undefined;
        return (
          <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ padding: '0.5rem 1rem' }}>
              <button className="back-btn" onClick={() => setJourney('visit-home')}>← Back</button>
            </div>
            <CustomerPortalPage
              reference={visitRecommendationSnapshot?.visitReference ?? formatVisitReference(activeVisitId ?? '')}
              productionPreviewInput={portalEngineInput}
              productionPreviewCustomerJourneyPack={packagedCustomerJourneyPack}
            />
          </div>
        );
      })()}
      {journey === 'portal-from-package' && resolvePackagedPortalEngineInput({
        liveEngineInput: labEngineInput,
        sourcePackage: activeCanonicalPackage ?? undefined,
      }) == null && (() => {
        const reimportNote = 'Re-import the visit package to restore portal content.';
        const unavailableMessage = activePortalLaunchPayload?.rebuildRequired === true
          ? `Rebuild required: ${activePortalLaunchPayload.rebuildWarning ?? reimportNote}`
          : `No recommendation data is available for this visit. ${reimportNote}`;
        return (
          <RetiredRouteNotice backLabel="Back to Visit Home →" onBack={() => setJourney('visit-home')} title="Portal unavailable">
            <p style={{ color: '#475569', marginBottom: 0 }}>{unavailableMessage}</p>
          </RetiredRouteNotice>
        );
      })()}
      {journey === 'printout' && (
        <RetiredRouteNotice
          backLabel="Open supporting PDF →"
          onBack={() => {
            if (activeVisitId == null) {
              setJourney('visit-home');
              return;
            }
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set('library-pdf', '1');
            nextUrl.searchParams.set('visitId', activeVisitId);
            nextUrl.searchParams.delete('visit-home');
            window.location.href = nextUrl.toString();
          }}
        >
          <p style={{ color: '#475569', marginBottom: 0 }}>
            This legacy printout route has been retired. Use the Supporting PDF route.
          </p>
        </RetiredRouteNotice>
      )}
      {journey === 'framework-print' && (
        <RetiredRouteNotice
          backLabel="Open canonical PDF →"
          onBack={() => {
            if (activeVisitId == null) {
              setJourney('visit-home');
              return;
            }
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set('library-pdf', '1');
            nextUrl.searchParams.set('visitId', activeVisitId);
            nextUrl.searchParams.delete('visit-home');
            window.location.href = nextUrl.toString();
          }}
        >
          <p style={{ color: '#475569', marginBottom: 0 }}>
            This legacy framework print route is retired. Use the canonical library-backed supporting PDF.
          </p>
        </RetiredRouteNotice>
      )}
      {/* Library supporting PDF — library-backed print output for Visit Home (replaces legacy framework-print from visit-home path) */}
      {journey === 'library-pdf' && (() => {
        if (!LIBRARY_PDF_ENABLED) {
          return (
            <RetiredRouteNotice backLabel="Back to Visit Home →" onBack={() => setJourney('visit-home')} title="Supporting PDF route moved">
              <p style={{ color: '#475569', marginBottom: 0 }}>
                Open the canonical customer PDF route with:
                {' '}
                <code>?library-pdf=1&amp;visitId=...</code>
              </p>
            </RetiredRouteNotice>
          );
        }
        const bootState = libraryPdfBootState;
        const explicitVisitId = hasText(INITIAL_VISIT_ID_PARAM)
          ? INITIAL_VISIT_ID_PARAM
          : undefined;
        if (
          bootState == null
          || bootState.status === 'loading_visit'
          || bootState.status === 'rebuilding_customer_pack'
        ) {
          return (
            <RetiredRouteNotice backLabel="Back to Visit Home →" onBack={() => setJourney('visit-home')} title="Preparing supporting PDF">
              <p role="status" aria-live="polite" style={{ color: '#475569', marginBottom: 0 }}>
                Loading visit and rebuilding customer journey pack…
              </p>
            </RetiredRouteNotice>
          );
        }
        if (bootState.status === 'visit_not_found' || bootState.status === 'blocked') {
          return (
            <RetiredRouteNotice backLabel="Back to Visit Home →" onBack={() => setJourney('visit-home')} title="Supporting PDF blocked">
              <p style={{ color: '#475569', marginBottom: 0 }}>
                {bootState.message}
              </p>
            </RetiredRouteNotice>
          );
        }
        if (bootState.status === 'recommendation_missing') {
          return (
            <RetiredRouteNotice backLabel="Back to Visit Home →" onBack={() => setJourney('visit-home')} title="Supporting PDF unavailable">
              <p style={{ color: '#475569', marginBottom: '0.75rem' }}>
                {bootState.message}
              </p>
              <button className="back-btn" onClick={() => setJourney('visit-home')}>
                Open visit
              </button>
            </RetiredRouteNotice>
          );
        }
        if (bootState.status !== 'ready') {
          return (
            <RetiredRouteNotice backLabel="Back to Visit Home →" onBack={() => setJourney('visit-home')} title="Supporting PDF blocked">
              <p style={{ color: '#475569', marginBottom: 0 }}>
                Customer PDF could not be prepared because this visit could not be loaded.
              </p>
            </RetiredRouteNotice>
          );
        }
        const printModel = bootState.printModel;
        if (printModel == null) {
          return (
            <RetiredRouteNotice backLabel="Back to Visit Home →" onBack={() => setJourney('visit-home')} title="Supporting PDF blocked">
              <p style={{ color: '#475569', marginBottom: 0 }}>
                Customer PDF could not be prepared because this visit data is incomplete.
              </p>
            </RetiredRouteNotice>
          );
        }
        const debugVisitName =
          activeVisitMeta?.visit_reference
          ?? activeVisitMeta?.customer_name
          ?? bootState.source.source.visitReference;
        const debugRecommendationId = bootState.source.source.acceptedScenarioId;
        const debugSceneCount = printModel.sections.length;
        const fallbackOnlyCustomerPdf = isFallbackOnlyCustomerPdf(printModel);
        // Strict entry with explicit visitId must never render fallback-only PDFs,
        // and production blocks fallback-only PDFs for all entry paths.
        const shouldBlockFallbackPdf = fallbackOnlyCustomerPdf && (!import.meta.env.DEV || explicitVisitId != null);
        if (shouldBlockFallbackPdf) {
          return (
            <RetiredRouteNotice backLabel="Back to Visit Home →" onBack={() => setJourney('visit-home')} title="Supporting PDF blocked">
              <p style={{ color: '#475569', marginBottom: 0 }}>
                Customer PDF blocked: this package does not yet meet customer story quality checks. Regenerate recommendation outputs and export again.
              </p>
            </RetiredRouteNotice>
          );
        }
        return (
          <div
            style={{ background: '#f8fafc', minHeight: '100vh' }}
            data-testid="library-pdf-route"
          >
            <div
              style={{
                padding: '0.5rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                borderBottom: '1px solid #e2e8f0',
                background: '#fff',
              }}
              data-testid="library-pdf-header"
            >
              <button
                className="back-btn"
                onClick={() => setJourney('visit-home')}
                data-testid="library-pdf-back"
              >
                ← Back
              </button>
              <span
                style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}
                data-testid="library-pdf-workspace-marker"
              >
                Library supporting PDF — review workspace
              </span>
              <button
                style={{ marginLeft: 'auto' }}
                className="back-btn"
                onClick={() => window.print()}
                data-testid="library-pdf-print-btn"
              >
                Print / Save as PDF
              </button>
            </div>
            {import.meta.env.DEV && (
              <div
                style={{
                  margin: '0.75rem 1rem 0',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '0.5rem',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '0.75rem',
                  padding: '0.55rem 0.75rem',
                }}
                data-testid="library-pdf-source-debug"
              >
                pdfSource: hydratedVisit · visitName: {debugVisitName} · recommendationId: {debugRecommendationId} · sceneCount: {debugSceneCount} · renderer: CustomerScenePrint
              </div>
            )}
            <PortalJourneyPrintPack model={printModel} />
          </div>
        );
      })()}
      {journey === 'insight-pack' && labEngineInput != null && labQuotes.length > 0 && (() => {
        const { engineOutput } = runEngine(labEngineInput);
        const surveyContext: InsightPackSurveyContext = {
          currentBoiler: labEngineInput.currentSystem?.boiler,
          occupancyCount: labEngineInput.occupancyCount,
          bathroomCount: labEngineInput.bathroomCount,
          peakConcurrentOutlets: labEngineInput.peakConcurrentOutlets,
          mainsDynamicFlowLpm: labEngineInput.mainsDynamicFlowLpm,
          heatLossWatts: labEngineInput.heatLossWatts,
          solarPVPresent: labEngineInput.pvStatus === 'existing' || labEngineInput.pvStatus === 'planned',
        };
        const ipScenarios = buildScenariosFromEngineOutput(engineOutput);
        const ipDecision = ipScenarios.length > 0
          ? buildDecisionFromScenarios({
              scenarios: ipScenarios,
              boilerType: toLifecycleBoilerType(labEngineInput.currentHeatSourceType),
              ageYears: labEngineInput.currentSystem?.boiler?.ageYears ?? 10,
              occupancyCount: labEngineInput.occupancyCount,
              bathroomCount: labEngineInput.bathroomCount,
              showerCompatibilityNote: engineOutput.showerCompatibilityNote,
            })
          : undefined;
        const pack = buildInsightPackFromEngine(
          engineOutput,
          labQuotes,
          surveyContext,
          ipDecision,
          ipScenarios.length > 0 ? ipScenarios : undefined,
        );
        return (
          <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ padding: '0.5rem 1rem' }}>
              <button className="back-btn" onClick={() => setJourney(insightPackFromJourney)}>
                ← Back
              </button>
            </div>
            <InsightPackDeck
              pack={pack}
              propertyTitle={labEngineInput.postcode ?? undefined}
              onClose={() => setJourney(insightPackFromJourney)}
            />
          </div>
        );
      })()}
      {journey === 'gallery' && (
        <div style={{ background: 'var(--surface-page, #f8fafc)', minHeight: '100vh' }}>
          <PhysicsVisualGallery onBack={() => setJourney('landing')} />
        </div>
      )}
      {journey === 'dev-menu' && (
        <DevMenuPage
          onBack={() => setJourney('landing')}
          onLoadDemoWorkspace={() => setJourney('workspace-dashboard')}
        />
      )}
      {journey === 'explorer' && EXPLORER_ENABLED && <AtlasExplorerPage onBack={() => setJourney('landing')} />}
      {journey === 'floor-plan' && (
        <div className="floor-plan-page">
          <div className="floor-plan-page__header">
            <button
              className="floor-plan-page__back"
              onClick={() => setJourney('landing')}
              aria-label="Back to home"
            >
              ← Back
            </button>
          </div>
          <FloorPlanBuilder
            surveyResults={{
              systemType: floorPlanSystemType,
            }}
            onChange={(output) => setFloorplanOutput(output.derivedOutputs)}
          />
        </div>
      )}
      {journey === 'heat-loss' && (
        <HeatLossCalculator
          onBack={() => setJourney('landing')}
          onComplete={(totalHL) => {
            const heatLossWatts = Math.round(totalHL * 1000);
            setLabEngineInput(prev => ({ ...(prev ?? CONSOLE_DEMO_INPUT), heatLossWatts }));
            setJourney('simulator');
          }}
        />
      )}
      {journey === 'building-height' && (
        <BuildingHeightCheck onBack={() => setJourney('landing')} />
      )}
      {journey === 'prototype-composer' && (
        <PrototypeComposerPage onBack={() => setJourney('landing')} />
      )}
      {/* User Profile — local engineer profile panel */}
      {journey === 'user-profile' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setJourney('app-home');
          }}
        >
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxWidth: 520, width: '100%', margin: '0 1rem' }}>
            <UserProfilePanel onClose={() => setJourney('app-home')} />
          </div>
        </div>
      )}
      {journey === 'app-home' && (
        <div className="app-entry-home">
          <div className="app-entry-hero">
            <h1>Atlas</h1>
            <p className="app-entry-tagline">
              Start a visit, load a saved record, and continue through the canonical Atlas journey.
            </p>
            <div className="app-entry-context">
              <span>
                <strong>Profile:</strong> {activeUser?.displayName ?? 'No local profile set'}
              </span>
              <span>
                <strong>Workspace:</strong> {workspaceSession.activeWorkspace?.name ?? 'No active workspace'}
              </span>
            </div>
          </div>
          <div className="app-entry-tiles">
            <button
              type="button"
              className="app-entry-tile"
              onClick={handleStartNewVisit}
              disabled={appHomeNewVisitState.disabled}
              aria-describedby={appHomeNewVisitState.blockerReason != null ? 'app-home-new-visit-workspace-blocker' : undefined}
            >
              <span className="app-entry-tile__title">New visit</span>
              <span className="app-entry-tile__copy">
                Create visit identity, capture customer/property basics, then continue to manual survey and next actions.
              </span>
              {appHomeNewVisitState.blockerReason != null && (
                <span
                  id="app-home-new-visit-workspace-blocker"
                  className="app-entry-tile__copy"
                  data-testid="app-home-new-visit-workspace-blocker"
                >
                  {appHomeNewVisitState.blockerReason}
                </span>
              )}
            </button>
            <button
              type="button"
              className="app-entry-tile"
              onClick={() => {
                setActiveVisitId(undefined);
                setJourney('visit-home');
              }}
            >
              <span className="app-entry-tile__title">Load visit</span>
              <span className="app-entry-tile__copy">
                Open existing local/canonical persisted visit records.
              </span>
            </button>
            <button
              type="button"
              className="app-entry-tile"
              onClick={() => {
                setLocalSessionStatus({
                  tone: 'warning',
                  type: 'session',
                  message: 'Use Visit Home → Visit session → Import visit package to keep import and recovery in one flow.',
                });
                setJourney('visit-home');
              }}
            >
              <span className="app-entry-tile__title">Import package</span>
              <span className="app-entry-tile__copy">
                Open Visit Home and import a <code>.atlasvisit.json</code> or <code>.atlasvisit.pdf</code> package from one canonical flow.
              </span>
            </button>
            <button
              type="button"
              className="app-entry-tile"
              onClick={() => handleOpenScanFromCanonicalPackage('app-home')}
              disabled={activeCanonicalPackage == null}
            >
              <span className="app-entry-tile__title">Open in Atlas Scan</span>
              <span className="app-entry-tile__copy">
                Launch Atlas Scan with packaged visit identity, workspace context, and survey draft.
              </span>
            </button>
            <button
              type="button"
              className="app-entry-tile"
              onClick={() => setJourney('user-profile')}
            >
              <span className="app-entry-tile__title">Profile</span>
              <span className="app-entry-tile__copy">
                View signed-in user, profile, and workspace context.
              </span>
            </button>
            {canAccessWorkspaceSettings && (
              <button
                type="button"
                className="app-entry-tile"
                onClick={() => { window.location.href = '/workspace/settings'; }}
              >
                <span className="app-entry-tile__title">Workspace settings</span>
                <span className="app-entry-tile__copy">
                  Admin/owner controls using existing workspace, brand, and profile foundations.
                </span>
              </button>
            )}
          </div>
        </div>
      )}
      {/* Workspace Dashboard — the primary landing page for each workspace.
           Shows active tenant/user/role, visit buckets, analytics snapshot,
           branding card, and role-aware quick actions. */}
      {journey === 'workspace-dashboard' && (
        <WorkspaceDashboard
          onStartNewVisit={handleStartNewVisit}
          onOpenVisit={handleOpenVisit}
          onOpenAllVisits={() => { setJourney('landing'); setShowVisitsPanel(true); }}
          onOpenAnalytics={() => { window.location.href = '/analytics'; }}
          onOpenBranding={() => { window.location.href = '/workspace/settings'; }}
          onOpenWorkspaceSettings={() => { window.location.href = '/workspace/settings'; }}
          onOpenUserProfile={() => setJourney('user-profile')}
          onOpenAllTools={() => setJourney('landing')}
          onOpenDemoExternalFiles={() => {
            setActiveVisitId(DEMO_VISIT_IDS.completed_won);
            setJourney('external-files');
          }}
          onOpenDemoPresentation={() => { void handleOpenPresentation(DEMO_VISIT_IDS.completed_won); }}
          onLoadDemoWorkspace={() => {
            resetDemoData();
            console.info('[Atlas] Demo workspace reloaded from dashboard.');
            setTimeout(() => window.location.reload(), 600);
          }}
          authorisedAccess={canAccessWorkspaceDashboard}
        />
      )}
      {journey === 'landing' && (
        <div className="landing">
          {/* Workspace host indicator — visible when the app is accessed via a
               branded subdomain (e.g. demo-heating.atlas-phm.uk).  Confirms to
               the engineer which workspace context is active before any visit
               is created.  Dev mode also shows the raw host for diagnostics. */}
          {hostResolution.source === 'host' && hostResolution.workspaceSlug !== undefined && (
            <div
              data-testid="workspace-host-indicator"
              style={{
                padding: '0.375rem 0.75rem',
                background: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: 6,
                fontSize: '0.8125rem',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
              }}
            >
              <span
                data-testid="workspace-host-slug"
                style={{ fontWeight: 600, color: '#166534', fontFamily: 'monospace' }}
              >
                {hostResolution.workspaceSlug}
              </span>
              <span style={{ color: '#64748b' }}>workspace</span>
              {import.meta.env.DEV && (
                <span
                  data-testid="workspace-host-dev-info"
                  style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: '0.6875rem', color: '#94a3b8' }}
                >
                  host:{hostResolution.host} · src:{hostResolution.source}
                </span>
              )}
            </div>
          )}
          <WorkspaceSessionGuard showWorkspaceActiveState />
          <div className="hero">
            <div style={{ marginBottom: '0.5rem' }}>
              <button
                onClick={() => setJourney('workspace-dashboard')}
                style={{ fontSize: 13, padding: '4px 12px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#4f46e5' }}
              >
                ← Dashboard
              </button>
            </div>
            <h1>
              Atlas Field Visits
            </h1>
            <p className="tagline">
              Create a visit, complete the survey, and generate a recommendation — all in one place.
            </p>
          </div>

          {/* Primary CTAs — new visit + search visits */}
          <div className="visit-cta-row">
            {canCreateVisit && (
              <button
                className="cta-btn cta-btn--visit"
                onClick={handleStartNewVisit}
                aria-haspopup="dialog"
                disabled={workspaceSession.status === 'authenticated_no_workspace'}
              >
                ＋ New Visit
              </button>
            )}
            <button
              className="cta-btn cta-btn--search-visits"
              onClick={() => setShowVisitsPanel(v => !v)}
              aria-expanded={showVisitsPanel}
              aria-controls="visits-panel"
              aria-label="Search Visits"
            >
              🔍 Open Visit
            </button>
          </div>

          {/* Visits panel — revealed when "Open Visit" is toggled */}
          {showVisitsPanel && (
            <div id="visits-panel">
              <WorkspaceSessionGuard />
              <RecentVisitsList onOpenVisit={handleOpenVisit} />
            </div>
          )}

          <div className="journey-cards">
            {/* Quick start — physics-first shortcut, no visit required */}
            <h3 className="journey-section-label">Quick start</h3>
            {labEngineInput != null && (
              <div
                className="journey-card journey-card--featured"
                onClick={() => setJourney('presentation')}
              >
                <div className="card-icon">🎯</div>
                <h2>In-Room Presentation</h2>
                <p>Guided story screen — show the customer what happens, why, and what fixes it.</p>
                <button className="cta-btn">Open Presentation →</button>
              </div>
            )}
            <div
              id="fast-choice-card"
              data-tour="mode-choice"
              className="journey-card fast"
              onClick={() => setJourney('fast')}
            >
              <div className="card-icon">⚡</div>
              <h2>Fast Choice</h2>
              <p>Quick recommendation from key inputs — no visit required.</p>
              <button className="cta-btn">Start Fast Choice →</button>
            </div>

            {/* Alternative workflows — fallback when a visit is not possible */}
            <h3 className="journey-section-label">Alternative workflows</h3>
            <div
              id="survey-panel"
              data-tour="survey-panel"
              className="journey-card journey-card--remote"
              onClick={() => setJourney('remote-survey')}
            >
              <div className="card-icon">📋</div>
              <h2>Remote / Manual Survey</h2>
              <p>Use when surveying off-site by phone, video, or existing customer information.</p>
              <button className="cta-btn">Start Remote Survey →</button>
            </div>

            {/* Visit Workspaces — local / drive import workspace */}
            {canManageWorkspace && (
            <div
              id="visit-workspaces-card"
              className="journey-card"
              onClick={() => { window.location.href = '/workspace'; }}
            >
              <div className="card-icon">📂</div>
              <h2>Visit Workspaces</h2>
              <p>Import, review, and export scan captures — stored locally or on Drive. No DB write until you publish.</p>
              <button className="cta-btn">Open Workspaces →</button>
            </div>
            )}

            {/* Workspace Analytics — tenant KPI dashboard */}
            {canViewAnalytics && (
            <div
              id="workspace-analytics-card"
              className="journey-card"
              onClick={() => { window.location.href = '/analytics'; }}
            >
              <div className="card-icon">📊</div>
              <h2>Workspace Analytics</h2>
              <p>View usage metrics — visits, completion rate, and recommendation selections. No customer data stored.</p>
              <button className="cta-btn">Open Analytics →</button>
            </div>
            )}

            {/* Workspace Branding — local brand editor */}
            {canEditBranding && (
            <div
              id="workspace-branding-card"
              className="journey-card"
              onClick={() => { window.location.href = '/workspace/settings'; }}
            >
              <div className="card-icon">🎨</div>
              <h2>Workspace Branding</h2>
              <p>Edit your company name, colours, and contact details for Atlas outputs. Saved locally.</p>
              <button className="cta-btn">Open Branding →</button>
            </div>
            )}

            {/* Workspace settings — onboarding and admin controls */}
            {canManageWorkspace && (
            <div
              id="create-workspace-card"
              className="journey-card"
              onClick={() => { window.location.href = '/workspace/settings'; }}
            >
              <div className="card-icon">🏢</div>
              <h2>Workspace settings</h2>
              <p>Adjust workspace policy, storage mode, and onboarding drafts in one place.</p>
              <button className="cta-btn">Open settings →</button>
            </div>
            )}

            {/* User Profile — local engineer profile */}
            <div
              id="user-profile-card"
              className="journey-card"
              onClick={() => setJourney('user-profile')}
            >
              <div className="card-icon">👤</div>
              <h2>User Profile</h2>
              {activeUser !== null ? (
                <p>Signed in as <strong>{activeUser.displayName}</strong>. Edit your profile or switch user.</p>
              ) : (
                <p>Create a local profile to attribute visits, set a default workspace, and enable dev mode.</p>
              )}
              <button className="cta-btn">{activeUser !== null ? 'Manage Profile →' : 'Set Up Profile →'}</button>
            </div>

            {/* Tools — standalone utilities */}
            <h3 className="journey-section-label">Tools</h3>
            <div
              className="journey-card"
              onClick={() => setJourney('floor-plan')}
            >
              <div className="card-icon">🗺️</div>
              <h2>Floor Plan Builder</h2>
              <p>Map heating components to your property layout across floors.</p>
              <button className="cta-btn">Open Floor Plan →</button>
            </div>
            <div
              className="journey-card"
              onClick={() => setJourney('heat-loss')}
            >
              <div className="card-icon">🔥</div>
              <h2>Heat Loss Calculator</h2>
              <p>Sketch the property perimeter and get a fast whole-house heat loss estimate.</p>
              <button className="cta-btn">Open Heat Loss →</button>
            </div>
            <div
              className="journey-card"
              onClick={() => setJourney('building-height')}
            >
              <div className="card-icon">📐</div>
              <h2>Building Height Check</h2>
              <p>Estimate building height from manual distance and captured base/top angles.</p>
              <button className="cta-btn">Open Height Check →</button>
            </div>
            {/* Physics Visual Library — dev review surface */}
            <div
              className="journey-card"
              onClick={() => setJourney('gallery')}
            >
              <div className="card-icon">🎨</div>
              <h2>Physics Visual Library</h2>
              <p>Dev preview — browse all registered explainer animations with controls and scripts.</p>
              <button className="cta-btn">Open Gallery →</button>
            </div>
            {/* UI Inventory — component browser, only visible when dev menu route is enabled */}
            {DEV_MENU_ENABLED && (
              <div
                className="journey-card"
                onClick={() => setJourney('dev-menu')}
              >
                <div className="card-icon">🗂</div>
                <h2>UI Inventory</h2>
                <p>Browse and classify all registered UI surfaces by human name, code name, category and status.</p>
                <button className="cta-btn">Open UI Inventory →</button>
              </div>
            )}
            {/* System Explorer hidden from primary UX — access via ?explorer=1 */}
          </div>
          <Footer onNavigate={setJourney} />
        </div>
      )}

      {/* New-visit panel — shown when the user clicks "Start new visit".
           StartVisitPanel handles the API call and brand selection internally;
           on success the visit (with brandId) is set as the active visit.
           When the app is accessed via a branded subdomain, defaultWorkspaceSlug
           pre-selects that workspace so the engineer does not have to choose it. */}
      {showNewVisitDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNewVisitDialog(false);
            }
          }}
        >
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxWidth: 520, width: '100%', margin: '0 1rem' }}>
            <WorkspaceSessionGuard />
            <StartVisitPanel
              onStart={(visit) => {
                setActiveAtlasVisit(visit);
                setActiveVisitId(visit.visitId);
                setShowNewVisitDialog(false);
                setJourney('visit');
              }}
              onCancel={() => {
                setShowNewVisitDialog(false);
              }}
              defaultWorkspaceSlug={
                hostResolution.source === 'host' ? hostResolution.workspaceSlug : undefined
              }
              onCreateWorkspace={() => {
                setShowNewVisitDialog(false);
                window.location.href = `${window.location.pathname}?create-workspace=1`;
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Bridges host-workspace resolution into WorkspaceBrandSessionProvider.
 * Reads the host-resolved brandId once at mount and passes it as routeBrandId.
 */
function AppWithHostBrand({ children }: { children: ReactNode }) {
  const hostResolution = useWorkspaceFromHost();
  return (
    <WorkspaceBrandSessionProvider routeBrandId={hostResolution.brandId}>
      {children}
    </WorkspaceBrandSessionProvider>
  );
}

export default function App() {
  return (
    <AtlasAuthProvider>
      <ActiveUserProvider>
        <WorkspaceSessionProvider>
          <AppWithHostBrand>
            <RequireAuth>
              <AppInner />
            </RequireAuth>
          </AppWithHostBrand>
        </WorkspaceSessionProvider>
      </ActiveUserProvider>
    </AtlasAuthProvider>
  );
}
