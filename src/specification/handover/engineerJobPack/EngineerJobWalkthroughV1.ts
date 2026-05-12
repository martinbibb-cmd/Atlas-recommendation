import type { EngineerJobLocationType } from './locationResolver';
import type { EngineerJobPackItemV1 } from './EngineerJobPackV1';

export interface EngineerJobWalkthroughConfidenceSummary {
  readonly confirmed: number;
  readonly inferred: number;
  readonly needs_survey: number;
}

export interface EngineerJobWalkthroughSectionV1 {
  readonly title: string;
  readonly locationTypes: readonly EngineerJobLocationType[];
  readonly items: readonly EngineerJobPackItemV1[];
  readonly mustConfirmCount: number;
  readonly confidenceSummary: EngineerJobWalkthroughConfidenceSummary;
}

export interface EngineerJobWalkthroughV1 {
  readonly walkthroughVersion: 'v1';
  readonly unresolvedBeforeInstall: EngineerJobWalkthroughSectionV1;
  readonly beforeStarting: EngineerJobWalkthroughSectionV1;
  readonly loft: EngineerJobWalkthroughSectionV1;
  readonly cylinderArea: EngineerJobWalkthroughSectionV1;
  readonly plantArea: EngineerJobWalkthroughSectionV1;
  readonly externalWorks: EngineerJobWalkthroughSectionV1;
  readonly radiatorsAndRooms: EngineerJobWalkthroughSectionV1;
  readonly commissioning: EngineerJobWalkthroughSectionV1;
  readonly customerHandover: EngineerJobWalkthroughSectionV1;
}
