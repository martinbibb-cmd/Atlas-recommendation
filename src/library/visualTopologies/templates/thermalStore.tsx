/**
 * thermalStore.tsx — Regular boiler with thermal store topology.
 *
 * Canonical template for thermal store (primary-side stored water) systems.
 * Key physics: primary and potable circuits are SEPARATE — no mixing.
 * The thermal store body holds primary/system water; the internal coil
 * heats a separate potable water circuit.
 *
 * Primary features:
 *   - Regular boiler with external pump on primary flow
 *   - Thermal store (amber-coloured vessel = stored primary water)
 *   - Internal heat-exchanger coil: cold mains in (bottom-right) → hot DHW out (top-right)
 *   - Primary loop: boiler → pump → store primary-in → store primary-out → boiler
 */

import {
  BoilerPrimitive,
  PumpPrimitive,
  ThermalStorePrimitive,
} from '../../visualPrimitives/primitives';
import {
  MidPipeArrow,
  PIPE_STROKE_BRANCH,
  PIPE_STROKE_MAIN,
  THERMAL_STORE_SM_PORTS,
  PipeLayer,
  TopologyNode,
  TopologyShell,
  offsetPoint,
  pipeDash,
  pipeLabelProps,
  pipeStroke,
} from './_shared';
import type { VisualTopologyRenderOptions } from '../topologies/types';

export function ThermalStoreTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);
  const storePorts = {
    primaryIn: offsetPoint(430, 114, THERMAL_STORE_SM_PORTS.primaryIn),
    primaryOut: offsetPoint(430, 114, THERMAL_STORE_SM_PORTS.primaryOut),
    potableHotOut: offsetPoint(430, 114, THERMAL_STORE_SM_PORTS.potableHotOut),
    potableColdIn: offsetPoint(430, 114, THERMAL_STORE_SM_PORTS.potableColdIn),
  };

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/*
          PRIMARY water loop — system/boiler water stored in vessel body (amber).
          Flow from boiler → store primary-in (left-top of store).
          Return from store primary-out (left-bottom) → pump → boiler.
        */}
        {/* Flow passes through external pump on primary flow (regular boiler layout). */}
        <line x1={132} y1={176} x2={173} y2={176} stroke={flow} strokeWidth={w} data-testid="thermal-store-primary-pipe" />
        <line x1={237} y1={176} x2={420} y2={176} stroke={flow} strokeWidth={w} data-testid="pump-topology-circuit" />
        <line x1={420} y1={176} x2={storePorts.primaryIn.x} y2={176} stroke={flow} strokeWidth={w} data-testid="thermal-store-primary-pipe" />
        <line x1={storePorts.primaryIn.x} y1={176} x2={storePorts.primaryIn.x} y2={storePorts.primaryIn.y} stroke={flow} strokeWidth={w} />
        {/* Return path back to boiler (no pump on return). */}
        <line x1={storePorts.primaryOut.x} y1={storePorts.primaryOut.y} x2={storePorts.primaryOut.x} y2={286} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={420} y1={286} x2={132} y2={286} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} data-testid="thermal-store-primary-pipe" />
        <line x1={storePorts.primaryOut.x} y1={286} x2={420} y2={286} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} data-testid="thermal-store-primary-pipe" />
        <line x1={132} y1={286} x2={132} y2={232} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/*
          POTABLE water path — cold mains enters coil (bottom-right of store),
          heated by primary water, exits as hot DHW (top-right of store).
          Separate from primary loop — no shared pipe segments.
        */}
        <line x1={storePorts.potableColdIn.x} y1={storePorts.potableColdIn.y} x2={storePorts.potableColdIn.x} y2={226} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={storePorts.potableColdIn.x} y1={226} x2={676} y2={226} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} data-testid="thermal-store-potable-pipe" />
        <line x1={storePorts.potableHotOut.x} y1={storePorts.potableHotOut.y} x2={storePorts.potableHotOut.x} y2={162} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={storePorts.potableHotOut.x} y1={162} x2={676} y2={162} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} data-testid="thermal-store-potable-pipe" />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={276} y={176} direction="right" color={flow} />
            <MidPipeArrow midX={276} y={286} direction="left" color={ret} />
          </>
        )}

        {/* Pipe labels */}
        <text {...pipeLabelProps(528, 162, 'above', flow)}>Potable hot water out</text>
        <text {...pipeLabelProps(528, 226, 'below', ret)}>Potable mains in</text>
        <text {...pipeLabelProps(170, 176, 'above', flow)}>Primary water loop</text>
        <text {...pipeLabelProps(528, 246, 'below', options.printSafe ? '#000' : '#334155')}>Potable path isolated via internal coil</text>
      </PipeLayer>

      <TopologyNode role="boiler" left={64} top={154}><BoilerPrimitive variant="regular" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="pump" left={170} top={155}><PumpPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="thermal_store" left={430} top={114}><ThermalStorePrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}
