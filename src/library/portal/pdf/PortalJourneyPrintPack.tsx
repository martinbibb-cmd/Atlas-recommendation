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
  RecommendationReasonBlockV1,
} from './buildPortalJourneyPrintModel';
import type { SystemProtectionSummaryV1 } from './buildSystemProtectionSummary';
import { buildCustomerDocumentModel, type CustomerDocumentRendererMode } from './CustomerDocumentRenderer';
import { ReadingAssistOverlay } from '../../../accessibility/readingAssist/ReadingAssistOverlay';
import { PrintableJourneySummary, PrintableQuickWinCard, PrintableSystemCard } from '../../../portal/printable';
import { REASON_ICON_BY_CATEGORY } from './recommendationReasonVisuals';
import {
  CustomerScenePrint,
  buildCustomerPresentationScenes,
} from '../../customerPresentation';
import './portalJourneyPrintPack.css';

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

interface PrintRecommendationReasonsProps {
  reasons: readonly RecommendationReasonBlockV1[];
  pageNumber: number;
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
  const customerScenes = buildCustomerPresentationScenes(customerDocument.sections);
  const demographics = extractDemographicsSummary(customerDocument.cover.customerFacts);
  let pageCounter = 1;
  const coverPageNumber = pageCounter++;
  const recommendationReasonsPageNumber =
    customerDocument.recommendationReasons.length > 0 ? pageCounter++ : undefined;
  const sceneStartPageNumber = pageCounter;
  pageCounter += customerScenes.length;
  const systemProtectionPageNumber =
    customerDocument.systemProtection != null ? pageCounter++ : undefined;
  const nextStepsPageNumber = pageCounter++;

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
        pageNumber={coverPageNumber}
      />

      {recommendationReasonsPageNumber != null ? (
        <PrintRecommendationReasons
          reasons={customerDocument.recommendationReasons}
          pageNumber={recommendationReasonsPageNumber}
        />
      ) : null}

      <CustomerScenePrint scenes={customerScenes} startingPage={sceneStartPageNumber} />

      {systemProtectionPageNumber != null && customerDocument.systemProtection != null ? (
        <PrintSystemProtection
          systemProtection={customerDocument.systemProtection}
          pageNumber={systemProtectionPageNumber}
        />
      ) : null}

      <PrintNextSteps
        nextSteps={customerDocument.nextSteps}
        qrDestinations={customerDocument.qrDestinations}
        pageNumber={nextStepsPageNumber}
      />
    </article>
  );
}
