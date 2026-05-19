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
import { computeTopologyLayout, getTopologyLayoutDeclaration } from '../layout';

export function ThermalStoreTopology({ options }: { options: VisualTopologyRenderOptions }) {
  const layout = computeTopologyLayout(getTopologyLayoutDeclaration('thermal_store_layout'));
  const { positions, rails, pipe } = layout;

  // Derived coordinate constants — all absolute positions expressed as layout-state + named offset
  const PUMP_SM_W                  = Math.round(100 * 0.7);   // pump rendered width at sm scale
  const pumpLeft                   = positions.pump.left;
  const pumpFlowInX                = pumpLeft + 3;             // pipe enters pump body
  const pumpFlowOutX               = pumpLeft + PUMP_SM_W - 3; // pipe exits pump body
  const TS_STORE_ENTRY_X_OFFSET    = 10;                        // x gap between store entry and store left edge
  const storeEntryX                = positions.thermal_store.left - TS_STORE_ENTRY_X_OFFSET;
  const POTABLE_HOT_Y_OFFSET       = 14;                        // potable hot y above flow rail
  const POTABLE_COLD_Y_OFFSET      = 50;                        // potable cold y below flow rail
  const POTABLE_STUB_RIGHT_OFFSET  = 246;                       // potable stubs extend this far right of store left
  const TS_POTABLE_LABEL_X_OFFSET  = 98;                        // label x offset from store left
  const potableHotY                = rails.flowY - POTABLE_HOT_Y_OFFSET;
  const potableColdY               = rails.flowY + POTABLE_COLD_Y_OFFSET;
  const potableStubRightX          = positions.thermal_store.left + POTABLE_STUB_RIGHT_OFFSET;
  const tsPotableLabelX            = positions.thermal_store.left + TS_POTABLE_LABEL_X_OFFSET;
  const midFlowX                   = Math.round((pipe.flowRailStartX + pipe.flowRailEndX) / 2);
  const midReturnX                 = Math.round((pipe.heatSourceReturnX + pipe.flowRailEndX) / 2);

  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);
  const storePorts = {
    primaryIn:     offsetPoint(positions.thermal_store.left, positions.thermal_store.top, THERMAL_STORE_SM_PORTS.primaryIn),
    primaryOut:    offsetPoint(positions.thermal_store.left, positions.thermal_store.top, THERMAL_STORE_SM_PORTS.primaryOut),
    potableHotOut: offsetPoint(positions.thermal_store.left, positions.thermal_store.top, THERMAL_STORE_SM_PORTS.potableHotOut),
    potableColdIn: offsetPoint(positions.thermal_store.left, positions.thermal_store.top, THERMAL_STORE_SM_PORTS.potableColdIn),
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
        <line x1={pipe.flowRailStartX} y1={rails.flowY} x2={pumpFlowInX} y2={rails.flowY} stroke={flow} strokeWidth={w} data-testid="thermal-store-primary-pipe" />
        <line x1={pumpFlowOutX} y1={rails.flowY} x2={storeEntryX} y2={rails.flowY} stroke={flow} strokeWidth={w} data-testid="pump-topology-circuit" />
        <line x1={storeEntryX} y1={rails.flowY} x2={storePorts.primaryIn.x} y2={rails.flowY} stroke={flow} strokeWidth={w} data-testid="thermal-store-primary-pipe" />
        <line x1={storePorts.primaryIn.x} y1={rails.flowY} x2={storePorts.primaryIn.x} y2={storePorts.primaryIn.y} stroke={flow} strokeWidth={w} />
        {/* Return path back to boiler (no pump on return). */}
        <line x1={storePorts.primaryOut.x} y1={storePorts.primaryOut.y} x2={storePorts.primaryOut.x} y2={rails.returnY} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={storeEntryX} y1={rails.returnY} x2={pipe.heatSourceReturnX} y2={rails.returnY} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} data-testid="thermal-store-primary-pipe" />
        <line x1={storePorts.primaryOut.x} y1={rails.returnY} x2={storeEntryX} y2={rails.returnY} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} data-testid="thermal-store-primary-pipe" />
        <line x1={pipe.heatSourceReturnX} y1={rails.returnY} x2={pipe.heatSourceReturnX} y2={pipe.heatSourceReturnY} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />

        {/*
          POTABLE water path — cold mains enters coil (bottom-right of store),
          heated by primary water, exits as hot DHW (top-right of store).
          Separate from primary loop — no shared pipe segments.
        */}
        <line x1={storePorts.potableColdIn.x} y1={storePorts.potableColdIn.y} x2={storePorts.potableColdIn.x} y2={potableColdY} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={storePorts.potableColdIn.x} y1={potableColdY} x2={potableStubRightX} y2={potableColdY} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} data-testid="thermal-store-potable-pipe" />
        <line x1={storePorts.potableHotOut.x} y1={storePorts.potableHotOut.y} x2={storePorts.potableHotOut.x} y2={potableHotY} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={storePorts.potableHotOut.x} y1={potableHotY} x2={potableStubRightX} y2={potableHotY} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} data-testid="thermal-store-potable-pipe" />

        {/* pipeTrace directional arrows */}
        {options.pipeTrace && (
          <>
            <MidPipeArrow midX={midFlowX} y={rails.flowY} direction="right" color={flow} />
            <MidPipeArrow midX={midReturnX} y={rails.returnY} direction="left" color={ret} />
          </>
        )}

        {/* Pipe labels */}
        <text {...pipeLabelProps(tsPotableLabelX, potableHotY, 'above', flow)}>Potable hot water out</text>
        <text {...pipeLabelProps(tsPotableLabelX, potableColdY, 'below', ret)}>Potable mains in</text>
        <text {...pipeLabelProps(positions.pump.left, rails.flowY, 'above', flow)}>Primary water loop</text>
        <text {...pipeLabelProps(tsPotableLabelX, potableColdY + PIPE_STROKE_BRANCH, 'below', options.printSafe ? '#000' : '#334155')}>Potable path isolated via internal coil</text>
      </PipeLayer>

      <TopologyNode role="boiler" left={positions.boiler.left} top={positions.boiler.top}><BoilerPrimitive variant="regular" size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="pump" left={positions.pump.left} top={positions.pump.top}><PumpPrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
      <TopologyNode role="thermal_store" left={positions.thermal_store.left} top={positions.thermal_store.top}><ThermalStorePrimitive size="sm" showLabel={options.showLabels} printSafe={options.printSafe} /></TopologyNode>
    </TopologyShell>
  );
}
