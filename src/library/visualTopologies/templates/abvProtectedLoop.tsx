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
  BOILER_SYSTEM_SM_PORTS,
  MidPipeArrow,
  PIPE_STROKE_BRANCH,
  PIPE_STROKE_MAIN,
  PipeLayer,
  TopologyNode,
  TopologyShell,
  offsetPoint,
  pipeDash,
  portAttachPoint,
  pipeStroke,
} from './_shared';
import type { VisualTopologyRenderOptions } from '../topologies/types';
import { computeTopologyLayout, getTopologyLayoutDeclaration, routeEmitterSpurs } from '../layout';

export function AbvProtectedLoopTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const layout = computeTopologyLayout(getTopologyLayoutDeclaration('abv_protected_heating_loop'));
  const { positions, rails, pipe } = layout;

  // Derived coordinate constants — all absolute positions expressed as layout-state + named offset
  const ABV_BRIDGE_X_OFFSET = 86;   // bridge x relative to ABV component left edge
  const abvBridgeX          = positions.abv_after_boiler_before_restrictions.left + ABV_BRIDGE_X_OFFSET;
  const boilerPorts = {
    primaryReturn: offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryReturn),
    primaryFlow: offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryFlow),
  };
  const boilerFlowAttach = portAttachPoint(boilerPorts.primaryFlow);
  const boilerReturnAttach = portAttachPoint(boilerPorts.primaryReturn);
  const midFlowX            = Math.round((boilerFlowAttach.x + pipe.flowRailEndX) / 2);
  const midReturnX          = Math.round((boilerReturnAttach.x + pipe.flowRailEndX) / 2);

  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary ring */}
        <line x1={boilerFlowAttach.x} y1={rails.flowY} x2={pipe.flowRailEndX} y2={rails.flowY} stroke={flow} strokeWidth={w} />
        <line
          x1={pipe.flowRailEndX}
          y1={rails.flowY}
          x2={pipe.flowRailEndX}
          y2={rails.returnY}
          stroke={flow}
          strokeWidth={w}
          data-testid="abv-restriction-boundary"
        />
        {/* Return path — system boiler internal pump assumed */}
        <line x1={pipe.flowRailEndX} y1={rails.returnY} x2={boilerReturnAttach.x} y2={rails.returnY} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={boilerReturnAttach.x} y1={rails.returnY} x2={boilerReturnAttach.x} y2={boilerReturnAttach.y} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={boilerFlowAttach.x} y1={rails.flowY} x2={boilerFlowAttach.x} y2={boilerFlowAttach.y} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />

        {/* Radiator branch spurs */}
        {routeEmitterSpurs(positions.restriction_radiator_branch_1.left, rails).map((seg, i) => (
          <line
            key={`em1-${i}`}
            x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
            stroke={seg.rail === 'ch_flow' ? flow : ret}
            strokeWidth={PIPE_STROKE_BRANCH}
            strokeDasharray={seg.rail === 'ch_return' ? pipeDash(options.printSafe, false) : undefined}
          />
        ))}
        {routeEmitterSpurs(positions.restriction_radiator_branch_2.left, rails).map((seg, i) => (
          <line
            key={`em2-${i}`}
            x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
            stroke={seg.rail === 'ch_flow' ? flow : ret}
            strokeWidth={PIPE_STROKE_BRANCH}
            strokeDasharray={seg.rail === 'ch_return' ? pipeDash(options.printSafe, false) : undefined}
          />
        ))}

        {/* ABV bridge — maintains PIPE_STROKE_BRANCH (AUX path) */}
        <line
          x1={abvBridgeX}
          y1={rails.flowY}
          x2={abvBridgeX}
          y2={rails.returnY}
          stroke={AUX_COLOUR}
          strokeWidth={PIPE_STROKE_BRANCH}
          data-testid="abv-downstream-boiler-upstream-restrictions-bridge"
        />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={midFlowX} y={rails.flowY} direction="right" color={flow} />
            <MidPipeArrow midX={midReturnX} y={rails.returnY} direction="left" color={ret} />
          </>
        )}
      </PipeLayer>

      <TopologyNode role="boiler" left={positions.boiler.left} top={positions.boiler.top}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="restriction_radiator_branch_1" left={positions.restriction_radiator_branch_1.left} top={positions.restriction_radiator_branch_1.top}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="restriction_radiator_branch_2" left={positions.restriction_radiator_branch_2.left} top={positions.restriction_radiator_branch_2.top}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="abv_after_boiler_before_restrictions" left={positions.abv_after_boiler_before_restrictions.left} top={positions.abv_after_boiler_before_restrictions.top}><ABVPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}
