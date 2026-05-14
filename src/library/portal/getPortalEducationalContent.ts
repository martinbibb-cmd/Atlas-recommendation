import { getDiagramsByConceptId } from '../diagrams/diagramExplanationRegistry';
import type { AtlasMvpContentEntryV1 } from '../content/atlasMvpContentMapRegistry';
import type { EducationalContentV1 } from '../content/EducationalContentV1';
import type { LibraryContentProjectionV1 } from '../projections/LibraryContentProjectionV1';
import type { LibraryProjectionSafetyV1 } from '../projections/qa/LibraryProjectionSafetyV1';

export interface PortalEducationalCardV1 {
  title: string;
  oneLineSummary: string;
  customerWording: string;
  whatYouMayNotice: string;
  whatStaysFamiliar: string;
  whatNotToWorryAbout: string;
  misconception?: string;
  reality?: string;
  technicalAppendixSummary?: string;
  suggestedDiagramIds: string[];
  suggestedAnimationIds: string[];
  suggestedPrintCardIds: string[];
}

export interface GetPortalEducationalContentInputV1 {
  selectedConceptIds: string[];
  routingTriggerTags: string[];
  atlasMvpContentMapRegistry: AtlasMvpContentEntryV1[];
  educationalContentRegistry: EducationalContentV1[];
  /**
   * Optional audience projection.  When supplied, `selectedConceptIds` is
   * intersected with `audienceProjection.visibleConcepts` so that the portal
   * only surfaces content that the projection has already approved for the
   * given audience.
   */
  audienceProjection?: LibraryContentProjectionV1;
  /**
   * Optional customer projection safety result from assessLibraryProjectionSafety.
   * When present and safeForCustomer is false, an empty card list is returned
   * so the portal library section falls back to a safe state rather than
   * displaying potentially unsafe content.
   */
  customerProjectionSafety?: LibraryProjectionSafetyV1;
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function parseEducationalExplanation(customerExplanation: string): { whatYouMayNotice: string; customerWording: string } {
  const source = customerExplanation.trim();
  const lowerSource = source.toLowerCase();
  const noticeMarker = 'what you may notice:';
  const meaningMarker = 'what this means:';
  const noticeStart = lowerSource.indexOf(noticeMarker);
  const meaningStart = lowerSource.indexOf(meaningMarker);

  if (noticeStart === -1 || meaningStart === -1 || meaningStart <= noticeStart) {
    return {
      whatYouMayNotice: source,
      customerWording: source,
    };
  }

  const noticeText = source.slice(noticeStart + noticeMarker.length, meaningStart).trim();
  const meaningText = source.slice(meaningStart + meaningMarker.length).trim();

  return {
    whatYouMayNotice: noticeText,
    customerWording: meaningText,
  };
}

function toPortalCardFromMvp(entry: AtlasMvpContentEntryV1): PortalEducationalCardV1 {
  return {
    title: entry.title,
    oneLineSummary: entry.oneLineSummary,
    customerWording: entry.customerWording,
    whatYouMayNotice: entry.whatYouMayNotice,
    whatStaysFamiliar: entry.whatStaysFamiliar,
    whatNotToWorryAbout: entry.whatNotToWorryAbout,
    misconception: entry.misconception?.trim() ? entry.misconception : undefined,
    reality: entry.reality?.trim() ? entry.reality : undefined,
    technicalAppendixSummary: entry.technicalAppendixSummary?.trim() ? entry.technicalAppendixSummary : undefined,
    suggestedDiagramIds: entry.suggestedDiagramIds,
    suggestedAnimationIds: entry.suggestedAnimationIds,
    suggestedPrintCardIds: entry.suggestedPrintCardIds,
  };
}

function toPortalCardFromEducational(entry: EducationalContentV1): PortalEducationalCardV1 {
  const parsed = parseEducationalExplanation(entry.customerExplanation);
  return {
    title: entry.title,
    oneLineSummary: entry.plainEnglishSummary,
    customerWording: parsed.customerWording,
    whatYouMayNotice: parsed.whatYouMayNotice,
    whatStaysFamiliar: entry.livingWithSystemGuidance ?? '',
    whatNotToWorryAbout: entry.safetyNotice ?? '',
    misconception: entry.commonMisunderstanding?.trim() ? entry.commonMisunderstanding : undefined,
    technicalAppendixSummary: entry.technicalAppendixSummary?.trim() ? entry.technicalAppendixSummary : undefined,
    suggestedDiagramIds: getDiagramsByConceptId(entry.conceptId).map((diagram) => diagram.diagramId),
    suggestedAnimationIds: [],
    suggestedPrintCardIds: [],
  };
}

export function getPortalEducationalContent({
  selectedConceptIds,
  routingTriggerTags,
  atlasMvpContentMapRegistry,
  educationalContentRegistry,
  audienceProjection,
  customerProjectionSafety,
}: GetPortalEducationalContentInputV1): PortalEducationalCardV1[] {
  // When the customer projection safety gate is present and has failed, return
  // an empty list so the portal library section falls back safely rather than
  // displaying content that contains installer/compliance leakage.
  if (customerProjectionSafety != null && !customerProjectionSafety.safeForCustomer) {
    return [];
  }

  // When an audience projection is provided, restrict concept selection to
  // concepts that have been approved for the given audience.
  const effectiveConceptIds =
    audienceProjection != null
      ? selectedConceptIds.filter((id) => audienceProjection.visibleConcepts.includes(id))
      : selectedConceptIds;

  const selectedConceptSet = new Set(effectiveConceptIds);
  const routingTagSet = new Set(routingTriggerTags.map(normalizeToken));

  const scoredMvp = atlasMvpContentMapRegistry
    .map((entry) => {
      const conceptMatches = entry.taxonomyConceptIds.filter((conceptId) => selectedConceptSet.has(conceptId)).length;
      const triggerMatches = entry.routingTriggerTags
        .filter((tag) => routingTagSet.has(normalizeToken(tag)))
        .length;
      const score = (conceptMatches * 10) + triggerMatches;
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));

  if (scoredMvp.length > 0) {
    return scoredMvp.map((item) => toPortalCardFromMvp(item.entry));
  }

  const scoredEducational = educationalContentRegistry
    .map((entry) => {
      const conceptMatches = selectedConceptSet.has(entry.conceptId) ? 1 : 0;
      const evidenceMatches = entry.requiredEvidenceFacts
        .filter((fact) => selectedConceptSet.has(fact) || routingTagSet.has(normalizeToken(fact)))
        .length;
      const score = (conceptMatches * 10) + evidenceMatches;
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.contentId.localeCompare(b.entry.contentId));

  return scoredEducational.map((item) => toPortalCardFromEducational(item.entry));
}
