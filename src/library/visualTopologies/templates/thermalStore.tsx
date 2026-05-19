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
  BOILER_SYSTEM_SM_PORTS,
  PUMP_SM_PORTS,
  MidPipeArrow,
  PIPE_STROKE_BRANCH,
  PIPE_STROKE_MAIN,
  THERMAL_STORE_SM_PORTS,
  PipeLayer,
  TopologyNode,
  TopologyShell,
  dropOrRiseSegment,
  offsetPoint,
  portAttachPoint,
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
  const POTABLE_HOT_Y_OFFSET       = 14;                        // potable hot y above flow rail
  const POTABLE_COLD_Y_OFFSET      = 50;                        // potable cold y below flow rail
  const POTABLE_STUB_RIGHT_OFFSET  = 246;                       // potable stubs extend this far right of store left
  const TS_POTABLE_LABEL_X_OFFSET  = 98;                        // label x offset from store left
  const potableHotY                = rails.flowY - POTABLE_HOT_Y_OFFSET;
  const potableColdY               = rails.flowY + POTABLE_COLD_Y_OFFSET;
  const potableStubRightX          = positions.thermal_store.left + POTABLE_STUB_RIGHT_OFFSET;
  const tsPotableLabelX            = positions.thermal_store.left + TS_POTABLE_LABEL_X_OFFSET;

  const w = options.pipeTrace ? 5 : PIPE_STROKE_MAIN;
  const flow = pipeStroke(options.printSafe, true);
  const ret = pipeStroke(options.printSafe, false);
  const boilerPorts = {
    primaryReturn: offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryReturn),
    primaryFlow: offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryFlow),
  };
  const pumpPorts = {
    flowIn: offsetPoint(positions.pump.left, positions.pump.top, PUMP_SM_PORTS.flowIn),
    flowOut: offsetPoint(positions.pump.left, positions.pump.top, PUMP_SM_PORTS.flowOut),
  };
  const storePorts = {
    primaryIn:     offsetPoint(positions.thermal_store.left, positions.thermal_store.top, THERMAL_STORE_SM_PORTS.primaryIn),
    primaryOut:    offsetPoint(positions.thermal_store.left, positions.thermal_store.top, THERMAL_STORE_SM_PORTS.primaryOut),
    potableHotOut: offsetPoint(positions.thermal_store.left, positions.thermal_store.top, THERMAL_STORE_SM_PORTS.potableHotOut),
    potableColdIn: offsetPoint(positions.thermal_store.left, positions.thermal_store.top, THERMAL_STORE_SM_PORTS.potableColdIn),
  };
  const boilerFlowAttach = portAttachPoint(boilerPorts.primaryFlow);
  const boilerReturnAttach = portAttachPoint(boilerPorts.primaryReturn);
  const pumpInAttach = portAttachPoint(pumpPorts.flowIn);
  const pumpOutAttach = portAttachPoint(pumpPorts.flowOut);
  const storePrimaryInAttach = portAttachPoint(storePorts.primaryIn);
  const storePrimaryOutAttach = portAttachPoint(storePorts.primaryOut);
  const storePotableColdAttach = portAttachPoint(storePorts.potableColdIn);
  const storePotableHotAttach = portAttachPoint(storePorts.potableHotOut);
  const midFlowX = Math.round((boilerFlowAttach.x + pipe.flowRailEndX) / 2);
  const midReturnX = Math.round((boilerReturnAttach.x + pipe.flowRailEndX) / 2);

  return (
    <TopologyShell options={options}>
      <PipeLayer mobileWidth={options.mobileWidth}>
        {/*
          PRIMARY water loop — system/boiler water stored in vessel body (amber).
          Flow from boiler → store primary-in (left-top of store).
          Return from store primary-out (left-bottom) → pump → boiler.
        */}
        {/* Flow passes through external pump on primary flow (regular boiler layout). */}
        <line x1={boilerFlowAttach.x} y1={rails.flowY} x2={pumpInAttach.x} y2={rails.flowY} stroke={flow} strokeWidth={w} data-testid="thermal-store-primary-pipe" />
        <line x1={pumpOutAttach.x} y1={rails.flowY} x2={storePrimaryInAttach.x} y2={rails.flowY} stroke={flow} strokeWidth={w} data-testid="pump-topology-circuit" />
        <line x1={storePrimaryInAttach.x} y1={rails.flowY} x2={storePrimaryInAttach.x} y2={storePrimaryInAttach.y} stroke={flow} strokeWidth={w} data-testid="thermal-store-primary-pipe" />
        {/* Return path back to boiler (no pump on return). */}
        <line x1={storePrimaryOutAttach.x} y1={storePrimaryOutAttach.y} x2={storePrimaryOutAttach.x} y2={rails.returnY} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={storePrimaryOutAttach.x} y1={rails.returnY} x2={boilerReturnAttach.x} y2={rails.returnY} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} data-testid="thermal-store-primary-pipe" />
        <line x1={boilerReturnAttach.x} y1={rails.returnY} x2={boilerReturnAttach.x} y2={boilerReturnAttach.y} stroke={ret} strokeWidth={w} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={boilerFlowAttach.x} y1={rails.flowY} x2={boilerFlowAttach.x} y2={boilerFlowAttach.y} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        {dropOrRiseSegment(pumpInAttach.x, rails.flowY, pumpInAttach.y).map((seg, i) => (
          <line key={`pump-in-${i}`} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        ))}
        {dropOrRiseSegment(pumpOutAttach.x, rails.flowY, pumpOutAttach.y).map((seg, i) => (
          <line key={`pump-out-${i}`} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        ))}

        {/*
          POTABLE water path — cold mains enters coil (bottom-right of store),
          heated by primary water, exits as hot DHW (top-right of store).
          Separate from primary loop — no shared pipe segments.
        */}
        <line x1={storePotableColdAttach.x} y1={storePotableColdAttach.y} x2={storePotableColdAttach.x} y2={potableColdY} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} />
        <line x1={storePotableColdAttach.x} y1={potableColdY} x2={potableStubRightX} y2={potableColdY} stroke={ret} strokeWidth={PIPE_STROKE_BRANCH} strokeDasharray={pipeDash(options.printSafe, false)} data-testid="thermal-store-potable-pipe" />
        <line x1={storePotableHotAttach.x} y1={storePotableHotAttach.y} x2={storePotableHotAttach.x} y2={potableHotY} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} />
        <line x1={storePotableHotAttach.x} y1={potableHotY} x2={potableStubRightX} y2={potableHotY} stroke={flow} strokeWidth={PIPE_STROKE_BRANCH} data-testid="thermal-store-potable-pipe" />

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
