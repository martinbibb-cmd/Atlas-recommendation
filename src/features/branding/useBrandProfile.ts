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
