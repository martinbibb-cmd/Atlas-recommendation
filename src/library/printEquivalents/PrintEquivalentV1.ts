export interface PrintEquivalentV1 {
  assetId: string;
  conceptIds: string[];
  title: string;
  printTitle: string;
  summary: string;
  steps: string[];
  labels: string[];
  accessibilityNotes: string;
  qrDeepDiveLabel?: string;
  sourceAnimationId?: string;
}
