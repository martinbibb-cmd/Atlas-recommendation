import { describe, expect, it } from 'vitest';
import type { AtlasMvpContentEntryV1 } from '../../content/atlasMvpContentMapRegistry';
import type { EducationalContentV1 } from '../../content/EducationalContentV1';
import { getPortalEducationalContent } from '../getPortalEducationalContent';

const mvpEntry: AtlasMvpContentEntryV1 = {
  id: 'CON_TEST',
  title: 'Pressure vs storage',
  oneLineSummary: 'Pressure and storage are separate.',
  customerWording: 'Strong pressure does not create more stored hot water.',
  whatYouMayNotice: 'Recovery can follow heavy demand.',
  whatStaysFamiliar: 'Daily controls stay familiar.',
  whatNotToWorryAbout: 'Recovery after heavy use is normal.',
  misconception: 'Higher pressure means more stored hot water.',
  reality: 'Pressure affects delivery force; storage sets available amount.',
  dangerousOversimplification: 'Use pressure changes to solve storage shortfall.',
  analogy: 'Tap force versus bucket size',
  whereItWorks: 'Separates force from quantity.',
  whereItBreaks: 'Recovery also matters.',
  portalTreatment: { customerCopy: 'Pressure and storage are checked separately.', includeTechnicalAppendixByDefault: false },
  pdfTreatment: { summary: 'Pressure and storage are independent.', includeTechnicalAppendix: true },
  engineerHandoverTreatment: 'Explain pressure and storage limits.',
  technicalAppendixSummary: 'Technical appendix content.',
  accessibilityNotes: ['Plain language'],
  suggestedDiagramIds: ['diagram-pressure-vs-storage'],
  suggestedAnimationIds: ['anim-pressure-volume'],
  suggestedPrintCardIds: ['print-pressure-storage'],
  taxonomyConceptIds: ['pressure_vs_storage'],
  routingTriggerTags: ['pressure'],
  confidenceLevel: 'physical_law',
};

const educationalEntry: EducationalContentV1 = {
  contentId: 'EC-TEST',
  conceptId: 'pressure_vs_storage',
  title: 'Educational pressure vs storage',
  plainEnglishSummary: 'Fallback summary.',
  customerExplanation: 'What you may notice: fallback notice. What this means: fallback explanation.',
  analogyOptions: [],
  commonMisunderstanding: 'Fallback misunderstanding.',
  dangerousOversimplification: 'Fallback dangerous simplification.',
  livingWithSystemGuidance: 'Fallback guidance.',
  technicalAppendixSummary: 'Fallback technical appendix',
  printSummary: 'Fallback print summary',
  readingLevel: 'standard',
  accessibilityNotes: [],
  requiredEvidenceFacts: ['pressure_vs_storage'],
  confidenceLevel: 'best_practice',
};

describe('getPortalEducationalContent', () => {
  it('prefers MVP entries when concept/tag matches exist', () => {
    const cards = getPortalEducationalContent({
      selectedConceptIds: ['pressure_vs_storage'],
      routingTriggerTags: ['pressure'],
      atlasMvpContentMapRegistry: [mvpEntry],
      educationalContentRegistry: [educationalEntry],
    });

    expect(cards).toHaveLength(1);
    expect(cards[0]?.title).toBe('Pressure vs storage');
    expect(cards[0]?.suggestedDiagramIds).toContain('diagram-pressure-vs-storage');
  });

  it('falls back to educational content when no MVP match exists', () => {
    const cards = getPortalEducationalContent({
      selectedConceptIds: ['pressure_vs_storage'],
      routingTriggerTags: ['pressure'],
      atlasMvpContentMapRegistry: [],
      educationalContentRegistry: [educationalEntry],
    });

    expect(cards).toHaveLength(1);
    expect(cards[0]?.title).toBe('Educational pressure vs storage');
    expect(cards[0]?.customerWording).toBe('fallback explanation.');
    expect(cards[0]?.misconception).toBe('Fallback misunderstanding.');
  });

  it('resolves storage, filling-loop, flushing, and warm-radiator triggers from routing tags', () => {
    const cards = getPortalEducationalContent({
      selectedConceptIds: [],
      routingTriggerTags: ['storage', 'pressure', 'hydraulic', 'hot_radiator_expectation'],
      atlasMvpContentMapRegistry: [
        { ...mvpEntry, id: 'CON_STORAGE', routingTriggerTags: ['storage'] },
        { ...mvpEntry, id: 'CON_FILLING', title: 'System pressure and filling loop', routingTriggerTags: ['pressure', 'flow'] },
        { ...mvpEntry, id: 'CON_FLUSH', title: 'Powerflush vs chemical flush', routingTriggerTags: ['hydraulic'] },
        { ...mvpEntry, id: 'CON_WARM', title: 'Warm radiators', routingTriggerTags: ['hot_radiator_expectation'] },
      ],
      educationalContentRegistry: [],
    });

    expect(cards.map((card) => card.title)).toContain('Pressure vs storage');
    expect(cards.map((card) => card.title)).toContain('System pressure and filling loop');
    expect(cards.map((card) => card.title)).toContain('Powerflush vs chemical flush');
    expect(cards.map((card) => card.title)).toContain('Warm radiators');
  });
});
