import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { renderVisualTopology } from '../topologies';
import { ABVPrimitive, CylinderPrimitive, MixergyCylinderPrimitive, RadiatorPrimitive } from '../../visualPrimitives/primitives';
import { VISUAL_TOPOLOGY_REGISTRY } from '../visualTopologyRegistry';

const DEFAULT_OPTIONS = { showLabels: false, printSafe: false, pipeTrace: false, mobileWidth: false } as const;

describe('physical realism regression guards', () => {
  it('keeps radiator primitive bottom-fed in normal render', () => {
    const { container } = render(<RadiatorPrimitive showLabel={false} />);
    const flow = container.querySelector('[data-testid="radiator-flow-connection"]');
    const ret = container.querySelector('[data-testid="radiator-return-connection"]');

    expect(flow?.getAttribute('data-port-position')).toBe('bottom');
    expect(ret?.getAttribute('data-port-position')).toBe('bottom');
    expect(container.querySelector('[data-port-position="top"]')).toBeNull();
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
    // PumpPrimitive always renders data-testid stubs regardless of topology.
    // This is the base assertion that the primitive is correctly wired.
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
    expect(container.querySelector('[data-testid="mixergy-coil-flow-in-port"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mixergy-coil-flow-out-port"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mixergy-top-coil"]')).toBeTruthy();
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
});
