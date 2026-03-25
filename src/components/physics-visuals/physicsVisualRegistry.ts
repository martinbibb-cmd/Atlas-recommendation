/**
 * physicsVisualRegistry.ts
 *
 * Canonical registry describing every explainer visual in the Atlas Physics
 * Visual Library. One entry per visual — this is the single source of truth
 * for metadata, categories, animation defaults, and presentation wiring.
 *
 * Each entry declares:
 *   - what display modes it supports (preview / inline / focus)
 *   - what page types it suits
 *   - what engine signal types trigger it
 *   - which system families it applies to
 *
 * This lets the presentation layer select visuals declaratively:
 *   "for this home, use solar_mismatch on the energy page"
 * instead of hardcoding page logic everywhere.
 */

import type { PhysicsVisualDefinition, PhysicsVisualId } from './physicsVisualTypes';

// ─── Registry ──────────────────────────────────────────────────────────────────

const REGISTRY: PhysicsVisualDefinition[] = [
  {
    id: 'driving_style',
    title: 'Heating behaviour styles',
    concept: 'Different heating systems produce heat in fundamentally different rhythms.',
    purpose:
      'Illustrates how combi, stored-water and heat-pump systems behave differently: burst/stop vs smooth steady flow.',
    defaultDurationMs: 3000,
    supportsReducedMotion: true,
    supportsInteraction: true,
    category: 'system_behaviour',
    displayModes: ['preview', 'inline', 'focus'],
    applicablePages: ['system_comparison', 'recommendation'],
    applicableSystemFamilies: ['combi', 'stored_water', 'heat_pump'],
    applicableSignalTypes: ['system_family', 'cycling_rate'],
  },
  {
    id: 'flow_split',
    title: 'Simultaneous outlet demand',
    concept: 'Mains pressure is shared — more taps open means less flow at each one.',
    purpose:
      'Shows how delivered flow at each outlet weakens when one, two, or three taps run at the same time.',
    defaultDurationMs: 2500,
    supportsReducedMotion: true,
    supportsInteraction: true,
    category: 'water',
    displayModes: ['preview', 'inline', 'focus'],
    applicablePages: ['hot_water', 'recommendation'],
    applicableSystemFamilies: ['combi'],
    applicableSignalTypes: ['peakConcurrentOutlets', 'occupancyCount', 'bathroomCount'],
  },
  {
    id: 'solar_mismatch',
    title: 'Solar generation vs household demand',
    concept: 'Solar peaks at midday; households need hot water in the morning and evening.',
    purpose:
      'Visualises why generation peaks at midday while household demand peaks in the morning and evening.',
    defaultDurationMs: 4000,
    supportsReducedMotion: true,
    supportsInteraction: false,
    category: 'energy',
    displayModes: ['preview', 'inline', 'focus'],
    applicablePages: ['energy', 'recommendation'],
    applicableSystemFamilies: ['stored_water', 'heat_pump'],
    applicableSignalTypes: ['pvSuitability', 'solarStorageOpportunity', 'energyDemandAlignment'],
  },
  {
    id: 'cylinder_charge',
    title: 'Stored water charge and discharge',
    concept: 'A cylinder stores hot water so it is ready whenever the household calls for it.',
    purpose:
      'Demonstrates how energy enters a cylinder, builds up, and is drawn down when the household calls for hot water.',
    defaultDurationMs: 3500,
    supportsReducedMotion: true,
    supportsInteraction: true,
    category: 'water',
    displayModes: ['preview', 'inline', 'focus'],
    applicablePages: ['hot_water', 'recommendation'],
    applicableSystemFamilies: ['stored_water', 'heat_pump', 'open_vented'],
    applicableSignalTypes: ['storageBenefitSignal', 'dailyHotWaterLitres', 'demandProfileLabel'],
  },
  {
    id: 'heat_particles',
    title: 'Heat transfer through walls',
    concept: 'Heat moves through walls by conduction and through rooms by convection.',
    purpose: 'Shows conductive and convective heat movement through a wall section, and how insulation slows both.',
    defaultDurationMs: 3000,
    supportsReducedMotion: true,
    supportsInteraction: true,
    category: 'heat',
    displayModes: ['preview', 'inline', 'focus'],
    applicablePages: ['fabric', 'recommendation'],
    applicableSystemFamilies: ['combi', 'stored_water', 'heat_pump', 'open_vented'],
    applicableSignalTypes: ['fabricHeatLoss', 'wallType', 'insulationLevel'],
  },
  {
    id: 'bees_vs_tortoise',
    title: 'Burst firing vs steady state',
    concept: 'A combi fires in intense bursts; a heat pump runs long and slow.',
    purpose:
      'Contrasts high-cycling combi bursts (bees) against slow steady heat-pump output (tortoise).',
    defaultDurationMs: 4000,
    supportsReducedMotion: true,
    supportsInteraction: false,
    category: 'system_behaviour',
    displayModes: ['preview', 'inline', 'focus'],
    applicablePages: ['system_comparison'],
    applicableSystemFamilies: ['combi', 'heat_pump'],
    applicableSignalTypes: ['cycling_rate', 'system_family'],
  },
  {
    id: 'sponge',
    title: 'Thermal mass absorption',
    concept: 'A heavy building absorbs and releases heat slowly, like a sponge.',
    purpose: 'Illustrates how a high-mass building absorbs and releases heat over time.',
    defaultDurationMs: 3000,
    supportsReducedMotion: true,
    supportsInteraction: false,
    category: 'heat',
    displayModes: ['preview', 'inline', 'focus'],
    applicablePages: ['fabric'],
    applicableSystemFamilies: ['heat_pump'],
    applicableSignalTypes: ['thermalMass', 'wallType'],
  },
  {
    id: 'u_gauge',
    title: 'System pressure balance',
    concept: 'A sealed heating circuit keeps pressure balanced between flow and return.',
    purpose:
      'Shows the hydraulic balance between flow and return legs of a sealed heating circuit.',
    defaultDurationMs: 2500,
    supportsReducedMotion: true,
    supportsInteraction: false,
    category: 'controls',
    displayModes: ['preview', 'inline', 'focus'],
    applicablePages: ['system_comparison'],
    applicableSystemFamilies: ['combi', 'stored_water'],
    applicableSignalTypes: ['systemPressure'],
  },
  {
    id: 'trv_flow',
    title: 'TRV flow modulation',
    concept: 'A thermostatic radiator valve throttles flow as the room reaches temperature.',
    purpose: 'Demonstrates how a thermostatic radiator valve throttles flow as room temperature rises.',
    defaultDurationMs: 3000,
    supportsReducedMotion: true,
    supportsInteraction: false,
    category: 'controls',
    displayModes: ['preview', 'inline', 'focus'],
    applicablePages: ['controls'],
    applicableSystemFamilies: ['combi', 'stored_water', 'heat_pump'],
    applicableSignalTypes: ['controlsUpgrade'],
  },
  {
    id: 'boiler_cycling',
    title: 'Oversized boiler cycling',
    concept: 'An oversized boiler reaches setpoint too fast and cycles excessively.',
    purpose:
      'Animated diagram showing how an oversized boiler fires in short intense bursts, reaching setpoint too quickly and cycling excessively.',
    defaultDurationMs: 3000,
    supportsReducedMotion: true,
    supportsInteraction: false,
    category: 'system_behaviour',
    displayModes: ['preview', 'inline', 'focus'],
    applicablePages: ['system_comparison', 'recommendation'],
    applicableSystemFamilies: ['combi', 'stored_water'],
    applicableSignalTypes: ['cycling_rate', 'boilerSize'],
  },
  {
    id: 'flow_restriction',
    title: 'Mains flow vs demand',
    concept: 'Low mains flow rate is a hard limit for on-demand hot water performance.',
    purpose:
      'Shows the gap between mains supply flow rate and household hot-water demand that causes instability in a combi boiler.',
    defaultDurationMs: 2500,
    supportsReducedMotion: true,
    supportsInteraction: false,
    category: 'water',
    displayModes: ['preview', 'inline', 'focus'],
    applicablePages: ['hot_water'],
    applicableSystemFamilies: ['combi'],
    applicableSignalTypes: ['mainsFlowRate', 'peakConcurrentOutlets'],
  },
  {
    id: 'radiator_upgrade',
    title: 'Radiator upgrade — flow temperature',
    concept: 'Larger radiators deliver the same heat at a lower water temperature.',
    purpose:
      'Illustrates how upsized radiators allow a lower flow temperature, enabling the boiler to condense and improve efficiency.',
    defaultDurationMs: 2500,
    supportsReducedMotion: true,
    supportsInteraction: false,
    category: 'heat',
    displayModes: ['preview', 'inline', 'focus'],
    applicablePages: ['fabric', 'recommendation'],
    applicableSystemFamilies: ['combi', 'stored_water', 'heat_pump'],
    applicableSignalTypes: ['radiatorSize', 'flowTemperature'],
  },
  {
    id: 'controls_upgrade',
    title: 'Fixed high flow vs lower steady running',
    concept: 'Better controls let the boiler modulate more steadily instead of cycling on/off.',
    purpose:
      'Contrasts blocky on/off firing at a fixed high flow temperature against steadier, lower-temperature modulation.',
    defaultDurationMs: 3000,
    supportsReducedMotion: true,
    supportsInteraction: false,
    category: 'controls',
    displayModes: ['preview', 'inline', 'focus'],
    applicablePages: ['controls', 'recommendation'],
    applicableSystemFamilies: ['combi', 'stored_water'],
    applicableSignalTypes: ['controlsUpgrade', 'flowTemperature'],
  },
];

// ─── Lookup helpers ────────────────────────────────────────────────────────────

/** Map for O(1) lookup by id. */
const REGISTRY_MAP = new Map<PhysicsVisualId, PhysicsVisualDefinition>(
  REGISTRY.map((d) => [d.id, d]),
);

/** Return the definition for a given id, or undefined if not registered. */
export function getVisualDefinition(id: PhysicsVisualId): PhysicsVisualDefinition | undefined {
  return REGISTRY_MAP.get(id);
}

/** Return all registered visual definitions. */
export function getAllVisualDefinitions(): PhysicsVisualDefinition[] {
  return REGISTRY;
}

/**
 * Return all visuals applicable to a given presentation page type.
 * Useful for declarative page-level visual selection.
 */
export function getVisualsForPage(pageType: string): PhysicsVisualDefinition[] {
  return REGISTRY.filter((d) => d.applicablePages?.includes(pageType) ?? false);
}

/**
 * Return all visuals applicable to a given system family.
 * Useful for filtering the library to what is relevant for a household.
 */
export function getVisualsForFamily(family: string): PhysicsVisualDefinition[] {
  return REGISTRY.filter((d) => d.applicableSystemFamilies?.includes(family) ?? false);
}

/**
 * Return all visuals that are triggered by or enriched by a given engine signal key.
 */
export function getVisualsForSignal(signalKey: string): PhysicsVisualDefinition[] {
  return REGISTRY.filter((d) => d.applicableSignalTypes?.includes(signalKey) ?? false);
}

export default REGISTRY;
