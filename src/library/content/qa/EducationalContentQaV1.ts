export type EducationalContentQaSeverityV1 = 'info' | 'warning' | 'error';

export interface EducationalContentQaV1 {
  contentId: string;
  conceptId: string;
  severity: EducationalContentQaSeverityV1;
  ruleId: string;
  message: string;
  field: string;
  suggestedAction?: string;
}
