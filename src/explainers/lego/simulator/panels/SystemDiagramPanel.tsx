/**
 * SystemDiagramPanel — live animated schematic for the System Diagram panel.
 *
 * Driven by SystemDiagramDisplayState from useSystemDiagramPlayback.
 * Falls back to a static (idle) appearance when no state is provided.
 *
 * Active-path rules derived from service-arbitration truth:
 *  - CH flow/return: active during 'heating' or 'heating_and_reheat',
 *    faded (not hidden) when serviceSwitchingActive (combi DHW draw).
 *  - Combi DHW path (boiler→outlets): active during systemMode 'dhw_draw'.
 *  - Primary/reheat path (boiler→cylinder): active during 'dhw_reheat'
 *    or 'heating_and_reheat' (stored only).
 *  - Stored hot draw path (cylinder→outlets): active when hotDrawActive is
 *    true (stored systems only — distinct from systemMode 'dhw_draw' which is
 *    combi-specific).
 *  - Cold supply: active during any draw.
 *
 * Visual language:
 *  - Rounded component cards, domain-colour regions, visible ports.
 *  - Subtle grid background.
 *  - sd-pipe--active: marching-ants stroke animation.
 *  - sd-pipe--inactive: faded (combi CH when DHW draw suppresses it).
 *  - Callout badges for CH active / DHW active / Reheat / Capacity.
 */

import type { SystemDiagramDisplayState } from '../useSystemDiagramPlayback';
import type { ReactElement } from 'react';

interface Props {
  /** Live playback state. When absent the diagram renders in static idle mode. */
  state?: SystemDiagramDisplayState;
}

// ─── Active-path derivation ───────────────────────────────────────────────────

type ActivePaths = {
  chFlow: boolean;
  chFaded: boolean;         // CH visible but suppressed (combi DHW draw)
  comboDhw: boolean;        // combi: boiler → outlets path
  primaryReheat: boolean;   // stored: boiler → cylinder coil path
  storedHotDraw: boolean;   // stored: cylinder → outlets path
  coldSupply: boolean;      // cold water moving
}

function deriveActivePaths(state: SystemDiagramDisplayState): ActivePaths {
  const { systemMode, systemType, serviceSwitchingActive, hotDrawActive } = state;
  const isCombi = systemType === 'combi';

  const chHeating =
    systemMode === 'heating' || systemMode === 'heating_and_reheat';

  return {
    chFlow:         chHeating && !serviceSwitchingActive,
    chFaded:        serviceSwitchingActive,
    comboDhw:       isCombi && systemMode === 'dhw_draw',
    primaryReheat:  !isCombi && (systemMode === 'dhw_reheat' || systemMode === 'heating_and_reheat'),
    storedHotDraw:  !isCombi && hotDrawActive,
    coldSupply:     systemMode === 'dhw_draw' || (!isCombi && hotDrawActive),
  };
}

const IDLE_PATHS: ActivePaths = {
  chFlow: false, chFaded: false, comboDhw: false,
  primaryReheat: false, storedHotDraw: false, coldSupply: false,
};

// ─── Pipe class helper ────────────────────────────────────────────────────────

/**
 * Combine base pipe class with active/faded/inactive state classes.
 * The `baseColour` classes (sd-pipe--flow, sd-pipe--return, etc.) provide
 * the stroke colour; state classes layer on top.
 */
function pipeClass(
  base: string,
  active: boolean,
  faded: boolean = false,
): string {
  if (active) return `sd-pipe ${base} sd-pipe--active`;
  if (faded)  return `sd-pipe ${base} sd-pipe--faded`;
  return `sd-pipe ${base} sd-pipe--inactive`;
}

// ─── Callout badge helpers ────────────────────────────────────────────────────

/** Estimated pixel width per character for the badge text at 7 px font size. */
const BADGE_CHAR_WIDTH_ESTIMATE = 5.5
/** Horizontal padding (total, both sides) inside the badge rect. */
const BADGE_PADDING = 10

type BadgeSpec = { label: string; x: number; y: number; variant: string };

function deriveBadges(
  state: SystemDiagramDisplayState,
  paths: ActivePaths,
): BadgeSpec[] {
  const badges: BadgeSpec[] = [];
  const isCombi = state.systemType === 'combi';

  if (paths.chFlow) {
    badges.push({ label: 'CH active', x: 128, y: 8, variant: 'heating' });
  }
  if (paths.comboDhw) {
    badges.push({ label: 'On-demand hot water', x: 49, y: 128, variant: 'dhw' });
  }
  if (state.serviceSwitchingActive) {
    badges.push({ label: 'CH paused', x: 128, y: 8, variant: 'warning' });
  }
  if (paths.storedHotDraw && !isCombi) {
    badges.push({ label: 'DHW active', x: 186, y: 128, variant: 'dhw' });
  }
  if (paths.primaryReheat) {
    badges.push({ label: 'Cylinder reheat', x: 126, y: 128, variant: 'reheat' });
  }

  return badges;
}

function BadgeGroup({ badges }: { badges: BadgeSpec[] }): ReactElement {
  return (
    <g aria-label="Status callouts">
      {badges.map((b, i) => {
        const labelW = b.label.length * BADGE_CHAR_WIDTH_ESTIMATE + BADGE_PADDING;
        return (
          <g key={i} transform={`translate(${b.x - labelW / 2},${b.y})`}>
            <rect
              className={`sd-callout sd-callout--${b.variant}`}
              x={0} y={0}
              width={labelW}
              height={13}
              rx={4} ry={4}
            />
            <text className="sd-callout__text" x={labelW / 2} y={9}>
              {b.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SystemDiagramPanel({ state }: Props) {
  const W = 320;
  const H = 210;
  const isCombi = !state || state.systemType === 'combi';
  const paths: ActivePaths = state ? deriveActivePaths(state) : IDLE_PATHS;
  const badges: BadgeSpec[] = state ? deriveBadges(state, paths) : [];

  // Grid
  const gridLines: ReactElement[] = [];
  for (let x = 0; x <= W; x += 20) {
    gridLines.push(<line key={`gx${x}`} className="sd-grid-line" x1={x} y1={0} x2={x} y2={H} />);
  }
  for (let y = 0; y <= H; y += 20) {
    gridLines.push(<line key={`gy${y}`} className="sd-grid-line" x1={0} y1={y} x2={W} y2={y} />);
  }

  // Boiler sub-label differs by system type
  const boilerSubLabel = isCombi ? '30 kW combi' : '24 kW boiler';

  // Cylinder label: combi uses "Plate HEX", stored uses "Cylinder"
  const cylinderLabel  = isCombi ? '💧 Plate HEX' : '🛢 Cylinder';
  const cylinderSub    = isCombi ? 'On-demand DHW' : 'Stored HW';

  // Condensing badge text
  const condensingBadgeText: string | null =
    state?.condensingState === 'condensing'     ? '🟢 Condensing'     :
    state?.condensingState === 'borderline'     ? '🟡 Borderline'     :
    state?.condensingState === 'not_condensing' ? '🔴 Not condensing' :
    null;

  return (
    <div className="system-diagram" data-testid="system-diagram-panel">
      <svg
        className="system-diagram__svg"
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Heating system schematic"
        role="img"
      >
        {/* Grid */}
        <g aria-hidden="true">{gridLines}</g>

        {/* Domain backgrounds */}
        <rect className="sd-domain sd-domain--heating" x={4}   y={4}   width={90}  height={120} />
        <rect className="sd-domain sd-domain--water"   x={200} y={4}   width={116} height={120} />
        <rect className="sd-domain sd-domain--dhw"     x={4}   y={136} width={312} height={66}  />

        {/* ── Boiler ──────────────────────────────────────────────────────── */}
        <rect className="sd-node sd-node--boiler" x={14}  y={16} width={70} height={46} />
        <text className="sd-label"    x={49} y={33}>🔥 Boiler</text>
        <text className="sd-sublabel" x={49} y={48}>{boilerSubLabel}</text>
        {/* Port: CH flow out (right) */}
        <circle className="sd-port sd-port--hot"  cx={84}  cy={28} r={3} />
        {/* Port: CH return in (right) */}
        <circle className="sd-port sd-port--cold" cx={84}  cy={52} r={3} />
        {/* Port: DHW / primary out (bottom) */}
        <circle className="sd-port sd-port--dhw"  cx={49}  cy={62} r={3} />
        {/* Port: cold in (left) */}
        <circle className="sd-port sd-port--cold" cx={14}  cy={39} r={3} />

        {/* Condensing badge — overlays boiler node */}
        {condensingBadgeText && (
          <g transform="translate(8,62)">
            <rect className="sd-callout sd-callout--condensing" x={0} y={0} width={82} height={12} rx={3} ry={3} />
            <text className="sd-callout__text" x={41} y={8.5}>{condensingBadgeText}</text>
          </g>
        )}

        {/* ── Pump ────────────────────────────────────────────────────────── */}
        <rect className="sd-node sd-node--pump" x={104} y={16} width={48} height={36} />
        <text className="sd-label"    x={128} y={31}>⚙ Pump</text>
        <text className="sd-sublabel" x={128} y={44}>CH circuit</text>
        <circle className="sd-port sd-port--hot"  cx={104} cy={28} r={3} />
        <circle className="sd-port sd-port--hot"  cx={152} cy={28} r={3} />

        {/* ── Zone valve ──────────────────────────────────────────────────── */}
        <rect className="sd-node sd-node--valve" x={104} y={66} width={48} height={34} />
        <text className="sd-label"    x={128} y={79}>⊘ Valve</text>
        <text className="sd-sublabel" x={128} y={91}>Zone 1</text>
        <circle className="sd-port sd-port--hot"  cx={104} cy={78} r={3} />
        <circle className="sd-port sd-port--hot"  cx={152} cy={78} r={3} />

        {/* ── Radiator ────────────────────────────────────────────────────── */}
        <rect className="sd-node sd-node--radiator" x={174} y={16} width={60} height={42} />
        <text className="sd-label"    x={204} y={32}>⊟ Rads</text>
        <text className="sd-sublabel" x={204} y={46}>6 radiators</text>
        <circle className="sd-port sd-port--hot"  cx={174} cy={26} r={3} />
        <circle className="sd-port sd-port--cold" cx={174} cy={46} r={3} />

        {/* ── Expansion vessel ────────────────────────────────────────────── */}
        <rect className="sd-node sd-node--mains" x={250} y={16} width={58} height={36} />
        <text className="sd-label"    x={279} y={31}>⊕ Exp.</text>
        <text className="sd-sublabel" x={279} y={44}>vessel</text>

        {/* ── Cylinder / Plate HEX ────────────────────────────────────────── */}
        {/*
         * This node serves dual purpose:
         *   - Combi: represents the plate heat exchanger (DHW on demand, no store).
         *   - Stored: represents the hot-water cylinder (thermal store).
         * The label and sub-label are driven by isCombi.
         */}
        <rect className="sd-node sd-node--cylinder" x={210} y={72} width={64} height={46} />
        <text className="sd-label"    x={242} y={88}>{cylinderLabel}</text>
        <text className="sd-sublabel" x={242} y={103}>{cylinderSub}</text>
        {/* Port: primary/coil in (left) */}
        <circle className="sd-port sd-port--dhw"  cx={210} cy={84} r={3} />
        {/* Port: cold replenishment in (right) */}
        <circle className="sd-port sd-port--cold" cx={274} cy={84} r={3} />
        {/* Port: stored hot out (bottom, stored systems only) */}
        {!isCombi && (
          <circle className="sd-port sd-port--dhw" cx={242} cy={118} r={3} />
        )}

        {/* ── Cylinder fill indicator (stored only) ───────────────────────── */}
        {!isCombi && state?.cylinderFillPct !== undefined && (
          <rect
            className="sd-cylinder-fill"
            x={212}
            y={72 + 44 * (1 - state.cylinderFillPct)}
            width={60}
            height={44 * state.cylinderFillPct}
            rx={6}
          />
        )}

        {/* ── Outlets row (bottom) ────────────────────────────────────────── */}
        {/* Shower */}
        <rect className="sd-node sd-node--outlet" x={14}  y={144} width={56} height={32} />
        <text className="sd-label"    x={42} y={157}>🚿 Shower</text>
        <text className="sd-sublabel" x={42} y={168}>
          {paths.comboDhw || paths.storedHotDraw ? 'running' : 'idle'}
        </text>
        <circle className="sd-port sd-port--dhw"  cx={42} cy={144} r={3} />

        {/* Bath */}
        <rect className="sd-node sd-node--outlet" x={82}  y={144} width={56} height={32} />
        <text className="sd-label"    x={110} y={157}>🛁 Bath</text>
        <text className="sd-sublabel" x={110} y={168}>idle</text>
        <circle className="sd-port sd-port--dhw"  cx={110} cy={144} r={3} />

        {/* Kitchen tap */}
        <rect className="sd-node sd-node--outlet" x={150} y={144} width={72} height={32} />
        <text className="sd-label"    x={186} y={157}>🚰 Kitchen</text>
        <text className="sd-sublabel" x={186} y={168}>idle</text>
        <circle className="sd-port sd-port--dhw"  cx={186} cy={144} r={3} />

        {/* Mains cold supply */}
        <rect className="sd-node sd-node--mains" x={238} y={144} width={74} height={32} />
        <text className="sd-label"    x={275} y={157}>❄ Mains</text>
        <text className="sd-sublabel" x={275} y={168}>cold supply</text>
        <circle className="sd-port sd-port--cold" cx={238} cy={158} r={3} />

        {/* ── Pipes ────────────────────────────────────────────────────────── */}
        {/*
         * CH flow manifold:
         * Boiler flow port (84,28) → tee at (96,28) → pump (104,28) and zone valve (104,78)
         */}

        {/* Boiler flow → tee */}
        <polyline
          className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)}
          data-testid="pipe-ch-flow-boiler-tee"
          points="84,28 96,28"
        />
        {/* Tee → pump */}
        <polyline
          className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)}
          data-testid="pipe-ch-flow-tee-pump"
          points="96,28 104,28"
        />
        {/* Tee → zone valve */}
        <polyline
          className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)}
          points="96,28 96,78 104,78"
        />
        {/* Pump → rads */}
        <polyline
          className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)}
          data-testid="pipe-ch-flow-pump-rads"
          points="152,28 174,28"
        />
        {/* Rads return → boiler return port */}
        <polyline
          className={pipeClass('sd-pipe--return', paths.chFlow, paths.chFaded)}
          data-testid="pipe-ch-return"
          points="174,46 164,46 164,58 84,58 84,52"
        />
        {/* Zone valve → rads */}
        <polyline
          className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)}
          points="152,78 166,78 166,32 174,32"
        />

        {/*
         * Primary / DHW path (boiler DHW port → cylinder):
         *   - Combi: active during dhw_draw (this IS the DHW path)
         *   - Stored: active during dhw_reheat / heating_and_reheat (primary circuit)
         */}
        <polyline
          className={pipeClass('sd-pipe--dhw',
            paths.comboDhw || paths.primaryReheat,
          )}
          data-testid="pipe-primary-dhw"
          points="49,62 49,136 126,136 126,90 210,90"
        />

        {/*
         * Stored hot draw path: cylinder bottom → DHW manifold → outlets.
         * Only rendered for stored systems; in combi the boiler→outlets path
         * serves this role (comboDhw above).
         */}
        {!isCombi && (
          <polyline
            className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)}
            data-testid="pipe-stored-hot-draw"
            points="242,118 242,136"
          />
        )}

        {/* DHW manifold → shower outlet */}
        <polyline
          className={pipeClass('sd-pipe--dhw', paths.comboDhw || paths.storedHotDraw)}
          data-testid="pipe-dhw-shower"
          points="49,136 42,136 42,144"
        />
        {/* DHW manifold → bath outlet */}
        <polyline
          className={pipeClass('sd-pipe--dhw', paths.comboDhw || paths.storedHotDraw)}
          points="126,136 110,136 110,144"
        />
        {/* DHW manifold → kitchen tap */}
        <polyline
          className={pipeClass('sd-pipe--dhw', paths.comboDhw || paths.storedHotDraw)}
          points="186,136 186,144"
        />

        {/* Mains cold → boiler cold inlet + cylinder replenishment */}
        <polyline
          className={pipeClass('sd-pipe--cold', paths.coldSupply)}
          data-testid="pipe-cold-supply"
          points="275,144 275,128 6,128 6,39 14,39"
        />
        <polyline
          className={pipeClass('sd-pipe--cold', paths.coldSupply)}
          points="275,144 274,84"
        />

        {/* ── Callout badges ───────────────────────────────────────────────── */}
        <BadgeGroup badges={badges} />
      </svg>
    </div>
  );
}
