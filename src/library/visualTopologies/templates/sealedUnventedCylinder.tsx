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

export function SealedUnventedCylinderTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);
  const cylinderPorts = {
    hotOut: offsetPoint(520, 160, CYLINDER_SM_PORTS.hotOut),
    coldIn: offsetPoint(520, 160, CYLINDER_SM_PORTS.coldIn),
    coilFlowIn: offsetPoint(520, 160, CYLINDER_SM_PORTS.coilFlowIn),
    coilFlowOut: offsetPoint(520, 160, CYLINDER_SM_PORTS.coilFlowOut),
    safetyDischarge: offsetPoint(520, 160, CYLINDER_SM_PORTS.safetyDischarge),
  };

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary flow ring */}
        <line x1={120} y1={140} x2={520} y2={140} stroke={flow} strokeWidth={w} />
        <line x1={520} y1={140} x2={520} y2={cylinderPorts.coilFlowIn.y} stroke={flow} strokeWidth={w} />
        {/* Return pipe — system boiler internal pump assumed */}
        <line x1={520} y1={300} x2={120} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={120} y1={300} x2={120} y2={205} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Radiator branch spurs */}
        <line x1={340} y1={140} x2={340} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={276} y1={112} x2={276} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={484} y1={140} x2={484} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={420} y1={112} x2={420} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Cylinder DHW stubs */}
        <line
          x1={cylinderPorts.coilFlowOut.x}
          y1={cylinderPorts.coilFlowOut.y}
          x2={680}
          y2={cylinderPorts.coilFlowOut.y}
          stroke={ret}
          strokeWidth={PIPE_STROKE_BRANCH}
          strokeDasharray={pipeDash(options.printSafe, false)}
          data-testid="sealed-unvented-expansion-vessel-return-branch"
        />
        <line x1={520} y1={cylinderPorts.coilFlowIn.y} x2={680} y2={cylinderPorts.coilFlowIn.y} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={cylinderPorts.coldIn.x} y1={cylinderPorts.coldIn.y} x2={760} y2={cylinderPorts.coldIn.y} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={cylinderPorts.hotOut.x} y1={cylinderPorts.hotOut.y} x2={760} y2={cylinderPorts.hotOut.y} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        {/* G3 D2 discharge route — continuous fall away from cylinder */}
        <line
          x1={cylinderPorts.safetyDischarge.x}
          y1={cylinderPorts.safetyDischarge.y}
          x2={760}
          y2={334}
          stroke={AUX_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="d2-discharge-pipe"
        />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={320} y={140} direction="right" color={flow} />
            <MidPipeArrow midX={320} y={300} direction="left" color={ret} />
          </>
        )}

        {/* Pipe labels */}
        <text {...pipeLabelProps(682, cylinderPorts.coldIn.y, 'above', ret)}>Mains cold in</text>
        <text {...pipeLabelProps(682, cylinderPorts.hotOut.y, 'above', flow)}>Hot draw-off out</text>
        <text {...pipeLabelProps(646, 318, 'below', AUX_COLOUR)}>D2 safety discharge</text>
      </PipeLayer>

      <TopologyNode role="boiler" left={56} top={156}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_1" left={266} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_2" left={410} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="unvented_cylinder" left={520} top={160}><CylinderPrimitive variant="unvented" fillLevel={0.75} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="filling_loop_disconnected_default" left={364} top={252}><FillingLoopPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="expansion_vessel_on_primary_return" left={635} top={250}><ExpansionVesselPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="pressure_gauge" left={610} top={88}><PressureGaugePrimitive pressureBar={1.3} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}
