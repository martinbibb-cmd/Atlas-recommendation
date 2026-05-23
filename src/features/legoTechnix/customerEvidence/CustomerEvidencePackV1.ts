import type { CustomerEvidenceSectionV1 } from './CustomerEvidenceSectionV1';

export interface CustomerEvidencePackV1 {
  readonly schemaVersion: '1.0';
  readonly systemLabel: string;
  readonly systemType: string;
  readonly sections: readonly CustomerEvidenceSectionV1[];
}
