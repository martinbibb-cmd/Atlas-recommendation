import type { PortalJourneyPrintModelV1 } from '../portal/pdf/buildPortalJourneyPrintModel';
import type { PdfComparisonScenarioV1 } from './PdfComparisonScenarioV1';

export function buildPdfComparisonScenarioFromPrintModel(
  model: PortalJourneyPrintModelV1,
  scenarioLabel: string,
): PdfComparisonScenarioV1 {
  return {
    scenarioLabel,
    mode: 'canonical_library_pdf',
    recommendationSummary: model.cover.summary,
    sections: [
      {
        sectionId: 'cover',
        heading: model.cover.title,
        bodyText: [model.cover.summary, ...model.cover.customerFacts].join(' ').trim(),
      },
      ...model.sections.map((section) => ({
        sectionId: section.sectionId,
        heading: section.heading,
        bodyText: [
          section.summary,
          section.keyTakeaway,
          section.reassurance,
          ...section.items,
        ].join(' ').trim(),
      })),
      ...(
        model.systemProtection != null
          ? [{
            sectionId: 'system_protection',
            heading: model.systemProtection.title,
            bodyText: [
              model.systemProtection.customerSummary,
              model.systemProtection.whyItMatters,
              model.systemProtection.whatInstallerWillCheck,
              ...model.systemProtection.customerVisibleBullets,
            ].join(' ').trim(),
          }]
          : []
      ),
    ],
    surveyCondition: model.systemProtection != null ? 'present' : null,
  };
}
