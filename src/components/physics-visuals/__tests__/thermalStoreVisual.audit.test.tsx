/**
 * thermalStoreVisual.audit.test.tsx
 *
 * Audit checks for the ThermalStoreVisual component and its page-type guards:
 *
 *   1. Renders with .tsv block class — NOT .ccv (it is not a cylinder visual)
 *   2. Renders "Thermal store" as the vessel label — never "cylinder"
 *   3. Renders the heat exchanger coil element (.tsv__coil)
 *   4. Renders "Heat exchanger" label inside the vessel
 *   5. Renders "via heat exchanger" note on tap output — DHW is produced, not stored
 *   6. aria-label mentions heat exchanger and primary temperature
 *   7. Drawback note is hidden in preview mode, visible in inline/focus
 *   8. isVisualValid throws when thermal_store is used on a shortlist page
 *   9. isVisualValid does not throw for thermal_store on current_system page
 *  10. resolveShortlistVisualId returns null for thermal_store (never a recommended option)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ThermalStoreVisual from '../visuals/ThermalStoreVisual';
import { isVisualValid, resolveShortlistVisualId } from '../../presentation/presentationVisualMapping';

// ─── Visual semantics — no cylinder language ──────────────────────────────────

describe('ThermalStoreVisual — visual semantics audit', () => {
  it('renders with the .tsv block class (not .ccv — it is not a cylinder visual)', () => {
    const { container } = render(<ThermalStoreVisual />);
    expect(container.querySelector('.tsv')).not.toBeNull();
    expect(container.querySelector('.ccv')).toBeNull();
  });

  it('renders "Thermal store" as the vessel label — never "cylinder"', () => {
    render(<ThermalStoreVisual />);
    expect(screen.getByText('Thermal store')).toBeTruthy();
  });

  it('renders the heat exchanger coil element (.tsv__coil)', () => {
    const { container } = render(<ThermalStoreVisual />);
    expect(container.querySelector('.tsv__coil')).not.toBeNull();
  });

  it('renders "Heat exchanger" label inside the vessel', () => {
    render(<ThermalStoreVisual />);
    expect(screen.getByText('Heat exchanger')).toBeTruthy();
  });

  it('renders "via heat exchanger" note on the tap output — DHW is produced via exchange, not stored directly', () => {
    render(<ThermalStoreVisual />);
    expect(screen.getByText('via heat exchanger')).toBeTruthy();
  });

  it('aria-label mentions heat exchanger and primary temperature', () => {
    const { container } = render(<ThermalStoreVisual />);
    const ariaLabel =
      container.querySelector('[role="img"]')?.getAttribute('aria-label') ?? '';
    expect(ariaLabel).toMatch(/heat exchanger/i);
    expect(ariaLabel).toMatch(/primary/i);
  });

  it('vessel label is "Thermal store" — confirming the store label never conflates with cylinder', () => {
    const { container } = render(<ThermalStoreVisual />);
    const storeLabel = container.querySelector('.tsv__store-label');
    expect(storeLabel?.textContent).toBe('Thermal store');
  });
});

// ─── Drawback note display-mode gating ───────────────────────────────────────

describe('ThermalStoreVisual — drawback note in non-preview modes', () => {
  it('does not render the drawback note in preview mode', () => {
    render(<ThermalStoreVisual displayMode="preview" />);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('renders the drawback note in inline mode', () => {
    render(<ThermalStoreVisual displayMode="inline" />);
    expect(screen.getByRole('note')).toBeTruthy();
  });

  it('renders the drawback note in focus mode', () => {
    render(<ThermalStoreVisual displayMode="focus" />);
    expect(screen.getByRole('note')).toBeTruthy();
  });
});

// ─── flowTempBand variants ────────────────────────────────────────────────────

describe('ThermalStoreVisual — flowTempBand variants', () => {
  it('defaults to high flow-temp band (75–85 °C primary)', () => {
    const { container } = render(<ThermalStoreVisual />);
    expect(container.querySelector('.tsv--flow-high')).not.toBeNull();
  });

  it('renders very_high band when requested (80–85 °C primary)', () => {
    const { container } = render(<ThermalStoreVisual flowTempBand="very_high" />);
    expect(container.querySelector('.tsv--flow-very_high')).not.toBeNull();
  });

  it('high band shows 75–85 °C primary label', () => {
    render(<ThermalStoreVisual flowTempBand="high" />);
    expect(screen.getByText('75–85 °C primary')).toBeTruthy();
  });

  it('very_high band shows 80–85 °C primary label', () => {
    render(<ThermalStoreVisual flowTempBand="very_high" />);
    expect(screen.getByText('80–85 °C primary')).toBeTruthy();
  });
});

// ─── Page-type guards ─────────────────────────────────────────────────────────

describe('ThermalStoreVisual — page-type guards (isVisualValid)', () => {
  it('isVisualValid throws when thermal_store is used on a shortlist page', () => {
    expect(() => isVisualValid('thermal_store', { pageType: 'shortlist' })).toThrow(
      "'thermal_store' visual is not permitted on shortlist pages",
    );
  });

  it('isVisualValid does not throw for thermal_store on current_system page', () => {
    expect(() =>
      isVisualValid('thermal_store', { pageType: 'current_system' }),
    ).not.toThrow();
  });

  it('isVisualValid does not throw for thermal_store with no page type', () => {
    expect(() => isVisualValid('thermal_store', {})).not.toThrow();
  });
});

// ─── Shortlist visual selection — thermal_store excluded ─────────────────────

describe('ThermalStoreVisual — excluded from shortlist visual selection', () => {
  it('resolveShortlistVisualId returns null for thermal_store (solar=high path)', () => {
    expect(resolveShortlistVisualId('high', 0, 'thermal_store')).toBeNull();
  });

  it('resolveShortlistVisualId returns null for thermal_store (storageBenefit=high path)', () => {
    expect(resolveShortlistVisualId('low', 0, 'thermal_store', 'high')).toBeNull();
    expect(resolveShortlistVisualId('none', 1, 'thermal_store', 'high')).toBeNull();
  });

  it('resolveShortlistVisualId returns null even when outlets < 2 and thermal_store is the type', () => {
    expect(resolveShortlistVisualId('none', 0, 'thermal_store')).toBeNull();
  });
});
