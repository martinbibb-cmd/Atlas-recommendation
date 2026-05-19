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
  BOILER_SYSTEM_SM_PORTS,
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
  portAttachPoint,
  pipeStroke,
} from './_shared';
import type { VisualTopologyRenderOptions } from '../topologies/types';
import { computeTopologyLayout, getTopologyLayoutDeclaration, routeEmitterSpurs } from '../layout';

export function MagneticFilterOnReturnTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const layout = computeTopologyLayout(getTopologyLayoutDeclaration('magnetic_filter_on_return'));
  const { positions, rails, pipe } = layout;

  // Derived coordinate constants — all absolute positions expressed as layout-state + named offset
  const MF_FILTER_LABEL_X_OFFSET = 30;   // label x standoff right of flow rail end
  const mfFilterLabelX           = pipe.flowRailEndX + MF_FILTER_LABEL_X_OFFSET;
  const midFlowX                 = Math.round((pipe.flowRailStartX + pipe.flowRailEndX) / 2);
  const midReturnX               = Math.round((pipe.heatSourceReturnX + pipe.flowRailEndX) / 2);

  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);
  const filterPorts = {
    inlet:  offsetPoint(positions.magnetic_filter_return_final_before_boiler.left, positions.magnetic_filter_return_final_before_boiler.top, MAGNETIC_FILTER_SM_PORTS.inlet),
    outlet: offsetPoint(positions.magnetic_filter_return_final_before_boiler.left, positions.magnetic_filter_return_final_before_boiler.top, MAGNETIC_FILTER_SM_PORTS.outlet),
  };
  const boilerPorts = {
    primaryReturn: offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryReturn),
    primaryFlow: offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryFlow),
  };
  const filterInAttach = portAttachPoint(filterPorts.inlet);
  const filterOutAttach = portAttachPoint(filterPorts.outlet);
  const boilerFlowAttach = portAttachPoint(boilerPorts.primaryFlow);
  const boilerReturnAttach = portAttachPoint(boilerPorts.primaryReturn);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary ring */}
        <line x1={boilerFlowAttach.x} y1={rails.flowY} x2={pipe.flowRailEndX} y2={rails.flowY} stroke={flow} strokeWidth={w} />
        <line x1={pipe.flowRailEndX} y1={rails.flowY} x2={pipe.flowRailEndX} y2={rails.returnY} stroke={flow} strokeWidth={w} />
        <line x1={pipe.flowRailEndX} y1={rails.returnY} x2={filterOutAttach.x} y2={rails.returnY} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={filterOutAttach.x} y1={rails.returnY} x2={filterOutAttach.x} y2={filterOutAttach.y} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={filterInAttach.x} y1={filterInAttach.y} x2={filterInAttach.x} y2={rails.returnY} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={filterInAttach.x} y1={rails.returnY} x2={boilerReturnAttach.x} y2={rails.returnY} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={boilerReturnAttach.x} y1={rails.returnY} x2={boilerReturnAttach.x} y2={boilerReturnAttach.y} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={boilerFlowAttach.x} y1={rails.flowY} x2={boilerFlowAttach.x} y2={boilerFlowAttach.y} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />

        {/* Radiator branch spurs */}
        {routeEmitterSpurs(positions.radiator_branch_1.left, rails).map((seg, i) => (
          <line
            key={`em1-${i}`}
            x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
            stroke={seg.rail === 'ch_flow' ? flow : ret}
            strokeWidth={PIPE_STROKE_BRANCH}
            strokeDasharray={seg.rail === 'ch_return' ? pipeDash(options.printSafe, false) : undefined}
          />
        ))}
        {routeEmitterSpurs(positions.radiator_branch_2.left, rails).map((seg, i) => (
          <line
            key={`em2-${i}`}
            x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
            stroke={seg.rail === 'ch_flow' ? flow : ret}
            strokeWidth={PIPE_STROKE_BRANCH}
            strokeDasharray={seg.rail === 'ch_return' ? pipeDash(options.printSafe, false) : undefined}
          />
        ))}

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={midFlowX} y={rails.flowY} direction="right" color={flow} />
            <MidPipeArrow midX={midReturnX} y={rails.returnY} direction="left" color={ret} />
          </>
        )}

        {/* Pipe label */}
        <text {...pipeLabelProps(mfFilterLabelX, rails.returnY, 'above', ret)}>Clean return into boiler</text>
        <line
          x1={Math.min(filterInAttach.x, filterOutAttach.x)}
          y1={rails.returnY}
          x2={Math.max(filterInAttach.x, filterOutAttach.x)}
          y2={rails.returnY}
          stroke="transparent"
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="magnetic-filter-final-return-before-boiler"
        />
      </PipeLayer>

      <TopologyNode role="boiler" left={positions.boiler.left} top={positions.boiler.top}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_1" left={positions.radiator_branch_1.left} top={positions.radiator_branch_1.top}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_2" left={positions.radiator_branch_2.left} top={positions.radiator_branch_2.top}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="magnetic_filter_return_final_before_boiler" left={positions.magnetic_filter_return_final_before_boiler.left} top={positions.magnetic_filter_return_final_before_boiler.top}><MagneticFilterPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}
