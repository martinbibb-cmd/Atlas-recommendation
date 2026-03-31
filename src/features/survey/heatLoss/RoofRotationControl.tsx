/**
 * RoofRotationControl.tsx
 *
 * Spatial roof orientation selector.
 *
 * Renders a small house/roof graphic that the user rotates to match their real
 * property.  The compass rose stays fixed (North always at top); the house
 * rotates.  The current orientation is derived from the rotation angle and
 * displayed as a one-line summary below the graphic.
 *
 * Interaction:
 *   - Step rotate buttons: ±45° increments (L / R arrows)
 *   - Cardinal / intercardinal shortcut buttons: N / NE / E / SE / S / SW / W / NW
 *   - Pointer drag: drag anywhere on the house graphic to spin it freely
 *
 * Orientation derivation: the rotation angle is snapped to the nearest 45°
 * step then mapped to a CompassOrientation value.  The "main usable roof face"
 * is the pitch that points in the rotated direction (i.e. the peak ridge runs
 * perpendicular to the selected direction).
 *
 * Design principles:
 *   - No Math.random() — fully deterministic
 *   - Spatial / model-first, not form-first
 *   - All rendering via inline SVG — no external dependencies
 *   - Compass stays fixed; the house/roof model rotates
 *   - Snap feedback: brief ring highlight when the house locks to a compass point
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { CSSProperties } from 'react';
import type { CompassOrientation, RoofOrientation } from './heatLossTypes';
import { roofOrientationSummary } from './heatLossDerivations';

// ─── Props ────────────────────────────────────────────────────────────────────

interface RoofRotationControlProps {
  value: RoofOrientation;
  onChange: (next: RoofOrientation) => void;
  /**
   * Optional closed polygon points (metres) from the drawn floor-plan perimeter.
   * When provided and the polygon has ≥3 points, the drawn perimeter shape is
   * shown in the compass centre instead of the generic house silhouette.
   */
  perimeterPoints?: { x: number; y: number }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Offset to convert from standard mathematical angle (0° = right / east) to
 * compass angle (0° = up / north) when computing pointer direction relative
 * to the centre of the house graphic.
 */
const ANGLE_OFFSET_DEG = 90;

// ─── Angle → orientation mapping ─────────────────────────────────────────────

/** Snap any rotation angle (degrees) to the nearest 45° step. */
function snapTo45(deg: number): number {
  return Math.round(deg / 45) * 45;
}

/** Normalise an angle into the 0–360 range. */
function normalise360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Convert a snapped rotation angle to a CompassOrientation.
 * 0° = N (house faces north), 45° = NE, 90° = E, etc.
 */
function angleToOrientation(snapped: number): CompassOrientation {
  const normalised = normalise360(snapped);
  const map: Record<number, CompassOrientation> = {
    0:   'N',
    45:  'NE',
    90:  'E',
    135: 'SE',
    180: 'S',
    225: 'SW',
    270: 'W',
    315: 'NW',
  };
  return map[normalised] ?? 'N';
}

/**
 * Convert a RoofOrientation value back to a rotation angle (degrees).
 * 'unknown' → 0°.
 */
function orientationToAngle(orientation: RoofOrientation): number {
  if (orientation === 'unknown') return 0;
  const map: Record<CompassOrientation, number> = {
    N:  0,
    NE: 45,
    E:  90,
    SE: 135,
    S:  180,
    SW: 225,
    W:  270,
    NW: 315,
  };
  return map[orientation] ?? 0;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.6rem',
  userSelect: 'none',
};

const compassWrapStyle: CSSProperties = {
  position: 'relative',
  width: '160px',
  height: '160px',
};

const summaryStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: '0.78rem',
  color: '#4a5568',
  minHeight: '1.1rem',
};

const instructionStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: '0.75rem',
  color: '#718096',
  minHeight: '1rem',
};

/** 3×3 grid: top row = NW/N/NE, middle row = W/–/E, bottom row = SW/S/SE, plus ↺/↻ ends */
const buttonGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, auto)',
  gap: '0.3rem',
  alignItems: 'center',
  justifyItems: 'center',
};

function stepBtnStyle(active?: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '34px',
    height: '34px',
    borderRadius: '8px',
    border: active ? '2px solid #2b6cb0' : '1px solid #e2e8f0',
    background: active ? '#ebf8ff' : '#fff',
    color: active ? '#2b6cb0' : '#4a5568',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    padding: 0,
    transition: 'border-color 0.15s, background 0.15s',
  };
}

function rotateBtnStyle(): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '34px',
    height: '34px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: '#f7fafc',
    color: '#4a5568',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 600,
    padding: 0,
    transition: 'border-color 0.15s, background 0.15s',
  };
}

// ─── House SVG ────────────────────────────────────────────────────────────────

/**
 * Top-down house silhouette with a pitched roof and a bold direction arrow
 * indicating the "main usable face" (the face the roof slope points toward).
 *
 * The arrow points upward in local SVG space; the caller rotates the whole
 * element so the arrow always points in the selected compass direction.
 *
 * `snapped` highlights the arrow in accent blue when the house is locked to
 * a compass point (snap feedback).
 */
function HouseSvg({ snapped }: { snapped: boolean }) {
  const arrowColor = snapped ? '#1a56db' : '#2b6cb0';
  return (
    <svg
      viewBox="0 0 80 80"
      width="80"
      height="80"
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* House body */}
      <rect x="18" y="30" width="44" height="32" rx="2" fill="#dbe8f8" stroke="#4a7abf" strokeWidth="1.5" />
      {/* Door */}
      <rect x="33" y="47" width="14" height="15" rx="2" fill="#9ab4d8" stroke="#4a7abf" strokeWidth="1" />
      {/* Roof ridge (apex points "north" = upward in default orientation) */}
      <polygon points="40,6 66,32 14,32" fill="#7aa2c8" stroke="#3a6ea8" strokeWidth="1.5" />
      {/* Direction arrow: prominent upward arrow on the roof face */}
      {/* Arrow shaft */}
      <rect x="38" y="14" width="4" height="10" rx="1" fill={arrowColor} opacity={snapped ? 1 : 0.85} />
      {/* Arrow head */}
      <polygon points="40,6 45,16 35,16" fill={arrowColor} opacity={snapped ? 1 : 0.85} />
      {/* Snap ring — glows when snapped to a compass point */}
      {snapped && (
        <circle cx="40" cy="40" r="36" fill="none" stroke="#1a56db" strokeWidth="2.5" opacity="0.35" strokeDasharray="4 3" />
      )}
    </svg>
  );
}

// ─── Perimeter SVG ────────────────────────────────────────────────────────────

/**
 * Renders the drawn floor-plan perimeter polygon inside the compass.
 * The polygon is normalised to fill the 80×80 SVG viewBox with a small margin.
 * A north-arrow is overlaid so orientation feedback is preserved.
 */
function PerimeterSvg({ points, snapped }: { points: { x: number; y: number }[]; snapped: boolean }) {
  const MARGIN = 6;
  const VIEW = 80;
  const arrowColor = snapped ? '#1a56db' : '#2b6cb0';

  // Normalise the polygon to fit in (MARGIN, MARGIN, VIEW-2*MARGIN, VIEW-2*MARGIN).
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scale  = (VIEW - MARGIN * 2) / Math.max(rangeX, rangeY);
  const offsetX = MARGIN + ((VIEW - MARGIN * 2) - rangeX * scale) / 2;
  const offsetY = MARGIN + ((VIEW - MARGIN * 2) - rangeY * scale) / 2;

  const toSvg = (p: { x: number; y: number }) => ({
    x: offsetX + (p.x - minX) * scale,
    y: offsetY + (p.y - minY) * scale,
  });

  const svgPts = points.map(toSvg);
  const d = svgPts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ') + ' Z';

  return (
    <svg
      viewBox="0 0 80 80"
      width="80"
      height="80"
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* Perimeter polygon */}
      <path d={d} fill="rgba(26, 86, 219, 0.15)" stroke="#4a7abf" strokeWidth="1.5" strokeLinejoin="round" />
      {/* North arrow — always points upward (caller rotates the whole element) */}
      <rect x="38" y="2" width="4" height="9" rx="1" fill={arrowColor} opacity={snapped ? 1 : 0.85} />
      <polygon points="40,0 44,11 36,11" fill={arrowColor} opacity={snapped ? 1 : 0.85} />
      {snapped && (
        <circle cx="40" cy="40" r="36" fill="none" stroke="#1a56db" strokeWidth="2.5" opacity="0.35" strokeDasharray="4 3" />
      )}
    </svg>
  );
}

// ─── Compass rose (static) ────────────────────────────────────────────────────

/** Fixed N/E/S/W labels around the rotating house. */
function CompassLabels() {
  const labels: Array<{ label: string; x: number; y: number }> = [
    { label: 'N', x: 80,  y: 10  },
    { label: 'E', x: 152, y: 82  },
    { label: 'S', x: 80,  y: 153 },
    { label: 'W', x: 6,   y: 82  },
  ];
  return (
    <>
      {labels.map(({ label, x, y }) => (
        <span
          key={label}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            transform: 'translate(-50%, -50%)',
            fontSize: '0.7rem',
            fontWeight: 700,
            color: label === 'N' ? '#2b6cb0' : '#64748b',
            lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          {label}
        </span>
      ))}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RoofRotationControl({ value, onChange, perimeterPoints }: RoofRotationControlProps) {
  const [angleDeg, setAngleDeg] = useState(() => orientationToAngle(value));
  // Snap feedback: true while the house is at a clean 45° boundary
  const [isSnapped, setIsSnapped] = useState(value !== 'unknown');
  // Track pointer-drag state
  const dragRef = useRef<{ startAngle: number; startPointerAngle: number } | null>(null);
  const houseRef = useRef<HTMLDivElement>(null);

  // Sync internal angle when the controlled value changes externally (e.g. parent reset).
  useEffect(() => {
    if (value !== 'unknown') {
      setAngleDeg(orientationToAngle(value));
      setIsSnapped(true);
    }
  }, [value]);

  /** Compute the pointer angle relative to the centre of the house div. */
  const pointerAngleFrom = useCallback((clientX: number, clientY: number): number => {
    if (!houseRef.current) return 0;
    const rect = houseRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI) + ANGLE_OFFSET_DEG;
  }, []);

  const commitAngle = useCallback((raw: number) => {
    const snapped = snapTo45(normalise360(raw));
    setAngleDeg(snapped);
    setIsSnapped(true);
    onChange(angleToOrientation(snapped));
  }, [onChange]);

  // ── Pointer drag handlers ─────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startAngle: angleDeg,
      startPointerAngle: pointerAngleFrom(e.clientX, e.clientY),
    };
    setIsSnapped(false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const current = pointerAngleFrom(e.clientX, e.clientY);
    const delta = current - dragRef.current.startPointerAngle;
    const raw = dragRef.current.startAngle + delta;
    const snapped = snapTo45(normalise360(raw));
    setAngleDeg(snapped);
    setIsSnapped(false);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const current = pointerAngleFrom(e.clientX, e.clientY);
    const delta = current - dragRef.current.startPointerAngle;
    commitAngle(dragRef.current.startAngle + delta);
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // ── Step buttons ──────────────────────────────────────────────────────────
  const rotateBy = (delta: number) => commitAngle(angleDeg + delta);

  // Derive orientation consistently from internal angle state.
  const orientation = angleToOrientation(angleDeg);

  // All 8 compass directions for the shortcut button grid
  const cardinalDirs: CompassOrientation[] = ['NW', 'N', 'NE'];
  const midDirs: (CompassOrientation | null)[] = ['W', null, 'E'];
  const lowerDirs: CompassOrientation[] = ['SW', 'S', 'SE'];

  return (
    <div style={containerStyle} data-testid="roof-rotation-control">
      {/* Instruction copy */}
      <p style={instructionStyle}>
        Rotate so the arrow points the way your roof faces
      </p>

      {/* Compass rose + rotating house */}
      <div style={compassWrapStyle}>
        <CompassLabels />
        {/* Rotating house graphic */}
        <div
          ref={houseRef}
          role="slider"
          aria-label="Roof orientation — rotate to match your property"
          aria-valuenow={snapTo45(normalise360(angleDeg))}
          aria-valuemin={0}
          aria-valuemax={315}
          aria-valuetext={roofOrientationSummary(orientation)}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') rotateBy(45);
            if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   rotateBy(-45);
          }}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) rotate(${angleDeg}deg)`,
            cursor: 'grab',
            touchAction: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: isSnapped ? 'rgba(235, 248, 255, 0.9)' : 'rgba(255,255,255,0.85)',
            boxShadow: isSnapped
              ? '0 0 0 3px rgba(43, 108, 176, 0.25), 0 1px 4px rgba(0,0,0,0.12)'
              : '0 1px 4px rgba(0,0,0,0.12)',
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
        >
          {perimeterPoints && perimeterPoints.length >= 3
            ? <PerimeterSvg points={perimeterPoints} snapped={isSnapped} />
            : <HouseSvg snapped={isSnapped} />
          }
        </div>
      </div>

      {/* ±45° rotate + all 8 compass shortcuts */}
      <div style={buttonGridStyle} role="group" aria-label="Set roof orientation">
        {/* Rotate anti-clockwise */}
        <button
          type="button"
          style={rotateBtnStyle()}
          aria-label="Rotate anti-clockwise 45°"
          data-testid="rotate-ccw"
          onClick={() => rotateBy(-45)}
        >
          ↺
        </button>
        {/* NW / N / NE row */}
        {cardinalDirs.map((dir) => {
          const active = orientation === dir && isSnapped;
          return (
            <button
              key={dir}
              type="button"
              style={stepBtnStyle(active)}
              aria-label={dir}
              aria-pressed={active}
              data-testid={`roof-orientation-${dir}`}
              onClick={() => {
                const a = orientationToAngle(dir);
                setAngleDeg(a);
                setIsSnapped(true);
                onChange(dir);
              }}
            >
              {dir}
            </button>
          );
        })}
        {/* Rotate clockwise */}
        <button
          type="button"
          style={rotateBtnStyle()}
          aria-label="Rotate clockwise 45°"
          data-testid="rotate-cw"
          onClick={() => rotateBy(45)}
        >
          ↻
        </button>
        {/* W / – / E row */}
        {midDirs.map((dir, idx) => {
          if (dir === null) {
            return <div key={`mid-${idx}`} style={{ width: '34px', height: '34px' }} />;
          }
          const active = orientation === dir && isSnapped;
          return (
            <button
              key={dir}
              type="button"
              style={stepBtnStyle(active)}
              aria-label={dir}
              aria-pressed={active}
              data-testid={`roof-orientation-${dir}`}
              onClick={() => {
                const a = orientationToAngle(dir);
                setAngleDeg(a);
                setIsSnapped(true);
                onChange(dir);
              }}
            >
              {dir}
            </button>
          );
        })}
        {/* Empty cell to maintain grid alignment in bottom row */}
        <div />
        {/* SW / S / SE row */}
        {lowerDirs.map((dir) => {
          const active = orientation === dir && isSnapped;
          return (
            <button
              key={dir}
              type="button"
              style={stepBtnStyle(active)}
              aria-label={dir}
              aria-pressed={active}
              data-testid={`roof-orientation-${dir}`}
              onClick={() => {
                const a = orientationToAngle(dir);
                setAngleDeg(a);
                setIsSnapped(true);
                onChange(dir);
              }}
            >
              {dir}
            </button>
          );
        })}
        {/* Empty cell to complete the row */}
        <div />
      </div>

      {/* Summary line */}
      <p style={summaryStyle}>
        {value !== 'unknown'
          ? roofOrientationSummary(value)
          : 'Rotate the house to set the main usable roof face'}
      </p>
    </div>
  );
}
