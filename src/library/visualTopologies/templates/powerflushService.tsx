/**
 * powerflushService.tsx — Powerflush service connection topology.
 *
 * Canonical template showing a powerflush machine connected to a heating circuit.
 * Used for the Service zone in educational and engineering contexts.
 */

import {
  BoilerPrimitive,
  MagneticFilterPrimitive,
  PowerflushMachinePrimitive,
  RadiatorPrimitive,
} from '../../visualPrimitives/primitives';
import {
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

export function PowerflushServiceTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);
  const dirty = options.printSafe ? '#374151' : '#92400e';
  const clean = options.printSafe ? '#111827' : '#16a34a';

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary flow ring */}
        <line x1={260} y1={140} x2={690} y2={140} stroke={flow} strokeWidth={w} />
        <line x1={690} y1={140} x2={690} y2={290} stroke={flow} strokeWidth={w} />
        <line x1={690} y1={290} x2={260} y2={290} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={260} y1={290} x2={260} y2={170} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Radiator branch spurs */}
        <line x1={390} y1={140} x2={390} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={326} y1={112} x2={326} y2={290} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={542} y1={140} x2={542} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={478} y1={112} x2={478} y2={290} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={694} y1={140} x2={694} y2={112} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={630} y1={112} x2={630} y2={290} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Powerflush machine hose connections */}
        <line x1={230} y1={174} x2={140} y2={174} stroke={dirty} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray="6 3" />
        <line x1={230} y1={252} x2={140} y2={252} stroke={clean} strokeWidth={PIPE_STROKE_BRANCH} />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={475} y={140} direction="right" color={flow} />
            <MidPipeArrow midX={475} y={290} direction="left" color={ret} />
          </>
        )}

        {/* Pipe labels */}
        <text {...pipeLabelProps(62, 174, 'above', dirty)}>Dirty return path</text>
        <text {...pipeLabelProps(62, 252, 'below', clean)}>Clean return path</text>
      </PipeLayer>

      <TopologyNode role="powerflush_machine" left={26} top={168}><PowerflushMachinePrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_1" left={316} top={70}><RadiatorPrimitive size="sm" temperatureTone="cool" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_2" left={468} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_3" left={620} top={70}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="boiler" left={690} top={188}><BoilerPrimitive variant="regular" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="magnetic_filter_return_before_boiler" left={560} top={248}><MagneticFilterPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}
