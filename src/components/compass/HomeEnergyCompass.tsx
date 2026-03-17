/**
 * HomeEnergyCompass
 *
 * MVP compass visual: a single diagram that shows where the home currently
 * sits, where the recommended system moves it, and optional directional push
 * vectors for future energy opportunities (Solar PV, EV charging).
 *
 * Axes:
 *   North → Efficiency / low running cost
 *   East  → Electrification
 *   South → Low capital / minimal change
 *   West  → Energy independence
 *
 * Rules:
 *   - No Math.random() — all positions are deterministic (rule-based).
 *   - Degrades gracefully: renders a current-only compass when recommended is absent.
 *   - No animation in this MVP.
 */

import type { CompassState } from '../../lib/compass/buildCompassState';
import './HomeEnergyCompass.css';

// ─── Constants ────────────────────────────────────────────────────────────────

/** SVG viewport dimensions (square). */
const SVG_SIZE = 300;
const HALF = SVG_SIZE / 2;

/** Compass circle radius as a fraction of HALF. */
const RING_RADIUS = HALF * 0.78;

/** Converts a normalised [-1,1] coordinate to SVG pixel space. */
function toSvgX(x: number): number {
  return HALF + x * RING_RADIUS;
}
function toSvgY(y: number): number {
  // SVG y-axis is inverted: positive y = up in compass, down in SVG
  return HALF - y * RING_RADIUS;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MarkerProps {
  cx: number;
  cy: number;
  label: string | undefined;
  variant: 'current' | 'recommended' | 'opportunity';
}

function Marker({ cx, cy, label, variant }: MarkerProps) {
  const radius   = variant === 'opportunity' ? 5 : 8;
  const labelDy  = variant === 'opportunity' ? -10 : -13;

  return (
    <g className={`compass-marker compass-marker--${variant}`}>
      <circle cx={cx} cy={cy} r={radius} />
      {label != null && label !== '' && (
        <text
          x={cx}
          y={cy + labelDy}
          textAnchor="middle"
          className="compass-marker__label"
        >
          {label}
        </text>
      )}
    </g>
  );
}

interface OpportunityArrowProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  label: string | undefined;
}

function OpportunityArrow({ fromX, fromY, toX, toY, label }: OpportunityArrowProps) {
  // Shorten the line slightly so the arrowhead doesn't overlap the target marker.
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);
  const shorten = Math.min(12, len * 0.15);
  const ux = len > 0 ? dx / len : 0;
  const uy = len > 0 ? dy / len : 0;
  const x2 = toX - ux * shorten;
  const y2 = toY - uy * shorten;

  // Label offset perpendicular to the arrow direction.
  const midX = (fromX + x2) / 2;
  const midY = (fromY + y2) / 2;

  return (
    <g className="compass-opportunity-arrow">
      <line
        x1={fromX}
        y1={fromY}
        x2={x2}
        y2={y2}
        markerEnd="url(#arrow-head)"
      />
      {label != null && label !== '' && (
        <text
          x={midX}
          y={midY - 7}
          textAnchor="middle"
          className="compass-opportunity-arrow__label"
        >
          {label}
        </text>
      )}
    </g>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  compassState: CompassState;
}

export default function HomeEnergyCompass({ compassState }: Props) {
  const { current, recommended, opportunities } = compassState;

  const curX = toSvgX(current.x);
  const curY = toSvgY(current.y);

  const recX = recommended != null ? toSvgX(recommended.x) : null;
  const recY = recommended != null ? toSvgY(recommended.y) : null;

  return (
    <div className="home-energy-compass" aria-label="Home Energy Compass">
      <svg
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        width={SVG_SIZE}
        height={SVG_SIZE}
        role="img"
        aria-label="Home Energy Compass diagram"
        className="compass-svg"
      >
        <defs>
          {/* Arrow marker for opportunity vectors */}
          <marker
            id="arrow-head"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L8,3 z" className="compass-arrow-head" />
          </marker>
        </defs>

        {/* ── Background ring ─────────────────────────────────────────────── */}
        <circle
          cx={HALF}
          cy={HALF}
          r={RING_RADIUS}
          className="compass-ring"
        />

        {/* ── Cross-hairs ─────────────────────────────────────────────────── */}
        <line
          x1={HALF - RING_RADIUS}
          y1={HALF}
          x2={HALF + RING_RADIUS}
          y2={HALF}
          className="compass-axis"
        />
        <line
          x1={HALF}
          y1={HALF - RING_RADIUS}
          x2={HALF}
          y2={HALF + RING_RADIUS}
          className="compass-axis"
        />

        {/* ── Cardinal labels ──────────────────────────────────────────────── */}
        <text x={HALF}  y={14}             textAnchor="middle" className="compass-cardinal">N</text>
        <text x={HALF}  y={SVG_SIZE - 6}   textAnchor="middle" className="compass-cardinal">S</text>
        <text x={14}    y={HALF + 5}       textAnchor="middle" className="compass-cardinal">W</text>
        <text x={SVG_SIZE - 14} y={HALF + 5} textAnchor="middle" className="compass-cardinal">E</text>

        {/* ── Axis description labels ──────────────────────────────────────── */}
        <text x={HALF}  y={26}             textAnchor="middle" className="compass-axis-label">Efficiency</text>
        <text x={HALF}  y={SVG_SIZE - 16}  textAnchor="middle" className="compass-axis-label">Low capital</text>
        <text x={22}    y={HALF - 6}       textAnchor="middle" className="compass-axis-label compass-axis-label--rotated-w">Independence</text>
        <text x={SVG_SIZE - 22} y={HALF - 6} textAnchor="middle" className="compass-axis-label compass-axis-label--rotated-e">Electrification</text>

        {/* ── Opportunity arrows (drawn before markers so markers sit on top) */}
        {recommended != null && recX != null && recY != null &&
          opportunities.map((opp, i) => (
            <OpportunityArrow
              key={i}
              fromX={recX}
              fromY={recY}
              toX={toSvgX(opp.x)}
              toY={toSvgY(opp.y)}
              label={opp.label}
            />
          ))
        }

        {/* ── Path line: current → recommended ─────────────────────────────── */}
        {recommended != null && recX != null && recY != null && (
          <line
            x1={curX}
            y1={curY}
            x2={recX}
            y2={recY}
            className="compass-path-line"
            strokeDasharray="5 4"
          />
        )}

        {/* ── Opportunity markers ──────────────────────────────────────────── */}
        {opportunities.map((opp, i) => (
          <Marker
            key={i}
            cx={toSvgX(opp.x)}
            cy={toSvgY(opp.y)}
            label={opp.label}
            variant="opportunity"
          />
        ))}

        {/* ── Recommended marker ──────────────────────────────────────────── */}
        {recommended != null && recX != null && recY != null && (
          <Marker
            cx={recX}
            cy={recY}
            label="Recommended"
            variant="recommended"
          />
        )}

        {/* ── Current position marker ──────────────────────────────────────── */}
        <Marker
          cx={curX}
          cy={curY}
          label={current.label}
          variant="current"
        />
      </svg>

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div className="compass-legend" aria-label="Compass legend">
        <div className="compass-legend__item">
          <span className="compass-legend__dot compass-legend__dot--current" aria-hidden="true" />
          <span>You are here</span>
        </div>
        {recommended != null && (
          <div className="compass-legend__item">
            <span className="compass-legend__dot compass-legend__dot--recommended" aria-hidden="true" />
            <span>{recommended.label}</span>
          </div>
        )}
        {opportunities.map((opp, i) => (
          <div key={i} className="compass-legend__item">
            <span className="compass-legend__dot compass-legend__dot--opportunity" aria-hidden="true" />
            <span>{opp.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
