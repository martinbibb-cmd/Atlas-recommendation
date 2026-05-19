/**
 * systemPressureLayout.tsx — System pressure visualisation topology.
 *
 * Canonical template showing three pressure states (low, normal, high) with
 * a sealed circuit loop and expansion vessel.
 * Used in educational content about system pressure management.
 */

import {
  BoilerPrimitive,
  ExpansionVesselPrimitive,
  PipeLoopPrimitive,
  PressureGaugePrimitive,
} from '../../visualPrimitives/primitives';
import {
  TopologyNode,
  TopologyShell,
  pressureStateLabelStyle,
} from './_shared';
import type { VisualTopologyRenderOptions } from '../topologies/types';
import { computeTopologyLayout, getTopologyLayoutDeclaration } from '../layout';

export function SystemPressureLayoutTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const { positions } = computeTopologyLayout(getTopologyLayoutDeclaration('system_pressure_layout'));

  return (
    <TopologyShell options={options}>
      <TopologyNode role="boiler" left={positions.boiler.left} top={positions.boiler.top}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="pipe_loop" left={positions.pipe_loop.left} top={positions.pipe_loop.top}><PipeLoopPrimitive size="md" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="expansion_vessel" left={positions.expansion_vessel.left} top={positions.expansion_vessel.top}><ExpansionVesselPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="pressure_gauge_low" left={positions.pressure_gauge_low.left} top={positions.pressure_gauge_low.top}><PressureGaugePrimitive pressureBar={0.5} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="pressure_gauge_normal" left={positions.pressure_gauge_normal.left} top={positions.pressure_gauge_normal.top}><PressureGaugePrimitive pressureBar={1.3} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="pressure_gauge_high" left={positions.pressure_gauge_high.left} top={positions.pressure_gauge_high.top}><PressureGaugePrimitive pressureBar={2.8} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      {options.showLabels && (
        <div style={pressureStateLabelStyle()}>
          <span>Low state</span>
          <span>Normal state</span>
          <span>High state</span>
        </div>
      )}
    </TopologyShell>
  );
}
