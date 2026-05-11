import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import WhatWeKnowGrid from '../WhatWeKnowGrid';
import type { HomeProfileTile } from '../insightPack.types';

const tiles: HomeProfileTile[] = [
  { icon: '🚿', title: 'Hot water demand', finding: 'Family use with shower overlap in the morning.' },
  { icon: '💧', title: 'Water pressure and flow', finding: 'Good pressure, dynamic flow dip at overlap.' },
  { icon: '🏠', title: 'Heat loss and insulation', finding: 'Moderate heat loss with insulation upgrades pending.' },
  { icon: '🔧', title: 'Current boiler', finding: 'Open-vented layout due for sealed conversion review.' },
  { icon: '🌱', title: 'Future energy plans', finding: 'Interested in solar PV and future-ready controls.' },
];

describe('WhatWeKnowGrid library evidence cards', () => {
  it('renders library-backed evidence cards from portal facts', () => {
    render(<WhatWeKnowGrid tiles={tiles} />);

    expect(screen.getByTestId('what-we-know-grid')).toBeTruthy();
    expect(screen.getAllByTestId('wk-evidence-card').length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText('Water pressure and flow')).toBeTruthy();
  });
});
