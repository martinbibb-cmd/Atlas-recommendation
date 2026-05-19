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
  MAGNETIC_FILTER_SM_PORTS,
  PIPE_STROKE_BRANCH,
  PIPE_STROKE_MAIN,
  POWERFLUSH_SM_PORTS,
  PipeLayer,
  TopologyNode,
  TopologyShell,
  elbowSegments,
  inlineServiceSegments,
  offsetPoint,
  pipeDash,
  pipeLabelProps,
  portAttachPoint,
  pipeStroke,
} from './_shared';
import type { VisualTopologyRenderOptions } from '../topologies/types';
import { computeTopologyLayout, getTopologyLayoutDeclaration, routeEmitterSpurs } from '../layout';

export function PowerflushServiceTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const layout = computeTopologyLayout(getTopologyLayoutDeclaration('powerflush_service_layout'));
  const { positions, rails, pipe } = layout;

  // Derived coordinate constants — all absolute positions expressed as layout-state + named offset
  const PF_HOSE_CONNECT_X_OFFSET   = 30;   // hose connect x is just left of flow rail start
  const PF_LABEL_X_OFFSET          = 36;   // label x offset from machine left
  const pipeConnectX               = pipe.flowRailStartX - PF_HOSE_CONNECT_X_OFFSET;
  const pfLabelX                   = positions.powerflush_machine.left + PF_LABEL_X_OFFSET;
  const powerflushPorts = {
    systemInlet: offsetPoint(positions.powerflush_machine.left, positions.powerflush_machine.top, POWERFLUSH_SM_PORTS.systemInlet),
    systemOutlet: offsetPoint(positions.powerflush_machine.left, positions.powerflush_machine.top, POWERFLUSH_SM_PORTS.systemOutlet),
  };
  const filterPorts = {
    inlet: offsetPoint(positions.magnetic_filter_return_before_boiler.left, positions.magnetic_filter_return_before_boiler.top, MAGNETIC_FILTER_SM_PORTS.inlet),
    outlet: offsetPoint(positions.magnetic_filter_return_before_boiler.left, positions.magnetic_filter_return_before_boiler.top, MAGNETIC_FILTER_SM_PORTS.outlet),
  };
  const pfInAttach = portAttachPoint(powerflushPorts.systemInlet);
  const pfOutAttach = portAttachPoint(powerflushPorts.systemOutlet);
  const filterInAttach = portAttachPoint(filterPorts.inlet);
  const filterOutAttach = portAttachPoint(filterPorts.outlet);
  const pfDirtyY                   = pfInAttach.y;
  const pfCleanY                   = pfOutAttach.y;
  const midFlowX                   = Math.round((pipe.flowRailStartX + pipe.flowRailEndX) / 2);
  const midReturnX                 = Math.round((pipe.heatSourceReturnX + pipe.flowRailEndX) / 2);

  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);
  const dirty = options.printSafe ? '#374151' : '#92400e';
  const clean = options.printSafe ? '#111827' : '#16a34a';

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/* Primary flow ring */}
        <line x1={pipe.flowRailStartX} y1={rails.flowY} x2={pipe.flowRailEndX} y2={rails.flowY} stroke={flow} strokeWidth={w} />
        <line x1={pipe.flowRailEndX} y1={rails.flowY} x2={pipe.flowRailEndX} y2={rails.returnY} stroke={flow} strokeWidth={w} />
        {inlineServiceSegments(pipe.flowRailEndX, pipe.heatSourceReturnX, rails.returnY, filterOutAttach.x, filterInAttach.x).map((seg, i) => (
          <line
            key={`filter-inline-${i}`}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={ret}
            strokeWidth={w}
            strokeDasharray={pipeDash(options.printSafe, false)}
          />
        ))}
        <line x1={filterOutAttach.x} y1={rails.returnY} x2={filterOutAttach.x} y2={filterOutAttach.y} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={filterInAttach.x} y1={rails.returnY} x2={filterInAttach.x} y2={filterInAttach.y} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
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
        {/* Radiator branch spurs — rad 3 */}
        {routeEmitterSpurs(positions.radiator_branch_3.left, rails).map((seg, i) => (
          <line
            key={`em3-${i}`}
            x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
            stroke={seg.rail === 'ch_flow' ? flow : ret}
            strokeWidth={PIPE_STROKE_BRANCH}
            strokeDasharray={seg.rail === 'ch_return' ? pipeDash(options.printSafe, false) : undefined}
          />
        ))}

        {/* Powerflush machine hose connections */}
        {elbowSegments({ x: pipeConnectX, y: rails.returnY }, pfInAttach, 'vertical-first').map((seg, i) => (
          <line
            key={`pf-dirty-${i}`}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={dirty}
            strokeWidth={PIPE_STROKE_BRANCH}
            strokeDasharray="6 3"
          />
        ))}
        {elbowSegments({ x: pipeConnectX, y: rails.flowY }, pfOutAttach, 'vertical-first').map((seg, i) => (
          <line key={`pf-clean-${i}`} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} stroke={clean} strokeWidth={PIPE_STROKE_BRANCH} />
        ))}

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={midFlowX} y={rails.flowY} direction="right" color={flow} />
            <MidPipeArrow midX={midReturnX} y={rails.returnY} direction="left" color={ret} />
          </>
        )}

        {/* Pipe labels */}
        <text {...pipeLabelProps(pfLabelX, pfDirtyY, 'above', dirty)}>Dirty return path</text>
        <text {...pipeLabelProps(pfLabelX, pfCleanY, 'below', clean)}>Clean return path</text>
      </PipeLayer>

      <TopologyNode role="powerflush_machine" left={positions.powerflush_machine.left} top={positions.powerflush_machine.top}><PowerflushMachinePrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_1" left={positions.radiator_branch_1.left} top={positions.radiator_branch_1.top}><RadiatorPrimitive size="sm" temperatureTone="cool" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_2" left={positions.radiator_branch_2.left} top={positions.radiator_branch_2.top}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="radiator_branch_3" left={positions.radiator_branch_3.left} top={positions.radiator_branch_3.top}><RadiatorPrimitive size="sm" temperatureTone="warm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="boiler" left={positions.boiler.left} top={positions.boiler.top}><BoilerPrimitive variant="regular" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="magnetic_filter_return_before_boiler" left={positions.magnetic_filter_return_before_boiler.left} top={positions.magnetic_filter_return_before_boiler.top}><MagneticFilterPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}
