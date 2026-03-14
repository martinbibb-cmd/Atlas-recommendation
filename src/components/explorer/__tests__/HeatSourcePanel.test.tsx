/**
 * HeatSourcePanel.test.tsx
 *
 * Validates that HeatSourcePanel:
 *   - Renders raw JSON inside a <details> element (collapsed by default)
 *   - Does not expose raw JSON as always-visible text
 *   - Shows assumed flow temperature explicitly
 *   - Shows active constraint labels
 *   - Explains why a heat pump operates at a non-optimal flow temperature
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HeatSourcePanel from '../HeatSourcePanel';
import { getSystemConfig, deriveAssumptions, deriveConstraintLabels } from '../systemConfigs';

describe('HeatSourcePanel — boiler panel', () => {
  it('renders raw engine output inside a collapsed <details> element', () => {
    const cfg = getSystemConfig('combi');
    const assumptions = deriveAssumptions(cfg);
    const constraintLabels = deriveConstraintLabels(cfg, assumptions);
    const { container } = render(
      <HeatSourcePanel systemConfig={cfg} assumptions={assumptions} constraintLabels={constraintLabels} onClose={() => {}} />,
    );

    const details = container.querySelector('details.hs-panel__raw-details');
    expect(details).toBeTruthy();
    // <details> is closed by default (no open attribute)
    expect((details as HTMLDetailsElement).open).toBe(false);
  });

  it('raw JSON summary text is present and acts as a disclosure label', () => {
    const cfg = getSystemConfig('combi');
    const assumptions = deriveAssumptions(cfg);
    const constraintLabels = deriveConstraintLabels(cfg, assumptions);
    render(
      <HeatSourcePanel systemConfig={cfg} assumptions={assumptions} constraintLabels={constraintLabels} onClose={() => {}} />,
    );

    const summary = screen.getByText(/raw engine output/i);
    expect(summary.tagName.toLowerCase()).toBe('summary');
  });

  it('shows assumed flow temperature chip', () => {
    const cfg = getSystemConfig('combi');
    const assumptions = deriveAssumptions(cfg);
    const constraintLabels = deriveConstraintLabels(cfg, assumptions);
    render(
      <HeatSourcePanel systemConfig={cfg} assumptions={assumptions} constraintLabels={constraintLabels} onClose={() => {}} />,
    );
    // Assumed flow temp chip label must be visible
    expect(screen.getByText('Assumed flow temp')).toBeTruthy();
    // Value should reflect the system design flow temp
    expect(screen.getByText(`${cfg.designFlowTempC}°C`)).toBeTruthy();
  });
});

describe('HeatSourcePanel — heat pump panel', () => {
  it('renders COP model inside a collapsed <details> element', () => {
    const cfg = getSystemConfig('ashp');
    const assumptions = deriveAssumptions(cfg);
    const constraintLabels = deriveConstraintLabels(cfg, assumptions);
    const { container } = render(
      <HeatSourcePanel systemConfig={cfg} assumptions={assumptions} constraintLabels={constraintLabels} onClose={() => {}} />,
    );

    const details = container.querySelector('details.hs-panel__raw-details');
    expect(details).toBeTruthy();
    expect((details as HTMLDetailsElement).open).toBe(false);
  });

  it('COP model summary text is present', () => {
    const cfg = getSystemConfig('ashp');
    const assumptions = deriveAssumptions(cfg);
    const constraintLabels = deriveConstraintLabels(cfg, assumptions);
    render(
      <HeatSourcePanel systemConfig={cfg} assumptions={assumptions} constraintLabels={constraintLabels} onClose={() => {}} />,
    );

    const summary = screen.getByText(/cop model/i);
    expect(summary.tagName.toLowerCase()).toBe('summary');
  });

  it('shows assumed flow temperature chip for heat pump', () => {
    const cfg = getSystemConfig('ashp');
    const assumptions = deriveAssumptions(cfg);
    const constraintLabels = deriveConstraintLabels(cfg, assumptions);
    render(
      <HeatSourcePanel systemConfig={cfg} assumptions={assumptions} constraintLabels={constraintLabels} onClose={() => {}} />,
    );
    expect(screen.getByText('Assumed flow temp')).toBeTruthy();
    expect(screen.getByText(`${assumptions.assumedFlowTempC}°C`)).toBeTruthy();
  });

  it('explains why heat pump operates at 45°C when emitters are oversized', () => {
    const cfg = getSystemConfig('ashp');
    const assumptions = deriveAssumptions(cfg); // 45°C, oversized
    const constraintLabels = deriveConstraintLabels(cfg, assumptions);
    render(
      <HeatSourcePanel systemConfig={cfg} assumptions={assumptions} constraintLabels={constraintLabels} onClose={() => {}} />,
    );
    // The flow-temp-reason tip should be present
    const reasonTip = screen.getByTestId('flow-temp-reason');
    expect(reasonTip).toBeTruthy();
    expect(reasonTip.textContent).toMatch(/45°C/);
  });

  it('shows flow-temperature-limited constraint label when flow temp > 35°C', () => {
    const cfg = getSystemConfig('ashp');
    const assumptions = deriveAssumptions(cfg); // 45°C
    const constraintLabels = deriveConstraintLabels(cfg, assumptions);
    render(
      <HeatSourcePanel systemConfig={cfg} assumptions={assumptions} constraintLabels={constraintLabels} onClose={() => {}} />,
    );
    expect(screen.getAllByText(/flow-temperature-limited/i).length).toBeGreaterThan(0);
  });
});
