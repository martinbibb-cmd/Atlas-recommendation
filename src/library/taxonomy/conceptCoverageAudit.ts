import type { EducationalAssetV1 } from '../contracts/EducationalAssetV1';
import type { EducationalRoutingRuleV1 } from '../routing/EducationalRoutingRuleV1';
import { educationalConceptTaxonomy } from './educationalConceptTaxonomy';
import { getConceptById } from './conceptGraph';

export interface AssetUnknownConceptsAuditResultV1 {
  assetId: string;
  unknownConceptIds: string[];
}

export interface RoutingRuleUnknownConceptsAuditResultV1 {
  ruleId: string;
  unknownConceptIds: string[];
}

export interface MissingPriorConceptsAuditResultV1 {
  conceptId: string;
  missingPriorConceptIds: string[];
}

export function getConceptsWithoutAssets(assets: EducationalAssetV1[]): string[] {
  const conceptIdsWithAssets = new Set(assets.flatMap((asset) => asset.conceptIds));
  return educationalConceptTaxonomy
    .filter((concept) => !conceptIdsWithAssets.has(concept.conceptId))
    .map((concept) => concept.conceptId);
}

export function getAssetsWithoutKnownConcepts(assets: EducationalAssetV1[]): AssetUnknownConceptsAuditResultV1[] {
  return assets
    .map((asset) => {
      const unknownConceptIds = asset.conceptIds.filter((conceptId) => !getConceptById(conceptId));
      return {
        assetId: asset.id,
        unknownConceptIds,
      };
    })
    .filter((result) => result.unknownConceptIds.length > 0);
}

export function getConceptsWithoutRoutingRules(rules: EducationalRoutingRuleV1[]): string[] {
  const conceptIdsInRules = new Set(rules.flatMap((rule) => rule.requiredConceptIds));
  return educationalConceptTaxonomy
    .filter((concept) => !conceptIdsInRules.has(concept.conceptId))
    .map((concept) => concept.conceptId);
}

export function getRoutingRulesWithoutKnownConcepts(
  rules: EducationalRoutingRuleV1[],
): RoutingRuleUnknownConceptsAuditResultV1[] {
  return rules
    .map((rule) => {
      const unknownConceptIds = rule.requiredConceptIds.filter((conceptId) => !getConceptById(conceptId));
      return {
        ruleId: rule.ruleId,
        unknownConceptIds,
      };
    })
    .filter((result) => result.unknownConceptIds.length > 0);
}

export function getConceptsWithMissingPriorConcepts(): MissingPriorConceptsAuditResultV1[] {
  return educationalConceptTaxonomy
    .map((concept) => {
      const missingPriorConceptIds = concept.requiredPriorConceptIds.filter((priorId) => !getConceptById(priorId));
      return {
        conceptId: concept.conceptId,
        missingPriorConceptIds,
      };
    })
    .filter((result) => result.missingPriorConceptIds.length > 0);
}
