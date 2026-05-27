/**
 * PortalJourneyPrintPack.tsx
 *
 * A4-friendly print renderer for the open-vented → sealed + unvented portal
 * journey path.
 *
 * Design rules
 * ────────────
 *   - No interactive controls (no buttons, tabs, accordions)
 *   - No dev labels or raw engine identifiers visible to the customer
 *   - Diagrams rendered in print-safe mode (printSafe prop)
 *   - Page budget: 4–6 A4 pages
 *   - Content sourced from PortalJourneyPrintModelV1 — same content IDs as
 *     the portal journey sections
 */

import type {
  PortalJourneyPrintModelV1,
  PortalJourneyPrintSectionV1,
  RecommendationReasonBlockV1,
} from './buildPortalJourneyPrintModel';
import type { SystemProtectionSummaryV1 } from './buildSystemProtectionSummary';
import { buildCustomerDocumentModel, type CustomerDocumentRendererMode } from './CustomerDocumentRenderer';
import { DiagramRenderer, isDiagramRendererIdSupported } from '../../diagrams/DiagramRenderer';
import { ReadingAssistOverlay } from '../../../accessibility/readingAssist/ReadingAssistOverlay';
import { PrintableJourneySummary, PrintableQuickWinCard, PrintableSystemCard } from '../../../portal/printable';
import { REASON_ICON_BY_CATEGORY } from './recommendationReasonVisuals';
import {
  getVisualAssetManifestEntry,
  getVisualAssetRendererAvailability,
} from './visualAssetManifest';
import { resolveLegoTechnicCustomerVisualDecision } from './legoTechnicCustomerVisualManifest';
import { isApprovedCustomerPdfVisualAssetId } from '../../pdfVisuals/customerPdfVisualRegistry';
import './portalJourneyPrintPack.css';

type SectionVisualPlan =
  | {
      rendererType: 'diagram_component';
      visualAssetId: string;
      fallbackUsed: false;
    }
  | {
      rendererType: 'print_fallback';
      visualAssetId: string;
      fallbackUsed: true;
      fallbackAssetId: string;
    }
  | {
      rendererType: 'none';
      visualAssetId?: string;
      fallbackUsed: false;
      blockingReason: string;
    };

function resolveSectionVisualAssetId(section: PortalJourneyPrintSectionV1): string | undefined {
  if (section.storyScene?.visualAssetId) return section.storyScene.visualAssetId;
  if (section.diagramRendererId) return section.diagramRendererId;
  if (!section.diagramId) return undefined;
  return section.diagramId;
}

function resolveSectionVisualPlan(section: PortalJourneyPrintSectionV1): SectionVisualPlan {
  const visualAssetId = resolveSectionVisualAssetId(section);
  if (!visualAssetId) {
    return {
      rendererType: 'none',
      fallbackUsed: false,
      blockingReason: 'No visual asset declared for this section.',
    };
  }
  if (!isApprovedCustomerPdfVisualAssetId(visualAssetId)) {
    return {
      rendererType: 'none',
      visualAssetId,
      fallbackUsed: false,
      blockingReason: `Visual asset "${visualAssetId}" is not approved in customerPdfVisualRegistry.`,
    };
  }

  const manifestEntry = getVisualAssetManifestEntry(visualAssetId);
  if (manifestEntry == null) {
    return {
      rendererType: 'none',
      visualAssetId,
      fallbackUsed: false,
      blockingReason: `Visual asset "${visualAssetId}" is missing from the visual manifest.`,
    };
  }
  if (!manifestEntry.supportedSurfaces.includes('pdf')) {
    return {
      rendererType: 'none',
      visualAssetId,
      fallbackUsed: false,
      blockingReason: `Visual asset "${visualAssetId}" is not PDF-supported.`,
    };
  }

  const availability = getVisualAssetRendererAvailability(visualAssetId);
  const requestedRendererType: SectionVisualPlan['rendererType'] = availability.hasDiagramRenderer
    ? 'diagram_component'
    : availability.hasPrintFallback
      ? 'print_fallback'
      : 'none';
  const visualDecision = resolveLegoTechnicCustomerVisualDecision({
    visualId: visualAssetId,
    rendererUsed: requestedRendererType,
    surface: 'print_preview',
  });
  if (!visualDecision.allowed) {
    return {
      rendererType: 'none',
      visualAssetId,
      fallbackUsed: false,
      blockingReason: visualDecision.blockedReason
        ?? `Visual asset "${visualAssetId}" is blocked by legoTechnicCustomerVisualManifest.`,
    };
  }
  if (availability.hasDiagramRenderer && isDiagramRendererIdSupported(visualAssetId)) {
    return {
      rendererType: 'diagram_component',
      visualAssetId,
      fallbackUsed: false,
    };
  }

  return {
    rendererType: 'none',
    visualAssetId,
    fallbackUsed: false,
    blockingReason: `No canonical diagram renderer is available for "${visualAssetId}".`,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface PrintCoverProps {
  cover: PortalJourneyPrintModelV1['cover'];
  contentSource?: PortalJourneyPrintModelV1['contentSource'];
  demographics: DemographicsSummary;
  pageNumber: number;
}

interface DemographicsSummary {
  occupants: string;
  bathrooms: string;
  peakHeatLoss: string;
  hotWaterDemand: string;
}

interface TechnicalHandoffData {
  physicalSiteConstraints: Array<{ label: string; value: string }>;
  plannedHardwareAllocations: Array<{ label: string; value: string }>;
}

const NOT_RECORDED = 'Not recorded';

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function extractFactValue(
  facts: readonly string[],
  matcher: (normalizedFact: string, originalFact: string) => string | null,
): string | null {
  for (const fact of facts) {
    if (!hasText(fact)) continue;
    const originalFact = fact.trim();
    const normalizedFact = originalFact.toLowerCase();
    const value = matcher(normalizedFact, originalFact);
    if (value != null && value.trim().length > 0) return value.trim();
  }
  return null;
}

function extractDemographicsSummary(facts: readonly string[]): DemographicsSummary {
  const occupants = extractFactValue(facts, (normalizedFact, originalFact) => {
    const labeledMatch = originalFact.match(/^(?:household size|occupants?):\s*(.+)$/i);
    if (labeledMatch) return labeledMatch[1];
    if (normalizedFact.includes('household') && normalizedFact.includes('person')) return originalFact;
    if (/\b\d+\s*[- ]?person\b/i.test(originalFact)) return originalFact;
    return null;
  }) ?? NOT_RECORDED;

  const bathrooms = extractFactValue(facts, (normalizedFact, originalFact) => {
    const labeledMatch = originalFact.match(/^bathrooms?:\s*(.+)$/i);
    if (labeledMatch) return labeledMatch[1];
    if (normalizedFact.includes('bathroom')) return originalFact;
    return null;
  }) ?? NOT_RECORDED;

  const peakHeatLoss = extractFactValue(facts, (_, originalFact) => {
    const labeledMatch = originalFact.match(/^peak heat loss:\s*(.+)$/i);
    if (labeledMatch) return labeledMatch[1];
    if (/peak heat loss/i.test(originalFact)) return originalFact;
    return null;
  }) ?? NOT_RECORDED;

  const hotWaterDemand = extractFactValue(facts, (_, originalFact) => {
    const labeledMatch = originalFact.match(/^hot water demand:\s*(.+)$/i);
    if (labeledMatch) return labeledMatch[1];
    if (/hot water demand/i.test(originalFact)) return originalFact;
    return null;
  }) ?? NOT_RECORDED;

  return { occupants, bathrooms, peakHeatLoss, hotWaterDemand };
}

function inferCylinderType(cover: PortalJourneyPrintModelV1['cover']): string {
  const title = cover.title.toLowerCase();
  const summary = cover.summary.toLowerCase();
  if (title.includes('thermal store') || summary.includes('thermal store')) return 'Thermal store';
  if (title.includes('combi') || summary.includes('combi')) return 'No cylinder (combi on-demand)';
  if (title.includes('unvented') || summary.includes('unvented')) return 'Unvented cylinder';
  if (title.includes('cylinder') || summary.includes('cylinder')) return 'Stored hot water cylinder';
  return NOT_RECORDED;
}

function buildTechnicalHandoffData(
  cover: PortalJourneyPrintModelV1['cover'],
  demographics: DemographicsSummary,
): TechnicalHandoffData {
  const facts = cover.customerFacts;
  const perimeterDimensions = extractFactValue(facts, (_, originalFact) => {
    const labeledMatch = originalFact.match(/^perimeter(?: dimensions?)?:\s*(.+)$/i);
    if (labeledMatch) return labeledMatch[1];
    return /perimeter/i.test(originalFact) ? originalFact : null;
  }) ?? NOT_RECORDED;
  const floorArea = extractFactValue(facts, (_, originalFact) => {
    const labeledMatch = originalFact.match(/^floor area:\s*(.+)$/i);
    if (labeledMatch) return labeledMatch[1];
    return /floor area/i.test(originalFact) ? originalFact : null;
  }) ?? NOT_RECORDED;
  const primaryPipeDiameters = extractFactValue(facts, (_, originalFact) => {
    const labeledMatch = originalFact.match(/^(?:current )?primary pipe diameters?:\s*(.+)$/i);
    if (labeledMatch) return labeledMatch[1];
    return /pipe diameters?/i.test(originalFact) ? originalFact : null;
  }) ?? NOT_RECORDED;
  const targetedMinimumVolume = extractFactValue(facts, (_, originalFact) => {
    const labeledMatch = originalFact.match(/^target(?:ed)? minimum volume:\s*(.+)$/i);
    if (labeledMatch) return labeledMatch[1];
    return /(?:minimum|target).*volume/i.test(originalFact) ? originalFact : null;
  }) ?? NOT_RECORDED;
  const calculatedRecoveryTimes = extractFactValue(facts, (_, originalFact) => {
    const labeledMatch = originalFact.match(/^(?:calculated )?recovery times?:\s*(.+)$/i);
    if (labeledMatch) return labeledMatch[1];
    return /recovery/i.test(originalFact) ? originalFact : null;
  }) ?? NOT_RECORDED;
  const standingHeatLoss = extractFactValue(facts, (_, originalFact) => {
    const labeledMatch = originalFact.match(/^standing heat loss:\s*(.+)$/i);
    if (labeledMatch) return labeledMatch[1];
    return /standing heat loss/i.test(originalFact) ? originalFact : null;
  }) ?? NOT_RECORDED;
  const activeHeatSourceOutput = extractFactValue(facts, (_, originalFact) => {
    const labeledMatch = originalFact.match(/^active heat source(?: output)?(?: kw)?:\s*(.+)$/i);
    if (labeledMatch) return labeledMatch[1];
    return /heat source.*\bkw\b/i.test(originalFact) ? originalFact : null;
  }) ?? NOT_RECORDED;

  return {
    physicalSiteConstraints: [
      { label: 'Perimeter dimensions', value: perimeterDimensions },
      { label: 'Floor area', value: floorArea },
      { label: 'Calculated peak heat loss', value: demographics.peakHeatLoss },
      { label: 'Current primary pipe diameters', value: primaryPipeDiameters },
    ],
    plannedHardwareAllocations: [
      { label: 'Cylinder type', value: inferCylinderType(cover) },
      { label: 'Targeted minimum volume', value: targetedMinimumVolume },
      { label: 'Calculated recovery times', value: calculatedRecoveryTimes },
      { label: 'Standing heat loss', value: standingHeatLoss },
      { label: 'Active heat source kW output', value: activeHeatSourceOutput },
    ],
  };
}

function formatContentSourceVisualAssetIds(ids: readonly string[]): string {
  if (ids.length === 0) return 'none';
  return ids.map((id) => id.replaceAll('_', '-')).join(', ');
}

function formatSceneDiagnostics(diags: NonNullable<PortalJourneyPrintModelV1['contentSource']>['sceneDiagnostics']): string[] {
  return diags.map((diag) => {
    const blocked = diag.blockingReasons.length > 0 ? `blocked: ${diag.blockingReasons.join(' | ')}` : 'blocked: no';
    const phrases = diag.offendingPhrases.length > 0 ? `offending phrases: ${diag.offendingPhrases.join(', ')}` : 'offending phrases: none';
    return `${diag.sectionId} · asset=${diag.visualAssetId ?? 'none'} · classification=${diag.visualClassification} · renderer=${diag.rendererType} · fallback=${diag.fallbackUsed ? 'yes' : 'no'} · ${blocked} · ${phrases}`;
  });
}

function formatVisualCoverageRouteSummary(
  route: NonNullable<PortalJourneyPrintModelV1['contentSource']>['visualCoverageAudit']['routes'][number],
): string {
  const canonical = route.summary.canonicalVisualsAvailable.join(', ') || 'none';
  const missingCanonical = route.summary.missingCanonicalVisuals.join(', ') || 'none';
  const retired = route.summary.retiredVisualsRequested.join(', ') || 'none';
  const textOnly = route.summary.textOnlySceneSectionIds.join(', ') || 'none';
  return `${route.routeId} · canonical visuals available: ${canonical} · missing canonical visuals: ${missingCanonical} · retired visuals requested: ${retired} · scenes rendering text-only: ${textOnly}`;
}

function formatVisualCoverageRouteScenes(
  route: NonNullable<PortalJourneyPrintModelV1['contentSource']>['visualCoverageAudit']['routes'][number],
): string[] {
  return route.scenes.map((scene) => `${route.routeId}/${scene.sectionId} · requested visual=${scene.requestedVisualAssetId} · classification=${scene.classification} · renderer availability=diagram:${scene.rendererAvailability.hasDiagramRenderer ? 'yes' : 'no'}, print-fallback:${scene.rendererAvailability.hasPrintFallback ? 'yes' : 'no'} · blocked reason=${scene.blockedReason ?? 'none'}`);
}

function formatRouteCompletenessRequirement(
  requirement: NonNullable<NonNullable<PortalJourneyPrintModelV1['contentSource']>['routeCompletenessAudit']>['requirements'][number],
): string {
  const sectionId = requirement.sectionId ?? 'none';
  const renderer = requirement.rendererType ?? 'n/a';
  const title = requirement.title ?? 'none';
  const takeaway = requirement.takeaway ?? 'none';
  const reasons = requirement.reasons.join(' | ') || 'none';
  return `${requirement.requirementId} · label=${requirement.label} · present=${requirement.present ? 'yes' : 'no'} · blocked=${requirement.blocked ? 'yes' : 'no'} · generic=${requirement.usesGenericFallbackCopy ? 'yes' : 'no'} · section=${sectionId} · renderer=${renderer} · title=${title} · takeaway=${takeaway} · reasons=${reasons}`;
}

function PrintCover({ cover, contentSource, demographics, pageNumber }: PrintCoverProps) {
  return (
    <section
      className="pjpp-page pjpp-page--cover"
      aria-label="Supporting Insight cover"
      data-testid="pjpp-cover"
      data-page={pageNumber}
    >
      <header className="pjpp-cover-header" data-reading-region="true">
        {cover.brandName ? (
          <p className="pjpp-cover-brand" data-testid="pjpp-cover-brand">
            {cover.brandName}
          </p>
        ) : null}
        <h1 className="pjpp-cover-title" data-testid="pjpp-cover-title">
          {cover.title}
        </h1>
        <p className="pjpp-cover-summary" data-testid="pjpp-cover-summary">
          {cover.summary}
        </p>
        {cover.addressSummary ? (
          <p className="pjpp-cover-summary" data-testid="pjpp-cover-address-summary">
            {cover.addressSummary}
          </p>
        ) : null}
        <p className="pjpp-cover-confidence" data-testid="pjpp-cover-confidence">
          Atlas recommendation confidence: strong fit to your surveyed home pattern.
        </p>
        {import.meta.env.DEV && contentSource != null ? (
          <>
            <p className="pjpp-cover-content-source" data-testid="pjpp-cover-content-source">
              Content source (dev): audienceProjection present: {contentSource.audienceProjectionPresent ? 'yes' : 'no'} · selected concepts count: {contentSource.selectedConceptCount} · selected story scenes count: {contentSource.selectedStorySceneCount} · visual asset IDs used: {formatContentSourceVisualAssetIds(contentSource.visualAssetIds)} · fallback sections used: {contentSource.fallbackSectionsUsed ? 'yes' : 'no'} · story-scene validation (warnings/errors/blocking): {contentSource.storySceneValidation.warningCount}/{contentSource.storySceneValidation.errorCount}/{contentSource.storySceneValidation.blockingErrorCount} · composition errors: {contentSource.storySceneValidation.compositionErrorCount} · rejected scenes: {contentSource.storySceneValidation.rejectedSceneCount} ({contentSource.storySceneValidation.rejectedSceneSectionIds.join(', ') || 'none'}) · offending phrases: {contentSource.storySceneValidation.offendingPhrases.join(', ') || 'none'} · blocking codes: {contentSource.storySceneValidation.errorCodes.length > 0 ? contentSource.storySceneValidation.errorCodes.join(', ') : 'none'}
            </p>
            <ul className="pjpp-cover-content-source" data-testid="pjpp-cover-scene-diagnostics">
              {formatSceneDiagnostics(contentSource.sceneDiagnostics).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
             <ul className="pjpp-cover-content-source" data-testid="pjpp-cover-visual-coverage-route-summary">
               {contentSource.visualCoverageAudit.routes.map((route) => {
                 const routeSummary = formatVisualCoverageRouteSummary(route);
                 return (
                  <li key={route.routeId}>
                    {routeSummary}
                    <ul>
                      <li>
                        required story scenes: {route.requiredStorySceneSectionIds.join(', ') || 'none'}
                      </li>
                      <li>
                        requested visual IDs: {route.requestedVisualAssetIds.join(', ') || 'none'}
                      </li>
                      {formatVisualCoverageRouteScenes(route).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </li>
                 );
               })}
             </ul>
             {contentSource.routeCompletenessAudit != null ? (
               <ul className="pjpp-cover-content-source" data-testid="pjpp-cover-route-completeness">
                 <li>
                   route completeness · route={contentSource.routeCompletenessAudit.routeId} · ready={contentSource.routeCompletenessAudit.ready ? 'yes' : 'no'} · missing={contentSource.routeCompletenessAudit.missingRequirementIds.join(', ') || 'none'} · blocked={contentSource.routeCompletenessAudit.blockedRequirementIds.join(', ') || 'none'} · generic={contentSource.routeCompletenessAudit.genericFallbackRequirementIds.join(', ') || 'none'}
                 </li>
                 {contentSource.routeCompletenessAudit.requirements.map((requirement) => (
                   <li key={requirement.requirementId}>{formatRouteCompletenessRequirement(requirement)}</li>
                 ))}
               </ul>
             ) : null}
           </>
         ) : null}
       </header>

      <PrintableJourneySummary
        propertyTitle={cover.addressSummary}
        recommendationTitle={cover.title}
        summary={cover.summary}
      />

      <aside className="pjpp-cover-facts" aria-label="Your home" data-testid="pjpp-cover-facts" data-reading-region="true">
        <PrintableSystemCard
        heading="Your home"
        summary={cover.addressSummary ?? 'Survey details used for this recommendation.'}
        />
        <div className="pjpp-demographics-grid" aria-label="Household demographics" data-testid="pjpp-demographics-grid">
        <div className="pjpp-demographics-grid__cell" data-testid="pjpp-demographics-cell-occupants">
          <p className="pjpp-demographics-grid__label">Occupants</p>
          <p className="pjpp-demographics-grid__value">{demographics.occupants}</p>
        </div>
        <div className="pjpp-demographics-grid__cell" data-testid="pjpp-demographics-cell-bathrooms">
          <p className="pjpp-demographics-grid__label">Bathrooms</p>
          <p className="pjpp-demographics-grid__value">{demographics.bathrooms}</p>
        </div>
        <div className="pjpp-demographics-grid__cell" data-testid="pjpp-demographics-cell-peak-heat-loss">
          <p className="pjpp-demographics-grid__label">Peak Heat Loss (kW)</p>
          <p className="pjpp-demographics-grid__value">{demographics.peakHeatLoss}</p>
        </div>
        <div className="pjpp-demographics-grid__cell" data-testid="pjpp-demographics-cell-hot-water-demand">
          <p className="pjpp-demographics-grid__label">Hot Water Demand</p>
          <p className="pjpp-demographics-grid__value">{demographics.hotWaterDemand}</p>
        </div>
        </div>
        {cover.customerFacts.length > 0 ? (
        <div className="pjpp-cover-chips" data-testid="pjpp-cover-fact-chips">
          {cover.customerFacts.slice(0, 4).map((fact) => (
            <span key={fact} className="pjpp-chip">
              {fact}
            </span>
          ))}
        </div>
        ) : null}
      </aside>
    </section>
  );
}

interface PrintSectionProps {
  section: PortalJourneyPrintSectionV1;
  pageNumber: number;
}

interface PrintRecommendationReasonsProps {
  reasons: readonly RecommendationReasonBlockV1[];
  pageNumber: number;
}

function PrintSection({ section, pageNumber }: PrintSectionProps) {
  const storyScene = section.storyScene;
  const composition = storyScene?.composition;
  const pageArchetype = composition?.pageArchetype ?? 'explanation';
  const densityTier = composition?.densityTier ?? 'balanced';
  const focalVisualPriority = composition?.focalVisualPriority ?? 'supporting';
  const sceneTitle = storyScene?.title ?? section.heading;
  const sceneCustomerTakeaway = storyScene?.customerTakeaway ?? section.keyTakeaway;
  const sceneWhyItMatters = storyScene?.whyItMatters ?? section.summary;
  const sceneWhatYouWillNotice = storyScene?.whatYouWillNotice ?? section.items[0] ?? section.reassurance;
  const noticeItems = storyScene != null
    ? [sceneWhatYouWillNotice]
    : section.items;
  const visualPlan = resolveSectionVisualPlan(section);

  return (
    <section
      className={`pjpp-page pjpp-section pjpp-section--${section.sectionId} pjpp-section--archetype-${pageArchetype} pjpp-section--density-${densityTier} pjpp-section--focal-${focalVisualPriority}`}
      aria-labelledby={`pjpp-section-heading-${section.sectionId}`}
      data-testid={`pjpp-section-${section.sectionId}`}
      data-page={pageNumber}
      data-archetype={pageArchetype}
    >
      <h2
        id={`pjpp-section-heading-${section.sectionId}`}
        className="pjpp-section__heading"
      >
        {sceneTitle}
      </h2>

      <p className="pjpp-section__summary">{sceneCustomerTakeaway}</p>

      {pageArchetype === 'quiet' ? (
        <div className="pjpp-quiet-content" data-testid={`pjpp-quiet-${section.sectionId}`}>
          <p className="pjpp-quiet-content__copy">{sceneWhyItMatters}</p>
        </div>
      ) : (
        <ul className="pjpp-outcome-cards" data-testid={`pjpp-items-${section.sectionId}`}>
          {noticeItems.slice(0, composition?.maxCardsPerPage ?? 3).map((item, i) => (
            <li key={`${section.sectionId}-${i}`} className="pjpp-outcome-card">
              <p className="pjpp-outcome-card__label">What you will notice</p>
              <p className="pjpp-outcome-card__copy">{item}</p>
            </li>
          ))}
        </ul>
      )}

      {pageArchetype === 'hero' ? (
        <p className="pjpp-section__hero-takeaway" data-testid={`pjpp-takeaway-${section.sectionId}`}>
          {sceneWhyItMatters}
        </p>
      ) : (
        <p className="pjpp-section__takeaway" data-testid={`pjpp-takeaway-${section.sectionId}`}>
          <strong>Why it matters:</strong> {sceneWhyItMatters}
        </p>
      )}

      {visualPlan.rendererType === 'diagram_component' && pageArchetype !== 'quiet' ? (
        <figure
          className="pjpp-section__diagram"
          data-testid={`pjpp-diagram-${section.sectionId}`}
          data-print-safe="true"
          style={{ '--pjpp-visual-scale': composition?.visualScale ?? 1 } as Record<string, number>}
        >
          <DiagramRenderer
            diagramId={visualPlan.visualAssetId}
            printSafe
            reducedMotion
          />
          {section.diagramCaption ? (
            <figcaption className="pjpp-section__diagram-caption">{section.diagramCaption}</figcaption>
          ) : null}
        </figure>
      ) : null}
      {import.meta.env.DEV && visualPlan.rendererType === 'none' && pageArchetype !== 'quiet' ? (
        <p
          className="pjpp-section__diagram-caption"
          data-testid={`pjpp-missing-visual-${section.sectionId}`}
        >
          Missing visual: {visualPlan.blockingReason}
        </p>
      ) : null}

      {pageArchetype !== 'quiet' ? (
        <aside className="pjpp-reassurance" data-testid={`pjpp-reassurance-${section.sectionId}`} data-reading-region="true">
          {section.reassurance}
        </aside>
      ) : null}
    </section>
  );
}

function PrintRecommendationReasons({ reasons, pageNumber }: PrintRecommendationReasonsProps) {
  return (
    <section
      className="pjpp-page pjpp-section pjpp-section--recommendation-reasons"
      aria-labelledby="pjpp-recommendation-reasons-heading"
      data-testid="pjpp-recommendation-reasons"
      data-page={pageNumber}
    >
      <h2 id="pjpp-recommendation-reasons-heading" className="pjpp-section__heading">
        Why this recommendation fits your home
      </h2>
      <p className="pjpp-section__summary">
        Scan each card from home fact to practical day-to-day outcome.
      </p>
      <p className="pjpp-visual-grammar" data-testid="pjpp-visual-grammar">
        Fact <span aria-hidden="true">→</span> Why it matters <span aria-hidden="true">→</span> Atlas chose <span aria-hidden="true">→</span> What you will notice
      </p>
      <ul className="pjpp-reason-list" data-testid="pjpp-reason-list">
        {reasons.slice(0, 5).map((reason) => (
          <li key={reason.id} className="pjpp-reason-card" data-testid={`pjpp-reason-${reason.category}`}>
            <h3 className="pjpp-reason-card__title">
              <span className="pjpp-reason-card__icon" aria-hidden="true">{REASON_ICON_BY_CATEGORY[reason.category]}</span>
              <span>{reason.homeFact}</span>
            </h3>
            <dl className="pjpp-reason-card__rows">
              <div className="pjpp-reason-card__row">
                <dt>Why it matters</dt>
                <dd>{reason.whyItMatters}</dd>
              </div>
              <div className="pjpp-reason-card__row">
                <dt>Atlas chose</dt>
                <dd>{reason.atlasRecommendationOutcome}</dd>
              </div>
              <div className="pjpp-reason-card__row">
                <dt>What you will notice</dt>
                <dd>{reason.practicalEffect}</dd>
              </div>
            </dl>
            {reason.detail ? <p className="pjpp-reason-card__detail">{reason.detail}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

interface PrintNextStepsProps {
  nextSteps: PortalJourneyPrintModelV1['nextSteps'];
  qrDestinations: PortalJourneyPrintModelV1['qrDestinations'];
  pageNumber: number;
}

// ─── System protection section ────────────────────────────────────────────────

interface PrintSystemProtectionProps {
  systemProtection: SystemProtectionSummaryV1;
  pageNumber: number;
}

function PrintSystemProtection({ systemProtection, pageNumber }: PrintSystemProtectionProps) {
  return (
    <section
      className="pjpp-page pjpp-section pjpp-section--system-protection"
      aria-labelledby="pjpp-system-protection-heading"
      data-testid="pjpp-system-protection"
      data-page={pageNumber}
    >
      <h2
        id="pjpp-system-protection-heading"
        className="pjpp-section__heading"
      >
        {systemProtection.title}
      </h2>

      <p className="pjpp-section__summary">{systemProtection.customerSummary}</p>

      {systemProtection.customerVisibleBullets.length > 0 ? (
        <ul className="pjpp-section__items" data-testid="pjpp-items-system-protection">
          {systemProtection.customerVisibleBullets.map((bullet, i) => (
            <li key={i} className="pjpp-section__item">
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}

      <aside className="pjpp-reassurance" data-testid="pjpp-reassurance-system-protection" data-reading-region="true">
        <PrintableQuickWinCard heading="Installer check" body={systemProtection.whatInstallerWillCheck} />
      </aside>
    </section>
  );
}

function PrintNextSteps({ nextSteps, qrDestinations, pageNumber }: PrintNextStepsProps) {
  return (
    <section
      className="pjpp-page pjpp-next-steps"
      aria-labelledby="pjpp-next-steps-heading"
      data-testid="pjpp-next-steps"
      data-page={pageNumber}
    >
      <h2 id="pjpp-next-steps-heading" className="pjpp-section__heading">
        What happens next
      </h2>

      <ol className="pjpp-next-steps__list" data-testid="pjpp-next-steps-list">
        {nextSteps.map((step, i) => (
          <li key={i} className="pjpp-next-steps__item">
            <article className="pjpp-next-steps__card">
              <PrintableQuickWinCard heading={step.label} body={step.body} />
            </article>
          </li>
        ))}
      </ol>

      <p className="pjpp-qr-destinations__intro">
        Deep dive links (optional): scan a QR code after your handover if you want more detail.
      </p>

      <ul className="pjpp-qr-destinations__list" data-testid="pjpp-qr-list">
        {qrDestinations.map((dest, i) => (
          <li key={i} className="pjpp-qr-destination" data-testid={`pjpp-qr-item-${i}`} data-reading-region="true">
            <div
              className="pjpp-qr-destination__placeholder"
              aria-label={`QR code for: ${dest.heading}`}
              data-print-safe="true"
            />
            <div className="pjpp-qr-destination__text">
              <p className="pjpp-qr-destination__heading">{dest.heading}</p>
              <p className="pjpp-qr-destination__note">{dest.note}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface PrintTechnicalHandoffProps {
  technicalHandoff: TechnicalHandoffData;
  pageNumber: number;
}

function PrintTechnicalHandoff({ technicalHandoff, pageNumber }: PrintTechnicalHandoffProps) {
  return (
    <section
      className="pjpp-page technical-handoff-section"
      aria-labelledby="pjpp-technical-handoff-heading"
      data-testid="pjpp-technical-handoff"
      data-page={pageNumber}
    >
      <h2 id="pjpp-technical-handoff-heading" className="pjpp-section__heading">
        Technical site hand-off
      </h2>
      <div className="pjpp-technical-handoff-grid">
        <section className="pjpp-technical-handoff__column" data-testid="pjpp-technical-handoff-physical">
          <h3 className="pjpp-technical-handoff__title">Physical Site Constraints</h3>
          <dl className="pjpp-technical-handoff__rows">
            {technicalHandoff.physicalSiteConstraints.map((row) => (
              <div key={row.label} className="pjpp-technical-handoff__row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="pjpp-technical-handoff__column" data-testid="pjpp-technical-handoff-planned">
          <h3 className="pjpp-technical-handoff__title">Planned Hardware Allocations</h3>
          <dl className="pjpp-technical-handoff__rows">
            {technicalHandoff.plannedHardwareAllocations.map((row) => (
              <div key={row.label} className="pjpp-technical-handoff__row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </section>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface PortalJourneyPrintPackProps {
  model: PortalJourneyPrintModelV1;
  mode?: CustomerDocumentRendererMode;
}

/**
 * PortalJourneyPrintPack
 *
 * Renders the supporting PDF for the open-vented → sealed + unvented portal
 * journey.  Designed for A4 print output:
 *   - No interactive controls
 *   - No dev labels or raw engine identifiers
 *   - Diagrams in print-safe mode
 *   - Page budget respected (max 7 pages)
 */
export function PortalJourneyPrintPack({ model, mode = 'printable' }: PortalJourneyPrintPackProps) {
  const customerDocument = buildCustomerDocumentModel({
    model,
    mode,
  });
  const demographics = extractDemographicsSummary(customerDocument.cover.customerFacts);
  const technicalHandoff = buildTechnicalHandoffData(customerDocument.cover, demographics);
  let pageCounter = 1;

  return (
    <article
      className="pjpp-document atlas-reading-surface"
      data-testid="pjpp-document"
      data-print-safe="true"
      aria-label="Customer document"
    >
      <ReadingAssistOverlay />
      <PrintCover
        cover={customerDocument.cover}
        contentSource={model.contentSource}
        demographics={demographics}
        pageNumber={pageCounter++}
      />

      {customerDocument.recommendationReasons.length > 0 ? (
        <PrintRecommendationReasons reasons={customerDocument.recommendationReasons} pageNumber={pageCounter++} />
      ) : null}

      {customerDocument.sections.map((section) => (
        <PrintSection
          key={`${section.sectionId}-${section.contentId}`}
          section={section}
          pageNumber={pageCounter++}
        />
      ))}

      {customerDocument.systemProtection != null ? (
        <PrintSystemProtection
          systemProtection={customerDocument.systemProtection}
          pageNumber={pageCounter++}
        />
      ) : null}

      <PrintNextSteps
        nextSteps={customerDocument.nextSteps}
        qrDestinations={customerDocument.qrDestinations}
        pageNumber={pageCounter++}
      />

      <PrintTechnicalHandoff
        technicalHandoff={technicalHandoff}
        pageNumber={pageCounter++}
      />
    </article>
  );
}
