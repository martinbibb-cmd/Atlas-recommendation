import { PressureVsStoragePortalSection } from './PressureVsStoragePortalSection';
import { OpenVentedToSealedPortalSection } from './OpenVentedToSealedPortalSection';
import { UnventedSafetyPortalSection } from './UnventedSafetyPortalSection';
import { LivingWithYourSystemPortalJourney } from './LivingWithYourSystemPortalJourney';
import './openVentedInsightSection.css';

export interface OpenVentedInsightSectionProps {
  bathroomCount?: number;
}

/**
 * Composite portal section for the open-vented to sealed + unvented upgrade path.
 *
 * Renders all three portal-ready educational content sections in sequence:
 *   1. CON_C02 — Pressure vs storage (PressureVsStoragePortalSection)
 *   2. CON_A01 — Open-vented to sealed conversion (OpenVentedToSealedPortalSection)
 *   3. CON_C01 — Unvented cylinder safety (UnventedSafetyPortalSection)
 */
export function OpenVentedInsightSection({
  bathroomCount = 2,
}: OpenVentedInsightSectionProps) {
  return (
    <div className="ovsi-section" data-testid="open-vented-insight-section">
      <PressureVsStoragePortalSection bathroomCount={bathroomCount} />
      <OpenVentedToSealedPortalSection />
      <UnventedSafetyPortalSection />
      <LivingWithYourSystemPortalJourney bathroomCount={bathroomCount} />
    </div>
  );
}
