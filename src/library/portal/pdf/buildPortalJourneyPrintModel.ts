/**
 * buildPortalJourneyPrintModel.ts
 *
 * Composes a compact print model for the open-vented → sealed + unvented portal
 * journey path.  The model sources content exclusively from the same
 * atlasMvpContentMapRegistry entries that the portal sections render, so the
 * PDF and the portal journey always stay in sync.
 *
 * Input
 * ─────
 *   selectedSectionIds   — which portal journey content IDs were shown
 *   recommendationSummary — one-sentence recommendation label (customer-safe)
 *   customerFacts         — array of plain-language facts about the home
 *   brandProfile          — optional installer / brand display details
 *   audienceProjection    — optional library audience projection; when supplied,
 *                           only sections whose contentId appears in
 *                           visibleConcepts are included in the PDF
 *
 * Output
 * ──────
 *   PortalJourneyPrintModelV1 — compact, flat model for PortalJourneyPrintPack
 *     cover summary · practical outcomes · pressure vs storage
 *     unvented safety · next steps (+ QR deeper detail)
 */

import { atlasMvpContentMapRegistry } from '../../content/atlasMvpContentMapRegistry';
import type { AtlasMvpContentEntryV1 } from '../../content/atlasMvpContentMapRegistry';
import { getEducationalAnimationById, resolveEducationalAnimationId } from '../../animations';
import type { LibraryContentProjectionV1 } from '../../projections/LibraryContentProjectionV1';
import type { PortalVisitContextV1 } from '../../../contracts/PortalVisitContextV1';
import type { VisitEnvelopeV1 } from '../../../contracts/VisitEnvelopeV1';
import type { CanonicalVisitPackageV1 } from '../../../features/visitPackage/CanonicalVisitPackageV1';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import type { GeneratedOutputsV1 } from '../../../lib/storage/visitReviewLifecycle';
import type { RecommendationViabilityStateV1 } from '../../../contracts/RecommendationViabilityStateV1';
import { resolvePortalAddressSummary } from '../../../lib/portal/portalVisitContext';
import {
  buildSystemProtectionSummary,
  type SurveySystemConditionV1,
  type SystemProtectionSummaryV1,
} from './buildSystemProtectionSummary';
import {
  getVisualAssetManifestEntry,
  getVisualAssetRendererAvailability,
  listManifestAssetIds,
} from './visualAssetManifest';
import { isApprovedCustomerPdfVisualAssetId } from '../../pdfVisuals/customerPdfVisualRegistry';
import {
  getLegoTechnicCustomerVisualManifestEntry,
  resolveLegoTechnicCustomerVisualDecision,
  type LegoTechnicCustomerVisualClassification,
} from './legoTechnicCustomerVisualManifest';
export type { SurveySystemConditionV1, SystemProtectionSummaryV1 };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PortalJourneyPrintCoverV1 {
  title: string;
  summary: string;
  customerFacts: string[];
  brandName?: string;
  addressSummary?: string;
}

export type RecommendationReasonCategoryV1 =
  | 'household_demand'
  | 'bathroom_count'
  | 'mains_flow_pressure'
  | 'current_system_constraint'
  | 'loft_cylinder_location_constraint'
  | 'simultaneous_hot_water_use'
  | 'protection_system_condition'
  | 'future_upgrade_readiness'
  | 'hot_water_system_type'
  | 'emitter_upgrade_required';

/**
 * Primary intent of the recommendation.
 *
 * Determines section priority, inclusion, and practical-outcome ordering in the
 * customer-facing PDF.  The intent is resolved from the recommended system type
 * and existing system context, not from the current (pre-install) setup alone.
 *
 * - heat_pump_transition   — ASHP/GSHP replacing a gas or oil system
 * - stored_hot_water       — Sealed cylinder system without a topology change
 * - sealed_system_conversion — Moving to a sealed heating circuit
 * - combi_replacement      — Combi boiler; on-demand hot water, no cylinder
 * - vented_to_unvented     — Open-vented layout upgrading to mains-pressure cylinder
 * - protection_upgrade     — Primary focus is system condition / protection works
 * - efficiency_upgrade     — Controls or efficiency-led route with no topology change
 */
export type RecommendationIntentCategoryV1 =
  | 'heat_pump_transition'
  | 'stored_hot_water'
  | 'sealed_system_conversion'
  | 'combi_replacement'
  | 'vented_to_unvented'
  | 'protection_upgrade'
  | 'efficiency_upgrade';

export interface RecommendationReasonBlockV1 {
  id: string;
  category: RecommendationReasonCategoryV1;
  homeFact: string;
  whyItMatters: string;
  atlasRecommendationOutcome: string;
  practicalEffect: string;
  detail?: string;
  evidenceTags?: RecommendationEvidenceTagV1[];
}

export interface RecommendationEvidenceTagV1 {
  source: string;
  metric: string;
  trigger: string;
  recommendationReasonCategory?: RecommendationReasonCategoryV1;
}

export interface PortalJourneyPrintSectionV1 {
  /** Internal content source ID — never rendered to the customer */
  contentId: string;
  /** Stable section key for layout mapping */
  sectionId:
    | 'practical_outcomes'
    | 'pressure_vs_storage'
    | 'unvented_safety'
    | 'warm_not_hot_radiators'
    | 'steady_running'
    | 'winter_behaviour'
    | 'stored_hot_water_recovery_timeline'
    | 'flow_restriction_bottleneck'
    | 'powerflush_condition_led'
    | 'system_fit_decision_map'
    | 'magnetic_filter_capture'
    | 'sealed_system_pressure_window'
    | 'hero_scene'
    | 'quiet_scene'
    | `quiet_scene_${string}`;
  heading: string;
  summary: string;
  keyTakeaway: string;
  reassurance: string;
  diagramCaption?: string;
  /** Bullet-point items for the printed card */
  items: string[];
  /** Optional diagram to render in print-safe mode */
  diagramId?: string;
  /** DiagramRenderer ID to use when known for this section */
  diagramRendererId?: string;
  /** Canonical library story-scene payload used by customer PDF renderers. */
  storyScene?: LibraryStorySceneV1;
  /** Evidence tags proving why this section is shown for this home. */
  evidenceTags?: RecommendationEvidenceTagV1[];
}

export interface LibraryStorySceneV1 {
  sceneKind?: LibraryStorySceneKindV1;
  title: string;
  customerTakeaway: string;
  visualAssetId?: string;
  whyItMatters: string;
  whatYouWillNotice: string;
  composition?: LibraryStorySceneCompositionV1;
}

export type LibraryStorySceneKindV1 =
  | 'current_system_explainer'
  | 'route_rationale'
  | 'physics_explainer'
  | 'lived_experience'
  | 'protection_quality'
  | 'future_flexibility';

export type PdfCompositionPageArchetypeV1 =
  | 'hero'
  | 'explanation'
  | 'lived_experience'
  | 'practical_work'
  | 'reassurance'
  | 'quiet';

export type PdfCompositionFocalVisualPriorityV1 = 'primary' | 'supporting' | 'none';
export type PdfCompositionDensityTierV1 = 'dense' | 'balanced' | 'airy';
export type PdfCompositionTransitionTypeV1 = 'forward' | 'bridge' | 'breather';

export interface LibraryStorySceneCompositionV1 {
  pageArchetype: PdfCompositionPageArchetypeV1;
  focalVisualPriority: PdfCompositionFocalVisualPriorityV1;
  densityTier: PdfCompositionDensityTierV1;
  transitionType: PdfCompositionTransitionTypeV1;
  heroEligible: boolean;
  quietEligible: boolean;
  whitespaceRatio: number;
  maxCardsPerPage: number;
  visualScale: number;
}

export interface PortalJourneyPrintNextStepV1 {
  label: string;
  body: string;
}

export interface PortalJourneyPrintQrDestinationV1 {
  heading: string;
  note: string;
}

export interface CustomerPdfContentSourceV1 {
  audienceProjectionPresent: boolean;
  selectedConceptCount: number;
  selectedStorySceneCount: number;
  visualAssetIds: string[];
  fallbackSectionsUsed: boolean;
  fallbackOnly: boolean;
  sceneDiagnostics: CustomerPdfSceneDiagnosticV1[];
  visualCoverageAudit: CustomerPdfVisualCoverageAuditV1;
  routeCompletenessAudit?: CustomerPdfRouteCompletenessAuditV1;
  storySceneValidation: {
    sceneCount: number;
    warningCount: number;
    errorCount: number;
    blockingErrorCount: number;
    rejectedSceneCount: number;
    rejectedSceneSectionIds: string[];
    offendingPhrases: string[];
    warningCodes: string[];
    errorCodes: string[];
    compositionWarningCount: number;
    compositionErrorCount: number;
  };
}

export interface CustomerPdfVisualCoverageAuditV1 {
  routes: CustomerPdfVisualCoverageRouteV1[];
}

export interface CustomerPdfVisualCoverageRouteV1 {
  routeId: ScenarioNarrativeRouteIdV1;
  requiredStorySceneSectionIds: PortalJourneyPrintSectionV1['sectionId'][];
  requestedVisualAssetIds: string[];
  scenes: CustomerPdfVisualCoverageSceneV1[];
  summary: {
    canonicalVisualsAvailable: string[];
    missingCanonicalVisuals: string[];
    retiredVisualsRequested: string[];
    textOnlySceneSectionIds: PortalJourneyPrintSectionV1['sectionId'][];
  };
}

export interface CustomerPdfVisualCoverageSceneV1 {
  sectionId: PortalJourneyPrintSectionV1['sectionId'];
  requestedVisualAssetId: string;
  classification: LegoTechnicCustomerVisualClassification | 'unlisted';
  rendererAvailability: {
    hasDiagramRenderer: boolean;
    hasPrintFallback: boolean;
  };
  blockedReason?: string;
}

export interface CustomerPdfSceneDiagnosticV1 {
  sectionId: PortalJourneyPrintSectionV1['sectionId'];
  visualAssetId?: string;
  visualClassification: LegoTechnicCustomerVisualClassification | 'unlisted';
  rendererType: 'diagram_component' | 'print_fallback' | 'none';
  fallbackUsed: boolean;
  blockingReasons: string[];
  offendingPhrases: string[];
}

export type CustomerPdfRouteRequirementIdV1 =
  | 'recommendation_hero'
  | 'current_system_explanation'
  | 'why_this_route_fits'
  | 'what_changes_day_to_day'
  | 'protection_system_condition'
  | 'next_steps';

export interface CustomerPdfRouteCompletenessRequirementV1 {
  requirementId: CustomerPdfRouteRequirementIdV1;
  label: string;
  sectionId?: PortalJourneyPrintSectionV1['sectionId'] | 'system_protection' | 'next_steps';
  sceneKind?: LibraryStorySceneKindV1;
  title?: string;
  takeaway?: string;
  visualAssetId?: string;
  rendererType?: CustomerPdfSceneDiagnosticV1['rendererType'];
  visualRequired: boolean;
  present: boolean;
  blocked: boolean;
  usesGenericFallbackCopy: boolean;
  reasons: string[];
}

export interface CustomerPdfRouteCompletenessAuditV1 {
  routeId: ScenarioNarrativeRouteIdV1;
  ready: boolean;
  missingRequirementIds: CustomerPdfRouteRequirementIdV1[];
  blockedRequirementIds: CustomerPdfRouteRequirementIdV1[];
  genericFallbackRequirementIds: CustomerPdfRouteRequirementIdV1[];
  requirements: CustomerPdfRouteCompletenessRequirementV1[];
}

export interface PortalJourneyPrintModelV1 {
  cover: PortalJourneyPrintCoverV1;
  recommendationReasons: RecommendationReasonBlockV1[];
  recommendationViabilityState?: RecommendationViabilityStateV1;
  sections: PortalJourneyPrintSectionV1[];
  nextSteps: PortalJourneyPrintNextStepV1[];
  qrDestinations: PortalJourneyPrintQrDestinationV1[];
  /**
   * Survey-informed system protection summary.
   * Present when surveyCondition is supplied to buildPortalJourneyPrintModel.
   * Rendered as a small section after practical outcomes.
   */
  systemProtection?: SystemProtectionSummaryV1;
  /**
   * Temporary content-source trace for validating library-backed customer PDFs.
   * Render only in dev surfaces.
   */
  contentSource?: CustomerPdfContentSourceV1;
  pageEstimate: {
    usedPages: number;
    maxPages: number;
  };
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface BuildPortalJourneyPrintModelInputV1 {
  /** Content IDs from the portal journey sections that were rendered */
  selectedSectionIds: string[];
  /** Customer-safe one-sentence description of the recommendation */
  recommendationSummary: string;
  /** Plain-language facts about the customer's home */
  customerFacts: string[];
  /** Optional brand / installer identity */
  brandProfile?: {
    name?: string;
  };
  /** Journey model to build. Defaults to generic recommendation summary. */
  journeyType?:
    | 'open_vented'
    | 'stored_hot_water'
    | 'heat_pump'
    | 'water_constraint'
    | 'regular_unvented'
    | 'generic_recommendation_summary';
  /**
   * Optional audience projection.  When supplied, only sections whose
   * contentId appears in `audienceProjection.visibleConcepts` are included
   * in the PDF output.
   */
  audienceProjection?: LibraryContentProjectionV1;
  /** Optional visit-scoped portal context for safe display metadata. */
  visitContext?: Pick<PortalVisitContextV1, 'addressSummary' | 'personalDataMode'>;
  /** Address summary stays hidden in print unless explicitly enabled. */
  includeAddressSummaryInPrint?: boolean;
  /**
   * Optional survey system condition signals for the system protection section.
   * When present, buildSystemProtectionSummary is called and the result is
   * included in the model as systemProtection.
   */
  surveyCondition?: SurveySystemConditionV1;
  /** Causal recommendation reasons for customer-facing “why this fits” cards. */
  recommendationReasons?: RecommendationReasonBlockV1[];
  /** Preferred packaged customer journey pack; used instead of rebuilding when present. */
  customerJourneyPack?: CustomerJourneyPackV1;
  /**
   * Primary recommendation intent.  When supplied, overrides section
   * inclusion and ordering regardless of journeyType.
   * Resolved automatically by buildCustomerJourneyPack when not provided.
   */
  recommendationIntent?: RecommendationIntentCategoryV1;
  /** Routed educational concept tags selected from recommendation evidence. */
  educationalConceptTags?: EducationalConceptTagV1[];
  /** Canonical viability state of the recommended pathway. */
  recommendationViabilityState?: RecommendationViabilityStateV1;
}

export const CUSTOMER_JOURNEY_PACK_SCHEMA = 'atlas.customer-journey-pack' as const;
export const CUSTOMER_JOURNEY_PACK_VERSION = '1.0' as const;

export interface CustomerJourneyLibraryExplainerV1 {
  contentId: string;
  title: string;
  summary: string;
}

export interface CustomerJourneyPortalDeepDiveV1 {
  recommendationSummary: string;
  recommendationReasons: RecommendationReasonBlockV1[];
  liveExperienceExplanations: string[];
  librarySupportedExplainers: CustomerJourneyLibraryExplainerV1[];
  nextSteps: PortalJourneyPrintNextStepV1[];
  sections: PortalJourneyPrintSectionV1[];
}

export interface CustomerJourneyPackV1 {
  schema: typeof CUSTOMER_JOURNEY_PACK_SCHEMA;
  version: typeof CUSTOMER_JOURNEY_PACK_VERSION;
  staticPdf: PortalJourneyPrintModelV1;
  portalDeepDive: CustomerJourneyPortalDeepDiveV1;
}

export interface BuildCustomerJourneyPackInputV1 extends Partial<BuildPortalJourneyPrintModelInputV1> {
  canonicalVisitPackage?: CanonicalVisitPackageV1;
  visitEnvelope?: VisitEnvelopeV1;
  liveExperienceExplanations?: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCustomerJourneyPack(value: unknown): value is CustomerJourneyPackV1 {
  if (!isRecord(value)) return false;
  return value['schema'] === CUSTOMER_JOURNEY_PACK_SCHEMA
    && value['version'] === CUSTOMER_JOURNEY_PACK_VERSION
    && isRecord(value['staticPdf'])
    && isRecord(value['portalDeepDive']);
}

export function readCustomerJourneyPackFromGeneratedOutputs(
  generatedOutputs: Partial<GeneratedOutputsV1> | undefined,
): CustomerJourneyPackV1 | undefined {
  const payload = generatedOutputs?.customerJourneyPack?.payload;
  return isCustomerJourneyPack(payload) ? payload : undefined;
}

export function buildCustomerJourneyPackGeneratedOutput(input: {
  readonly customerJourneyPack: CustomerJourneyPackV1;
  readonly generatedAt: string;
  readonly snapshotId?: string;
  readonly status?: string;
}): NonNullable<GeneratedOutputsV1['customerJourneyPack']> {
  return {
    generated: true,
    generatedAt: input.generatedAt,
    snapshotId: input.snapshotId,
    schema: input.customerJourneyPack.schema,
    version: input.customerJourneyPack.version,
    status: input.status ?? 'packaged',
    payload: input.customerJourneyPack,
  };
}

function resolvePrintDiagramFromContentEntry(entry: AtlasMvpContentEntryV1): string | undefined {
  // Precedence: first suggested animation with a canonical printFallback wins.
  // If no mapped animation provides a print fallback, use the first diagram ID.
  for (const suggestedAnimationId of entry.suggestedAnimationIds) {
    const animationId = resolveEducationalAnimationId(suggestedAnimationId);
    if (!animationId) continue;
    const animation = getEducationalAnimationById(animationId);
    if (animation?.printFallback) {
      return animation.printFallback;
    }
  }
  return entry.suggestedDiagramIds.length > 0 ? entry.suggestedDiagramIds[0] : undefined;
}

function journeyTypeToIntent(
  journeyType: NonNullable<BuildPortalJourneyPrintModelInputV1['journeyType']>,
): RecommendationIntentCategoryV1 {
  switch (journeyType) {
    case 'heat_pump': return 'heat_pump_transition';
    case 'open_vented': return 'vented_to_unvented';
    case 'stored_hot_water': return 'stored_hot_water';
    case 'water_constraint': return 'protection_upgrade';
    case 'regular_unvented': return 'sealed_system_conversion';
    case 'generic_recommendation_summary': return 'efficiency_upgrade';
  }
}

export type EducationalConceptTagV1 =
  | 'pressure_vs_storage'
  | 'warm_vs_hot_radiators'
  | 'stored_hot_water_recovery_timeline'
  | 'flow_restriction_bottleneck'
  | 'powerflush_condition_led'
  | 'system_fit_decision_map'
  | 'magnetic_filter_capture'
  | 'sealed_system_pressure_window';

export interface RecommendationConceptSelectionV1 {
  selectedSectionIds: string[];
  conceptTags: EducationalConceptTagV1[];
}

export type ScenarioNarrativeRouteIdV1 =
  | 'regular_vented'
  | 'system_unvented'
  | 'combi'
  | 'heat_pump';

interface ScenarioNarrativeSceneTemplateV1 {
  sectionId: PortalJourneyPrintSectionV1['sectionId'];
  sceneKind: LibraryStorySceneKindV1;
  title: string;
  customerTakeaway: string;
  whyItMatters: string;
  whatYouWillNotice: string;
  visualAssetId: string;
}

interface ScenarioNarrativePackV1 {
  routeId: ScenarioNarrativeRouteIdV1;
  scenes: readonly ScenarioNarrativeSceneTemplateV1[];
  compositionBySectionId: Partial<Record<PortalJourneyPrintSectionV1['sectionId'], LibraryStorySceneCompositionV1>>;
}

function compositionTemplate(input: {
  pageArchetype: PdfCompositionPageArchetypeV1;
  focalVisualPriority: PdfCompositionFocalVisualPriorityV1;
  densityTier: PdfCompositionDensityTierV1;
  transitionType: PdfCompositionTransitionTypeV1;
  heroEligible?: boolean;
  quietEligible?: boolean;
  whitespaceRatio?: number;
  maxCardsPerPage?: number;
  visualScale?: number;
}): LibraryStorySceneCompositionV1 {
  return {
    pageArchetype: input.pageArchetype,
    focalVisualPriority: input.focalVisualPriority,
    densityTier: input.densityTier,
    transitionType: input.transitionType,
    heroEligible: input.heroEligible ?? false,
    quietEligible: input.quietEligible ?? false,
    whitespaceRatio: input.whitespaceRatio ?? 0.34,
    maxCardsPerPage: input.maxCardsPerPage ?? 2,
    visualScale: input.visualScale ?? 1,
  };
}

const SCENARIO_NARRATIVE_PACKS: Record<ScenarioNarrativeRouteIdV1, ScenarioNarrativePackV1> = {
  regular_vented: {
    routeId: 'regular_vented',
    compositionBySectionId: {
      practical_outcomes: compositionTemplate({ pageArchetype: 'hero', focalVisualPriority: 'primary', densityTier: 'balanced', transitionType: 'forward', heroEligible: true, whitespaceRatio: 0.36, maxCardsPerPage: 1, visualScale: 1.05 }),
      system_fit_decision_map: compositionTemplate({ pageArchetype: 'explanation', focalVisualPriority: 'primary', densityTier: 'dense', transitionType: 'bridge', whitespaceRatio: 0.31, maxCardsPerPage: 2, visualScale: 0.95 }),
      stored_hot_water_recovery_timeline: compositionTemplate({ pageArchetype: 'lived_experience', focalVisualPriority: 'primary', densityTier: 'balanced', transitionType: 'forward', whitespaceRatio: 0.34, maxCardsPerPage: 2, visualScale: 1 }),
      unvented_safety: compositionTemplate({ pageArchetype: 'reassurance', focalVisualPriority: 'supporting', densityTier: 'balanced', transitionType: 'bridge', whitespaceRatio: 0.35, maxCardsPerPage: 2, visualScale: 0.92 }),
      sealed_system_pressure_window: compositionTemplate({ pageArchetype: 'practical_work', focalVisualPriority: 'supporting', densityTier: 'balanced', transitionType: 'forward', whitespaceRatio: 0.35, maxCardsPerPage: 2, visualScale: 0.9 }),
      pressure_vs_storage: compositionTemplate({ pageArchetype: 'explanation', focalVisualPriority: 'primary', densityTier: 'dense', transitionType: 'breather', quietEligible: true, whitespaceRatio: 0.3, maxCardsPerPage: 1, visualScale: 0.95 }),
    },
    scenes: [
      {
        sectionId: 'practical_outcomes',
        sceneKind: 'current_system_explainer',
        title: 'From vented layout to sealed comfort',
        customerTakeaway: 'Your home moves away from loft-tank dependence to a sealed system with stored hot water.',
        whyItMatters: 'This recommendation stabilises pressure management while keeping everyday comfort expectations familiar.',
        whatYouWillNotice: 'You will see a pressure gauge and no longer rely on a loft header tank.',
        visualAssetId: 'open_vented_to_unvented',
      },
      {
        sectionId: 'system_fit_decision_map',
        sceneKind: 'route_rationale',
        title: 'Why Atlas selected this recommendation',
        customerTakeaway: 'Atlas matched this recommendation to measured demand, mains behaviour, and layout constraints together.',
        whyItMatters: 'The recommendation is evidence-led for this property instead of a one-size-fits-all product swap.',
        whatYouWillNotice: 'The explanation links survey findings directly to this selected system path.',
        visualAssetId: 'system_fit_decision_map',
      },
      {
        sectionId: 'stored_hot_water_recovery_timeline',
        sceneKind: 'lived_experience',
        title: 'Day-to-day hot-water rhythm',
        customerTakeaway: 'Stored hot water covers busy periods and then quietly recovers in the background.',
        whyItMatters: 'Knowing the reserve-and-recovery pattern keeps expectations calm at peak usage times.',
        whatYouWillNotice: 'After heavy use, hot water returns steadily without needing manual intervention.',
        visualAssetId: 'stored_hot_water_recovery_timeline',
      },
      {
        sectionId: 'unvented_safety',
        sceneKind: 'protection_quality',
        title: 'Protection features are part of quality work',
        customerTakeaway: 'Visible cylinder safety components are expected signs of compliant, quality installation.',
        whyItMatters: 'Protection hardware is built in to manage pressure safely and support reliable operation.',
        whatYouWillNotice: 'You may see a tundish and discharge pipework, and that is normal in this setup.',
        visualAssetId: 'open_vented_to_unvented',
      },
      {
        sectionId: 'sealed_system_pressure_window',
        sceneKind: 'future_flexibility',
        title: 'Flexible for future upgrades',
        customerTakeaway: 'A stable sealed-pressure baseline keeps future improvements easier to plan and tune.',
        whyItMatters: 'Good pressure discipline today protects options for later controls or efficiency upgrades.',
        whatYouWillNotice: 'The pressure gauge becomes a simple reference point during servicing and future changes.',
        visualAssetId: 'system_pressure_window',
      },
      {
        sectionId: 'pressure_vs_storage',
        sceneKind: 'physics_explainer',
        title: 'Pressure and storage are separate limits',
        customerTakeaway: 'Strong spray pressure and available stored volume are different parts of the same experience.',
        whyItMatters: 'Separating this physics distinction avoids confusion and supports realistic planning for busy households.',
        whatYouWillNotice: 'Shower force can stay strong while stored hot-water volume still follows a recovery cycle.',
        visualAssetId: 'pressure_vs_storage',
      },
    ],
  },
  system_unvented: {
    routeId: 'system_unvented',
    compositionBySectionId: {
      system_fit_decision_map: compositionTemplate({ pageArchetype: 'hero', focalVisualPriority: 'primary', densityTier: 'balanced', transitionType: 'forward', heroEligible: true, whitespaceRatio: 0.36, maxCardsPerPage: 1, visualScale: 1.05 }),
      pressure_vs_storage: compositionTemplate({ pageArchetype: 'explanation', focalVisualPriority: 'primary', densityTier: 'dense', transitionType: 'bridge', quietEligible: true, whitespaceRatio: 0.3, maxCardsPerPage: 1, visualScale: 0.94 }),
      stored_hot_water_recovery_timeline: compositionTemplate({ pageArchetype: 'lived_experience', focalVisualPriority: 'primary', densityTier: 'balanced', transitionType: 'forward', whitespaceRatio: 0.34, maxCardsPerPage: 2, visualScale: 1 }),
      magnetic_filter_capture: compositionTemplate({ pageArchetype: 'practical_work', focalVisualPriority: 'supporting', densityTier: 'balanced', transitionType: 'bridge', whitespaceRatio: 0.35, maxCardsPerPage: 2, visualScale: 0.92 }),
      sealed_system_pressure_window: compositionTemplate({ pageArchetype: 'reassurance', focalVisualPriority: 'supporting', densityTier: 'balanced', transitionType: 'forward', whitespaceRatio: 0.36, maxCardsPerPage: 2, visualScale: 0.9 }),
    },
    scenes: [
      {
        sectionId: 'system_fit_decision_map',
        sceneKind: 'current_system_explainer',
        title: 'Your system recommendation in context',
        customerTakeaway: 'Atlas keeps stored hot water because it fits your household demand and layout profile.',
        whyItMatters: 'This anchors the recommendation to how your home is used, not only to appliance labels.',
        whatYouWillNotice: 'The walkthrough focuses on practical fit for overlap use and recovery planning.',
        visualAssetId: 'system_fit_decision_map',
      },
      {
        sectionId: 'pressure_vs_storage',
        sceneKind: 'route_rationale',
        title: 'Why this recommendation suits your demand',
        customerTakeaway: 'Atlas prioritised stored hot water where overlap use needs dependable reserve capacity.',
        whyItMatters: 'This recommendation protects comfort at busy times when multiple outlets may run close together.',
        whatYouWillNotice: 'Hot-water planning is explained using both delivery force and storage quantity.',
        visualAssetId: 'pressure_vs_storage',
      },
      {
        sectionId: 'stored_hot_water_recovery_timeline',
        sceneKind: 'lived_experience',
        title: 'What improves day to day',
        customerTakeaway: 'Your household gets a clearer reserve-and-recovery pattern for predictable daily use.',
        whyItMatters: 'Expectation-setting reduces worry when recovery periods follow high demand windows.',
        whatYouWillNotice: 'Peak-time drawdown is followed by a normal refill and reheat cycle.',
        visualAssetId: 'stored_hot_water_recovery_timeline',
      },
      {
        sectionId: 'magnetic_filter_capture',
        sceneKind: 'protection_quality',
        title: 'Protection and quality checks',
        customerTakeaway: 'Filter capture and water-quality controls protect components and commissioning quality.',
        whyItMatters: 'Condition-led protection work helps preserve reliability as the system evolves over time.',
        whatYouWillNotice: 'Service visits include filter and water-treatment checks as part of normal quality care.',
        visualAssetId: 'magnetic_filter_capture',
      },
      {
        sectionId: 'sealed_system_pressure_window',
        sceneKind: 'future_flexibility',
        title: 'Future-ready pressure management',
        customerTakeaway: 'Stable sealed-system pressure gives a strong base for future control or efficiency upgrades.',
        whyItMatters: 'Keeping pressure in range supports long-term flexibility without major rework later.',
        whatYouWillNotice: 'Routine checks stay simple and consistent as future improvements are introduced.',
        visualAssetId: 'system_pressure_window',
      },
    ],
  },
  combi: {
    routeId: 'combi',
    compositionBySectionId: {
      system_fit_decision_map: compositionTemplate({ pageArchetype: 'hero', focalVisualPriority: 'primary', densityTier: 'balanced', transitionType: 'forward', heroEligible: true, whitespaceRatio: 0.36, maxCardsPerPage: 1, visualScale: 1.05 }),
      flow_restriction_bottleneck: compositionTemplate({ pageArchetype: 'explanation', focalVisualPriority: 'primary', densityTier: 'dense', transitionType: 'bridge', quietEligible: true, whitespaceRatio: 0.3, maxCardsPerPage: 1, visualScale: 0.95 }),
      steady_running: compositionTemplate({ pageArchetype: 'lived_experience', focalVisualPriority: 'supporting', densityTier: 'balanced', transitionType: 'forward', whitespaceRatio: 0.35, maxCardsPerPage: 2, visualScale: 0.9 }),
      magnetic_filter_capture: compositionTemplate({ pageArchetype: 'practical_work', focalVisualPriority: 'supporting', densityTier: 'balanced', transitionType: 'bridge', whitespaceRatio: 0.35, maxCardsPerPage: 2, visualScale: 0.92 }),
      sealed_system_pressure_window: compositionTemplate({ pageArchetype: 'reassurance', focalVisualPriority: 'supporting', densityTier: 'balanced', transitionType: 'forward', whitespaceRatio: 0.36, maxCardsPerPage: 2, visualScale: 0.9 }),
    },
    scenes: [
      {
        sectionId: 'system_fit_decision_map',
        sceneKind: 'current_system_explainer',
        title: 'Combi recommendation for this home profile',
        customerTakeaway: 'Atlas selected on-demand hot water where stored-volume overhead is not needed for this pattern.',
        whyItMatters: 'This keeps the setup aligned with practical demand while simplifying the system layout.',
        whatYouWillNotice: 'Hot water behaviour is framed around on-demand delivery rather than cylinder reserve cycles.',
        visualAssetId: 'system_fit_decision_map',
      },
      {
        sectionId: 'flow_restriction_bottleneck',
        sceneKind: 'route_rationale',
        title: 'Why this recommendation was made',
        customerTakeaway: 'Atlas checked flow bottlenecks so the chosen combi setup matches real supply behaviour.',
        whyItMatters: 'Recommendation quality depends on measured dynamic flow, not on static assumptions alone.',
        whatYouWillNotice: 'The explanation calls out mains-flow checks that protect practical shower performance.',
        visualAssetId: 'flow_restriction_bottleneck',
      },
      {
        sectionId: 'steady_running',
        sceneKind: 'lived_experience',
        title: 'Daily comfort expectations',
        customerTakeaway: 'The system is tuned for steady comfort with straightforward day-to-day use.',
        whyItMatters: 'Clear operating expectations help prevent over-adjustment and maintain predictable performance.',
        whatYouWillNotice: 'Daily operation should feel familiar, with fewer surprises around normal demand changes.',
        visualAssetId: 'weather_compensation_curve',
      },
      {
        sectionId: 'magnetic_filter_capture',
        sceneKind: 'protection_quality',
        title: 'Quality protection remains essential',
        customerTakeaway: 'Water-quality and debris controls still matter even on a simpler combi setup.',
        whyItMatters: 'Protection work prevents avoidable faults and supports long-term reliability.',
        whatYouWillNotice: 'Routine maintenance includes visible condition checks rather than only reactive fixes.',
        visualAssetId: 'magnetic_filter_capture',
      },
      {
        sectionId: 'sealed_system_pressure_window',
        sceneKind: 'future_flexibility',
        title: 'Prepared for later changes',
        customerTakeaway: 'This setup keeps a clear baseline so future efficiency decisions can be made with confidence.',
        whyItMatters: 'A stable, well-documented starting point makes future upgrade choices simpler.',
        whatYouWillNotice: 'Future advice can build on known system behaviour instead of guessing from scratch.',
        visualAssetId: 'system_pressure_window',
      },
    ],
  },
  heat_pump: {
    routeId: 'heat_pump',
    compositionBySectionId: {
      system_fit_decision_map: compositionTemplate({ pageArchetype: 'hero', focalVisualPriority: 'primary', densityTier: 'balanced', transitionType: 'forward', heroEligible: true, whitespaceRatio: 0.36, maxCardsPerPage: 1, visualScale: 1.05 }),
      warm_not_hot_radiators: compositionTemplate({ pageArchetype: 'explanation', focalVisualPriority: 'primary', densityTier: 'dense', transitionType: 'bridge', quietEligible: true, whitespaceRatio: 0.3, maxCardsPerPage: 1, visualScale: 0.96 }),
      steady_running: compositionTemplate({ pageArchetype: 'lived_experience', focalVisualPriority: 'supporting', densityTier: 'balanced', transitionType: 'forward', whitespaceRatio: 0.35, maxCardsPerPage: 2, visualScale: 0.92 }),
      winter_behaviour: compositionTemplate({ pageArchetype: 'practical_work', focalVisualPriority: 'supporting', densityTier: 'balanced', transitionType: 'bridge', whitespaceRatio: 0.35, maxCardsPerPage: 2, visualScale: 0.9 }),
      sealed_system_pressure_window: compositionTemplate({ pageArchetype: 'reassurance', focalVisualPriority: 'supporting', densityTier: 'balanced', transitionType: 'forward', whitespaceRatio: 0.36, maxCardsPerPage: 2, visualScale: 0.9 }),
    },
    scenes: [
      {
        sectionId: 'system_fit_decision_map',
        sceneKind: 'current_system_explainer',
        title: 'Transitioning to low-temperature heating',
        customerTakeaway: 'Atlas prepared this recommendation around your current home conditions and low-temperature emitter fit.',
        whyItMatters: 'A planned transition avoids comfort loss while introducing a different heating behaviour profile.',
        whatYouWillNotice: 'The walkthrough explains how your existing system context supports the heat-pump recommendation.',
        visualAssetId: 'system_fit_decision_map',
      },
      {
        sectionId: 'warm_not_hot_radiators',
        sceneKind: 'route_rationale',
        title: 'Why this heat-pump recommendation fits',
        customerTakeaway: 'Atlas chose this recommendation because warm-for-longer delivery can meet comfort with lower flow temperatures.',
        whyItMatters: 'Matching emitters and flow temperature is central to calm, efficient day-to-day heating.',
        whatYouWillNotice: 'Radiators may feel warm rather than very hot while rooms still reach target comfort.',
        visualAssetId: 'warm_vs_hot_radiators',
      },
      {
        sectionId: 'steady_running',
        sceneKind: 'lived_experience',
        title: 'What improves in daily operation',
        customerTakeaway: 'Steadier running and compensation smooth out temperature swings through the day.',
        whyItMatters: 'A stable rhythm supports comfort and reduces disruptive short cycling behaviour.',
        whatYouWillNotice: 'You should notice longer, calmer operating periods instead of frequent sharp bursts.',
        visualAssetId: 'weather_compensation_curve',
      },
      {
        sectionId: 'winter_behaviour',
        sceneKind: 'protection_quality',
        title: 'Winter behaviour and protection quality',
        customerTakeaway: 'Short defrost events are normal protective behaviour in cold, damp conditions.',
        whyItMatters: 'Understanding normal protection cycles prevents unnecessary concern during winter operation.',
        whatYouWillNotice: 'Brief pauses or mist can appear in cold weather and should clear as the cycle completes.',
        visualAssetId: '',
      },
      {
        sectionId: 'sealed_system_pressure_window',
        sceneKind: 'future_flexibility',
        title: 'Future flexibility after transition',
        customerTakeaway: 'This setup leaves room for future control tuning and incremental efficiency upgrades.',
        whyItMatters: 'A stable commissioned baseline makes future optimisation safer and easier to verify.',
        whatYouWillNotice: 'Future changes can be introduced gradually with measurable comfort checks.',
        visualAssetId: 'system_pressure_window',
      },
    ],
  },
};

const STORED_HOT_WATER_ARRANGEMENTS = new Set(['stored_unvented', 'stored_vented', 'mixergy', 'thermal_store']);

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function hasDarkSystemConditionSignal(input: BuildCustomerJourneyPackInputV1): boolean {
  const condition = input.surveyCondition;
  if (condition?.magneticDebrisEvidence === true) return true;
  const colour = condition?.bleedWaterColour?.toLowerCase() ?? '';
  return colour === 'black' || colour === 'brown';
}

function mapConceptTagsToSectionIds(tags: readonly EducationalConceptTagV1[]): string[] {
  const sectionIds: string[] = [];
  for (const tag of tags) {
    switch (tag) {
      case 'pressure_vs_storage':
        sectionIds.push('CON_C02');
        break;
      case 'warm_vs_hot_radiators':
        sectionIds.push('CON_E02', 'CON_H04', 'CON_E01');
        break;
      case 'stored_hot_water_recovery_timeline':
        sectionIds.push('CON_I01_DAY_TO_DAY', 'CON_C02');
        break;
      case 'flow_restriction_bottleneck':
        sectionIds.push('CON_D01');
        break;
      case 'powerflush_condition_led':
        sectionIds.push('CON_F04');
        break;
      case 'system_fit_decision_map':
        sectionIds.push('CON_A01');
        break;
      case 'magnetic_filter_capture':
        sectionIds.push('CON_F04');
        break;
      case 'sealed_system_pressure_window':
        sectionIds.push('CON_B03');
        break;
    }
  }
  return dedupeStrings(sectionIds);
}

function inferDefaultSectionIdsFromIntent(intent: RecommendationIntentCategoryV1): string[] {
  switch (intent) {
    case 'heat_pump_transition':
      return ['CON_E02', 'CON_E01', 'CON_H04', 'CON_H01'];
    case 'stored_hot_water':
      return ['CON_C02', 'CON_I01_DAY_TO_DAY', 'CON_B03'];
    case 'vented_to_unvented':
    case 'sealed_system_conversion':
      return ['CON_A01', 'CON_C02', 'CON_C01', 'CON_I01_DAY_TO_DAY', 'CON_B03'];
    case 'protection_upgrade':
      return ['CON_F04', 'CON_B03'];
    case 'combi_replacement':
      return ['CON_D01', 'CON_A01'];
    case 'efficiency_upgrade':
      return ['CON_A01', 'CON_B01'];
  }
}

function collectScopeAndEvidenceSignalText(input: BuildCustomerJourneyPackInputV1): string {
  const decisionScope = input.canonicalVisitPackage?.proposalTruth?.decision?.quoteScope ?? [];
  const visitRecommendation = resolveVisitEnvelope(input)?.recommendation;
  const requiredWork = visitRecommendation?.requiredWork ?? [];
  const reasons = visitRecommendation?.reasons ?? [];
  const evidence = visitRecommendation?.evidence ?? [];
  const includedItems = input.canonicalVisitPackage?.proposalTruth?.decision?.includedItems ?? [];
  const decisionRequiredWorks = input.canonicalVisitPackage?.proposalTruth?.decision?.requiredWorks ?? [];
  const compatibilityWarnings = input.canonicalVisitPackage?.proposalTruth?.decision?.compatibilityWarnings ?? [];
  const decisionReasons = input.canonicalVisitPackage?.proposalTruth?.decision?.keyReasons ?? [];
  const lines: string[] = [];
  for (const scopeItem of decisionScope) {
    lines.push(scopeItem.id, scopeItem.label);
    if (hasText(scopeItem.whatItDoes)) lines.push(scopeItem.whatItDoes);
    if (hasText(scopeItem.customerBenefit)) lines.push(scopeItem.customerBenefit);
    if (hasText(scopeItem.engineerNote)) lines.push(scopeItem.engineerNote);
  }
  for (const item of requiredWork) {
    lines.push(item.id, item.label);
    if (hasText(item.detail)) lines.push(item.detail);
  }
  for (const item of reasons) {
    lines.push(item.id, item.text);
  }
  for (const item of evidence) {
    lines.push(item.id, item.fieldPath, item.label, item.value);
  }
  lines.push(
    ...includedItems,
    ...decisionRequiredWorks,
    ...compatibilityWarnings,
    ...decisionReasons,
  );
  return lines.join(' ').toLowerCase();
}

function hasPowerflushScopeSignal(input: BuildCustomerJourneyPackInputV1): boolean {
  const haystack = collectScopeAndEvidenceSignalText(input);
  return /\b(powerflush|power flush|system flush|chemical clean|sludge)\b/i.test(haystack);
}

function hasFilterScopeSignal(input: BuildCustomerJourneyPackInputV1): boolean {
  const haystack = collectScopeAndEvidenceSignalText(input);
  return /\b(magnetic filter|filter replacement|system filter|filter capture|magnetite filter)\b/i.test(haystack);
}

function hasPressureFlowRecommendationSignal(input: BuildCustomerJourneyPackInputV1): boolean {
  const haystack = collectScopeAndEvidenceSignalText(input);
  return /\b(mains|flow|pressure|water pressure|water flow|dynamic flow|dynamic pressure)\b/i.test(haystack);
}

function resolveScenarioNarrativeRouteId(intent: RecommendationIntentCategoryV1): ScenarioNarrativeRouteIdV1 | undefined {
  switch (intent) {
    case 'vented_to_unvented':
      return 'regular_vented';
    case 'stored_hot_water':
    case 'sealed_system_conversion':
      return 'system_unvented';
    case 'combi_replacement':
      return 'combi';
    case 'heat_pump_transition':
      return 'heat_pump';
    default:
      return undefined;
  }
}

function buildDefaultStorySceneComposition(
  sceneKind: LibraryStorySceneKindV1 | undefined,
): LibraryStorySceneCompositionV1 {
  switch (sceneKind) {
    case 'current_system_explainer':
      return compositionTemplate({
        pageArchetype: 'explanation',
        focalVisualPriority: 'primary',
        densityTier: 'balanced',
        transitionType: 'forward',
        heroEligible: true,
      });
    case 'route_rationale':
    case 'physics_explainer':
      return compositionTemplate({
        pageArchetype: 'explanation',
        focalVisualPriority: 'primary',
        densityTier: 'dense',
        transitionType: 'bridge',
        quietEligible: true,
        whitespaceRatio: 0.31,
        maxCardsPerPage: 1,
        visualScale: 0.95,
      });
    case 'lived_experience':
      return compositionTemplate({
        pageArchetype: 'lived_experience',
        focalVisualPriority: 'supporting',
        densityTier: 'balanced',
        transitionType: 'forward',
      });
    case 'protection_quality':
      return compositionTemplate({
        pageArchetype: 'practical_work',
        focalVisualPriority: 'supporting',
        densityTier: 'balanced',
        transitionType: 'bridge',
      });
    case 'future_flexibility':
      return compositionTemplate({
        pageArchetype: 'reassurance',
        focalVisualPriority: 'supporting',
        densityTier: 'balanced',
        transitionType: 'forward',
      });
    default:
      return compositionTemplate({
        pageArchetype: 'explanation',
        focalVisualPriority: 'supporting',
        densityTier: 'balanced',
        transitionType: 'forward',
      });
  }
}

function buildQuietSceneSection(section: PortalJourneyPrintSectionV1): PortalJourneyPrintSectionV1 {
  return {
    contentId: `${QUIET_SCENE_CONTENT_ID_PREFIX}${section.sectionId}`,
    sectionId: `quiet_scene_${section.sectionId}`,
    heading: 'Good to know',
    summary: 'The recommendation has not changed. This page simply gives the main point room to breathe before the next section.',
    keyTakeaway: 'The recommendation remains the same.',
    reassurance: 'Your installer will still guide the practical steps during handover.',
    items: [
      'You can continue with confidence and review details at your own pace.',
    ],
    storyScene: {
      sceneKind: 'future_flexibility',
      title: 'Good to know',
      customerTakeaway: 'The recommendation has not changed.',
      whyItMatters: 'This page gives the main point room to breathe before the next section.',
      whatYouWillNotice: 'You will see a short pause page before moving to the next topic.',
      composition: compositionTemplate({
        pageArchetype: 'quiet',
        focalVisualPriority: 'none',
        densityTier: 'airy',
        transitionType: 'breather',
        quietEligible: false,
        whitespaceRatio: 0.55,
        maxCardsPerPage: 1,
        visualScale: 0.8,
      }),
    },
    evidenceTags: [{
      source: 'composition',
      metric: 'quiet_page',
      trigger: section.sectionId,
    }],
  };
}

function applyCompositionRhythmAndQuietPages(
  sections: readonly PortalJourneyPrintSectionV1[],
): PortalJourneyPrintSectionV1[] {
  let rhythmIndex = 0;
  const withRhythm = sections.map((section, index) => {
    const scene = section.storyScene ?? buildStorySceneFromSection(section);
    const baseComposition = scene.composition ?? buildDefaultStorySceneComposition(scene.sceneKind);
    let pageArchetype: PdfCompositionPageArchetypeV1;
    if (index === 0 && baseComposition.heroEligible) {
      pageArchetype = 'hero';
    } else if (baseComposition.pageArchetype === 'quiet') {
      pageArchetype = 'quiet';
    } else {
      pageArchetype = expectedRhythmForIndex(rhythmIndex);
      rhythmIndex += 1;
    }
    const composition: LibraryStorySceneCompositionV1 = {
      ...baseComposition,
      pageArchetype,
      focalVisualPriority: pageArchetype === 'hero' ? 'primary' : baseComposition.focalVisualPriority,
    };
    return {
      ...section,
      storyScene: {
        ...scene,
        composition,
      },
    };
  });

  const result: PortalJourneyPrintSectionV1[] = [];
  for (const section of withRhythm) {
    result.push(section);
    const composition = section.storyScene?.composition;
    if (composition?.densityTier === 'dense' && composition.quietEligible) {
      result.push(buildQuietSceneSection(section));
    }
  }
  return result;
}

function applyScenarioAuthoredNarrativePack(
  sections: readonly PortalJourneyPrintSectionV1[],
  routeId: ScenarioNarrativeRouteIdV1 | undefined,
): PortalJourneyPrintSectionV1[] {
  if (routeId == null) {
    return applyCompositionRhythmAndQuietPages(sections.map((section) => ({
      ...section,
      storyScene: section.storyScene ?? buildStorySceneFromSection(section),
    })));
  }
  const pack = SCENARIO_NARRATIVE_PACKS[routeId];
  const sceneBySectionId = new Map(pack.scenes.map((scene) => [scene.sectionId, scene]));

  return applyCompositionRhythmAndQuietPages(sections.map((section) => {
    const authoredScene = sceneBySectionId.get(section.sectionId);
    if (authoredScene == null) {
      const fallback = section.storyScene ?? buildStorySceneFromSection(section);
      return {
        ...section,
        storyScene: {
          ...fallback,
          composition: fallback.composition ?? buildDefaultStorySceneComposition(fallback.sceneKind),
        },
      };
    }
    return {
      ...section,
      storyScene: {
        sceneKind: authoredScene.sceneKind,
        title: authoredScene.title,
        customerTakeaway: authoredScene.customerTakeaway,
        whyItMatters: authoredScene.whyItMatters,
        whatYouWillNotice: authoredScene.whatYouWillNotice,
        visualAssetId: authoredScene.visualAssetId,
        composition: pack.compositionBySectionId[section.sectionId] ?? buildDefaultStorySceneComposition(authoredScene.sceneKind),
      },
    };
  }));
}

function applyJourneyTypeConceptFallback(
  journeyType: BuildPortalJourneyPrintModelInputV1['journeyType'],
  conceptTagSet: Set<EducationalConceptTagV1>,
): void {
  if (journeyType === 'heat_pump') {
    conceptTagSet.add('warm_vs_hot_radiators');
    return;
  }
  if (journeyType === 'open_vented' || journeyType === 'stored_hot_water' || journeyType === 'regular_unvented') {
    conceptTagSet.add('pressure_vs_storage');
    conceptTagSet.add('stored_hot_water_recovery_timeline');
    conceptTagSet.add('sealed_system_pressure_window');
    return;
  }
  if (journeyType === 'water_constraint') {
    conceptTagSet.add('flow_restriction_bottleneck');
  }
}

export function resolveRecommendationConceptSelection(
  input: BuildCustomerJourneyPackInputV1,
): RecommendationConceptSelectionV1 {
  const resolvedIntent = inferRecommendationIntentFromInput(input);
  const recommendation = resolveVisitEnvelope(input)?.recommendation;
  const surveyInput = resolveSurveyInput(input);
  const mains = resolveMainsSignals(surveyInput);
  const conceptTagSet = new Set<EducationalConceptTagV1>();
  const isHeatPumpIntent = resolvedIntent === 'heat_pump_transition';

  conceptTagSet.add('system_fit_decision_map');

  if (
    isHeatPumpIntent
    || recommendation?.heatSource === 'ashp'
    || recommendation?.heatSource === 'gshp'
    || (
      recommendation?.emitters?.existingRadiatorsCompatible === false
      && isHeatPumpIntent
    )
  ) {
    conceptTagSet.add('warm_vs_hot_radiators');
  }

  const hasStoredHotWaterRoute =
    STORED_HOT_WATER_ARRANGEMENTS.has(recommendation?.hotWaterArrangement ?? '')
    || STORED_HOT_WATER_ARRANGEMENTS.has(surveyInput?.dhwStorageType ?? '')
    || resolvedIntent === 'stored_hot_water'
    || resolvedIntent === 'vented_to_unvented'
    || resolvedIntent === 'sealed_system_conversion';

  if (hasStoredHotWaterRoute) {
    conceptTagSet.add('pressure_vs_storage');
    conceptTagSet.add('stored_hot_water_recovery_timeline');
    conceptTagSet.add('sealed_system_pressure_window');
  }

  if (isPoorMainsSupply(mains)) {
    conceptTagSet.add('flow_restriction_bottleneck');
  }
  if (hasPressureFlowRecommendationSignal(input)) {
    conceptTagSet.add('flow_restriction_bottleneck');
    conceptTagSet.add('sealed_system_pressure_window');
  }

  if (hasDarkSystemConditionSignal(input)) {
    conceptTagSet.add('magnetic_filter_capture');
    conceptTagSet.add('powerflush_condition_led');
  }
  if (hasPowerflushScopeSignal(input)) {
    conceptTagSet.add('powerflush_condition_led');
  }
  if (hasFilterScopeSignal(input)) {
    conceptTagSet.add('magnetic_filter_capture');
  }

  const hasStructuredSignals =
    input.visitEnvelope != null
    || input.canonicalVisitPackage != null;
  if (!hasStructuredSignals) {
    applyJourneyTypeConceptFallback(input.journeyType, conceptTagSet);
  }

  const conceptTags = [...conceptTagSet];
  const inferredSectionIds = mapConceptTagsToSectionIds(conceptTags);
  const selectedSectionIds = input.selectedSectionIds != null && input.selectedSectionIds.length > 0
    ? dedupeStrings(input.selectedSectionIds)
    : dedupeStrings([
      ...inferredSectionIds,
      ...inferDefaultSectionIdsFromIntent(resolvedIntent),
    ]);

  return {
    selectedSectionIds,
    conceptTags,
  };
}

function mergeRoutedSections(
  baseSections: PortalJourneyPrintSectionV1[],
  routedSections: PortalJourneyPrintSectionV1[],
): PortalJourneyPrintSectionV1[] {
  const merged: PortalJourneyPrintSectionV1[] = [];
  const seen = new Set<PortalJourneyPrintSectionV1['sectionId']>();
  for (const section of [...baseSections, ...routedSections]) {
    if (seen.has(section.sectionId)) continue;
    seen.add(section.sectionId);
    merged.push(section);
  }
  return merged;
}

function buildRoutedEducationalSections(input: {
  conceptTagSet: Set<EducationalConceptTagV1>;
}): PortalJourneyPrintSectionV1[] {
  const { conceptTagSet } = input;
  const conA01 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_A01');
  const conB03 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_B03');
  const conC02 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_C02');
  const conD01 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_D01');
  const conE01 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_E01');
  const conE02 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_E02');
  const conF04 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_F04');
  const conI01 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_I01_DAY_TO_DAY');
  const sections: PortalJourneyPrintSectionV1[] = [];

  if (conI01 != null && conceptTagSet.has('stored_hot_water_recovery_timeline')) {
    sections.push({
      contentId: conI01.id,
      sectionId: 'stored_hot_water_recovery_timeline',
      heading: 'Stored hot-water recovery timeline',
      summary: 'Stored hot water is a reserve-and-recovery pattern, not unlimited instantaneous output.',
      keyTakeaway: conI01.customerWording,
      reassurance: conI01.whatNotToWorryAbout,
      items: [
        conI01.whatYouMayNotice,
        conI01.whatStaysFamiliar,
        'Heavy draw periods are followed by recovery, and that behaviour is expected.',
      ],
      diagramCaption: 'Reserve use and recovery over a typical day.',
      diagramId: 'stored_hot_water_recovery_timeline',
      diagramRendererId: 'stored_hot_water_recovery_timeline',
    });
  }

  if (conD01 != null && conceptTagSet.has('flow_restriction_bottleneck')) {
    sections.push({
      contentId: conD01.id,
      sectionId: 'flow_restriction_bottleneck',
      heading: 'Flow restriction bottleneck',
      summary: conD01.oneLineSummary,
      keyTakeaway: conD01.customerWording,
      reassurance: conD01.whatNotToWorryAbout,
      items: [
        conD01.whatYouMayNotice,
        `Reality: ${conD01.reality}`,
        'Supply and pipework constraints are checked before appliance changes are proposed.',
      ],
      diagramCaption: 'Where a bottleneck limits outlet flow and overlap use.',
      diagramId: 'flow_restriction_bottleneck',
      diagramRendererId: 'flow_restriction_bottleneck',
    });
  }

  if (conE02 != null && conceptTagSet.has('warm_vs_hot_radiators')) {
    sections.push({
      contentId: conE02.id,
      sectionId: 'warm_not_hot_radiators',
      heading: 'Warm radiators and emitter fit',
      summary: conE02.oneLineSummary,
      keyTakeaway: conE02.customerWording,
      reassurance: conE02.whatNotToWorryAbout,
      items: [
        conE02.whatYouMayNotice,
        `Reality: ${conE02.reality}`,
        conE01 != null
          ? conE01.oneLineSummary
          : 'Emitter output should be matched to lower flow-temperature operation.',
      ],
      diagramCaption: 'Warm-for-longer operation compared with shorter hotter bursts.',
      diagramId: resolvePrintDiagramFromContentEntry(conE02),
      diagramRendererId: 'warm_vs_hot_radiators',
    });
  }

  if (conF04 != null && conceptTagSet.has('magnetic_filter_capture')) {
    sections.push({
      contentId: conF04.id,
      sectionId: 'magnetic_filter_capture',
      heading: 'Magnetic filter capture and system condition',
      summary: conF04.oneLineSummary,
      keyTakeaway: conF04.customerWording,
      reassurance: conF04.whatNotToWorryAbout,
      items: [
        conF04.whatYouMayNotice,
        `Reality: ${conF04.reality}`,
        'Filter capture supports protection planning, but does not replace full water treatment.',
      ],
      diagramCaption: 'Return-path debris capture before sensitive components.',
      diagramId: 'magnetic_filter_capture',
      diagramRendererId: 'magnetic_filter_capture',
    });
  }

  if (conF04 != null && conceptTagSet.has('powerflush_condition_led')) {
    sections.push({
      contentId: conF04.id,
      sectionId: 'powerflush_condition_led',
      heading: 'Powerflush and sludge removal',
      summary: 'Condition-led cleaning removes circulating sludge before protected operation and commissioning.',
      keyTakeaway: 'Powerflush removes sludge and helps protect new components.',
      reassurance: 'Cleaning work is a protective preparation step, not a sign that your recommendation has changed.',
      items: [
        'Powerflush clears sludge and debris that can restrict heat and flow performance.',
        'Cleaning is followed by protection dosing and commissioning checks.',
        'This protection work helps reduce repeat faults and supports long-term reliability.',
      ],
      diagramCaption: 'Condition-led cleaning path with sludge removal before recommissioning.',
      diagramId: 'powerflush_condition_led',
      diagramRendererId: 'powerflush_condition_led',
    });
  }

  if (conB03 != null && conceptTagSet.has('sealed_system_pressure_window')) {
    sections.push({
      contentId: conB03.id,
      sectionId: 'sealed_system_pressure_window',
      heading: 'Sealed-system pressure window',
      summary: conB03.oneLineSummary,
      keyTakeaway: conB03.customerWording,
      reassurance: conB03.whatNotToWorryAbout,
      items: [
        conB03.whatYouMayNotice,
        `Reality: ${conB03.reality}`,
        'Repeated pressure loss should be checked, not repeatedly topped up without diagnosis.',
      ],
      diagramCaption: 'Healthy operating pressure band versus low/high warning zones.',
      diagramId: 'system_pressure_window',
      diagramRendererId: 'system_pressure_window',
    });
  }

  if (conA01 != null && conceptTagSet.has('system_fit_decision_map')) {
    sections.push({
      contentId: conA01.id,
      sectionId: 'system_fit_decision_map',
      heading: 'System fit decision map',
      summary: 'Atlas routes system fit from measured evidence and household demand, not one-size-fits-all assumptions.',
      keyTakeaway: conA01.customerWording,
      reassurance: 'The selected route reflects measured constraints and practical installation fit for this home.',
      items: [
        'Recommendation authority remains with the engine; this section explains the evidence path only.',
        'Mains limits, demand overlap, and system condition are assessed together before route selection.',
        'Educational explainers clarify why this route fits and what to expect day to day.',
      ],
      diagramCaption: 'How measured constraints route to a suitable system-fit outcome.',
      diagramId: 'system_fit_decision_map',
      diagramRendererId: 'system_fit_decision_map',
    });
  }

  if (conC02 != null && conceptTagSet.has('pressure_vs_storage')) {
    sections.push({
      contentId: conC02.id,
      sectionId: 'pressure_vs_storage',
      heading: 'Why stored hot water helps',
      summary: conC02.oneLineSummary,
      keyTakeaway: conC02.customerWording,
      reassurance: conC02.whatNotToWorryAbout,
      items: [
        conC02.whatYouMayNotice,
        `Reality: ${conC02.reality}`,
        'Pressure and available stored volume are checked separately in route evidence.',
      ],
      diagramCaption: 'Pressure force and storage amount shown as separate constraints.',
      diagramId: resolvePrintDiagramFromContentEntry(conC02),
      diagramRendererId: 'pressure_vs_storage',
    });
  }

  return sections;
}

function buildGenericRecommendationContent(input: {
  conceptTagSet: Set<EducationalConceptTagV1>;
}): Pick<PortalJourneyPrintModelV1, 'sections' | 'nextSteps' | 'qrDestinations'> {
  const sections = buildRoutedEducationalSections({ conceptTagSet: input.conceptTagSet });
  if (sections.length === 0) {
    sections.push(
      ...buildRoutedEducationalSections({
        conceptTagSet: new Set<EducationalConceptTagV1>(['system_fit_decision_map']),
      }),
    );
  }

  const nextSteps: PortalJourneyPrintNextStepV1[] = [
    {
      label: 'Pre-install review',
      body: 'Your installer will review the routed evidence and confirm the practical installation plan for your home.',
    },
    {
      label: 'Installation day',
      body: 'Your installer will explain the selected route, key changes, and expected day-to-day behaviour at handover.',
    },
    {
      label: 'After handover',
      body: 'Keep this evidence summary for reference and contact your installer if lived outcomes differ from expectation.',
    },
  ];

  const qrDestinations: PortalJourneyPrintQrDestinationV1[] = [
    {
      heading: 'How Atlas routed this evidence',
      note: 'A plain-language walkthrough of demand, mains, condition, and system-fit evidence used for this recommendation.',
    },
    {
      heading: 'Lived experience explainers',
      note: 'What to expect from hot water, radiators, and day-to-day operation after installation.',
    },
    {
      heading: 'System condition and protection guidance',
      note: 'How pressure windows, filter capture, and maintenance signals link to reliable operation.',
    },
  ];

  return { sections, nextSteps, qrDestinations };
}

function buildStoredHotWaterSectionsAndNextSteps(
  conceptTagSet: Set<EducationalConceptTagV1>,
): Pick<PortalJourneyPrintModelV1, 'sections' | 'nextSteps' | 'qrDestinations'> {
  const routeConceptTags = new Set(conceptTagSet);
  routeConceptTags.add('system_fit_decision_map');
  routeConceptTags.add('pressure_vs_storage');
  routeConceptTags.add('stored_hot_water_recovery_timeline');
  routeConceptTags.add('magnetic_filter_capture');
  routeConceptTags.add('sealed_system_pressure_window');

  const sections = orderSectionsByRoutePriority(
    buildRoutedEducationalSections({ conceptTagSet: routeConceptTags }),
    [
      'system_fit_decision_map',
      'pressure_vs_storage',
      'stored_hot_water_recovery_timeline',
      'powerflush_condition_led',
      'magnetic_filter_capture',
      'sealed_system_pressure_window',
    ],
  );
  const nextSteps: PortalJourneyPrintNextStepV1[] = [
    {
      label: 'Installation plan',
      body: 'Your installer will confirm cylinder location, controls, and the expected hot-water recovery pattern before work starts.',
    },
    {
      label: 'Handover walkthrough',
      body: 'At handover you will see how stored hot water, filter protection, and the pressure gauge fit into day-to-day use.',
    },
    {
      label: 'After the first busy day',
      body: 'It is normal to see stored hot water recover after peak use. Contact your installer if recovery or pressure behaviour does not match the walkthrough.',
    },
  ];
  const qrDestinations: PortalJourneyPrintQrDestinationV1[] = [
    {
      heading: 'Stored hot water and recovery',
      note: 'A plain-language guide to reserve volume, recovery time, and overlap use.',
    },
    {
      heading: 'System protection checks',
      note: 'Why filter capture, water quality, and pressure checks protect long-term performance.',
    },
    {
      heading: 'What to expect after installation',
      note: 'A short refresher on controls, recovery timing, and normal day-to-day behaviour.',
    },
  ];

  return { sections, nextSteps, qrDestinations };
}

function buildCombiSectionsAndNextSteps(
  conceptTagSet: Set<EducationalConceptTagV1>,
): Pick<PortalJourneyPrintModelV1, 'sections' | 'nextSteps' | 'qrDestinations'> {
  const routeConceptTags = new Set(conceptTagSet);
  routeConceptTags.add('system_fit_decision_map');
  routeConceptTags.add('flow_restriction_bottleneck');
  routeConceptTags.add('magnetic_filter_capture');
  routeConceptTags.add('sealed_system_pressure_window');

  const sections = orderSectionsByRoutePriority(
    buildRoutedEducationalSections({ conceptTagSet: routeConceptTags }),
    [
      'system_fit_decision_map',
      'flow_restriction_bottleneck',
      'steady_running',
      'powerflush_condition_led',
      'magnetic_filter_capture',
      'sealed_system_pressure_window',
    ],
  );
  const conI01 = atlasMvpContentMapRegistry.find((entry) => entry.id === 'CON_I01_DAY_TO_DAY');
  if (conI01 != null) {
    const flowSectionIndex = sections.findIndex((section) => section.sectionId === 'flow_restriction_bottleneck');
    const steadyRunningInsertIndex = flowSectionIndex >= 0 ? flowSectionIndex + 1 : sections.length;
    sections.splice(steadyRunningInsertIndex, 0, {
      contentId: conI01.id,
      sectionId: 'steady_running',
      heading: 'How day-to-day comfort stays steady',
      summary: 'A combi works best when water flow and room-heating controls are kept stable and predictable.',
      keyTakeaway: 'Daily comfort should feel straightforward, with clear limits set by the incoming water supply.',
      reassurance: 'Small changes in incoming mains conditions can be normal and do not always signal a fault.',
      items: [
        conI01.whatYouMayNotice,
        'Hot water starts on demand, without a stored cylinder to refill first.',
        'Keeping settings steady helps the boiler respond calmly to normal household use.',
      ],
      diagramCaption: 'Steady controls and supply conditions support predictable day-to-day comfort.',
      diagramId: 'weather_compensation_curve',
      diagramRendererId: 'weather_compensation_curve',
    });
  }

  const nextSteps: PortalJourneyPrintNextStepV1[] = [
    {
      label: 'Before installation',
      body: 'Your installer will confirm mains-flow checks, boiler position, and any flue or condensate changes before work begins.',
    },
    {
      label: 'On handover day',
      body: 'You will see how on-demand hot water behaves, where to check system pressure, and what normal operation sounds like.',
    },
    {
      label: 'Questions after the first week',
      body: 'Contact your installer if hot water delivery or heating response differs from the handover explanation.',
    },
  ];
  const qrDestinations: PortalJourneyPrintQrDestinationV1[] = [
    {
      heading: 'Combi hot-water flow checks',
      note: 'Why incoming supply limits shape shower and tap performance on a combi.',
    },
    {
      heading: 'System pressure and routine checks',
      note: 'A simple guide to the pressure gauge, filling loop, and routine support checks.',
    },
    {
      heading: 'Water-quality protection',
      note: 'Why filter capture and clean water still matter on a combi system.',
    },
  ];

  return { sections, nextSteps, qrDestinations };
}

function orderSectionsByRoutePriority(
  sections: readonly PortalJourneyPrintSectionV1[],
  orderedSectionIds: readonly PortalJourneyPrintSectionV1['sectionId'][],
): PortalJourneyPrintSectionV1[] {
  const rankBySectionId = new Map(orderedSectionIds.map((sectionId, index) => [sectionId, index]));
  return [...sections]
    .map((section, index) => ({ section, index }))
    .sort((a, b) => {
      const aRank = rankBySectionId.get(a.section.sectionId) ?? Number.MAX_SAFE_INTEGER;
      const bRank = rankBySectionId.get(b.section.sectionId) ?? Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;
      return a.index - b.index;
    })
    .map(({ section }) => section);
}

function buildOpenVentedSectionsAndNextSteps(
  selectedSet: Set<string>,
  conceptTagSet: Set<EducationalConceptTagV1>,
): Pick<PortalJourneyPrintModelV1, 'sections' | 'nextSteps' | 'qrDestinations'> {
  const conA01 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_A01');
  const conC01 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_C01');
  const conC02 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_C02');

  if (!conA01 || !conC01 || !conC02) {
    throw new Error(
      'buildPortalJourneyPrintModel: required content entries CON_A01, CON_C01, CON_C02 missing from registry',
    );
  }

  const sections: PortalJourneyPrintSectionV1[] = [];
  if (selectedSet.has('CON_A01') || selectedSet.size === 0) {
    sections.push({
      contentId: 'CON_A01',
      sectionId: 'practical_outcomes',
      heading: 'Practical outcomes',
      summary:
        'You move from tank-fed hot water to a sealed heating circuit with an unvented cylinder.',
      keyTakeaway: 'The upgrade changes hardware, not your comfort goals.',
      reassurance: 'Your installer walks you through every new visible part on handover day.',
      items: [
        'The loft tank is no longer needed.',
        'A pressure gauge and filling loop are added near the boiler.',
        'Hot water is stored in a cylinder, ready for busy times.',
      ],
      diagramCaption: 'Before and after: tank-fed layout to sealed + unvented layout.',
      diagramId: resolvePrintDiagramFromContentEntry(conA01),
      diagramRendererId: 'open_vented_to_unvented',
    });
  }

  if (selectedSet.has('CON_C02') || selectedSet.size === 0) {
    sections.push({
      contentId: 'CON_C02',
      sectionId: 'pressure_vs_storage',
      heading: 'Why stored hot water helps',
      summary:
        'Pressure affects spray strength, while stored volume decides how long hot water can keep up.',
      keyTakeaway: 'Strong pressure and enough stored hot water are two separate needs.',
      reassurance: 'If hot water dips after heavy use, recovery is normal and expected.',
      items: [
        'A good shower feel does not mean unlimited hot-water volume.',
        'Stored hot water supports overlap use like two showers close together.',
        'The cylinder reheats in the background after heavy demand.',
      ],
      diagramCaption: 'Pressure (force) and storage (amount) shown as separate controls.',
      diagramId: resolvePrintDiagramFromContentEntry(conC02),
      diagramRendererId: 'pressure_vs_storage',
    });
  }

  if (selectedSet.has('CON_C01') || selectedSet.size === 0) {
    sections.push({
      contentId: 'CON_C01',
      sectionId: 'unvented_safety',
      heading: 'How the cylinder keeps itself safe',
      summary:
        'Unvented cylinders include built-in safety controls that are required and normal to see.',
      keyTakeaway: 'Visible safety parts are expected in a compliant setup.',
      reassurance: 'Seeing a tundish or discharge pipe does not mean something is wrong.',
      items: [
        'The cylinder has pressure and temperature safety protection.',
        'A visible tundish and discharge route is part of safe design.',
        'Call your installer if you ever see repeated discharge.',
      ],
      diagramCaption: 'Safety path from cylinder to discharge point.',
      diagramId: resolvePrintDiagramFromContentEntry(conC01),
      diagramRendererId: 'open_vented_to_unvented',
    });
  }

  const nextSteps: PortalJourneyPrintNextStepV1[] = [
    {
      label: 'Your appointment',
      body: 'Your engineer will walk through each change on installation day and answer any questions before work begins.',
    },
    {
      label: 'System handover',
      body: 'At the end of installation you will receive a brief handover covering controls, pressure gauge, and the cylinder location.',
    },
    {
      label: 'Questions',
      body: 'Bring this document to your appointment or scan the QR code below to explore each topic in more detail.',
    },
  ];

  const qrDestinations: PortalJourneyPrintQrDestinationV1[] = [
    {
      heading: 'Pressure and stored hot water — deeper detail',
      note: 'Diagram-guided walkthrough of how pressure and storage work independently.',
    },
    {
      heading: 'Sealed system conversion — step by step',
      note: 'What is removed, what replaces it, and what the new circuit looks like.',
    },
    {
      heading: 'Unvented cylinder safety devices',
      note: 'What each safety device does and when to contact your installer.',
    },
  ];

  const routeConceptTags = new Set(conceptTagSet);
  routeConceptTags.add('system_fit_decision_map');
  routeConceptTags.add('stored_hot_water_recovery_timeline');
  routeConceptTags.add('sealed_system_pressure_window');

  return {
    sections: orderSectionsByRoutePriority(
      mergeRoutedSections(sections, buildRoutedEducationalSections({ conceptTagSet: routeConceptTags })),
      [
        'practical_outcomes',
        'system_fit_decision_map',
        'stored_hot_water_recovery_timeline',
        'powerflush_condition_led',
        'unvented_safety',
        'sealed_system_pressure_window',
        'pressure_vs_storage',
      ],
    ),
    nextSteps,
    qrDestinations,
  };
}

function buildHeatPumpSectionsAndNextSteps(
  selectedSet: Set<string>,
  conceptTagSet: Set<EducationalConceptTagV1>,
  signals: {
    allowWarmRadiatorSection: boolean;
    allowDefrostSection: boolean;
  },
): Pick<PortalJourneyPrintModelV1, 'sections' | 'nextSteps' | 'qrDestinations'> {
  const conE02 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_E02');
  const conE01 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_E01');
  const conH01 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_H01');
  const conH04 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_H04');
  const conG01 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_G01');

  if (!conE02 || !conE01 || !conH01 || !conH04 || !conG01) {
    throw new Error(
      'buildPortalJourneyPrintModel: required content entries CON_E01, CON_E02, CON_H01, CON_H04, CON_G01 missing from registry',
    );
  }

  const sections: PortalJourneyPrintSectionV1[] = [];

  if ((selectedSet.has('CON_E02') || selectedSet.size === 0) && signals.allowWarmRadiatorSection) {
    sections.push({
      contentId: 'CON_E02',
      sectionId: 'warm_not_hot_radiators',
      heading: 'Why radiators may feel warm, not hot',
      summary: conE02.oneLineSummary,
      keyTakeaway: 'Warm radiators can still deliver full comfort when the system is tuned correctly.',
      reassurance: conE02.whatNotToWorryAbout,
      items: [
        conE02.whatYouMayNotice,
        `Reality: ${conE02.reality}`,
        selectedSet.has('CON_E01')
          ? conE01.oneLineSummary
          : 'Comfort is measured by room temperature, not only radiator surface feel.',
      ],
      diagramCaption: 'Warm-for-longer operation compared with shorter hotter bursts.',
      diagramId: resolvePrintDiagramFromContentEntry(conE02),
      diagramRendererId: 'warm_vs_hot_radiators',
    });
  }

  if (selectedSet.has('CON_H04') || selectedSet.has('CON_G01') || selectedSet.size === 0) {
    sections.push({
      contentId: 'CON_H04',
      sectionId: 'steady_running',
      heading: 'How steady running works',
      summary: conH04.oneLineSummary,
      keyTakeaway: 'Steady low-temperature running and compensation are designed to reduce abrupt swings.',
      reassurance: conG01.whatNotToWorryAbout,
      items: [
        conH04.customerWording,
        conG01.whatYouMayNotice,
        conG01.whatStaysFamiliar,
      ],
      // No renderer-specific diagram exists for compensation curve yet.
      diagramId: resolvePrintDiagramFromContentEntry(conG01),
    });
  }

  if ((selectedSet.has('CON_H01') || selectedSet.size === 0) && signals.allowDefrostSection) {
    sections.push({
      contentId: 'CON_H01',
      sectionId: 'winter_behaviour',
      heading: 'What happens in winter',
      summary: conH01.oneLineSummary,
      keyTakeaway: 'Short defrost cycles can be normal winter behaviour and should recover automatically.',
      reassurance: conH01.whatNotToWorryAbout,
      items: [
        conH01.whatYouMayNotice,
        `Reality: ${conH01.reality}`,
        'Brief mist around the outdoor unit can be expected in cold damp conditions.',
      ],
    });
  }

  const nextSteps: PortalJourneyPrintNextStepV1[] = [
    {
      label: 'Your recommendation',
      body: 'Your installer will confirm controls, compensation setup, and expected heat-pump running pattern at handover.',
    },
    {
      label: 'First winter checks',
      body: 'Short defrost periods and warm radiators can be normal. Contact your installer if comfort does not recover.',
    },
    {
      label: 'Questions',
      body: 'Use the QR links below if you want deeper guidance on warm radiators, winter behaviour, and controls.',
    },
  ];

  const qrDestinations: PortalJourneyPrintQrDestinationV1[] = [
    {
      heading: 'Warm radiators in low-temperature systems',
      note: 'Why warm-not-hot operation can still deliver full room comfort.',
    },
    {
      heading: 'Heat pump defrost in winter',
      note: 'How normal defrost cycles look and when to ask for a review.',
    },
    {
      heading: 'Compensation and steady running',
      note: 'How weather and load compensation supports stable day-to-day comfort.',
    },
  ];

  const routeConceptTags = new Set(conceptTagSet);
  routeConceptTags.add('system_fit_decision_map');
  routeConceptTags.add('sealed_system_pressure_window');

  return {
    sections: orderSectionsByRoutePriority(
      mergeRoutedSections(sections, buildRoutedEducationalSections({ conceptTagSet: routeConceptTags })),
      [
        'system_fit_decision_map',
        'warm_not_hot_radiators',
        'steady_running',
        'winter_behaviour',
        'sealed_system_pressure_window',
      ],
    ),
    nextSteps,
    qrDestinations,
  };
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function inferRecommendationSummary(input: BuildCustomerJourneyPackInputV1): string {
  if (hasText(input.recommendationSummary)) return input.recommendationSummary;
  const customerSummary = input.canonicalVisitPackage?.proposalTruth?.customerSummary;
  if (customerSummary != null && hasText(customerSummary.recommendedSystemLabel) && hasText(customerSummary.headline)) {
    return `${customerSummary.recommendedSystemLabel}: ${customerSummary.headline}`;
  }
  const visitRecommendation = input.visitEnvelope?.recommendation;
  if (visitRecommendation != null && visitRecommendation.reasons.length > 0) {
    return visitRecommendation.reasons[0].text;
  }
  return 'Your recommendation is based on surveyed home conditions and Atlas evidence.';
}

function inferCustomerFacts(input: BuildCustomerJourneyPackInputV1): string[] {
  if (Array.isArray(input.customerFacts)) return [...input.customerFacts];
  const fromPackage = input.canonicalVisitPackage;
  if (fromPackage != null) {
    const facts: string[] = [];
    const survey = fromPackage.surveyDraft;
    if (survey.occupancyCount != null && survey.occupancyCount > 0) {
      facts.push(`${survey.occupancyCount}-person household`);
    }
    if (survey.bathroomCount != null && survey.bathroomCount > 0) {
      facts.push(`${survey.bathroomCount} bathroom${survey.bathroomCount === 1 ? '' : 's'}`);
    }
    for (const fact of fromPackage.customerPropertyDetails.propertyFacts ?? []) {
      if (hasText(fact)) facts.push(fact);
    }
    return facts.slice(0, 3);
  }
  return [];
}

// ─── Recommendation intent resolution ────────────────────────────────────────

/**
 * Context used to resolve the primary recommendation intent.
 *
 * Pass as much as is available; fields are checked in priority order.
 * Recommended-system fields take precedence over current-system fields.
 */
export interface RecommendationIntentContextV1 {
  /** Type of the recommended scenario — from ScenarioResult.system.type */
  recommendedScenarioType?: string;
  /** Heat source of the recommended system — from FinalPresentationPayload.heatSource */
  recommendedHeatSource?: string;
  /** Scenario ID of the accepted recommendation (may contain 'ashp', 'combi', etc.) */
  recommendedScenarioId?: string;
  /** Hot-water arrangement of the recommended system */
  hotWaterArrangement?: string;
  /** Current (pre-install) heat source type */
  currentHeatSourceType?: string;
  /** Current (pre-install) heating system topology */
  currentSystemHeatingType?: string;
  /** Current DHW storage type */
  dhwStorageType?: string;
}

function isHeatPumpRecommendation(ctx: RecommendationIntentContextV1): boolean {
  const hpSources = ['ashp', 'gshp'];
  if (ctx.recommendedScenarioType != null && hpSources.includes(ctx.recommendedScenarioType)) return true;
  if (ctx.recommendedHeatSource != null && hpSources.includes(ctx.recommendedHeatSource)) return true;
  const scenarioId = ctx.recommendedScenarioId?.toLowerCase() ?? '';
  return scenarioId.includes('ashp') || scenarioId.includes('heat_pump') || scenarioId.includes('gshp');
}

function isCombiRecommendation(ctx: RecommendationIntentContextV1): boolean {
  if (ctx.recommendedScenarioType === 'combi') return true;
  if (ctx.hotWaterArrangement === 'on_demand') return true;
  const combiSources = ['gas_combi', 'oil_combi'];
  if (ctx.recommendedHeatSource != null && combiSources.includes(ctx.recommendedHeatSource)) return true;
  const scenarioId = ctx.recommendedScenarioId?.toLowerCase() ?? '';
  return scenarioId.includes('combi');
}

function isVentedToUnvented(ctx: RecommendationIntentContextV1): boolean {
  const wasOpenVented =
    ctx.currentSystemHeatingType === 'open_vented' || ctx.dhwStorageType === 'vented';
  const becomesStored =
    ctx.hotWaterArrangement === 'stored_unvented'
    || ctx.hotWaterArrangement === 'mixergy'
    || ctx.hotWaterArrangement === 'thermal_store'
    || ctx.recommendedScenarioType === 'system'
    || ctx.recommendedScenarioType === 'regular';
  return wasOpenVented && becomesStored;
}

/**
 * resolveRecommendationIntentCategory
 *
 * Derives the primary recommendation intent from all available context.
 * The intent determines section priority, inclusion, and practical-outcome
 * ordering in the customer PDF.
 *
 * Recommended-system signals always take precedence over current-system signals
 * so that, for example, an open-vented home getting an ASHP renders heat-pump
 * outcomes first, not cylinder/tundish explainers.
 */
export function resolveRecommendationIntentCategory(
  ctx: RecommendationIntentContextV1,
): RecommendationIntentCategoryV1 {
  if (isHeatPumpRecommendation(ctx)) return 'heat_pump_transition';
  if (isCombiRecommendation(ctx)) return 'combi_replacement';
  if (isVentedToUnvented(ctx)) return 'vented_to_unvented';
  const storedArrangements = ['stored_unvented', 'stored_vented', 'mixergy', 'thermal_store'];
  if (storedArrangements.includes(ctx.hotWaterArrangement ?? '')) {
    return 'stored_hot_water';
  }
  if (ctx.recommendedScenarioType === 'system' || ctx.recommendedScenarioType === 'regular') {
    return 'sealed_system_conversion';
  }
  // Current-system fallback: when no recommended-system signals are present, derive intent
  // from the existing topology so that legacy inputs without a resolved scenario still
  // produce the correct journey type (preserving backward compatibility).
  const hasRecommendedSignal =
    ctx.recommendedScenarioType != null
    || ctx.recommendedHeatSource != null
    || (ctx.recommendedScenarioId != null && ctx.recommendedScenarioId.length > 0)
    || ctx.hotWaterArrangement != null;
  if (!hasRecommendedSignal) {
    const hpCurrentSources = ['ashp', 'gshp'];
    if (ctx.currentHeatSourceType != null && hpCurrentSources.includes(ctx.currentHeatSourceType)) {
      return 'heat_pump_transition';
    }
    if (ctx.dhwStorageType === 'vented' || ctx.currentSystemHeatingType === 'open_vented') {
      return 'vented_to_unvented';
    }
  }
  return 'efficiency_upgrade';
}

/** Maps a primary intent category to the journey type used for section selection. */
function intentToJourneyType(
  intent: RecommendationIntentCategoryV1,
): NonNullable<BuildPortalJourneyPrintModelInputV1['journeyType']> {
  switch (intent) {
    case 'heat_pump_transition': return 'heat_pump';
    case 'combi_replacement': return 'generic_recommendation_summary';
    case 'vented_to_unvented': return 'open_vented';
    case 'stored_hot_water': return 'stored_hot_water';
    case 'sealed_system_conversion': return 'open_vented';
    case 'protection_upgrade': return 'generic_recommendation_summary';
    case 'efficiency_upgrade': return 'generic_recommendation_summary';
  }
}

/**
 * inferCustomerJourneyTypeFromSystemContext
 *
 * Resolves the journey type from system context.  Accepts both the current
 * system signals and optional recommended-system signals.  When the recommended
 * system can be identified, it takes precedence over the existing topology so
 * that, for example, an open-vented home getting a heat pump renders heat-pump
 * practical outcomes rather than open-vented cylinder sections.
 *
 * Pass recommendedScenarioType / recommendedHeatSource / recommendedScenarioId
 * whenever the accepted scenario is known at the call site.
 */
export function inferCustomerJourneyTypeFromSystemContext(input: {
  currentHeatSourceType?: string;
  currentSystemHeatingType?: string;
  dhwStorageType?: string;
  recommendedScenarioType?: string;
  recommendedHeatSource?: string;
  recommendedScenarioId?: string;
  hotWaterArrangement?: string;
}): NonNullable<BuildPortalJourneyPrintModelInputV1['journeyType']> {
  const ctx: RecommendationIntentContextV1 = {
    recommendedScenarioType: input.recommendedScenarioType,
    recommendedHeatSource: input.recommendedHeatSource,
    recommendedScenarioId: input.recommendedScenarioId,
    hotWaterArrangement: input.hotWaterArrangement,
    currentHeatSourceType: input.currentHeatSourceType,
    currentSystemHeatingType: input.currentSystemHeatingType,
    dhwStorageType: input.dhwStorageType,
  };
  return intentToJourneyType(resolveRecommendationIntentCategory(ctx));
}

function inferRecommendationIntentFromInput(input: BuildCustomerJourneyPackInputV1): RecommendationIntentCategoryV1 {
  if (input.recommendationIntent != null) return input.recommendationIntent;
  const visitEnvelope = resolveVisitEnvelope(input);
  const recommendation = visitEnvelope?.recommendation;
  const surveyInput = resolveSurveyInput(input);
  const proposalTruth = input.canonicalVisitPackage?.proposalTruth;
  return resolveRecommendationIntentCategory({
    recommendedHeatSource: recommendation?.heatSource,
    recommendedScenarioId: proposalTruth?.selectedScenarioId ?? proposalTruth?.decision?.recommendedScenarioId,
    hotWaterArrangement: recommendation?.hotWaterArrangement,
    currentHeatSourceType: surveyInput?.currentHeatSourceType,
    currentSystemHeatingType: input.canonicalVisitPackage?.surveyDraft?.currentSystem?.heatingSystemType,
    dhwStorageType: surveyInput?.dhwStorageType,
  });
}

function inferLibrarySupportedExplainers(sections: readonly PortalJourneyPrintSectionV1[]): CustomerJourneyLibraryExplainerV1[] {
  const explainers: CustomerJourneyLibraryExplainerV1[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    if (seen.has(section.contentId)) continue;
    seen.add(section.contentId);
    const entry = atlasMvpContentMapRegistry.find((candidate) => candidate.id === section.contentId);
    if (entry == null) continue;
    explainers.push({
      contentId: entry.id,
      title: entry.title,
      summary: entry.oneLineSummary,
    });
  }
  return explainers;
}

function inferLiveExperienceExplanations(
  input: BuildCustomerJourneyPackInputV1,
  staticPdfModel: PortalJourneyPrintModelV1,
): string[] {
  if (input.liveExperienceExplanations != null) {
    return [...input.liveExperienceExplanations].filter(hasText).slice(0, 4);
  }
  return staticPdfModel.sections
    .map((section) => section.keyTakeaway)
    .filter(hasText)
    .slice(0, 4);
}

const FALLBACK_REASON_MATCH_PHRASE = 'educational evidence route';
const GENERIC_STORY_SCENE_TITLES = new Set([
  'title',
  'summary',
  'overview',
  'recommendation',
  'your recommendation',
  'recommended option',
  'story scene',
]);
const BANNED_STORY_SCENE_LANGUAGE = /\batlas[\s_-]*mapped\b|\bprojection\b|\btaxonomy\b|\bdigest\b|\bconcept id\b/i;
const INTERNAL_SCENE_PHRASES = [
  'cognitive load',
  'dense technical',
  'spacing',
  'comprehension',
  'breather page',
  'routed evidence',
  'route',
  'story scene',
  'composition',
  'archetype',
  'projection',
  'taxonomy',
] as const;
const GENERIC_ROUTE_FALLBACK_PHRASES = [
  'generic recommendation summary',
  'your recommendation is based on surveyed home conditions and atlas evidence',
  FALLBACK_REASON_MATCH_PHRASE,
] as const;
const ROUTE_REQUIREMENT_LABELS: Record<CustomerPdfRouteRequirementIdV1, string> = {
  recommendation_hero: 'Recommendation hero',
  current_system_explanation: 'Current system explanation',
  why_this_route_fits: 'Why this route fits',
  what_changes_day_to_day: 'What changes day to day',
  protection_system_condition: 'Protection / system condition',
  next_steps: 'Next steps',
};
const MIN_WHAT_YOU_WILL_NOTICE_LENGTH = 24;
const MIN_STORY_SCENE_TITLE_LENGTH = 8;
const MIN_STORY_SCENE_TAKEAWAY_LENGTH = 20;
const MAX_SCENES_PER_CUSTOMER_PDF = 8;
const MAX_SCENE_TEXT_CHARS = 220;
const MAX_TOTAL_SCENE_TEXT_CHARS = 2000;
const SCENE_OVERLAP_THRESHOLD = 0.9;
const MIN_SEMANTIC_TOKEN_COUNT = 6;
const MIN_COMPOSITION_WHITESPACE_RATIO = 0.28;
const DENSE_TO_DENSE_WHITESPACE_RATIO = 0.33;
const MIN_PRINT_VISUAL_SCALE = 0.75;
const MAX_PRINT_VISUAL_SCALE = 1.15;
const MAX_CARDS_PER_PAGE = 3;
/**
 * Deterministic page rhythm for customer comprehension:
 * explain first, then lived experience, then practical work, then reassurance.
 */
const EXPECTED_RHYTHM_SEQUENCE: PdfCompositionPageArchetypeV1[] = ['explanation', 'lived_experience', 'practical_work', 'reassurance'];
export const QUIET_SCENE_CONTENT_ID_PREFIX = 'COMPOSITION_QUIET_';
const VAGUE_WHAT_YOU_WILL_NOTICE = [
  'you will notice improvements',
  'you will notice a difference',
  'you will notice better comfort',
  'you will notice better efficiency',
  'you will notice better performance',
  'notice improvements',
  'general improvement',
];
const BLOCKING_STORY_SCENE_ERROR_CODES = new Set([
  'generic_title',
  'empty_takeaway',
  'takeaway_repeats_title',
  'internal_why_it_matters_language',
  'banned_internal_language',
  'vague_household_outcome',
  'missing_required_visual_asset',
  'non_manifest_visual_asset',
  'visual_not_pdf_approved',
  'visual_not_pdf_supported',
  'composition_archetype_not_allowed',
  'visual_renderer_unresolved',
  'scene_internal_design_language',
  'scenario_visual_asset_manifest_missing',
  'multiple_core_messages',
  'duplicate_or_overlapping_scene',
  'scene_page_budget_exceeded',
  'scene_text_budget_exceeded',
  'missing_composition_contract',
  'composition_missing_primary_visual',
  'composition_multiple_primary_visuals',
  'composition_whitespace_below_minimum',
  'composition_card_wall',
  'composition_visual_scale_out_of_range',
  'composition_dense_transition_missing_breather',
  'composition_rhythm_break',
]);
const VISUAL_REQUIRED_SCENE_KINDS = new Set<LibraryStorySceneKindV1>(['physics_explainer', 'lived_experience']);
const VISUAL_ASSET_MANIFEST_IDS = new Set(listManifestAssetIds());
const STORY_SCENE_TOKEN_STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'your', 'you', 'are', 'can',
  'will', 'what', 'why', 'how', 'when', 'into', 'over', 'after', 'before', 'more',
  'less', 'than', 'have', 'has', 'had', 'but', 'not', 'still', 'while', 'home',
  'system', 'atlas',
]);

export interface CustomerStorySceneValidationIssueV1 {
  code: string;
  message: string;
}

export interface CustomerStorySceneValidationResultV1 {
  warnings: CustomerStorySceneValidationIssueV1[];
  errors: CustomerStorySceneValidationIssueV1[];
}

interface StorySceneCompositionValidationResultV1 {
  warnings: CustomerStorySceneValidationIssueV1[];
  errors: CustomerStorySceneValidationIssueV1[];
}

function normaliseTextForComparison(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function countSentenceLikeClauses(value: string): number {
  return value
    .split(/[.!?]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .length;
}

function hasMultipleCoreMessages(value: string): boolean {
  return countSentenceLikeClauses(value) > 1;
}

function sceneTextLength(scene: LibraryStorySceneV1): number {
  return [
    scene.title,
    scene.customerTakeaway,
    scene.whyItMatters,
    scene.whatYouWillNotice,
  ]
    .map((segment) => segment.trim().length)
    .reduce((total, segmentLength) => total + segmentLength, 0);
}

function toSceneSemanticTokenSet(scene: LibraryStorySceneV1): Set<string> {
  const raw = `${scene.title} ${scene.customerTakeaway} ${scene.whyItMatters} ${scene.whatYouWillNotice}`;
  const tokens = normaliseTextForComparison(raw).split(' ');
  const filtered = tokens.filter((token) => token.length > 2 && !STORY_SCENE_TOKEN_STOP_WORDS.has(token));
  return new Set(filtered);
}

function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  return intersection / Math.min(a.size, b.size);
}

function scenesSemanticallyOverlap(a: LibraryStorySceneV1, b: LibraryStorySceneV1): boolean {
  const titleA = normaliseTextForComparison(a.title);
  const titleB = normaliseTextForComparison(b.title);
  if (titleA.length > 0 && titleA === titleB) return true;
  const takeawayA = normaliseTextForComparison(a.customerTakeaway);
  const takeawayB = normaliseTextForComparison(b.customerTakeaway);
  if (takeawayA.length > 0 && takeawayA === takeawayB) return true;
  const tokensA = toSceneSemanticTokenSet(a);
  const tokensB = toSceneSemanticTokenSet(b);
  const tokenOverlap = overlapRatio(tokensA, tokensB);
  const semanticSampleSize = Math.min(tokensA.size, tokensB.size);
  return semanticSampleSize >= MIN_SEMANTIC_TOKEN_COUNT && tokenOverlap >= SCENE_OVERLAP_THRESHOLD;
}

function buildStorySceneValidationIssue(
  code: string,
  message: string,
): CustomerStorySceneValidationIssueV1 {
  return { code, message };
}

function findInternalPhrasesInText(text: string): string[] {
  const lowerText = text.toLowerCase();
  return INTERNAL_SCENE_PHRASES.filter((phrase) =>
    phrase === 'route'
      ? /\broute\b/.test(lowerText)
      : lowerText.includes(phrase));
}

function findSceneInternalPhrases(scene: LibraryStorySceneV1): string[] {
  return findInternalPhrasesInText(
    `${scene.title} ${scene.customerTakeaway} ${scene.whyItMatters} ${scene.whatYouWillNotice}`,
  );
}

function collectScenarioNarrativeVisualAssetIds(): string[] {
  return dedupeStrings(
    Object.values(SCENARIO_NARRATIVE_PACKS).flatMap((pack) =>
      pack.scenes.flatMap((scene) => (hasText(scene.visualAssetId) ? [scene.visualAssetId] : []))),
  );
}

export function listScenarioNarrativeVisualAssetIds(): string[] {
  return collectScenarioNarrativeVisualAssetIds();
}

function buildCustomerPdfVisualCoverageAudit(): CustomerPdfVisualCoverageAuditV1 {
  const isTextOnlyScene = (scene: CustomerPdfVisualCoverageSceneV1): boolean =>
    scene.classification !== 'lego_technic_canonical' || !scene.rendererAvailability.hasDiagramRenderer;
  const routes = Object.values(SCENARIO_NARRATIVE_PACKS).map((pack) => {
    const scenes = pack.scenes.map((scene) => {
      const rendererAvailability = getVisualAssetRendererAvailability(scene.visualAssetId);
      const requestedRendererType: CustomerPdfSceneDiagnosticV1['rendererType'] = rendererAvailability.hasDiagramRenderer
        ? 'diagram_component'
        : rendererAvailability.hasPrintFallback
          ? 'print_fallback'
          : 'none';
      const visualDecision = resolveLegoTechnicCustomerVisualDecision({
        visualId: scene.visualAssetId,
        rendererUsed: requestedRendererType,
        surface: 'customer_pdf',
      });
      return {
        sectionId: scene.sectionId,
        requestedVisualAssetId: scene.visualAssetId,
        classification: visualDecision.classification,
        rendererAvailability,
        blockedReason: visualDecision.blockedReason,
      };
    });

    const canonicalVisualsAvailable = dedupeStrings(scenes
      .filter((scene) => scene.classification === 'lego_technic_canonical' && scene.rendererAvailability.hasDiagramRenderer)
      .map((scene) => scene.requestedVisualAssetId));
    const retiredVisualsRequested = dedupeStrings(scenes
      .filter((scene) => scene.classification === 'retired_non_physical')
      .map((scene) => scene.requestedVisualAssetId));
    const nonCanonicalOrUnavailableVisuals = dedupeStrings(scenes
      .filter(isTextOnlyScene)
      .map((scene) => scene.requestedVisualAssetId));
    const textOnlySceneSectionIds = dedupeStrings(scenes
      .filter(isTextOnlyScene)
      .map((scene) => scene.sectionId)) as PortalJourneyPrintSectionV1['sectionId'][];

    return {
      routeId: pack.routeId,
      requiredStorySceneSectionIds: pack.scenes.map((scene) => scene.sectionId),
      requestedVisualAssetIds: dedupeStrings(pack.scenes.map((scene) => scene.visualAssetId)),
      scenes,
      summary: {
        canonicalVisualsAvailable,
        missingCanonicalVisuals: nonCanonicalOrUnavailableVisuals,
        retiredVisualsRequested,
        textOnlySceneSectionIds,
      },
    };
  });
  return { routes };
}

function validateStorySceneComposition(
  scene: LibraryStorySceneV1,
  section: PortalJourneyPrintSectionV1,
): StorySceneCompositionValidationResultV1 {
  const warnings: CustomerStorySceneValidationIssueV1[] = [];
  const errors: CustomerStorySceneValidationIssueV1[] = [];
  const composition = scene.composition;
  if (composition == null) {
    errors.push(buildStorySceneValidationIssue(
      'missing_composition_contract',
      'Story scene is missing composition contract metadata.',
    ));
    return { warnings, errors };
  }
  if (hasText(scene.visualAssetId)) {
    const manifestEntry = getVisualAssetManifestEntry(scene.visualAssetId);
    if (
      manifestEntry != null
      && !manifestEntry.allowedCompositionArchetypes.includes(composition.pageArchetype)
    ) {
      errors.push(buildStorySceneValidationIssue(
        'composition_archetype_not_allowed',
        `Visual asset "${scene.visualAssetId}" is not allowed on "${composition.pageArchetype}" composition pages.`,
      ));
    }
  }
  if (composition.focalVisualPriority === 'primary' && !hasText(scene.visualAssetId)) {
    errors.push(buildStorySceneValidationIssue(
      'composition_missing_primary_visual',
      'Primary focal pages must include a canonical visual asset.',
    ));
  }
  if (isQuietSectionId(section.sectionId) && (composition.focalVisualPriority !== 'none' || hasText(scene.visualAssetId))) {
    errors.push(buildStorySceneValidationIssue(
      'composition_multiple_primary_visuals',
      'Quiet pages must not carry a primary visual focal point.',
    ));
  }
  if (composition.whitespaceRatio < MIN_COMPOSITION_WHITESPACE_RATIO) {
    errors.push(buildStorySceneValidationIssue(
      'composition_whitespace_below_minimum',
      'Composition whitespace ratio is below the minimum budget.',
    ));
  }
  if (composition.maxCardsPerPage > MAX_CARDS_PER_PAGE) {
    errors.push(buildStorySceneValidationIssue(
      'composition_card_wall',
      'Composition allows too many cards and risks stacked-card wall layout.',
    ));
  }
  if (composition.visualScale < MIN_PRINT_VISUAL_SCALE || composition.visualScale > MAX_PRINT_VISUAL_SCALE) {
    errors.push(buildStorySceneValidationIssue(
      'composition_visual_scale_out_of_range',
      'Composition visual scale is outside print-safe bounds.',
    ));
  }
  if (composition.pageArchetype === 'hero' && !composition.heroEligible) {
    warnings.push(buildStorySceneValidationIssue(
      'composition_hero_without_eligibility',
      'Hero archetype used on a scene not marked hero eligible.',
    ));
  }
  return { warnings, errors };
}

function expectedRhythmForIndex(index: number): PdfCompositionPageArchetypeV1 {
  return EXPECTED_RHYTHM_SEQUENCE[index % EXPECTED_RHYTHM_SEQUENCE.length];
}

function isQuietSectionId(sectionId: PortalJourneyPrintSectionV1['sectionId']): boolean {
  return sectionId === 'quiet_scene' || sectionId.startsWith('quiet_scene_');
}

export function validateCustomerStoryScene(
  scene: LibraryStorySceneV1,
  options?: {
    visualAssetRequired?: boolean;
  },
): CustomerStorySceneValidationResultV1 {
  const warnings: CustomerStorySceneValidationIssueV1[] = [];
  const errors: CustomerStorySceneValidationIssueV1[] = [];
  const title = scene.title.trim();
  const takeaway = scene.customerTakeaway.trim();
  const whyItMatters = scene.whyItMatters.trim();
  const whatYouWillNotice = scene.whatYouWillNotice.trim();
  const customerFacingSceneText = `${title} ${takeaway} ${whyItMatters} ${whatYouWillNotice}`;
  const normalisedTitle = normaliseTextForComparison(title);
  const normalisedTakeaway = normaliseTextForComparison(takeaway);

  if (GENERIC_STORY_SCENE_TITLES.has(normalisedTitle)) {
    errors.push(buildStorySceneValidationIssue(
      'generic_title',
      'Story scene title is too generic for customer export.',
    ));
  }
  if (!hasText(takeaway)) {
    errors.push(buildStorySceneValidationIssue(
      'empty_takeaway',
      'Story scene takeaway is empty.',
    ));
  }
  if (hasText(takeaway) && normalisedTakeaway === normalisedTitle) {
    errors.push(buildStorySceneValidationIssue(
      'takeaway_repeats_title',
      'Story scene takeaway repeats the title instead of adding outcome detail.',
    ));
  }
  if (BANNED_STORY_SCENE_LANGUAGE.test(whyItMatters)) {
    errors.push(buildStorySceneValidationIssue(
      'internal_why_it_matters_language',
      'Story scene why-it-matters contains internal routing language.',
    ));
  }
  if (BANNED_STORY_SCENE_LANGUAGE.test(customerFacingSceneText)) {
    errors.push(buildStorySceneValidationIssue(
      'banned_internal_language',
      'Story scene includes blocked internal pipeline wording.',
    ));
  }
  const internalPhrases = findSceneInternalPhrases(scene);
  if (internalPhrases.length > 0) {
    errors.push(buildStorySceneValidationIssue(
      'scene_internal_design_language',
      `Story scene contains internal design wording: ${internalPhrases.join(', ')}.`,
    ));
  }
  if (
    whatYouWillNotice.length < MIN_WHAT_YOU_WILL_NOTICE_LENGTH
    || VAGUE_WHAT_YOU_WILL_NOTICE.some((phrase) => whatYouWillNotice.toLowerCase().includes(phrase))
  ) {
    errors.push(buildStorySceneValidationIssue(
      'vague_household_outcome',
      'Story scene what-you-will-notice is too vague for customer export.',
    ));
  }
  const visualAssetRequiredByKind =
    scene.sceneKind != null && VISUAL_REQUIRED_SCENE_KINDS.has(scene.sceneKind);
  const visualAssetRequired = options?.visualAssetRequired === true || visualAssetRequiredByKind;
  if (visualAssetRequired && !hasText(scene.visualAssetId)) {
    errors.push(buildStorySceneValidationIssue(
      'missing_required_visual_asset',
      'Story scene requires a visual asset ID for this concept.',
    ));
  }
  if (hasText(scene.visualAssetId) && !VISUAL_ASSET_MANIFEST_IDS.has(scene.visualAssetId)) {
    errors.push(buildStorySceneValidationIssue(
      'non_manifest_visual_asset',
      'Story scene visual asset is not declared in the canonical visual manifest.',
    ));
  }
  if (hasText(scene.visualAssetId) && !isApprovedCustomerPdfVisualAssetId(scene.visualAssetId)) {
    errors.push(buildStorySceneValidationIssue(
      'visual_not_pdf_approved',
      `Story scene visual asset "${scene.visualAssetId}" is not approved in the customer PDF visual registry.`,
    ));
  }
  if (hasText(scene.visualAssetId)) {
    const manifestEntry = getVisualAssetManifestEntry(scene.visualAssetId);
    const visualDecision = resolveLegoTechnicCustomerVisualDecision({
      visualId: scene.visualAssetId,
      rendererUsed: manifestEntry?.rendererStrategy === 'print_fallback'
        ? 'print_fallback'
        : 'diagram_component',
      surface: 'customer_pdf',
    });
    if (manifestEntry != null && !manifestEntry.supportedSurfaces.includes('pdf')) {
      errors.push(buildStorySceneValidationIssue(
        'visual_not_pdf_supported',
        `Story scene visual asset "${scene.visualAssetId}" is not supported on PDF.`,
      ));
    }
    if (!visualDecision.allowed) {
      errors.push(buildStorySceneValidationIssue(
        'visual_not_lego_technic_canonical',
        visualDecision.blockedReason
          ?? `Story scene visual asset "${scene.visualAssetId}" is blocked for customer PDF rendering.`,
      ));
    }
  }
  if (
    hasMultipleCoreMessages(scene.customerTakeaway)
    || hasMultipleCoreMessages(scene.whyItMatters)
    || hasMultipleCoreMessages(scene.whatYouWillNotice)
  ) {
    errors.push(buildStorySceneValidationIssue(
      'multiple_core_messages',
      'Story scene must keep one core message per page.',
    ));
  }
  if (
    takeaway.length > MAX_SCENE_TEXT_CHARS
    || whyItMatters.length > MAX_SCENE_TEXT_CHARS
    || whatYouWillNotice.length > MAX_SCENE_TEXT_CHARS
  ) {
    errors.push(buildStorySceneValidationIssue(
      'scene_text_budget_exceeded',
      'Story scene exceeds the per-scene text budget.',
    ));
  }
  if (title.length < MIN_STORY_SCENE_TITLE_LENGTH) {
    warnings.push(buildStorySceneValidationIssue(
      'short_title',
      'Story scene title is unusually short.',
    ));
  }
  if (takeaway.length > 0 && takeaway.length < MIN_STORY_SCENE_TAKEAWAY_LENGTH) {
    warnings.push(buildStorySceneValidationIssue(
      'short_takeaway',
      'Story scene takeaway is short and may under-explain the outcome.',
    ));
  }

  return { warnings, errors };
}

interface ValidatedStorySceneEntryV1 {
  section: PortalJourneyPrintSectionV1;
  scene: LibraryStorySceneV1;
  validation: CustomerStorySceneValidationResultV1;
  compositionValidation: StorySceneCompositionValidationResultV1;
  hasAllRequiredText: boolean;
  rendererType: CustomerPdfSceneDiagnosticV1['rendererType'];
  visualClassification: LegoTechnicCustomerVisualClassification | 'unlisted';
  offendingPhrases: string[];
}

function hasGenericRouteFallbackCopy(values: readonly string[]): boolean {
  const text = values
    .filter(hasText)
    .map((value) => value.trim().toLowerCase())
    .join(' ');
  return GENERIC_ROUTE_FALLBACK_PHRASES.some((phrase) => text.includes(phrase));
}

function getSceneTextFields(scene: LibraryStorySceneV1): string[] {
  return [
    scene.title,
    scene.customerTakeaway,
    scene.whyItMatters,
    scene.whatYouWillNotice,
  ];
}

function uniqueReasons(reasons: readonly string[]): string[] {
  return dedupeStrings(reasons.filter(hasText));
}

function buildSceneRouteRequirement(input: {
  requirementId: CustomerPdfRouteRequirementIdV1;
  entry: ValidatedStorySceneEntryV1 | undefined;
  visualRequired?: boolean;
}): CustomerPdfRouteCompletenessRequirementV1 {
  const label = ROUTE_REQUIREMENT_LABELS[input.requirementId];
  if (input.entry == null) {
    return {
      requirementId: input.requirementId,
      label,
      visualRequired: input.visualRequired ?? false,
      present: false,
      blocked: true,
      usesGenericFallbackCopy: false,
      reasons: [`Missing ${label.toLowerCase()}.`],
    };
  }

  const { entry } = input;
  const visualRequired = input.visualRequired ?? (
    entry.scene.composition?.focalVisualPriority === 'primary'
    || (entry.scene.sceneKind != null && VISUAL_REQUIRED_SCENE_KINDS.has(entry.scene.sceneKind))
    || hasText(entry.scene.visualAssetId)
  );
  const genericFallback =
    entry.validation.errors.some((issue) => issue.code === 'generic_title')
    || hasGenericRouteFallbackCopy(getSceneTextFields(entry.scene));
  const reasons = uniqueReasons([
    ...entry.validation.errors.map((issue) => issue.message),
    ...entry.compositionValidation.errors.map((issue) => issue.message),
    ...(entry.hasAllRequiredText ? [] : [`${label} is missing required customer-safe text.`]),
    ...(entry.offendingPhrases.length > 0
      ? [`${label} contains internal wording: ${entry.offendingPhrases.join(', ')}.`]
      : []),
    ...(visualRequired && entry.rendererType === 'none'
      ? [`${label} requires a canonical visual for customer PDF export.`]
      : []),
    ...(genericFallback ? [`${label} is still using generic fallback copy.`] : []),
  ]);

  return {
    requirementId: input.requirementId,
    label,
    sectionId: entry.section.sectionId,
    sceneKind: entry.scene.sceneKind,
    title: entry.scene.title,
    takeaway: entry.scene.customerTakeaway,
    visualAssetId: entry.scene.visualAssetId,
    rendererType: entry.rendererType,
    visualRequired,
    present: true,
    blocked: reasons.length > 0,
    usesGenericFallbackCopy: genericFallback,
    reasons,
  };
}

function buildSystemProtectionRouteRequirement(input: {
  entry: ValidatedStorySceneEntryV1 | undefined;
  systemProtection: SystemProtectionSummaryV1 | undefined;
}): CustomerPdfRouteCompletenessRequirementV1 {
  if (input.entry != null) {
    return buildSceneRouteRequirement({
      requirementId: 'protection_system_condition',
      entry: input.entry,
    });
  }

  const label = ROUTE_REQUIREMENT_LABELS['protection_system_condition'];
  const systemProtection = input.systemProtection;
  if (systemProtection == null) {
    return {
      requirementId: 'protection_system_condition',
      label,
      visualRequired: false,
      present: false,
      blocked: true,
      usesGenericFallbackCopy: false,
      reasons: [`Missing ${label.toLowerCase()}.`],
    };
  }

  const internalPhrases = findInternalPhrasesInText([
    systemProtection.title,
    systemProtection.customerSummary,
    systemProtection.whyItMatters,
    systemProtection.whatInstallerWillCheck,
    ...systemProtection.customerVisibleBullets,
  ].join(' '));
  const genericFallback = hasGenericRouteFallbackCopy([
    systemProtection.title,
    systemProtection.customerSummary,
    systemProtection.whyItMatters,
    systemProtection.whatInstallerWillCheck,
  ]);
  const reasons = uniqueReasons([
    ...(hasText(systemProtection.title) ? [] : [`${label} is missing a customer-safe title.`]),
    ...(hasText(systemProtection.customerSummary) ? [] : [`${label} is missing a specific takeaway.`]),
    ...(internalPhrases.length > 0
      ? [`${label} contains internal wording: ${internalPhrases.join(', ')}.`]
      : []),
    ...(genericFallback ? [`${label} is still using generic fallback copy.`] : []),
  ]);

  return {
    requirementId: 'protection_system_condition',
    label,
    sectionId: 'system_protection',
    title: systemProtection.title,
    takeaway: systemProtection.customerSummary,
    visualRequired: false,
    present: true,
    blocked: reasons.length > 0,
    usesGenericFallbackCopy: genericFallback,
    reasons,
  };
}

function buildNextStepsRouteRequirement(
  nextSteps: readonly PortalJourneyPrintNextStepV1[],
): CustomerPdfRouteCompletenessRequirementV1 {
  const label = ROUTE_REQUIREMENT_LABELS['next_steps'];
  const genericFallback = hasGenericRouteFallbackCopy(nextSteps.flatMap((step) => [step.label, step.body]));
  const internalPhrases = findInternalPhrasesInText(nextSteps.flatMap((step) => [step.label, step.body]).join(' '));
  const reasons = uniqueReasons([
    ...(nextSteps.length > 0 ? [] : [`Missing ${label.toLowerCase()}.`]),
    ...(nextSteps.every((step) => hasText(step.label) && hasText(step.body))
      ? []
      : [`${label} is missing a customer-safe title or specific takeaway.`]),
    ...(internalPhrases.length > 0
      ? [`${label} contains internal wording: ${internalPhrases.join(', ')}.`]
      : []),
    ...(genericFallback ? [`${label} is still using generic fallback copy.`] : []),
  ]);

  return {
    requirementId: 'next_steps',
    label,
    sectionId: 'next_steps',
    title: nextSteps[0]?.label,
    takeaway: nextSteps[0]?.body,
    visualRequired: false,
    present: nextSteps.length > 0,
    blocked: reasons.length > 0,
    usesGenericFallbackCopy: genericFallback,
    reasons,
  };
}

function buildCustomerPdfRouteCompletenessAudit(input: {
  routeId: ScenarioNarrativeRouteIdV1 | undefined;
  validatedStoryScenes: readonly ValidatedStorySceneEntryV1[];
  nextSteps: readonly PortalJourneyPrintNextStepV1[];
  systemProtection: SystemProtectionSummaryV1 | undefined;
}): CustomerPdfRouteCompletenessAuditV1 | undefined {
  if (input.routeId == null) return undefined;

  const findByKind = (sceneKind: LibraryStorySceneKindV1) =>
    input.validatedStoryScenes.find((entry) => entry.scene.sceneKind === sceneKind);
  const heroEntry = input.validatedStoryScenes.find((entry) => entry.scene.composition?.pageArchetype === 'hero');

  const requirements: CustomerPdfRouteCompletenessRequirementV1[] = [
    buildSceneRouteRequirement({
      requirementId: 'recommendation_hero',
      entry: heroEntry,
      visualRequired: true,
    }),
    buildSceneRouteRequirement({
      requirementId: 'current_system_explanation',
      entry: findByKind('current_system_explainer'),
      visualRequired: true,
    }),
    buildSceneRouteRequirement({
      requirementId: 'why_this_route_fits',
      entry: findByKind('route_rationale'),
      visualRequired: true,
    }),
    buildSceneRouteRequirement({
      requirementId: 'what_changes_day_to_day',
      entry: findByKind('lived_experience'),
      visualRequired: true,
    }),
    buildSystemProtectionRouteRequirement({
      entry: findByKind('protection_quality'),
      systemProtection: input.systemProtection,
    }),
    buildNextStepsRouteRequirement(input.nextSteps),
  ];

  const missingRequirementIds = requirements
    .filter((requirement) => !requirement.present)
    .map((requirement) => requirement.requirementId);
  const blockedRequirementIds = requirements
    .filter((requirement) => requirement.present && requirement.blocked)
    .map((requirement) => requirement.requirementId);
  const genericFallbackRequirementIds = requirements
    .filter((requirement) => requirement.usesGenericFallbackCopy)
    .map((requirement) => requirement.requirementId);

  return {
    routeId: input.routeId,
    ready: missingRequirementIds.length === 0 && blockedRequirementIds.length === 0 && genericFallbackRequirementIds.length === 0,
    missingRequirementIds,
    blockedRequirementIds,
    genericFallbackRequirementIds,
    requirements,
  };
}

function buildCustomerPdfContentSource(input: {
  audienceProjectionPresent: boolean;
  routeId: ScenarioNarrativeRouteIdV1 | undefined;
  conceptTags: readonly EducationalConceptTagV1[];
  sections: readonly PortalJourneyPrintSectionV1[];
  recommendationReasons: readonly RecommendationReasonBlockV1[];
  nextSteps: readonly PortalJourneyPrintNextStepV1[];
  systemProtection: SystemProtectionSummaryV1 | undefined;
}): CustomerPdfContentSourceV1 {
  const scenarioVisualAssetIds = collectScenarioNarrativeVisualAssetIds();
  const missingScenarioManifestAssetIds = scenarioVisualAssetIds.filter((assetId) =>
    !VISUAL_ASSET_MANIFEST_IDS.has(assetId));
  const validatedStoryScenes: ValidatedStorySceneEntryV1[] = input.sections.map((section) => {
    const scene = section.storyScene ?? buildStorySceneFromSection(section);
    const visualAssetRequired = hasText(section.diagramRendererId) || hasText(section.diagramId);
    const validation = validateCustomerStoryScene(scene, { visualAssetRequired });
    const compositionValidation = validateStorySceneComposition(scene, section);
    const offendingPhrases = findSceneInternalPhrases(scene);
    const rendererAvailability = hasText(scene.visualAssetId)
      ? getVisualAssetRendererAvailability(scene.visualAssetId)
      : { hasDiagramRenderer: false, hasPrintFallback: false };
    const manifestEntry = hasText(scene.visualAssetId)
      ? getLegoTechnicCustomerVisualManifestEntry(scene.visualAssetId)
      : undefined;
    const requestedRendererType: CustomerPdfSceneDiagnosticV1['rendererType'] = rendererAvailability.hasDiagramRenderer
      ? 'diagram_component'
      : rendererAvailability.hasPrintFallback
        ? 'print_fallback'
        : 'none';
    const visualDecision = resolveLegoTechnicCustomerVisualDecision({
      visualId: scene.visualAssetId,
      rendererUsed: requestedRendererType,
      surface: 'customer_pdf',
    });
    const rendererType: CustomerPdfSceneDiagnosticV1['rendererType'] =
      visualDecision.allowed && rendererAvailability.hasDiagramRenderer
        ? 'diagram_component'
        : 'none';
    if (hasText(scene.visualAssetId) && rendererAvailability.hasDiagramRenderer === false) {
      validation.errors.push(buildStorySceneValidationIssue(
        'visual_renderer_unresolved',
        `Visual asset "${scene.visualAssetId}" has no canonical diagram renderer for customer PDF export.`,
      ));
    }
    const hasAllRequiredText =
      hasText(scene.title)
      && hasText(scene.customerTakeaway)
      && hasText(scene.whyItMatters)
      && hasText(scene.whatYouWillNotice);
    return {
      section,
      scene,
      validation,
      compositionValidation,
      hasAllRequiredText,
      rendererType,
      visualClassification: manifestEntry?.classification ?? visualDecision.classification,
      offendingPhrases,
    };
  });
  const acceptedStorySceneEntries: ValidatedStorySceneEntryV1[] = [];
  let duplicateOrOverlappingSceneCount = 0;
  for (const entry of validatedStoryScenes) {
    if (
      !entry.hasAllRequiredText
      || entry.validation.errors.length > 0
      || entry.compositionValidation.errors.length > 0
    ) continue;
    const overlapsExisting = acceptedStorySceneEntries.some((acceptedEntry) =>
      scenesSemanticallyOverlap(acceptedEntry.scene, entry.scene));
    if (overlapsExisting) {
      duplicateOrOverlappingSceneCount += 1;
      continue;
    }
    acceptedStorySceneEntries.push(entry);
  }
  const globalErrorCodes: string[] = [];
  if (duplicateOrOverlappingSceneCount > 0) {
    globalErrorCodes.push('duplicate_or_overlapping_scene');
  }
  if (missingScenarioManifestAssetIds.length > 0) {
    globalErrorCodes.push('scenario_visual_asset_manifest_missing');
  }
  let storyScenes = acceptedStorySceneEntries.map((entry) => entry.scene);
  if (storyScenes.length > MAX_SCENES_PER_CUSTOMER_PDF) {
    storyScenes = storyScenes.slice(0, MAX_SCENES_PER_CUSTOMER_PDF);
    globalErrorCodes.push('scene_page_budget_exceeded');
  }
  let sceneTextBudgetRejectedCount = 0;
  const textBudgetScenes: LibraryStorySceneV1[] = [];
  let totalSceneTextChars = 0;
  for (const scene of storyScenes) {
    const nextLength = sceneTextLength(scene);
    if (totalSceneTextChars + nextLength > MAX_TOTAL_SCENE_TEXT_CHARS) {
      sceneTextBudgetRejectedCount += 1;
      continue;
    }
    textBudgetScenes.push(scene);
    totalSceneTextChars += nextLength;
  }
  if (sceneTextBudgetRejectedCount > 0) {
    globalErrorCodes.push('scene_text_budget_exceeded');
  }
  storyScenes = textBudgetScenes;
  const compositionWarningCount = validatedStoryScenes.reduce(
    (total, entry) => total + entry.compositionValidation.warnings.length,
    0,
  );
  let compositionErrorCount = validatedStoryScenes.reduce(
    (total, entry) => total + entry.compositionValidation.errors.length,
    0,
  );
  const acceptedSectionKeys = new Set(
    acceptedStorySceneEntries.map((entry) => JSON.stringify([entry.section.sectionId, entry.section.contentId])),
  );
  const acceptedSections = input.sections.filter((section) =>
    acceptedSectionKeys.has(JSON.stringify([section.sectionId, section.contentId])),
  );
  const sceneDiagnostics: CustomerPdfSceneDiagnosticV1[] = validatedStoryScenes.map((entry) => ({
    sectionId: entry.section.sectionId,
    visualAssetId: entry.scene.visualAssetId,
    visualClassification: entry.visualClassification,
    rendererType: entry.rendererType,
    fallbackUsed: false,
    blockingReasons: [
      ...entry.validation.errors.map((issue) => issue.message),
      ...entry.compositionValidation.errors.map((issue) => issue.message),
    ],
    offendingPhrases: entry.offendingPhrases,
  }));
  let rhythmIndex = 0;
  for (let i = 0; i < acceptedStorySceneEntries.length; i += 1) {
    const entry = acceptedStorySceneEntries[i];
    const composition = entry.scene.composition;
    if (composition == null) continue;
    if (composition.densityTier === 'dense' && i < acceptedStorySceneEntries.length - 1) {
      const nextComposition = acceptedStorySceneEntries[i + 1].scene.composition;
      if (
        nextComposition?.densityTier === 'dense'
        && composition.transitionType !== 'breather'
        && nextComposition.transitionType !== 'breather'
        && (composition.whitespaceRatio < DENSE_TO_DENSE_WHITESPACE_RATIO || nextComposition.whitespaceRatio < DENSE_TO_DENSE_WHITESPACE_RATIO)
      ) {
        compositionErrorCount += 1;
        globalErrorCodes.push('composition_dense_transition_missing_breather');
      }
    }
    if (!isQuietSectionId(entry.section.sectionId) && composition.pageArchetype !== 'hero') {
      const expected = expectedRhythmForIndex(rhythmIndex);
      rhythmIndex += 1;
      if (composition.pageArchetype !== expected) {
        compositionErrorCount += 1;
        globalErrorCodes.push('composition_rhythm_break');
      }
    }
  }
  const quietPages = acceptedSections.filter((section) => isQuietSectionId(section.sectionId));
  if (quietPages.some((section) => section.storyScene?.composition?.focalVisualPriority !== 'none')) {
    compositionErrorCount += 1;
    globalErrorCodes.push('composition_multiple_primary_visuals');
  }
  const selectedConceptCount = new Set(input.conceptTags).size;
  const selectedStorySceneCount = storyScenes.length;
  const scenarioRequiresVisuals = input.sections.some((section) =>
    hasText(section.storyScene?.visualAssetId)
    || hasText(section.diagramRendererId)
    || hasText(section.diagramId));
  const visualAssetIds = dedupeStrings(
    storyScenes.flatMap((scene) => (hasText(scene.visualAssetId) ? [scene.visualAssetId] : [])),
  );
  const unresolvedVisualRendererCount = validatedStoryScenes.filter((entry) =>
    hasText(entry.scene.visualAssetId) && entry.rendererType === 'none').length;
  const rejectedSceneSectionIds = dedupeStrings(
    validatedStoryScenes
      .filter((entry) => !acceptedSectionKeys.has(JSON.stringify([entry.section.sectionId, entry.section.contentId])))
      .map((entry) => entry.section.sectionId),
  );
  const offendingPhrases = dedupeStrings(validatedStoryScenes.flatMap((entry) => entry.offendingPhrases));
  const fallbackSignals: string[] = [];
  if (!input.audienceProjectionPresent) fallbackSignals.push('audience_projection_missing');
  if (selectedConceptCount === 0) fallbackSignals.push('concept_selection_missing');
  if (selectedStorySceneCount === 0) fallbackSignals.push('story_scenes_missing');
  if (scenarioRequiresVisuals && visualAssetIds.length === 0) fallbackSignals.push('visual_assets_missing');
  if (unresolvedVisualRendererCount > 0) fallbackSignals.push('visual_renderer_unresolved');
  if (missingScenarioManifestAssetIds.length > 0) fallbackSignals.push('scenario_visual_asset_manifest_missing');
  const warningCodes = dedupeStrings(validatedStoryScenes.flatMap((entry) => [
    ...entry.validation.warnings.map((issue) => issue.code),
    ...entry.compositionValidation.warnings.map((issue) => issue.code),
  ]));
  const errorCodes = dedupeStrings([
    ...validatedStoryScenes.flatMap((entry) => [
      ...entry.validation.errors.map((issue) => issue.code),
      ...entry.compositionValidation.errors.map((issue) => issue.code),
    ]),
    ...globalErrorCodes,
  ]);
  const warningCount = validatedStoryScenes.reduce(
    (total, entry) => total + entry.validation.warnings.length + entry.compositionValidation.warnings.length,
    0,
  );
  const sceneValidationErrorCount = validatedStoryScenes.reduce(
    (total, entry) => total + entry.validation.errors.length + entry.compositionValidation.errors.length,
    0,
  );
  const blockingSceneValidationErrorCount = validatedStoryScenes.reduce(
    (total, entry) =>
      total + entry.validation.errors.filter((issue) => BLOCKING_STORY_SCENE_ERROR_CODES.has(issue.code)).length,
    0,
  );
  const blockingGlobalErrorCount = globalErrorCodes.filter((code) => BLOCKING_STORY_SCENE_ERROR_CODES.has(code)).length;
  const errorCount = sceneValidationErrorCount + globalErrorCodes.length;
  const blockingErrorCount = blockingSceneValidationErrorCount + blockingGlobalErrorCount;
  if (blockingErrorCount > 0) fallbackSignals.push('story_scene_quality_blocked');
  const genericReasonCount = input.recommendationReasons
    .filter((reason) => reason.atlasRecommendationOutcome.toLowerCase().includes(FALLBACK_REASON_MATCH_PHRASE))
    .length;
  if (genericReasonCount > 0 && selectedStorySceneCount === 0) fallbackSignals.push('generic_reason_copy');
  if (hasGenericRouteFallbackCopy([input.nextSteps[0]?.body ?? ''])) fallbackSignals.push('generic_next_steps_copy');
  const routeCompletenessAudit = buildCustomerPdfRouteCompletenessAudit({
    routeId: input.routeId,
    validatedStoryScenes,
    nextSteps: input.nextSteps,
    systemProtection: input.systemProtection,
  });
  if (routeCompletenessAudit != null) {
    if (routeCompletenessAudit.missingRequirementIds.length > 0) {
      fallbackSignals.push('route_required_section_missing');
    }
    if (routeCompletenessAudit.blockedRequirementIds.length > 0) {
      fallbackSignals.push('route_required_section_blocked');
    }
    if (routeCompletenessAudit.genericFallbackRequirementIds.length > 0) {
      fallbackSignals.push('route_required_section_generic_copy');
    }
  }
  const fallbackSectionsUsed = fallbackSignals.length > 0;
  const exportable =
    input.audienceProjectionPresent
    && selectedConceptCount > 0
    && selectedStorySceneCount > 0
    && (!scenarioRequiresVisuals || visualAssetIds.length > 0)
    && unresolvedVisualRendererCount === 0
    && missingScenarioManifestAssetIds.length === 0
    && blockingErrorCount === 0
    && (routeCompletenessAudit?.ready ?? true);
  const fallbackOnly = !exportable;

  return {
    audienceProjectionPresent: input.audienceProjectionPresent,
    selectedConceptCount,
    selectedStorySceneCount,
    visualAssetIds,
    fallbackSectionsUsed,
    fallbackOnly,
    sceneDiagnostics,
    visualCoverageAudit: buildCustomerPdfVisualCoverageAudit(),
    routeCompletenessAudit,
    storySceneValidation: {
      sceneCount: validatedStoryScenes.length,
      warningCount,
      errorCount,
      blockingErrorCount,
      rejectedSceneCount: validatedStoryScenes.length - selectedStorySceneCount,
      rejectedSceneSectionIds,
      offendingPhrases,
      warningCodes,
      errorCodes,
      compositionWarningCount,
      compositionErrorCount,
    },
  };
}

export function isFallbackOnlyCustomerPdf(model: PortalJourneyPrintModelV1): boolean {
  return model.contentSource?.fallbackOnly === true;
}

function formatHouseholdCount(occupancyCount: number): string {
  return `${occupancyCount}-person household`;
}

function resolveFallbackSceneKind(section: PortalJourneyPrintSectionV1): LibraryStorySceneKindV1 {
  switch (section.sectionId) {
    case 'pressure_vs_storage':
    case 'flow_restriction_bottleneck':
      return 'physics_explainer';
    case 'stored_hot_water_recovery_timeline':
    case 'steady_running':
    case 'winter_behaviour':
      return 'lived_experience';
    case 'unvented_safety':
    case 'magnetic_filter_capture':
    case 'powerflush_condition_led':
      return 'protection_quality';
    case 'sealed_system_pressure_window':
      return 'future_flexibility';
    case 'system_fit_decision_map':
      return 'route_rationale';
    default:
      return 'current_system_explainer';
  }
}

function resolveCanonicalSceneVisualAssetId(section: PortalJourneyPrintSectionV1): string | undefined {
  if (hasText(section.diagramRendererId) && isApprovedCustomerPdfVisualAssetId(section.diagramRendererId)) {
    return section.diagramRendererId;
  }
  if (hasText(section.storyScene?.visualAssetId) && isApprovedCustomerPdfVisualAssetId(section.storyScene.visualAssetId)) {
    return section.storyScene.visualAssetId;
  }
  if (hasText(section.diagramId) && isApprovedCustomerPdfVisualAssetId(section.diagramId)) return section.diagramId;
  return undefined;
}

function buildStorySceneFromSection(section: PortalJourneyPrintSectionV1): LibraryStorySceneV1 {
  const sceneKind = resolveFallbackSceneKind(section);
  return {
    sceneKind,
    title: section.heading,
    customerTakeaway: section.keyTakeaway,
    visualAssetId: resolveCanonicalSceneVisualAssetId(section),
    whyItMatters: section.summary,
    whatYouWillNotice: section.items.find(hasText) ?? section.reassurance,
    composition: buildDefaultStorySceneComposition(sceneKind),
  };
}

function formatBathroomCount(bathroomCount: number): string {
  return `${bathroomCount} bathroom${bathroomCount === 1 ? '' : 's'}`;
}

function resolveSurveyInput(input: BuildCustomerJourneyPackInputV1): EngineInputV2_3 | undefined {
  return input.canonicalVisitPackage?.surveyDraft ?? input.canonicalVisitPackage?.engineInputSnapshot;
}

function resolveVisitEnvelope(input: BuildCustomerJourneyPackInputV1): VisitEnvelopeV1 | undefined {
  return input.visitEnvelope ?? input.canonicalVisitPackage?.proposalTruth?.visitEnvelope;
}

function resolveMainsSignals(surveyInput: EngineInputV2_3 | undefined): {
  pressureBar?: number;
  flowLpm?: number;
  pressureRecorded: boolean;
} {
  return {
    pressureBar: surveyInput?.dynamicMainsPressure,
    flowLpm: surveyInput?.mainsDynamicFlowLpm,
    pressureRecorded: surveyInput?.mainsPressureRecorded !== false,
  };
}

function isPoorMainsSupply(mains: { pressureBar?: number; flowLpm?: number; pressureRecorded: boolean }): boolean {
  if (mains.pressureRecorded && mains.pressureBar != null && mains.pressureBar < 1.5) return true;
  return mains.flowLpm != null && mains.flowLpm < 10;
}

function isSuitableMainsSupply(mains: { pressureBar?: number; flowLpm?: number; pressureRecorded: boolean }): boolean {
  const pressureOk = !mains.pressureRecorded || mains.pressureBar == null || mains.pressureBar >= 1.5;
  const flowOk = mains.flowLpm == null || mains.flowLpm >= 12;
  return pressureOk && flowOk;
}

function inferHomeFactFromEngineReason(
  text: string,
  category: RecommendationReasonCategoryV1,
): string {
  const lower = text.toLowerCase();
  if (category === 'bathroom_count') return 'Bathroom layout and hot-water overlap risk';
  if (category === 'mains_flow_pressure') return 'Measured mains-fed supply conditions';
  if (category === 'protection_system_condition') return 'System condition and protection signals';
  if (category === 'future_upgrade_readiness') return 'Future home-change demand signals';
  if (lower.includes('occupancy') || lower.includes('household')) return 'Household demand profile';
  return 'Survey and engine constraints for this home';
}

function inferOutcomeFromEngineReason(category: RecommendationReasonCategoryV1): string {
  if (category === 'bathroom_count') return 'Atlas matched the route to bathroom concurrency demand.';
  if (category === 'mains_flow_pressure') return 'Atlas gated route confidence using measured supply limits.';
  if (category === 'protection_system_condition') return 'Atlas included system protection actions in the route.';
  if (category === 'future_upgrade_readiness') return 'Atlas checked the route against likely future demand.';
  return 'Atlas used this signal in route selection checks.';
}

function inferPracticalEffectFromEngineReason(category: RecommendationReasonCategoryV1): string {
  if (category === 'bathroom_count') return 'Hot-water overlap is less likely to disrupt routine use.';
  if (category === 'mains_flow_pressure') return 'Expected outlet performance stays grounded in measured supply reality.';
  if (category === 'protection_system_condition') return 'Long-term efficiency and reliability risk is reduced.';
  if (category === 'future_upgrade_readiness') return 'The recommendation remains useful if demand grows later.';
  return 'The recommendation remains aligned with your home constraints.';
}

function inferReasonFromCustomerFact(fact: string): Omit<RecommendationReasonBlockV1, 'id' | 'category' | 'detail'> {
  const lower = fact.toLowerCase();
  if (lower.includes('bathroom')) {
    return {
      homeFact: fact,
      whyItMatters: 'Bathroom count affects overlap risk during busy periods.',
      atlasRecommendationOutcome: 'Atlas checked route suitability against bathroom-driven demand.',
      practicalEffect: 'Daily shower and tap use is less likely to clash.',
    };
  }
  if (lower.includes('person') || lower.includes('household') || lower.includes('occupancy')) {
    return {
      homeFact: fact,
      whyItMatters: 'Occupancy level changes hot-water and heating demand profiles.',
      atlasRecommendationOutcome: 'Atlas used this occupancy figure in hot-water volume and heating demand checks.',
      practicalEffect: 'Day-to-day comfort and hot-water delivery are better matched to your home.',
    };
  }
  if (lower.includes('mains') || lower.includes('pressure') || lower.includes('flow')) {
    return {
      homeFact: fact,
      whyItMatters: 'Mains-fed supply quality affects outlet confidence and concurrency.',
      atlasRecommendationOutcome: 'Atlas used these supply signals in route confidence checks.',
      practicalEffect: 'Performance expectations stay realistic for your measured supply.',
    };
  }

  return {
    homeFact: fact,
    whyItMatters: 'This affects demand and installation constraints for the route.',
    atlasRecommendationOutcome: 'Atlas mapped this survey fact into the educational evidence route for your home.',
    practicalEffect: 'You receive a clearer explanation of what this means for daily comfort and performance.',
  };
}

function inferRecommendationReasonBlocks(input: BuildCustomerJourneyPackInputV1): RecommendationReasonBlockV1[] {
  const surveyInput = resolveSurveyInput(input);
  const visitEnvelope = resolveVisitEnvelope(input);
  const recommendation = visitEnvelope?.recommendation;
  const resolvedIntent = inferRecommendationIntentFromInput(input);
  const mains = resolveMainsSignals(surveyInput);
  const reasons: RecommendationReasonBlockV1[] = [];
  const seenCategory = new Set<RecommendationReasonCategoryV1>();

  const pushReason = (reason: RecommendationReasonBlockV1) => {
    if (seenCategory.has(reason.category)) return;
    if (
      !hasText(reason.homeFact)
      || !hasText(reason.whyItMatters)
      || !hasText(reason.atlasRecommendationOutcome)
      || !hasText(reason.practicalEffect)
    ) return;
    seenCategory.add(reason.category);
    reasons.push(reason);
  };

  const occupancyCount = surveyInput?.occupancyCount;
  const bathroomCount = surveyInput?.bathroomCount;
  const peakConcurrentOutlets = surveyInput?.peakConcurrentOutlets;
  const poorMains = isPoorMainsSupply(mains);
  const suitableMains = isSuitableMainsSupply(mains);
  const hasStoredHotWaterRecommendation =
    recommendation?.hotWaterArrangement === 'stored_unvented'
    || recommendation?.hotWaterArrangement === 'stored_vented'
    || recommendation?.hotWaterArrangement === 'mixergy'
    || recommendation?.hotWaterArrangement === 'thermal_store'
    || resolvedIntent === 'stored_hot_water'
    || resolvedIntent === 'vented_to_unvented'
    || resolvedIntent === 'sealed_system_conversion';

  if (occupancyCount != null && occupancyCount >= 3) {
    pushReason({
      id: 'household-demand',
      category: 'household_demand',
      homeFact: formatHouseholdCount(occupancyCount),
      whyItMatters: 'More occupants increase overlapping hot-water demand during busy periods.',
      atlasRecommendationOutcome: `Atlas used ${occupancyCount} occupants as the baseline in hot-water volume and heating demand checks.`,
      practicalEffect: 'Busy-period hot-water use stays more consistent day to day.',
      detail: 'The recommendation uses household demand as the baseline, rather than assuming one-user usage only.',
    });
  }

  if (
    bathroomCount != null
    && bathroomCount >= 2
    && suitableMains
    && hasStoredHotWaterRecommendation
  ) {
    pushReason({
      id: 'bathrooms-stored-hot-water',
      category: 'bathroom_count',
      homeFact: formatBathroomCount(bathroomCount),
      whyItMatters: 'Hot-water demand can overlap across bathrooms at peak times.',
      atlasRecommendationOutcome: 'Atlas selected stored hot water with suitable mains-fed supply checks.',
      practicalEffect: 'One person can shower while another outlet is used with less temperature drop risk.',
      detail: 'Stored hot water keeps a reserve ready for overlapping outlet use instead of relying on a single on-demand stream.',
    });
  } else if (bathroomCount != null && bathroomCount > 0) {
    pushReason({
      id: 'bathroom-count',
      category: 'bathroom_count',
      homeFact: formatBathroomCount(bathroomCount),
      whyItMatters: 'Bathroom count changes expected daily hot-water demand patterns.',
      atlasRecommendationOutcome: 'Atlas included bathroom demand directly in sizing checks.',
      practicalEffect: 'Hot-water service is matched to normal household routines.',
    });
  }

  if (poorMains) {
    pushReason({
      id: 'mains-limited',
      category: 'mains_flow_pressure',
      homeFact: 'Measured mains-fed supply is limited',
      whyItMatters: 'Lower flow or pressure reduces confidence in peak outlet performance.',
      atlasRecommendationOutcome: 'Atlas did not treat mains-fed stored hot water confidence as automatic.',
      practicalEffect: 'The route avoids over-promising performance where supply is constrained.',
      detail: 'The recommendation avoids over-promising outlet performance where dynamic pressure or flow is constrained.',
    });
  } else if ((mains.pressureBar != null && mains.pressureBar > 0) || (mains.flowLpm != null && mains.flowLpm > 0)) {
    pushReason({
      id: 'mains-suitable',
      category: 'mains_flow_pressure',
      homeFact: 'Measured mains-fed supply is suitable',
      whyItMatters: 'Healthy flow and pressure support stable hot-water delivery expectations.',
      atlasRecommendationOutcome: 'Atlas used the measured supply values in route confidence checks.',
      practicalEffect: 'Day-to-day outlet performance is backed by survey measurements.',
      detail: 'Survey measurements were used directly in the hot-water route checks.',
    });
  }

  if (
    surveyInput?.currentSystem?.heatingSystemType === 'open_vented'
    || surveyInput?.currentHeatSourceType === 'regular'
  ) {
    pushReason({
      id: 'current-system-constraint',
      category: 'current_system_constraint',
      homeFact: 'Current system layout has open-vented constraints',
      whyItMatters: 'Existing pressure and reliability limits affect upgrade feasibility.',
      atlasRecommendationOutcome: 'Atlas favoured a route that removes known weak points.',
      practicalEffect: 'The upgrade is targeted to your existing system limits, not a generic swap.',
      detail: 'This recommendation is targeted at real constraints in the existing setup, not just a like-for-like replacement.',
    });
  }

  if (surveyInput?.loftTankSpace === 'none') {
    pushReason({
      id: 'loft-space-limit',
      category: 'loft_cylinder_location_constraint',
      homeFact: 'No usable loft tank space',
      whyItMatters: 'Open-vented routes depend on loft tank capacity.',
      atlasRecommendationOutcome: 'Atlas prioritised routes that do not rely on loft tank storage.',
      practicalEffect: 'The recommendation stays feasible for this property layout.',
      detail: 'Atlas prioritises routes that do not depend on loft tank capacity.',
    });
  } else if (surveyInput?.availableSpace === 'none') {
    pushReason({
      id: 'cylinder-space-limit',
      category: 'loft_cylinder_location_constraint',
      homeFact: 'Cylinder location space is constrained',
      whyItMatters: 'Layout limits can rule out otherwise suitable routes.',
      atlasRecommendationOutcome: 'Atlas highlighted only feasible layouts for the surveyed location.',
      practicalEffect: 'You avoid recommendations that are difficult to install in your home.',
    });
  }

  if (peakConcurrentOutlets != null && peakConcurrentOutlets >= 2) {
    pushReason({
      id: 'simultaneous-draw',
      category: 'simultaneous_hot_water_use',
      homeFact: `Peak overlap: ${peakConcurrentOutlets} outlets`,
      whyItMatters: 'Overlapping outlets increase the chance of pressure and temperature dips.',
      atlasRecommendationOutcome: 'Atlas favoured a route with stronger concurrent-use resilience.',
      practicalEffect: 'Routine overlap is less likely to cause abrupt hot-water drop-offs.',
      detail: 'This lowers the chance of routine overlap causing abrupt temperature or flow drop-offs.',
    });
  }

  const heatingCondition = (surveyInput as unknown as {
    fullSurvey?: {
      heatingCondition?: {
        radiatorsColdAtBottom?: boolean;
        magneticDebrisEvidence?: boolean;
        bleedWaterColour?: string;
      };
      waterQuality?: {
        confidenceNote?: string | null;
      };
    };
  })?.fullSurvey?.heatingCondition;
  const currentConditionSignals = surveyInput?.currentSystem?.conditionSignals;
  const hasSludgeSignals =
    heatingCondition?.radiatorsColdAtBottom === true
    || heatingCondition?.magneticDebrisEvidence === true
    || heatingCondition?.bleedWaterColour === 'brown'
    || heatingCondition?.bleedWaterColour === 'black'
    || currentConditionSignals?.bleedWaterColour === 'dark'
    || currentConditionSignals?.bleedWaterColour === 'sludge'
    || currentConditionSignals?.radiatorPerformance === 'many_cold';
  const hasProtectionSignals =
    hasSludgeSignals
    || surveyInput?.hasMagneticFilter === false
    || currentConditionSignals?.magneticFilter === 'not_fitted'
    || recommendation?.requiredWork.some((item) => /flush|filter|inhibitor|corrosion|metallurgy|mixed metal/i.test(`${item.label} ${item.detail ?? ''}`))
    || recommendation?.reasons.some((item) => /metallurgy|mixed metal|corrosion|sludge|filter|inhibitor/i.test(item.text));
  if (hasProtectionSignals) {
    pushReason({
      id: 'protection-condition',
      category: 'protection_system_condition',
      homeFact: 'Survey condition signals show circuit protection risk',
      whyItMatters: 'Sludge and mixed-metal indicators can reduce efficiency and reliability.',
      atlasRecommendationOutcome: 'Atlas included cleaning and long-term protection steps in the route.',
      practicalEffect: 'The system is more likely to run efficiently and reliably after installation.',
      detail: 'Where sludge or mixed-metal risk is present, the recommendation includes actions that protect efficiency and reliability after installation.',
    });
  }

  if (
    surveyInput?.futureAddBathroom === true
    || surveyInput?.futureLoftConversion === true
    || recommendation?.futureReady.length
  ) {
    pushReason({
      id: 'future-ready',
      category: 'future_upgrade_readiness',
      homeFact: 'Future home changes are planned',
      whyItMatters: 'Future bathrooms or loft conversion can increase demand.',
      atlasRecommendationOutcome: 'Atlas included future-demand checks in the selected route.',
      practicalEffect: 'You are less likely to need near-term rework when plans happen.',
      detail: 'This helps avoid a near-term rework when planned household changes happen.',
    });
  }

  // ── System-specific reason blocks ───────────────────────────────────────────

  const hotWaterArrangement = recommendation?.hotWaterArrangement;
  const peakRecoveryEvidence = (recommendation?.evidence ?? [])
    .filter((item) => /peak|concurrent|overlap|recovery|reheat|draw/i.test(`${item.fieldPath} ${item.label} ${item.value}`))
    .slice(0, 2)
    .map((item) => `${item.label}: ${item.value}`);

  if (hotWaterArrangement === 'on_demand') {
    pushReason({
      id: 'combi-on-demand',
      category: 'hot_water_system_type',
      homeFact: 'On-demand hot water — no storage cylinder',
      whyItMatters: 'Without a cylinder, hot water is generated only when a tap or shower is opened, keeping the system compact.',
      atlasRecommendationOutcome: 'Atlas confirmed this home\'s occupancy and bathroom demand suits on-demand delivery without a storage reserve.',
      practicalEffect: 'Hot water flow starts as the boiler fires; there is no stored volume to draw down or wait to reheat.',
    });
  }

  if (hotWaterArrangement === 'stored_unvented') {
    const detailFromEvidence = peakRecoveryEvidence.join(' · ');
    pushReason({
      id: 'unvented-cylinder',
      category: 'hot_water_system_type',
      homeFact: 'Stored hot water at mains pressure — unvented cylinder',
      whyItMatters: 'Peak-window overlap and recovery evidence show when stored reserve is needed to maintain stable outlet delivery.',
      atlasRecommendationOutcome: 'Atlas selected an unvented stored route from recommendation evidence covering overlap demand and recovery behaviour.',
      practicalEffect: 'Shower pressure and temperature stay more consistent when two outlets are used at the same time.',
      detail: detailFromEvidence.length > 0
        ? `Evidence path: ${detailFromEvidence}`
        : 'The cylinder operates at mains pressure without a loft feed tank, which removes the open-vented head constraints.',
    });
  }

  if (hotWaterArrangement === 'mixergy') {
    const bathroomDetail = bathroomCount != null && bathroomCount > 0
      ? ` in a ${formatBathroomCount(bathroomCount)} household`
      : '';
    pushReason({
      id: 'mixergy-stratified',
      category: 'hot_water_system_type',
      homeFact: 'Stratified cylinder — Mixergy-type rapid top-of-tank recovery',
      whyItMatters: 'Stratification keeps the hottest water at the outlet end, reducing usable recovery time after partial draws.',
      atlasRecommendationOutcome: `Atlas selected a stratified cylinder to match recovery demand${bathroomDetail}.`,
      practicalEffect: 'Hot water recovers faster after moderate use because only the drawn zone needs reheating.',
      detail: 'The Mixergy stratification approach means a top-up draw after a single shower is available sooner than a full conventional reheat.',
    });
  }

  if (hotWaterArrangement === 'thermal_store') {
    pushReason({
      id: 'thermal-store',
      category: 'hot_water_system_type',
      homeFact: 'Thermal store — primary-circuit buffer with coil-fed domestic hot water',
      whyItMatters: 'A thermal store absorbs variable heat input and provides buffer capacity that supports both heating and hot water.',
      atlasRecommendationOutcome: 'Atlas chose a thermal store arrangement where primary-side buffering improves system efficiency and reduces cycling.',
      practicalEffect: 'The store absorbs surplus heat and releases it steadily, smoothing boiler or heat-pump on-off cycles.',
      detail: 'Domestic hot water is delivered via an indirect coil, keeping the potable supply separate from the primary circuit.',
    });
  }

  const emitters = recommendation?.emitters;
  if (emitters != null && emitters.existingRadiatorsCompatible === false) {
    pushReason({
      id: 'emitter-upgrade-required',
      category: 'emitter_upgrade_required',
      homeFact: `Existing radiators need assessment for heat-pump flow temperature (${emitters.requiredFlowTempC} °C design)`,
      whyItMatters: 'Heat pumps run at lower flow temperatures than gas boilers; radiators sized for 70 °C may not deliver the same heat output at the design conditions for this home.',
      atlasRecommendationOutcome: 'Atlas flagged that emitter sizing needs confirming before the heat pump is commissioned.',
      practicalEffect: 'Your installer will check whether room outputs remain adequate at the lower flow temperature and recommend upsizing where needed.',
      detail: emitters.note,
    });
  }

  if (reasons.length < 3 && recommendation != null) {
    for (const reason of recommendation.reasons) {
      if (reasons.length >= 5) break;
      if (!hasText(reason.text)) continue;
      const lower = reason.text.toLowerCase();
      const category: RecommendationReasonCategoryV1 =
        lower.includes('bathroom')
          ? 'bathroom_count'
          : lower.includes('mains') || lower.includes('pressure') || lower.includes('flow')
            ? 'mains_flow_pressure'
            : lower.includes('sludge') || lower.includes('filter') || lower.includes('inhibitor')
              ? 'protection_system_condition'
              : lower.includes('future')
                ? 'future_upgrade_readiness'
                : 'current_system_constraint';
      pushReason({
        id: `engine-reason-${reasons.length + 1}`,
        category,
        homeFact: inferHomeFactFromEngineReason(reason.text, category),
        whyItMatters: reason.text,
        atlasRecommendationOutcome: inferOutcomeFromEngineReason(category),
        practicalEffect: inferPracticalEffectFromEngineReason(category),
      });
    }
  }

  if (reasons.length < 3) {
    for (const fact of inferCustomerFacts(input)) {
      if (reasons.length >= 5) break;
      if (!hasText(fact)) continue;
      if (/^\s*0(\D|$)/.test(fact)) continue;
      const factReason = inferReasonFromCustomerFact(fact);
      pushReason({
        id: `customer-fact-${reasons.length + 1}`,
        category: 'household_demand',
        ...factReason,
      });
    }
  }

  return reasons.slice(0, 5);
}

/**
 * Section IDs that describe cylinder/unvented plumbing in detail.
 * Excluded when the primary intent has no cylinder (e.g. combi_replacement).
 */
const CYLINDER_ONLY_SECTION_IDS: ReadonlySet<PortalJourneyPrintSectionV1['sectionId']> = new Set([
  'pressure_vs_storage',
  'unvented_safety',
]);

/**
 * Returns true when the primary intent means a cylinder is not part of the
 * recommended system and cylinder-specific sections should be suppressed.
 */
function shouldExcludeCylinderSections(
  intent: RecommendationIntentCategoryV1 | undefined,
): boolean {
  return intent === 'combi_replacement';
}

function buildSectionEvidenceTags(section: PortalJourneyPrintSectionV1): RecommendationEvidenceTagV1[] {
  switch (section.sectionId) {
    case 'warm_not_hot_radiators':
      return [{ source: 'recommendation', metric: 'requiredFlowTempC', trigger: 'low_temperature_operation', recommendationReasonCategory: 'emitter_upgrade_required' }];
    case 'winter_behaviour':
      return [{ source: 'recommendation', metric: 'heatSource', trigger: 'ashp_selected_and_viable', recommendationReasonCategory: 'emitter_upgrade_required' }];
    case 'pressure_vs_storage':
      return [{ source: 'survey', metric: 'dynamicMainsPressure/mainsDynamicFlowLpm', trigger: 'pressure_storage_split', recommendationReasonCategory: 'mains_flow_pressure' }];
    case 'stored_hot_water_recovery_timeline':
      return [{ source: 'recommendation.evidence', metric: 'peak/recovery signals', trigger: 'recovery_or_overlap_evidence', recommendationReasonCategory: 'hot_water_system_type' }];
    default:
      return [{ source: 'recommendation', metric: section.contentId, trigger: 'selected_for_home' }];
  }
}

function sectionHasReasonEvidence(
  section: PortalJourneyPrintSectionV1,
): boolean {
  const tags = section.evidenceTags ?? [];
  if (tags.length === 0) return false;
  return true;
}

function buildPortalJourneyPrintModelCore(
  input: BuildPortalJourneyPrintModelInputV1,
): PortalJourneyPrintModelV1 {
  const {
    selectedSectionIds,
    recommendationSummary,
    customerFacts,
    brandProfile,
    journeyType = 'generic_recommendation_summary',
    audienceProjection,
    visitContext,
    includeAddressSummaryInPrint = false,
    surveyCondition,
    recommendationReasons,
    recommendationIntent,
    educationalConceptTags = [],
    recommendationViabilityState,
  } = input;

  const selectedSet = new Set(selectedSectionIds);
  const conceptTagSet = new Set<EducationalConceptTagV1>(educationalConceptTags);
  const addressSummary = resolvePortalAddressSummary(visitContext, {
    includeInPrint: includeAddressSummaryInPrint,
  });

  const MAX_COVER_CUSTOMER_FACTS = 3;
  const cover: PortalJourneyPrintCoverV1 = {
    title: 'Your recommendation',
    summary: recommendationSummary,
    customerFacts: customerFacts.slice(0, MAX_COVER_CUSTOMER_FACTS),
    brandName: brandProfile?.name,
    ...(addressSummary ? { addressSummary } : {}),
  };

  const normalizedRecommendationReasons = (recommendationReasons ?? [])
    .filter((reason) =>
      hasText(reason.homeFact)
      && hasText(reason.whyItMatters)
      && hasText(reason.atlasRecommendationOutcome)
      && hasText(reason.practicalEffect))
    .map((reason) => ({
      ...reason,
      evidenceTags: (reason.evidenceTags != null && reason.evidenceTags.length > 0)
        ? reason.evidenceTags
        : [{
          source: 'recommendation_reason',
          metric: reason.category,
          trigger: reason.homeFact,
          recommendationReasonCategory: reason.category,
        }],
    }))
    .slice(0, 5);

  const summaryLower = recommendationSummary.toLowerCase();
  const isHeatPumpSelected = summaryLower.includes('heat pump') || summaryLower.includes('ashp');
  const allowHeatPumpEducationalSections = recommendationViabilityState !== 'blocked';
  const allowWarmRadiatorSection = allowHeatPumpEducationalSections
    && (
      selectedSet.has('CON_E02')
      || selectedSet.size === 0
      || conceptTagSet.has('warm_vs_hot_radiators')
      || normalizedRecommendationReasons.some((reason) => reason.category === 'emitter_upgrade_required')
    );
  const allowDefrostSection = allowHeatPumpEducationalSections
    && isHeatPumpSelected
    && (recommendationViabilityState == null || recommendationViabilityState === 'viable');

  const effectiveConceptTagSet = allowHeatPumpEducationalSections
    ? conceptTagSet
    : new Set([...conceptTagSet].filter((tag) => tag !== 'warm_vs_hot_radiators'));
  const resolvedIntent = recommendationIntent ?? journeyTypeToIntent(journeyType);

  const { sections: rawSections, nextSteps, qrDestinations } =
    journeyType === 'heat_pump' && allowHeatPumpEducationalSections
      ? buildHeatPumpSectionsAndNextSteps(selectedSet, effectiveConceptTagSet, {
        allowWarmRadiatorSection,
        allowDefrostSection,
      })
      : journeyType === 'open_vented'
      ? buildOpenVentedSectionsAndNextSteps(selectedSet, effectiveConceptTagSet)
      : resolvedIntent === 'stored_hot_water' || resolvedIntent === 'sealed_system_conversion'
      ? buildStoredHotWaterSectionsAndNextSteps(effectiveConceptTagSet)
      : resolvedIntent === 'combi_replacement'
      ? buildCombiSectionsAndNextSteps(effectiveConceptTagSet)
      : buildGenericRecommendationContent({ conceptTagSet: effectiveConceptTagSet });
  const registryConceptIdSet = new Set(atlasMvpContentMapRegistry.map((e) => e.id));
  const excludeCylinder = shouldExcludeCylinderSections(resolvedIntent);
  const scenarioNarrativeRouteId = resolveScenarioNarrativeRouteId(resolvedIntent);
  const sectionsWithPackNarratives = applyScenarioAuthoredNarrativePack(rawSections, scenarioNarrativeRouteId);
  const sections = sectionsWithPackNarratives
    .map((section) => ({
      ...section,
      evidenceTags: section.evidenceTags ?? buildSectionEvidenceTags(section),
    }))
    .filter((section) => {
      if (excludeCylinder && CYLINDER_ONLY_SECTION_IDS.has(section.sectionId)) return false;
      if (audienceProjection != null && registryConceptIdSet.has(section.contentId)) {
        if (!audienceProjection.visibleConcepts.includes(section.contentId)) return false;
      }
      return sectionHasReasonEvidence(section);
    });
  const systemProtection = surveyCondition != null
    ? buildSystemProtectionSummary(surveyCondition)
    : undefined;
  const usedPages =
    1    // cover
    + (normalizedRecommendationReasons.length > 0 ? 1 : 0)
    + sections.length // includes deterministic quiet pages inserted for dense scene transitions
    + (systemProtection != null ? 1 : 0)
    + 1; // next steps
  const totalPages = usedPages + 1; // technical hand-off

  return {
    cover,
    recommendationReasons: normalizedRecommendationReasons,
    ...(recommendationViabilityState != null ? { recommendationViabilityState } : {}),
    sections,
    nextSteps,
    qrDestinations,
    systemProtection,
    pageEstimate: {
      usedPages: totalPages,
      maxPages: 12,
    },
  };
}

export function buildCustomerJourneyPack(
  input: BuildCustomerJourneyPackInputV1,
): CustomerJourneyPackV1 {
  const packagedPack =
    input.customerJourneyPack
    ?? readCustomerJourneyPackFromGeneratedOutputs(
      input.canonicalVisitPackage?.generatedOutputStatus?.generatedOutputs,
    );
  if (packagedPack != null) {
    return packagedPack;
  }
  const recommendationReasons = inferRecommendationReasonBlocks(input);
  const resolvedIntent =
    input.recommendationIntent
    ?? (input.journeyType != null ? journeyTypeToIntent(input.journeyType) : inferRecommendationIntentFromInput(input));
  const conceptSelection = (
    (input.selectedSectionIds != null && input.selectedSectionIds.length > 0)
    || (input.educationalConceptTags != null && input.educationalConceptTags.length > 0)
  )
    ? {
      selectedSectionIds: dedupeStrings(input.selectedSectionIds ?? []),
      conceptTags: dedupeStrings(input.educationalConceptTags ?? []) as EducationalConceptTagV1[],
    }
    : resolveRecommendationConceptSelection({
      ...input,
      recommendationIntent: resolvedIntent,
    });
  const staticPdf = buildPortalJourneyPrintModelCore({
    selectedSectionIds: conceptSelection.selectedSectionIds,
    recommendationSummary: inferRecommendationSummary(input),
    customerFacts: inferCustomerFacts(input),
    brandProfile: input.brandProfile,
    journeyType: input.journeyType ?? intentToJourneyType(resolvedIntent),
    audienceProjection: input.audienceProjection,
    visitContext: input.visitContext,
    includeAddressSummaryInPrint: input.includeAddressSummaryInPrint,
    surveyCondition: input.surveyCondition,
    recommendationReasons,
    recommendationIntent: resolvedIntent,
    educationalConceptTags: conceptSelection.conceptTags,
    recommendationViabilityState: input.recommendationViabilityState,
  });
  const staticPdfWithContentSource: PortalJourneyPrintModelV1 = {
    ...staticPdf,
    contentSource: buildCustomerPdfContentSource({
      audienceProjectionPresent: input.audienceProjection != null,
      routeId: resolveScenarioNarrativeRouteId(resolvedIntent),
      conceptTags: conceptSelection.conceptTags,
      sections: staticPdf.sections,
      recommendationReasons: staticPdf.recommendationReasons,
      nextSteps: staticPdf.nextSteps,
      systemProtection: staticPdf.systemProtection,
    }),
  };

  return {
    schema: CUSTOMER_JOURNEY_PACK_SCHEMA,
    version: CUSTOMER_JOURNEY_PACK_VERSION,
    staticPdf: staticPdfWithContentSource,
    portalDeepDive: {
      recommendationSummary: staticPdfWithContentSource.cover.summary,
      recommendationReasons: staticPdfWithContentSource.recommendationReasons,
      liveExperienceExplanations: inferLiveExperienceExplanations(input, staticPdfWithContentSource),
      librarySupportedExplainers: inferLibrarySupportedExplainers(staticPdfWithContentSource.sections),
      nextSteps: staticPdfWithContentSource.nextSteps,
      sections: staticPdfWithContentSource.sections,
    },
  };
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * buildPortalJourneyPrintModel
 *
 * Produces a PortalJourneyPrintModelV1 for the open-vented → sealed + unvented
 * path.  All content is sourced from atlasMvpContentMapRegistry so the PDF
 * stays in sync with the portal journey sections.
 */
export function buildPortalJourneyPrintModel(
  input: BuildPortalJourneyPrintModelInputV1,
): PortalJourneyPrintModelV1 {
  return buildCustomerJourneyPack(input).staticPdf;
}
