import type { LegoTechnixConfidence } from '../confidence';

export interface LegoTechnixExplainabilitySectionV1 {
  readonly heading: string;
  readonly points: readonly string[];
  readonly evidenceIds: readonly string[];
}

export interface LegoTechnixCausalNoteV1 {
  readonly id: string;
  readonly category: 'controls' | 'heating' | 'dhw' | 'heat_source' | 'hydraulic' | 'pressure' | 'confidence' | 'warning';
  readonly severity: 'info' | 'notice' | 'warning' | 'critical';
  readonly message: string;
  readonly evidenceIds: readonly string[];
  readonly confidence: LegoTechnixConfidence;
  readonly engineeringOnly: boolean;
}

export interface LegoTechnixExplainabilityReportV1 {
  readonly schemaVersion: '1.0';
  readonly systemSummary: LegoTechnixExplainabilitySectionV1;
  readonly activeCircuitSummary: LegoTechnixExplainabilitySectionV1;
  readonly controlDecisionSummary: LegoTechnixExplainabilitySectionV1;
  readonly heatSourceSummary: LegoTechnixExplainabilitySectionV1;
  readonly roomHeatingSummary: LegoTechnixExplainabilitySectionV1;
  readonly dhwSummary: LegoTechnixExplainabilitySectionV1;
  readonly returnTemperatureSummary: LegoTechnixExplainabilitySectionV1;
  readonly condensingSummary: LegoTechnixExplainabilitySectionV1;
  readonly warningsSummary: LegoTechnixExplainabilitySectionV1;
  readonly confidenceSummary: LegoTechnixExplainabilitySectionV1;
  readonly causalNotes: readonly LegoTechnixCausalNoteV1[];
}
