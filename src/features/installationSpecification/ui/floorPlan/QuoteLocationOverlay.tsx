/**
 * QuoteLocationOverlay.tsx
 *
 * Renders all active (non-rejected) quote-plan locations as interactive pins
 * positioned over a floor-plan image.
 *
 * Positions are normalised 0–1 coordinates relative to the overlay container.
 * Locations without a `planCoord` are stacked in a column at the right edge so
 * the engineer can see them and drag them into position.
 *
 * Clicking on the empty floor-plan area calls `onPlanClick` so the parent can
 * start a "place new pin" or "move pin" interaction.
 *
 * Design rules:
 *   - Does not mutate location data.
 *   - Rejected locations are excluded from rendering.
 */

import { QuoteLocationPin } from './QuoteLocationPin';
import type { QuotePlanLocationV1 } from '../../model/QuoteInstallationPlanV1';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface QuoteLocationOverlayProps {
  locations: QuotePlanLocationV1[];
  onConfirm: (locationId: string) => void;
  onMove: (locationId: string) => void;
  onMarkNeedsVerification: (locationId: string) => void;
  onReject: (locationId: string) => void;
  /**
   * Called when the engineer taps empty floor-plan space (for placing a new
   * pin or completing a move operation).
   */
  onPlanClick: (coord: { x: number; y: number }) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert normalised 0–1 coordinates to CSS percentage strings for absolute
 * positioning within the overlay div.
 */
function toCssPosition(coord: { x: number; y: number }): React.CSSProperties {
  return {
    left:      `${coord.x * 100}%`,
    top:       `${coord.y * 100}%`,
    transform: 'translate(-50%, -100%)',
  };
}

/** Stacked fallback position for unplaced pins (right-edge column). */
function stackedPosition(index: number): React.CSSProperties {
  return {
    right:     '0.5rem',
    top:       `${0.5 + index * 3.5}rem`,
    position:  'absolute',
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuoteLocationOverlay({
  locations,
  onConfirm,
  onMove,
  onMarkNeedsVerification,
  onReject,
  onPlanClick,
}: QuoteLocationOverlayProps) {
  const active = locations.filter((loc) => !loc.rejected);
  const placed    = active.filter((loc) => loc.planCoord != null);
  const unplaced  = active.filter((loc) => loc.planCoord == null);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top)  / rect.height;
    onPlanClick({ x, y });
  }

  return (
    <div
      className="ql-overlay"
      role="presentation"
      onClick={handleOverlayClick}
      data-testid="quote-location-overlay"
    >
      {placed.map((loc) => (
        <div
          key={loc.locationId}
          className="ql-overlay__pin-wrapper"
          style={{ ...toCssPosition(loc.planCoord!), position: 'absolute' }}
        >
          <QuoteLocationPin
            location={loc}
            onConfirm={() => onConfirm(loc.locationId)}
            onMove={() => onMove(loc.locationId)}
            onMarkNeedsVerification={() => onMarkNeedsVerification(loc.locationId)}
            onReject={() => onReject(loc.locationId)}
          />
        </div>
      ))}

      {unplaced.map((loc, i) => (
        <div
          key={loc.locationId}
          className="ql-overlay__pin-wrapper ql-overlay__pin-wrapper--unplaced"
          style={stackedPosition(i)}
        >
          <QuoteLocationPin
            location={loc}
            onConfirm={() => onConfirm(loc.locationId)}
            onMove={() => onMove(loc.locationId)}
            onMarkNeedsVerification={() => onMarkNeedsVerification(loc.locationId)}
            onReject={() => onReject(loc.locationId)}
          />
        </div>
      ))}
    </div>
  );
}
