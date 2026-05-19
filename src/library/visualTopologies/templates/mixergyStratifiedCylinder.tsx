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
  BOILER_SYSTEM_SM_PORTS,
  MIXERGY_SM_PORTS,
  MidPipeArrow,
  PIPE_STROKE_BRANCH,
  PIPE_STROKE_MAIN,
  PipeLayer,
  TopologyNode,
  TopologyShell,
  dropOrRiseSegment,
  elbowSegments,
  offsetPoint,
  pipeDash,
  pipeLabelProps,
  portAttachPoint,
  pipeStroke,
} from './_shared';
import type { VisualTopologyRenderOptions } from '../topologies/types';
import { computeTopologyLayout, getTopologyLayoutDeclaration } from '../layout';

export function MixergyStratifiedTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const layout = computeTopologyLayout(getTopologyLayoutDeclaration('mixergy_stratified_cylinder'));
  const { positions, rails, pipe } = layout;

  // Derived coordinate constants — all absolute positions expressed as layout-state + named offset
  const MX_DHW_STUB_RIGHT_OFFSET  = 120;  // DHW stub extends this far right of mxDhwX
  const MX_DHW_LABEL_OFFSET       = 6;    // label x standoff from stub end
  const MX_CHARGE_LABEL_OFFSET    = 8;    // label x standoff from flow rail end
  const boilerPorts = {
    primaryReturn: offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryReturn),
    primaryFlow: offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryFlow),
  };
  const mixergyPorts = {
    hotDrawOff: offsetPoint(positions.mixergy_cylinder.left, positions.mixergy_cylinder.top, MIXERGY_SM_PORTS.hotDrawOff),
    coldInlet: offsetPoint(positions.mixergy_cylinder.left, positions.mixergy_cylinder.top, MIXERGY_SM_PORTS.coldInlet),
    primaryFlowIn: offsetPoint(positions.mixergy_cylinder.left, positions.mixergy_cylinder.top, MIXERGY_SM_PORTS.primaryFlowIn),
    primaryReturnOut: offsetPoint(positions.mixergy_cylinder.left, positions.mixergy_cylinder.top, MIXERGY_SM_PORTS.primaryReturnOut),
  };
  const boilerFlowAttach = portAttachPoint(boilerPorts.primaryFlow);
  const boilerReturnAttach = portAttachPoint(boilerPorts.primaryReturn);
  const mxFlowAttach = portAttachPoint(mixergyPorts.primaryFlowIn);
  const mxReturnAttach = portAttachPoint(mixergyPorts.primaryReturnOut);
  const mxHotAttach = portAttachPoint(mixergyPorts.hotDrawOff);
  const mxColdAttach = portAttachPoint(mixergyPorts.coldInlet);

  const mxDhwX                    = mixergyPorts.hotDrawOff.x;
  const mxDhwFlowY                = mixergyPorts.hotDrawOff.y - 12;
  const mxDhwStubRightX           = mxDhwX + MX_DHW_STUB_RIGHT_OFFSET;
  const mxDhwLabelX               = mxDhwStubRightX + MX_DHW_LABEL_OFFSET;
  const mxChargeLabelX            = pipe.flowRailEndX + MX_CHARGE_LABEL_OFFSET;
  const midFlowX                  = Math.round((boilerFlowAttach.x + pipe.flowRailEndX) / 2);
  const midReturnX                = Math.round((boilerReturnAttach.x + pipe.flowRailEndX) / 2);

  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary charging loop */}
        <line x1={boilerFlowAttach.x} y1={rails.flowY} x2={pipe.flowRailEndX} y2={rails.flowY} stroke={flow} strokeWidth={w} />
        {/* Return pipe — system boiler internal pump assumed */}
        <line x1={pipe.flowRailEndX} y1={rails.returnY} x2={boilerReturnAttach.x} y2={rails.returnY} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        {dropOrRiseSegment(boilerFlowAttach.x, rails.flowY, boilerFlowAttach.y).map((seg, i) => (
          <line key={`boiler-flow-${i}`} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        ))}
        {dropOrRiseSegment(boilerReturnAttach.x, rails.returnY, boilerReturnAttach.y).map((seg, i) => (
          <line
            key={`boiler-return-${i}`}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={ret}
            strokeWidth={PIPE_STROKE_BRANCH}
            strokeDasharray={pipeDash(options.printSafe, false)}
          />
        ))}

        {/* Cylinder charging stubs */}
        {elbowSegments({ x: pipe.flowRailEndX, y: rails.flowY }, mxFlowAttach).map((seg, i) => (
          <line key={`mx-flow-${i}`} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        ))}
        {elbowSegments({ x: pipe.flowRailEndX, y: rails.returnY }, mxReturnAttach).map((seg, i) => (
          <line
            key={`mx-return-${i}`}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={ret}
            strokeWidth={PIPE_STROKE_BRANCH}
            strokeDasharray={pipeDash(options.printSafe, false)}
          />
        ))}

        {/* DHW stubs */}
        {elbowSegments(mxColdAttach, { x: mxDhwStubRightX, y: rails.returnY }, 'vertical-first').map((seg, i) => (
          <line
            key={`mx-cold-${i}`}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={ret}
            strokeWidth={PIPE_STROKE_BRANCH}
            strokeDasharray={pipeDash(options.printSafe, false)}
          />
        ))}
        {elbowSegments(mxHotAttach, { x: mxDhwX, y: mxDhwFlowY }, 'vertical-first').map((seg, i) => (
          <line key={`mx-hot-rise-${i}`} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        ))}
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
