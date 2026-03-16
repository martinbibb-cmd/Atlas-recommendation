/**
 * energyExplainerCopy.ts — shared copy strings for the energy literacy module.
 *
 * All user-facing text lives here so it can be reviewed once for terminology
 * compliance without hunting through component JSX.
 *
 * Language rules (docs/atlas-terminology.md):
 *   - "on-demand hot water" (not "instantaneous hot water")
 *   - "stored hot water" (not "unlimited hot water")
 *   - "tank-fed supply" (not "gravity system")
 *   - "mains-fed supply" (not "high pressure system")
 */

export const ENERGY_COPY = {
  panelTitle: 'Energy Literacy',
  panelSubtitle:
    'Short, clear explanations of the key concepts behind heat-pump and grid recommendations — each readable in about one minute.',

  primaryLadder: {
    title: 'Primary energy ladder',
    subtitle:
      'The same unit of gas produces very different amounts of useful heat depending on how you convert it.',
    gasBoilerLabel: 'Gas boiler',
    resistanceLabel: 'Electric resistance',
    heatPumpLabel: 'Heat pump',
    usefulHeatLabel: 'Useful heat delivered',
    note:
      'Electric resistance loses energy at the power station before electricity even reaches your home. A heat pump recovers that loss by collecting low-grade heat from outside air.',
  },

  sponge: {
    title: 'How a heat pump works',
    subtitle: 'Outside air holds low-grade heat even on cold days. A heat pump collects it.',
    bathLabel: 'Outside air (bath of low-grade heat)',
    spongeLabel: 'Heat pump (sponge)',
    squeezeLabel: 'Compressor (the squeeze)',
    emittersLabel: 'Emitters (where heat is released)',
    gentleLabel: 'Gentle squeeze → high COP',
    hardLabel: 'Hard squeeze → low COP',
    copNote:
      'The harder the compressor works (higher flow temperature), the more electricity it uses and the lower the efficiency.',
  },

  bigEmitter: {
    title: 'Why emitter size matters',
    subtitle:
      'The same room can be heated to the same temperature with different emitter sizes — but the required water temperature changes dramatically.',
    smallLabel: 'Small emitter',
    smallDetail: 'Needs high flow temperature (~70 °C)',
    largeLabel: 'Large emitter',
    largeDetail: 'Same heat delivered at low temperature (~45 °C)',
    multipleLabel: 'Multiple emitters low down',
    multipleDetail: 'Same effect as a larger outlet area',
    consequence:
      'Lower flow temperature → higher COP → lower running cost. Emitter sizing is the single biggest lever on heat-pump running cost.',
  },

  tortoiseBee: {
    title: 'Boilers are power machines. Heat pumps are efficiency machines.',
    subtitle: 'Each is suited to a different kind of demand.',
    beeLabel: 'Boiler',
    beeTraits: [
      'Burns rich fuel',
      'Very high output',
      'Responds in seconds',
      'Suited to sudden demand',
    ],
    tortoiseLabel: 'Heat pump',
    tortoiseTraits: [
      'Low power draw',
      'Steady continuous work',
      'Efficiency peaks when not rushed',
      'Best run for long steady periods',
    ],
    message:
      'Neither is universally better — the match between technology and demand pattern determines running cost and comfort.',
  },

  sourceTable: {
    safetyTitle: 'Safety by energy source',
    safetySubtitle:
      'Deaths per TWh of electricity generated — occupational, accident, and air quality. Lower is safer.',
    emissionsTitle: 'Lifecycle CO₂ by energy source',
    emissionsSubtitle:
      'Grams of CO₂-equivalent per kWh of electricity — full lifecycle including construction and fuel supply.',
    costTitle: 'Levelised cost of electricity by source',
    costSubtitle:
      'Indicative USD per MWh range (NREL ATB 2023 / Lazard LCOE v17). Costs vary by country, site, and project scale.',
    sourceHeader: 'Source',
    valueHeader: 'Value',
    noteHeader: 'Note',
    dataDisclaimer:
      'Numbers are indicative lifecycle estimates. Actual values vary by site, technology vintage, and accounting boundary.',
  },

  copChart: {
    title: 'COP break-even against a gas boiler',
    subtitle:
      'A heat pump must achieve at least this COP to deliver cheaper heat than a gas boiler at current UK tariffs.',
    xAxisLabel: 'Grid carbon intensity (g CO₂/kWh)',
    yAxisLabel: 'Required COP to break even',
    comfortZoneLabel: 'Comfort zone for good installs (COP 3–4)',
    note:
      'Break-even COP = boiler efficiency ÷ grid-to-boiler gas conversion efficiency. Lower grid carbon intensity shifts this threshold.',
  },

  simulator: {
    title: 'Grid scenario simulator',
    subtitle:
      'An educational systems model. Not a market forecast — shows the direction of change, not precise numbers.',
    disclaimer:
      'This is an educational simulator. It illustrates system-level logic; it does not predict market prices or grid outcomes.',
  },
} as const;
