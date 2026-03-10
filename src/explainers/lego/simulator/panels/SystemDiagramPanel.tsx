/**
 * SystemDiagramPanel — live animated schematic for the System Diagram panel.
 *
 * Driven by SystemDiagramDisplayState from useSystemDiagramPlayback.
 * Falls back to a static (idle) appearance when no state is provided.
 *
 * PR6: Four distinct schematic families dispatched by systemType + heatSourceType:
 *   - Combi:       boiler + plate HEX, no cylinder, CH pauses on DHW draw.
 *   - S-plan:      system boiler + unvented cylinder, two zone valves.
 *   - Y-plan:      system boiler + vented cylinder, mid-position valve, CWS tank.
 *   - Heat pump:   ASHP outside unit + unvented cylinder, primary loop, no condensing.
 */

import type { SystemDiagramDisplayState } from '../useSystemDiagramPlayback';
import type { ReactElement } from 'react';

interface Props {
  /** Live playback state. When absent the diagram renders in static idle mode. */
  state?: SystemDiagramDisplayState;
  /**
   * Component IDs that should glow with an amber highlight.
   * Sourced from `activeLimiters[].targetComponent` in the limiters panel.
   * Valid IDs: 'boiler' | 'plate_hex' | 'cylinder' | 'mains'
   */
  highlightedComponents?: string[];
}

// ─── Active-path derivation ───────────────────────────────────────────────────

type ActivePaths = {
  chFlow: boolean;
  chFaded: boolean;
  comboDhw: boolean;
  primaryReheat: boolean;
  storedHotDraw: boolean;
  coldSupply: boolean;
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

const BADGE_CHAR_WIDTH_ESTIMATE = 5.5
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

// ─── Grid helper ─────────────────────────────────────────────────────────────

function GridLines({ W, H }: { W: number; H: number }): ReactElement {
  const lines: ReactElement[] = [];
  for (let x = 0; x <= W; x += 20) {
    lines.push(<line key={`gx${x}`} className="sd-grid-line" x1={x} y1={0} x2={x} y2={H} />);
  }
  for (let y = 0; y <= H; y += 20) {
    lines.push(<line key={`gy${y}`} className="sd-grid-line" x1={0} y1={y} x2={W} y2={y} />);
  }
  return <g aria-hidden="true">{lines}</g>;
}

// ─── Domain label helper ─────────────────────────────────────────────────────

function DomainLabel({ x, y, text }: { x: number; y: number; text: string }): ReactElement {
  return (
    <text
      x={x} y={y}
      fontSize={7}
      fontWeight={700}
      textAnchor="start"
      fill="#94a3b8"
      opacity={0.7}
      letterSpacing="0.04em"
      aria-hidden="true"
      style={{ textTransform: 'uppercase' } as React.CSSProperties}
    >
      {text}
    </text>
  );
}

// ─── Lane label helper ────────────────────────────────────────────────────────
//
// Small right-aligned uppercase labels that identify each hydraulic lane.
// Placed at the SVG right edge (x=316) so they don't overlap components.

function LaneLabel({ y, text }: { y: number; text: string }): ReactElement {
  return (
    <text
      x={316} y={y}
      fontSize={5.5}
      fontWeight={700}
      textAnchor="end"
      fill="#94a3b8"
      opacity={0.55}
      letterSpacing="0.05em"
      aria-hidden="true"
    >
      {text}
    </text>
  );
}

// ─── Schematic props ──────────────────────────────────────────────────────────

interface SchematicProps {
  state?: SystemDiagramDisplayState;
  paths: ActivePaths;
  badges: BadgeSpec[];
  highlightedComponents: string[];
}

/** Returns extra CSS class(es) when `componentId` is in the highlighted set. */
function nodeHighlightClass(componentId: string, highlighted: string[]): string {
  return highlighted.includes(componentId) ? ' sd-node--highlighted' : ''
}

/** Returns extra CSS class(es) when `pipeId` is in the highlighted set. */
function pipeHighlightClass(pipeId: string, highlighted: string[]): string {
  return highlighted.includes(pipeId) ? ' sd-pipe--highlighted' : ''
}

// ─── Schematic: Combi ─────────────────────────────────────────────────────────
//
// Hydraulic lanes (y-positions):
//   y=36  PRIMARY FLOW    — boiler → pump → CH valve → radiators
//   y=88  PRIMARY RETURN  — radiators → boiler
//   y=148 DHW HOT         — plate HEX DHW out → outlets
//   y=188 COLD FEED       — mains → plate HEX cold in

function CombiSchematic({ state, paths, badges, highlightedComponents }: SchematicProps): ReactElement {
  const W = 320;
  const H = 210;
  const outlets = state?.outletDemands ?? { shower: paths.comboDhw, bath: false, kitchen: false }

  const condensingBadgeText: string | null =
    state?.condensingState === 'condensing'     ? '🟢 Condensing'     :
    state?.condensingState === 'borderline'     ? '🟡 Borderline'     :
    state?.condensingState === 'not_condensing' ? '🔴 Not condensing' :
    null;

  const hl = highlightedComponents;

  return (
    <svg
      className="system-diagram__svg"
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Heating system schematic"
      role="img"
    >
      <GridLines W={W} H={H} />

      {/* Domain zones */}
      <rect className="sd-domain sd-domain--heating" x={4}   y={4}   width={88}  height={130} />
      <rect className="sd-domain sd-domain--water"   x={196} y={4}   width={120} height={130} />
      <rect className="sd-domain sd-domain--dhw"     x={4}   y={140} width={312} height={66}  />

      {/* Domain labels */}
      <DomainLabel x={8}   y={15}  text="CH circuit" />
      <DomainLabel x={200} y={15}  text="Emitters + vessel" />
      <DomainLabel x={8}   y={150} text="Draw-off (on-demand)" />

      {/* Lane labels — right-aligned at SVG edge */}
      <LaneLabel y={32}  text="PRIMARY FLOW" />
      <LaneLabel y={96}  text="PRIMARY RETURN" />
      <LaneLabel y={144} text="DHW HOT" />
      <LaneLabel y={184} text="COLD FEED" />

      {/* ── Boiler — spans primary flow (y=36) to primary return (y=88) ── */}
      <rect
        className={`sd-node sd-node--boiler${nodeHighlightClass('boiler', hl)}`}
        data-testid="node-boiler"
        x={6} y={12} width={74} height={84} rx={8} ry={8}
      />
      <text className="sd-label"    x={43} y={36}>🔥 Combi</text>
      <text className="sd-sublabel" x={43} y={52}>30 kW boiler</text>
      {/* Ports: flow right (80,36), return right (80,88), DHW bottom (43,96) */}
      <circle className="sd-port sd-port--hot"  cx={80} cy={36} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={80} cy={88} r={3.5} />
      <circle className="sd-port sd-port--dhw"  cx={43} cy={96} r={3.5} />

      {condensingBadgeText && (
        <g transform="translate(6,100)">
          <rect className="sd-callout sd-callout--condensing" x={0} y={0} width={80} height={13} rx={4} ry={4} />
          <text className="sd-callout__text" x={40} y={9}>{condensingBadgeText}</text>
        </g>
      )}

      {/* ── Pump — sits ON primary flow lane (y=36) ── */}
      <circle className="sd-node sd-node--pump" cx={114} cy={36} r={15} />
      <text className="sd-label"    x={114} y={34}>⚙</text>
      <text className="sd-sublabel" x={114} y={44}>Pump</text>
      <circle className="sd-port sd-port--hot" cx={99}  cy={36} r={3.5} />
      <circle className="sd-port sd-port--hot" cx={129} cy={36} r={3.5} />

      {/* ── CH Zone valve — straddles primary flow lane (y=36) ── */}
      <rect className="sd-node sd-node--valve" x={140} y={24} width={50} height={24} rx={6} ry={6} />
      <text className="sd-label"    x={165} y={33}>⊘ CH</text>
      <text className="sd-sublabel" x={165} y={44}>zone valve</text>
      <circle className="sd-port sd-port--hot" cx={140} cy={36} r={3.5} />
      <circle className="sd-port sd-port--hot" cx={190} cy={36} r={3.5} />

      {/* ── Radiators — spans primary flow (y=36) to primary return (y=88) ── */}
      <rect className={`sd-node sd-node--radiator${nodeHighlightClass('emitters', hl)}`} x={200} y={12} width={68} height={80} rx={6} ry={6} />
      <text className="sd-label"    x={234} y={40}>▤ Radiators</text>
      <text className="sd-sublabel" x={234} y={54}>6 emitters</text>
      <circle className="sd-port sd-port--hot"  cx={200} cy={36} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={200} cy={88} r={3.5} />

      {/* ── Expansion vessel — top right, hangs off primary return ── */}
      <rect className="sd-node sd-node--mains" x={278} y={12} width={36} height={40} rx={6} ry={6} />
      <text className="sd-label"    x={296} y={26}>⊕ Exp.</text>
      <text className="sd-sublabel" x={296} y={38}>vessel</text>
      <circle className="sd-port sd-port--cold" cx={296} cy={52} r={3.5} />

      {/* ── Plate HEX — between primary return (y=88) and DHW hot (y=148) ── */}
      <rect
        className={`sd-node sd-node--cylinder${nodeHighlightClass('plate_hex', hl)}`}
        data-testid="node-plate-hex"
        x={140} y={102} width={68} height={46} rx={6} ry={6}
      />
      <text className="sd-label"    x={174} y={119}>⇌ Plate HEX</text>
      <text className="sd-sublabel" x={174} y={133}>On-demand DHW</text>
      {/* Ports: primary hot in left (140,125), cold in right (208,125), DHW out bottom (174,148) */}
      <circle className="sd-port sd-port--hot"  cx={140} cy={125} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={208} cy={125} r={3.5} />
      <circle className="sd-port sd-port--dhw"  cx={174} cy={148} r={3.5} />

      {/* ── Outlets — sit between DHW hot lane (y=148) and cold feed lane (y=188) ── */}
      <rect className="sd-node sd-node--outlet" x={6}   y={154} width={58} height={28} rx={6} ry={6} />
      <text className="sd-label"    x={35} y={165}>🚿 Shower</text>
      <text className="sd-sublabel" x={35} y={176}>{outlets.shower ? 'open' : 'closed'}</text>
      <circle className="sd-port sd-port--dhw" cx={35} cy={154} r={3.5} />

      <rect className="sd-node sd-node--outlet" x={70}  y={154} width={54} height={28} rx={6} ry={6} />
      <text className="sd-label"    x={97} y={165}>🛁 Bath</text>
      <text className="sd-sublabel" x={97} y={176}>{outlets.bath ? 'open' : 'closed'}</text>
      <circle className="sd-port sd-port--dhw" cx={97} cy={154} r={3.5} />

      <rect className="sd-node sd-node--outlet" x={130} y={154} width={66} height={28} rx={6} ry={6} />
      <text className="sd-label"    x={163} y={165}>🚰 Kitchen</text>
      <text className="sd-sublabel" x={163} y={176}>{outlets.kitchen ? 'open' : 'closed'}</text>
      <circle className="sd-port sd-port--dhw" cx={163} cy={154} r={3.5} />

      {/* ── Mains — sits ON cold feed lane (y=188) ── */}
      <rect
        className={`sd-node sd-node--mains${nodeHighlightClass('mains', hl)}`}
        data-testid="node-mains"
        x={212} y={176} width={86} height={24} rx={6} ry={6}
      />
      <text className="sd-label"    x={255} y={186}>❄ Mains cold</text>
      <text className="sd-sublabel" x={255} y={197}>supply</text>
      <circle className="sd-port sd-port--cold" cx={212} cy={188} r={3.5} />

      {/* ── PRIMARY FLOW LANE pipes ── */}
      {/* Boiler → pump (left port) */}
      <polyline
        className={`${pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)}${pipeHighlightClass('pipe-flow', hl)}`}
        data-testid="pipe-ch-flow-boiler-tee"
        points="80,36 99,36"
      />
      {/* Pump (right) → CH valve (left) */}
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} points="129,36 140,36" />
      {/* CH valve (right) → radiators (left) */}
      <polyline
        className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)}
        data-testid="pipe-ch-flow-pump-rads"
        points="190,36 200,36"
      />

      {/* ── PRIMARY RETURN LANE — radiators return → boiler ── */}
      <polyline
        className={`${pipeClass('sd-pipe--return', paths.chFlow, paths.chFaded)}${pipeHighlightClass('pipe-return', hl)}`}
        data-testid="pipe-ch-return"
        points="200,88 80,88"
      />
      {/* Expansion vessel vertical connection to return lane */}
      <polyline className="sd-pipe sd-pipe--return sd-pipe--inactive" points="296,88 296,52" />

      {/* ── Boiler DHW → Plate HEX primary ── */}
      <polyline
        className={pipeClass('sd-pipe--dhw', paths.comboDhw)}
        data-testid="pipe-primary-dhw"
        points="43,96 43,125 140,125"
      />

      {/* ── DHW HOT LANE — plate HEX DHW out → outlets ── */}
      {/* Lane spine: plate HEX DHW port to left edge */}
      <polyline
        className={`${pipeClass('sd-pipe--dhw', paths.comboDhw)}${pipeHighlightClass('pipe-dhw-hot', hl)}`}
        data-testid="pipe-dhw-hot"
        points="8,148 174,148"
      />
      {/* Outlet drops */}
      <polyline
        className={pipeClass('sd-pipe--dhw', outlets.shower && paths.comboDhw)}
        data-testid="pipe-dhw-shower"
        points="35,148 35,154"
      />
      <polyline className={pipeClass('sd-pipe--dhw', outlets.bath    && paths.comboDhw)} points="97,148 97,154" />
      <polyline className={pipeClass('sd-pipe--dhw', outlets.kitchen && paths.comboDhw)} points="163,148 163,154" />

      {/* ── COLD FEED LANE — mains → plate HEX cold in ── */}
      {/* Lane spine: full-width horizontal cold feed */}
      <polyline
        className={`${pipeClass('sd-pipe--cold', paths.coldSupply)}${pipeHighlightClass('pipe-cold-feed', hl)}`}
        data-testid="pipe-cold-feed"
        points="8,188 312,188"
      />
      {/* Branch: cold feed lane → plate HEX cold in (vertical) */}
      <polyline
        className={pipeClass('sd-pipe--cold', paths.coldSupply)}
        data-testid="pipe-cold-supply"
        points="208,188 208,125"
      />

      <BadgeGroup badges={badges} />
    </svg>
  );
}

// ─── Schematic: S-plan Unvented ───────────────────────────────────────────────
//
// Hydraulic lanes (y-positions):
//   y=36  PRIMARY FLOW    — boiler → pump → T-junction → CH valve → radiators
//                                                       ↓ DHW valve → cylinder coil
//   y=88  PRIMARY RETURN  — radiators + cylinder coil → boiler
//   y=148 STORED HOT      — cylinder draw → outlets (horizontal distribution)
//   y=188 COLD FEED       — mains → cylinder cold fill

function StoredSchematic({ state, paths, badges, highlightedComponents }: SchematicProps): ReactElement {
  const W = 320;
  const H = 210;
  const outlets = state?.outletDemands ?? { shower: paths.storedHotDraw, bath: false, kitchen: false }

  const condensingBadgeText: string | null =
    state?.condensingState === 'condensing'     ? '🟢 Condensing'     :
    state?.condensingState === 'borderline'     ? '🟡 Borderline'     :
    state?.condensingState === 'not_condensing' ? '🔴 Not condensing' :
    null;

  const hl = highlightedComponents;

  return (
    <svg
      className="system-diagram__svg"
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="S-plan unvented heating system schematic"
      role="img"
    >
      <GridLines W={W} H={H} />

      {/* Domain zones */}
      <rect className="sd-domain sd-domain--heating" x={4}   y={4}   width={88}  height={130} />
      <rect className="sd-domain sd-domain--water"   x={196} y={4}   width={120} height={130} />
      <rect className="sd-domain sd-domain--dhw"     x={4}   y={140} width={312} height={66}  />

      {/* Domain labels */}
      <DomainLabel x={8}   y={15}  text="CH circuit (S-plan)" />
      <DomainLabel x={200} y={15}  text="Cylinder (unvented)" />
      <DomainLabel x={8}   y={150} text="Draw-off (stored HW)" />

      {/* Lane labels */}
      <LaneLabel y={32}  text="PRIMARY FLOW" />
      <LaneLabel y={96}  text="PRIMARY RETURN" />
      <LaneLabel y={144} text="STORED HOT" />
      <LaneLabel y={184} text="COLD FEED" />

      {/* ── System boiler — spans primary flow (y=36) to primary return (y=88) ── */}
      <rect
        className={`sd-node sd-node--boiler${nodeHighlightClass('boiler', hl)}`}
        data-testid="node-boiler"
        x={6} y={12} width={74} height={84} rx={8} ry={8}
      />
      <text className="sd-label"    x={43} y={36}>🔥 System</text>
      <text className="sd-sublabel" x={43} y={52}>24 kW boiler</text>
      <circle className="sd-port sd-port--hot"  cx={80} cy={36} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={80} cy={88} r={3.5} />

      {condensingBadgeText && (
        <g transform="translate(6,100)">
          <rect className="sd-callout sd-callout--condensing" x={0} y={0} width={80} height={13} rx={4} ry={4} />
          <text className="sd-callout__text" x={40} y={9}>{condensingBadgeText}</text>
        </g>
      )}

      {/* ── Pump — sits ON primary flow lane (y=36) ── */}
      <circle className="sd-node sd-node--pump" cx={114} cy={36} r={15} />
      <text className="sd-label"    x={114} y={34}>⚙</text>
      <text className="sd-sublabel" x={114} y={44}>Pump</text>
      <circle className="sd-port sd-port--hot" cx={99}  cy={36} r={3.5} />
      <circle className="sd-port sd-port--hot" cx={129} cy={36} r={3.5} />

      {/* ── CH zone valve — on primary flow lane (y=36) after T-junction ── */}
      <rect className="sd-node sd-node--valve" x={138} y={24} width={50} height={24} rx={5} ry={5} />
      <text className="sd-label"    x={163} y={33}>⊘ CH</text>
      <text className="sd-sublabel" x={163} y={44}>zone valve</text>
      <circle className="sd-port sd-port--hot" cx={138} cy={36} r={3.5} />
      <circle className="sd-port sd-port--hot" cx={188} cy={36} r={3.5} />

      {/* ── DHW zone valve — on DHW branch (y=68), drops from T-junction ── */}
      <rect className="sd-node sd-node--valve" x={138} y={56} width={50} height={24} rx={5} ry={5} />
      <text className="sd-label"    x={163} y={65}>⊘ DHW</text>
      <text className="sd-sublabel" x={163} y={76}>zone valve</text>
      <circle className="sd-port sd-port--hot" cx={138} cy={68} r={3.5} />
      <circle className="sd-port sd-port--hot" cx={188} cy={68} r={3.5} />

      {/* ── Radiators — spans primary flow (y=36) to primary return (y=88) ── */}
      <rect className={`sd-node sd-node--radiator${nodeHighlightClass('emitters', hl)}`} x={196} y={12} width={54} height={80} rx={6} ry={6} />
      <text className="sd-label"    x={223} y={42}>▤ Radiators</text>
      <text className="sd-sublabel" x={223} y={56}>CH emitters</text>
      <circle className="sd-port sd-port--hot"  cx={196} cy={36} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={196} cy={88} r={3.5} />

      {/* ── Expansion vessel — top right, connected to primary return ── */}
      <rect className="sd-node sd-node--mains" x={258} y={12} width={42} height={36} rx={6} ry={6} />
      <text className="sd-label"    x={279} y={25}>⊕ Exp.</text>
      <text className="sd-sublabel" x={279} y={37}>vessel</text>
      <circle className="sd-port sd-port--cold" cx={279} cy={48} r={3.5} />

      {/* ── Unvented cylinder — right zone, coil spans DHW branch to return ── */}
      <rect
        className={`sd-node sd-node--cylinder${nodeHighlightClass('cylinder', hl)}`}
        data-testid="node-cylinder"
        x={254} y={56} width={60} height={66} rx={8} ry={8}
      />
      {/* Cylinder dome / top cap */}
      <ellipse cx={284} cy={56} rx={28} ry={7} fill="#bee3f8" stroke="#2b6cb0" strokeWidth={1.5} opacity={0.7} />
      <text className="sd-label"    x={284} y={78}>🛢 Cylinder</text>
      <text className="sd-sublabel" x={284} y={93}>Unvented HW</text>
      {/* Ports: primary coil in left (254,68), primary coil return left (254,88), stored hot bottom (284,122), cold fill right */}
      <circle className="sd-port sd-port--hot"  cx={254} cy={68} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={254} cy={88} r={3.5} />
      <circle className="sd-port sd-port--dhw"  cx={284} cy={122} r={3.5} />

      {state?.cylinderFillPct !== undefined && (
        <rect
          className="sd-cylinder-fill"
          x={256}
          y={58 + 62 * (1 - state.cylinderFillPct)}
          width={56}
          height={62 * state.cylinderFillPct}
          rx={5}
        />
      )}

      {/* ── Outlets ── */}
      <rect className="sd-node sd-node--outlet" x={6}   y={154} width={58} height={28} rx={6} ry={6} />
      <text className="sd-label"    x={35} y={165}>🚿 Shower</text>
      <text className="sd-sublabel" x={35} y={176}>{paths.storedHotDraw ? 'open' : 'closed'}</text>
      <circle className="sd-port sd-port--dhw" cx={35} cy={154} r={3.5} />

      <rect className="sd-node sd-node--outlet" x={70}  y={154} width={54} height={28} rx={6} ry={6} />
      <text className="sd-label"    x={97} y={165}>🛁 Bath</text>
      <text className="sd-sublabel" x={97} y={176}>{outlets.bath ? 'open' : 'closed'}</text>
      <circle className="sd-port sd-port--dhw" cx={97} cy={154} r={3.5} />

      <rect className="sd-node sd-node--outlet" x={130} y={154} width={66} height={28} rx={6} ry={6} />
      <text className="sd-label"    x={163} y={165}>🚰 Kitchen</text>
      <text className="sd-sublabel" x={163} y={176}>{outlets.kitchen ? 'open' : 'closed'}</text>
      <circle className="sd-port sd-port--dhw" cx={163} cy={154} r={3.5} />

      {/* ── Mains — sits ON cold feed lane (y=188) ── */}
      <rect
        className={`sd-node sd-node--mains${nodeHighlightClass('mains', hl)}`}
        data-testid="node-mains"
        x={212} y={176} width={86} height={24} rx={6} ry={6}
      />
      <text className="sd-label"    x={255} y={186}>❄ Mains cold</text>
      <text className="sd-sublabel" x={255} y={197}>supply</text>
      <circle className="sd-port sd-port--cold" cx={212} cy={188} r={3.5} />

      {/* ── PRIMARY FLOW LANE ── */}
      {/* Boiler → pump — active during CH or cylinder reheat (primary circuit runs in both) */}
      <polyline
        className={`${pipeClass('sd-pipe--flow', paths.chFlow || paths.primaryReheat, paths.chFaded)}${pipeHighlightClass('pipe-flow', hl)}`}
        data-testid="pipe-ch-flow-boiler-tee"
        points="80,36 99,36"
      />
      {/* Pump → T-junction — active during CH or cylinder reheat */}
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow || paths.primaryReheat, paths.chFaded)} points="129,36 138,36" />
      {/* T-junction drop to DHW valve — only active during cylinder reheat (DHW zone valve open) */}
      <polyline className={pipeClass('sd-pipe--flow', paths.primaryReheat, paths.chFaded)} points="136,36 136,56" />
      {/* CH valve → radiators — only active during CH */}
      <polyline
        className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)}
        data-testid="pipe-ch-flow-pump-rads"
        points="188,36 196,36"
      />

      {/* ── PRIMARY RETURN LANE — radiators + cylinder coil → boiler ── */}
      <polyline
        className={`${pipeClass('sd-pipe--return', paths.chFlow, paths.chFaded)}${pipeHighlightClass('pipe-return', hl)}`}
        data-testid="pipe-ch-return"
        points="254,88 196,88 80,88"
      />
      {/* Expansion vessel vertical connection */}
      <polyline className="sd-pipe sd-pipe--return sd-pipe--inactive" points="279,88 279,48" />

      {/* ── Primary DHW (cylinder reheat) — DHW valve → cylinder primary coil ── */}
      <polyline
        className={pipeClass('sd-pipe--dhw', paths.primaryReheat)}
        data-testid="pipe-primary-dhw"
        points="188,68 254,68"
      />

      {/* ── STORED HOT LANE ── */}
      {/* Cylinder draw — vertical drop from cylinder bottom to stored hot lane */}
      <polyline
        className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)}
        data-testid="pipe-stored-hot-draw"
        points="284,122 284,148"
      />
      {/* Lane spine — horizontal distribution to outlets */}
      <polyline
        className={`${pipeClass('sd-pipe--dhw', paths.storedHotDraw)}${pipeHighlightClass('pipe-stored-hot', hl)}`}
        data-testid="pipe-stored-hot"
        points="8,148 284,148"
      />
      {/* Outlet drops */}
      <polyline className={pipeClass('sd-pipe--dhw', outlets.shower  && paths.storedHotDraw)} data-testid="pipe-dhw-shower" points="35,148 35,154" />
      <polyline className={pipeClass('sd-pipe--dhw', outlets.bath    && paths.storedHotDraw)} points="97,148 97,154" />
      <polyline className={pipeClass('sd-pipe--dhw', outlets.kitchen && paths.storedHotDraw)} points="163,148 163,154" />

      {/* ── COLD FEED LANE — mains → cylinder cold fill ── */}
      <polyline
        className={`${pipeClass('sd-pipe--cold', paths.coldSupply)}${pipeHighlightClass('pipe-cold-feed', hl)}`}
        data-testid="pipe-cold-feed"
        points="8,188 312,188"
      />
      {/* Branch: cold feed lane → cylinder cold fill (right side, vertical) */}
      <polyline
        className={pipeClass('sd-pipe--cold', paths.coldSupply)}
        data-testid="pipe-cold-supply"
        points="312,188 312,106"
      />

      <BadgeGroup badges={badges} />
    </svg>
  );
}

// ─── Schematic: Y-plan Open Vented ───────────────────────────────────────────
//
// Hydraulic lanes (y-positions):
//   y=36  PRIMARY FLOW    — boiler → pump → Y-plan valve → radiators
//   y=88  PRIMARY RETURN  — radiators + cylinder coil → boiler
//   y=148 STORED HOT      — cylinder draw → outlets
//   y=188 COLD FEED       — tank-fed cold → cylinder cold fill
//
// Additional: Feed & vent lane — CWS cistern (top right) gravity feeds cylinder.

function VentedSchematic({ state, paths, badges, highlightedComponents }: SchematicProps): ReactElement {
  const W = 320;
  const H = 210;
  const outlets = state?.outletDemands ?? { shower: paths.storedHotDraw, bath: false, kitchen: false }

  const condensingBadgeText: string | null =
    state?.condensingState === 'condensing'     ? '🟢 Condensing'     :
    state?.condensingState === 'borderline'     ? '🟡 Borderline'     :
    state?.condensingState === 'not_condensing' ? '🔴 Not condensing' :
    null;

  const hl = highlightedComponents;

  return (
    <svg
      className="system-diagram__svg"
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Y-plan open vented heating system schematic"
      role="img"
    >
      <GridLines W={W} H={H} />

      {/* Domain zones */}
      <rect className="sd-domain sd-domain--heating" x={4}   y={4}   width={88}  height={130} />
      <rect className="sd-domain sd-domain--water"   x={196} y={4}   width={120} height={130} />
      <rect className="sd-domain sd-domain--dhw"     x={4}   y={140} width={312} height={66}  />

      {/* Domain labels */}
      <DomainLabel x={8}   y={15}  text="CH circuit (Y-plan)" />
      <DomainLabel x={200} y={15}  text="Cylinder (open vented)" />
      <DomainLabel x={8}   y={150} text="Draw-off (stored HW)" />

      {/* Lane labels */}
      <LaneLabel y={32}  text="PRIMARY FLOW" />
      <LaneLabel y={96}  text="PRIMARY RETURN" />
      <LaneLabel y={144} text="STORED HOT" />
      <LaneLabel y={184} text="TANK-FED COLD" />

      {/* ── Regular boiler — spans primary flow (y=36) to primary return (y=88) ── */}
      <rect
        className={`sd-node sd-node--boiler${nodeHighlightClass('boiler', hl)}`}
        data-testid="node-boiler"
        x={6} y={12} width={72} height={84} rx={8} ry={8}
      />
      <text className="sd-label"    x={42} y={36}>🔥 Regular</text>
      <text className="sd-sublabel" x={42} y={52}>24 kW boiler</text>
      <circle className="sd-port sd-port--hot"  cx={78} cy={36} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={78} cy={88} r={3.5} />

      {condensingBadgeText && (
        <g transform="translate(6,100)">
          <rect className="sd-callout sd-callout--condensing" x={0} y={0} width={80} height={13} rx={4} ry={4} />
          <text className="sd-callout__text" x={40} y={9}>{condensingBadgeText}</text>
        </g>
      )}

      {/* ── CH pump — sits ON primary flow lane (y=36) ── */}
      <circle className="sd-node sd-node--pump" cx={110} cy={36} r={15} />
      <text className="sd-label"    x={110} y={34}>⚙</text>
      <text className="sd-sublabel" x={110} y={44}>Pump</text>
      <circle className="sd-port sd-port--hot" cx={95}  cy={36} r={3.5} />
      <circle className="sd-port sd-port--hot" cx={125} cy={36} r={3.5} />

      {/* ── Y-plan mid-position valve — straddles flow lane, 3-port ── */}
      {/* Ports: left (primary in from pump, y=36), right (CH to rads, y=36), bottom (DHW to cylinder) */}
      <rect className="sd-node sd-node--valve" x={134} y={24} width={56} height={26} rx={6} ry={6} />
      <text className="sd-label"    x={162} y={33}>◈ Y-plan</text>
      <text className="sd-sublabel" x={162} y={44}>mid-pos valve</text>
      <circle className="sd-port sd-port--hot" cx={134} cy={37} r={3.5} />
      <circle className="sd-port sd-port--hot" cx={190} cy={37} r={3.5} />
      <circle className="sd-port sd-port--dhw" cx={162} cy={50} r={3.5} />

      {/* ── Radiators — spans primary flow (y=36) to primary return (y=88) ── */}
      <rect className={`sd-node sd-node--radiator${nodeHighlightClass('emitters', hl)}`} x={198} y={12} width={54} height={80} rx={6} ry={6} />
      <text className="sd-label"    x={225} y={42}>▤ Radiators</text>
      <text className="sd-sublabel" x={225} y={56}>CH emitters</text>
      <circle className="sd-port sd-port--hot"  cx={198} cy={36} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={198} cy={88} r={3.5} />

      {/* ── CWS cistern — top right (feed & vent lane) ── */}
      <rect className="sd-node sd-node--mains" x={258} y={8} width={56} height={28} rx={6} ry={6} />
      {/* Water level indicator */}
      <rect x={260} y={20} width={52} height={12} rx={3} fill="#90cdf4" opacity={0.4} />
      <text className="sd-label"    x={286} y={16}>🪣 CWS</text>
      <text className="sd-sublabel" x={286} y={28}>cistern</text>
      <circle className="sd-port sd-port--cold" cx={278} cy={36} r={3.5} />

      {/* ── Open vented cylinder — right zone ── */}
      <rect
        className={`sd-node sd-node--cylinder${nodeHighlightClass('cylinder', hl)}`}
        data-testid="node-cylinder"
        x={256} y={56} width={60} height={66} rx={8} ry={8}
      />
      {/* Cylinder dome / top cap */}
      <ellipse cx={286} cy={56} rx={28} ry={6} fill="#bee3f8" stroke="#2b6cb0" strokeWidth={1.5} opacity={0.7} />
      {/* Vent pipe indicator — dashed, goes up to CWS */}
      <line x1={278} y1={50} x2={278} y2={36} stroke="#90cdf4" strokeWidth={2} strokeDasharray="2,2" opacity={0.6} />
      <text className="sd-label"    x={286} y={78}>🛢 Cylinder</text>
      <text className="sd-sublabel" x={286} y={93}>Open vented</text>
      {/* Ports: primary coil in left (256,68), coil return left (256,88), stored hot draw bottom (286,122), cold fill right */}
      <circle className="sd-port sd-port--hot"  cx={256} cy={68} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={256} cy={88} r={3.5} />
      <circle className="sd-port sd-port--dhw"  cx={286} cy={122} r={3.5} />

      {/* Gravity cold feed from CWS to cylinder top (feed & vent, always topology) */}
      <polyline className="sd-pipe sd-pipe--cold sd-pipe--inactive" points="278,36 278,50" />

      {state?.cylinderFillPct !== undefined && (
        <rect
          className="sd-cylinder-fill"
          x={258}
          y={58 + 62 * (1 - state.cylinderFillPct)}
          width={56}
          height={62 * state.cylinderFillPct}
          rx={5}
        />
      )}

      {/* ── Outlets ── */}
      <rect className="sd-node sd-node--outlet" x={6}   y={154} width={58} height={28} rx={6} ry={6} />
      <text className="sd-label"    x={35} y={165}>🚿 Shower</text>
      <text className="sd-sublabel" x={35} y={176}>{paths.storedHotDraw ? 'open' : 'closed'}</text>
      <circle className="sd-port sd-port--dhw" cx={35} cy={154} r={3.5} />

      <rect className="sd-node sd-node--outlet" x={70}  y={154} width={54} height={28} rx={6} ry={6} />
      <text className="sd-label"    x={97} y={165}>🛁 Bath</text>
      <text className="sd-sublabel" x={97} y={176}>{outlets.bath ? 'open' : 'closed'}</text>
      <circle className="sd-port sd-port--dhw" cx={97} cy={154} r={3.5} />

      <rect className="sd-node sd-node--outlet" x={130} y={154} width={66} height={28} rx={6} ry={6} />
      <text className="sd-label"    x={163} y={165}>🚰 Kitchen</text>
      <text className="sd-sublabel" x={163} y={176}>{outlets.kitchen ? 'open' : 'closed'}</text>
      <circle className="sd-port sd-port--dhw" cx={163} cy={154} r={3.5} />

      {/* ── Tank-fed cold — sits ON cold feed lane (y=188) ── */}
      <rect
        className={`sd-node sd-node--mains${nodeHighlightClass('mains', hl)}`}
        data-testid="node-mains"
        x={212} y={176} width={86} height={24} rx={6} ry={6}
      />
      <text className="sd-label"    x={255} y={186}>🪣 Tank-fed</text>
      <text className="sd-sublabel" x={255} y={197}>cold supply</text>
      <circle className="sd-port sd-port--cold" cx={212} cy={188} r={3.5} />

      {/* ── PRIMARY FLOW LANE ── */}
      <polyline
        className={`${pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)}${pipeHighlightClass('pipe-flow', hl)}`}
        data-testid="pipe-ch-flow-boiler-tee"
        points="78,36 95,36"
      />
      {/* Pump → Y-plan valve (left port) */}
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} points="125,36 134,36" />
      {/* Y-plan valve (right) → radiators */}
      <polyline
        className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)}
        data-testid="pipe-ch-flow-pump-rads"
        points="190,36 198,36"
      />

      {/* ── PRIMARY RETURN LANE — radiators + cylinder coil → boiler ── */}
      <polyline
        className={`${pipeClass('sd-pipe--return', paths.chFlow, paths.chFaded)}${pipeHighlightClass('pipe-return', hl)}`}
        data-testid="pipe-ch-return"
        points="256,88 198,88 78,88"
      />

      {/* ── Primary DHW (Y-plan cylinder reheat) — Y-plan valve DHW port → cylinder ── */}
      {/* Valve DHW bottom port (162,50) drops to cylinder primary coil y=68 */}
      <polyline
        className={pipeClass('sd-pipe--dhw', paths.primaryReheat)}
        data-testid="pipe-primary-dhw"
        points="162,50 162,68 256,68"
      />

      {/* ── STORED HOT LANE ── */}
      {/* Cylinder draw — vertical drop */}
      <polyline
        className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)}
        data-testid="pipe-stored-hot-draw"
        points="286,122 286,148"
      />
      {/* Lane spine — horizontal distribution */}
      <polyline
        className={`${pipeClass('sd-pipe--dhw', paths.storedHotDraw)}${pipeHighlightClass('pipe-stored-hot', hl)}`}
        data-testid="pipe-stored-hot"
        points="8,148 286,148"
      />
      {/* Outlet drops */}
      <polyline className={pipeClass('sd-pipe--dhw', outlets.shower  && paths.storedHotDraw)} data-testid="pipe-dhw-shower" points="35,148 35,154" />
      <polyline className={pipeClass('sd-pipe--dhw', outlets.bath    && paths.storedHotDraw)} points="97,148 97,154" />
      <polyline className={pipeClass('sd-pipe--dhw', outlets.kitchen && paths.storedHotDraw)} points="163,148 163,154" />

      {/* ── COLD FEED LANE (tank-fed gravity cold) ── */}
      <polyline
        className={`${pipeClass('sd-pipe--cold', paths.coldSupply)}${pipeHighlightClass('pipe-cold-feed', hl)}`}
        data-testid="pipe-cold-feed"
        points="8,188 312,188"
      />
      {/* Branch: cold feed lane → cylinder cold fill (gravity cold, vertical) */}
      <polyline
        className={pipeClass('sd-pipe--cold', paths.coldSupply)}
        data-testid="pipe-cold-supply"
        points="312,188 312,106"
      />

      <BadgeGroup badges={badges} />
    </svg>
  );
}

/** Format a COP value for display in the schematic badge. */
function formatCop(cop: number): string {
  return `COP ${cop.toFixed(1)}`
}

// ─── Schematic: Heat pump + cylinder ─────────────────────────────────────────
//
// Hydraulic lanes (y-positions):
//   y=36  PRIMARY FLOW    — ASHP → primary pump → T → CH pump → UFH/rads
//                                                  ↓ cylinder primary coil
//   y=88  PRIMARY RETURN  — UFH/rads + cylinder coil → ASHP
//   y=148 STORED HOT      — cylinder draw → outlets
//   y=188 COLD FEED       — mains → cylinder cold fill
//
// Additional: Outside heat-source lane (ASHP) at left.

function HeatPumpSchematic({ state, paths, badges, highlightedComponents }: SchematicProps): ReactElement {
  const W = 320;
  const H = 210;
  const outlets = state?.outletDemands ?? { shower: paths.storedHotDraw, bath: false, kitchen: false }

  const copText = state?.cop !== undefined ? formatCop(state.cop) : null

  const hl = highlightedComponents;

  return (
    <svg
      className="system-diagram__svg"
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Heat pump with cylinder heating system schematic"
      role="img"
    >
      <GridLines W={W} H={H} />

      {/* Domain zones */}
      <rect className="sd-domain sd-domain--heating" x={4}   y={4}   width={88}  height={130} />
      <rect className="sd-domain sd-domain--water"   x={196} y={4}   width={120} height={130} />
      <rect className="sd-domain sd-domain--dhw"     x={4}   y={140} width={312} height={66}  />

      {/* Domain labels */}
      <DomainLabel x={8}   y={15}  text="Heat pump loop" />
      <DomainLabel x={200} y={15}  text="Cylinder (HP primary)" />
      <DomainLabel x={8}   y={150} text="Draw-off (stored HW)" />

      {/* Lane labels */}
      <LaneLabel y={32}  text="PRIMARY FLOW" />
      <LaneLabel y={96}  text="PRIMARY RETURN" />
      <LaneLabel y={144} text="STORED HOT" />
      <LaneLabel y={184} text="COLD FEED" />

      {/* ── ASHP outside unit — spans primary flow (y=36) to primary return (y=88) ── */}
      <rect
        className={`sd-node sd-node--boiler${nodeHighlightClass('boiler', hl)}`}
        data-testid="node-boiler"
        x={6} y={12} width={74} height={84} rx={8} ry={8}
      />
      {/* Fan indicator */}
      <circle cx={43} cy={36} r={8} fill="none" stroke="#90cdf4" strokeWidth={1.5} opacity={0.6} />
      <text className="sd-label"    x={43} y={34}>🌬 ASHP</text>
      <text className="sd-sublabel" x={43} y={50}>Outside unit</text>
      <text className="sd-sublabel" x={43} y={64}>Low-temp</text>
      <circle className="sd-port sd-port--hot"  cx={80} cy={36} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={80} cy={88} r={3.5} />

      {copText && (
        <g transform="translate(6,100)">
          <rect className="sd-callout sd-callout--condensing" x={0} y={0} width={72} height={13} rx={4} ry={4} />
          <text className="sd-callout__text" x={36} y={9}>{copText}</text>
        </g>
      )}

      {/* ── Primary pump — on shared primary flow lane (y=36) ── */}
      <circle className="sd-node sd-node--pump" cx={114} cy={36} r={15} />
      <text className="sd-label"    x={114} y={34}>⚙</text>
      <text className="sd-sublabel" x={114} y={44}>Primary</text>
      <circle className="sd-port sd-port--hot" cx={99}  cy={36} r={3.5} />
      <circle className="sd-port sd-port--hot" cx={129} cy={36} r={3.5} />

      {/* ── CH/UFH distribution pump — on CH branch of flow lane ── */}
      <circle className="sd-node sd-node--pump" cx={162} cy={36} r={15} />
      <text className="sd-label"    x={162} y={34}>⚙</text>
      <text className="sd-sublabel" x={162} y={44}>CH/UFH</text>
      <circle className="sd-port sd-port--hot" cx={147} cy={36} r={3.5} />
      <circle className="sd-port sd-port--hot" cx={177} cy={36} r={3.5} />

      {/* ── UFH / radiators — spans primary flow (y=36) to primary return (y=88) ── */}
      <rect className={`sd-node sd-node--radiator${nodeHighlightClass('emitters', hl)}`} x={186} y={12} width={60} height={80} rx={6} ry={6} />
      <text className="sd-label"    x={216} y={40}>▤ UFH/Rads</text>
      <text className="sd-sublabel" x={216} y={54}>Low-temp</text>
      <circle className="sd-port sd-port--hot"  cx={186} cy={36} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={186} cy={88} r={3.5} />

      {/* ── Expansion vessel — top right ── */}
      <rect className="sd-node sd-node--mains" x={256} y={12} width={40} height={36} rx={6} ry={6} />
      <text className="sd-label"    x={276} y={25}>⊕ Exp.</text>
      <text className="sd-sublabel" x={276} y={37}>vessel</text>
      <circle className="sd-port sd-port--cold" cx={276} cy={48} r={3.5} />

      {/* ── Hot water cylinder — right zone ── */}
      <rect
        className={`sd-node sd-node--cylinder${nodeHighlightClass('cylinder', hl)}`}
        data-testid="node-cylinder"
        x={256} y={56} width={60} height={66} rx={8} ry={8}
      />
      {/* Cylinder dome */}
      <ellipse cx={286} cy={56} rx={28} ry={6} fill="#bee3f8" stroke="#2b6cb0" strokeWidth={1.5} opacity={0.7} />
      <text className="sd-label"    x={286} y={78}>🛢 Cylinder</text>
      <text className="sd-sublabel" x={286} y={93}>HP heated HW</text>
      {/* Ports: HP primary coil in left (256,68), coil return left (256,88), stored hot draw bottom (286,122) */}
      <circle className="sd-port sd-port--hot"  cx={256} cy={68} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={256} cy={88} r={3.5} />
      <circle className="sd-port sd-port--dhw"  cx={286} cy={122} r={3.5} />

      {state?.cylinderFillPct !== undefined && (
        <rect
          className="sd-cylinder-fill"
          x={258}
          y={58 + 62 * (1 - state.cylinderFillPct)}
          width={56}
          height={62 * state.cylinderFillPct}
          rx={5}
        />
      )}

      {/* ── Outlets ── */}
      <rect className="sd-node sd-node--outlet" x={6}   y={154} width={58} height={28} rx={6} ry={6} />
      <text className="sd-label"    x={35} y={165}>🚿 Shower</text>
      <text className="sd-sublabel" x={35} y={176}>{paths.storedHotDraw ? 'open' : 'closed'}</text>
      <circle className="sd-port sd-port--dhw" cx={35} cy={154} r={3.5} />

      <rect className="sd-node sd-node--outlet" x={70}  y={154} width={54} height={28} rx={6} ry={6} />
      <text className="sd-label"    x={97} y={165}>🛁 Bath</text>
      <text className="sd-sublabel" x={97} y={176}>{outlets.bath ? 'open' : 'closed'}</text>
      <circle className="sd-port sd-port--dhw" cx={97} cy={154} r={3.5} />

      <rect className="sd-node sd-node--outlet" x={130} y={154} width={66} height={28} rx={6} ry={6} />
      <text className="sd-label"    x={163} y={165}>🚰 Kitchen</text>
      <text className="sd-sublabel" x={163} y={176}>{outlets.kitchen ? 'open' : 'closed'}</text>
      <circle className="sd-port sd-port--dhw" cx={163} cy={154} r={3.5} />

      {/* ── Mains — sits ON cold feed lane (y=188) ── */}
      <rect
        className={`sd-node sd-node--mains${nodeHighlightClass('mains', hl)}`}
        data-testid="node-mains"
        x={212} y={176} width={86} height={24} rx={6} ry={6}
      />
      <text className="sd-label"    x={255} y={186}>❄ Mains cold</text>
      <text className="sd-sublabel" x={255} y={197}>supply</text>
      <circle className="sd-port sd-port--cold" cx={212} cy={188} r={3.5} />

      {/* ── PRIMARY FLOW LANE (HP primary) ── */}
      {/* ASHP → primary pump */}
      <polyline
        className={`${pipeClass('sd-pipe--flow', paths.chFlow || paths.primaryReheat)}${pipeHighlightClass('pipe-flow', hl)}`}
        data-testid="pipe-ch-flow-boiler-tee"
        points="80,36 99,36"
      />
      {/* Primary pump → T-junction (where CH and cylinder branch) */}
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow || paths.primaryReheat)} points="129,36 136,36" />
      {/* T-junction drops to cylinder primary coil at y=68 */}
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow || paths.primaryReheat)} points="136,36 136,56" />
      {/* T → CH/UFH pump */}
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow)} points="136,36 147,36" />
      {/* CH pump → UFH/rads */}
      <polyline
        className={pipeClass('sd-pipe--flow', paths.chFlow)}
        data-testid="pipe-ch-flow-pump-rads"
        points="177,36 186,36"
      />

      {/* ── PRIMARY RETURN LANE ── */}
      <polyline
        className={`${pipeClass('sd-pipe--return', paths.chFlow)}${pipeHighlightClass('pipe-return', hl)}`}
        data-testid="pipe-ch-return"
        points="256,88 186,88 80,88"
      />
      {/* Expansion vessel vertical connection */}
      <polyline className="sd-pipe sd-pipe--return sd-pipe--inactive" points="276,88 276,48" />

      {/* ── HP primary to cylinder — T-junction drop → cylinder coil ── */}
      <polyline
        className={pipeClass('sd-pipe--dhw', paths.primaryReheat)}
        data-testid="pipe-primary-dhw"
        points="136,56 136,68 256,68"
      />

      {/* ── STORED HOT LANE ── */}
      {/* Cylinder draw — vertical drop */}
      <polyline
        className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)}
        data-testid="pipe-stored-hot-draw"
        points="286,122 286,148"
      />
      {/* Lane spine — horizontal distribution */}
      <polyline
        className={`${pipeClass('sd-pipe--dhw', paths.storedHotDraw)}${pipeHighlightClass('pipe-stored-hot', hl)}`}
        data-testid="pipe-stored-hot"
        points="8,148 286,148"
      />
      {/* Outlet drops */}
      <polyline className={pipeClass('sd-pipe--dhw', outlets.shower  && paths.storedHotDraw)} data-testid="pipe-dhw-shower" points="35,148 35,154" />
      <polyline className={pipeClass('sd-pipe--dhw', outlets.bath    && paths.storedHotDraw)} points="97,148 97,154" />
      <polyline className={pipeClass('sd-pipe--dhw', outlets.kitchen && paths.storedHotDraw)} points="163,148 163,154" />

      {/* ── COLD FEED LANE ── */}
      <polyline
        className={`${pipeClass('sd-pipe--cold', paths.coldSupply)}${pipeHighlightClass('pipe-cold-feed', hl)}`}
        data-testid="pipe-cold-feed"
        points="8,188 312,188"
      />
      {/* Branch: cold feed lane → cylinder cold fill */}
      <polyline
        className={pipeClass('sd-pipe--cold', paths.coldSupply)}
        data-testid="pipe-cold-supply"
        points="312,188 312,106"
      />

      <BadgeGroup badges={badges} />
    </svg>
  );
}

// ─── Dispatch: choose correct schematic family ────────────────────────────────

export default function SystemDiagramPanel({ state, highlightedComponents = [] }: Props) {
  const paths: ActivePaths = state ? deriveActivePaths(state) : IDLE_PATHS;
  const badges: BadgeSpec[] = state ? deriveBadges(state, paths) : [];
  const hl = highlightedComponents;

  const isHeatPump = state?.heatSourceType === 'heat_pump'
  const systemType = state?.systemType ?? 'combi'

  if (!state || systemType === 'combi') {
    return (
      <div className="system-diagram" data-testid="system-diagram-panel">
        <CombiSchematic state={state} paths={paths} badges={badges} highlightedComponents={hl} />
      </div>
    );
  }

  if (isHeatPump) {
    return (
      <div className="system-diagram" data-testid="system-diagram-panel">
        <HeatPumpSchematic state={state} paths={paths} badges={badges} highlightedComponents={hl} />
      </div>
    );
  }

  if (systemType === 'vented_cylinder') {
    return (
      <div className="system-diagram" data-testid="system-diagram-panel">
        <VentedSchematic state={state} paths={paths} badges={badges} highlightedComponents={hl} />
      </div>
    );
  }

  // unvented_cylinder — S-plan
  return (
    <div className="system-diagram" data-testid="system-diagram-panel">
      <StoredSchematic state={state} paths={paths} badges={badges} highlightedComponents={hl} />
    </div>
  );
}
