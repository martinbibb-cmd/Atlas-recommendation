/**
 * physicsVisualRegistry.ts
 *
 * Canonical registry describing every explainer visual in the Atlas Physics
 * Visual Library. One entry per visual — this is the single source of truth
 * for metadata, categories, and animation defaults.
 */

import type { PhysicsVisualDefinition, PhysicsVisualId } from './physicsVisualTypes';

// ─── Registry ──────────────────────────────────────────────────────────────────

const REGISTRY: PhysicsVisualDefinition[] = [
  {
    id: 'driving_style',
    title: 'Heating behaviour styles',
    purpose:
      'Illustrates how combi, stored-water and heat-pump systems behave differently: burst/stop vs smooth steady flow.',
    defaultDurationMs: 3000,
    supportsReducedMotion: true,
    category: 'system_behaviour',
  },
  {
    id: 'flow_split',
    title: 'Simultaneous outlet demand',
    purpose:
      'Shows how delivered flow at each outlet weakens when one, two, or three taps run at the same time.',
    defaultDurationMs: 2500,
    supportsReducedMotion: true,
    category: 'water',
  },
  {
    id: 'solar_mismatch',
    title: 'Solar generation vs household demand',
    purpose:
      'Visualises why generation peaks at midday while household demand peaks in the morning and evening.',
    defaultDurationMs: 4000,
    supportsReducedMotion: true,
    category: 'energy',
  },
  {
    id: 'cylinder_charge',
    title: 'Stored water charge and discharge',
    purpose:
      'Demonstrates how energy enters a cylinder, builds up, and is drawn down when the household calls for hot water.',
    defaultDurationMs: 3500,
    supportsReducedMotion: true,
    category: 'water',
  },
  {
    id: 'heat_particles',
    title: 'Heat transfer particles',
    purpose: 'Shows conductive and convective heat movement through a wall section.',
    defaultDurationMs: 3000,
    supportsReducedMotion: true,
    category: 'heat',
  },
  {
    id: 'bees_vs_tortoise',
    title: 'Burst firing vs steady state',
    purpose:
      'Contrasts high-cycling combi bursts (bees) against slow steady heat-pump output (tortoise).',
    defaultDurationMs: 4000,
    supportsReducedMotion: true,
    category: 'system_behaviour',
  },
  {
    id: 'sponge',
    title: 'Thermal mass absorption',
    purpose: 'Illustrates how a high-mass building absorbs and releases heat over time.',
    defaultDurationMs: 3000,
    supportsReducedMotion: true,
    category: 'heat',
  },
  {
    id: 'u_gauge',
    title: 'System pressure balance',
    purpose:
      'Shows the hydraulic balance between flow and return legs of a sealed heating circuit.',
    defaultDurationMs: 2500,
    supportsReducedMotion: true,
    category: 'controls',
  },
  {
    id: 'trv_flow',
    title: 'TRV flow modulation',
    purpose: 'Demonstrates how a thermostatic radiator valve throttles flow as room temperature rises.',
    defaultDurationMs: 3000,
    supportsReducedMotion: true,
    category: 'controls',
  },
  {
    id: 'boiler_cycling',
    title: 'Oversized boiler cycling',
    purpose:
      'Animated diagram showing how an oversized boiler fires in short intense bursts, reaching setpoint too quickly and cycling excessively.',
    defaultDurationMs: 3000,
    supportsReducedMotion: true,
    category: 'system_behaviour',
  },
  {
    id: 'flow_restriction',
    title: 'Mains flow vs. demand',
    purpose:
      'Shows the gap between mains supply flow rate and household hot-water demand that causes instability in a combi boiler.',
    defaultDurationMs: 2500,
    supportsReducedMotion: true,
    category: 'water',
  },
  {
    id: 'radiator_upgrade',
    title: 'Radiator upgrade — flow temperature',
    purpose:
      'Illustrates how upsized radiators allow a lower flow temperature, enabling the boiler to condense and improve efficiency.',
    defaultDurationMs: 2500,
    supportsReducedMotion: true,
    category: 'heat',
  },
  {
    id: 'controls_upgrade',
    title: 'Fixed high flow vs. lower steady running',
    purpose:
      'Contrasts blocky on/off firing at a fixed high flow temperature against steadier, lower-temperature modulation.',
    defaultDurationMs: 3000,
    supportsReducedMotion: true,
    category: 'controls',
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

export default REGISTRY;
