/**
 * buildVisitSeedFromAtlasProperty.ts
 *
 * Creates a lightweight visit bootstrap object from a canonical AtlasPropertyV1.
 *
 * The VisitSeed is used to prefill or display visit metadata on handoff arrival,
 * before any database write or full visit model is constructed.
 *
 * This is a pure derivation — it never writes to the visit database and
 * never mutates the property.
 */

import type { AtlasPropertyV1 } from '@atlas/contracts';
import type { VisitSeed } from '../types/atlasPropertyHandoff.types';
import type { AtlasPropertyCompletenessSummary } from '../../atlasProperty/types/atlasPropertyAdapter.types';

// ─── Address formatting ────────────────────────────────────────────────────────

/**
 * Build a human-readable address string from the property identity fields.
 * Returns undefined if neither address lines nor postcode are available.
 */
function formatAddress(property: AtlasPropertyV1['property']): string | undefined {
  const parts: string[] = [];

  if (property.address1) parts.push(property.address1);
  if (property.address2) parts.push(property.address2);
  if (property.town)     parts.push(property.town);
  if (property.postcode) parts.push(property.postcode);

  return parts.length > 0 ? parts.join(', ') : undefined;
}

// ─── Reference derivation ─────────────────────────────────────────────────────

/**
 * Derive a short property reference from available identity fields.
 * Prefers uprn, then externalRef, then propertyId.
 */
function deriveReference(
  identity: AtlasPropertyV1['property'],
  propertyId: string,
): string {
  if (identity.uprn)      return identity.uprn;
  if (identity.reference) return identity.reference;
  return propertyId;
}

// ─── Status hint ──────────────────────────────────────────────────────────────

/**
 * Derive a status hint from the current AtlasPropertyV1 status and completeness.
 *
 * If the property is already marked as survey_in_progress or beyond, reflect
 * that; otherwise use the completeness summary to decide.
 */
function deriveStatusHint(
  status: AtlasPropertyV1['status'],
  completeness: AtlasPropertyCompletenessSummary,
): VisitSeed['statusHint'] {
  if (status === 'ready_for_simulation' || status === 'simulation_ready' || status === 'report_ready') {
    return 'ready_for_simulation';
  }
  if (status === 'survey_in_progress') {
    return 'survey_in_progress';
  }
  if (completeness.readyForSimulation) {
    return 'ready_for_simulation';
  }
  return 'draft';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * buildVisitSeedFromAtlasProperty — create a minimal visit bootstrap from a
 * canonical AtlasPropertyV1.
 *
 * @param atlasProperty  The canonical property.
 * @param completeness   Completeness summary for the status hint.
 * @returns              VisitSeed with address, reference, displayTitle, and statusHint.
 */
export function buildVisitSeedFromAtlasProperty(
  atlasProperty: AtlasPropertyV1,
  completeness: AtlasPropertyCompletenessSummary,
): VisitSeed {
  const address     = formatAddress(atlasProperty.property);
  const reference   = deriveReference(atlasProperty.property, atlasProperty.propertyId);
  const statusHint  = deriveStatusHint(atlasProperty.status, completeness);

  // Build a customer-safe display title: prefer a short "address (ref)" form.
  let displayTitle: string | undefined;
  if (address) {
    displayTitle = address;
  } else if (atlasProperty.property.postcode) {
    displayTitle = atlasProperty.property.postcode;
  }

  return {
    address,
    reference,
    displayTitle,
    statusHint,
  };
}
