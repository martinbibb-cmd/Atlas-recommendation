/**
 * primitiveMotion.ts
 *
 * Canonical animation semantics for visual primitives.
 *
 * ─── Design rules ────────────────────────────────────────────────────────────
 * 1. ALL animations MUST respect `prefers-reduced-motion`.
 *    Every animation definition includes a `@media (prefers-reduced-motion: reduce)`
 *    override that removes keyframe motion.
 *
 * 2. Every animation is behind an opt-in boolean prop (e.g. `animateFlow`).
 *    Default is `false` so the static render path is NEVER broken.
 *
 * 3. CSS keyframe names are namespaced with the `atlas-` prefix to avoid
 *    collisions with other animation libraries.
 *
 * ─── Semantic catalogue ──────────────────────────────────────────────────────
 *
 * flowPulse
 *   Animates `stroke-dashoffset` on a pipe path to show fluid movement.
 *   Hot flow uses FLOW_COLOUR (red), return uses RETURN_COLOUR (blue).
 *   The "flow is moving" canonical semantic — use on any pipe line element.
 *
 * coolingTransition
 *   Animates a fill from TONE_FILL.hot (#fca5a5) to TONE_FILL.cool (#bfdbfe)
 *   over a configurable duration for radiator cool-down on heating lockout.
 *
 * drawOffPulse
 *   Short one-shot animation on the cylinder draw-off arrow stub to indicate
 *   hot water leaving the cylinder (DHW demand event).
 *
 * bypassActivation
 *   Brief highlight flash on ABVPrimitive's valve body + direction arrow
 *   when the bypass valve opens under high differential pressure.
 *
 * sludgeCaptureSettling
 *   Particle dots in MagneticFilterPrimitive animate toward the magnet core
 *   on first mount to communicate the capture mechanism.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { FLOW_PULSE_CLASS, injectPrimitiveMotionStyles } from '../primitiveMotion';
 *
 *   // In your app entry point or test setup (once):
 *   injectPrimitiveMotionStyles();
 *
 *   // On a pipe <line> or <path>:
 *   <line
 *     className={animateFlow ? FLOW_PULSE_CLASS.flow : undefined}
 *     strokeDasharray="20 10"
 *     strokeDashoffset={0}
 *   />
 */

import { FLOW_COLOUR, RETURN_COLOUR } from './primitiveTokens';

// ─── Keyframe animation CSS ────────────────────────────────────────────────────

const PRIMITIVE_MOTION_CSS = `
/* atlas-flowPulse ─ simulates fluid moving along a pipe ─────────────────── */
@keyframes atlas-flowPulse {
  from { stroke-dashoffset: 30; }
  to   { stroke-dashoffset: 0; }
}

/* atlas-coolingTransition ─ radiator cool-down fill shift ────────────────── */
@keyframes atlas-coolingTransition {
  0%   { fill: #fca5a5; }  /* TONE_FILL.hot  */
  100% { fill: #bfdbfe; }  /* TONE_FILL.cool */
}

/* atlas-drawOffPulse ─ one-shot cylinder draw-off highlight ─────────────── */
@keyframes atlas-drawOffPulse {
  0%   { opacity: 1; transform: scaleX(1);   }
  50%  { opacity: 1; transform: scaleX(1.3); }
  100% { opacity: 0; transform: scaleX(1);   }
}

/* atlas-bypassActivation ─ ABV valve body flash ─────────────────────────── */
@keyframes atlas-bypassActivation {
  0%   { fill-opacity: 1; }
  25%  { fill-opacity: 0.4; }
  75%  { fill-opacity: 0.4; }
  100% { fill-opacity: 1; }
}

/* atlas-sludgeSettle ─ particle dot settling toward magnet core ─────────── */
@keyframes atlas-sludgeSettle {
  0%   { transform: translateY(-12px); opacity: 0.8; }
  80%  { transform: translateY(0);     opacity: 1;   }
  100% { transform: translateY(0);     opacity: 1;   }
}

/* ─── Flow-pulse class variants ──────────────────────────────────────────── */

.atlas-flow-pulse-flow {
  stroke: ${FLOW_COLOUR};
  stroke-dasharray: 20 10;
  animation: atlas-flowPulse 1.2s linear infinite;
}

.atlas-flow-pulse-return {
  stroke: ${RETURN_COLOUR};
  stroke-dasharray: 20 10;
  animation: atlas-flowPulse 1.2s linear infinite reverse;
}

.atlas-cooling-transition {
  animation: atlas-coolingTransition 4s ease-in forwards;
}

.atlas-draw-off-pulse {
  animation: atlas-drawOffPulse 0.6s ease-out forwards;
}

.atlas-bypass-activation {
  animation: atlas-bypassActivation 0.4s ease-in-out;
}

.atlas-sludge-settle {
  animation: atlas-sludgeSettle 1s ease-out forwards;
}

/* ─── Reduced-motion overrides ───────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .atlas-flow-pulse-flow,
  .atlas-flow-pulse-return,
  .atlas-cooling-transition,
  .atlas-draw-off-pulse,
  .atlas-bypass-activation,
  .atlas-sludge-settle {
    animation: none !important;
  }
}
`;

// ─── Class name exports ────────────────────────────────────────────────────────

/** CSS class names for the flow-pulse animation. */
export const FLOW_PULSE_CLASS = {
  /** Apply to a hot-flow pipe `<line>` or `<path>` element. */
  flow: 'atlas-flow-pulse-flow',
  /** Apply to a return pipe `<line>` or `<path>` element. */
  return: 'atlas-flow-pulse-return',
} as const;

/** Apply to a radiator fill element to animate cool-down. */
export const COOLING_TRANSITION_CLASS = 'atlas-cooling-transition';

/** Apply to the cylinder draw-off arrow to animate a hot-water draw-off event. */
export const DRAW_OFF_PULSE_CLASS = 'atlas-draw-off-pulse';

/** Apply to the ABV valve body rect to animate a bypass activation event. */
export const BYPASS_ACTIVATION_CLASS = 'atlas-bypass-activation';

/** Apply to sludge particle dots in MagneticFilterPrimitive. */
export const SLUDGE_SETTLE_CLASS = 'atlas-sludge-settle';

// ─── Style injection ──────────────────────────────────────────────────────────

let _injected = false;

/**
 * Injects the primitive motion CSS keyframes into the document `<head>` once.
 *
 * Call this from your application entry point, or from a test setup file that
 * exercises animated primitives.  It is idempotent — calling it multiple times
 * is safe.
 *
 * In test environments without a real DOM (jsdom) this function is a no-op so
 * reduced-motion tests can rely on the CSS class names directly without the
 * stylesheet needing to be parsed.
 */
export function injectPrimitiveMotionStyles(): void {
  if (_injected) return;
  if (typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.setAttribute('data-atlas-primitive-motion', 'true');
  style.textContent = PRIMITIVE_MOTION_CSS;
  document.head.appendChild(style);
  _injected = true;
}

/**
 * Returns the raw CSS string for use in server-side rendering or test
 * assertions that need to inspect the keyframe definitions.
 */
export function getPrimitiveMotionCss(): string {
  return PRIMITIVE_MOTION_CSS;
}
