/**
 * mixergyStratifiedCylinder.tsx — System boiler with Mixergy stratified cylinder topology.
 *
 * Canonical template for Mixergy smart cylinder installations.
 * Primary features:
 *   - System boiler (internal pump)
 *   - Mixergy stratified cylinder (top-down charging, sharp thermocline)
 *   - DHW draw-off from top (hottest water first)
 *   - Cold mains diffuser at bottom (protects stratification)
 */

import {
  BoilerPrimitive,
  MixergyCylinderPrimitive,
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

export function MixergyStratifiedTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary charging loop */}
        <line x1={130} y1={190} x2={370} y2={190} stroke={flow} strokeWidth={w} />
        {/* Return pipe — system boiler internal pump assumed */}
        <line x1={370} y1={290} x2={130} y2={290} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={130} y1={290} x2={130} y2={248} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Cylinder charging stubs */}
        <line x1={370} y1={190} x2={480} y2={190} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={370} y1={290} x2={480} y2={290} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* DHW stubs */}
        <line x1={540} y1={290} x2={660} y2={290} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={540} y1={178} x2={660} y2={178} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={250} y={190} direction="right" color={flow} />
            <MidPipeArrow midX={250} y={290} direction="left" color={ret} />
          </>
        )}

        {/* Pipe labels */}
        <text {...pipeLabelProps(666, 178, 'above', flow)}>Hot draw-off from top</text>
        <text {...pipeLabelProps(666, 290, 'below', ret)}>Cold mains entry</text>
        <text {...pipeLabelProps(378, 190, 'above', flow)}>Charging heat input</text>
      </PipeLayer>

      <TopologyNode role="boiler" left={66} top={170}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="mixergy_cylinder" left={470} top={140}><MixergyCylinderPrimitive stateOfChargePct={70} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}
