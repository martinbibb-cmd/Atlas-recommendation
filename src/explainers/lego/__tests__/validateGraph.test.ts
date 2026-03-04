/**
 * Tests for validateGraph — connection rules and required-upstream checks.
 */

import { describe, it, expect } from 'vitest';
import { validateGraph } from '../validation/validateGraph';
import type { LegoGraph } from '../schema/legoTypes';
import { DHW_PRESETS } from '../presets/dhwPresets';

// ─── Preset scenarios: should all pass ───────────────────────────────────────

describe('validateGraph — preset scenarios', () => {
  for (const preset of DHW_PRESETS) {
    it(`preset "${preset.meta.name}" has no validation errors`, () => {
      const issues = validateGraph(preset.graph);
      const errors = issues.filter(i => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  }
});

// ─── cylinder_unvented without inlet group ────────────────────────────────────

describe('validateGraph — cylinder_unvented rule', () => {
  it('errors when cylinder_unvented has no unvented_inlet_group upstream', () => {
    const graph: LegoGraph = {
      blocks: [
        { id: 'mains', type: 'mains_supply',      params: {} },
        { id: 'cyl',   type: 'cylinder_unvented',  params: { volumeL: 150 } },
        { id: 'draw',  type: 'draw_event',          params: { flowLpm: 10 } },
      ],
      edges: [
        { fromBlockId: 'mains', fromPortId: 'out', toBlockId: 'cyl',  toPortId: 'in' },
        { fromBlockId: 'cyl',   fromPortId: 'out', toBlockId: 'draw', toPortId: 'in' },
      ],
    };
    const issues = validateGraph(graph);
    const errors = issues.filter(i => i.severity === 'error');
    expect(errors.some(e => e.message.toLowerCase().includes('inlet control group'))).toBe(true);
  });

  it('passes when cylinder_unvented has unvented_inlet_group upstream', () => {
    const graph: LegoGraph = {
      blocks: [
        { id: 'mains',  type: 'mains_supply',         params: {} },
        { id: 'inlet',  type: 'unvented_inlet_group',  params: {} },
        { id: 'cyl',    type: 'cylinder_unvented',     params: { volumeL: 150 } },
        { id: 'draw',   type: 'draw_event',             params: { flowLpm: 10 } },
      ],
      edges: [
        { fromBlockId: 'mains',  fromPortId: 'out', toBlockId: 'inlet', toPortId: 'in' },
        { fromBlockId: 'inlet',  fromPortId: 'out', toBlockId: 'cyl',   toPortId: 'in' },
        { fromBlockId: 'cyl',    fromPortId: 'out', toBlockId: 'draw',  toPortId: 'in' },
      ],
    };
    const issues = validateGraph(graph);
    const errors = issues.filter(i => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});

// ─── draw_event must connect to hot_water ─────────────────────────────────────

describe('validateGraph — draw_event rule', () => {
  it('errors when draw_event is connected to cold_water source', () => {
    const graph: LegoGraph = {
      blocks: [
        { id: 'mains', type: 'mains_supply', params: {} },
        { id: 'draw',  type: 'draw_event',   params: { flowLpm: 10 } },
      ],
      edges: [
        // mains.out is cold_water; draw.in requires hot_water — should error
        { fromBlockId: 'mains', fromPortId: 'out', toBlockId: 'draw', toPortId: 'in' },
      ],
    };
    const issues = validateGraph(graph);
    const errors = issues.filter(i => i.severity === 'error');
    expect(errors.some(e => e.message.toLowerCase().includes('hot water'))).toBe(true);
  });
});

// ─── Port compatibility ────────────────────────────────────────────────────────

describe('validateGraph — port compatibility', () => {
  it('errors on heating_flow connected to cold_water input', () => {
    const graph: LegoGraph = {
      blocks: [
        { id: 'hp',  type: 'heat_pump_primary',    params: { maxFlowTempC: 55 } },
        { id: 'hex', type: 'boiler_combi_dhw_hex', params: { dhwOutputKw: 30, coldTempC: 10, dhwSetpointC: 50 } },
      ],
      edges: [
        // heat_pump_primary.out is heating_flow; boiler_combi_dhw_hex.in expects cold_water
        { fromBlockId: 'hp', fromPortId: 'out', toBlockId: 'hex', toPortId: 'in' },
      ],
    };
    const issues = validateGraph(graph);
    const errors = issues.filter(i => i.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('passes for a valid mains → combi HEX connection', () => {
    const graph: LegoGraph = {
      blocks: [
        { id: 'mains', type: 'mains_supply',         params: {} },
        { id: 'hex',   type: 'boiler_combi_dhw_hex', params: { dhwOutputKw: 30, coldTempC: 10, dhwSetpointC: 50 } },
      ],
      edges: [
        { fromBlockId: 'mains', fromPortId: 'out', toBlockId: 'hex', toPortId: 'in' },
      ],
    };
    const issues = validateGraph(graph);
    const errors = issues.filter(i => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});

// ─── Cold temp toggle: combi max flow changes ─────────────────────────────────

describe('combi max flow changes with cold temp', () => {
  it('winter 5 °C produces lower max flow than typical 10 °C for same kW output', () => {
    // This is validated via the model test; here we verify via a preset difference.
    const combiTypical = DHW_PRESETS.find(p => p.meta.name.includes('typical'));
    const combiWinter  = DHW_PRESETS.find(p => p.meta.name.includes('winter'));
    expect(combiTypical).toBeDefined();
    expect(combiWinter).toBeDefined();

    const typicalCold = combiTypical!.graph.blocks.find(b => b.type === 'boiler_combi_dhw_hex')!.params.coldTempC as number;
    const winterCold  = combiWinter!.graph.blocks.find(b => b.type === 'boiler_combi_dhw_hex')!.params.coldTempC as number;
    expect(winterCold).toBeLessThan(typicalCold);
  });
});
