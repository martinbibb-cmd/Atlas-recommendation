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
  MidPipeArrow,
  PIPE_STROKE_BRANCH,
  PIPE_STROKE_MAIN,
  PipeLayer,
  TopologyNode,
  TopologyShell,
  pipeDash,
  pipeLabelProps,
  pipeStroke,
} from './_shared';
import type { VisualTopologyRenderOptions } from '../topologies/types';

export function OpenVentedVentedCylinderTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary flow ring */}
        <line x1={120} y1={140} x2={248} y2={140} stroke={flow} strokeWidth={w} />
        <line
          x1={248}
          y1={140}
          x2={312}
          y2={140}
          stroke={flow}
          strokeWidth={w}
          data-testid="pump-topology-circuit"
        />
        <line x1={312} y1={140} x2={560} y2={140} stroke={flow} strokeWidth={w} />
        <line x1={560} y1={140} x2={560} y2={205} stroke={flow} strokeWidth={w} />
        {/* Return rail for primary loop */}
        <line x1={560} y1={300} x2={223} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={223} y1={300} x2={120} y2={300} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={120} y1={300} x2={120} y2={210} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Radiator branch spurs */}
        <line x1={348} y1={140} x2={348} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={284} y1={112} x2={284} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={494} y1={140} x2={494} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={430} y1={112} x2={430} y2={300} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Close-coupled vent and feed pair near neutral point; pump sits downstream on flow. */}
        <line
          x1={176}
          y1={140}
          x2={176}
          y2={60}
          stroke={AUX_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="open-vented-close-coupled-vent"
        />
        <line
          x1={192}
          y1={140}
          x2={192}
          y2={300}
          stroke={AUX_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="open-vented-close-coupled-feed"
        />
        <line x1={176} y1={60} x2={700} y2={60} stroke={AUX_COLOUR} strokeWidth={PIPE_STROKE_BRANCH} />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={340} y={140} direction="right" color={flow} />
            <MidPipeArrow midX={340} y={300} direction="left" color={ret} />
          </>
        )}

        {/* Pipe labels */}
        <text {...pipeLabelProps(578, 140, 'above', flow)}>Primary flow</text>
        <text {...pipeLabelProps(360, 300, 'below', ret)}>Primary return</text>
        <text {...pipeLabelProps(706, 60, 'above', AUX_COLOUR)}>Close-coupled vent/feed</text>
      </PipeLayer>

      <TopologyNode role="boiler" left={56} top={160}><BoilerPrimitive variant="regular" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="primary_flow_pump_downstream_vent_feed" left={245} top={119}><PumpPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_1" left={274} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_2" left={420} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="header_tank" left={666} top={18}><HeaderTankPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="vented_cylinder" left={520} top={170}><CylinderPrimitive variant="vented" fillLevel={0.7} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}
