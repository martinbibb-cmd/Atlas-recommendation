/**
 * sealedUnventedCylinder.tsx — Sealed system with unvented cylinder topology.
 *
 * Installed-system scene composition:
 *   - System boiler: wall-hung, heat-source zone (left)
 *   - Primary flow exits boiler bottom → rises to flow run → feeds radiators and cylinder coil
 *   - Return exits cylinder coil right → drops through expansion vessel spur → runs left to boiler
 *   - Expansion vessel spur branches from return drop at vessel connection-port height
 *   - DHW hot draw-off rises vertically from cylinder top (mains-fed stored hot water)
 *   - Cold mains drops vertically into cylinder bottom (mains supply)
 *   - G3 D2/tundish safety route is a continuous downward fall — visually secondary
 *   - Filling loop and pressure gauge are service items, not topology anchors
 *
 * Recognition test:
 *   With labels hidden a UK heating engineer should read:
 *   "system boiler feeding heating circuit and unvented cylinder"
 *   not: "abstract rails with a few icons."
 *
 * Visual QA status: BLOCKED — pending human screenshot review.
 *   Do not promote recognisability or remove the human_visual_review_required
 *   gate until a reviewer confirms the no-label drawing is genuinely readable.
 */

import {
  BoilerPrimitive,
  CylinderPrimitive,
  ExpansionVesselPrimitive,
  FillingLoopPrimitive,
  PressureGaugePrimitive,
  RadiatorPrimitive,
} from '../../visualPrimitives/primitives';
import {
  AUX_COLOUR,
  BOILER_SYSTEM_SM_PORTS,
  CYLINDER_SM_PORTS,
  EXPANSION_VESSEL_SM_PORTS,
  MidPipeArrow,
  PIPE_STROKE_BRANCH,
  PIPE_STROKE_MAIN,
  PipeLayer,
  TopologyNode,
  TopologyShell,
  offsetPoint,
  pipeDash,
  pipeLabelProps,
  portAttachPoint,
  pipeStroke,
} from './_shared';
import { ROUTING_RAILS } from '../../visualPrimitives/primitiveTokens';
import type { VisualTopologyRenderOptions } from '../topologies/types';
import { computeTopologyLayout, getTopologyLayoutDeclaration, routeEmitterSpurs } from '../layout';

type PipeSemanticStyle = {
  stroke: string;
  strokeDasharray?: string;
  rail: string;
  waterKind: 'primary_flow' | 'primary_return' | 'mains_cold' | 'dhw_hot' | 'd2_safety';
};

function buildPipeSemanticProps(style: PipeSemanticStyle, testId?: string) {
  return {
    stroke: style.stroke,
    strokeDasharray: style.strokeDasharray,
    'data-pipe-rail': style.rail,
    'data-water-kind': style.waterKind,
    ...(testId ? { 'data-testid': testId } : {}),
  };
}

function CylinderZoneValveCue({
  showLabel,
  printSafe,
}: {
  showLabel: boolean;
  printSafe: boolean;
}) {
  const lineStroke = printSafe ? '#111827' : '#dc2626';
  const actuatorFill = printSafe ? '#e5e7eb' : '#dbeafe';
  const actuatorStroke = printSafe ? '#111827' : '#1d4ed8';

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      aria-label="Cylinder zone valve"
    >
      <svg width={40} height={40} viewBox="0 0 40 40" role="img" aria-hidden="true" focusable="false">
        <line x1={0} y1={32} x2={6} y2={32} stroke={lineStroke} strokeWidth={2.5} />
        <line x1={34} y1={32} x2={40} y2={32} stroke={lineStroke} strokeWidth={2.5} />
        <rect
          x={6}
          y={26}
          width={28}
          height={12}
          rx={2}
          fill={printSafe ? '#f8fafc' : '#fff'}
          stroke={lineStroke}
          strokeWidth={1.8}
          data-testid="sealed-unvented-cylinder-zone-valve-body"
        />
        <path d="M 12 32 L 20 28 L 28 32 L 20 36 Z" fill={printSafe ? '#d1d5db' : '#fecaca'} stroke={lineStroke} strokeWidth={1.2} />
        <rect
          x={13}
          y={9}
          width={14}
          height={11}
          rx={2}
          fill={actuatorFill}
          stroke={actuatorStroke}
          strokeWidth={1.4}
          data-testid="sealed-unvented-cylinder-zone-valve-actuator"
        />
        <line x1={20} y1={20} x2={20} y2={26} stroke={actuatorStroke} strokeWidth={1.4} />
      </svg>
      {showLabel && (
        <span style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>
          Cylinder zone valve
        </span>
      )}
    </div>
  );
}

export function SealedUnventedCylinderTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const layout = computeTopologyLayout(getTopologyLayoutDeclaration('sealed_unvented_cylinder'));
  const { positions, rails } = layout;

  // ─── Boiler port attach points ──────────────────────────────────────────────
  const boilerPorts = {
    primaryReturn: offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryReturn),
    primaryFlow:   offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryFlow),
  };
  const boilerFlowAttach   = portAttachPoint(boilerPorts.primaryFlow);
  const boilerReturnAttach = portAttachPoint(boilerPorts.primaryReturn);

  // ─── Cylinder port attach points ─────────────────────────────────────────────
  const cylinderPorts = {
    hotOut:          offsetPoint(positions.unvented_cylinder.left, positions.unvented_cylinder.top, CYLINDER_SM_PORTS.hotOut),
    coldIn:          offsetPoint(positions.unvented_cylinder.left, positions.unvented_cylinder.top, CYLINDER_SM_PORTS.coldIn),
    coilFlowIn:      offsetPoint(positions.unvented_cylinder.left, positions.unvented_cylinder.top, CYLINDER_SM_PORTS.coilFlowIn),
    coilFlowOut:     offsetPoint(positions.unvented_cylinder.left, positions.unvented_cylinder.top, CYLINDER_SM_PORTS.coilFlowOut),
    safetyDischarge: offsetPoint(positions.unvented_cylinder.left, positions.unvented_cylinder.top, CYLINDER_SM_PORTS.safetyDischarge),
  };
  const cylinderCoilFlowInAttach      = portAttachPoint(cylinderPorts.coilFlowIn);
  const cylinderCoilFlowOutAttach     = portAttachPoint(cylinderPorts.coilFlowOut);
  const cylinderHotOutAttach          = portAttachPoint(cylinderPorts.hotOut);
  const cylinderColdInAttach          = portAttachPoint(cylinderPorts.coldIn);
  const cylinderSafetyDischargeAttach = portAttachPoint(cylinderPorts.safetyDischarge);

  // ─── Expansion vessel port attach point ──────────────────────────────────────
  // Vessel is positioned so its bottom connection stub is above the return rail.
  // A spur runs horizontally from the coil-out return drop to the vessel port.
  const evPort       = offsetPoint(
    positions.expansion_vessel_on_primary_return.left,
    positions.expansion_vessel_on_primary_return.top,
    EXPANSION_VESSEL_SM_PORTS.circuitConnection,
  );
  const evPortAttach = portAttachPoint(evPort);

  // ─── Derived route coordinates ────────────────────────────────────────────────
  const dhwHotRiseToY  = 20;                     // hot draw-off rises to near canvas top
  const cwMainsDropToY = rails.returnY + 60;     // cold mains drops below return rail
  const d2TermX        = positions.unvented_cylinder.left + 200;  // D2 discharge terminus x
  const d2EndY         = rails.returnY + 34;     // D2 terminus y — continuous fall
  const d2LabelY       = rails.returnY + 18;     // label y along D2 route
  const d2LabelX       = positions.unvented_cylinder.left + 126;  // label x for D2 route
  const dhwHotRunEndX  = cylinderHotOutAttach.x + 96;
  const cwMainsRunEndX = cylinderColdInAttach.x + 84;
  const zoneValveInlineLeft  = positions.cylinder_zone_valve.left + 6;
  const zoneValveInlineRight = positions.cylinder_zone_valve.left + 34;

  // ─── Stroke helpers ───────────────────────────────────────────────────────────
  const w    = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret  = pipeStroke(options.printSafe, false);
  const primaryFlowStyle: PipeSemanticStyle = {
    stroke: flow,
    rail: ROUTING_RAILS.CH_FLOW,
    waterKind: 'primary_flow',
  };
  const primaryReturnStyle: PipeSemanticStyle = {
    stroke: ret,
    strokeDasharray: pipeDash(options.printSafe, false),
    rail: ROUTING_RAILS.CH_RETURN,
    waterKind: 'primary_return',
  };
  const mainsColdStyle: PipeSemanticStyle = {
    stroke: options.printSafe ? '#6b7280' : '#0f766e',
    strokeDasharray: options.printSafe ? '7 2 1.5 2' : '10 4',
    rail: ROUTING_RAILS.CW_MAINS,
    waterKind: 'mains_cold',
  };
  const dhwHotStyle: PipeSemanticStyle = {
    stroke: options.printSafe ? '#111827' : '#f97316',
    strokeDasharray: options.printSafe ? '2 2' : undefined,
    rail: ROUTING_RAILS.DHW,
    waterKind: 'dhw_hot',
  };
  const d2Style: PipeSemanticStyle = {
    stroke: AUX_COLOUR,
    strokeDasharray: options.printSafe ? '3 2' : '4 2',
    rail: ROUTING_RAILS.D2_DISCHARGE,
    waterKind: 'd2_safety',
  };

  // ─── Pipe-trace arrow midpoints ───────────────────────────────────────────────
  const midFlowX   = Math.round((boilerFlowAttach.x + cylinderCoilFlowInAttach.x) / 2);
  const midReturnX = Math.round((boilerReturnAttach.x + cylinderCoilFlowOutAttach.x) / 2);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>

        {/* ── PRIMARY FLOW ──────────────────────────────────────────────────── */}
        {/* Flow rail: boiler flow port → cylinder coil-in (horizontal run) */}
        <line
          x1={boilerFlowAttach.x}
          y1={rails.flowY}
          x2={zoneValveInlineLeft}
          y2={rails.flowY}
          strokeWidth={w}
          {...buildPipeSemanticProps(primaryFlowStyle, 'sealed-unvented-primary-flow-rail-left')}
        />
        <line
          x1={zoneValveInlineRight}
          y1={rails.flowY}
          x2={cylinderCoilFlowInAttach.x}
          y2={rails.flowY}
          strokeWidth={w}
          {...buildPipeSemanticProps(primaryFlowStyle, 'sealed-unvented-primary-flow-rail-right')}
        />
        {/* Flow drop: rail → cylinder coil-in port */}
        <line
          x1={cylinderCoilFlowInAttach.x}
          y1={rails.flowY}
          x2={cylinderCoilFlowInAttach.x}
          y2={cylinderCoilFlowInAttach.y}
          strokeWidth={w}
          {...buildPipeSemanticProps(primaryFlowStyle, 'sealed-unvented-cylinder-primary-flow-drop')}
        />
        {/* Boiler flow spur: rail → boiler flow port */}
        <line
          x1={boilerFlowAttach.x}
          y1={rails.flowY}
          x2={boilerFlowAttach.x}
          y2={boilerFlowAttach.y}
          strokeWidth={PIPE_STROKE_BRANCH}
          {...buildPipeSemanticProps(primaryFlowStyle, 'sealed-unvented-boiler-primary-flow-spur')}
        />

        {/* ── RADIATOR BRANCH SPURS ────────────────────────────────────────── */}
        {routeEmitterSpurs(positions.radiator_branch_1.left, rails).map((seg, i) => (
          <line
            key={`em1-${i}`}
            x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
            strokeWidth={PIPE_STROKE_BRANCH}
            {...buildPipeSemanticProps(seg.rail === ROUTING_RAILS.CH_FLOW ? primaryFlowStyle : primaryReturnStyle)}
          />
        ))}
        {routeEmitterSpurs(positions.radiator_branch_2.left, rails).map((seg, i) => (
          <line
            key={`em2-${i}`}
            x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
            strokeWidth={PIPE_STROKE_BRANCH}
            {...buildPipeSemanticProps(seg.rail === ROUTING_RAILS.CH_FLOW ? primaryFlowStyle : primaryReturnStyle)}
          />
        ))}

        {/* ── PRIMARY RETURN ────────────────────────────────────────────────── */}
        {/* Coil-out upper drop: cylinder coil-out port → expansion vessel spur level */}
        <line
          x1={cylinderCoilFlowOutAttach.x} y1={cylinderCoilFlowOutAttach.y}
          x2={cylinderCoilFlowOutAttach.x} y2={evPortAttach.y}
          strokeWidth={PIPE_STROKE_BRANCH}
          {...buildPipeSemanticProps(primaryReturnStyle, 'sealed-unvented-cylinder-primary-return-upper-drop')}
        />
        {/* Expansion vessel return spur — branches from return drop to vessel connection port */}
        <line
          x1={cylinderCoilFlowOutAttach.x} y1={evPortAttach.y}
          x2={evPortAttach.x}              y2={evPortAttach.y}
          strokeWidth={PIPE_STROKE_BRANCH}
          {...buildPipeSemanticProps(primaryReturnStyle, 'sealed-unvented-expansion-vessel-return-branch')}
        />
        {/* Coil-out lower drop: expansion vessel spur level → return rail */}
        <line
          x1={cylinderCoilFlowOutAttach.x} y1={evPortAttach.y}
          x2={cylinderCoilFlowOutAttach.x} y2={rails.returnY}
          strokeWidth={w}
          {...buildPipeSemanticProps(primaryReturnStyle, 'sealed-unvented-cylinder-primary-return-lower-drop')}
        />
        {/* Return rail: cylinder coil-out x → boiler return port x */}
        <line
          x1={cylinderCoilFlowOutAttach.x} y1={rails.returnY}
          x2={boilerReturnAttach.x}         y2={rails.returnY}
          strokeWidth={w}
          {...buildPipeSemanticProps(primaryReturnStyle, 'sealed-unvented-primary-return-rail')}
        />
        {/* Boiler return spur: return rail → boiler return port */}
        <line
          x1={boilerReturnAttach.x} y1={rails.returnY}
          x2={boilerReturnAttach.x} y2={boilerReturnAttach.y}
          strokeWidth={w}
          {...buildPipeSemanticProps(primaryReturnStyle, 'sealed-unvented-boiler-primary-return-spur')}
        />

        {/* ── DHW CONNECTIONS ───────────────────────────────────────────────── */}
        {/* Hot draw-off: rises vertically from cylinder top — mains-fed stored hot water */}
        <line
          x1={cylinderHotOutAttach.x} y1={cylinderHotOutAttach.y}
          x2={cylinderHotOutAttach.x} y2={dhwHotRiseToY}
          strokeWidth={PIPE_STROKE_BRANCH}
          {...buildPipeSemanticProps(dhwHotStyle, 'sealed-unvented-dhw-hot-rise')}
        />
        <line
          x1={cylinderHotOutAttach.x}
          y1={dhwHotRiseToY}
          x2={dhwHotRunEndX}
          y2={dhwHotRiseToY}
          strokeWidth={PIPE_STROKE_BRANCH}
          {...buildPipeSemanticProps(dhwHotStyle, 'sealed-unvented-dhw-hot-run')}
        />
        {/* Cold mains in: drops vertically into cylinder bottom — mains supply */}
        <line
          x1={cylinderColdInAttach.x} y1={cylinderColdInAttach.y}
          x2={cylinderColdInAttach.x} y2={cwMainsDropToY}
          strokeWidth={PIPE_STROKE_BRANCH}
          {...buildPipeSemanticProps(mainsColdStyle, 'sealed-unvented-mains-cold-drop')}
        />
        <line
          x1={cylinderColdInAttach.x}
          y1={cwMainsDropToY}
          x2={cwMainsRunEndX}
          y2={cwMainsDropToY}
          strokeWidth={PIPE_STROKE_BRANCH}
          {...buildPipeSemanticProps(mainsColdStyle, 'sealed-unvented-mains-cold-run')}
        />

        {/* ── G3 D2 DISCHARGE ───────────────────────────────────────────────── */}
        {/* Continuous fall from cylinder safety discharge — visually secondary */}
        <line
          x1={cylinderSafetyDischargeAttach.x} y1={cylinderSafetyDischargeAttach.y}
          x2={d2TermX}                          y2={d2EndY}
          strokeWidth={PIPE_STROKE_BRANCH}
          {...buildPipeSemanticProps(d2Style, 'd2-discharge-pipe')}
        />

        {/* ── PIPE-TRACE DIRECTIONAL ARROWS ────────────────────────────────── */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={midFlowX}   y={rails.flowY}   direction="right" color={flow} />
            <MidPipeArrow midX={midReturnX} y={rails.returnY} direction="left"  color={ret}  />
          </>
        )}

        {/* ── PIPE LABELS ────────────────────────────────────────────────────── */}
        {options.showLabels && (
          <>
            <text {...pipeLabelProps(dhwHotRunEndX - 54, dhwHotRiseToY, 'below', dhwHotStyle.stroke)}>Hot draw-off out</text>
            <text {...pipeLabelProps(cwMainsRunEndX - 52, cwMainsDropToY, 'above', mainsColdStyle.stroke)}>Mains cold in</text>
            <text {...pipeLabelProps(d2LabelX, d2LabelY, 'below', d2Style.stroke)}>D2 safety discharge</text>
          </>
        )}

      </PipeLayer>

      {/* ── EQUIPMENT NODES (Equipment first — then pipework above) ─────────── */}
      <TopologyNode role="boiler" left={positions.boiler.left} top={positions.boiler.top}>
        <BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} />
      </TopologyNode>
      <TopologyNode role="radiator_branch_1" left={positions.radiator_branch_1.left} top={positions.radiator_branch_1.top}>
        <RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} />
      </TopologyNode>
      <TopologyNode role="radiator_branch_2" left={positions.radiator_branch_2.left} top={positions.radiator_branch_2.top}>
        <RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} />
      </TopologyNode>
      <TopologyNode role="unvented_cylinder" left={positions.unvented_cylinder.left} top={positions.unvented_cylinder.top}>
        <CylinderPrimitive variant="unvented" fillLevel={0.75} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} />
      </TopologyNode>
      <TopologyNode role="cylinder_zone_valve" left={positions.cylinder_zone_valve.left} top={positions.cylinder_zone_valve.top}>
        <CylinderZoneValveCue showLabel={options.showLabels} printSafe={options.printSafe} />
      </TopologyNode>
      <TopologyNode role="filling_loop_disconnected_default" left={positions.filling_loop_disconnected_default.left} top={positions.filling_loop_disconnected_default.top}>
        <FillingLoopPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} />
      </TopologyNode>
      <TopologyNode role="expansion_vessel_on_primary_return" left={positions.expansion_vessel_on_primary_return.left} top={positions.expansion_vessel_on_primary_return.top}>
        <ExpansionVesselPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} />
      </TopologyNode>
      <TopologyNode role="pressure_gauge" left={positions.pressure_gauge.left} top={positions.pressure_gauge.top}>
        <PressureGaugePrimitive pressureBar={1.3} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} />
      </TopologyNode>
    </TopologyShell>
  );
}
