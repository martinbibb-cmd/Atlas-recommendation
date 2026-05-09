import type { EducationalAssetV1 } from '../contracts/EducationalAssetV1';
import { educationalAssetRegistry } from '../registry/educationalAssetRegistry';

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
