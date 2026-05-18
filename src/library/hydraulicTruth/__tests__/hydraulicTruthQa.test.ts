import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CANONICAL_HYDRAULIC_TEMPLATES } from '../templates';
import { HYDRAULIC_CONSTRAINTS } from '../constraints';
import { assessTopologyHydraulicTruth } from '../qa';
import { TOPOLOGY_HYDRAULIC_PROFILES } from '../topologyProfiles';
import { renderVisualTopology } from '../../visualTopologies/topologies';

const DEFAULT_OPTIONS = { showLabels: false, printSafe: false, pipeTrace: false, mobileWidth: false } as const;

describe('hydraulic truth canonical templates', () => {
  it('defines all required canonical system templates', () => {
    expect(CANONICAL_HYDRAULIC_TEMPLATES.map((entry) => entry.id)).toEqual([
      'open_vented',
      'sealed_unvented',
      'combi',
      'mixergy',
      'thermal_store',
      'abv_protected_loop',
      'magnetic_filter_protection',
      'powerflush_setup',
    ]);
  });
});

describe('hydraulic truth machine-readable constraints', () => {
  it('includes research regression constraints', () => {
    const ids = new Set(HYDRAULIC_CONSTRAINTS.map((entry) => entry.id));
    expect(ids.has('vented:no-top-fed-radiators')).toBe(true);
    expect(ids.has('unvented:no-sharp-thermocline')).toBe(true);
    expect(ids.has('thermal-store:must-separate-potable-primary')).toBe(true);
    expect(ids.has('unvented:g3-d2-continuous-fall')).toBe(true);
    expect(ids.has('abv:not-downstream-restrictions')).toBe(true);
    expect(ids.has('magfilter:return-before-boiler')).toBe(true);
    expect(ids.has('filling-loop:disconnected-default')).toBe(true);
  });
});

describe('hydraulic truth topology QA', () => {
  it('enforces no top-fed radiator cues in standard layouts', () => {
    const { container } = render(
      <>
        {renderVisualTopology('open_vented_vented_cylinder', DEFAULT_OPTIONS)}
        {renderVisualTopology('sealed_unvented_cylinder', DEFAULT_OPTIONS)}
        {renderVisualTopology('abv_protected_heating_loop', DEFAULT_OPTIONS)}
      </>,
    );
    expect(container.querySelector('[data-port-position="top"]')).toBeNull();
  });

  it('keeps unvented topology and profile free from sharp thermocline', () => {
    const result = assessTopologyHydraulicTruth('sealed_unvented_cylinder');
    expect(TOPOLOGY_HYDRAULIC_PROFILES.sealed_unvented_cylinder.signals.showsSharpThermocline).toBe(false);
    expect(result.issues.some((issue) => issue.constraintId === 'unvented:no-sharp-thermocline')).toBe(false);
  });

  it('keeps thermal store profile on strict potable/primary separation', () => {
    const result = assessTopologyHydraulicTruth('thermal_store_layout');
    expect(TOPOLOGY_HYDRAULIC_PROFILES.thermal_store_layout.signals.potablePrimarySeparated).toBe(true);
    expect(result.issues.some((issue) => issue.constraintId === 'thermal-store:must-separate-potable-primary')).toBe(false);
  });

  it('keeps ABV profile upstream of restrictions and after pump', () => {
    const result = assessTopologyHydraulicTruth('abv_protected_heating_loop');
    expect(TOPOLOGY_HYDRAULIC_PROFILES.abv_protected_heating_loop.signals.abvAfterPumpBeforeRestrictions).toBe(true);
    expect(TOPOLOGY_HYDRAULIC_PROFILES.abv_protected_heating_loop.signals.abvDownstreamOfZoneValve).toBe(false);
    expect(result.issues.some((issue) => issue.constraintId === 'abv:placement')).toBe(false);
    expect(result.issues.some((issue) => issue.constraintId === 'abv:not-downstream-restrictions')).toBe(false);
  });

  it('keeps magnetic filter profile on return before boiler', () => {
    const result = assessTopologyHydraulicTruth('magnetic_filter_on_return');
    expect(TOPOLOGY_HYDRAULIC_PROFILES.magnetic_filter_on_return.signals.magneticFilterOnReturnBeforeBoiler).toBe(true);
    expect(result.issues.some((issue) => issue.constraintId === 'magfilter:return-before-boiler')).toBe(false);
  });

  it('keeps filling loop default state disconnected in sealed profile', () => {
    const result = assessTopologyHydraulicTruth('sealed_unvented_cylinder');
    expect(TOPOLOGY_HYDRAULIC_PROFILES.sealed_unvented_cylinder.signals.fillingLoopDisconnectedByDefault).toBe(true);
    expect(result.issues.some((issue) => issue.constraintId === 'filling-loop:disconnected-default')).toBe(false);
  });
});
