import type { EducationalAssetV1 } from '../contracts/EducationalAssetV1';
import type { PrintEquivalentV1 } from './PrintEquivalentV1';
import { printEquivalentByAssetId } from './printEquivalentRegistry';

export function getPrintEquivalentForAsset(assetId: string): PrintEquivalentV1 | undefined {
  return printEquivalentByAssetId.get(assetId);
}

export function getPrintEquivalentsForAssets(assetIds: string[]): PrintEquivalentV1[] {
  return assetIds
    .map((assetId) => getPrintEquivalentForAsset(assetId))
    .filter((entry): entry is PrintEquivalentV1 => Boolean(entry));
}

export function getAssetsMissingRegisteredPrintEquivalent(assets: EducationalAssetV1[]): EducationalAssetV1[] {
  return assets.filter((asset) => {
    if (!asset.hasPrintEquivalent) {
      return false;
    }
    const printEquivalentId = asset.printEquivalentId ?? asset.id;
    return !printEquivalentByAssetId.has(printEquivalentId);
  });
}
