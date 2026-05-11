import { getDiagramsByConceptId } from '../diagrams/diagramExplanationRegistry';
import type { AtlasMvpContentEntryV1 } from '../content/atlasMvpContentMapRegistry';
import type { EducationalContentV1 } from '../content/EducationalContentV1';

export interface PortalEducationalCardV1 {
  title: string;
  oneLineSummary: string;
  customerWording: string;
  whatYouMayNotice: string;
  whatStaysFamiliar: string;
  whatNotToWorryAbout: string;
  misconception?: string;
  reality?: string;
  suggestedDiagramIds: string[];
  suggestedAnimationIds: string[];
  suggestedPrintCardIds: string[];
}

export interface GetPortalEducationalContentInputV1 {
  selectedConceptIds: string[];
  routingTriggerTags: string[];
  atlasMvpContentMapRegistry: AtlasMvpContentEntryV1[];
  educationalContentRegistry: EducationalContentV1[];
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function parseEducationalExplanation(customerExplanation: string): { whatYouMayNotice: string; customerWording: string } {
  const match = customerExplanation.match(/what you may notice:\s*(.*?)\s*what this means:\s*(.*)$/i);
  if (!match) {
    return {
      whatYouMayNotice: customerExplanation.trim(),
      customerWording: customerExplanation.trim(),
    };
  }
  return {
    whatYouMayNotice: match[1]?.trim() ?? '',
    customerWording: match[2]?.trim() ?? '',
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
    misconception: entry.misconception.trim() ? entry.misconception : undefined,
    reality: entry.reality.trim() ? entry.reality : undefined,
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
    misconception: entry.commonMisunderstanding.trim() ? entry.commonMisunderstanding : undefined,
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
}: GetPortalEducationalContentInputV1): PortalEducationalCardV1[] {
  const selectedConceptSet = new Set(selectedConceptIds);
  const routingTagSet = new Set(routingTriggerTags.map(normalizeToken));

  const scoredMvp = atlasMvpContentMapRegistry
    .map((entry) => {
      const conceptMatches = entry.taxonomyConceptIds.filter((conceptId) => selectedConceptSet.has(conceptId)).length;
      const triggerMatches = entry.routingTriggerTags
        .filter((tag) => routingTagSet.has(normalizeToken(tag)))
        .length;
      const score = (conceptMatches * 4) + (triggerMatches * 2);
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
      const score = (conceptMatches * 4) + (evidenceMatches * 2);
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.contentId.localeCompare(b.entry.contentId));

  return scoredEducational.map((item) => toPortalCardFromEducational(item.entry));
}
