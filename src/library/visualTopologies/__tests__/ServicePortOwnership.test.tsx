import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { renderVisualTopology, renderTopologyTemplate } from '../topologies';
import { renderVisualTopology as renderLegacyTopology } from '../topologies/visualTopologies';
import type { VisualTopologyId } from '../visualTopologyRegistry';
import {
  BOILER_COMBI_SM_PORTS,
  BOILER_SYSTEM_SM_PORTS,
  CYLINDER_SM_PORTS,
  MAGNETIC_FILTER_SM_PORTS,
  MIXERGY_SM_PORTS,
  POWERFLUSH_SM_PORTS,
  PUMP_SM_PORTS,
  THERMAL_STORE_SM_PORTS,
  offsetPoint,
  portAttachPoint,
  type PortPoint,
  type PortSide,
} from '../templates/_shared';
import { computeTopologyLayout, getTopologyLayoutDeclaration } from '../layout';

const DEFAULT_OPTIONS = { showLabels: false, printSafe: false, pipeTrace: false, mobileWidth: false } as const;

type OwnershipPoint = {
  componentId: string;
  portId: string;
  raw: PortPoint;
  attached: PortPoint;
};

function normalizePortSide(side?: PortSide): 'top' | 'bottom' | 'left' | 'right' | undefined {
  if (!side) return undefined;
  if (side.startsWith('left')) return 'left';
  if (side.startsWith('right')) return 'right';
  if (side === 'top' || side === 'bottom') return side;
  return undefined;
}

function approxEqual(a: number, b: number, tolerance = 0.2): boolean {
  return Math.abs(a - b) <= tolerance;
}

function hasEndpoint(lines: SVGLineElement[], point: PortPoint): boolean {
  return lines.some((line) => {
    const x1 = Number(line.getAttribute('x1'));
    const y1 = Number(line.getAttribute('y1'));
    const x2 = Number(line.getAttribute('x2'));
    const y2 = Number(line.getAttribute('y2'));
    return (
      (approxEqual(x1, point.x) && approxEqual(y1, point.y)) ||
      (approxEqual(x2, point.x) && approxEqual(y2, point.y))
    );
  });
}

function overlapsConnector(raw: PortPoint, attached: PortPoint): boolean {
  const side = normalizePortSide(raw.side);
  if (!side) return false;
  if (side === 'top') {
    return approxEqual(attached.x, raw.x) && attached.y >= raw.y && attached.y <= raw.y + 4;
  }
  if (side === 'bottom') {
    return approxEqual(attached.x, raw.x) && attached.y <= raw.y && attached.y >= raw.y - 4;
  }
  if (side === 'left') {
    return approxEqual(attached.y, raw.y) && attached.x >= raw.x && attached.x <= raw.x + 4;
  }
  return approxEqual(attached.y, raw.y) && attached.x <= raw.x && attached.x >= raw.x - 4;
}

function getPipeLines(topologyId: VisualTopologyId): SVGLineElement[] {
  const { container } = render(renderVisualTopology(topologyId, DEFAULT_OPTIONS));
  const pipeLayer = container.querySelector('svg[aria-hidden="true"][viewBox="0 0 860 430"]');
  if (!pipeLayer) return [];
  return [...pipeLayer.querySelectorAll('line')];
}

function buildOwnership(topologyId: VisualTopologyId): OwnershipPoint[] {
  const layout = computeTopologyLayout(getTopologyLayoutDeclaration(topologyId));
  const { positions } = layout;

  switch (topologyId) {
    case 'open_vented_vented_cylinder': {
      const boilerFlow = offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryFlow);
      const boilerReturn = offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryReturn);
      const pumpIn = offsetPoint(positions.primary_flow_pump_downstream_vent_feed.left, positions.primary_flow_pump_downstream_vent_feed.top, PUMP_SM_PORTS.flowIn);
      const pumpOut = offsetPoint(positions.primary_flow_pump_downstream_vent_feed.left, positions.primary_flow_pump_downstream_vent_feed.top, PUMP_SM_PORTS.flowOut);
      return [
        { componentId: 'boiler', portId: 'primary_flow', raw: boilerFlow, attached: portAttachPoint(boilerFlow) },
        { componentId: 'boiler', portId: 'primary_return', raw: boilerReturn, attached: portAttachPoint(boilerReturn) },
        { componentId: 'primary_flow_pump_downstream_vent_feed', portId: 'flow_in', raw: pumpIn, attached: portAttachPoint(pumpIn) },
        { componentId: 'primary_flow_pump_downstream_vent_feed', portId: 'flow_out', raw: pumpOut, attached: portAttachPoint(pumpOut) },
      ];
    }
    case 'sealed_unvented_cylinder': {
      const boilerFlow = offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryFlow);
      const boilerReturn = offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryReturn);
      const coilIn = offsetPoint(positions.unvented_cylinder.left, positions.unvented_cylinder.top, CYLINDER_SM_PORTS.coilFlowIn);
      const coilOut = offsetPoint(positions.unvented_cylinder.left, positions.unvented_cylinder.top, CYLINDER_SM_PORTS.coilFlowOut);
      const hotOut = offsetPoint(positions.unvented_cylinder.left, positions.unvented_cylinder.top, CYLINDER_SM_PORTS.hotOut);
      const coldIn = offsetPoint(positions.unvented_cylinder.left, positions.unvented_cylinder.top, CYLINDER_SM_PORTS.coldIn);
      const safety = offsetPoint(positions.unvented_cylinder.left, positions.unvented_cylinder.top, CYLINDER_SM_PORTS.safetyDischarge);
      return [
        { componentId: 'boiler', portId: 'primary_flow', raw: boilerFlow, attached: portAttachPoint(boilerFlow) },
        { componentId: 'boiler', portId: 'primary_return', raw: boilerReturn, attached: portAttachPoint(boilerReturn) },
        { componentId: 'unvented_cylinder', portId: 'coil_flow_in', raw: coilIn, attached: portAttachPoint(coilIn) },
        { componentId: 'unvented_cylinder', portId: 'coil_flow_out', raw: coilOut, attached: portAttachPoint(coilOut) },
        { componentId: 'unvented_cylinder', portId: 'hot_out', raw: hotOut, attached: portAttachPoint(hotOut) },
        { componentId: 'unvented_cylinder', portId: 'cold_in', raw: coldIn, attached: portAttachPoint(coldIn) },
        { componentId: 'unvented_cylinder', portId: 'safety_discharge', raw: safety, attached: portAttachPoint(safety) },
      ];
    }
    case 'combi_direct_hot_water': {
      const flow = offsetPoint(positions.combi_boiler.left, positions.combi_boiler.top, BOILER_COMBI_SM_PORTS.primaryFlow);
      const ret = offsetPoint(positions.combi_boiler.left, positions.combi_boiler.top, BOILER_COMBI_SM_PORTS.primaryReturn);
      const hot = offsetPoint(positions.combi_boiler.left, positions.combi_boiler.top, BOILER_COMBI_SM_PORTS.dhwOut);
      const cold = offsetPoint(positions.combi_boiler.left, positions.combi_boiler.top, BOILER_COMBI_SM_PORTS.coldMainsIn);
      return [
        { componentId: 'combi_boiler', portId: 'primary_flow', raw: flow, attached: portAttachPoint(flow) },
        { componentId: 'combi_boiler', portId: 'primary_return', raw: ret, attached: portAttachPoint(ret) },
        { componentId: 'combi_boiler', portId: 'dhw_out', raw: hot, attached: portAttachPoint(hot) },
        { componentId: 'combi_boiler', portId: 'cold_mains_in', raw: cold, attached: portAttachPoint(cold) },
      ];
    }
    case 'mixergy_stratified_cylinder': {
      const flow = offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryFlow);
      const ret = offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryReturn);
      const mxFlow = offsetPoint(positions.mixergy_cylinder.left, positions.mixergy_cylinder.top, MIXERGY_SM_PORTS.primaryFlowIn);
      const mxRet = offsetPoint(positions.mixergy_cylinder.left, positions.mixergy_cylinder.top, MIXERGY_SM_PORTS.primaryReturnOut);
      const mxHot = offsetPoint(positions.mixergy_cylinder.left, positions.mixergy_cylinder.top, MIXERGY_SM_PORTS.hotDrawOff);
      const mxCold = offsetPoint(positions.mixergy_cylinder.left, positions.mixergy_cylinder.top, MIXERGY_SM_PORTS.coldInlet);
      return [
        { componentId: 'boiler', portId: 'primary_flow', raw: flow, attached: portAttachPoint(flow) },
        { componentId: 'boiler', portId: 'primary_return', raw: ret, attached: portAttachPoint(ret) },
        { componentId: 'mixergy_cylinder', portId: 'primary_flow_in', raw: mxFlow, attached: portAttachPoint(mxFlow) },
        { componentId: 'mixergy_cylinder', portId: 'primary_return_out', raw: mxRet, attached: portAttachPoint(mxRet) },
        { componentId: 'mixergy_cylinder', portId: 'hot_draw_off', raw: mxHot, attached: portAttachPoint(mxHot) },
        { componentId: 'mixergy_cylinder', portId: 'cold_inlet', raw: mxCold, attached: portAttachPoint(mxCold) },
      ];
    }
    case 'thermal_store_layout': {
      const boilerFlow = offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryFlow);
      const boilerReturn = offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryReturn);
      const pumpIn = offsetPoint(positions.pump.left, positions.pump.top, PUMP_SM_PORTS.flowIn);
      const pumpOut = offsetPoint(positions.pump.left, positions.pump.top, PUMP_SM_PORTS.flowOut);
      const primaryIn = offsetPoint(positions.thermal_store.left, positions.thermal_store.top, THERMAL_STORE_SM_PORTS.primaryIn);
      const primaryOut = offsetPoint(positions.thermal_store.left, positions.thermal_store.top, THERMAL_STORE_SM_PORTS.primaryOut);
      const potableHot = offsetPoint(positions.thermal_store.left, positions.thermal_store.top, THERMAL_STORE_SM_PORTS.potableHotOut);
      const potableCold = offsetPoint(positions.thermal_store.left, positions.thermal_store.top, THERMAL_STORE_SM_PORTS.potableColdIn);
      return [
        { componentId: 'boiler', portId: 'primary_flow', raw: boilerFlow, attached: portAttachPoint(boilerFlow) },
        { componentId: 'boiler', portId: 'primary_return', raw: boilerReturn, attached: portAttachPoint(boilerReturn) },
        { componentId: 'pump', portId: 'flow_in', raw: pumpIn, attached: portAttachPoint(pumpIn) },
        { componentId: 'pump', portId: 'flow_out', raw: pumpOut, attached: portAttachPoint(pumpOut) },
        { componentId: 'thermal_store', portId: 'primary_in', raw: primaryIn, attached: portAttachPoint(primaryIn) },
        { componentId: 'thermal_store', portId: 'primary_out', raw: primaryOut, attached: portAttachPoint(primaryOut) },
        { componentId: 'thermal_store', portId: 'potable_hot_out', raw: potableHot, attached: portAttachPoint(potableHot) },
        { componentId: 'thermal_store', portId: 'potable_cold_in', raw: potableCold, attached: portAttachPoint(potableCold) },
      ];
    }
    case 'powerflush_service_layout': {
      const boilerFlow = offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryFlow);
      const boilerReturn = offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryReturn);
      const pfIn = offsetPoint(positions.powerflush_machine.left, positions.powerflush_machine.top, POWERFLUSH_SM_PORTS.systemInlet);
      const pfOut = offsetPoint(positions.powerflush_machine.left, positions.powerflush_machine.top, POWERFLUSH_SM_PORTS.systemOutlet);
      const filterIn = offsetPoint(positions.magnetic_filter_return_before_boiler.left, positions.magnetic_filter_return_before_boiler.top, MAGNETIC_FILTER_SM_PORTS.inlet);
      const filterOut = offsetPoint(positions.magnetic_filter_return_before_boiler.left, positions.magnetic_filter_return_before_boiler.top, MAGNETIC_FILTER_SM_PORTS.outlet);
      return [
        { componentId: 'boiler', portId: 'primary_flow', raw: boilerFlow, attached: portAttachPoint(boilerFlow) },
        { componentId: 'boiler', portId: 'primary_return', raw: boilerReturn, attached: portAttachPoint(boilerReturn) },
        { componentId: 'powerflush_machine', portId: 'system_inlet', raw: pfIn, attached: portAttachPoint(pfIn) },
        { componentId: 'powerflush_machine', portId: 'system_outlet', raw: pfOut, attached: portAttachPoint(pfOut) },
        { componentId: 'magnetic_filter_return_before_boiler', portId: 'inlet', raw: filterIn, attached: portAttachPoint(filterIn) },
        { componentId: 'magnetic_filter_return_before_boiler', portId: 'outlet', raw: filterOut, attached: portAttachPoint(filterOut) },
      ];
    }
    case 'abv_protected_heating_loop': {
      const flow = offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryFlow);
      const ret = offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryReturn);
      return [
        { componentId: 'boiler', portId: 'primary_flow', raw: flow, attached: portAttachPoint(flow) },
        { componentId: 'boiler', portId: 'primary_return', raw: ret, attached: portAttachPoint(ret) },
      ];
    }
    case 'magnetic_filter_on_return': {
      const flow = offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryFlow);
      const ret = offsetPoint(positions.boiler.left, positions.boiler.top, BOILER_SYSTEM_SM_PORTS.primaryReturn);
      const filterIn = offsetPoint(positions.magnetic_filter_return_final_before_boiler.left, positions.magnetic_filter_return_final_before_boiler.top, MAGNETIC_FILTER_SM_PORTS.inlet);
      const filterOut = offsetPoint(positions.magnetic_filter_return_final_before_boiler.left, positions.magnetic_filter_return_final_before_boiler.top, MAGNETIC_FILTER_SM_PORTS.outlet);
      return [
        { componentId: 'boiler', portId: 'primary_flow', raw: flow, attached: portAttachPoint(flow) },
        { componentId: 'boiler', portId: 'primary_return', raw: ret, attached: portAttachPoint(ret) },
        { componentId: 'magnetic_filter_return_final_before_boiler', portId: 'inlet', raw: filterIn, attached: portAttachPoint(filterIn) },
        { componentId: 'magnetic_filter_return_final_before_boiler', portId: 'outlet', raw: filterOut, attached: portAttachPoint(filterOut) },
      ];
    }
    case 'system_pressure_layout':
      return [];
  }
}

describe('render path regression fixture', () => {
  it('active renderVisualTopology output is template-driven (before/after fixture)', () => {
    const id: VisualTopologyId = 'sealed_unvented_cylinder';
    const legacy = render(renderLegacyTopology(id, DEFAULT_OPTIONS)).container.innerHTML;
    const template = render(renderTopologyTemplate(id, DEFAULT_OPTIONS)).container.innerHTML;
    const active = render(renderVisualTopology(id, DEFAULT_OPTIONS)).container.innerHTML;

    expect(legacy).not.toBe(template);
    expect(active).toBe(template);
  });
});

describe('service-port endpoint ownership', () => {
  const topologyIds: VisualTopologyId[] = [
    'open_vented_vented_cylinder',
    'sealed_unvented_cylinder',
    'combi_direct_hot_water',
    'mixergy_stratified_cylinder',
    'thermal_store_layout',
    'powerflush_service_layout',
    'abv_protected_heating_loop',
    'magnetic_filter_on_return',
    'system_pressure_layout',
  ];

  for (const id of topologyIds) {
    it(`${id}: component-facing endpoints land on owned service ports`, () => {
      const ownership = buildOwnership(id);
      const lines = getPipeLines(id);

      if (id === 'system_pressure_layout') {
        expect(lines.length).toBe(0);
        return;
      }

      expect(ownership.length).toBeGreaterThan(0);

      for (const point of ownership) {
        expect(
          hasEndpoint(lines, point.attached),
          `${id}: missing endpoint at ${point.componentId}.${point.portId} (${point.attached.x}, ${point.attached.y})`,
        ).toBe(true);

        expect(
          overlapsConnector(point.raw, point.attached),
          `${id}: ${point.componentId}.${point.portId} does not overlap connector geometry`,
        ).toBe(true);
      }
    });
  }
});
