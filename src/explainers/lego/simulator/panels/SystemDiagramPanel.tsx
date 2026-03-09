/**
 * SystemDiagramPanel — static schematic visual for the System Diagram panel.
 *
 * Uses SVG with:
 *  - rounded component cards with domain-colour styling
 *  - thick routed pipes (flow/return/cold/DHW colour-coded)
 *  - visible connection ports
 *  - subtle grid background
 *  - system-colour domain regions
 *
 * PR1: static layout. Live state wiring comes in a later PR.
 */

import type { ReactElement } from 'react';

export default function SystemDiagramPanel() {
  const W = 320;
  const H = 210;

  // Grid
  const gridLines: ReactElement[] = [];
  for (let x = 0; x <= W; x += 20) {
    gridLines.push(<line key={`gx${x}`} className="sd-grid-line" x1={x} y1={0} x2={x} y2={H} />);
  }
  for (let y = 0; y <= H; y += 20) {
    gridLines.push(<line key={`gy${y}`} className="sd-grid-line" x1={0} y1={y} x2={W} y2={y} />);
  }

  return (
    <div className="system-diagram">
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
        <text className="sd-sublabel" x={49} y={48}>30 kW combi</text>
        {/* Port: flow out (right) */}
        <circle className="sd-port sd-port--hot"  cx={84}  cy={28} r={3} />
        {/* Port: return in (right) */}
        <circle className="sd-port sd-port--cold" cx={84}  cy={52} r={3} />
        {/* Port: DHW out (bottom) */}
        <circle className="sd-port sd-port--dhw"  cx={49}  cy={62} r={3} />
        {/* Port: cold in (left) */}
        <circle className="sd-port sd-port--cold" cx={14}  cy={39} r={3} />

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

        {/* ── Cylinder / DHW ──────────────────────────────────────────────── */}
        <rect className="sd-node sd-node--cylinder" x={210} y={72} width={64} height={46} />
        <text className="sd-label"    x={242} y={90}>💧 DHW</text>
        <text className="sd-sublabel" x={242} y={104}>Stored / combi</text>
        <circle className="sd-port sd-port--dhw"  cx={210} cy={84} r={3} />
        <circle className="sd-port sd-port--cold" cx={274} cy={84} r={3} />

        {/* ── Outlets row (bottom) ────────────────────────────────────────── */}
        {/* Shower */}
        <rect className="sd-node sd-node--outlet" x={14}  y={144} width={56} height={32} />
        <text className="sd-label"    x={42} y={157}>🚿 Shower</text>
        <text className="sd-sublabel" x={42} y={168}>idle</text>
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
         * The tee at x=96 splits to both the pump (upper) and the zone valve (lower).
         */}

        {/* Boiler flow → tee at x=96 */}
        <polyline className="sd-pipe sd-pipe--flow"
          points="84,28 96,28" />

        {/* Tee → pump (horizontal upper branch) */}
        <polyline className="sd-pipe sd-pipe--flow"
          points="96,28 104,28" />

        {/* Tee → zone valve (vertical drop then horizontal) */}
        <polyline className="sd-pipe sd-pipe--flow"
          points="96,28 96,78 104,78" />

        {/* Pump → rads */}
        <polyline className="sd-pipe sd-pipe--flow"
          points="152,28 174,28" />

        {/* Rads return → boiler return port */}
        <polyline className="sd-pipe sd-pipe--return"
          points="174,46 164,46 164,58 84,58 84,52" />

        {/* Zone valve → rads (lower connection) */}
        <polyline className="sd-pipe sd-pipe--flow"
          points="152,78 166,78 166,32 174,32" />

        {/*
         * DHW manifold at y=136:
         * Boiler DHW port (49,62) → vertical drop (49,136) → horizontal run (DHW_MANIFOLD_Y=136)
         * → cylinder coil (126,90) → cylinder inlet (210,90)
         */}

        {/* Boiler DHW port → DHW horizontal manifold → cylinder */}
        <polyline className="sd-pipe sd-pipe--dhw"
          points="49,62 49,136 126,136 126,90 210,90" />

        {/* DHW manifold → shower outlet */}
        <polyline className="sd-pipe sd-pipe--dhw"
          points="49,136 42,136 42,144" />

        {/* DHW manifold → bath outlet */}
        <polyline className="sd-pipe sd-pipe--dhw"
          points="126,136 110,136 110,144" />

        {/* DHW manifold → kitchen tap outlet (shared manifold y=136) */}
        <polyline className="sd-pipe sd-pipe--dhw"
          points="186,136 186,144" />

        {/* Mains cold supply (275,144) → cold loop around bottom → boiler cold inlet (14,39) */}
        <polyline className="sd-pipe sd-pipe--cold"
          points="275,144 275,128 6,128 6,39 14,39" />

        {/* Mains cold → cylinder cold inlet */}
        <polyline className="sd-pipe sd-pipe--cold"
          points="275,144 274,84" />
      </svg>
    </div>
  );
}
