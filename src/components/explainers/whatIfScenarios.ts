/**
 * whatIfScenarios.ts
 *
 * Myth-busting scenario data for the "What if…?" explainer lab.
 *
 * Each scenario exposes a common assumption, explains what actually happens
 * physically, and states what Atlas recommends instead.  Scenarios are kept
 * compact — explainable in under a minute.
 *
 * visualType values map to the inline diagram components in WhatIfLab.tsx.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type VisualType =
  | 'cycling'
  | 'pressure'
  | 'emitters'
  | 'controls'
  | 'primaries'
  | 'storage'
  | 'hp_cylinder'
  | 'oversizing'
  | 'velocity';

export type WhatIfScenario = {
  id: string;
  /** Short myth title shown on the selector button and card heading. */
  title: string;
  /** The common assumption or myth being busted. */
  myth: string;
  /** What actually happens — one punchy sentence. */
  shortVerdict: string;
  /** Simple physics explanation of why the myth fails. */
  physicsReason: string;
  /** What Atlas recommends instead. */
  recommendation: string;
  beforeLabel?: string;
  afterLabel?: string;
  visualType: VisualType;
  /** Optional reference to a simulator feature for further exploration. */
  simulatorTieIn?: string;
  appliesTo?: Array<'combi' | 'system' | 'regular' | 'ashp' | 'all'>;
};

// ─── Scenario definitions ─────────────────────────────────────────────────────

export const WHAT_IF_SCENARIOS: WhatIfScenario[] = [
  {
    id: 'bigger_boiler',
    title: 'Bigger boiler = better heating',
    myth: 'A larger output means better heating, quicker warm-up, and more reliability.',
    shortVerdict: 'Oversized boilers short-cycle, waste fuel, and reduce comfort.',
    physicsReason:
      'When rated output far exceeds the true heat loss, the boiler reaches set-point almost instantly. ' +
      'It shuts off, cools, and restarts — each cold-start burning extra fuel on the heat exchanger warm-up.',
    recommendation:
      'Atlas calculates actual heat loss to select output that matches load — not room count or gut feel.',
    visualType: 'cycling',
    appliesTo: ['combi', 'system', 'regular'],
  },
  {
    id: 'bigger_primaries',
    title: 'Bigger primaries are always better',
    myth: 'Fitting the largest available primary pipework always improves system performance.',
    shortVerdict: 'Over-piped systems lose flow velocity, causing sludge accumulation and poor circulation.',
    physicsReason:
      'Flow velocity must stay above ~0.3 m/s to keep magnetite particles in suspension; ' +
      'below this threshold particles settle out and accumulate as sludge. ' +
      'Oversized pipes at typical domestic outputs drop velocity well below this threshold.',
    recommendation:
      'Atlas selects primary bore to balance flow restriction against the minimum velocity needed to keep the circuit clean.',
    beforeLabel: '35 mm (slow, sludge risk)',
    afterLabel: '28 mm (optimal velocity)',
    visualType: 'velocity',
    appliesTo: ['all'],
  },
  {
    id: 'high_flow_temp',
    title: 'Raise the flow temperature',
    myth: 'Simply raising the boiler flow temperature will fix cold rooms and improve system output.',
    shortVerdict: 'High flow temperatures lock out condensing mode and raise fuel costs without fixing the real cause.',
    physicsReason:
      'Gas boilers recover ~10 % extra efficiency when return water falls below ~55 °C (condensing mode). ' +
      'High flow temperatures push returns above this, permanently locking out the efficiency gain.',
    recommendation:
      'Fix emitter sizing or hydraulic balance — not the thermostat dial.',
    beforeLabel: '80 °C flow (non-condensing)',
    afterLabel: '55 °C flow (condensing ✓)',
    visualType: 'controls',
    appliesTo: ['combi', 'system', 'regular'],
  },
  {
    id: '22mm_bottleneck',
    title: '22 mm is always enough',
    myth: 'Standard 22 mm primary pipework can handle any domestic heating system output.',
    shortVerdict: '22 mm becomes a hydraulic bottleneck above ~12 kW, starving radiators of flow.',
    physicsReason:
      'Pressure drop rises sharply with flow rate in a fixed bore pipe. ' +
      'At typical pump heads, 22 mm cannot move the required volume above ~12 kW without unacceptable resistance.',
    recommendation:
      '28 mm primaries are required for outputs above ~12 kW and for any heat-pump primary circuit.',
    beforeLabel: '22 mm (restricted above 12 kW)',
    afterLabel: '28 mm (adequate flow)',
    visualType: 'primaries',
    appliesTo: ['all'],
  },
  {
    id: 'stored_always_efficient',
    title: 'Stored hot water is always more efficient',
    myth: 'A cylinder system always beats a combi for efficiency and running cost.',
    shortVerdict: 'Standing losses from a poorly matched cylinder can exceed the savings over on-demand hot water.',
    physicsReason:
      'A cylinder loses ~1.5–3 kWh per day to standing heat loss regardless of demand. ' +
      'For a 1–2 person household with low daily draw, this erases any generation-efficiency advantage.',
    recommendation:
      'Atlas matches system type to actual occupancy and daily hot-water draw — not property size.',
    visualType: 'storage',
    appliesTo: ['all'],
  },
  {
    id: 'hp_cylinder_55c',
    title: '55 °C is fine for a heat-pump cylinder',
    myth: 'Setting the heat-pump cylinder to 55 °C gives safe, efficient stored hot water.',
    shortVerdict: 'Legionella bacteria survive at 55 °C — a weekly 60 °C pasteurisation cycle is essential.',
    physicsReason:
      'Legionella multiplies between 20–45 °C and is reliably killed only above 60 °C. ' +
      'At 55 °C some strains survive indefinitely, posing a real health risk in a cylinder with low daily turnover.',
    recommendation:
      'Enable the immersion-assisted weekly heat-to-60 °C cycle on any heat-pump hot-water system.',
    beforeLabel: '55 °C continuous (risk)',
    afterLabel: '60 °C weekly cycle (safe)',
    visualType: 'hp_cylinder',
    appliesTo: ['ashp'],
  },
  {
    id: 'oversizing_cylinder',
    title: 'Bigger cylinder = more hot water',
    myth: 'A larger cylinder volume always means more available hot water and faster recovery.',
    shortVerdict: 'Oversized cylinders have higher standing losses and take longer to reheat to a usable temperature.',
    physicsReason:
      'More water volume means more energy lost per hour to standing heat loss. ' +
      'It also means longer reheat time before the full store reaches usable temperature. ' +
      'A right-sized cylinder recovers faster and wastes less energy.',
    recommendation:
      'Atlas sizes cylinder volume to actual daily draw — not floor area or bedroom count.',
    beforeLabel: '300 L (high losses, slow recovery)',
    afterLabel: '170 L (right-sized)',
    visualType: 'oversizing',
    appliesTo: ['system', 'regular', 'ashp'],
  },
];
