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

export function SystemPressureLayoutTopology({ options }: { options: VisualTopologyRenderOptions }) {
  return (
    <TopologyShell options={options}>
      <TopologyNode role="boiler" left={46} top={154}><BoilerPrimitive variant="system" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="pipe_loop" left={190} top={116}><PipeLoopPrimitive size="md" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="expansion_vessel" left={468} top={210}><ExpansionVesselPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="pressure_gauge_low" left={612} top={58}><PressureGaugePrimitive pressureBar={0.5} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="pressure_gauge_normal" left={612} top={170}><PressureGaugePrimitive pressureBar={1.3} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="pressure_gauge_high" left={612} top={282}><PressureGaugePrimitive pressureBar={2.8} size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
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
