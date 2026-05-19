import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { renderVisualTopology } from '../topologies';
import {
  ABVPrimitive,
  BoilerPrimitive,
  CylinderPrimitive,
  ExpansionVesselPrimitive,
  FillingLoopPrimitive,
  MagneticFilterPrimitive,
  MixergyCylinderPrimitive,
  PumpPrimitive,
  RadiatorPrimitive,
} from '../../visualPrimitives/primitives';
import { VISUAL_TOPOLOGY_REGISTRY } from '../visualTopologyRegistry';

const DEFAULT_OPTIONS = { showLabels: false, printSafe: false, pipeTrace: false, mobileWidth: false } as const;

describe('physical realism regression guards', () => {
  it('keeps radiator primitive bottom-fed in normal render', () => {
    const { container } = render(<RadiatorPrimitive showLabel={false} />);
    const flow = container.querySelector('[data-testid="radiator-flow-connection"]');
    const ret = container.querySelector('[data-testid="radiator-return-connection"]');

    expect(flow?.getAttribute('data-port-position')).toBe('bottom');
    expect(ret?.getAttribute('data-port-position')).toBe('bottom');
    expect(flow?.getAttribute('data-port-role')).toBe('radiator_trv_flow_in');
    expect(ret?.getAttribute('data-port-role')).toBe('radiator_lockshield_return_out');
    expect(container.querySelector('[data-port-position="top"]')).toBeNull();
    expect(container.querySelector('[data-testid="radiator-panel-body"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="radiator-trv-body"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="radiator-lockshield-body"]')).toBeTruthy();
  });

  it('boiler primitive exposes variant-correct bottom-only service ports and product markers', () => {
    const { container: combi } = render(<BoilerPrimitive variant="combi" showLabel={false} />);
    expect(combi.querySelectorAll('[data-port-position="bottom"]').length).toBe(5);
    expect(combi.querySelector('[data-port-role="boiler_primary_return"]')).toBeTruthy();
    expect(combi.querySelector('[data-port-role="boiler_cold_mains_in"]')).toBeTruthy();
    expect(combi.querySelector('[data-port-role="boiler_gas_supply"]')).toBeTruthy();
    expect(combi.querySelector('[data-port-role="boiler_dhw_out"]')).toBeTruthy();
    expect(combi.querySelector('[data-port-role="boiler_primary_flow"]')).toBeTruthy();
    expect(combi.querySelector('[data-testid="boiler-wall-hung-body"]')).toBeTruthy();
    expect(combi.querySelector('[data-testid="boiler-fascia-panel"]')).toBeTruthy();
    expect(combi.querySelector('[data-port-position="top"], [data-port-position="left"], [data-port-position="right"]')).toBeNull();

    const { container: system } = render(<BoilerPrimitive variant="system" showLabel={false} />);
    expect(system.querySelectorAll('[data-port-position="bottom"]').length).toBe(3);
    expect(system.querySelector('[data-port-role="boiler_primary_return"]')).toBeTruthy();
    expect(system.querySelector('[data-port-role="boiler_gas_supply"]')).toBeTruthy();
    expect(system.querySelector('[data-port-role="boiler_primary_flow"]')).toBeTruthy();
    expect(system.querySelector('[data-port-role="boiler_cold_mains_in"]')).toBeNull();
    expect(system.querySelector('[data-port-role="boiler_dhw_out"]')).toBeNull();
  });

  it('keeps normal topologies free from top-fed radiator cues', () => {
    const { container } = render(
      <>
        {renderVisualTopology('open_vented_vented_cylinder', DEFAULT_OPTIONS)}
        {renderVisualTopology('sealed_unvented_cylinder', DEFAULT_OPTIONS)}
        {renderVisualTopology('abv_protected_heating_loop', DEFAULT_OPTIONS)}
      </>,
    );

    expect(container.querySelectorAll('[data-testid="radiator-flow-connection"][data-port-position="bottom"]').length).toBeGreaterThan(0);
    expect(container.querySelector('[data-port-position="top"]')).toBeNull();
  });

  it('renders ABV with an angled cap/head cue', () => {
    const { container } = render(<ABVPrimitive showLabel={false} />);
    expect(container.querySelector('[data-testid="abv-angled-cap"]')).toBeTruthy();
  });

  it('keeps Mixergy topology semantics separate from thermal store categorisation', () => {
    const mixergy = VISUAL_TOPOLOGY_REGISTRY.find((entry) => entry.id === 'mixergy_stratified_cylinder');
    expect(mixergy?.systemType).toBe('mixergy');
    expect(mixergy?.physicalPurpose.toLowerCase()).not.toContain('thermal store');
  });

  it('keeps thermal store wording explicit about potable/primary separation', () => {
    const thermalStore = VISUAL_TOPOLOGY_REGISTRY.find((entry) => entry.id === 'thermal_store_layout');
    const purpose = thermalStore?.physicalPurpose.toLowerCase() ?? '';
    expect(purpose).toContain('potable');
    expect(purpose).toContain('primary');
    expect(purpose).toContain('separation');
  });

  // ─── Pump inline regression guards ────────────────────────────────────────

  it('pump primitive exposes inlet and outlet pipe markers', () => {
    const primitive = render(<PumpPrimitive showLabel={false} />);
    expect(primitive.container.querySelector('[data-testid="pump-circulator-body"]')).toBeTruthy();
    expect(primitive.container.querySelector('[data-testid="pump-inline-flange-left"]')).toBeTruthy();
    expect(primitive.container.querySelector('[data-testid="pump-inline-flange-right"]')).toBeTruthy();
    expect(primitive.container.querySelector('[data-testid="pump-inlet-pipe"]')?.getAttribute('data-port-role')).toBe('pump_primary_flow_in');
    expect(primitive.container.querySelector('[data-testid="pump-outlet-pipe"]')?.getAttribute('data-port-role')).toBe('pump_primary_flow_out');

    const topologyIds = [
      'open_vented_vented_cylinder',
      'thermal_store_layout',
    ] as const;

    for (const id of topologyIds) {
      const { container } = render(renderVisualTopology(id, DEFAULT_OPTIONS));
      expect(
        container.querySelector('[data-testid="pump-inlet-pipe"]'),
        `${id}: pump inlet pipe marker missing`,
      ).toBeTruthy();
      expect(
        container.querySelector('[data-testid="pump-outlet-pipe"]'),
        `${id}: pump outlet pipe marker missing`,
      ).toBeTruthy();
    }
  });

  it('every pump topology renders a circuit-connection pipe segment (pump is inline)', () => {
    const topologyIds = [
      'open_vented_vented_cylinder',
      'thermal_store_layout',
    ] as const;

    for (const id of topologyIds) {
      const { container } = render(renderVisualTopology(id, DEFAULT_OPTIONS));
      expect(
        container.querySelector('[data-testid="pump-topology-circuit"]'),
        `${id}: pump-topology-circuit segment missing — pump is not visibly inline`,
      ).toBeTruthy();
    }
  });

  // ─── Cylinder stratification guards ───────────────────────────────────────

  it('unvented cylinder primitive has no stratification/thermocline fill zones', () => {
    const { container } = render(<CylinderPrimitive variant="unvented" showLabel={false} />);
    // Stratified zones (hot/cold banding) must not appear for a standard unvented cylinder.
    expect(container.querySelectorAll('[data-testid="cylinder-stratification-zone"]').length).toBe(0);
  });

  it('standard cylinder primitive exposes four physical ports and internal lower coil', () => {
    const { container } = render(<CylinderPrimitive variant="unvented" showLabel={false} />);
    expect(container.querySelector('[data-testid="cylinder-cold-in-port"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="cylinder-hot-out-port"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="cylinder-coil-flow-in-port"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="cylinder-coil-flow-out-port"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="cylinder-internal-coil"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="cylinder-vertical-body"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="cylinder-domed-top"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="cylinder-hot-out-port"]')?.getAttribute('data-port-position')).toBe('top');
    expect(container.querySelector('[data-testid="cylinder-cold-in-port"]')?.getAttribute('data-port-position')).toBe('bottom');
    expect(container.querySelector('[data-testid="cylinder-coil-flow-in-port"]')?.getAttribute('data-port-role')).toBe('cylinder_coil_flow_in');
    expect(container.querySelector('[data-testid="cylinder-coil-flow-out-port"]')?.getAttribute('data-port-role')).toBe('cylinder_coil_flow_out');
  });

  it('sealed unvented cylinder topology contains no stratification zone elements', () => {
    const { container } = render(
      renderVisualTopology('sealed_unvented_cylinder', DEFAULT_OPTIONS),
    );
    expect(container.querySelectorAll('[data-testid="cylinder-stratification-zone"]').length).toBe(0);
  });

  it('Mixergy primitive renders stratification and thermocline markers', () => {
    const { container } = render(<MixergyCylinderPrimitive stateOfChargePct={70} showLabel={false} />);
    expect(container.querySelector('[data-testid="mixergy-thermocline"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mixergy-stratification-hot-zone"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mixergy-stratification-cold-zone"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mixergy-smart-body"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mixergy-top-heating-cue"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mixergy-bottom-diffuser"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mixergy-hot-draw-off"]')?.getAttribute('data-port-position')).toBe('top');
    expect(container.querySelector('[data-testid="mixergy-cold-entry"]')?.getAttribute('data-port-position')).toBe('bottom');
  });

  it('Mixergy topology renders stratification elements', () => {
    const { container } = render(
      renderVisualTopology('mixergy_stratified_cylinder', DEFAULT_OPTIONS),
    );
    expect(container.querySelector('[data-testid="mixergy-thermocline"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mixergy-stratification-hot-zone"]')).toBeTruthy();
  });

  // ─── Thermal store potable/primary separation guards ─────────────────────

  it('thermal store topology renders both primary and potable pipe markers', () => {
    const { container } = render(
      renderVisualTopology('thermal_store_layout', DEFAULT_OPTIONS),
    );
    expect(
      container.querySelector('[data-testid="thermal-store-primary-pipe"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="thermal-store-potable-pipe"]'),
    ).toBeTruthy();
  });

  it('thermal store primitive has separate primary-in, primary-out, potable-hot-out, potable-cold-in stubs', () => {
    // Verifies the four-port model on the primitive itself.
    const { container } = render(
      renderVisualTopology('thermal_store_layout', DEFAULT_OPTIONS),
    );
    expect(container.querySelector('[data-testid="thermal-store-primary-in"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="thermal-store-primary-out"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="thermal-store-potable-hot-out"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="thermal-store-potable-cold-in"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="thermal-store-coil"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="thermal-store-plate-hex"]')).toBeTruthy();
  });

  it('thermal store topology does not contain Mixergy-specific markers', () => {
    const { container } = render(
      renderVisualTopology('thermal_store_layout', DEFAULT_OPTIONS),
    );
    // Thermal store must not reuse Mixergy stratification identifiers.
    expect(container.querySelector('[data-testid="mixergy-thermocline"]')).toBeNull();
    expect(container.querySelector('[data-testid="mixergy-stratification-hot-zone"]')).toBeNull();
    expect(container.querySelector('[data-testid="mixergy-stratification-cold-zone"]')).toBeNull();
    expect(container.querySelector('[data-testid="mixergy-hot-draw-off"]')).toBeNull();
    expect(container.querySelector('[data-testid="mixergy-cold-entry"]')).toBeNull();
  });

  it('magnetic filter primitive reads as a vertical service body on return with isolation valves', () => {
    const { container } = render(<MagneticFilterPrimitive showLabel={false} />);
    expect(container.querySelector('[data-testid="magnetic-filter-service-body"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="magnetic-filter-isolation-valve-left"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="magnetic-filter-isolation-valve-right"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="magnetic-filter-return-in-port"]')?.getAttribute('data-port-role')).toBe('magnetic_filter_return_in');
    expect(container.querySelector('[data-testid="magnetic-filter-return-out-port"]')?.getAttribute('data-port-role')).toBe('magnetic_filter_return_out');
  });

  it('filling loop primitive shows braided disconnected hose with two isolation valves', () => {
    const { container } = render(<FillingLoopPrimitive showLabel={false} />);
    expect(container.querySelector('[data-testid="filling-loop-braided-hose"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="filling-loop-isolation-valve-left"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="filling-loop-isolation-valve-right"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="filling-loop-disconnect-gap"]')).toBeTruthy();
  });

  it('ABV and expansion vessel primitives expose product-shape markers', () => {
    const abv = render(<ABVPrimitive showLabel={false} />);
    expect(abv.container.querySelector('[data-testid="abv-brass-body"]')).toBeTruthy();
    expect(abv.container.querySelector('[data-testid="abv-angled-cap"]')).toBeTruthy();

    const vessel = render(<ExpansionVesselPrimitive showLabel={false} />);
    expect(vessel.container.querySelector('[data-testid="expansion-vessel-shell"]')).toBeTruthy();
    expect(vessel.container.querySelector('[data-testid="expansion-vessel-diaphragm"]')).toBeTruthy();
    expect(vessel.container.querySelector('[data-testid="expansion-vessel-bracket"]')).toBeTruthy();
  });
});
