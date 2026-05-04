/**
 * jobClassification.ts — Quote job type classifier for the Atlas Quote Planner.
 *
 * Classifies a proposed installation into a job type based on the current and
 * proposed system families and heat-source locations.
 *
 * Design rules:
 *   - Classification is deterministic; no random or time-dependent logic.
 *   - Unknown inputs produce `needs_review` rather than a guess.
 *   - Heat-pump proposals always produce `low_carbon_conversion` regardless of
 *     any other signal (most specific classification wins).
 *   - Combi-to-stored-DHW conversion is classified as `stored_hot_water_upgrade`
 *     (more specific than the generic `conversion` band).
 */

import type {
  QuoteSystemDescriptorV1,
  QuoteSystemLocationV1,
  QuoteJobClassificationV1,
  QuoteJobType,
  QuoteSystemFamily,
} from './quotePlannerTypes';

// ─── Location helpers ─────────────────────────────────────────────────────────

/**
 * Determine whether two location descriptors refer to the same physical location.
 *
 * Returns true when:
 *   - `isSameLocation` is explicitly set to true on either descriptor, OR
 *   - Both descriptors have a `room` value and the values match (case-insensitive).
 *
 * Returns false when there is evidence of different locations.
 * Returns null when there is insufficient data to decide.
 */
function isSameHeatSourceLocation(
  current?: QuoteSystemLocationV1,
  proposed?: QuoteSystemLocationV1,
): boolean | null {
  if (!current || !proposed) {
    return null;
  }

  if (current.isSameLocation === true || proposed.isSameLocation === true) {
    return true;
  }

  if (current.room && proposed.room) {
    return current.room.trim().toLowerCase() === proposed.room.trim().toLowerCase();
  }

  return null;
}

// ─── System family helpers ────────────────────────────────────────────────────

function isUnknown(family: QuoteSystemFamily): boolean {
  return family === 'unknown';
}

// ─── classifyQuoteJob ─────────────────────────────────────────────────────────

/**
 * Classify the job type for a proposed installation.
 *
 * @param currentSystem  - Descriptor for the system being replaced.
 * @param proposedSystem - Descriptor for the system being installed.
 *
 * @returns QuoteJobClassificationV1 with jobType and a rationale string.
 */
export function classifyQuoteJob(
  currentSystem: QuoteSystemDescriptorV1,
  proposedSystem: QuoteSystemDescriptorV1,
): QuoteJobClassificationV1 {
  const { family: currentFamily } = currentSystem;
  const { family: proposedFamily } = proposedSystem;

  // Unknown on either side always yields needs_review.
  if (isUnknown(currentFamily) || isUnknown(proposedFamily)) {
    return {
      jobType: 'needs_review',
      rationale: `Cannot classify job: ${isUnknown(currentFamily) ? 'current' : 'proposed'} system family is unknown.`,
    };
  }

  // Heat pump proposals are always a low-carbon conversion.
  if (proposedFamily === 'heat_pump') {
    return {
      jobType: 'low_carbon_conversion',
      rationale: `Proposed system is a heat pump — classified as low-carbon conversion from ${currentFamily}.`,
    };
  }

  // Combi replaced with a system that includes stored hot water.
  if (
    currentFamily === 'combi' &&
    (proposedFamily === 'system_stored' || proposedFamily === 'regular_stored')
  ) {
    return {
      jobType: 'stored_hot_water_upgrade',
      rationale: `Combi boiler being replaced with a stored hot-water system (${proposedFamily}) — classified as stored hot-water upgrade.`,
    };
  }

  // Different system families (not already handled above).
  if (currentFamily !== proposedFamily) {
    return {
      jobType: 'conversion',
      rationale: `System family is changing from ${currentFamily} to ${proposedFamily} — classified as conversion.`,
    };
  }

  // Same family — check location to distinguish like-for-like from relocation.
  const sameLocation = isSameHeatSourceLocation(
    currentSystem.heatSourceLocation,
    proposedSystem.heatSourceLocation,
  );

  if (sameLocation === null) {
    // Insufficient location data — still useful to know it's the same family.
    return {
      jobType: 'needs_review',
      rationale: `Same system family (${currentFamily}) but heat-source location cannot be confirmed — manual review required.`,
    };
  }

  if (sameLocation) {
    return {
      jobType: 'like_for_like',
      rationale: `Same system family (${currentFamily}) in the same location — classified as like-for-like replacement.`,
    };
  }

  return {
    jobType: 'relocation',
    rationale: `Same system family (${currentFamily}) but heat source is moving to a different location — classified as relocation.`,
  };
}

// ─── Type exports ─────────────────────────────────────────────────────────────

export type { QuoteJobType, QuoteJobClassificationV1 };
