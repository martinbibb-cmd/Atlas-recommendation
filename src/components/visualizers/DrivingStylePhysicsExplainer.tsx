/**
 * DrivingStylePhysicsExplainer.tsx
 *
 * Customer-facing 4-row driving-style physics explainer.
 *
 * Renders a static comparison infographic explaining heating-system
 * behaviour through a driving analogy:
 *   Row 1 — Boy Racer / Hot Hatch  (combi boiler)
 *   Row 2 — Mondeo                 (system / regular boiler with stored hot water)
 *   Row 3 — Hyper-miler            (gas + strong controls + Mixergy)
 *   Row 4 — Electric Hyper-miler   (heat pump)
 *
 * An optional CSS animation layer (animate prop, default true) adds subtle
 * vehicle-token motion on mount.  The animation settles after ~4 seconds,
 * leaving the component in a state identical to animate=false.
 *
 * Set animate=false for print/PDF use — the static diagram is identical.
 * Animation NEVER modifies the data model or path tracks.
 *
 * Props are documented in src/types/explainers.ts.
 *
 * Placement suggestions:
 *   - comparison page (combi vs stored choice)
 *   - recommendation rationale
 *   - objection-handling area
 *   - printed reports
 */

import { useMemo } from 'react';
import {
  buildDrivingStyleRows,
  resolveExplainerInput,
} from '../../lib/explainers/drivingStyleExplainer';
import type {
  DrivingStylePhysicsExplainerProps,
  DrivingStyleRow,
  DrivetrainId,
  PathVariant,
} from '../../types/explainers';
import './DrivingStylePhysicsExplainer.css';

// ─── Vehicle icons ────────────────────────────────────────────────────────────

const VEHICLE_ICON: Record<DrivetrainId, string> = {
  combi:    '🏎️',
  system:   '🚗',
  mixergy:  '🚙',
  heatpump: '⚡',
};

// ─── Fixed semantic energy bar widths ────────────────────────────────────────

/**
 * Fixed semantic energy bar widths per drivetrain.
 * Values chosen for visual clarity — the difference should be immediately
 * obvious so users grasp the relative running costs at a glance.
 *
 * combi 85 % → large intentionally; combi wastes the most energy through
 *              purge loss, stop-start cycling and always-on burner runs.
 * system 60 % → 25-point drop from combi reflects decoupled generation gain.
 * mixergy 45 % → smart stratification squeezes out another 15 points.
 * heatpump 25 % → low-grade continuous heat; smallest bar, most efficient.
 */
const ENERGY_BAR_PCT: Record<DrivetrainId, number> = {
  combi:    85,
  system:   60,
  mixergy:  45,
  heatpump: 25,
};

// ─── Static SVG path definitions ─────────────────────────────────────────────

/**
 * SVG polyline/path data for each path variant.
 * ViewBox: "0 0 200 28" (width 200, height 28).
 */
const PATH_DATA: Record<PathVariant, string> = {
  // Jagged line with a small backward notch near the start (combi stop-start behaviour)
  'jagged-reverse':
    'M 0,14 L 4,18 L 2,21 L 10,10 L 20,20 L 32,8 L 44,19 L 56,9 L 70,19 L 84,12 L 102,15 L 124,12 L 148,14 L 172,12 L 190,13 L 200,13',
  // Mostly straight with mild undulation (steady system boiler)
  'steady':
    'M 0,16 L 55,14 L 110,15 L 165,13 L 200,14',
  // Smooth curve (Mixergy smart storage)
  'smooth':
    'M 0,20 C 60,20 140,9 200,11',
  // Smooth curve ending slightly earlier — heat pump hasn't fully arrived
  'slow-smooth':
    'M 0,20 C 50,20 120,9 176,11',
};

/**
 * Normalised X position (0–1) at which the vehicle token sits for each variant.
 * The heat pump ends at ~88 % to show it hasn't quite reached the finish line.
 */
const TOKEN_POSITION_FRAC: Record<PathVariant, number> = {
  'jagged-reverse': 1.0,
  'steady':         1.0,
  'smooth':         1.0,
  'slow-smooth':    0.88,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface PathTrackProps {
  id:         DrivetrainId;
  variant:    PathVariant;
  hasWarning: boolean;
}

function PathTrack({ id, variant, hasWarning }: PathTrackProps) {
  const tokenPct = TOKEN_POSITION_FRAC[variant] * 100;

  const tokenClass = [
    'dspe__vehicle-token',
    `dspe__vehicle-token--${id}`,
    hasWarning ? 'dspe__vehicle-token--has-warning' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="dspe__path-wrapper" aria-hidden="true">
      <svg
        viewBox="0 0 200 28"
        className="dspe__path-svg"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d={PATH_DATA[variant]}
          className={`dspe__path-line dspe__path-line--${id}`}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className={tokenClass}
        style={{ left: `calc(${tokenPct}% - 1.1rem)` }}
      >
        {VEHICLE_ICON[id]}
      </span>
    </div>
  );
}

interface RowProps {
  row:     DrivingStyleRow;
  dimmed:  boolean;
  compact: boolean;
}

function Row({ row, dimmed, compact }: RowProps) {
  const energyBarPct = ENERGY_BAR_PCT[row.id];

  return (
    <div
      className={`dspe__row${dimmed ? ' dspe__row--dimmed' : ''}`}
      role="listitem"
      data-system={row.id}
    >
      {/* Row header: title, system label, chips */}
      <div className="dspe__row-header">
        <div className="dspe__row-labels">
          <span className="dspe__row-title">{row.title}</span>
          <span className="dspe__row-system">{row.systemLabel}</span>
        </div>
        <div className="dspe__row-chips">
          <span className="dspe__chip dspe__chip--power">{row.powerBadge}</span>
          {row.eventChip && (
            <span className="dspe__chip dspe__chip--event">{row.eventChip}</span>
          )}
          {row.warningChip && (
            <span className="dspe__chip dspe__chip--warning" role="status">
              {row.warningChip}
            </span>
          )}
        </div>
      </div>

      {/* Static path track — hidden in compact mode */}
      {!compact && (
        <PathTrack
          id={row.id}
          variant={row.pathVariant}
          hasWarning={!!row.warningChip}
        />
      )}

      {/* Static energy bar */}
      <div className="dspe__energy-bar">
        <div
          className="dspe__energy-track"
          aria-label={`Energy use: ${row.powerBadge}`}
        >
          <div
            className={`dspe__energy-fill dspe__energy-fill--${row.id}`}
            style={{ width: `${energyBarPct}%` }}
          />
        </div>
      </div>

      {/* Caption */}
      <p className="dspe__row-caption">{row.caption}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * DrivingStylePhysicsExplainer
 *
 * Static 4-row infographic explaining combi, system, Mixergy, and heat pump
 * behaviour through a driving analogy.
 *
 * An optional CSS animation layer (animate prop, default true) adds subtle
 * vehicle-token motion on mount only — path tracks are never animated.
 * When animate=false (or in print/reduced-motion contexts) the component
 * renders as a fully static diagram safe for PDF output.
 *
 * No progressbar semantics are used at any time.
 *
 * @see src/types/explainers.ts for full prop documentation.
 */
export default function DrivingStylePhysicsExplainer({
  systemFocus = 'all',
  peakConcurrentOutlets,
  occupancySignature,
  controlsQuality,
  hasMixergy,
  compact = false,
  animate = true,
}: DrivingStylePhysicsExplainerProps) {
  const input = useMemo(
    () =>
      resolveExplainerInput({
        peakConcurrentOutlets,
        occupancySignature,
        controlsQuality,
        hasMixergy,
      }),
    [peakConcurrentOutlets, occupancySignature, controlsQuality, hasMixergy],
  );

  const rows = useMemo(() => buildDrivingStyleRows(input), [input]);

  return (
    <section
      className={[
        'dspe',
        compact  ? 'dspe--compact'   : '',
        animate  ? 'dspe--animated'  : '',
      ].filter(Boolean).join(' ')}
      aria-labelledby="dspe-title"
    >
      {/* Header */}
      <div className="dspe__header">
        <h3 id="dspe-title" className="dspe__title">
          Why these systems behave differently
        </h3>
        <p className="dspe__subtitle">
          Same destination. Different route, power and waste.
        </p>
      </div>

      {/* 4-row comparison */}
      <div className="dspe__track" role="list" aria-label="Heating system comparison">
        {rows.map((row) => (
          <Row
            key={row.id}
            row={row}
            dimmed={systemFocus !== 'all' && row.id !== systemFocus}
            compact={compact}
          />
        ))}
        {/* Finish-line rule — visual marker at right edge */}
        <div className="dspe__finish-rule" aria-hidden="true" />
      </div>

      {/* Support text */}
      <div className="dspe__support">
        <p className="dspe__support-text">
          On-demand hot water needs very high power.
        </p>
        <p className="dspe__support-text">
          Stored hot water lets the heat source run more steadily.
        </p>
        <p className="dspe__support-text">
          Heat pumps use less energy overall, but recover more slowly.
        </p>
      </div>
    </section>
  );
}
