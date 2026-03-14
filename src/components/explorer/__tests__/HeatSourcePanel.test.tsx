/**
 * HeatSourcePanel.test.tsx
 *
 * Validates that HeatSourcePanel:
 *   - Renders raw JSON inside a <details> element (collapsed by default)
 *   - Does not expose raw JSON as always-visible text
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HeatSourcePanel from '../HeatSourcePanel';
import { getSystemConfig } from '../systemConfigs';

describe('HeatSourcePanel — boiler panel', () => {
  it('renders raw engine output inside a collapsed <details> element', () => {
    const cfg = getSystemConfig('combi');
    const { container } = render(<HeatSourcePanel systemConfig={cfg} onClose={() => {}} />);

    const details = container.querySelector('details.hs-panel__raw-details');
    expect(details).toBeTruthy();
    // <details> is closed by default (no open attribute)
    expect((details as HTMLDetailsElement).open).toBe(false);
  });

  it('raw JSON summary text is present and acts as a disclosure label', () => {
    const cfg = getSystemConfig('combi');
    render(<HeatSourcePanel systemConfig={cfg} onClose={() => {}} />);

    const summary = screen.getByText(/raw engine output/i);
    expect(summary.tagName.toLowerCase()).toBe('summary');
  });
});

describe('HeatSourcePanel — heat pump panel', () => {
  it('renders COP model inside a collapsed <details> element', () => {
    const cfg = getSystemConfig('ashp');
    const { container } = render(<HeatSourcePanel systemConfig={cfg} onClose={() => {}} />);

    const details = container.querySelector('details.hs-panel__raw-details');
    expect(details).toBeTruthy();
    expect((details as HTMLDetailsElement).open).toBe(false);
  });

  it('COP model summary text is present', () => {
    const cfg = getSystemConfig('ashp');
    render(<HeatSourcePanel systemConfig={cfg} onClose={() => {}} />);

    const summary = screen.getByText(/cop model/i);
    expect(summary.tagName.toLowerCase()).toBe('summary');
  });
});
