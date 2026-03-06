/**
 * generateGraphFromConcept — public entry point for PR3 topology-driven graph generation.
 *
 * Translates a `SystemConceptModel` into a ready-to-use `BuildGraph` that can be loaded
 * directly into the lab builder.  The graph contains correct port connections, sensible
 * canvas positions, and valid hydraulic paths for each supported system topology.
 *
 * Routing logic (dispatched from the concept model):
 *
 *   hotWaterService === 'combi_plate_hex'
 *     → combi system (system_boiler + integrated plate HEX, no cylinder)
 *
 *   controls === 'y_plan'
 *     → regular boiler + 3-port valve + vented cylinder (open-vented circuit)
 *
 *   controls === 's_plan'
 *     → system boiler + 2 × zone valves + cylinder (sealed circuit)
 *
 *   heatSource === 'heat_pump'
 *     → heat pump + buffer + emitter loops + cylinder
 *
 * Users can still edit the generated graph afterwards.
 *
 * @module generateGraphFromConcept
 */

import type { BuildGraph } from '../builder/types';
import type { SystemConceptModel } from './types';
import { conceptModelToGraph } from './systemGraphGenerator';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a default `BuildGraph` from a `SystemConceptModel`.
 *
 * The returned graph:
 *  - contains valid node connections for the selected system topology
 *  - uses sensible grid positions (ready to render without editing)
 *  - has correct port wiring for heating and domestic circuits
 *  - passes graph validation with no warnings on the four canonical systems
 *
 * Users can modify the graph in the builder after generation.
 *
 * @param concept - The composable system concept model describing heat source,
 *                  hot water service, controls topology, and emitters.
 * @returns A `BuildGraph` that can be loaded into `BuilderShell` or passed to
 *          `graphToLabControls()` for Play-mode simulation.
 */
export function generateGraphFromConcept(concept: SystemConceptModel): BuildGraph {
  return conceptModelToGraph(concept);
}
