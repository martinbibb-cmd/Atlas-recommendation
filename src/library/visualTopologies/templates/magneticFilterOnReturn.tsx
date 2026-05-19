/**
 * magneticFilterOnReturn.tsx — System boiler with magnetic filter on return topology.
 *
 * Canonical template showing a magnetic filter installed on the primary return
 * pipe before the boiler, capturing magnetite and sludge particles.
 */

import {
  BoilerPrimitive,
  MagneticFilterPrimitive,
  RadiatorPrimitive,
} from '../../visualPrimitives/primitives';
import {
  MAGNETIC_FILTER_SM_PORTS,
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

export function MagneticFilterOnReturnTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);
  const filterPorts = {
    inlet: offsetPoint(188, 246, MAGNETIC_FILTER_SM_PORTS.inlet),
    outlet: offsetPoint(188, 246, MAGNETIC_FILTER_SM_PORTS.outlet),
  };

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary ring */}
        <line x1={140} y1={140} x2={560} y2={140} stroke={flow} strokeWidth={w} />
        <line x1={560} y1={140} x2={560} y2={300} stroke={flow} strokeWidth={w} />
        <line x1={560} y1={300} x2={filterPorts.outlet.x} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={filterPorts.outlet.x} y1={300} x2={filterPorts.outlet.x} y2={filterPorts.outlet.y} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={filterPorts.inlet.x} y1={filterPorts.inlet.y} x2={filterPorts.inlet.x} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={filterPorts.inlet.x} y1={300} x2={140} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={140} y1={300} x2={140} y2={220} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Radiator branch spurs */}
        <line x1={322} y1={140} x2={322} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={258} y1={112} x2={258} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={468} y1={140} x2={468} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={404} y1={112} x2={404} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={350} y={140} direction="right" color={flow} />
            <MidPipeArrow midX={350} y={300} direction="left" color={ret} />
          </>
        )}

        {/* Pipe label */}
        <text {...pipeLabelProps(590, 300, 'above', ret)}>Clean return into boiler</text>
        <line
          x1={Math.min(filterPorts.inlet.x, filterPorts.outlet.x)}
          y1={300}
          x2={Math.max(filterPorts.inlet.x, filterPorts.outlet.x)}
          y2={300}
          stroke="transparent"
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="magnetic-filter-final-return-before-boiler"
        />
      </PipeLayer>

      <TopologyNode role="boiler" left={70} top={164}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_1" left={248} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_2" left={394} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="magnetic_filter_return_final_before_boiler" left={188} top={246}><MagneticFilterPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}
