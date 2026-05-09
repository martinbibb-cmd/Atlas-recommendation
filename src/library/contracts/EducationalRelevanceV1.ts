export interface EducationalRelevanceV1 {
  assetId: string;
  isRelevant: boolean;
  matchedConceptIds: string[];
  matchedTriggerTags: string[];
  reasons: string[];
}
