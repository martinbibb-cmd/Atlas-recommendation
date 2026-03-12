/**
 * whatIfScenarios.ts
 *
 * Typed scenario data for the "What if…?" explainer lab.
 *
 * Each scenario teaches a single cause-and-effect relationship using
 * plain English — no engine jargon or internal identifiers.
 *
 * visualType values map to the inline diagram components in WhatIfLab.tsx.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type WhatIfScenario = {
  id: string;
  title: string;
  shortVerdict: string;
  whyItMatters: string[];
  beforeLabel?: string;
  afterLabel?: string;
  visualType: 'cycling' | 'pressure' | 'emitters' | 'controls' | 'primaries' | 'storage';
  appliesTo?: Array<'combi' | 'system' | 'regular' | 'ashp' | 'all'>;
};

// ─── Scenario definitions ─────────────────────────────────────────────────────

export const WHAT_IF_SCENARIOS: WhatIfScenario[] = [
  {
    id: 'boiler_too_big',
    title: 'Boiler too big',
    shortVerdict: 'Too much output for the heating load causes cycling.',
    whyItMatters: [
      'The boiler reaches temperature too quickly.',
      'It switches off and restarts more often.',
      'That hurts efficiency and comfort.',
    ],
    visualType: 'cycling',
    appliesTo: ['combi', 'system', 'regular'],
  },
  {
    id: 'water_pressure_too_low',
    title: 'Water pressure too low',
    shortVerdict: 'Low mains pressure can stop a combi delivering reliable hot water.',
    whyItMatters: [
      'Hot water flow becomes unstable.',
      'Shower performance can drop.',
      'A stored system may cope better.',
    ],
    visualType: 'pressure',
    appliesTo: ['combi'],
  },
  {
    id: 'upgrade_radiators',
    title: 'Upgrade radiators',
    shortVerdict: 'Larger emitters can deliver the same heat at a lower flow temperature.',
    whyItMatters: [
      'That helps boilers stay in condensing range.',
      'It improves heat-pump suitability.',
      'Rooms can heat more evenly.',
    ],
    visualType: 'emitters',
    appliesTo: ['all'],
  },
  {
    id: 'add_better_controls',
    title: 'Add better controls',
    shortVerdict: 'Smarter controls reduce unnecessary high-temperature running.',
    whyItMatters: [
      'Flow temperature can drop in milder weather.',
      'The system runs steadier.',
      'Cycling and wasted heat reduce.',
    ],
    visualType: 'controls',
    appliesTo: ['all'],
  },
  {
    id: 'upgrade_primaries',
    title: 'Upgrade primaries',
    shortVerdict: 'Larger primary pipework reduces hydraulic bottlenecks.',
    whyItMatters: [
      'Higher flow is possible without excessive velocity.',
      'This matters especially for heat pumps.',
      'It can unlock better system performance.',
    ],
    visualType: 'primaries',
    appliesTo: ['all'],
  },
  {
    id: 'add_stored_hot_water',
    title: 'Add stored hot water',
    shortVerdict: 'Stored hot water separates generation from demand.',
    whyItMatters: [
      'Hot water is available immediately from storage.',
      'The heat source can reheat afterward.',
      'This helps with overlapping or larger hot-water demand.',
    ],
    visualType: 'storage',
    appliesTo: ['system', 'regular', 'ashp'],
  },
];
