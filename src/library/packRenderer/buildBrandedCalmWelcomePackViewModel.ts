import type { BrandProfileV1 } from '../../features/branding/brandProfile';
import { resolveBrandProfile } from '../../features/branding/resolveBrandProfile';
import type { CalmWelcomePackViewModelV1 } from './CalmWelcomePackViewModelV1';

export interface BuildBrandedCalmWelcomePackViewModelInputV1 {
  calmViewModel: CalmWelcomePackViewModelV1;
  brandProfile?: BrandProfileV1;
  brandId?: string;
  visitReference?: string;
  generatedAt?: string;
}

function buildBrandContactLabel(brandProfile: BrandProfileV1): string | undefined {
  const { contact } = brandProfile;
  return contact.phone ?? contact.email ?? contact.website ?? contact.address;
}

export function buildBrandedCalmWelcomePackViewModel(
  input: BuildBrandedCalmWelcomePackViewModelInputV1,
): CalmWelcomePackViewModelV1 {
  const resolvedBrand = input.brandProfile ?? resolveBrandProfile(input.brandId);

  return {
    ...input.calmViewModel,
    brandName: resolvedBrand.companyName,
    brandLogoUrl: resolvedBrand.logoUrl,
    brandContactLabel: buildBrandContactLabel(resolvedBrand),
    brandTone: resolvedBrand.outputSettings.tone,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    visitReference: input.visitReference,
  };
}
