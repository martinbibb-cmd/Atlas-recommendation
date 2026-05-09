export interface WelcomePackBudgetV1 {
  maxPages: number;
  maxCoreConcepts: number;
  maxRelevantExplainers: number;
  maxTechnicalAppendixItems: number;
  maxHighCognitiveLoadItems: number;
  maxMotionAssets: number;
  mustPrintSafetyItems: boolean;
  preferStaticFallbacks: boolean;
  requireOmissionReasons: boolean;
}
