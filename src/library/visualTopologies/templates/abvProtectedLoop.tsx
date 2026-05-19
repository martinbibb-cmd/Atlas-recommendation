/**
 * abvProtectedLoop.tsx — System boiler with ABV (Automatic Bypass Valve) topology.
 *
 * Canonical template for sealed systems using an ABV to protect the boiler
 * against low flow conditions caused by multiple TRVs closing simultaneously.
 */

import {
  ABVPrimitive,
  BoilerPrimitive,
  RadiatorPrimitive,
} from '../../visualPrimitives/primitives';
import {
  AUX_COLOUR,
  MidPipeArrow,
  PIPE_STROKE_BRANCH,
  PIPE_STROKE_MAIN,
  PipeLayer,
  TopologyNode,
  TopologyShell,
  pipeDash,
  pipeStroke,
} from './_shared';
import type { VisualTopologyRenderOptions } from '../topologies/types';

export function AbvProtectedLoopTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary ring */}
        <line x1={130} y1={140} x2={620} y2={140} stroke={flow} strokeWidth={w} />
        <line
          x1={620}
          y1={140}
          x2={620}
          y2={300}
          stroke={flow}
          strokeWidth={w}
          data-testid="abv-restriction-boundary"
        />
        {/* Return path — system boiler internal pump assumed */}
        <line x1={620} y1={300} x2={130} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={130} y1={300} x2={130} y2={210} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Radiator branch spurs */}
        <line x1={348} y1={140} x2={348} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={284} y1={112} x2={284} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={494} y1={140} x2={494} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={430} y1={112} x2={430} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        {/* ABV bridge — maintains PIPE_STROKE_BRANCH (AUX path) */}
        <line
          x1={556}
          y1={140}
          x2={556}
          y2={300}
          stroke={AUX_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="abv-downstream-boiler-upstream-restrictions-bridge"
        />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={375} y={140} direction="right" color={flow} />
            <MidPipeArrow midX={375} y={300} direction="left" color={ret} />
          </>
        )}
      </PipeLayer>

      <TopologyNode role="boiler" left={60} top={164}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="restriction_radiator_branch_1" left={274} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="restriction_radiator_branch_2" left={420} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="abv_after_boiler_before_restrictions" left={470} top={176}><ABVPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}
