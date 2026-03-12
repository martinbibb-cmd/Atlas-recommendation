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
    title: 'Improve boiler control',
    shortVerdict: 'Better boiler control helps the heat source run lower and steadier.',
    whyItMatters: [
      'Lower flow temperatures improve condensing potential.',
      'Better control reduces stop-start cycling.',
      'Correct setup usually matters more than chasing outdoor weather signals.',
    ],
    beforeLabel: 'Fixed higher flow',
    afterLabel: 'Lower, steadier flow',
    visualType: 'controls',
    appliesTo: ['all'],
  },
  {
    id: 'upgrade_primaries',
    title: 'Upgrade primaries',
    shortVerdict: '28 mm primaries reduce flow restriction where 22 mm becomes the bottleneck.',
    whyItMatters: [
      '22 mm is standard for most domestic primary pipework.',
      '28 mm can be needed when required flow rises beyond what 22 mm can sensibly carry.',
      'This matters especially for larger system outputs and heat pump flow rates.',
    ],
    beforeLabel: '22 mm primaries',
    afterLabel: '28 mm primaries',
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
