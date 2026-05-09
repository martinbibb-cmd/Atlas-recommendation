import type { EducationalLoad } from '../contracts/EducationalAssetV1';

export type PrintableSectionPrintPriority = 'must_print' | 'should_print' | 'digital_ok';

export type PrintableWelcomePackSectionId =
  | 'calm_summary'
  | 'why_this_fits'
  | 'living_with_the_system'
  | 'relevant_explainers'
  | 'safety_and_compliance'
  | 'optional_technical_appendix'
  | 'next_steps';

export interface PrintableWelcomePackSectionV1 {
  sectionId: PrintableWelcomePackSectionId;
  title: string;
  purpose: string;
  conceptIds: string[];
  assetIds: string[];
  placeholderText: string;
  printPriority: PrintableSectionPrintPriority;
  cognitiveLoadEstimate: EducationalLoad;
}

export interface PrintableWelcomePackQrDestinationV1 {
  assetId: string;
  destination: string;
  conceptIds: string[];
  reason: string;
}

export interface PrintableWelcomePackOmittedItemV1 {
  assetId: string;
  reason: string;
  conceptIds: string[];
  deferredToQr: boolean;
}

export interface PrintableWelcomePackViewModelV1 {
  packId: string;
  archetypeId: string;
  recommendedScenarioId: string;
  title: string;
  subtitle: string;
  sections: PrintableWelcomePackSectionV1[];
  pageEstimate: {
    usedPages: number;
    maxPages: number;
  };
  printNotes: string[];
  qrDestinations: PrintableWelcomePackQrDestinationV1[];
  omittedSummary: {
    deferredConceptIds: string[];
    omittedAssets: PrintableWelcomePackOmittedItemV1[];
  };
}
