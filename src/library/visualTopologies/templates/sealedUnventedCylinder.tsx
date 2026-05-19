/**
 * sealedUnventedCylinder.tsx — Sealed system with unvented cylinder topology.
 *
 * Canonical template for sealed heating systems with an unvented (mains-pressure)
 * storage cylinder. Primary features:
 *   - System boiler (internal pump)
 *   - Unvented cylinder with G3 D2 safety discharge route
 *   - Filling loop (disconnected default)
 *   - Expansion vessel on primary return
 *   - Pressure gauge
 *   - Two radiator branch spurs
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
  CYLINDER_SM_PORTS,
  MidPipeArrow,
  PIPE_STROKE_BRANCH,
  PIPE_STROKE_MAIN,
  PipeLayer,
  TopologyNode,
  TopologyShell,
  offsetPoint,
  pipeDash,
  pipeLabelProps,
  pipeStroke,
} from './_shared';
import type { VisualTopologyRenderOptions } from '../topologies/types';
import { computeTopologyLayout, getTopologyLayoutDeclaration, routeEmitterSpurs } from '../layout';

export function SealedUnventedCylinderTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const layout = computeTopologyLayout(getTopologyLayoutDeclaration('sealed_unvented_cylinder'));
  const { positions, rails, pipe } = layout;

  // Derived coordinate constants — all absolute positions expressed as layout-state + named offset
  const cylinderDhwNearX  = positions.unvented_cylinder.left + 160;  // stub extension near side
  const cylinderDhwFarX   = positions.unvented_cylinder.left + 240;  // stub extension far side
  const d2EndY            = rails.returnY + 34;                       // D2 discharge falls below return rail
  const d2LabelY          = rails.returnY + 18;                       // label y along discharge pipe
  const dhwLabelX         = cylinderDhwNearX + 2;                     // label x for cold/hot stubs
  const d2LabelX          = positions.unvented_cylinder.left + 126;   // label x for D2 discharge
  const midFlowX          = Math.round((pipe.flowRailStartX + pipe.flowRailEndX) / 2);
  const midReturnX        = Math.round((pipe.heatSourceReturnX + pipe.flowRailEndX) / 2);

  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);
  const cylinderPorts = {
    hotOut:          offsetPoint(positions.unvented_cylinder.left, positions.unvented_cylinder.top, CYLINDER_SM_PORTS.hotOut),
    coldIn:          offsetPoint(positions.unvented_cylinder.left, positions.unvented_cylinder.top, CYLINDER_SM_PORTS.coldIn),
    coilFlowIn:      offsetPoint(positions.unvented_cylinder.left, positions.unvented_cylinder.top, CYLINDER_SM_PORTS.coilFlowIn),
    coilFlowOut:     offsetPoint(positions.unvented_cylinder.left, positions.unvented_cylinder.top, CYLINDER_SM_PORTS.coilFlowOut),
    safetyDischarge: offsetPoint(positions.unvented_cylinder.left, positions.unvented_cylinder.top, CYLINDER_SM_PORTS.safetyDischarge),
  };

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary flow ring */}
        <line x1={pipe.flowRailStartX} y1={rails.flowY} x2={pipe.flowRailEndX} y2={rails.flowY} stroke={flow} strokeWidth={w} />
        <line x1={pipe.flowRailEndX} y1={rails.flowY} x2={pipe.flowRailEndX} y2={cylinderPorts.coilFlowIn.y} stroke={flow} strokeWidth={w} />
        {/* Return pipe — system boiler internal pump assumed */}
        <line x1={pipe.flowRailEndX} y1={rails.returnY} x2={pipe.heatSourceReturnX} y2={rails.returnY} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={pipe.heatSourceReturnX} y1={rails.returnY} x2={pipe.heatSourceReturnX} y2={pipe.heatSourceReturnY} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

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

        {/* Cylinder DHW stubs */}
        <line
          x1={cylinderPorts.coilFlowOut.x}
          y1={cylinderPorts.coilFlowOut.y}
          x2={cylinderDhwNearX}
          y2={cylinderPorts.coilFlowOut.y}
          stroke={ret}
          strokeWidth={PIPE_STROKE_BRANCH}
          strokeDasharray={pipeDash(options.printSafe, false)}
          data-testid="sealed-unvented-expansion-vessel-return-branch"
        />
        <line x1={pipe.flowRailEndX} y1={cylinderPorts.coilFlowIn.y} x2={cylinderDhwNearX} y2={cylinderPorts.coilFlowIn.y} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={cylinderPorts.coldIn.x} y1={cylinderPorts.coldIn.y} x2={cylinderDhwFarX} y2={cylinderPorts.coldIn.y} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={cylinderPorts.hotOut.x} y1={cylinderPorts.hotOut.y} x2={cylinderDhwFarX} y2={cylinderPorts.hotOut.y} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        {/* G3 D2 discharge route — continuous fall away from cylinder */}
        <line
          x1={cylinderPorts.safetyDischarge.x}
          y1={cylinderPorts.safetyDischarge.y}
          x2={cylinderDhwFarX}
          y2={d2EndY}
          stroke={AUX_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="d2-discharge-pipe"
        />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={midFlowX} y={rails.flowY} direction="right" color={flow} />
            <MidPipeArrow midX={midReturnX} y={rails.returnY} direction="left" color={ret} />
          </>
        )}

        {/* Pipe labels */}
        <text {...pipeLabelProps(dhwLabelX, cylinderPorts.coldIn.y, 'above', ret)}>Mains cold in</text>
        <text {...pipeLabelProps(dhwLabelX, cylinderPorts.hotOut.y, 'above', flow)}>Hot draw-off out</text>
        <text {...pipeLabelProps(d2LabelX, d2LabelY, 'below', AUX_COLOUR)}>D2 safety discharge</text>
      </PipeLayer>

      <TopologyNode role="boiler" left={positions.boiler.left} top={positions.boiler.top}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_1" left={positions.radiator_branch_1.left} top={positions.radiator_branch_1.top}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_2" left={positions.radiator_branch_2.left} top={positions.radiator_branch_2.top}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="unvented_cylinder" left={positions.unvented_cylinder.left} top={positions.unvented_cylinder.top}><CylinderPrimitive variant="unvented" fillLevel={0.75} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="filling_loop_disconnected_default" left={positions.filling_loop_disconnected_default.left} top={positions.filling_loop_disconnected_default.top}><FillingLoopPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="expansion_vessel_on_primary_return" left={positions.expansion_vessel_on_primary_return.left} top={positions.expansion_vessel_on_primary_return.top}><ExpansionVesselPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="pressure_gauge" left={positions.pressure_gauge.left} top={positions.pressure_gauge.top}><PressureGaugePrimitive pressureBar={1.3} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}
