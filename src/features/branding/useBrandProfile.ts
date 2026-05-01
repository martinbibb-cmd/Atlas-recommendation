/**
 * src/features/branding/useBrandProfile.ts
 *
 * Hook that returns the active BrandProfileV1 from the nearest BrandProvider.
 * Throws a descriptive error when used outside a BrandProvider so that
 * missing-provider bugs are caught at render time rather than silently
 * returning stale or empty data.
 */

import { useContext } from 'react';
import type { BrandProfileV1 } from './brandProfile';
import { BrandContext } from './BrandProvider';

/**
 * Returns the active BrandProfileV1, or null when used outside a BrandProvider.
 *
 * Use this hook in components that may be rendered both inside and outside a
 * BrandProvider (e.g. PresentationDeck in both portal and engineer views).
 * Unlike useBrandProfile, this hook never throws.
 */
export function useOptionalBrandProfile(): BrandProfileV1 | null {
  return useContext(BrandContext);
}

/**
 * Returns the active BrandProfileV1.
 *
 * @throws Error if called outside a `<BrandProvider>` tree.
 */
export function useBrandProfile(): BrandProfileV1 {
  const profile = useContext(BrandContext);
  if (profile === null) {
    throw new Error(
      'useBrandProfile must be used inside a <BrandProvider>. ' +
        'Wrap the component (or its ancestor) with <BrandProvider>.',
    );
  }
  return profile;
}
