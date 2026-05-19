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
import { computeTopologyLayout, getTopologyLayoutDeclaration } from '../layout';

export function MixergyStratifiedTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const layout = computeTopologyLayout(getTopologyLayoutDeclaration('mixergy_stratified_cylinder'));
  const { positions, rails, pipe } = layout;

  // Derived coordinate constants — all absolute positions expressed as layout-state + named offset
  const MX_CYL_PORT_X_OFFSET      = 10;   // cylinder primary port x inset from left edge
  const MX_DHW_X_OFFSET           = 70;   // DHW stub x offset from cylinder left
  const MX_DHW_FLOW_Y_OFFSET      = 12;   // DHW hot-out y offset above flow rail
  const MX_DHW_STUB_RIGHT_OFFSET  = 120;  // DHW stub extends this far right of mxDhwX
  const MX_DHW_LABEL_OFFSET       = 6;    // label x standoff from stub end
  const MX_CHARGE_LABEL_OFFSET    = 8;    // label x standoff from flow rail end
  const mxCylPortX                = pipe.flowRailEndX + MX_CYL_PORT_X_OFFSET;
  const mxDhwX                    = positions.mixergy_cylinder.left + MX_DHW_X_OFFSET;
  const mxDhwFlowY                = rails.flowY - MX_DHW_FLOW_Y_OFFSET;
  const mxDhwStubRightX           = mxDhwX + MX_DHW_STUB_RIGHT_OFFSET;
  const mxDhwLabelX               = mxDhwStubRightX + MX_DHW_LABEL_OFFSET;
  const mxChargeLabelX            = pipe.flowRailEndX + MX_CHARGE_LABEL_OFFSET;
  const midFlowX                  = Math.round((pipe.flowRailStartX + pipe.flowRailEndX) / 2);
  const midReturnX                = Math.round((pipe.heatSourceReturnX + pipe.flowRailEndX) / 2);

  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary charging loop */}
        <line x1={pipe.flowRailStartX} y1={rails.flowY} x2={pipe.flowRailEndX} y2={rails.flowY} stroke={flow} strokeWidth={w} />
        {/* Return pipe — system boiler internal pump assumed */}
        <line x1={pipe.flowRailEndX} y1={rails.returnY} x2={pipe.heatSourceReturnX} y2={rails.returnY} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={pipe.heatSourceReturnX} y1={rails.returnY} x2={pipe.heatSourceReturnX} y2={pipe.heatSourceReturnY} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* Cylinder charging stubs */}
        <line x1={pipe.flowRailEndX} y1={rails.flowY} x2={mxCylPortX} y2={rails.flowY} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={pipe.flowRailEndX} y1={rails.returnY} x2={mxCylPortX} y2={rails.returnY} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/* DHW stubs */}
        <line x1={mxDhwX} y1={rails.returnY} x2={mxDhwStubRightX} y2={rails.returnY} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={mxDhwX} y1={mxDhwFlowY} x2={mxDhwStubRightX} y2={mxDhwFlowY} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={midFlowX} y={rails.flowY} direction="right" color={flow} />
            <MidPipeArrow midX={midReturnX} y={rails.returnY} direction="left" color={ret} />
          </>
        )}

        {/* Pipe labels */}
        <text {...pipeLabelProps(mxDhwLabelX, mxDhwFlowY, 'above', flow)}>Hot draw-off from top</text>
        <text {...pipeLabelProps(mxDhwLabelX, rails.returnY, 'below', ret)}>Cold mains entry</text>
        <text {...pipeLabelProps(mxChargeLabelX, rails.flowY, 'above', flow)}>Charging heat input</text>
      </PipeLayer>

      <TopologyNode role="boiler" left={positions.boiler.left} top={positions.boiler.top}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="mixergy_cylinder" left={positions.mixergy_cylinder.left} top={positions.mixergy_cylinder.top}><MixergyCylinderPrimitive stateOfChargePct={70} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}
