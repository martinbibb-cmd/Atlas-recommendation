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
 *   - Step rotate buttons: ±45° increments (L / R arrows + direct N/E/S/W shortcuts)
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
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { CSSProperties } from 'react';
import type { CompassOrientation, RoofOrientation } from './heatLossTypes';
import { roofOrientationSummary } from './heatLossDerivations';

// ─── Props ────────────────────────────────────────────────────────────────────

interface RoofRotationControlProps {
  value: RoofOrientation;
  onChange: (next: RoofOrientation) => void;
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

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.4rem',
  alignItems: 'center',
};

function stepBtnStyle(active?: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    border: active ? '2px solid #2b6cb0' : '1px solid #e2e8f0',
    background: active ? '#ebf8ff' : '#fff',
    color: active ? '#2b6cb0' : '#4a5568',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    padding: 0,
    transition: 'border-color 0.15s, background 0.15s',
  };
}

// ─── House SVG ────────────────────────────────────────────────────────────────

/**
 * A simple top-down house footprint with a pitched roof triangle and an arrow
 * indicating the "main usable face" direction.
 *
 * The SVG rotates about its centre; the caller applies the rotation via CSS
 * transform.
 */
function HouseSvg() {
  return (
    <svg
      viewBox="0 0 80 80"
      width="80"
      height="80"
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* House body */}
      <rect x="16" y="28" width="48" height="36" rx="2" fill="#e2e8f0" stroke="#64748b" strokeWidth="1.5" />
      {/* Roof triangle — apex points "north" in local SVG space (upward in default orientation) */}
      <polygon points="40,4 68,30 12,30" fill="#94a3b8" stroke="#475569" strokeWidth="1.5" />
      {/* Direction arrow on roof face (pointing upward = facing the selected direction) */}
      <polygon points="40,8 44,20 40,17 36,20" fill="#2b6cb0" opacity="0.85" />
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

export function RoofRotationControl({ value, onChange }: RoofRotationControlProps) {
  const [angleDeg, setAngleDeg] = useState(() => orientationToAngle(value));
  // Track pointer-drag state
  const dragRef = useRef<{ startAngle: number; startPointerAngle: number } | null>(null);
  const houseRef = useRef<HTMLDivElement>(null);

  // Sync internal angle when the controlled value changes externally (e.g. parent reset).
  useEffect(() => {
    if (value !== 'unknown') {
      setAngleDeg(orientationToAngle(value));
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
    onChange(angleToOrientation(snapped));
  }, [onChange]);

  // ── Pointer drag handlers ─────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startAngle: angleDeg,
      startPointerAngle: pointerAngleFrom(e.clientX, e.clientY),
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const current = pointerAngleFrom(e.clientX, e.clientY);
    const delta = current - dragRef.current.startPointerAngle;
    const raw = dragRef.current.startAngle + delta;
    const snapped = snapTo45(normalise360(raw));
    setAngleDeg(snapped);
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
  // `value` is used only for the summary text (to distinguish 'unknown' from a set value).
  const orientation = angleToOrientation(angleDeg);

  return (
    <div style={containerStyle} data-testid="roof-rotation-control">
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
            background: 'rgba(255,255,255,0.85)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
          }}
        >
          <HouseSvg />
        </div>
      </div>

      {/* Step-rotate buttons */}
      <div style={buttonRowStyle} role="group" aria-label="Rotate house orientation">
        <button
          type="button"
          style={stepBtnStyle()}
          aria-label="Rotate anti-clockwise 45°"
          data-testid="rotate-ccw"
          onClick={() => rotateBy(-45)}
        >
          ↺
        </button>
        {(['N','E','S','W'] as CompassOrientation[]).map((dir) => {
          const active = orientation === dir;
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
                onChange(dir);
              }}
            >
              {dir}
            </button>
          );
        })}
        <button
          type="button"
          style={stepBtnStyle()}
          aria-label="Rotate clockwise 45°"
          data-testid="rotate-cw"
          onClick={() => rotateBy(45)}
        >
          ↻
        </button>
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
