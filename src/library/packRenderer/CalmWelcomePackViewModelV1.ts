import type { SequenceStage } from '../sequencing/EducationalSequenceRuleV1';
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

/** Internal-only sequencing summary — never exposed to customer renderers. */
export interface CalmWelcomePackSequencingMetadataV1 {
  archetypeId: string;
  appliedMaxSimultaneous: number;
  stagesPresent: SequenceStage[];
}

/** A concept the sequencing engine excluded from the main sequence. Internal only. */
export interface CalmWelcomePackDeferredBySequencingV1 {
  conceptId: string;
  ruleId: string;
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
  /**
   * Flat list of diagram IDs selected for this pack, derived from the plan's
   * selected concept IDs. Internal and customer-facing renderers may use this
   * to display or suppress educational diagrams.
   */
  diagramIds?: string[];
  /**
   * Diagram IDs grouped by the section they are most relevant to, keyed by
   * section ID. A diagram may appear in more than one section if it covers
   * concepts from multiple sections.
   */
  diagramsBySection?: Partial<Record<CalmWelcomePackSectionId, string[]>>;
  /**
   * Internal-only sequencing metadata. Must never be rendered in customer-facing output.
   * Populated by the educational sequencing engine when sequencing is active.
   */
  sequencingMetadata?: CalmWelcomePackSequencingMetadataV1;
  /**
   * Concepts the sequencing engine deferred from the main sequence. Internal only.
   * Each entry explains why the concept was excluded.
   */
  deferredBySequencing?: CalmWelcomePackDeferredBySequencingV1[];
  /**
   * Human-readable overload and pacing warnings from the sequencing engine.
   * Internal only — never expose to customer renderers or customer-facing text.
   */
  pacingWarnings?: string[];
}
