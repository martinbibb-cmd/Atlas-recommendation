import type { EngineInputV2_3Contract } from '../../../contracts/EngineInputV2_3';
import type { ScanDataInput } from '../../buildSuggestedImplementationPack';

export type EngineerJobPackItemConfidence = 'confirmed' | 'inferred' | 'needs_survey';

export interface EngineerJobPackItemV1 {
  readonly text: string;
  readonly sourceLineId?: string;
  readonly confidence: EngineerJobPackItemConfidence;
  readonly location?: string;
  readonly relatedRiskId?: string;
  readonly mustConfirmOnSite?: boolean;
}

export interface EngineerJobPackV1 {
  readonly jobPackVersion: 'v1';
  readonly jobSummary: readonly EngineerJobPackItemV1[];
  readonly fitThis: readonly EngineerJobPackItemV1[];
  readonly removeThis: readonly EngineerJobPackItemV1[];
  readonly checkThis: readonly EngineerJobPackItemV1[];
  readonly discussWithCustomer: readonly EngineerJobPackItemV1[];
  readonly locationsAndRoutes: readonly EngineerJobPackItemV1[];
  readonly commissioning: readonly EngineerJobPackItemV1[];
  readonly unresolvedBeforeInstall: readonly EngineerJobPackItemV1[];
  readonly doNotMiss: readonly EngineerJobPackItemV1[];
  readonly surveyData?: EngineInputV2_3Contract;
  readonly scanData?: ScanDataInput;
}
