export interface CustomerEvidenceMetricV1 {
  readonly label: string;
  readonly value: string | number;
  readonly unit?: string;
  readonly confidenceWording: string;
}
