import type {
  EducationalAnalogyV1,
  EducationalAssetV1,
  EducationalConceptV1,
  EducationalRegistryFoundationV1,
  EducationalTriggerV1,
} from '../contracts/EducationalContractsV1';

export const EDUCATIONAL_ASSETS_FOUNDATION: readonly EducationalAssetV1[] = [];

export const EDUCATIONAL_CONCEPTS_FOUNDATION: readonly EducationalConceptV1[] = [];

export const EDUCATIONAL_TRIGGERS_FOUNDATION: readonly EducationalTriggerV1[] = [];

export const EDUCATIONAL_ANALOGIES_FOUNDATION: readonly EducationalAnalogyV1[] = [];

export const EDUCATIONAL_REGISTRY_FOUNDATION: EducationalRegistryFoundationV1 = {
  assets: EDUCATIONAL_ASSETS_FOUNDATION,
  concepts: EDUCATIONAL_CONCEPTS_FOUNDATION,
  triggers: EDUCATIONAL_TRIGGERS_FOUNDATION,
  analogies: EDUCATIONAL_ANALOGIES_FOUNDATION,
};
