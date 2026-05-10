export type EducationalAssetQaSeverityV1 = 'info' | 'warning' | 'error';

export interface EducationalAssetQaV1 {
  assetId: string;
  severity: EducationalAssetQaSeverityV1;
  ruleId: string;
  message: string;
  field: string;
  suggestedAction?: string;
}
