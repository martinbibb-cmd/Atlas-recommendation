/**
 * combiDirectHotWater.tsx — Combi boiler with direct hot water topology.
 *
 * Canonical template for combi (combination) boilers providing on-demand
 * hot water without a storage cylinder.
 * Primary features:
 *   - Combi boiler (internal pump + plate heat exchanger)
 *   - No cylinder (noted in diagram)
 *   - DHW inlet/outlet stubs from boiler
 *   - Two radiator branch spurs
 */

import {
  BoilerPrimitive,
  RadiatorPrimitive,
} from '../../visualPrimitives/primitives';
import {
  MidPipeArrow,
  PIPE_STROKE_BRANCH,
  PIPE_STROKE_MAIN,
  PipeLayer,
  TopologyNode,
  TopologyShell,
  noCylinderNoteStyle,
  pipeDash,
  pipeLabelProps,
  pipeStroke,
} from './_shared';
import type { VisualTopologyRenderOptions } from '../topologies/types';
import { computeTopologyLayout, getTopologyLayoutDeclaration, routeEmitterSpurs } from '../layout';

export function CombiDirectHotWaterTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const layout = computeTopologyLayout(getTopologyLayoutDeclaration('combi_direct_hot_water'));
  const { positions, rails, pipe } = layout;

  // Derived coordinate constants — all absolute positions expressed as layout-state + named offset
  const dhwStubX          = positions.combi_boiler.left + 46;   // DHW stub x at boiler side port
  const dhwFlowY          = positions.combi_boiler.top  + 46;   // hot water outlet y
  const dhwReturnY        = positions.combi_boiler.top  + 86;   // cold mains inlet y
  const dhwEndX           = positions.combi_boiler.left - 62;   // stub extends to the left
  const dhwLabelX         = dhwEndX + 6;                         // label x for DHW stubs
  const chFlowLabelX      = pipe.flowRailEndX - 100;             // label x for CH flow
  const chReturnLabelX    = pipe.flowRailEndX - 120;             // label x for CH return
  const midFlowX          = Math.round((pipe.flowRailStartX + pipe.flowRailEndX) / 2);
  const midReturnX        = Math.round((pipe.heatSourceReturnX + pipe.flowRailEndX) / 2);

  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary CH ring */}
        <line x1={pipe.flowRailStartX} y1={rails.flowY} x2={pipe.flowRailEndX} y2={rails.flowY} stroke={flow} strokeWidth={w} />
        <line x1={pipe.flowRailEndX} y1={rails.flowY} x2={pipe.flowRailEndX} y2={rails.returnY} stroke={flow} strokeWidth={w} />
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

        {/* DHW stubs from combi */}
        <line x1={dhwStubX} y1={dhwReturnY} x2={dhwEndX} y2={dhwReturnY} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={dhwStubX} y1={dhwFlowY} x2={dhwEndX} y2={dhwFlowY} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={midFlowX} y={rails.flowY} direction="right" color={flow} />
            <MidPipeArrow midX={midReturnX} y={rails.returnY} direction="left" color={ret} />
          </>
        )}

        {/* Pipe labels */}
        <text {...pipeLabelProps(dhwLabelX, dhwFlowY, 'above', flow)}>Hot water out</text>
        <text {...pipeLabelProps(dhwLabelX, dhwReturnY, 'below', ret)}>Mains cold in</text>
        <text {...pipeLabelProps(chFlowLabelX, rails.flowY, 'above', flow)}>CH flow</text>
        <text {...pipeLabelProps(chReturnLabelX, rails.returnY, 'below', ret)}>CH return</text>
      </PipeLayer>

      <TopologyNode role="combi_boiler" left={positions.combi_boiler.left} top={positions.combi_boiler.top}><BoilerPrimitive variant="combi" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_1" left={positions.radiator_branch_1.left} top={positions.radiator_branch_1.top}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_2" left={positions.radiator_branch_2.left} top={positions.radiator_branch_2.top}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      {options.showLabels && <div style={noCylinderNoteStyle()}>No cylinder</div>}
    </TopologyShell>
  );
}
