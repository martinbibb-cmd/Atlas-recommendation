/**
 * openVentedVentedCylinder.tsx — Open-vented heating system with vented cylinder topology.
 *
 * Canonical template for open-vented (tank-fed) heating systems.
 * Primary features:
 *   - Regular boiler (no internal pump — external pump downstream of neutral point)
 *   - Close-coupled vent and cold-feed pipes at the neutral point
 *   - Header tank in the loft (cold feed + open vent)
 *   - Vented cylinder (tank-fed supply)
 *   - Two radiator branch spurs
 */

import {
  BoilerPrimitive,
  CylinderPrimitive,
  HeaderTankPrimitive,
  PumpPrimitive,
  RadiatorPrimitive,
} from '../../visualPrimitives/primitives';
import {
  AUX_COLOUR,
  BOILER_SYSTEM_SM_PORTS,
  MidPipeArrow,
  PIPE_STROKE_BRANCH,
  PIPE_STROKE_MAIN,
  PUMP_SM_PORTS,
  PipeLayer,
  TopologyNode,
  TopologyShell,
  offsetPoint,
  pipeDash,
  pipeLabelProps,
  portAttachPoint,
  pipeStroke,
} from './_shared';
import type { VisualTopologyRenderOptions } from '../topologies/types';
import { computeTopologyLayout, getTopologyLayoutDeclaration, routeEmitterSpurs } from '../layout';

export function OpenVentedVentedCylinderTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const layout = computeTopologyLayout(getTopologyLayoutDeclaration('open_vented_vented_cylinder'));
  const { positions, rails, pipe } = layout;

  // Derived coordinate constants — all absolute positions expressed as layout-state + named offset
  const boilerPorts = {
    primaryReturn: offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryReturn),
    primaryFlow: offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryFlow),
  };
  const pumpPorts = {
    flowIn: offsetPoint(positions.primary_flow_pump_downstream_vent_feed.left, positions.primary_flow_pump_downstream_vent_feed.top, PUMP_SM_PORTS.flowIn),
    flowOut: offsetPoint(positions.primary_flow_pump_downstream_vent_feed.left, positions.primary_flow_pump_downstream_vent_feed.top, PUMP_SM_PORTS.flowOut),
  };
  const boilerFlowAttach = portAttachPoint(boilerPorts.primaryFlow);
  const boilerReturnAttach = portAttachPoint(boilerPorts.primaryReturn);
  const pumpFlowInAttach = portAttachPoint(pumpPorts.flowIn);
  const pumpFlowOutAttach = portAttachPoint(pumpPorts.flowOut);
  const ventX                      = pipe.flowRailStartX + 56; // open vent at neutral point
  const coldFeedX                  = pipe.flowRailStartX + 72; // cold feed close-coupled to vent
  const ventRunY                   = rails.emitterTopY - 10;   // vent rises to loft level
  const ventEndX                   = positions.header_tank.left + 34; // vent connects to header tank zone
  const VENTED_CYL_FLOW_Y_OFFSET   = 35;                       // cylinder primary flow port y offset from top
  const ventedCylFlowY             = positions.vented_cylinder.top + VENTED_CYL_FLOW_Y_OFFSET;
  const primaryFlowLabelX          = pipe.flowRailEndX + 58;   // label x for primary flow
  const primaryReturnLabelX        = pipe.heatSourceReturnX + 240; // label x for primary return
  const ventFeedLabelX             = ventEndX + 6;              // label x for close-coupled annotation
  const midFlowX                   = Math.round((boilerFlowAttach.x + pipe.flowRailEndX) / 2);
  const midReturnX                 = Math.round((boilerReturnAttach.x + pipe.flowRailEndX) / 2);

  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary flow ring */}
        <line x1={boilerFlowAttach.x} y1={rails.flowY} x2={pumpFlowInAttach.x} y2={rails.flowY} stroke={flow} strokeWidth={w} />
        <line
          x1={pumpFlowInAttach.x}
          y1={rails.flowY}
          x2={pumpFlowOutAttach.x}
          y2={rails.flowY}
          stroke={flow}
          strokeWidth={w}
          data-testid="pump-topology-circuit"
        />
        <line x1={pumpFlowOutAttach.x} y1={rails.flowY} x2={pipe.flowRailEndX} y2={rails.flowY} stroke={flow} strokeWidth={w} />
        <line x1={pipe.flowRailEndX} y1={rails.flowY} x2={pipe.flowRailEndX} y2={ventedCylFlowY} stroke={flow} strokeWidth={w} />
        {/* Return rail for primary loop */}
        <line x1={pipe.flowRailEndX} y1={rails.returnY} x2={boilerReturnAttach.x} y2={rails.returnY} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={boilerReturnAttach.x} y1={rails.returnY} x2={boilerReturnAttach.x} y2={boilerReturnAttach.y} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={boilerFlowAttach.x} y1={rails.flowY} x2={boilerFlowAttach.x} y2={boilerFlowAttach.y} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={pumpFlowInAttach.x} y1={rails.flowY} x2={pumpFlowInAttach.x} y2={pumpFlowInAttach.y} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={pumpFlowOutAttach.x} y1={rails.flowY} x2={pumpFlowOutAttach.x} y2={pumpFlowOutAttach.y} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />

        {/* Radiator branch spurs — rad 1 */}
        {routeEmitterSpurs(positions.radiator_branch_1.left, rails).map((seg, i) => (
          <line
            key={`em1-${i}`}
            x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
            stroke={seg.rail === 'ch_flow' ? flow : ret}
            strokeWidth={PIPE_STROKE_BRANCH}
            strokeDasharray={seg.rail === 'ch_return' ? pipeDash(options.printSafe, false) : undefined}
          />
        ))}
        {/* Radiator branch spurs — rad 2 */}
        {routeEmitterSpurs(positions.radiator_branch_2.left, rails).map((seg, i) => (
          <line
            key={`em2-${i}`}
            x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
            stroke={seg.rail === 'ch_flow' ? flow : ret}
            strokeWidth={PIPE_STROKE_BRANCH}
            strokeDasharray={seg.rail === 'ch_return' ? pipeDash(options.printSafe, false) : undefined}
          />
        ))}

        {/* Close-coupled vent and feed pair near neutral point; pump sits downstream on flow. */}
        <line
          x1={ventX}
          y1={rails.flowY}
          x2={ventX}
          y2={ventRunY}
          stroke={AUX_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="open-vented-close-coupled-vent"
        />
        <line
          x1={coldFeedX}
          y1={rails.flowY}
          x2={coldFeedX}
          y2={rails.returnY}
          stroke={AUX_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="open-vented-close-coupled-feed"
        />
        <line x1={ventX} y1={ventRunY} x2={ventEndX} y2={ventRunY} stroke={AUX_COLOUR} strokeWidth={PIPE_STROKE_BRANCH} />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={midFlowX} y={rails.flowY} direction="right" color={flow} />
            <MidPipeArrow midX={midReturnX} y={rails.returnY} direction="left" color={ret} />
          </>
        )}

        {/* Pipe labels */}
        <text {...pipeLabelProps(primaryFlowLabelX, rails.flowY, 'above', flow)}>Primary flow</text>
        <text {...pipeLabelProps(primaryReturnLabelX, rails.returnY, 'below', ret)}>Primary return</text>
        <text {...pipeLabelProps(ventFeedLabelX, ventRunY, 'above', AUX_COLOUR)}>Close-coupled vent/feed</text>
      </PipeLayer>

      <TopologyNode role="boiler" left={positions.boiler.left} top={positions.boiler.top}><BoilerPrimitive variant="regular" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="primary_flow_pump_downstream_vent_feed" left={positions.primary_flow_pump_downstream_vent_feed.left} top={positions.primary_flow_pump_downstream_vent_feed.top}><PumpPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_1" left={positions.radiator_branch_1.left} top={positions.radiator_branch_1.top}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_2" left={positions.radiator_branch_2.left} top={positions.radiator_branch_2.top}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="header_tank" left={positions.header_tank.left} top={positions.header_tank.top}><HeaderTankPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="vented_cylinder" left={positions.vented_cylinder.left} top={positions.vented_cylinder.top}><CylinderPrimitive variant="vented" fillLevel={0.7} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}
