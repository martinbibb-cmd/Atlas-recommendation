import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { renderVisualTopology } from '../topologies';
import { ABVPrimitive, RadiatorPrimitive } from '../../visualPrimitives/primitives';
import { VISUAL_TOPOLOGY_REGISTRY } from '../visualTopologyRegistry';

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
        {renderVisualTopology('open_vented_vented_cylinder', { showLabels: false, printSafe: false, pipeTrace: false, mobileWidth: false })}
        {renderVisualTopology('sealed_unvented_cylinder', { showLabels: false, printSafe: false, pipeTrace: false, mobileWidth: false })}
        {renderVisualTopology('abv_protected_heating_loop', { showLabels: false, printSafe: false, pipeTrace: false, mobileWidth: false })}
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
});
