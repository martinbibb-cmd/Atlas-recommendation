/**
 * FluePlanStep.tsx
 *
 * Step 5 of the Installation Specification: "Flue plan".
 *
 * Replaces the placeholder flue step.  Orchestrates:
 *   1. FlueFamilyTiles — engineer selects the flue family / orientation.
 *   2. Location pickers — confirm boiler and terminal locations.
 *   3. FlueSegmentEditor — build the segment list.
 *   4. FlueCalculationSummary — show the equivalent-length result.
 *
 * UI copy (per problem statement):
 *   Heading:     "Flue plan"
 *   Subheading:  "Build the flue route and check the equivalent length."
 *
 * Design rules:
 *   - Does not output customer-facing copy.
 *   - Does not alter recommendation logic.
 *   - Generic-estimate mode is always declared — never presented as
 *     manufacturer truth until model-specific rules are loaded.
 *   - `onFlueRouteChange` is called with the updated route after every
 *     engineer action — the parent is responsible for storing it.
 */

import { useState } from 'react';
import { FlueFamilyTiles } from '../flue/FlueFamilyTiles';
import { FlueSegmentEditor } from '../flue/FlueSegmentEditor';
import { FlueCalculationSummary } from '../flue/FlueCalculationSummary';
import {
  buildFlueRouteDraft,
  updateFlueFamily,
  updateFlueLocations,
  addFlueSegment,
  removeFlueSegment,
  flipFlueSegment,
} from '../../model/flueActions';
import { LOCATION_KIND_LABELS } from '../../model/locationActions';
import type { QuotePlanCandidateFlueRouteV1, FlueFamily } from '../../model/QuoteInstallationPlanV1';
import type { QuotePlanLocationV1 } from '../../model/QuoteInstallationPlanV1';
import type { QuoteFlueSegmentV1 } from '../../calculators/quotePlannerTypes';
import type { EvidenceProofLinkV1, EvidenceCaptureRef } from '../../../../features/scanEvidence/EvidenceProofLinkV1';
import { EvidenceProofBlock } from '../../../../features/scanEvidence/EvidenceProofBlock';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FluePlanStepProps {
  /**
   * Current flue route draft from the plan.
   * `null` when no flue route has been started yet — the step will initialise one.
   */
  flueRoute: QuotePlanCandidateFlueRouteV1 | null;
  /** Called whenever the engineer changes the flue route. */
  onFlueRouteChange: (route: QuotePlanCandidateFlueRouteV1) => void;
  /** Active (non-rejected) locations from the plan — used to pick boiler/terminal. */
  locations: QuotePlanLocationV1[];
  /**
   * Evidence proof links for the flue section, from buildEvidenceProofLinks().
   * When provided, an "Evidence used" block is shown at the top of the step.
   */
  evidenceProofLinks?: EvidenceProofLinkV1[];
  /**
   * Called when the user clicks an evidence capture-point pill.
   * Navigates to the evidence viewer at that point.
   */
  onOpenEvidenceCapture?: (
    capturePointId: string,
    storyboardCardKey: EvidenceCaptureRef['storyboardCardKey'],
  ) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FluePlanStep({
  flueRoute,
  onFlueRouteChange,
  locations,
  evidenceProofLinks,
  onOpenEvidenceCapture,
}: FluePlanStepProps) {
  // Lazily initialise the route draft the first time the step renders.
  const [localRoute, setLocalRoute] = useState<QuotePlanCandidateFlueRouteV1>(
    () => flueRoute ?? buildFlueRouteDraft(),
  );

  function update(updated: QuotePlanCandidateFlueRouteV1) {
    setLocalRoute(updated);
    onFlueRouteChange(updated);
  }

  // ── Family selection ────────────────────────────────────────────────────────

  function handleFamilySelect(family: FlueFamily) {
    update(updateFlueFamily(localRoute, family));
  }

  // ── Location pickers ────────────────────────────────────────────────────────

  const activeLocations = locations.filter((l) => !l.rejected);

  function handleBoilerLocationChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value || undefined;
    update(updateFlueLocations(localRoute, val, localRoute.terminalLocationId));
  }

  function handleTerminalLocationChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value || undefined;
    update(updateFlueLocations(localRoute, localRoute.boilerLocationId, val));
  }

  // ── Segment mutations ───────────────────────────────────────────────────────

  function handleAddSegment(segment: QuoteFlueSegmentV1) {
    update(addFlueSegment(localRoute, segment));
  }

  function handleRemoveSegment(index: number) {
    update(removeFlueSegment(localRoute, index));
  }

  function handleFlipSegment(index: number) {
    update(flipFlueSegment(localRoute, index));
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const segments = localRoute.geometry?.segments ?? [];
  const calculation = localRoute.calculation;
  const flueLinks = evidenceProofLinks?.filter((l) => l.section === 'flue') ?? [];

  return (
    <>
      <h2 className="qp-step-heading">Flue plan</h2>

      <p className="qp-step-subheading">
        Build the flue route and check the equivalent length.
      </p>

      {flueLinks.length > 0 && (
        <EvidenceProofBlock
          links={flueLinks}
          onOpenCapturePoint={onOpenEvidenceCapture}
        />
      )}

      {/* 1. Flue family */}
      <section className="flue-plan-section" aria-labelledby="flue-family-heading">
        <h3 id="flue-family-heading" className="flue-plan-section__heading">
          Flue family
        </h3>
        <FlueFamilyTiles
          selected={localRoute.family === 'unknown' ? null : localRoute.family}
          onSelect={handleFamilySelect}
        />
      </section>

      {/* 2. Boiler and terminal locations */}
      <section className="flue-plan-section" aria-labelledby="flue-locations-heading">
        <h3 id="flue-locations-heading" className="flue-plan-section__heading">
          Locations
        </h3>

        <div className="flue-location-picker">
          <label htmlFor="flue-boiler-location" className="flue-location-picker__label">
            Proposed boiler location
          </label>
          <select
            id="flue-boiler-location"
            className="flue-location-picker__select"
            value={localRoute.boilerLocationId ?? ''}
            onChange={handleBoilerLocationChange}
            aria-label="Proposed boiler location"
          >
            <option value="">— Not yet selected —</option>
            {activeLocations.map((loc) => (
              <option key={loc.locationId} value={loc.locationId}>
                {LOCATION_KIND_LABELS[loc.kind] ?? loc.kind}
                {loc.roomLabel ? ` — ${loc.roomLabel}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flue-location-picker">
          <label htmlFor="flue-terminal-location" className="flue-location-picker__label">
            Proposed flue terminal location
          </label>
          <select
            id="flue-terminal-location"
            className="flue-location-picker__select"
            value={localRoute.terminalLocationId ?? ''}
            onChange={handleTerminalLocationChange}
            aria-label="Proposed flue terminal location"
          >
            <option value="">— Not yet selected —</option>
            {activeLocations.map((loc) => (
              <option key={loc.locationId} value={loc.locationId}>
                {LOCATION_KIND_LABELS[loc.kind] ?? loc.kind}
                {loc.roomLabel ? ` — ${loc.roomLabel}` : ''}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* 3. Segment editor */}
      <section className="flue-plan-section" aria-labelledby="flue-segments-heading">
        <h3 id="flue-segments-heading" className="flue-plan-section__heading">
          Segments
        </h3>
        <FlueSegmentEditor
          segments={segments}
          onAddSegment={handleAddSegment}
          onRemoveSegment={handleRemoveSegment}
          onFlipSegment={handleFlipSegment}
        />
      </section>

      {/* 4. Calculation summary */}
      {calculation && (
        <section className="flue-plan-section" aria-labelledby="flue-calc-heading">
          <h3 id="flue-calc-heading" className="flue-plan-section__heading">
            Equivalent length check
          </h3>
          <FlueCalculationSummary calculation={calculation} />
        </section>
      )}

      {/* Nudge if no segments yet */}
      {segments.length === 0 && !calculation && (
        <p className="qp-context-hint">
          Add at least one segment to start the equivalent-length calculation.
        </p>
      )}
    </>
  );
}
