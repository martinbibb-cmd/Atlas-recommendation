/**
 * DrivingStylePhysicsExplainer.tsx
 *
 * Customer-facing 4-lane driving-style physics explainer.
 *
 * Translates heating-system behaviour into a driving / race analogy so that
 * users can instantly distinguish:
 *   Lane 1 — Boy Racer / Hot Hatch  (combi boiler)
 *   Lane 2 — Mondeo                 (system / regular boiler with stored hot water)
 *   Lane 3 — Hyper-miler            (gas + strong controls + Mixergy)
 *   Lane 4 — Electric Hyper-miler   (heat pump)
 *
 * Props are documented in src/types/explainers.ts.
 *
 * Animation is pure CSS — no external animation library.
 * Compact mode renders the final static state for PDF/report contexts and
 * automatically applies when the user prefers reduced motion.
 *
 * Placement suggestions:
 *   - comparison page (combi vs stored choice)
 *   - recommendation rationale
 *   - objection-handling area
 */

import { useMemo } from 'react';
import {
  buildDrivingStyleLaneStates,
  resolveExplainerInput,
} from '../../lib/explainers/drivingStyleExplainer';
import type { DrivingStylePhysicsExplainerProps, DrivetrainId, LaneState } from '../../types/explainers';
import './DrivingStylePhysicsExplainer.css';

// ─── Vehicle icons ────────────────────────────────────────────────────────────

const VEHICLE_ICON: Record<DrivetrainId, string> = {
  combi:    '🏎️',
  system:   '🚗',
  mixergy:  '🚙',
  heatpump: '⚡',
};

/** Icon used for the energy gauge — gas-pump for gas systems, battery for HP. */
const GAUGE_ICON: Record<DrivetrainId, string> = {
  combi:    '⛽',
  system:   '⛽',
  mixergy:  '⛽',
  heatpump: '🔋',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface LaneProps {
  lane:     LaneState;
  dimmed:   boolean;
  compact:  boolean;
}

function Lane({ lane, dimmed, compact }: LaneProps) {
  const tokenLeft = `calc(${Math.min(lane.progress, 1) * 100}% - 1.4rem)`;
  const energyPct = Math.round(lane.energyLevel * 100);

  // CSS motion-state class applied to the token
  const tokenMotionClass =
    !compact && lane.motionState !== 'finished' && lane.motionState !== 'idle'
      ? `dspe__token--${lane.motionState}`
      : '';

  return (
    <div
      className={`dspe__lane${dimmed ? ' dspe__lane--dimmed' : ''}`}
      data-lane={lane.id}
    >
      {/* Lane header: label + warning badge */}
      <div className="dspe__lane-header">
        <span className="dspe__lane-label">{lane.label}</span>
        {lane.showConcurrentWarning && (
          <span className="dspe__warning-badge" role="status">
            On-demand hot water divides available output
          </span>
        )}
      </div>

      {/* Progress track */}
      <div
        className="dspe__progress-track"
        role="progressbar"
        aria-valuenow={Math.round(lane.progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${lane.label} progress`}
      >
        <div
          className={`dspe__progress-fill dspe__progress-fill--${lane.id}`}
          style={{ width: `${Math.min(lane.progress, 1) * 100}%` }}
        />
        <span
          className={`dspe__token${tokenMotionClass ? ` ${tokenMotionClass}` : ''}`}
          style={{ left: tokenLeft }}
          aria-hidden="true"
        >
          {VEHICLE_ICON[lane.id]}
        </span>
      </div>

      {/* Energy gauge */}
      <div className="dspe__gauge">
        <span className="dspe__gauge-icon" aria-hidden="true">
          {GAUGE_ICON[lane.id]}
        </span>
        <div className="dspe__gauge-track">
          <div
            className={`dspe__gauge-fill dspe__gauge-fill--${lane.id}`}
            style={{ width: `${energyPct}%` }}
          />
        </div>
        <span className="dspe__gauge-label" aria-label={`${energyPct}% energy remaining`}>
          {energyPct}%
        </span>
      </div>

      {/* Caption */}
      <p className="dspe__lane-caption">{lane.caption}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * DrivingStylePhysicsExplainer
 *
 * 4-lane race analogy explaining combi, system, Mixergy, and heat pump
 * behaviour.  Rendered as a collapsible-friendly self-contained card.
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

  // In compact / reduced-motion mode always show the final state.
  const phase = compact ? 'finish' : 'finish';

  const lanes = useMemo(
    () => buildDrivingStyleLaneStates(input, phase),
    [input, phase],
  );

  return (
    <section
      className={`dspe${compact ? ' dspe--compact' : ''}`}
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

      {/* 4-lane track */}
      <div className="dspe__track" role="list" aria-label="Heating system comparison lanes">
        {lanes.map((lane) => (
          <Lane
            key={lane.id}
            lane={lane}
            dimmed={systemFocus !== 'all' && lane.id !== systemFocus}
            compact={compact}
          />
        ))}
        {/* Finish-line rule */}
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
