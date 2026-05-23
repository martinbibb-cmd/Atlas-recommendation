import type { LegoTechnixConfidence } from '../confidence';

/**
 * Customer-safe confidence wording for each LegoTechnix confidence level.
 * These phrases are suitable for display in customer-facing surfaces
 * (PDF, portal, simulator) without exposing engineering jargon.
 */
export const CUSTOMER_EVIDENCE_CONFIDENCE_WORDING_V1: Readonly<
  Record<LegoTechnixConfidence, string>
> = {
  measured: 'Measured during the visit',
  manufacturer: 'Based on manufacturer information',
  user_entered: 'Entered by your installer',
  derived: 'Estimated from the visible system layout',
  estimated: 'Estimated from the visible system layout',
  assumed: 'Pipe route not fully confirmed',
  unknown: 'Requires installer confirmation',
};

/**
 * Returns the customer-safe confidence wording for a given confidence level.
 */
export function getCustomerConfidenceWording(
  confidence: LegoTechnixConfidence,
): string {
  return CUSTOMER_EVIDENCE_CONFIDENCE_WORDING_V1[confidence];
}
