/**
 * RouteDrawingCanvas.tsx
 *
 * Floor-plan polyline drawing surface for pipework routes.
 *
 * The engineer taps / clicks on the floor-plan image to add waypoints.
 * The route is rendered as an SVG polyline overlay on top of the image.
 * "Remove last point" removes the most-recently added waypoint.
 *
 * Coordinate system:
 *   Points are stored in image-natural-pixel coordinates (0 → imageWidth,
 *   0 → imageHeight) where imageWidth/imageHeight are the natural (intrinsic)
 *   dimensions of the floor-plan image.  When the image is scaled by the
 *   browser, click positions are mapped back to natural coordinates before
 *   being stored.
 *
 *   - coordinateSpace 'pixels' with no scale → length cannot be calculated
 *     ('needs_scale' confidence); points are stored as-is.
 *   - coordinateSpace 'pixels' with a scale → points are converted to metres
 *     at calculation time by routeActions helpers (not here).
 *   - coordinateSpace 'metres' → the caller must ensure that each point
 *     passed back is already in metre-space; this canvas does not convert.
 *
 * When no floorPlanUri is provided, a plain grid background is shown so the
 * engineer can still trace a rough polyline for estimating.
 *
 * Design rules:
 *   - Pure presentational — all state is owned by the parent.
 *   - Never mutates points in-place.
 *   - Does not output customer-facing copy.
 */

import { useRef, useCallback } from 'react';
import type { QuoteRoutePointV1 } from '../../calculators/quotePlannerTypes';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface RouteDrawingCanvasProps {
  /** Ordered waypoints to display as the current polyline. */
  points: QuoteRoutePointV1[];
  /**
   * Called when the engineer taps the canvas to add a new waypoint.
   * The provided point has x/y in image-natural pixels and kind omitted;
   * `addRoutePoint` in routeActions assigns the kind.
   */
  onAddPoint: (point: { x: number; y: number }) => void;
  /** Called when the engineer taps "Remove last point". */
  onRemoveLastPoint: () => void;
  /**
   * Optional floor-plan image URI.
   * When absent, a neutral placeholder is shown.
   */
  floorPlanUri?: string;
  /**
   * Route colour used for the polyline stroke.
   * Defaults to '#2563eb' (Atlas primary blue).
   */
  color?: string;
}

// ─── Canvas dimensions ────────────────────────────────────────────────────────

/** Fallback canvas size when no floor plan image is provided. */
const FALLBACK_WIDTH = 600;
const FALLBACK_HEIGHT = 400;

// ─── Component ────────────────────────────────────────────────────────────────

export function RouteDrawingCanvas({
  points,
  onAddPoint,
  onRemoveLastPoint,
  floorPlanUri,
  color = '#2563eb',
}: RouteDrawingCanvasProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  /**
   * Maps a click event on the displayed image to image-natural-pixel coords.
   * Falls back to the click offset coordinates when the image is not yet loaded.
   */
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const img = imgRef.current;

      let x: number;
      let y: number;

      if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
        const rect = img.getBoundingClientRect();
        const relX = e.clientX - rect.left;
        const relY = e.clientY - rect.top;
        // Scale from displayed size to natural (intrinsic) pixel coordinates.
        x = (relX / rect.width) * img.naturalWidth;
        y = (relY / rect.height) * img.naturalHeight;
      } else {
        // Fallback: use the click offset within the canvas element.
        const target = e.currentTarget;
        const rect = target.getBoundingClientRect();
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
      }

      onAddPoint({ x: Math.round(x), y: Math.round(y) });
    },
    [onAddPoint],
  );

  // Build the SVG viewBox based on the image's natural dimensions.
  const img = imgRef.current;
  const svgWidth = img?.naturalWidth ?? FALLBACK_WIDTH;
  const svgHeight = img?.naturalHeight ?? FALLBACK_HEIGHT;

  // Build the points string for <polyline>.
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="rdc-wrapper" data-testid="route-drawing-canvas">
      {/* Canvas area */}
      <div
        className="rdc-canvas"
        role="button"
        tabIndex={0}
        aria-label="Floor plan drawing area — tap to add waypoints"
        onClick={handleCanvasClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            // Keyboard activation — place a point at the centre of the canvas.
            const rect = e.currentTarget.getBoundingClientRect();
            onAddPoint({ x: Math.round(rect.width / 2), y: Math.round(rect.height / 2) });
          }
        }}
      >
        {floorPlanUri ? (
          <img
            ref={imgRef}
            src={floorPlanUri}
            alt="Floor plan"
            className="rdc-floor-plan"
            draggable={false}
          />
        ) : (
          <div className="rdc-placeholder" aria-label="No floor plan available">
            <span className="rdc-placeholder__text">
              No floor plan — tap to place waypoints
            </span>
          </div>
        )}

        {/* SVG polyline overlay */}
        <svg
          ref={svgRef}
          className="rdc-overlay"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {points.length >= 2 && (
            <polyline
              points={polylinePoints}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.85"
            />
          )}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={i === 0 || i === points.length - 1 ? 14 : 9}
              fill={i === 0 ? '#16a34a' : i === points.length - 1 ? '#dc2626' : color}
              stroke="#fff"
              strokeWidth="3"
            />
          ))}
        </svg>
      </div>

      {/* Controls */}
      <div className="rdc-controls">
        <span className="rdc-point-count" aria-live="polite">
          {points.length === 0
            ? 'No points — tap the plan to start drawing'
            : `${points.length} point${points.length === 1 ? '' : 's'} drawn`}
        </span>

        {points.length > 0 && (
          <button
            type="button"
            className="rdc-remove-btn"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveLastPoint();
            }}
            aria-label="Remove last point"
          >
            ← Remove last
          </button>
        )}
      </div>
    </div>
  );
}
