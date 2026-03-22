/**
 * ConvectionExplainer.tsx
 *
 * Interactive physics explainer: "Where does the heat actually go?"
 *
 * Three scenes show how household airflow patterns change with window and
 * door state, and how this affects comfort over time.
 *
 *   Scene 1 — windows_open:   warm air exits upstairs, cold air rushes in from below
 *   Scene 2 — closed_balanced: convection loops circulate and even out over time
 *   Scene 3 — doors_closed:  segmented zones, stable comfort per zone
 *
 * A time slider (0–120 minutes) lets users observe how each scene evolves.
 *
 * Visual rules (custom_instruction):
 *   Red   = warm air (higher opacity = higher velocity)
 *   Blue  = cool air (higher opacity = higher velocity)
 *   Arrow direction derived from scene vector field
 *
 * No engine data required — purely visual/physics layer.
 */

import { useState, useCallback, useId } from 'react';
import './ConvectionExplainer.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type SceneMode = 'windows_open' | 'closed_balanced' | 'doors_closed';

type LabelToggle = 'heat_loss' | 'airflow' | 'comfort';

// ─── Scene metadata ───────────────────────────────────────────────────────────

interface SceneMeta {
  mode:    SceneMode;
  label:   string;
  caption: string;
  tagline: string;
}

const SCENES: readonly SceneMeta[] = [
  {
    mode:    'windows_open',
    label:   'Windows open upstairs',
    caption: 'Open window = heat pulled out, cold pulled in',
    tagline: 'Warm air leaves upstairs… and that pulls cold air in from below',
  },
  {
    mode:    'closed_balanced',
    label:   'House closed',
    caption: 'Closed house = heat circulates and balances',
    tagline: 'Now the heat stays in… and the house evens itself out over time',
  },
  {
    mode:    'doors_closed',
    label:   'Doors closed',
    caption: 'Close doors = control where the heat stays',
    tagline: 'By closing doors, you stop the airflow loop… and keep heat where you want it',
  },
] as const;

// ─── Physics constants ────────────────────────────────────────────────────────

/**
 * Time constant (τ) for whole-house temperature equalisation when all windows
 * and doors are closed.  At τ = 40 min, the house is ~63 % balanced; by 2τ
 * (80 min) it is ~86 % balanced — matching typical mid-terrace observations.
 */
const TAU_CLOSED_BALANCE_MINS = 40;

/**
 * Time constant (τ) for per-zone stabilisation when internal doors are closed.
 * Zones balance faster (25 min) because inter-zone airflow is restricted to
 * the small gap under doors, reducing the effective mixing volume.
 */
const TAU_DOORS_CLOSED_MINS = 25;

// ─── Physics helpers ──────────────────────────────────────────────────────────

/**
 * Compute a 0–1 heat-loss intensity for the windows_open scene.
 * A linear model is used here: the stack-effect driving force (temperature
 * difference between inside and outside) stays approximately constant while
 * the window is open, so heat flux is roughly constant and loss accumulates
 * linearly with time.  (By contrast, the closed-house scenes use exponential
 * decay because the driving force diminishes as temperatures equalise.)
 */
function windowsOpenLoss(timeMins: number): number {
  return Math.min(1, timeMins / 60);
}

/**
 * Compute a temperature-balance fraction for the closed_balanced scene.
 * Uses an exponential decay: variance decays toward zero as the house evens out.
 * τ = TAU_CLOSED_BALANCE_MINS → roughly balanced by 80–90 min.
 */
function closedBalanceFrac(timeMins: number): number {
  return 1 - Math.exp(-timeMins / TAU_CLOSED_BALANCE_MINS);
}

/**
 * Compute a zone-stability fraction for the doors_closed scene.
 * Zones stabilise faster (τ = TAU_DOORS_CLOSED_MINS) because inter-zone
 * flow is restricted to door-gap leakage only.
 */
function doorsClosedStabilityFrac(timeMins: number): number {
  return 1 - Math.exp(-timeMins / TAU_DOORS_CLOSED_MINS);
}

// ─── SVG arrow helpers ────────────────────────────────────────────────────────

interface ArrowProps {
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
  opacity: number;
  /** Arrow head size in px */
  headSize?: number;
}

function Arrow({ x1, y1, x2, y2, color, opacity, headSize = 7 }: ArrowProps) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;

  const ux = dx / len;
  const uy = dy / len;

  // Shorten the line by the arrowhead length so it doesn't overlap
  const ex = x2 - ux * headSize;
  const ey = y2 - uy * headSize;

  // Perpendicular unit vector for arrowhead wings
  const px = -uy;
  const py = ux;

  const tipPoints = [
    `${x2},${y2}`,
    `${ex + px * (headSize * 0.45)},${ey + py * (headSize * 0.45)}`,
    `${ex - px * (headSize * 0.45)},${ey - py * (headSize * 0.45)}`,
  ].join(' ');

  return (
    <g opacity={opacity}>
      <line
        x1={x1} y1={y1}
        x2={ex}  y2={ey}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <polygon
        points={tipPoints}
        fill={color}
      />
    </g>
  );
}

// ─── House cross-section SVG ──────────────────────────────────────────────────

/**
 * Shared house outline — a simple two-storey house cross-section in SVG.
 * ViewBox: 0 0 200 200
 *
 * Layout zones:
 *   Roof:        y  0–40   (triangle, apex at 100,5)
 *   Upper floor: y 40–110  (upstairs room)
 *   Lower floor: y 110–190 (downstairs room)
 *   Ground:      y 190–200 (basement/floor line)
 *
 * Internal elements passed as children are rendered on top.
 */
interface HouseProps {
  showWindow: boolean;  // upstairs window open indicator
  showDoor:   boolean;  // internal door closed indicator
  children?:  React.ReactNode;
}

function HouseCrossSection({ showWindow, showDoor, children }: HouseProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      className="cex__house-svg"
      aria-hidden="true"
      focusable="false"
      role="img"
    >
      {/* ── Roof ───────────────────────────────────────────────── */}
      <polygon
        points="100,5 10,55 190,55"
        className="cex__house-roof"
      />

      {/* ── Walls ──────────────────────────────────────────────── */}
      {/* Outer wall outline */}
      <rect x="20" y="55" width="160" height="135" className="cex__house-wall" />

      {/* ── Upper floor separator ──────────────────────────────── */}
      <line x1="20" y1="110" x2="180" y2="110" className="cex__house-floor-line" />

      {/* ── Staircase placeholder (right side) ─────────────────── */}
      <rect x="140" y="112" width="20" height="38" className="cex__house-stairs" />
      <line x1="140" y1="120" x2="160" y2="120" className="cex__house-stair-step" />
      <line x1="140" y1="128" x2="160" y2="128" className="cex__house-stair-step" />
      <line x1="140" y1="136" x2="160" y2="136" className="cex__house-stair-step" />
      <line x1="140" y1="144" x2="160" y2="144" className="cex__house-stair-step" />

      {/* ── Internal door (lower floor, centre) ─────────────────── */}
      {showDoor ? (
        /* Closed door — drawn as a filled rectangle */
        <rect x="88" y="115" width="24" height="35" className="cex__house-door cex__house-door--closed" />
      ) : (
        /* Open door — drawn as an open frame only */
        <>
          <line x1="88"  y1="115" x2="88"  y2="150" className="cex__house-door-frame" />
          <line x1="112" y1="115" x2="112" y2="150" className="cex__house-door-frame" />
        </>
      )}

      {/* ── Upstairs window ──────────────────────────────────────── */}
      <rect x="130" y="65" width="30" height="22" className={`cex__house-window ${showWindow ? 'cex__house-window--open' : ''}`} />
      {showWindow && (
        /* Open sash indicator — top pane shifted down */
        <rect x="130" y="75" width="30" height="10" className="cex__house-window-sash" />
      )}

      {/* ── Downstairs window (always closed, reference) ─────────── */}
      <rect x="40" y="125" width="30" height="22" className="cex__house-window" />

      {/* ── Zone temperature overlays / arrows ─────────────────────── */}
      {children}

      {/* ── Ground line ─────────────────────────────────────────────── */}
      <line x1="0" y1="190" x2="200" y2="190" className="cex__house-ground" />

      {/* ── Zone labels ──────────────────────────────────────────────── */}
      <text x="60"  y="90"  className="cex__zone-label">Upstairs</text>
      <text x="55"  y="165" className="cex__zone-label">Downstairs</text>
    </svg>
  );
}

// ─── Scene renderers ──────────────────────────────────────────────────────────

/**
 * Render airflow arrows for the windows_open scene.
 * Strong upward red exit at the window; aggressive blue inflow at ground level.
 */
function WindowsOpenArrows({ timeMins, showAirflow }: { timeMins: number; showAirflow: boolean }) {
  if (!showAirflow) return null;
  const loss = windowsOpenLoss(timeMins);
  const base = 0.35 + loss * 0.55;

  return (
    <g className="cex__arrows">
      {/* ── Warm air exiting upstairs window ───────────────────────────── */}
      <Arrow x1={145} y1={80}  x2={165} y2={65}  color="var(--cex-warm)" opacity={base}        />
      <Arrow x1={145} y1={85}  x2={170} y2={72}  color="var(--cex-warm)" opacity={base * 0.8}  />
      <Arrow x1={145} y1={90}  x2={168} y2={80}  color="var(--cex-warm)" opacity={base * 0.65} />

      {/* ── Rising warm air column (staircase) ─────────────────────────── */}
      <Arrow x1={150} y1={140} x2={150} y2={115} color="var(--cex-warm)" opacity={base * 0.75} />
      <Arrow x1={155} y1={145} x2={155} y2={120} color="var(--cex-warm)" opacity={base * 0.6}  />

      {/* ── Cold air rushing in downstairs ──────────────────────────────── */}
      <Arrow x1={25}  y1={175} x2={40}  y2={160} color="var(--cex-cool)" opacity={base * 0.9}  />
      <Arrow x1={30}  y1={180} x2={50}  y2={165} color="var(--cex-cool)" opacity={base * 0.75} />

      {/* ── Cold air moving up the stairs ───────────────────────────────── */}
      <Arrow x1={145} y1={155} x2={145} y2={130} color="var(--cex-cool)" opacity={base * 0.7}  />
      <Arrow x1={150} y1={162} x2={150} y2={138} color="var(--cex-cool)" opacity={base * 0.55} />
    </g>
  );
}

/**
 * Render convection loop arrows for the closed_balanced scene.
 * Circular loops, warm up + cool down, decaying toward steady state.
 */
function ClosedBalancedArrows({ timeMins, showAirflow }: { timeMins: number; showAirflow: boolean }) {
  if (!showAirflow) return null;
  const bal = closedBalanceFrac(timeMins);
  // Airflow velocity decays as the house balances
  const vel = 0.8 - bal * 0.5;

  return (
    <g className="cex__arrows">
      {/* ── Upper floor convection loop ──────────────────────────────── */}
      <Arrow x1={50}  y1={90}  x2={50}  y2={65}  color="var(--cex-warm)" opacity={vel}        />
      <Arrow x1={55}  y1={62}  x2={95}  y2={62}  color="var(--cex-warm)" opacity={vel * 0.85} />
      <Arrow x1={100} y1={65}  x2={100} y2={90}  color="var(--cex-cool)" opacity={vel * 0.8}  />
      <Arrow x1={95}  y1={93}  x2={55}  y2={93}  color="var(--cex-cool)" opacity={vel * 0.7}  />

      {/* ── Lower floor convection loop ──────────────────────────────── */}
      <Arrow x1={50}  y1={165} x2={50}  y2={140} color="var(--cex-warm)" opacity={vel * 0.9}  />
      <Arrow x1={55}  y1={138} x2={95}  y2={138} color="var(--cex-warm)" opacity={vel * 0.75} />
      <Arrow x1={100} y1={140} x2={100} y2={165} color="var(--cex-cool)" opacity={vel * 0.7}  />
      <Arrow x1={95}  y1={167} x2={55}  y2={167} color="var(--cex-cool)" opacity={vel * 0.6}  />

      {/* ── Inter-floor exchange (staircase) ──────────────────────────── */}
      <Arrow x1={148} y1={120} x2={148} y2={108} color="var(--cex-warm)" opacity={vel * 0.65} />
      <Arrow x1={155} y1={112} x2={155} y2={125} color="var(--cex-cool)" opacity={vel * 0.55} />
    </g>
  );
}

/**
 * Render segmented zone arrows for the doors_closed scene.
 * Contained loops per zone; minimal staircase flow.
 */
function DoorsClosedArrows({ timeMins, showAirflow }: { timeMins: number; showAirflow: boolean }) {
  if (!showAirflow) return null;
  const stab = doorsClosedStabilityFrac(timeMins);
  const vel  = 0.65 - stab * 0.35;

  return (
    <g className="cex__arrows">
      {/* ── Upstairs zone — small contained loop ───────────────────────── */}
      <Arrow x1={50}  y1={90}  x2={50}  y2={68}  color="var(--cex-warm)" opacity={vel * 0.9}  />
      <Arrow x1={55}  y1={65}  x2={85}  y2={65}  color="var(--cex-warm)" opacity={vel * 0.75} />
      <Arrow x1={90}  y1={68}  x2={90}  y2={90}  color="var(--cex-cool)" opacity={vel * 0.7}  />
      <Arrow x1={85}  y1={93}  x2={55}  y2={93}  color="var(--cex-cool)" opacity={vel * 0.6}  />

      {/* ── Downstairs zone — small contained loop ─────────────────────── */}
      <Arrow x1={40}  y1={162} x2={40}  y2={140} color="var(--cex-warm)" opacity={vel * 0.9}  />
      <Arrow x1={45}  y1={137} x2={80}  y2={137} color="var(--cex-warm)" opacity={vel * 0.75} />
      <Arrow x1={85}  y1={140} x2={85}  y2={162} color="var(--cex-cool)" opacity={vel * 0.7}  />
      <Arrow x1={80}  y1={165} x2={45}  y2={165} color="var(--cex-cool)" opacity={vel * 0.6}  />

      {/* ── Minimal staircase exchange (door buffer effect) ─────────────── */}
      <Arrow x1={148} y1={118} x2={148} y2={112} color="var(--cex-warm)" opacity={vel * 0.3}  />
    </g>
  );
}

// ─── Temperature gradient overlay ────────────────────────────────────────────

/**
 * SVG gradient rectangles overlaid on each floor zone to indicate temperature.
 * Opacity and hue shift are driven by scene + time.
 */
interface GradientOverlayProps {
  mode:     SceneMode;
  timeMins: number;
  show:     boolean;
}

function TemperatureGradientOverlay({ mode, timeMins, show }: GradientOverlayProps) {
  if (!show) return null;

  let upperOpacity = 0.18;
  let lowerOpacity = 0.10;
  let upperColor   = 'var(--cex-warm)';
  let lowerColor   = 'var(--cex-cool)';

  if (mode === 'windows_open') {
    const loss = windowsOpenLoss(timeMins);
    // Upper zone cools (warm exits); lower zone stays cold (cold influx)
    upperOpacity = 0.18 - loss * 0.14;
    lowerOpacity = 0.10 + loss * 0.08;
    upperColor   = 'var(--cex-warm)';
    lowerColor   = 'var(--cex-cool)';
  } else if (mode === 'closed_balanced') {
    const bal = closedBalanceFrac(timeMins);
    // Upper zone gradually approaches neutral; lower zone warms toward neutral
    upperOpacity = 0.20 - bal * 0.10;
    lowerOpacity = 0.10 + bal * 0.08;
    upperColor   = 'var(--cex-warm)';
    lowerColor   = 'var(--cex-warm)';
  } else {
    // doors_closed: each zone stabilises quickly
    const stab = doorsClosedStabilityFrac(timeMins);
    upperOpacity = 0.14 - stab * 0.05;
    lowerOpacity = 0.18 - stab * 0.05;
    upperColor   = 'var(--cex-warm)';
    lowerColor   = 'var(--cex-warm)';
  }

  return (
    <g className="cex__gradient-overlay">
      {/* Upper floor zone */}
      <rect
        x="20" y="56" width="160" height="54"
        fill={upperColor}
        opacity={upperOpacity}
        rx="2"
      />
      {/* Lower floor zone */}
      <rect
        x="20" y="110" width="160" height="80"
        fill={lowerColor}
        opacity={lowerOpacity}
        rx="2"
      />
    </g>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * ConvectionExplainer
 *
 * Interactive three-scene airflow explainer.
 * Scenes are selected via tab buttons; a time slider (0–120 min) animates
 * the physics behaviour over time for the active scene.
 * Toggle buttons surface "Heat loss", "Airflow", and "Comfort" overlays.
 */
export default function ConvectionExplainer() {
  const [mode, setMode]       = useState<SceneMode>('windows_open');
  const [timeMins, setTime]   = useState(0);
  const [labels, setLabels]   = useState<Set<LabelToggle>>(new Set(['airflow']));
  const sliderId              = useId();

  const activeMeta = SCENES.find(s => s.mode === mode) ?? SCENES[0];

  const handleToggleLabel = useCallback((lbl: LabelToggle) => {
    setLabels(prev => {
      const next = new Set(prev);
      if (next.has(lbl)) {
        next.delete(lbl);
      } else {
        next.add(lbl);
      }
      return next;
    });
  }, []);

  const showAirflow  = labels.has('airflow');
  const showHeatLoss = labels.has('heat_loss');
  const showComfort  = labels.has('comfort');

  return (
    <section className="cex" aria-labelledby="cex-title">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="cex__header">
        <h3 id="cex-title" className="cex__title">
          Where does the heat actually go?
        </h3>
        <p className="cex__subtitle">
          Heat doesn&rsquo;t just rise — air moves in loops
        </p>
      </div>

      {/* ── Scene selector tabs ──────────────────────────────────────────── */}
      <div className="cex__scene-tabs" role="tablist" aria-label="Scene selector">
        {SCENES.map((scene) => (
          <button
            key={scene.mode}
            role="tab"
            type="button"
            aria-selected={mode === scene.mode}
            className={`cex__scene-tab${mode === scene.mode ? ' cex__scene-tab--active' : ''}`}
            onClick={() => { setMode(scene.mode); setTime(0); }}
          >
            {scene.label}
          </button>
        ))}
      </div>

      {/* ── Visualisation ───────────────────────────────────────────────── */}
      <div
        className="cex__visual"
        role="tabpanel"
        aria-label={activeMeta.label}
      >
        <HouseCrossSection
          showWindow={mode === 'windows_open'}
          showDoor={mode === 'doors_closed'}
        >
          {/* Temperature gradient overlay */}
          <TemperatureGradientOverlay
            mode={mode}
            timeMins={timeMins}
            show={showComfort || showHeatLoss}
          />

          {/* Airflow arrows — scene-specific */}
          {mode === 'windows_open'   && <WindowsOpenArrows    timeMins={timeMins} showAirflow={showAirflow} />}
          {mode === 'closed_balanced' && <ClosedBalancedArrows timeMins={timeMins} showAirflow={showAirflow} />}
          {mode === 'doors_closed'    && <DoorsClosedArrows    timeMins={timeMins} showAirflow={showAirflow} />}

          {/* Heat-loss indicator for windows_open */}
          {mode === 'windows_open' && showHeatLoss && (
            <text x="100" y="48" className="cex__heat-loss-label">
              ↑ heat escaping
            </text>
          )}
        </HouseCrossSection>
      </div>

      {/* ── Caption ─────────────────────────────────────────────────────── */}
      <p className="cex__caption" aria-live="polite">
        {activeMeta.caption}
      </p>

      {/* ── Time slider ─────────────────────────────────────────────────── */}
      <div className="cex__time-slider">
        <label htmlFor={sliderId} className="cex__time-label">
          Time: <strong>{timeMins} min</strong>
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={120}
          step={5}
          value={timeMins}
          onChange={(e) => setTime(Number(e.target.value))}
          className="cex__slider"
          aria-label="Elapsed time in minutes"
        />
        <div className="cex__time-endpoints" aria-hidden="true">
          <span>0 min</span>
          <span>2 hours</span>
        </div>
      </div>

      {/* ── Toggle labels ────────────────────────────────────────────────── */}
      <div className="cex__toggles" role="group" aria-label="Show overlays">
        {(
          [
            { id: 'airflow',   icon: '💨', text: 'Airflow' },
            { id: 'heat_loss', icon: '🌡️', text: 'Heat loss' },
            { id: 'comfort',   icon: '🛋️', text: 'Comfort' },
          ] as { id: LabelToggle; icon: string; text: string }[]
        ).map(({ id, icon, text }) => (
          <button
            key={id}
            type="button"
            className={`cex__toggle-btn${labels.has(id) ? ' cex__toggle-btn--active' : ''}`}
            aria-pressed={labels.has(id)}
            onClick={() => handleToggleLabel(id)}
          >
            <span aria-hidden="true">{icon}</span> {text}
          </button>
        ))}
      </div>

      {/* ── Tagline ──────────────────────────────────────────────────────── */}
      <p className="cex__tagline" aria-live="polite">
        {activeMeta.tagline}
      </p>

    </section>
  );
}
