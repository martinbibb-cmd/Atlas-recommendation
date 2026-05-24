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
import { resolvePortalAddressSummary } from '../../../lib/portal/portalVisitContext';
import {
  buildSystemProtectionSummary,
  type SurveySystemConditionV1,
  type SystemProtectionSummaryV1,
} from './buildSystemProtectionSummary';
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
    | 'winter_behaviour';
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
}

export interface PortalJourneyPrintNextStepV1 {
  label: string;
  body: string;
}

export interface PortalJourneyPrintQrDestinationV1 {
  heading: string;
  note: string;
}

export interface PortalJourneyPrintModelV1 {
  cover: PortalJourneyPrintCoverV1;
  recommendationReasons: RecommendationReasonBlockV1[];
  sections: PortalJourneyPrintSectionV1[];
  nextSteps: PortalJourneyPrintNextStepV1[];
  qrDestinations: PortalJourneyPrintQrDestinationV1[];
  /**
   * Survey-informed system protection summary.
   * Present when surveyCondition is supplied to buildPortalJourneyPrintModel.
   * Rendered as a small section after practical outcomes.
   */
  systemProtection?: SystemProtectionSummaryV1;
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
  readonly status?: string;
}): NonNullable<GeneratedOutputsV1['customerJourneyPack']> {
  return {
    generated: true,
    generatedAt: input.generatedAt,
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

function buildGenericRecommendationContent(): Pick<PortalJourneyPrintModelV1, 'sections' | 'nextSteps' | 'qrDestinations'> {
  const sections: PortalJourneyPrintSectionV1[] = [
    {
      contentId: 'generic_recommendation_summary',
      sectionId: 'practical_outcomes',
      heading: 'Practical outcomes',
      summary: 'Your recommendation focuses on stable comfort, dependable hot water, and a practical installation path.',
      keyTakeaway: 'Your installer will tailor final setup details to your surveyed home conditions.',
      reassurance: 'You will receive a clear handover explaining controls and expected day-to-day behaviour.',
      items: [
        'Your recommendation reflects occupancy, bathroom use, and measured supply conditions from your survey.',
        'The final setup is confirmed during installer checks before works start.',
        'Day-to-day use stays familiar: the same controls for heating schedules and hot-water temperature targets.',
      ],
    },
  ];

  const nextSteps: PortalJourneyPrintNextStepV1[] = [
    {
      label: 'Pre-install review',
      body: 'Your installer will review the recommendation and confirm the final preparation approach before work begins.',
    },
    {
      label: 'Installation day',
      body: 'Your installer will explain key system changes and complete a customer-safe handover.',
    },
    {
      label: 'After handover',
      body: 'Keep this summary for reference and contact your installer if you want additional guidance.',
    },
  ];

  const qrDestinations: PortalJourneyPrintQrDestinationV1[] = [
    {
      heading: 'How your recommendation was selected',
      note: 'A plain-language walkthrough of surveyed home factors and recommendation outcomes.',
    },
    {
      heading: 'What to expect on installation day',
      note: 'Preparation, handover, and follow-up support explained step by step.',
    },
    {
      heading: 'Day-to-day operation guide',
      note: 'Simple guidance for comfort settings and routine operation.',
    },
  ];

  return { sections, nextSteps, qrDestinations };
}

function buildOpenVentedSectionsAndNextSteps(
  selectedSet: Set<string>,
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

  return { sections, nextSteps, qrDestinations };
}

function buildHeatPumpSectionsAndNextSteps(
  selectedSet: Set<string>,
): Pick<PortalJourneyPrintModelV1, 'sections' | 'nextSteps' | 'qrDestinations'> {
  const conE02 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_E02');
  const conH01 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_H01');
  const conH04 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_H04');
  const conG01 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_G01');

  if (!conE02 || !conH01 || !conH04 || !conG01) {
    throw new Error(
      'buildPortalJourneyPrintModel: required content entries CON_E02, CON_H01, CON_H04, CON_G01 missing from registry',
    );
  }

  const sections: PortalJourneyPrintSectionV1[] = [];

  if (selectedSet.has('CON_E02') || selectedSet.size === 0) {
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
        'Comfort is measured by room temperature, not only radiator surface feel.',
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

  if (selectedSet.has('CON_H01') || selectedSet.size === 0) {
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
      diagramId: resolvePrintDiagramFromContentEntry(conH01),
      diagramRendererId: 'heat_pump_defrost',
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

  return { sections, nextSteps, qrDestinations };
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

function formatHouseholdCount(occupancyCount: number): string {
  return `${occupancyCount}-person household`;
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
    atlasRecommendationOutcome: 'Atlas used this fact directly in route and sizing checks.',
    practicalEffect: 'The selected recommendation is shaped by your surveyed home profile.',
  };
}

function inferRecommendationReasonBlocks(input: BuildCustomerJourneyPackInputV1): RecommendationReasonBlockV1[] {
  const surveyInput = resolveSurveyInput(input);
  const visitEnvelope = resolveVisitEnvelope(input);
  const recommendation = visitEnvelope?.recommendation;
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
    || surveyInput?.dhwStorageType === 'unvented'
    || surveyInput?.dhwStorageType === 'vented'
    || surveyInput?.dhwStorageType === 'mixergy'
    || surveyInput?.dhwStorageType === 'thermal_store';

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
    pushReason({
      id: 'unvented-cylinder',
      category: 'hot_water_system_type',
      homeFact: 'Stored hot water at mains pressure — unvented cylinder',
      whyItMatters: 'An unvented cylinder holds a pre-heated reserve at mains pressure, ready across multiple outlets simultaneously.',
      atlasRecommendationOutcome: 'Atlas matched cylinder sizing to the occupancy and bathroom demand recorded in the survey.',
      practicalEffect: 'Shower pressure and temperature stay more consistent when two outlets are used at the same time.',
      detail: 'The cylinder operates at mains pressure without a loft feed tank, which removes the open-vented head constraints.',
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
  } = input;

  const selectedSet = new Set(selectedSectionIds);
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

  const { sections: rawSections, nextSteps, qrDestinations } =
    journeyType === 'heat_pump'
      ? buildHeatPumpSectionsAndNextSteps(selectedSet)
      : journeyType === 'open_vented'
      ? buildOpenVentedSectionsAndNextSteps(selectedSet)
      : buildGenericRecommendationContent();

  const registryConceptIdSet = new Set(atlasMvpContentMapRegistry.map((e) => e.id));
  const excludeCylinder = shouldExcludeCylinderSections(recommendationIntent);
  const sections = rawSections.filter((section) => {
    if (excludeCylinder && CYLINDER_ONLY_SECTION_IDS.has(section.sectionId)) return false;
    if (audienceProjection == null) return true;
    if (!registryConceptIdSet.has(section.contentId)) return true;
    return audienceProjection.visibleConcepts.includes(section.contentId);
  });

  const normalizedRecommendationReasons = (recommendationReasons ?? [])
    .filter((reason) =>
      hasText(reason.homeFact)
      && hasText(reason.whyItMatters)
      && hasText(reason.atlasRecommendationOutcome)
      && hasText(reason.practicalEffect))
    .slice(0, 5);
  const usedPages = Math.min(1 + (normalizedRecommendationReasons.length > 0 ? 1 : 0) + sections.length + 1, 7);
  const systemProtection = surveyCondition != null
    ? buildSystemProtectionSummary(surveyCondition)
    : undefined;

  return {
    cover,
    recommendationReasons: normalizedRecommendationReasons,
    sections,
    nextSteps,
    qrDestinations,
    systemProtection,
    pageEstimate: {
      usedPages,
      maxPages: 7,
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
  const resolvedIntent = inferRecommendationIntentFromInput(input);
  const staticPdf = buildPortalJourneyPrintModelCore({
    selectedSectionIds: input.selectedSectionIds ?? [],
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
  });

  return {
    schema: CUSTOMER_JOURNEY_PACK_SCHEMA,
    version: CUSTOMER_JOURNEY_PACK_VERSION,
    staticPdf,
    portalDeepDive: {
      recommendationSummary: staticPdf.cover.summary,
      recommendationReasons: staticPdf.recommendationReasons,
      liveExperienceExplanations: inferLiveExperienceExplanations(input, staticPdf),
      librarySupportedExplainers: inferLibrarySupportedExplainers(staticPdf.sections),
      nextSteps: staticPdf.nextSteps,
      sections: staticPdf.sections,
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
