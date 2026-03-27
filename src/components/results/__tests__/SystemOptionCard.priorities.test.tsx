/**
 * SystemOptionCard.priorities.test.tsx
 *
 * Unit tests for the "Supports your priorities" block added to SystemOptionCard.
 *
 * Verifies:
 *   1. "Supports your priorities" block is rendered when priorities intersect.
 *   2. Only priorities that both the user selected AND the option supports appear.
 *   3. Block is omitted entirely when no priorities are selected.
 *   4. Block is omitted when the user's selected priorities do not overlap the option's supported set.
 *   5. "Why this fits" block is rendered for viable cards with why[] lines.
 *   6. "The trade-off here is" block is rendered when a downgrade sensitivity exists.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SystemOptionCard from '../SystemOptionCard';
import type { OptionCardV1 } from '../../../contracts/EngineOutputV1';
import type { PriorityKey } from '../../../features/survey/priorities/prioritiesTypes';

// ─── Minimal card factory ─────────────────────────────────────────────────────

function makeCard(
  id: OptionCardV1['id'],
  status: OptionCardV1['status'],
  overrides: Partial<OptionCardV1> = {},
): OptionCardV1 {
  return {
    id,
    label: `Label for ${id}`,
    status,
    headline: `Headline for ${id}`,
    why: [],
    requirements: [],
    heat:        { status: 'ok', headline: '', bullets: [] },
    dhw:         { status: 'ok', headline: '', bullets: [] },
    engineering: { status: 'ok', headline: '', bullets: [] },
    typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
    ...overrides,
  };
}

// ─── "Supports your priorities" block ────────────────────────────────────────

describe('SystemOptionCard — Supports your priorities', () => {
  it('shows the block when selected priorities overlap the card\'s support set', () => {
    const card = makeCard('ashp', 'viable');
    // ashp supports: eco, cost_tendency, future_compatibility, longevity, reliability
    render(<SystemOptionCard card={card} selectedPriorities={['eco', 'reliability']} />);
    expect(screen.getByText('Supports your priorities')).toBeTruthy();
    expect(screen.getByText('Low carbon')).toBeTruthy();
    expect(screen.getByText('Reliability')).toBeTruthy();
  });

  it('omits the block when no priorities are selected', () => {
    const card = makeCard('ashp', 'viable');
    render(<SystemOptionCard card={card} selectedPriorities={[]} />);
    expect(screen.queryByText('Supports your priorities')).toBeNull();
  });

  it('omits the block when selectedPriorities is undefined', () => {
    const card = makeCard('ashp', 'viable');
    render(<SystemOptionCard card={card} />);
    expect(screen.queryByText('Supports your priorities')).toBeNull();
  });

  it('omits the block when none of the selected priorities overlap the card support set', () => {
    const card = makeCard('combi', 'viable');
    // combi supports: reliability, disruption
    // none of these are in the selected set
    const selected: PriorityKey[] = ['eco', 'future_compatibility'];
    render(<SystemOptionCard card={card} selectedPriorities={selected} />);
    expect(screen.queryByText('Supports your priorities')).toBeNull();
  });

  it('shows only the intersecting priorities, not all selected', () => {
    const card = makeCard('combi', 'viable');
    // combi supports: reliability, disruption
    const selected: PriorityKey[] = ['reliability', 'eco', 'future_compatibility'];
    render(<SystemOptionCard card={card} selectedPriorities={selected} />);
    expect(screen.getByText('Supports your priorities')).toBeTruthy();
    expect(screen.getByText('Reliability')).toBeTruthy();
    // eco and future_compatibility are NOT supported by combi
    expect(screen.queryByText('Low carbon')).toBeNull();
    expect(screen.queryByText('Future compatibility')).toBeNull();
  });

  it('works for rejected cards when priorities intersect', () => {
    const card = makeCard('stored_unvented', 'rejected', { why: ['Mains pressure too low.'] });
    // stored_unvented supports: performance, reliability, longevity, future_compatibility
    render(<SystemOptionCard card={card} selectedPriorities={['longevity']} />);
    expect(screen.getByText('Supports your priorities')).toBeTruthy();
    expect(screen.getByText('System longevity')).toBeTruthy();
  });
});

// ─── "Why this fits" block ────────────────────────────────────────────────────

describe('SystemOptionCard — Why this fits', () => {
  it('shows the block for viable cards that have why[] lines', () => {
    const card = makeCard('stored_unvented', 'viable', {
      why: ['Stored supply handles peak demand.', 'Mains pressure confirmed adequate.'],
    });
    render(<SystemOptionCard card={card} />);
    expect(screen.getByText('Why this fits')).toBeTruthy();
    expect(screen.getByText('Stored supply handles peak demand.')).toBeTruthy();
  });

  it('shows at most 2 why[] lines in the visible block', () => {
    const card = makeCard('stored_unvented', 'viable', {
      why: ['Reason 1.', 'Reason 2.', 'Reason 3.'],
    });
    render(<SystemOptionCard card={card} />);
    expect(screen.getByText('Why this fits')).toBeTruthy();
    expect(screen.getByText('Reason 1.')).toBeTruthy();
    expect(screen.getByText('Reason 2.')).toBeTruthy();
    // Reason 3 should be in the collapsible "More detail" section, not the visible block
    expect(screen.queryByText('Why this result')).toBeNull();
  });

  it('does not show the "Why this fits" block for rejected cards', () => {
    const card = makeCard('combi', 'rejected', {
      why: ['Simultaneous demand exceeds capacity.'],
    });
    render(<SystemOptionCard card={card} />);
    expect(screen.queryByText('Why this fits')).toBeNull();
  });
});

// ─── "The trade-off here is" block ────────────────────────────────────────────

describe('SystemOptionCard — The trade-off here is', () => {
  it('shows a trade-off for viable cards with a downgrade sensitivity', () => {
    const card = makeCard('ashp', 'viable', {
      sensitivities: [
        { condition: 'high_dhw_demand', effect: 'downgrade', note: 'COP drops at DHW temperatures above 60°C.' },
      ],
    });
    render(<SystemOptionCard card={card} />);
    expect(screen.getByText('The trade-off here is')).toBeTruthy();
    expect(screen.getByText('COP drops at DHW temperatures above 60°C.')).toBeTruthy();
  });

  it('does not show trade-off for viable cards without downgrade sensitivities', () => {
    const card = makeCard('ashp', 'viable', {
      sensitivities: [
        { condition: 'pipe_size', effect: 'upgrade', note: 'Upgrade 22mm pipework.' },
      ],
    });
    render(<SystemOptionCard card={card} />);
    expect(screen.queryByText('The trade-off here is')).toBeNull();
  });

  it('does not show trade-off for rejected cards', () => {
    const card = makeCard('ashp', 'rejected', {
      why: ['Heat loss too high for this unit size.'],
      sensitivities: [
        { condition: 'high_dhw_demand', effect: 'downgrade', note: 'COP drops at DHW temperatures.' },
      ],
    });
    render(<SystemOptionCard card={card} />);
    expect(screen.queryByText('The trade-off here is')).toBeNull();
  });
});
