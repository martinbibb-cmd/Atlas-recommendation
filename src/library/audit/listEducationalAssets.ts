import type { EducationalAssetV1 } from '../contracts/EducationalAssetV1';
import { educationalAssetRegistry } from '../registry/educationalAssetRegistry';
import { educationalComponentRegistry } from '../registry/educationalComponentRegistry';

export function getAllEducationalAssets(): EducationalAssetV1[] {
  return [...educationalAssetRegistry];
}

export function getAssetsByConcept(conceptId: string): EducationalAssetV1[] {
  return educationalAssetRegistry.filter((asset) => asset.conceptIds.includes(conceptId));
}

export function getAssetsByTrigger(triggerTag: string): EducationalAssetV1[] {
  return educationalAssetRegistry.filter((asset) => asset.triggerTags.includes(triggerTag));
}

export function getPrintableAssets(): EducationalAssetV1[] {
  return educationalAssetRegistry.filter((asset) => asset.hasPrintEquivalent);
}

export function getMotionAssets(): EducationalAssetV1[] {
  return educationalAssetRegistry.filter((asset) => asset.motionIntensity !== 'none');
}

export function getAssetsMissingStaticFallback(): EducationalAssetV1[] {
  return educationalAssetRegistry.filter((asset) => !asset.hasStaticFallback);
}

export function getAssetsMissingPrintEquivalent(): EducationalAssetV1[] {
  return educationalAssetRegistry.filter((asset) => !asset.hasPrintEquivalent);
}

/**
 * Returns assets in the registry that have no mapped component in the
 * educationalComponentRegistry. These assets are registered in metadata
 * only and cannot yet be rendered by EducationalAssetRenderer.
 */
export function getRegisteredAssetsWithoutComponent(): EducationalAssetV1[] {
  return educationalAssetRegistry.filter(
    (asset) => !(asset.id in educationalComponentRegistry),
  );
}

/**
 * Returns asset ids that exist in the educationalComponentRegistry but
 * have no corresponding entry in the educationalAssetRegistry. These
 * represent components that are mapped but not yet formally registered.
 */
export function getComponentsWithoutRegisteredAsset(): string[] {
  const registeredIds = new Set(educationalAssetRegistry.map((a) => a.id));
  return Object.keys(educationalComponentRegistry).filter((id) => !registeredIds.has(id));
}

/**
 * Returns assets whose accessibilityAuditStatus indicates that an
 * accessibility audit has not been completed (not_started or partial).
 */
export function getAssetsNeedingAccessibilityAudit(): EducationalAssetV1[] {
  return educationalAssetRegistry.filter(
    (asset) =>
      asset.accessibilityAuditStatus === 'not_started' ||
      asset.accessibilityAuditStatus === 'partial' ||
      asset.accessibilityAuditStatus === undefined,
  );
}

/**
 * Returns assets that require a static/print equivalent but do not yet
 * have one (printStatus is needs_static_equivalent or undefined while
 * hasPrintEquivalent is false).
 */
export function getAssetsNeedingPrintEquivalent(): EducationalAssetV1[] {
  return educationalAssetRegistry.filter(
    (asset) =>
      asset.printStatus === 'needs_static_equivalent' ||
      (!asset.hasPrintEquivalent && asset.printStatus === undefined),
  );
}
