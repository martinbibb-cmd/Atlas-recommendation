/**
 * SelectedFamilyDashboard.test.tsx — PR10: Family binding, visibility, and fit map tests.
 *
 * Test categories:
 *
 *   1. Binding — selecting a family renders data from that family's runner only.
 *      a. combi → combi runner outputs used; no stored/HP data leaked.
 *      b. stored_water → stored runner outputs; no combi data leaked.
 *      c. heat_pump → HP runner outputs; no gas/combi assumptions.
 *
 *   2. Visibility — family-specific panels appear/disappear correctly.
 *      a. combi → purge/ignition sections visible; recharge hidden.
 *      b. stored_water → recharge section visible; purge/ignition hidden.
 *      c. heat_pump → recharge section visible (HP cylinder); purge hidden.
 *      d. open_vented → recharge section visible; purge hidden.
 *
 *   3. Fit map — axis scores and evidence displayed correctly.
 *      a. heating axis score shown.
 *      b. DHW axis score shown.
 *      c. evidence items correspond to limiter ledger IDs.
 *      d. contour shape labels rendered.
 *
 *   4. Layout sanity — no empty major panels; all required data present.
 *      a. summary strip rendered with scores and badges.
 *      b. tabs rendered (Heating, Hot Water, Efficiency, Constraints).
 *      c. detail sections rendered (fit map, events).
 *
 *   5. No cross-family leakage — combi view never shows stored-only elements.
 *      a. combi view has no recharge section.
 *      b. stored/HP view has no purge/ignition section.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SelectedFamilyDashboard from '../SelectedFamilyDashboard';
import { deriveSelectedFamilyDataForTest } from './testHelpers';
import type { SelectedFamilyData, SelectableFamily } from '../useSelectedFamilyData';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function renderDashboard(
  family: SelectableFamily = 'combi',
  onSelectFamily: (f: SelectableFamily) => void = () => {},
): SelectedFamilyData {
  const data = deriveSelectedFamilyDataForTest(family);
  render(
    <SelectedFamilyDashboard
      data={data}
      onSelectFamily={onSelectFamily}
    />,
  );
  return data;
}

// ─── 1. Binding ───────────────────────────────────────────────────────────────

describe('SelectedFamilyDashboard — binding', () => {
  it('combi: data-selected-family attribute reflects combi', () => {
    renderDashboard('combi');
    const dashboard = document.querySelector('[data-testid="selected-family-dashboard"]');
    expect(dashboard?.getAttribute('data-selected-family')).toBe('combi');
  });

  it('stored_water: data-selected-family attribute reflects stored_water', () => {
    renderDashboard('stored_water');
    const dashboard = document.querySelector('[data-testid="selected-family-dashboard"]');
    expect(dashboard?.getAttribute('data-selected-family')).toBe('stored_water');
  });

  it('heat_pump: data-selected-family attribute reflects heat_pump', () => {
    renderDashboard('heat_pump');
    const dashboard = document.querySelector('[data-testid="selected-family-dashboard"]');
    expect(dashboard?.getAttribute('data-selected-family')).toBe('heat_pump');
  });

  it('combi: active family pill is combi', () => {
    renderDashboard('combi');
    const pill = document.querySelector('[data-testid="family-pill-combi"]');
    expect(pill?.classList.contains('selected-family-dashboard__family-pill--active')).toBe(true);
  });

  it('stored_water: active family pill is stored_water', () => {
    renderDashboard('stored_water');
    const pill = document.querySelector('[data-testid="family-pill-stored_water"]');
    expect(pill?.classList.contains('selected-family-dashboard__family-pill--active')).toBe(true);
  });

  it('heat_pump: active family pill is heat_pump', () => {
    renderDashboard('heat_pump');
    const pill = document.querySelector('[data-testid="family-pill-heat_pump"]');
    expect(pill?.classList.contains('selected-family-dashboard__family-pill--active')).toBe(true);
  });

  it('calls onSelectFamily when a different family pill is clicked', () => {
    const calls: SelectableFamily[] = [];
    renderDashboard('combi', (f) => calls.push(f));
    fireEvent.click(document.querySelector('[data-testid="family-pill-stored_water"]')!);
    expect(calls).toEqual(['stored_water']);
  });
});

// ─── 2. Visibility ────────────────────────────────────────────────────────────

describe('SelectedFamilyDashboard — visibility: combi', () => {
  it('combi: Hot Water tab shows purge/ignition section', () => {
    renderDashboard('combi');
    // Navigate to Hot Water tab
    fireEvent.click(screen.getByTestId('tab-hot_water'));
    expect(document.querySelector('[data-testid="combi-purge-ignition-section"]')).not.toBeNull();
  });

  it('combi: Hot Water tab does NOT show recharge section', () => {
    renderDashboard('combi');
    fireEvent.click(screen.getByTestId('tab-hot_water'));
    expect(document.querySelector('[data-testid="stored-recharge-section"]')).toBeNull();
  });

  it('combi: Heating tab shows heating stability score', () => {
    renderDashboard('combi');
    // Heating tab is active by default
    expect(document.querySelector('[data-testid="heating-stability-score"]')).not.toBeNull();
  });
});

describe('SelectedFamilyDashboard — visibility: stored_water', () => {
  it('stored_water: Hot Water tab shows recharge section', () => {
    renderDashboard('stored_water');
    fireEvent.click(screen.getByTestId('tab-hot_water'));
    expect(document.querySelector('[data-testid="stored-recharge-section"]')).not.toBeNull();
  });

  it('stored_water: Hot Water tab does NOT show purge/ignition section', () => {
    renderDashboard('stored_water');
    fireEvent.click(screen.getByTestId('tab-hot_water'));
    expect(document.querySelector('[data-testid="combi-purge-ignition-section"]')).toBeNull();
  });
});

describe('SelectedFamilyDashboard — visibility: heat_pump', () => {
  it('heat_pump: Hot Water tab shows recharge section (HP cylinder recovery)', () => {
    renderDashboard('heat_pump');
    fireEvent.click(screen.getByTestId('tab-hot_water'));
    expect(document.querySelector('[data-testid="stored-recharge-section"]')).not.toBeNull();
  });

  it('heat_pump: Hot Water tab does NOT show purge/ignition section', () => {
    renderDashboard('heat_pump');
    fireEvent.click(screen.getByTestId('tab-hot_water'));
    expect(document.querySelector('[data-testid="combi-purge-ignition-section"]')).toBeNull();
  });
});

describe('SelectedFamilyDashboard — visibility: open_vented', () => {
  it('open_vented: Hot Water tab shows recharge section', () => {
    renderDashboard('open_vented');
    fireEvent.click(screen.getByTestId('tab-hot_water'));
    expect(document.querySelector('[data-testid="stored-recharge-section"]')).not.toBeNull();
  });

  it('open_vented: Hot Water tab does NOT show purge/ignition section', () => {
    renderDashboard('open_vented');
    fireEvent.click(screen.getByTestId('tab-hot_water'));
    expect(document.querySelector('[data-testid="combi-purge-ignition-section"]')).toBeNull();
  });
});

// ─── 3. Fit map ───────────────────────────────────────────────────────────────

describe('SelectedFamilyDashboard — fit map', () => {
  it('displays heating axis score in summary strip', () => {
    const data = renderDashboard('combi');
    const badge = document.querySelector('[data-testid="heating-score-badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain(String(data.fitMap.heatingAxis.score));
  });

  it('displays DHW axis score in summary strip', () => {
    const data = renderDashboard('combi');
    const badge = document.querySelector('[data-testid="dhw-score-badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain(String(data.fitMap.dhwAxis.score));
  });

  it('axis scores are in [0, 100]', () => {
    for (const family of ['combi', 'stored_water', 'heat_pump', 'open_vented'] as SelectableFamily[]) {
      const data = deriveSelectedFamilyDataForTest(family);
      expect(data.fitMap.heatingAxis.score).toBeGreaterThanOrEqual(0);
      expect(data.fitMap.heatingAxis.score).toBeLessThanOrEqual(100);
      expect(data.fitMap.dhwAxis.score).toBeGreaterThanOrEqual(0);
      expect(data.fitMap.dhwAxis.score).toBeLessThanOrEqual(100);
    }
  });

  it('fit map toggle expands the fit map detail section', () => {
    renderDashboard('combi');
    expect(document.querySelector('[data-testid="fit-map-detail"]')).toBeNull();
    fireEvent.click(screen.getByTestId('fit-map-toggle'));
    expect(document.querySelector('[data-testid="fit-map-detail"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="fit-map-axis-display"]')).not.toBeNull();
  });

  it('evidence items in the fit map reference IDs from the limiter ledger', () => {
    const data = deriveSelectedFamilyDataForTest('combi');
    const ledgerIds = new Set(data.limiterLedger.entries.map((e) => e.id));
    for (const evidence of data.fitMap.evidence) {
      if (evidence.sourceType === 'limiter') {
        expect(ledgerIds.has(evidence.id)).toBe(true);
      }
    }
  });

  it('combi: no stored-only evidence appears in the fit map', () => {
    const data = deriveSelectedFamilyDataForTest('combi');
    const STORE_ONLY_IDS = new Set([
      'stored_volume_shortfall', 'reduced_dhw_service', 'hp_reheat_latency',
      'open_vented_head_limit', 'space_for_cylinder_unavailable',
    ]);
    for (const evidence of data.fitMap.evidence) {
      expect(STORE_ONLY_IDS.has(evidence.id)).toBe(false);
    }
  });

  it('stored_water: no combi-only evidence appears in the fit map', () => {
    const data = deriveSelectedFamilyDataForTest('stored_water');
    const COMBI_ONLY_IDS = new Set(['combi_service_switching']);
    for (const evidence of data.fitMap.evidence) {
      expect(COMBI_ONLY_IDS.has(evidence.id)).toBe(false);
    }
  });
});

// ─── 4. Layout sanity ─────────────────────────────────────────────────────────

describe('SelectedFamilyDashboard — layout sanity', () => {
  it('summary strip is always rendered', () => {
    renderDashboard('combi');
    expect(document.querySelector('[data-testid="summary-strip"]')).not.toBeNull();
  });

  it('key scores are always present in the summary strip', () => {
    renderDashboard('combi');
    expect(document.querySelector('[data-testid="key-scores"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="heating-score-badge"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="dhw-score-badge"]')).not.toBeNull();
  });

  it('quick badges are always present', () => {
    renderDashboard('combi');
    expect(document.querySelector('[data-testid="quick-badges"]')).not.toBeNull();
  });

  it('all four tabs are rendered', () => {
    renderDashboard('combi');
    expect(screen.getByTestId('tab-heating')).toBeTruthy();
    expect(screen.getByTestId('tab-hot_water')).toBeTruthy();
    expect(screen.getByTestId('tab-efficiency')).toBeTruthy();
    expect(screen.getByTestId('tab-constraints')).toBeTruthy();
  });

  it('active tab panel is rendered', () => {
    renderDashboard('combi');
    expect(document.querySelector('[data-testid="active-tab-panel"]')).not.toBeNull();
  });

  it('detail sections are rendered', () => {
    renderDashboard('combi');
    expect(document.querySelector('[data-testid="detail-sections"]')).not.toBeNull();
    expect(screen.getByTestId('fit-map-toggle')).toBeTruthy();
    expect(screen.getByTestId('events-toggle')).toBeTruthy();
  });

  it('constraints tab shows the limiter ledger panel', () => {
    renderDashboard('combi');
    fireEvent.click(screen.getByTestId('tab-constraints'));
    expect(document.querySelector('[data-testid="limiter-ledger-panel"]')).not.toBeNull();
  });

  it('main view section is rendered', () => {
    renderDashboard('combi');
    expect(document.querySelector('[data-testid="main-view"]')).not.toBeNull();
  });
});

// ─── 5. No cross-family leakage ───────────────────────────────────────────────

describe('SelectedFamilyDashboard — no cross-family leakage', () => {
  it('combi view never shows stored-recharge section', () => {
    renderDashboard('combi');
    // Check all tabs
    for (const tabId of ['heating', 'hot_water', 'efficiency', 'constraints']) {
      fireEvent.click(screen.getByTestId(`tab-${tabId}`));
      expect(document.querySelector('[data-testid="stored-recharge-section"]')).toBeNull();
    }
  });

  it('stored_water view never shows combi-purge-ignition section', () => {
    renderDashboard('stored_water');
    for (const tabId of ['heating', 'hot_water', 'efficiency', 'constraints']) {
      fireEvent.click(screen.getByTestId(`tab-${tabId}`));
      expect(document.querySelector('[data-testid="combi-purge-ignition-section"]')).toBeNull();
    }
  });

  it('heat_pump view never shows combi-purge-ignition section', () => {
    renderDashboard('heat_pump');
    for (const tabId of ['heating', 'hot_water', 'efficiency', 'constraints']) {
      fireEvent.click(screen.getByTestId(`tab-${tabId}`));
      expect(document.querySelector('[data-testid="combi-purge-ignition-section"]')).toBeNull();
    }
  });

  it('combi event counters show heating interruptions and purge cycles; not recharge', () => {
    renderDashboard('combi');
    // Expand events
    fireEvent.click(screen.getByTestId('events-toggle'));
    expect(document.querySelector('[data-testid="counter-heating-interruptions"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="counter-purge-cycles"]')).not.toBeNull();
    // Recharge counter must not appear for combi
    expect(document.querySelector('[data-testid="counter-recharge-cycles"]')).toBeNull();
  });

  it('stored_water event counters show recharge cycles; not heating interruptions or purge', () => {
    renderDashboard('stored_water');
    fireEvent.click(screen.getByTestId('events-toggle'));
    expect(document.querySelector('[data-testid="counter-recharge-cycles"]')).not.toBeNull();
    // Combi-only counters must not appear for stored
    expect(document.querySelector('[data-testid="counter-heating-interruptions"]')).toBeNull();
    expect(document.querySelector('[data-testid="counter-purge-cycles"]')).toBeNull();
  });
});
