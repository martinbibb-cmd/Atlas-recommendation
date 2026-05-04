/**
 * QuoteLocationPicker.tsx
 *
 * Main location-management component for the Place Locations step.
 *
 * When a floor-plan image URI is provided the component shows the floor plan
 * with `QuoteLocationOverlay` pins on top.  When no floor plan is available it
 * falls back to a plain list view so the engineer can still confirm, flag, and
 * remove locations.
 *
 * In both modes the engineer can:
 *   - Confirm an imported candidate location.
 *   - Move a location (floor plan only — tapping the overlay places the pin).
 *   - Add a missing location from a kind selector.
 *   - Mark a location as needing verification.
 *   - Reject / delete a wrong candidate (soft-delete).
 *
 * Design rules:
 *   - No physics, no engine calls, no customer-facing output.
 *   - All state mutations are reported via `onLocationsChange` — this component
 *     is controlled.
 *   - Rejected locations are hidden from the active list but not removed.
 */

import { useState } from 'react';
import { QuoteLocationOverlay } from './QuoteLocationOverlay';
import {
  confirmLocation,
  moveLocation,
  addManualLocation,
  markNeedsVerification,
  rejectLocation,
  applyToLocation,
  LOCATION_KIND_LABELS,
  getLocationBadgeLabel,
} from '../../model/locationActions';
import type { QuotePlanLocationV1, QuotePlanLocationKind } from '../../model/QuoteInstallationPlanV1';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface QuoteLocationPickerProps {
  locations: QuotePlanLocationV1[];
  onLocationsChange: (locations: QuotePlanLocationV1[]) => void;
  /** Optional floor-plan image URI. Fallback list shown when absent. */
  floorPlanUri?: string;
}

// ─── Kind options for the "add" selector ─────────────────────────────────────

const ADDABLE_KINDS: QuotePlanLocationKind[] = [
  'existing_boiler',
  'proposed_boiler',
  'gas_meter',
  'flue_terminal',
  'cylinder',
  'internal_waste',
  'soil_stack',
  'gully',
  'soakaway',
  'other',
];

// ─── Component ────────────────────────────────────────────────────────────────

export function QuoteLocationPicker({
  locations,
  onLocationsChange,
  floorPlanUri,
}: QuoteLocationPickerProps) {
  /**
   * When `movingId` is set, the next plan-click moves that pin.
   * When `placingKind` is set, the next plan-click places a new pin.
   */
  const [movingId,     setMovingId]     = useState<string | null>(null);
  const [placingKind,  setPlacingKind]  = useState<QuotePlanLocationKind | null>(null);
  const [addOpen,      setAddOpen]      = useState(false);

  const active = locations.filter((loc) => !loc.rejected);

  // ── Mutation helpers ────────────────────────────────────────────────────────

  function handleConfirm(locationId: string) {
    onLocationsChange(
      applyToLocation(locations, locationId, confirmLocation),
    );
  }

  function handleMoveStart(locationId: string) {
    setPlacingKind(null);
    setMovingId(locationId);
  }

  function handleMarkNeedsVerification(locationId: string) {
    onLocationsChange(
      applyToLocation(locations, locationId, markNeedsVerification),
    );
  }

  function handleReject(locationId: string) {
    onLocationsChange(
      applyToLocation(locations, locationId, rejectLocation),
    );
  }

  function handleAddKindSelect(kind: QuotePlanLocationKind) {
    setAddOpen(false);
    if (floorPlanUri) {
      // Enter placing mode — next floor plan click plants the pin.
      setPlacingKind(kind);
    } else {
      // No floor plan — add immediately without coordinates.
      onLocationsChange([...locations, addManualLocation(kind)]);
    }
  }

  function handlePlanClick(coord: { x: number; y: number }) {
    if (movingId) {
      onLocationsChange(
        applyToLocation(locations, movingId, (loc) =>
          moveLocation(loc, coord),
        ),
      );
      setMovingId(null);
      return;
    }

    if (placingKind) {
      onLocationsChange([...locations, addManualLocation(placingKind, coord)]);
      setPlacingKind(null);
    }
  }

  // ── Render mode: floor plan ─────────────────────────────────────────────────

  if (floorPlanUri) {
    const hint =
      movingId     ? 'Tap the floor plan to place the moved location.' :
      placingKind  ? `Tap the floor plan to place: ${LOCATION_KIND_LABELS[placingKind]}.` :
      null;

    return (
      <div className="ql-floor-plan-wrapper">
        {hint && (
          <p className="ql-placement-hint" role="status">
            {hint}
          </p>
        )}

        <div className="ql-floor-plan-container">
          {/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */}
          <img
            src={floorPlanUri}
            alt="Floor plan"
            className="ql-floor-plan"
            draggable={false}
          />
          <QuoteLocationOverlay
            locations={locations}
            onConfirm={handleConfirm}
            onMove={handleMoveStart}
            onMarkNeedsVerification={handleMarkNeedsVerification}
            onReject={handleReject}
            onPlanClick={handlePlanClick}
          />
        </div>

        <AddLocationBar
          onAddKind={handleAddKindSelect}
          open={addOpen}
          onToggle={() => {
            setAddOpen((v) => !v);
            setMovingId(null);
            setPlacingKind(null);
          }}
        />
      </div>
    );
  }

  // ── Render mode: fallback list ──────────────────────────────────────────────

  return (
    <div className="ql-fallback-list" data-testid="quote-location-fallback-list">
      {active.length === 0 && (
        <p className="ql-fallback-empty">
          No locations added yet. Use the button below to add the key install points.
        </p>
      )}

      {active.map((loc) => (
        <FallbackListItem
          key={loc.locationId}
          location={loc}
          onConfirm={() => handleConfirm(loc.locationId)}
          onMarkNeedsVerification={() => handleMarkNeedsVerification(loc.locationId)}
          onReject={() => handleReject(loc.locationId)}
        />
      ))}

      <AddLocationBar
        onAddKind={handleAddKindSelect}
        open={addOpen}
        onToggle={() => setAddOpen((v) => !v)}
      />
    </div>
  );
}

// ─── Fallback list item ───────────────────────────────────────────────────────

interface FallbackListItemProps {
  location: QuotePlanLocationV1;
  onConfirm: () => void;
  onMarkNeedsVerification: () => void;
  onReject: () => void;
}

function FallbackListItem({
  location,
  onConfirm,
  onMarkNeedsVerification,
  onReject,
}: FallbackListItemProps) {
  const kindLabel = LOCATION_KIND_LABELS[location.kind] ?? location.kind;
  const badge     = getLocationBadgeLabel(location);

  return (
    <div className="ql-fallback-item" data-testid={`location-item-${location.locationId}`}>
      <div className="ql-fallback-item__meta">
        <span className="ql-fallback-item__kind">{kindLabel}</span>
        {location.roomLabel && (
          <span className="ql-fallback-item__room"> — {location.roomLabel}</span>
        )}
        <span className={`ql-fallback-item__badge ql-pin__badge--${badge.replace(' ', '-')}`}>
          {badge}
        </span>
      </div>
      <div className="ql-fallback-item__actions">
        <button
          type="button"
          className="ql-action-btn ql-action-btn--confirm"
          onClick={onConfirm}
          aria-label={`Confirm ${kindLabel}`}
        >
          ✓ Confirm
        </button>
        <button
          type="button"
          className="ql-action-btn ql-action-btn--verify"
          onClick={onMarkNeedsVerification}
          aria-label={`Mark ${kindLabel} as needs verification`}
        >
          ? Verify
        </button>
        <button
          type="button"
          className="ql-action-btn ql-action-btn--reject"
          onClick={onReject}
          aria-label={`Remove ${kindLabel}`}
        >
          ✕ Remove
        </button>
      </div>
    </div>
  );
}

// ─── Add location bar ─────────────────────────────────────────────────────────

interface AddLocationBarProps {
  open: boolean;
  onToggle: () => void;
  onAddKind: (kind: QuotePlanLocationKind) => void;
}

function AddLocationBar({ open, onToggle, onAddKind }: AddLocationBarProps) {
  return (
    <div className="ql-add-bar">
      <button
        type="button"
        className="ql-add-bar__toggle"
        onClick={onToggle}
        aria-expanded={open}
      >
        + Add location
      </button>

      {open && (
        <div className="ql-add-bar__grid" role="menu">
          {ADDABLE_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              className="ql-add-bar__kind-btn"
              role="menuitem"
              onClick={() => onAddKind(kind)}
            >
              {LOCATION_KIND_LABELS[kind]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
