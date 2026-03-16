/**
 * energySourceFacts.ts — canonical data for energy source safety, emissions,
 * and cost.
 *
 * All numbers come from published lifecycle analyses and are cited below.
 * Components must import from here — never write literals in component code.
 *
 * Sources:
 *  - Deaths per TWh: Our World in Data / Markandya & Wilkinson (2007) + UNSCEAR 2020
 *  - Lifecycle CO₂ g/kWh: IPCC AR6 WG3 Annex II; NREL 2021
 *  - LCOE USD/MWh: NREL Annual Technology Baseline 2023; Lazard LCOE v17 (2023)
 */

import type { EnergySourceFact } from '../types/energyTypes';

export const ENERGY_SOURCE_FACTS: readonly EnergySourceFact[] = [
  {
    id: 'nuclear',
    label: 'Nuclear',
    category: 'constant',
    typicalLifecycleCo2gPerKwh: 12,
    typicalDeathsPerTwh: 0.03,
    typicalLcoeUsdPerMwh: { low: 80, high: 180 },
    dispatchStyle: 'flat',
    explainer:
      'Generates large amounts of low-carbon electricity continuously. Construction costs are high; fuel and operational costs are low.',
  },
  {
    id: 'wind',
    label: 'Wind (onshore)',
    category: 'weather',
    typicalLifecycleCo2gPerKwh: 11,
    typicalDeathsPerTwh: 0.04,
    typicalLcoeUsdPerMwh: { low: 24, high: 75 },
    dispatchStyle: 'intermittent',
    explainer:
      'Output varies with wind speed; lowest cost new-build electricity in most markets. Needs balancing when wind drops.',
  },
  {
    id: 'solar',
    label: 'Solar PV',
    category: 'weather',
    typicalLifecycleCo2gPerKwh: 20,
    typicalDeathsPerTwh: 0.02,
    typicalLcoeUsdPerMwh: { low: 24, high: 96 },
    dispatchStyle: 'intermittent',
    explainer:
      'Generates only during daylight; near-zero running costs. High generation in summer; minimal contribution on winter evenings.',
  },
  {
    id: 'hydro',
    label: 'Hydro',
    category: 'predictable',
    typicalLifecycleCo2gPerKwh: 24,
    typicalDeathsPerTwh: 0.02,
    typicalLcoeUsdPerMwh: { low: 25, high: 90 },
    dispatchStyle: 'flexible',
    explainer:
      'Dispatchable and long-lived. Output depends on rainfall and reservoir level. Pumped-storage hydro is the largest form of grid-scale energy storage.',
  },
  {
    id: 'tidal',
    label: 'Tidal',
    category: 'predictable',
    typicalLifecycleCo2gPerKwh: 15,
    typicalDeathsPerTwh: 0.02,
    typicalLcoeUsdPerMwh: { low: 100, high: 250 },
    dispatchStyle: 'flat',
    explainer:
      'Highly predictable output linked to tidal cycles. Currently small contribution; potential grows with deployment.',
  },
  {
    id: 'gas',
    label: 'Natural gas',
    category: 'combustion',
    typicalLifecycleCo2gPerKwh: 490,
    typicalDeathsPerTwh: 0.07,
    typicalLcoeUsdPerMwh: { low: 39, high: 101 },
    dispatchStyle: 'instant',
    explainer:
      'Fast-response dispatchable generation. High lifecycle CO₂; acts as the primary balancing source on most grids today.',
  },
  {
    id: 'oil',
    label: 'Oil',
    category: 'combustion',
    typicalLifecycleCo2gPerKwh: 650,
    typicalDeathsPerTwh: 0.18,
    typicalLcoeUsdPerMwh: { low: 60, high: 175 },
    dispatchStyle: 'instant',
    explainer:
      'Rarely used for grid electricity in the UK; most common in backup generation and remote off-grid sites.',
  },
  {
    id: 'coal',
    label: 'Coal',
    category: 'combustion',
    typicalLifecycleCo2gPerKwh: 820,
    typicalDeathsPerTwh: 2.82,
    typicalLcoeUsdPerMwh: { low: 65, high: 150 },
    dispatchStyle: 'flexible',
    explainer:
      'Highest lifecycle CO₂ and highest death rate per unit of energy. Rapidly declining share of UK and European generation.',
  },
  {
    id: 'storage',
    label: 'Grid storage',
    category: 'storage',
    typicalLifecycleCo2gPerKwh: undefined,
    typicalDeathsPerTwh: undefined,
    typicalLcoeUsdPerMwh: { low: 10, high: 30 },
    dispatchStyle: 'stored',
    explainer:
      'Stores excess generation and releases it when demand exceeds supply. Reduces reliance on gas peakers; improves grid stability.',
  },
];

/** Lookup map for fast access by id. */
export const ENERGY_SOURCE_BY_ID: Readonly<Record<string, EnergySourceFact>> =
  Object.fromEntries(ENERGY_SOURCE_FACTS.map((f) => [f.id, f]));
