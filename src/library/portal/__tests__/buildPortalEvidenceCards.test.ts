import { describe, expect, it } from 'vitest';
import type { HomeProfileTile } from '../../../features/insightPack/insightPack.types';
import { atlasMvpContentMapRegistry } from '../../content';
import { buildPortalEvidenceCards } from '../buildPortalEvidenceCards';

const realPortalTiles: HomeProfileTile[] = [
  { icon: '🚿', title: 'Hot water demand', finding: '5 occupants, 2 bathrooms, frequent overlapping showers.' },
  { icon: '💧', title: 'Water pressure and flow', finding: 'Good static pressure, flow dips at overlap demand.' },
  { icon: '🏠', title: 'Heat loss and insulation', finding: 'Moderate heat loss with mixed insulation quality.' },
  { icon: '🔧', title: 'Current boiler', finding: 'Existing open-vented setup with ageing components.' },
  { icon: '🌱', title: 'Future energy plans', finding: 'Interested in solar PV and tariff-aware controls.' },
];

describe('buildPortalEvidenceCards', () => {
  it('builds evidence cards from portal facts with concept and media links', () => {
    const cards = buildPortalEvidenceCards({
      tiles: realPortalTiles,
      atlasMvpContentMapRegistry,
    });

    expect(cards.length).toBeGreaterThanOrEqual(6);
    expect(cards.map((card) => card.title)).toContain('Hot water demand');
    expect(cards.map((card) => card.title)).toContain('Water pressure and flow');
    expect(cards.map((card) => card.title)).toContain('Heat loss and insulation');
  });

  it('links pressure/flow facts to water concepts', () => {
    const cards = buildPortalEvidenceCards({
      tiles: realPortalTiles,
      atlasMvpContentMapRegistry,
    });

    const pressureCard = cards.find((card) => card.id === 'water_pressure_and_flow');
    expect(pressureCard).toBeDefined();
    expect(pressureCard?.linkedConceptIds).toEqual(expect.arrayContaining([
      'pressure_vs_storage',
      'flow_restriction',
    ]));
    expect(pressureCard?.suggestedDiagramIds.length ?? 0).toBeGreaterThan(0);
  });

  it('sanitizes raw engine-like terms from facts', () => {
    const cards = buildPortalEvidenceCards({
      tiles: [{ icon: '🚿', title: 'Hot water demand', finding: 'DEBUG:raw_engine_term CON_C02' }, ...realPortalTiles.slice(1)],
      atlasMvpContentMapRegistry,
    });

    expect(cards.map((card) => card.plainEnglishFact).join(' ')).not.toMatch(/raw_engine_term|CON_C02/);
  });

  it('returns no cards when essential content is missing', () => {
    const cards = buildPortalEvidenceCards({
      tiles: [],
      atlasMvpContentMapRegistry: [],
    });

    expect(cards).toEqual([]);
  });
});
