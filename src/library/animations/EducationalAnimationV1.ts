export type EducationalAnimationPurposeV1 =
  | 'expectation'
  | 'physics'
  | 'comparison'
  | 'reassurance'
  | 'daily_use';

export interface EducationalAnimationV1 {
  animationId: string;
  title: string;
  conceptIds: string[];
  journeyIds: string[];
  purpose: EducationalAnimationPurposeV1;
  fallbackDiagramId?: string;
  screenReaderSummary: string;
  reducedMotionFallback: string;
  printFallback: string;
  durationMs: number;
  customerSafe: boolean;
}
