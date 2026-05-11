import { PressureVsStoragePortalSection } from './PressureVsStoragePortalSection';

export interface DailyUsePortalSectionProps {
  /**
   * Set to true when the recommendation is for a stored hot water system
   * (e.g. system boiler + unvented cylinder, or regular boiler + cylinder).
   */
  appliesStoredHotWater: boolean;
  bathroomCount?: number;
}

/**
 * Portal section router for the "why this matters day to day" slot.
 *
 * When CON_C02 applies (stored hot water + 2+ bathrooms), renders the
 * dedicated PressureVsStoragePortalSection.
 *
 * Otherwise returns null so the calling surface can substitute its own
 * fallback (or render nothing).
 */
export function DailyUsePortalSection({
  appliesStoredHotWater,
  bathroomCount = 1,
}: DailyUsePortalSectionProps) {
  if (appliesStoredHotWater && bathroomCount >= 2) {
    return (
      <PressureVsStoragePortalSection bathroomCount={bathroomCount} />
    );
  }

  return null;
}
