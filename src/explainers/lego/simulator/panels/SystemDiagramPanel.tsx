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

// ─── Schematic props ──────────────────────────────────────────────────────────

interface SchematicProps {
  state?: SystemDiagramDisplayState;
  paths: ActivePaths;
  badges: BadgeSpec[];
}

// ─── Schematic: Combi ─────────────────────────────────────────────────────────

function CombiSchematic({ state, paths, badges }: SchematicProps): ReactElement {
  const W = 320;
  const H = 210;

  const condensingBadgeText: string | null =
    state?.condensingState === 'condensing'     ? '🟢 Condensing'     :
    state?.condensingState === 'borderline'     ? '🟡 Borderline'     :
    state?.condensingState === 'not_condensing' ? '🔴 Not condensing' :
    null;

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
      <rect className="sd-domain sd-domain--heating" x={4}   y={4}   width={90}  height={124} />
      <rect className="sd-domain sd-domain--water"   x={200} y={4}   width={116} height={124} />
      <rect className="sd-domain sd-domain--dhw"     x={4}   y={136} width={312} height={66}  />

      {/* Domain labels */}
      <DomainLabel x={8}   y={15}  text="CH circuit" />
      <DomainLabel x={204} y={15}  text="Emitters + vessel" />
      <DomainLabel x={8}   y={146} text="Draw-off (on-demand)" />

      {/* ── Boiler ── */}
      <rect className="sd-node sd-node--boiler" x={10}  y={18} width={74} height={48} rx={8} ry={8} />
      <text className="sd-label"    x={47} y={35}>🔥 Combi</text>
      <text className="sd-sublabel" x={47} y={50}>30 kW boiler</text>
      <circle className="sd-port sd-port--hot"  cx={84}  cy={28} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={84}  cy={54} r={3.5} />
      <circle className="sd-port sd-port--dhw"  cx={47}  cy={66} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={10}  cy={39} r={3.5} />

      {condensingBadgeText && (
        <g transform="translate(8,70)">
          <rect className="sd-callout sd-callout--condensing" x={0} y={0} width={80} height={13} rx={4} ry={4} />
          <text className="sd-callout__text" x={40} y={9}>{condensingBadgeText}</text>
        </g>
      )}

      {/* ── Pump (circle shape) ── */}
      <circle className="sd-node sd-node--pump" cx={128} cy={32} r={17} />
      <text className="sd-label"    x={128} y={30}>⚙</text>
      <text className="sd-sublabel" x={128} y={41}>Pump</text>
      <circle className="sd-port sd-port--hot"  cx={111} cy={32} r={3.5} />
      <circle className="sd-port sd-port--hot"  cx={145} cy={32} r={3.5} />

      {/* ── Zone valve ── */}
      <rect className="sd-node sd-node--valve" x={104} y={66} width={48} height={34} rx={6} ry={6} />
      <text className="sd-label"    x={128} y={79}>⊘ Valve</text>
      <text className="sd-sublabel" x={128} y={91}>Zone 1</text>
      <circle className="sd-port sd-port--hot"  cx={104} cy={78} r={3.5} />
      <circle className="sd-port sd-port--hot"  cx={152} cy={78} r={3.5} />

      {/* ── Radiators ── */}
      <rect className="sd-node sd-node--radiator" x={172} y={18} width={62} height={44} rx={6} ry={6} />
      <text className="sd-label"    x={203} y={34}>▤ Radiators</text>
      <text className="sd-sublabel" x={203} y={48}>6 emitters</text>
      <circle className="sd-port sd-port--hot"  cx={172} cy={28} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={172} cy={48} r={3.5} />

      {/* ── Expansion vessel ── */}
      <rect className="sd-node sd-node--mains" x={248} y={18} width={60} height={34} rx={6} ry={6} />
      <text className="sd-label"    x={278} y={32}>⊕ Exp.</text>
      <text className="sd-sublabel" x={278} y={44}>vessel</text>

      {/* ── Plate HEX ── */}
      <rect className="sd-node sd-node--cylinder" x={208} y={74} width={66} height={48} rx={6} ry={6} />
      <text className="sd-label"    x={241} y={91}>⇌ Plate HEX</text>
      <text className="sd-sublabel" x={241} y={106}>On-demand DHW</text>
      <circle className="sd-port sd-port--dhw"  cx={208} cy={86} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={274} cy={86} r={3.5} />

      {/* ── Outlets ── */}
      <rect className="sd-node sd-node--outlet" x={10}  y={152} width={58} height={32} rx={6} ry={6} />
      <text className="sd-label"    x={39} y={165}>🚿 Shower</text>
      <text className="sd-sublabel" x={39} y={176}>{paths.comboDhw ? 'open' : 'closed'}</text>
      <circle className="sd-port sd-port--dhw"  cx={39} cy={152} r={3.5} />

      <rect className="sd-node sd-node--outlet" x={80}  y={152} width={54} height={32} rx={6} ry={6} />
      <text className="sd-label"    x={107} y={165}>🛁 Bath</text>
      <text className="sd-sublabel" x={107} y={176}>closed</text>
      <circle className="sd-port sd-port--dhw"  cx={107} cy={152} r={3.5} />

      <rect className="sd-node sd-node--outlet" x={146} y={152} width={68} height={32} rx={6} ry={6} />
      <text className="sd-label"    x={180} y={165}>🚰 Kitchen</text>
      <text className="sd-sublabel" x={180} y={176}>closed</text>
      <circle className="sd-port sd-port--dhw"  cx={180} cy={152} r={3.5} />

      <rect className="sd-node sd-node--mains" x={232} y={152} width={80} height={32} rx={6} ry={6} />
      <text className="sd-label"    x={272} y={165}>❄ Mains cold</text>
      <text className="sd-sublabel" x={272} y={176}>supply</text>
      <circle className="sd-port sd-port--cold" cx={232} cy={162} r={3.5} />

      {/* ── CH pipes ── */}
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-flow-boiler-tee" points="84,28 94,28" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-flow-tee-pump" points="94,28 111,28 111,32" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} points="94,28 94,78 104,78" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-flow-pump-rads" points="145,32 145,28 172,28" />
      <polyline className={pipeClass('sd-pipe--return', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-return" points="172,48 162,48 162,60 84,60 84,54" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} points="152,78 168,78 168,34 172,34" />

      {/* ── DHW pipes ── */}
      <polyline className={pipeClass('sd-pipe--dhw', paths.comboDhw)} data-testid="pipe-primary-dhw" points="47,66 47,144 128,144 128,92 208,92" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.comboDhw)} data-testid="pipe-dhw-shower" points="47,144 39,144 39,152" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.comboDhw)} points="128,144 107,144 107,152" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.comboDhw)} points="180,144 180,152" />

      {/* ── Cold supply ── */}
      <polyline className={pipeClass('sd-pipe--cold', paths.coldSupply)} data-testid="pipe-cold-supply" points="272,152 272,132 6,132 6,39 10,39" />
      <polyline className={pipeClass('sd-pipe--cold', paths.coldSupply)} points="272,152 274,86" />

      <BadgeGroup badges={badges} />
    </svg>
  );
}

// ─── Schematic: S-plan Unvented ───────────────────────────────────────────────

function StoredSchematic({ state, paths, badges }: SchematicProps): ReactElement {
  const W = 320;
  const H = 210;

  const condensingBadgeText: string | null =
    state?.condensingState === 'condensing'     ? '🟢 Condensing'     :
    state?.condensingState === 'borderline'     ? '🟡 Borderline'     :
    state?.condensingState === 'not_condensing' ? '🔴 Not condensing' :
    null;

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
      <rect className="sd-domain sd-domain--heating" x={4}   y={4}   width={90}  height={124} />
      <rect className="sd-domain sd-domain--water"   x={200} y={4}   width={116} height={124} />
      <rect className="sd-domain sd-domain--dhw"     x={4}   y={136} width={312} height={66}  />

      {/* Domain labels */}
      <DomainLabel x={8}   y={15}  text="CH circuit (S-plan)" />
      <DomainLabel x={204} y={15}  text="Cylinder (unvented)" />
      <DomainLabel x={8}   y={146} text="Draw-off (stored HW)" />

      {/* ── System boiler ── */}
      <rect className="sd-node sd-node--boiler" x={10}  y={18} width={74} height={48} rx={8} ry={8} />
      <text className="sd-label"    x={47} y={35}>🔥 System</text>
      <text className="sd-sublabel" x={47} y={50}>24 kW boiler</text>
      <circle className="sd-port sd-port--hot"  cx={84}  cy={26} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={84}  cy={54} r={3.5} />

      {condensingBadgeText && (
        <g transform="translate(8,70)">
          <rect className="sd-callout sd-callout--condensing" x={0} y={0} width={80} height={13} rx={4} ry={4} />
          <text className="sd-callout__text" x={40} y={9}>{condensingBadgeText}</text>
        </g>
      )}

      {/* ── CH zone valve ── */}
      <rect className="sd-node sd-node--valve" x={100} y={14} width={48} height={32} rx={5} ry={5} />
      <text className="sd-label"    x={124} y={27}>⊘ CH</text>
      <text className="sd-sublabel" x={124} y={39}>zone valve</text>
      <circle className="sd-port sd-port--hot"  cx={100} cy={26} r={3.5} />
      <circle className="sd-port sd-port--hot"  cx={148} cy={26} r={3.5} />

      {/* ── DHW zone valve ── */}
      <rect className="sd-node sd-node--valve" x={100} y={58} width={48} height={32} rx={5} ry={5} />
      <text className="sd-label"    x={124} y={70}>⊘ DHW</text>
      <text className="sd-sublabel" x={124} y={82}>zone valve</text>
      <circle className="sd-port sd-port--hot"  cx={100} cy={68} r={3.5} />
      <circle className="sd-port sd-port--hot"  cx={148} cy={68} r={3.5} />

      {/* ── Pump (circle) ── */}
      <circle className="sd-node sd-node--pump" cx={179} cy={26} r={15} />
      <text className="sd-label"    x={179} y={24}>⚙</text>
      <text className="sd-sublabel" x={179} y={34}>Pump</text>
      <circle className="sd-port sd-port--hot"  cx={164} cy={26} r={3.5} />
      <circle className="sd-port sd-port--hot"  cx={194} cy={26} r={3.5} />

      {/* ── Radiators ── */}
      <rect className="sd-node sd-node--radiator" x={204} y={10} width={58} height={34} rx={6} ry={6} />
      <text className="sd-label"    x={233} y={24}>▤ Radiators</text>
      <text className="sd-sublabel" x={233} y={36}>CH emitters</text>
      <circle className="sd-port sd-port--hot"  cx={204} cy={20} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={204} cy={38} r={3.5} />

      {/* ── Expansion vessel ── */}
      <rect className="sd-node sd-node--mains" x={270} y={54} width={46} height={28} rx={6} ry={6} />
      <text className="sd-label"    x={293} y={66}>⊕ Exp.</text>
      <text className="sd-sublabel" x={293} y={77}>vessel</text>

      {/* ── Unvented cylinder ── */}
      <rect className="sd-node sd-node--cylinder" x={204} y={56} width={60} height={56} rx={8} ry={8} />
      {/* Cylinder dome / top cap */}
      <ellipse cx={234} cy={56} rx={28} ry={7} fill="#bee3f8" stroke="#2b6cb0" strokeWidth={1.5} opacity={0.7} />
      <text className="sd-label"    x={234} y={77}>🛢 Cylinder</text>
      <text className="sd-sublabel" x={234} y={91}>Unvented HW</text>
      <circle className="sd-port sd-port--dhw"  cx={204} cy={70} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={264} cy={70} r={3.5} />
      <circle className="sd-port sd-port--dhw"  cx={234} cy={112} r={3.5} />

      {state?.cylinderFillPct !== undefined && (
        <rect
          className="sd-cylinder-fill"
          x={206}
          y={58 + 52 * (1 - state.cylinderFillPct)}
          width={56}
          height={52 * state.cylinderFillPct}
          rx={5}
        />
      )}

      {/* ── Outlets ── */}
      <rect className="sd-node sd-node--outlet" x={10}  y={152} width={58} height={32} rx={6} ry={6} />
      <text className="sd-label"    x={39} y={165}>🚿 Shower</text>
      <text className="sd-sublabel" x={39} y={176}>{paths.storedHotDraw ? 'open' : 'closed'}</text>
      <circle className="sd-port sd-port--dhw"  cx={39} cy={152} r={3.5} />

      <rect className="sd-node sd-node--outlet" x={80}  y={152} width={54} height={32} rx={6} ry={6} />
      <text className="sd-label"    x={107} y={165}>🛁 Bath</text>
      <text className="sd-sublabel" x={107} y={176}>closed</text>
      <circle className="sd-port sd-port--dhw"  cx={107} cy={152} r={3.5} />

      <rect className="sd-node sd-node--outlet" x={146} y={152} width={68} height={32} rx={6} ry={6} />
      <text className="sd-label"    x={180} y={165}>🚰 Kitchen</text>
      <text className="sd-sublabel" x={180} y={176}>closed</text>
      <circle className="sd-port sd-port--dhw"  cx={180} cy={152} r={3.5} />

      <rect className="sd-node sd-node--mains" x={226} y={152} width={86} height={32} rx={6} ry={6} />
      <text className="sd-label"    x={269} y={165}>❄ Mains cold</text>
      <text className="sd-sublabel" x={269} y={176}>supply</text>
      <circle className="sd-port sd-port--cold" cx={226} cy={162} r={3.5} />

      {/* ── CH pipes ── */}
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-flow-boiler-tee" points="84,26 100,26" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-flow-tee-pump" points="88,26 88,68 100,68" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} points="148,26 164,26" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-flow-pump-rads" points="194,26 204,26" />
      <polyline className={pipeClass('sd-pipe--return', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-return" points="204,38 196,38 196,60 84,60 84,54" />

      {/* ── Primary DHW (cylinder reheat) ── */}
      <polyline className={pipeClass('sd-pipe--dhw', paths.primaryReheat)} data-testid="pipe-primary-dhw" points="148,68 204,70" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.primaryReheat)} points="204,82 196,82 196,62 84,62 84,56" />

      {/* ── Stored hot draw ── */}
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} data-testid="pipe-stored-hot-draw" points="234,112 234,144" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} data-testid="pipe-dhw-shower" points="39,144 39,152" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} points="107,144 107,152" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} points="180,144 180,152" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} points="234,144 39,144" />

      {/* ── Cold supply (mains to cylinder) ── */}
      <polyline className={pipeClass('sd-pipe--cold', paths.coldSupply)} data-testid="pipe-cold-supply" points="269,152 269,130 264,130 264,70" />

      <BadgeGroup badges={badges} />
    </svg>
  );
}

// ─── Schematic: Y-plan Open Vented ───────────────────────────────────────────

function VentedSchematic({ state, paths, badges }: SchematicProps): ReactElement {
  const W = 320;
  const H = 210;

  const condensingBadgeText: string | null =
    state?.condensingState === 'condensing'     ? '🟢 Condensing'     :
    state?.condensingState === 'borderline'     ? '🟡 Borderline'     :
    state?.condensingState === 'not_condensing' ? '🔴 Not condensing' :
    null;

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
      <rect className="sd-domain sd-domain--heating" x={4}   y={4}   width={90}  height={124} />
      <rect className="sd-domain sd-domain--water"   x={198} y={4}   width={118} height={124} />
      <rect className="sd-domain sd-domain--dhw"     x={4}   y={136} width={312} height={66}  />

      {/* Domain labels */}
      <DomainLabel x={8}   y={15}  text="CH circuit (Y-plan)" />
      <DomainLabel x={202} y={15}  text="Cylinder (open vented)" />
      <DomainLabel x={8}   y={146} text="Draw-off (stored HW)" />

      {/* ── Regular boiler ── */}
      <rect className="sd-node sd-node--boiler" x={8}  y={16} width={70} height={46} rx={8} ry={8} />
      <text className="sd-label"    x={43} y={33}>🔥 Regular</text>
      <text className="sd-sublabel" x={43} y={48}>24 kW boiler</text>
      <circle className="sd-port sd-port--hot"  cx={78}  cy={24} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={78}  cy={52} r={3.5} />

      {condensingBadgeText && (
        <g transform="translate(6,66)">
          <rect className="sd-callout sd-callout--condensing" x={0} y={0} width={80} height={13} rx={4} ry={4} />
          <text className="sd-callout__text" x={40} y={9}>{condensingBadgeText}</text>
        </g>
      )}

      {/* ── CH pump (circle) ── */}
      <circle className="sd-node sd-node--pump" cx={116} cy={24} r={16} />
      <text className="sd-label"    x={116} y={22}>⚙</text>
      <text className="sd-sublabel" x={116} y={32}>Pump</text>
      <circle className="sd-port sd-port--hot"  cx={100} cy={24} r={3.5} />
      <circle className="sd-port sd-port--hot"  cx={132} cy={24} r={3.5} />

      {/* ── Y-plan mid-position valve ── */}
      <rect className="sd-node sd-node--valve" x={96} y={54} width={58} height={38} rx={6} ry={6} />
      <text className="sd-label"    x={125} y={69}>◈ Y-plan</text>
      <text className="sd-sublabel" x={125} y={82}>mid-pos valve</text>
      <circle className="sd-port sd-port--hot"  cx={96}  cy={66} r={3.5} />
      <circle className="sd-port sd-port--hot"  cx={154} cy={66} r={3.5} />
      <circle className="sd-port sd-port--dhw"  cx={125} cy={93} r={3.5} />

      {/* ── Radiators ── */}
      <rect className="sd-node sd-node--radiator" x={160} y={12} width={56} height={36} rx={6} ry={6} />
      <text className="sd-label"    x={188} y={27}>▤ Radiators</text>
      <text className="sd-sublabel" x={188} y={40}>CH emitters</text>
      <circle className="sd-port sd-port--hot"  cx={160} cy={22} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={160} cy={40} r={3.5} />

      {/* ── CWS cistern (open vented tank) ── */}
      <rect className="sd-node sd-node--mains" x={238} y={6} width={74} height={30} rx={6} ry={6} />
      {/* Water level indicator */}
      <rect x={240} y={20} width={70} height={12} rx={3} fill="#90cdf4" opacity={0.4} />
      <text className="sd-label"    x={275} y={16}>🪣 CWS</text>
      <text className="sd-sublabel" x={275} y={28}>cistern</text>
      <circle className="sd-port sd-port--cold" cx={275} cy={36} r={3.5} />

      {/* ── Open vented cylinder ── */}
      <rect className="sd-node sd-node--cylinder" x={206} y={48} width={60} height={64} rx={8} ry={8} />
      {/* Cylinder dome / top cap */}
      <ellipse cx={236} cy={48} rx={28} ry={6} fill="#bee3f8" stroke="#2b6cb0" strokeWidth={1.5} opacity={0.7} />
      {/* Vent pipe indicator at top */}
      <line x1={236} y1={42} x2={236} y2={36} stroke="#90cdf4" strokeWidth={2} strokeDasharray="2,2" opacity={0.6} />
      <text className="sd-label"    x={236} y={68}>🛢 Cylinder</text>
      <text className="sd-sublabel" x={236} y={82}>Open vented</text>
      <circle className="sd-port sd-port--dhw"  cx={206} cy={64} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={266} cy={64} r={3.5} />
      <circle className="sd-port sd-port--dhw"  cx={236} cy={112} r={3.5} />

      {/* Gravity cold feed from CWS to cylinder */}
      <polyline className="sd-pipe sd-pipe--cold sd-pipe--inactive" points="266,48 266,36 275,36" />

      {state?.cylinderFillPct !== undefined && (
        <rect
          className="sd-cylinder-fill"
          x={208}
          y={50 + 60 * (1 - state.cylinderFillPct)}
          width={56}
          height={60 * state.cylinderFillPct}
          rx={5}
        />
      )}

      {/* ── Outlets ── */}
      <rect className="sd-node sd-node--outlet" x={10}  y={152} width={58} height={32} rx={6} ry={6} />
      <text className="sd-label"    x={39} y={165}>🚿 Shower</text>
      <text className="sd-sublabel" x={39} y={176}>{paths.storedHotDraw ? 'open' : 'closed'}</text>
      <circle className="sd-port sd-port--dhw"  cx={39} cy={152} r={3.5} />

      <rect className="sd-node sd-node--outlet" x={80}  y={152} width={54} height={32} rx={6} ry={6} />
      <text className="sd-label"    x={107} y={165}>🛁 Bath</text>
      <text className="sd-sublabel" x={107} y={176}>closed</text>
      <circle className="sd-port sd-port--dhw"  cx={107} cy={152} r={3.5} />

      <rect className="sd-node sd-node--outlet" x={146} y={152} width={68} height={32} rx={6} ry={6} />
      <text className="sd-label"    x={180} y={165}>🚰 Kitchen</text>
      <text className="sd-sublabel" x={180} y={176}>closed</text>
      <circle className="sd-port sd-port--dhw"  cx={180} cy={152} r={3.5} />

      <rect className="sd-node sd-node--mains" x={226} y={152} width={86} height={32} rx={6} ry={6} />
      <text className="sd-label"    x={269} y={165}>🪣 Tank-fed</text>
      <text className="sd-sublabel" x={269} y={176}>cold supply</text>
      <circle className="sd-port sd-port--cold" cx={226} cy={162} r={3.5} />

      {/* ── CH pipes (orthogonal routing) ── */}
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-flow-boiler-tee" points="78,24 100,24" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-flow-tee-pump" points="86,24 86,66 96,66" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-flow-pump-rads" points="132,24 148,24 148,66" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} points="154,66 160,22" />
      <polyline className={pipeClass('sd-pipe--return', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-return" points="160,40 78,52" />

      {/* ── Primary DHW (Y-plan cylinder reheat) ── */}
      <polyline className={pipeClass('sd-pipe--dhw', paths.primaryReheat)} data-testid="pipe-primary-dhw" points="125,92 125,144 206,144 206,64" />

      {/* ── Stored hot draw ── */}
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} data-testid="pipe-stored-hot-draw" points="236,112 236,144" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} data-testid="pipe-dhw-shower" points="39,144 39,152" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} points="107,144 107,152" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} points="180,144 180,152" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} points="236,144 39,144" />

      {/* ── Gravity cold supply (CWS tank-fed) ── */}
      <polyline className={pipeClass('sd-pipe--cold', paths.coldSupply)} data-testid="pipe-cold-supply" points="269,152 269,130 266,130 266,64" />

      <BadgeGroup badges={badges} />
    </svg>
  );
}

/** Format a COP value for display in the schematic badge. */
function formatCop(cop: number): string {
  return `COP ${cop.toFixed(1)}`
}

// ─── Schematic: Heat pump + cylinder ─────────────────────────────────────────

function HeatPumpSchematic({ state, paths, badges }: SchematicProps): ReactElement {
  const W = 320;
  const H = 210;

  const copText = state?.cop !== undefined ? formatCop(state.cop) : null

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
      <rect className="sd-domain sd-domain--heating" x={4}   y={4}   width={90}  height={124} />
      <rect className="sd-domain sd-domain--water"   x={200} y={4}   width={116} height={124} />
      <rect className="sd-domain sd-domain--dhw"     x={4}   y={136} width={312} height={66}  />

      {/* Domain labels */}
      <DomainLabel x={8}   y={15}  text="Heat pump loop" />
      <DomainLabel x={204} y={15}  text="Cylinder (HP primary)" />
      <DomainLabel x={8}   y={146} text="Draw-off (stored HW)" />

      {/* ── ASHP unit (outside) ── */}
      <rect className="sd-node sd-node--boiler" x={8}  y={16} width={74} height={54} rx={8} ry={8} />
      {/* Fan indicator */}
      <circle cx={45} cy={32} r={8} fill="none" stroke="#90cdf4" strokeWidth={1.5} opacity={0.6} />
      <text className="sd-label"    x={45} y={30}>🌬 ASHP</text>
      <text className="sd-sublabel" x={45} y={44}>Outside unit</text>
      <text className="sd-sublabel" x={45} y={58}>Low-temp</text>
      <circle className="sd-port sd-port--hot"  cx={82}  cy={24} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={82}  cy={56} r={3.5} />

      {copText && (
        <g transform="translate(8,74)">
          <rect className="sd-callout sd-callout--condensing" x={0} y={0} width={72} height={13} rx={4} ry={4} />
          <text className="sd-callout__text" x={36} y={9}>{copText}</text>
        </g>
      )}

      {/* ── Primary pump (circle) ── */}
      <circle className="sd-node sd-node--pump" cx={118} cy={24} r={15} />
      <text className="sd-label"    x={118} y={22}>⚙</text>
      <text className="sd-sublabel" x={118} y={32}>Primary</text>
      <circle className="sd-port sd-port--hot"  cx={103} cy={24} r={3.5} />
      <circle className="sd-port sd-port--hot"  cx={133} cy={24} r={3.5} />

      {/* ── CH/UFH pump (circle) ── */}
      <circle className="sd-node sd-node--pump" cx={118} cy={68} r={15} />
      <text className="sd-label"    x={118} y={66}>⚙</text>
      <text className="sd-sublabel" x={118} y={76}>CH/UFH</text>
      <circle className="sd-port sd-port--hot"  cx={103} cy={68} r={3.5} />
      <circle className="sd-port sd-port--hot"  cx={133} cy={68} r={3.5} />

      {/* ── UFH / radiators ── */}
      <rect className="sd-node sd-node--radiator" x={158} y={12} width={62} height={36} rx={6} ry={6} />
      <text className="sd-label"    x={189} y={27}>▤ UFH/Rads</text>
      <text className="sd-sublabel" x={189} y={40}>Low-temp</text>
      <circle className="sd-port sd-port--hot"  cx={158} cy={22} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={158} cy={40} r={3.5} />

      {/* ── Expansion vessel ── */}
      <rect className="sd-node sd-node--mains" x={252} y={54} width={46} height={28} rx={6} ry={6} />
      <text className="sd-label"    x={275} y={66}>⊕ Exp.</text>
      <text className="sd-sublabel" x={275} y={77}>vessel</text>

      {/* ── Hot water cylinder ── */}
      <rect className="sd-node sd-node--cylinder" x={204} y={54} width={60} height={58} rx={8} ry={8} />
      {/* Cylinder dome */}
      <ellipse cx={234} cy={54} rx={28} ry={6} fill="#bee3f8" stroke="#2b6cb0" strokeWidth={1.5} opacity={0.7} />
      <text className="sd-label"    x={234} y={74}>🛢 Cylinder</text>
      <text className="sd-sublabel" x={234} y={88}>HP heated HW</text>
      <circle className="sd-port sd-port--dhw"  cx={204} cy={68} r={3.5} />
      <circle className="sd-port sd-port--cold" cx={264} cy={68} r={3.5} />
      <circle className="sd-port sd-port--dhw"  cx={234} cy={112} r={3.5} />

      {state?.cylinderFillPct !== undefined && (
        <rect
          className="sd-cylinder-fill"
          x={206}
          y={56 + 54 * (1 - state.cylinderFillPct)}
          width={56}
          height={54 * state.cylinderFillPct}
          rx={5}
        />
      )}

      {/* ── Outlets ── */}
      <rect className="sd-node sd-node--outlet" x={10}  y={152} width={58} height={32} rx={6} ry={6} />
      <text className="sd-label"    x={39} y={165}>🚿 Shower</text>
      <text className="sd-sublabel" x={39} y={176}>{paths.storedHotDraw ? 'open' : 'closed'}</text>
      <circle className="sd-port sd-port--dhw"  cx={39} cy={152} r={3.5} />

      <rect className="sd-node sd-node--outlet" x={80}  y={152} width={54} height={32} rx={6} ry={6} />
      <text className="sd-label"    x={107} y={165}>🛁 Bath</text>
      <text className="sd-sublabel" x={107} y={176}>closed</text>
      <circle className="sd-port sd-port--dhw"  cx={107} cy={152} r={3.5} />

      <rect className="sd-node sd-node--outlet" x={146} y={152} width={68} height={32} rx={6} ry={6} />
      <text className="sd-label"    x={180} y={165}>🚰 Kitchen</text>
      <text className="sd-sublabel" x={180} y={176}>closed</text>
      <circle className="sd-port sd-port--dhw"  cx={180} cy={152} r={3.5} />

      <rect className="sd-node sd-node--mains" x={226} y={152} width={86} height={32} rx={6} ry={6} />
      <text className="sd-label"    x={269} y={165}>❄ Mains cold</text>
      <text className="sd-sublabel" x={269} y={176}>supply</text>
      <circle className="sd-port sd-port--cold" cx={226} cy={162} r={3.5} />

      {/* ── Primary loop (HP ↔ cylinder) ── */}
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow || paths.primaryReheat)} data-testid="pipe-ch-flow-boiler-tee" points="82,24 103,24" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow || paths.primaryReheat)} data-testid="pipe-ch-flow-tee-pump" points="92,24 92,68 103,68" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow)} data-testid="pipe-ch-flow-pump-rads" points="133,24 150,24 150,22 158,22" />
      <polyline className={pipeClass('sd-pipe--return', paths.chFlow)} data-testid="pipe-ch-return" points="158,40 148,40 148,56 82,56" />

      {/* ── HP primary to cylinder ── */}
      <polyline className={pipeClass('sd-pipe--dhw', paths.primaryReheat)} data-testid="pipe-primary-dhw" points="133,68 204,68" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.primaryReheat)} points="204,80 192,80 192,58 82,58 82,56" />

      {/* ── Stored hot draw ── */}
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} data-testid="pipe-stored-hot-draw" points="234,112 234,144" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} data-testid="pipe-dhw-shower" points="39,144 39,152" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} points="107,144 107,152" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} points="180,144 180,152" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} points="234,144 39,144" />

      {/* ── Cold supply ── */}
      <polyline className={pipeClass('sd-pipe--cold', paths.coldSupply)} data-testid="pipe-cold-supply" points="269,152 269,130 264,130 264,68" />

      <BadgeGroup badges={badges} />
    </svg>
  );
}

// ─── Dispatch: choose correct schematic family ────────────────────────────────

export default function SystemDiagramPanel({ state }: Props) {
  const paths: ActivePaths = state ? deriveActivePaths(state) : IDLE_PATHS;
  const badges: BadgeSpec[] = state ? deriveBadges(state, paths) : [];

  const isHeatPump = state?.heatSourceType === 'heat_pump'
  const systemType = state?.systemType ?? 'combi'

  if (!state || systemType === 'combi') {
    return (
      <div className="system-diagram" data-testid="system-diagram-panel">
        <CombiSchematic state={state} paths={paths} badges={badges} />
      </div>
    );
  }

  if (isHeatPump) {
    return (
      <div className="system-diagram" data-testid="system-diagram-panel">
        <HeatPumpSchematic state={state} paths={paths} badges={badges} />
      </div>
    );
  }

  if (systemType === 'vented_cylinder') {
    return (
      <div className="system-diagram" data-testid="system-diagram-panel">
        <VentedSchematic state={state} paths={paths} badges={badges} />
      </div>
    );
  }

  // unvented_cylinder — S-plan
  return (
    <div className="system-diagram" data-testid="system-diagram-panel">
      <StoredSchematic state={state} paths={paths} badges={badges} />
    </div>
  );
}
