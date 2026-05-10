import type { EducationalPackSectionId } from '../contracts/EducationalPackV1';

export type CalmWelcomePackSectionId = EducationalPackSectionId | 'safety_and_compliance';

export interface CalmWelcomePackCardV1 {
  assetId?: string;
  conceptId?: string;
  title: string;
  summary: string;
  safetyNotice?: string;
}

export interface CalmWelcomePackSectionV1 {
  sectionId: CalmWelcomePackSectionId;
  title: string;
  cards: CalmWelcomePackCardV1[];
}

export interface CalmWelcomePackQrDestinationV1 {
  assetId: string;
  destination: string;
  title: string;
  reason: string;
}

export interface CalmWelcomePackOmissionItemV1 {
  sectionId?: CalmWelcomePackSectionId;
  assetId?: string;
  conceptId?: string;
  reason: string;
}

export interface CalmWelcomePackViewModelV1 {
  packId: string;
  recommendedScenarioId: string;
  title: string;
  brandName?: string;
  brandLogoUrl?: string;
  brandContactLabel?: string;
  brandTone?: 'formal' | 'friendly' | 'technical';
  generatedAt?: string;
  visitReference?: string;
  customerFacingSections: CalmWelcomePackSectionV1[];
  qrDestinations: CalmWelcomePackQrDestinationV1[];
  internalOmissionLog: CalmWelcomePackOmissionItemV1[];
  pageEstimate: {
    usedPages: number;
    maxPages: number;
  };
  readiness: {
    safeForCustomer: boolean;
    blockingReasons: string[];
  };
}
