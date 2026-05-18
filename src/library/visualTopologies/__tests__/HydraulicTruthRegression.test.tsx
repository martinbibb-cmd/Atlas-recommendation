import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { renderVisualTopology } from '../topologies';
import { VISUAL_TOPOLOGY_REGISTRY } from '../visualTopologyRegistry';
import { runHydraulicTopologyQa } from '../../hydraulicTruth';

const DEFAULT_OPTIONS = { showLabels: false, printSafe: false, pipeTrace: false, mobileWidth: false } as const;

describe('hydraulic truth regression checks', () => {
  it('open-vented template keeps close-coupled vent/feed with pump downstream on primary flow', () => {
    const { container } = render(renderVisualTopology('open_vented_vented_cylinder', DEFAULT_OPTIONS));
    const vent = container.querySelector('[data-testid="open-vented-close-coupled-vent"]');
    const feed = container.querySelector('[data-testid="open-vented-close-coupled-feed"]');
    const pump = container.querySelector('[data-topology-component-role="primary_flow_pump_downstream_vent_feed"]');
    const inlinePumpSegment = container.querySelector('[data-testid="pump-topology-circuit"]');
    expect(vent).toBeTruthy();
    expect(feed).toBeTruthy();
    expect(pump).toBeTruthy();
    expect(inlinePumpSegment).toBeTruthy();

    const ventX = Number.parseFloat(vent?.getAttribute('x1') ?? '0');
    const feedX = Number.parseFloat(feed?.getAttribute('x1') ?? '0');
    const pumpLeft = Number.parseFloat((pump as HTMLElement).style.left ?? '0');
    expect(pumpLeft).toBeGreaterThan(Math.max(ventX, feedX));
  });

  it('sealed unvented topology includes a D2 discharge route with continuous fall', () => {
    const { container } = render(renderVisualTopology('sealed_unvented_cylinder', DEFAULT_OPTIONS));
    const d2 = container.querySelector('[data-testid="d2-discharge-pipe"]');
    expect(d2).toBeTruthy();
    const x1 = Number.parseFloat(d2?.getAttribute('x1') ?? '0');
    const y1 = Number.parseFloat(d2?.getAttribute('y1') ?? '0');
    const x2 = Number.parseFloat(d2?.getAttribute('x2') ?? '0');
    const y2 = Number.parseFloat(d2?.getAttribute('y2') ?? '0');
    expect(y2).toBeGreaterThan(y1);
    expect(x2).toBeGreaterThan(x1);
  });

  it('sealed/unvented template keeps expansion vessel on primary return', () => {
    const { container } = render(renderVisualTopology('sealed_unvented_cylinder', DEFAULT_OPTIONS));
    expect(container.querySelector('[data-testid="sealed-unvented-expansion-vessel-return-branch"]')).toBeTruthy();
    const expansion = container.querySelector('[data-topology-component-role="expansion_vessel_on_primary_return"]');
    expect(expansion).toBeTruthy();
  });

  it('ABV stays downstream of pump and upstream of restrictions in ABV-protected layout', () => {
    const { container } = render(renderVisualTopology('abv_protected_heating_loop', DEFAULT_OPTIONS));
    const pump = container.querySelector('[data-topology-component-role="pump"]');
    const abv = container.querySelector('[data-topology-component-role="abv_after_pump_before_restrictions"]');
    const restrictionBoundary = container.querySelector('[data-testid="abv-restriction-boundary"]');
    const abvBridge = container.querySelector('[data-testid="abv-downstream-pump-upstream-restrictions-bridge"]');
    expect(pump).toBeTruthy();
    expect(abv).toBeTruthy();
    expect(restrictionBoundary).toBeTruthy();
    expect(abvBridge).toBeTruthy();

    const pumpLeft = Number.parseFloat((pump as HTMLElement).style.left ?? '0');
    const abvLeft = Number.parseFloat((abv as HTMLElement).style.left ?? '0');
    const boundaryX = Number.parseFloat(restrictionBoundary?.getAttribute('x1') ?? '0');
    expect(abvLeft).toBeGreaterThan(pumpLeft);
    expect(abvLeft).toBeLessThan(boundaryX);
  });

  it('magnetic filter is final on return before boiler entry', () => {
    const { container } = render(renderVisualTopology('magnetic_filter_on_return', DEFAULT_OPTIONS));
    const boiler = container.querySelector('[data-topology-component-role="boiler"]');
    const filter = container.querySelector('[data-topology-component-role="magnetic_filter_return_final_before_boiler"]');
    const returnSegment = container.querySelector('[data-testid="magnetic-filter-final-return-before-boiler"]');
    expect(boiler).toBeTruthy();
    expect(filter).toBeTruthy();
    expect(returnSegment).toBeTruthy();

    const boilerLeft = Number.parseFloat((boiler as HTMLElement).style.left ?? '0');
    const filterLeft = Number.parseFloat((filter as HTMLElement).style.left ?? '0');
    expect(filterLeft).toBeGreaterThan(boilerLeft);
  });

  it('thermal store potable path never mixes with primary store path', () => {
    const { container } = render(renderVisualTopology('thermal_store_layout', DEFAULT_OPTIONS));
    const primarySegments = container.querySelectorAll('[data-testid="thermal-store-primary-pipe"]');
    const potableSegments = container.querySelectorAll('[data-testid="thermal-store-potable-pipe"]');
    expect(primarySegments.length).toBeGreaterThan(0);
    expect(potableSegments.length).toBeGreaterThan(0);
    expect(container.querySelector('[data-testid="thermal-store-primary-pipe"][data-testid="thermal-store-potable-pipe"]')).toBeNull();
  });

  it('filling loop defaults to disconnected/ghosted presentation', () => {
    const { container } = render(renderVisualTopology('sealed_unvented_cylinder', DEFAULT_OPTIONS));
    expect(container.querySelector('[data-testid="filling-loop-ghost-link-left"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="filling-loop-ghost-link-right"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="filling-loop-disconnect-gap"]')).toBeTruthy();
  });

  it('fails visual QA gate when any rendered topology violates hydraulic truth', () => {
    for (const topology of VISUAL_TOPOLOGY_REGISTRY) {
      const rendered = render(renderVisualTopology(topology.id, DEFAULT_OPTIONS));
      expect(rendered.container.firstChild, `${topology.id} should render`).toBeTruthy();
      const hydraulicQa = runHydraulicTopologyQa(topology.id);
      expect(
        hydraulicQa.passed,
        `${topology.id} rendered but violated hydraulicTruth constraints: ${hydraulicQa.issues.map((issue) => issue.message).join('; ')}`,
      ).toBe(true);
    }
  });
});
