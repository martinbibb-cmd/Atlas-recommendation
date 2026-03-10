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

      <rect className="sd-domain sd-domain--heating" x={4}   y={4}   width={90}  height={120} />
      <rect className="sd-domain sd-domain--water"   x={200} y={4}   width={116} height={120} />
      <rect className="sd-domain sd-domain--dhw"     x={4}   y={136} width={312} height={66}  />

      <rect className="sd-node sd-node--boiler" x={14}  y={16} width={70} height={46} />
      <text className="sd-label"    x={49} y={33}>🔥 Boiler</text>
      <text className="sd-sublabel" x={49} y={48}>30 kW combi</text>
      <circle className="sd-port sd-port--hot"  cx={84}  cy={28} r={3} />
      <circle className="sd-port sd-port--cold" cx={84}  cy={52} r={3} />
      <circle className="sd-port sd-port--dhw"  cx={49}  cy={62} r={3} />
      <circle className="sd-port sd-port--cold" cx={14}  cy={39} r={3} />

      {condensingBadgeText && (
        <g transform="translate(8,62)">
          <rect className="sd-callout sd-callout--condensing" x={0} y={0} width={82} height={12} rx={3} ry={3} />
          <text className="sd-callout__text" x={41} y={8.5}>{condensingBadgeText}</text>
        </g>
      )}

      <rect className="sd-node sd-node--pump" x={104} y={16} width={48} height={36} />
      <text className="sd-label"    x={128} y={31}>⚙ Pump</text>
      <text className="sd-sublabel" x={128} y={44}>CH circuit</text>
      <circle className="sd-port sd-port--hot"  cx={104} cy={28} r={3} />
      <circle className="sd-port sd-port--hot"  cx={152} cy={28} r={3} />

      <rect className="sd-node sd-node--valve" x={104} y={66} width={48} height={34} />
      <text className="sd-label"    x={128} y={79}>⊘ Valve</text>
      <text className="sd-sublabel" x={128} y={91}>Zone 1</text>
      <circle className="sd-port sd-port--hot"  cx={104} cy={78} r={3} />
      <circle className="sd-port sd-port--hot"  cx={152} cy={78} r={3} />

      <rect className="sd-node sd-node--radiator" x={174} y={16} width={60} height={42} />
      <text className="sd-label"    x={204} y={32}>⊟ Rads</text>
      <text className="sd-sublabel" x={204} y={46}>6 radiators</text>
      <circle className="sd-port sd-port--hot"  cx={174} cy={26} r={3} />
      <circle className="sd-port sd-port--cold" cx={174} cy={46} r={3} />

      <rect className="sd-node sd-node--mains" x={250} y={16} width={58} height={36} />
      <text className="sd-label"    x={279} y={31}>⊕ Exp.</text>
      <text className="sd-sublabel" x={279} y={44}>vessel</text>

      <rect className="sd-node sd-node--cylinder" x={210} y={72} width={64} height={46} />
      <text className="sd-label"    x={242} y={88}>💧 Plate HEX</text>
      <text className="sd-sublabel" x={242} y={103}>On-demand DHW</text>
      <circle className="sd-port sd-port--dhw"  cx={210} cy={84} r={3} />
      <circle className="sd-port sd-port--cold" cx={274} cy={84} r={3} />

      <rect className="sd-node sd-node--outlet" x={14}  y={144} width={56} height={32} />
      <text className="sd-label"    x={42} y={157}>🚿 Shower</text>
      <text className="sd-sublabel" x={42} y={168}>{paths.comboDhw ? 'running' : 'idle'}</text>
      <circle className="sd-port sd-port--dhw"  cx={42} cy={144} r={3} />

      <rect className="sd-node sd-node--outlet" x={82}  y={144} width={56} height={32} />
      <text className="sd-label"    x={110} y={157}>🛁 Bath</text>
      <text className="sd-sublabel" x={110} y={168}>idle</text>
      <circle className="sd-port sd-port--dhw"  cx={110} cy={144} r={3} />

      <rect className="sd-node sd-node--outlet" x={150} y={144} width={72} height={32} />
      <text className="sd-label"    x={186} y={157}>🚰 Kitchen</text>
      <text className="sd-sublabel" x={186} y={168}>idle</text>
      <circle className="sd-port sd-port--dhw"  cx={186} cy={144} r={3} />

      <rect className="sd-node sd-node--mains" x={238} y={144} width={74} height={32} />
      <text className="sd-label"    x={275} y={157}>❄ Mains</text>
      <text className="sd-sublabel" x={275} y={168}>cold supply</text>
      <circle className="sd-port sd-port--cold" cx={238} cy={158} r={3} />

      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-flow-boiler-tee" points="84,28 96,28" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-flow-tee-pump" points="96,28 104,28" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} points="96,28 96,78 104,78" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-flow-pump-rads" points="152,28 174,28" />
      <polyline className={pipeClass('sd-pipe--return', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-return" points="174,46 164,46 164,58 84,58 84,52" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} points="152,78 166,78 166,32 174,32" />

      <polyline className={pipeClass('sd-pipe--dhw', paths.comboDhw)} data-testid="pipe-primary-dhw" points="49,62 49,136 126,136 126,90 210,90" />

      <polyline className={pipeClass('sd-pipe--dhw', paths.comboDhw)} data-testid="pipe-dhw-shower" points="49,136 42,136 42,144" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.comboDhw)} points="126,136 110,136 110,144" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.comboDhw)} points="186,136 186,144" />

      <polyline className={pipeClass('sd-pipe--cold', paths.coldSupply)} data-testid="pipe-cold-supply" points="275,144 275,128 6,128 6,39 14,39" />
      <polyline className={pipeClass('sd-pipe--cold', paths.coldSupply)} points="275,144 274,84" />

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

      <rect className="sd-domain sd-domain--heating" x={4}   y={4}   width={90}  height={120} />
      <rect className="sd-domain sd-domain--water"   x={200} y={4}   width={116} height={120} />
      <rect className="sd-domain sd-domain--dhw"     x={4}   y={136} width={312} height={66}  />

      <rect className="sd-node sd-node--boiler" x={14}  y={16} width={70} height={46} />
      <text className="sd-label"    x={49} y={33}>🔥 Boiler</text>
      <text className="sd-sublabel" x={49} y={48}>24 kW system</text>
      <circle className="sd-port sd-port--hot"  cx={84}  cy={24} r={3} />
      <circle className="sd-port sd-port--cold" cx={84}  cy={52} r={3} />

      {condensingBadgeText && (
        <g transform="translate(8,62)">
          <rect className="sd-callout sd-callout--condensing" x={0} y={0} width={82} height={12} rx={3} ry={3} />
          <text className="sd-callout__text" x={41} y={8.5}>{condensingBadgeText}</text>
        </g>
      )}

      <rect className="sd-node sd-node--valve" x={100} y={14} width={48} height={30} />
      <text className="sd-label"    x={124} y={26}>⊘ Valve</text>
      <text className="sd-sublabel" x={124} y={38}>CH zone</text>
      <circle className="sd-port sd-port--hot"  cx={100} cy={24} r={3} />
      <circle className="sd-port sd-port--hot"  cx={148} cy={24} r={3} />

      <rect className="sd-node sd-node--valve" x={100} y={56} width={48} height={30} />
      <text className="sd-label"    x={124} y={68}>⊘ Valve</text>
      <text className="sd-sublabel" x={124} y={80}>DHW zone</text>
      <circle className="sd-port sd-port--hot"  cx={100} cy={66} r={3} />
      <circle className="sd-port sd-port--hot"  cx={148} cy={66} r={3} />

      <rect className="sd-node sd-node--pump" x={160} y={14} width={38} height={30} />
      <text className="sd-label"    x={179} y={29}>⚙ Pump</text>
      <circle className="sd-port sd-port--hot"  cx={160} cy={24} r={3} />
      <circle className="sd-port sd-port--hot"  cx={198} cy={24} r={3} />

      <rect className="sd-node sd-node--radiator" x={206} y={10} width={56} height={34} />
      <text className="sd-label"    x={234} y={24}>⊟ Rads</text>
      <text className="sd-sublabel" x={234} y={37}>CH zone</text>
      <circle className="sd-port sd-port--hot"  cx={206} cy={20} r={3} />
      <circle className="sd-port sd-port--cold" cx={206} cy={38} r={3} />

      <rect className="sd-node sd-node--mains" x={272} y={54} width={44} height={28} />
      <text className="sd-label"    x={294} y={66}>⊕ Exp.</text>
      <text className="sd-sublabel" x={294} y={78}>vessel</text>

      <rect className="sd-node sd-node--cylinder" x={206} y={56} width={58} height={54} />
      <text className="sd-label"    x={235} y={74}>🛢 Cylinder</text>
      <text className="sd-sublabel" x={235} y={88}>Stored HW</text>
      <text className="sd-sublabel" x={235} y={102}>Unvented</text>
      <circle className="sd-port sd-port--dhw"  cx={206} cy={68} r={3} />
      <circle className="sd-port sd-port--cold" cx={264} cy={68} r={3} />
      <circle className="sd-port sd-port--dhw"  cx={235} cy={110} r={3} />

      {state?.cylinderFillPct !== undefined && (
        <rect
          className="sd-cylinder-fill"
          x={208}
          y={56 + 52 * (1 - state.cylinderFillPct)}
          width={54}
          height={52 * state.cylinderFillPct}
          rx={6}
        />
      )}

      <rect className="sd-node sd-node--outlet" x={14}  y={144} width={56} height={32} />
      <text className="sd-label"    x={42} y={157}>🚿 Shower</text>
      <text className="sd-sublabel" x={42} y={168}>{paths.storedHotDraw ? 'running' : 'idle'}</text>
      <circle className="sd-port sd-port--dhw"  cx={42} cy={144} r={3} />

      <rect className="sd-node sd-node--outlet" x={82}  y={144} width={56} height={32} />
      <text className="sd-label"    x={110} y={157}>🛁 Bath</text>
      <text className="sd-sublabel" x={110} y={168}>idle</text>
      <circle className="sd-port sd-port--dhw"  cx={110} cy={144} r={3} />

      <rect className="sd-node sd-node--outlet" x={150} y={144} width={72} height={32} />
      <text className="sd-label"    x={186} y={157}>🚰 Kitchen</text>
      <text className="sd-sublabel" x={186} y={168}>idle</text>
      <circle className="sd-port sd-port--dhw"  cx={186} cy={144} r={3} />

      <rect className="sd-node sd-node--mains" x={238} y={144} width={74} height={32} />
      <text className="sd-label"    x={275} y={157}>❄ Mains</text>
      <text className="sd-sublabel" x={275} y={168}>cold supply</text>
      <circle className="sd-port sd-port--cold" cx={238} cy={158} r={3} />

      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-flow-boiler-tee" points="84,24 100,24" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-flow-tee-pump" points="88,24 88,66 100,66" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} points="148,24 160,24" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-flow-pump-rads" points="198,24 206,24" />
      <polyline className={pipeClass('sd-pipe--return', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-return" points="206,38 196,38 196,58 84,58 84,52" />

      <polyline className={pipeClass('sd-pipe--dhw', paths.primaryReheat)} data-testid="pipe-primary-dhw" points="148,66 206,68" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.primaryReheat)} points="206,80 196,80 196,60 84,60 84,54" />

      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} data-testid="pipe-stored-hot-draw" points="235,110 235,136" />

      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} data-testid="pipe-dhw-shower" points="42,136 42,144" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} points="110,136 110,144" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} points="186,136 186,144" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} points="235,136 42,136" />

      <polyline className={pipeClass('sd-pipe--cold', paths.coldSupply)} data-testid="pipe-cold-supply" points="275,144 275,128 264,128 264,68" />

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

      <rect className="sd-domain sd-domain--heating" x={4}   y={4}   width={90}  height={120} />
      <rect className="sd-domain sd-domain--water"   x={200} y={4}   width={116} height={120} />
      <rect className="sd-domain sd-domain--dhw"     x={4}   y={136} width={312} height={66}  />

      <rect className="sd-node sd-node--boiler" x={10}  y={14} width={68} height={44} />
      <text className="sd-label"    x={44} y={30}>🔥 Boiler</text>
      <text className="sd-sublabel" x={44} y={44}>24 kW regular</text>
      <circle className="sd-port sd-port--hot"  cx={78}  cy={22} r={3} />
      <circle className="sd-port sd-port--cold" cx={78}  cy={50} r={3} />

      {condensingBadgeText && (
        <g transform="translate(8,58)">
          <rect className="sd-callout sd-callout--condensing" x={0} y={0} width={82} height={12} rx={3} ry={3} />
          <text className="sd-callout__text" x={41} y={8.5}>{condensingBadgeText}</text>
        </g>
      )}

      <rect className="sd-node sd-node--pump" x={96} y={12} width={44} height={28} />
      <text className="sd-label"    x={118} y={28}>⚙ Pump</text>
      <circle className="sd-port sd-port--hot"  cx={96}  cy={22} r={3} />
      <circle className="sd-port sd-port--hot"  cx={140} cy={22} r={3} />

      <rect className="sd-node sd-node--valve" x={98} y={56} width={56} height={36} />
      <text className="sd-label"    x={126} y={70}>◈ Y-plan</text>
      <text className="sd-sublabel" x={126} y={82}>Mid-pos valve</text>
      <circle className="sd-port sd-port--hot"  cx={98}  cy={64} r={3} />
      <circle className="sd-port sd-port--hot"  cx={154} cy={64} r={3} />
      <circle className="sd-port sd-port--dhw"  cx={126} cy={93} r={3} />

      <rect className="sd-node sd-node--radiator" x={164} y={12} width={54} height={34} />
      <text className="sd-label"    x={191} y={26}>⊟ Rads</text>
      <text className="sd-sublabel" x={191} y={38}>CH zone</text>
      <circle className="sd-port sd-port--hot"  cx={164} cy={20} r={3} />
      <circle className="sd-port sd-port--cold" cx={164} cy={38} r={3} />

      <rect className="sd-node sd-node--mains" x={240} y={6} width={70} height={28} />
      <text className="sd-label"    x={275} y={18}>🪣 CWS</text>
      <text className="sd-sublabel" x={275} y={29}>cistern</text>
      <circle className="sd-port sd-port--cold" cx={275} cy={34} r={3} />

      <rect className="sd-node sd-node--cylinder" x={208} y={48} width={58} height={62} />
      <text className="sd-label"    x={237} y={64}>🛢 Cylinder</text>
      <text className="sd-sublabel" x={237} y={78}>Stored HW</text>
      <text className="sd-sublabel" x={237} y={93}>Open vented</text>
      <circle className="sd-port sd-port--dhw"  cx={208} cy={62} r={3} />
      <circle className="sd-port sd-port--cold" cx={266} cy={62} r={3} />
      <circle className="sd-port sd-port--dhw"  cx={237} cy={110} r={3} />

      <polyline className="sd-pipe sd-pipe--cold sd-pipe--inactive" points="266,48 266,34 275,34" strokeDasharray="3,3" />

      {state?.cylinderFillPct !== undefined && (
        <rect
          className="sd-cylinder-fill"
          x={210}
          y={48 + 60 * (1 - state.cylinderFillPct)}
          width={54}
          height={60 * state.cylinderFillPct}
          rx={6}
        />
      )}

      <rect className="sd-node sd-node--outlet" x={14}  y={144} width={56} height={32} />
      <text className="sd-label"    x={42} y={157}>🚿 Shower</text>
      <text className="sd-sublabel" x={42} y={168}>{paths.storedHotDraw ? 'running' : 'idle'}</text>
      <circle className="sd-port sd-port--dhw"  cx={42} cy={144} r={3} />

      <rect className="sd-node sd-node--outlet" x={82}  y={144} width={56} height={32} />
      <text className="sd-label"    x={110} y={157}>🛁 Bath</text>
      <text className="sd-sublabel" x={110} y={168}>idle</text>
      <circle className="sd-port sd-port--dhw"  cx={110} cy={144} r={3} />

      <rect className="sd-node sd-node--outlet" x={150} y={144} width={72} height={32} />
      <text className="sd-label"    x={186} y={157}>🚰 Kitchen</text>
      <text className="sd-sublabel" x={186} y={168}>idle</text>
      <circle className="sd-port sd-port--dhw"  cx={186} cy={144} r={3} />

      <rect className="sd-node sd-node--mains" x={238} y={144} width={74} height={32} />
      <text className="sd-label"    x={275} y={157}>🪣 Tank-fed</text>
      <text className="sd-sublabel" x={275} y={168}>cold supply</text>
      <circle className="sd-port sd-port--cold" cx={238} cy={158} r={3} />

      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-flow-boiler-tee" points="78,22 96,22" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-flow-tee-pump" points="86,22 86,64 98,64" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-flow-pump-rads" points="140,22 154,64" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow, paths.chFaded)} points="154,64 164,20" />
      <polyline className={pipeClass('sd-pipe--return', paths.chFlow, paths.chFaded)} data-testid="pipe-ch-return" points="164,38 78,50" />

      <polyline className={pipeClass('sd-pipe--dhw', paths.primaryReheat)} data-testid="pipe-primary-dhw" points="126,93 126,136 208,136 208,62" />

      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} data-testid="pipe-stored-hot-draw" points="237,110 237,136" />

      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} data-testid="pipe-dhw-shower" points="42,136 42,144" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} points="110,136 110,144" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} points="186,136 186,144" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} points="237,136 42,136" />

      <polyline className={pipeClass('sd-pipe--cold', paths.coldSupply)} data-testid="pipe-cold-supply" points="275,144 275,128 266,128 266,62" />

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

      <rect className="sd-domain sd-domain--heating" x={4}   y={4}   width={90}  height={120} />
      <rect className="sd-domain sd-domain--water"   x={200} y={4}   width={116} height={120} />
      <rect className="sd-domain sd-domain--dhw"     x={4}   y={136} width={312} height={66}  />

      <rect className="sd-node sd-node--boiler" x={10}  y={12} width={70} height={52} />
      <text className="sd-label"    x={45} y={28}>🌬 ASHP</text>
      <text className="sd-sublabel" x={45} y={42}>Outside unit</text>
      <text className="sd-sublabel" x={45} y={56}>Low-temp loop</text>
      <circle className="sd-port sd-port--hot"  cx={80}  cy={22} r={3} />
      <circle className="sd-port sd-port--cold" cx={80}  cy={54} r={3} />

      {copText && (
        <g transform="translate(8,64)">
          <rect className="sd-callout sd-callout--condensing" x={0} y={0} width={60} height={12} rx={3} ry={3} />
          <text className="sd-callout__text" x={30} y={8.5}>{copText}</text>
        </g>
      )}

      <rect className="sd-node sd-node--pump" x={100} y={12} width={44} height={28} />
      <text className="sd-label"    x={122} y={26}>⚙ Pump</text>
      <text className="sd-sublabel" x={122} y={36}>Primary</text>
      <circle className="sd-port sd-port--hot"  cx={100} cy={22} r={3} />
      <circle className="sd-port sd-port--hot"  cx={144} cy={22} r={3} />

      <rect className="sd-node sd-node--pump" x={100} y={58} width={44} height={28} />
      <text className="sd-label"    x={122} y={72}>⚙ Pump</text>
      <text className="sd-sublabel" x={122} y={82}>CH/UFH</text>
      <circle className="sd-port sd-port--hot"  cx={100} cy={68} r={3} />
      <circle className="sd-port sd-port--hot"  cx={144} cy={68} r={3} />

      <rect className="sd-node sd-node--radiator" x={162} y={12} width={58} height={34} />
      <text className="sd-label"    x={191} y={26}>⊟ UFH</text>
      <text className="sd-sublabel" x={191} y={38}>Low-temp</text>
      <circle className="sd-port sd-port--hot"  cx={162} cy={20} r={3} />
      <circle className="sd-port sd-port--cold" cx={162} cy={38} r={3} />

      <rect className="sd-node sd-node--mains" x={254} y={52} width={44} height={28} />
      <text className="sd-label"    x={276} y={64}>⊕ Exp.</text>
      <text className="sd-sublabel" x={276} y={76}>vessel</text>

      <rect className="sd-node sd-node--cylinder" x={206} y={54} width={58} height={56} />
      <text className="sd-label"    x={235} y={70}>🛢 Cylinder</text>
      <text className="sd-sublabel" x={235} y={84}>Stored HW</text>
      <text className="sd-sublabel" x={235} y={98}>HP primary</text>
      <circle className="sd-port sd-port--dhw"  cx={206} cy={66} r={3} />
      <circle className="sd-port sd-port--cold" cx={264} cy={66} r={3} />
      <circle className="sd-port sd-port--dhw"  cx={235} cy={110} r={3} />

      {state?.cylinderFillPct !== undefined && (
        <rect
          className="sd-cylinder-fill"
          x={208}
          y={54 + 54 * (1 - state.cylinderFillPct)}
          width={54}
          height={54 * state.cylinderFillPct}
          rx={6}
        />
      )}

      <rect className="sd-node sd-node--outlet" x={14}  y={144} width={56} height={32} />
      <text className="sd-label"    x={42} y={157}>🚿 Shower</text>
      <text className="sd-sublabel" x={42} y={168}>{paths.storedHotDraw ? 'running' : 'idle'}</text>
      <circle className="sd-port sd-port--dhw"  cx={42} cy={144} r={3} />

      <rect className="sd-node sd-node--outlet" x={82}  y={144} width={56} height={32} />
      <text className="sd-label"    x={110} y={157}>🛁 Bath</text>
      <text className="sd-sublabel" x={110} y={168}>idle</text>
      <circle className="sd-port sd-port--dhw"  cx={110} cy={144} r={3} />

      <rect className="sd-node sd-node--outlet" x={150} y={144} width={72} height={32} />
      <text className="sd-label"    x={186} y={157}>🚰 Kitchen</text>
      <text className="sd-sublabel" x={186} y={168}>idle</text>
      <circle className="sd-port sd-port--dhw"  cx={186} cy={144} r={3} />

      <rect className="sd-node sd-node--mains" x={238} y={144} width={74} height={32} />
      <text className="sd-label"    x={275} y={157}>❄ Mains</text>
      <text className="sd-sublabel" x={275} y={168}>cold supply</text>
      <circle className="sd-port sd-port--cold" cx={238} cy={158} r={3} />

      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow || paths.primaryReheat)} data-testid="pipe-ch-flow-boiler-tee" points="80,22 100,22" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow || paths.primaryReheat)} data-testid="pipe-ch-flow-tee-pump" points="90,22 90,68 100,68" />
      <polyline className={pipeClass('sd-pipe--flow', paths.chFlow)} data-testid="pipe-ch-flow-pump-rads" points="144,22 162,22" />
      <polyline className={pipeClass('sd-pipe--return', paths.chFlow)} data-testid="pipe-ch-return" points="162,38 152,38 152,54 80,54" />

      <polyline className={pipeClass('sd-pipe--dhw', paths.primaryReheat)} data-testid="pipe-primary-dhw" points="144,68 206,66" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.primaryReheat)} points="206,78 194,78 194,56 80,56 80,54" />

      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} data-testid="pipe-stored-hot-draw" points="235,110 235,136" />

      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} data-testid="pipe-dhw-shower" points="42,136 42,144" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} points="110,136 110,144" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} points="186,136 186,144" />
      <polyline className={pipeClass('sd-pipe--dhw', paths.storedHotDraw)} points="235,136 42,136" />

      <polyline className={pipeClass('sd-pipe--cold', paths.coldSupply)} data-testid="pipe-cold-supply" points="275,144 275,128 264,128 264,66" />

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
