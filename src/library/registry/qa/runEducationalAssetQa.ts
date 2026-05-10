import type { EducationalAssetV1 } from '../../contracts/EducationalAssetV1';
import type { EducationalConceptTaxonomyV1 } from '../../taxonomy/EducationalConceptTaxonomyV1';
import type { EducationalComponentMap } from '../educationalComponentRegistry';
import type { EducationalAssetQaV1 } from './EducationalAssetQaV1';
import { validateEducationalAsset } from './validateEducationalAsset';

export function runEducationalAssetQa(
  assets: EducationalAssetV1[],
  componentRegistry: EducationalComponentMap,
  taxonomy: EducationalConceptTaxonomyV1[],
): EducationalAssetQaV1[] {
  return assets.flatMap((asset) => validateEducationalAsset(asset, taxonomy, componentRegistry));
}

export function getAssetQaErrors(findings: EducationalAssetQaV1[] = []): EducationalAssetQaV1[] {
  return findings.filter((finding) => finding.severity === 'error');
}

export function getAssetQaWarnings(findings: EducationalAssetQaV1[] = []): EducationalAssetQaV1[] {
  return findings.filter((finding) => finding.severity === 'warning');
}
