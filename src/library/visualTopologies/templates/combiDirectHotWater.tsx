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

export function CombiDirectHotWaterTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary CH ring */}
        <line x1={220} y1={140} x2={620} y2={140} stroke={flow} strokeWidth={w} />
        <line x1={620} y1={140} x2={620} y2={300} stroke={flow} strokeWidth={w} />
        <line x1={620} y1={300} x2={220} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={220} y1={300} x2={220} y2={220} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Radiator branch spurs */}
        <line x1={414} y1={140} x2={414} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={350} y1={112} x2={350} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={570} y1={140} x2={570} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={506} y1={112} x2={506} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* DHW stubs from combi */}
        <line x1={188} y1={250} x2={80} y2={250} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={188} y1={210} x2={80} y2={210} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={420} y={140} direction="right" color={flow} />
            <MidPipeArrow midX={420} y={300} direction="left" color={ret} />
          </>
        )}

        {/* Pipe labels */}
        <text {...pipeLabelProps(86, 210, 'above', flow)}>Hot water out</text>
        <text {...pipeLabelProps(86, 250, 'below', ret)}>Mains cold in</text>
        <text {...pipeLabelProps(520, 140, 'above', flow)}>CH flow</text>
        <text {...pipeLabelProps(500, 300, 'below', ret)}>CH return</text>
      </PipeLayer>

      <TopologyNode role="combi_boiler" left={142} top={164}><BoilerPrimitive variant="combi" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_1" left={340} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_2" left={496} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      {options.showLabels && <div style={noCylinderNoteStyle()}>No cylinder</div>}
    </TopologyShell>
  );
}
