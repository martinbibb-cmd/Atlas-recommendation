/**
 * QuoteLocationPin.tsx
 *
 * A single interactive pin on the floor-plan overlay.
 *
 * Shows:
 *   - An emoji icon representing the location kind.
 *   - A confidence badge (confirmed / measured / estimated /
 *     needs verification / assumed).
 *   - An expandable action bar: Confirm, Needs verification, Remove.
 *
 * Design rules:
 *   - Does not mutate location data — all changes are reported via callbacks.
 *   - Rejected locations are not rendered by the parent overlay.
 *   - "Move" is reported to the parent which then enters move-placement mode.
 */

import { useState } from 'react';
import {
  getLocationBadgeLabel,
  LOCATION_KIND_LABELS,
} from '../../model/locationActions';
import type { QuotePlanLocationV1 } from '../../model/QuoteInstallationPlanV1';

// ─── Kind icon map ────────────────────────────────────────────────────────────

const KIND_ICONS: Record<string, string> = {
  proposed_boiler:  '🔥',
  existing_boiler:  '🏠',
  gas_meter:        '⛽',
  flue_terminal:    '🔩',
  cylinder:         '🛢️',
  internal_waste:   '🪣',
  soil_stack:       '🏗️',
  gully:            '🕳️',
  soakaway:         '💧',
  other:            '📍',
};

function kindIcon(kind: string): string {
  return KIND_ICONS[kind] ?? '📍';
}

// ─── Badge colour map ─────────────────────────────────────────────────────────

const BADGE_CLASSES: Record<string, string> = {
  'confirmed':          'ql-pin__badge--confirmed',
  'measured':           'ql-pin__badge--measured',
  'estimated':          'ql-pin__badge--estimated',
  'needs verification': 'ql-pin__badge--needs-verification',
  'assumed':            'ql-pin__badge--assumed',
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface QuoteLocationPinProps {
  location: QuotePlanLocationV1;
  /** Called when the engineer confirms the location is correct. */
  onConfirm: () => void;
  /** Called when the engineer wants to move the pin — parent handles placement. */
  onMove: () => void;
  /** Called when the engineer flags the location for review. */
  onMarkNeedsVerification: () => void;
  /** Called when the engineer rejects / removes the location. */
  onReject: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuoteLocationPin({
  location,
  onConfirm,
  onMove,
  onMarkNeedsVerification,
  onReject,
}: QuoteLocationPinProps) {
  const [open, setOpen] = useState(false);

  const badge = getLocationBadgeLabel(location);
  const kindLabel = LOCATION_KIND_LABELS[location.kind] ?? location.kind;

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    setOpen((v) => !v);
  }

  function handleAction(e: React.MouseEvent, fn: () => void) {
    e.stopPropagation();
    setOpen(false);
    fn();
  }

  return (
    <div
      className="ql-pin"
      role="button"
      aria-label={kindLabel}
      aria-expanded={open}
      tabIndex={0}
      onClick={handleToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setOpen((v) => !v);
        }
      }}
    >
      <span className="ql-pin__icon" aria-hidden="true">
        {kindIcon(location.kind)}
      </span>

      <span className={`ql-pin__badge ${BADGE_CLASSES[badge] ?? ''}`}>
        {badge}
      </span>

      {open && (
        <div className="ql-pin__actions" role="menu">
          <button
            type="button"
            className="ql-pin__action ql-pin__action--confirm"
            onClick={(e) => handleAction(e, onConfirm)}
            role="menuitem"
          >
            ✓ Confirm
          </button>
          <button
            type="button"
            className="ql-pin__action ql-pin__action--move"
            onClick={(e) => handleAction(e, onMove)}
            role="menuitem"
          >
            ↔ Move
          </button>
          <button
            type="button"
            className="ql-pin__action ql-pin__action--verify"
            onClick={(e) => handleAction(e, onMarkNeedsVerification)}
            role="menuitem"
          >
            ? Needs verification
          </button>
          <button
            type="button"
            className="ql-pin__action ql-pin__action--reject"
            onClick={(e) => handleAction(e, onReject)}
            role="menuitem"
          >
            ✕ Remove
          </button>
        </div>
      )}
    </div>
  );
}
