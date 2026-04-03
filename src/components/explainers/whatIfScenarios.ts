/**
 * whatIfScenarios.ts
 *
 * Trade-assumption scenario data for the "What if…?" explainer lab.
 *
 * Each scenario exposes a common rule-of-thumb assumption used by
 * customers, installers, or salespeople — explains the narrow case
 * where it holds, the edge case where it fails on physics, and what
 * Atlas recommends instead.  Scenarios are kept compact — explainable
 * in under a minute.
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
      'We calculate actual heat loss to select output that matches load — not room count or gut feel.',
    visualType: 'cycling',
    appliesTo: ['combi', 'system', 'regular'],
  },
  {
    id: 'bigger_primaries',
    title: 'Bigger primaries are always better',
    myth: 'Fitting the largest available primary pipework always improves system performance.',
    shortVerdict: 'Larger primaries only help when flow demand actually crosses the useful threshold.',
    physicsReason:
      'Below the required flow threshold, oversized pipe adds water volume that slows warm-up response ' +
      'and can reduce boiler efficiency through longer heat-exchanger fill times. ' +
      'For boilers the threshold is higher; for heat pumps it is lower because flow demand is much greater. ' +
      'Only when the system genuinely needs the extra flow does 28 mm outperform 22 mm.',
    recommendation:
      'We match primary bore to the calculated flow requirement — upgrading only when demand justifies the extra volume.',
    beforeLabel: '28 mm below threshold (extra volume, slow response)',
    afterLabel: '28 mm above threshold (adequate flow ✓)',
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
    id: 'combi_always_efficient',
    title: 'Combi is always more efficient',
    myth: 'No cylinder means no standing losses — so a combi is always the most efficient option.',
    shortVerdict: 'Frequent short DHW draws destroy real combi efficiency — even for 1–2 occupants.',
    physicsReason:
      'Every combi draw fires a cold heat exchanger, wastes fuel on warm-up, and dumps residual heat once the tap closes. ' +
      'Repeated handwashing, rinsing, and stop-start kitchen use can produce dozens of short draws per day. ' +
      'Each cold-start cycle carries a fixed energy penalty that a stored system avoids because the water is already hot.',
    recommendation:
      'We evaluate actual draw patterns — not just occupancy count — to determine whether on-demand or stored hot water is more efficient.',
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
    shortVerdict: 'More stored volume is not the same as more usable performance.',
    physicsReason:
      'A larger cylinder increases standing heat loss and extends reheat time. ' +
      'Usable hot-water performance depends on recovery rate, storage temperature, insulation losses, and the household draw pattern — ' +
      'not just litres of water. A right-sized cylinder matched to actual demand recovers faster and wastes less energy.',
    recommendation:
      'We size cylinder volume to actual daily draw, recovery capability, and draw pattern — not floor area or bedroom count.',
    beforeLabel: '300 L (high losses, slow recovery)',
    afterLabel: '170 L (right-sized)',
    visualType: 'oversizing',
    appliesTo: ['system', 'regular', 'ashp'],
  },
];
