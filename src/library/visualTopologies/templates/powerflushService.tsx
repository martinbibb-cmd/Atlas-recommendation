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
import { computeTopologyLayout, getTopologyLayoutDeclaration, routeEmitterSpurs } from '../layout';

export function PowerflushServiceTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const layout = computeTopologyLayout(getTopologyLayoutDeclaration('powerflush_service_layout'));
  const { positions, rails, pipe } = layout;

  // Derived coordinate constants — all absolute positions expressed as layout-state + named offset
  const PF_HOSE_CONNECT_X_OFFSET   = 30;   // hose connect x is just left of flow rail start
  const PF_MACHINE_HOSE_X_OFFSET   = 120;  // machine hose exits this far left of flow rail start
  const PF_DIRTY_Y_OFFSET          = 6;    // dirty return y offset from machine top
  const PF_CLEAN_Y_OFFSET          = 84;   // clean return y offset from machine top
  const PF_LABEL_X_OFFSET          = 36;   // label x offset from machine left
  const pipeConnectX               = pipe.flowRailStartX - PF_HOSE_CONNECT_X_OFFSET;
  const machineHoseX               = pipe.flowRailStartX - PF_MACHINE_HOSE_X_OFFSET;
  const pfDirtyY                   = positions.powerflush_machine.top + PF_DIRTY_Y_OFFSET;
  const pfCleanY                   = positions.powerflush_machine.top + PF_CLEAN_Y_OFFSET;
  const pfLabelX                   = positions.powerflush_machine.left + PF_LABEL_X_OFFSET;
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
        <line x1={pipeConnectX} y1={pfDirtyY} x2={machineHoseX} y2={pfDirtyY} stroke={dirty} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray="6 3" />
        <line x1={pipeConnectX} y1={pfCleanY} x2={machineHoseX} y2={pfCleanY} stroke={clean} strokeWidth={PIPE_STROKE_BRANCH} />

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
