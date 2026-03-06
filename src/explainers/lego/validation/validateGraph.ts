/**
 * validateGraph — connection and structural validation for a LegoGraph.
 *
 * Returns a list of ValidationIssue describing any problems found.
 * Checks:
 *  1. Port type compatibility on every edge
 *  2. Circuit kind compatibility (cross-circuit connections are blocked):
 *     - primary_flow / primary_return must not connect to domestic water ports
 *     - dhw_hot must not connect to a primary coil input
 *  3. Required-upstream rules:
 *     - cylinder_unvented / cylinder_mixergy require an unvented_inlet_group upstream on cold_in
 *     - boiler_combi_dhw_hex must receive cold_water on its 'in' port
 *     - draw_event must connect to hot_water on its 'in' port
 *  4. Cylinder coil rules (warn when coil is unconnected):
 *     - cylinder_vented / cylinder_unvented / cylinder_mixergy coil ports should connect to a heat source
 */

import type { LegoGraph, LegoBlock, PortType, CircuitKind } from '../schema/legoTypes';
import { BLOCK_CATALOG } from '../catalog/blockCatalog';

// ─── Output shape ─────────────────────────────────────────────────────────────

export interface ValidationIssue {
  severity: 'error' | 'warn';
  message: string;
  blockId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Determine whether two port types are compatible for a connection. */
function portsCompatible(fromType: PortType, toType: PortType): boolean {
  if (fromType === toType) return true;
  // Generic 'water' is compatible with cold_water or hot_water on either side
  if (fromType === 'water' || toType === 'water') return true;
  return false;
}

/**
 * Determine whether two circuit kinds are compatible for a connection.
 *
 * Cross-circuit connections are the most common source of incorrect plumbing
 * models. Key rules:
 *  - primary_flow / primary_return (boiler ↔ coil) are compatible with
 *    heating_flow / heating_return (same physical fluid in a primary circuit)
 *  - All heating/primary circuit kinds must not mix with dhw_cold / dhw_hot
 *  - dhw_hot must not feed a primary coil input
 *  - cold_only / dhw_cold must not connect to heating circuits
 *
 * If either port has no circuit annotation (undefined), the check is skipped
 * so that legacy ports and generic 'water' blocks remain compatible.
 */
function circuitsCompatible(fromCircuit: CircuitKind | undefined, toCircuit: CircuitKind | undefined): boolean {
  if (!fromCircuit || !toCircuit) return true; // unannotated ports are unchecked

  // Heating group: primary_flow/primary_return and heating_flow/heating_return
  // are all the same physical fluid — compatible with each other
  const heatingGroup = new Set<CircuitKind>([
    'primary_flow', 'primary_return',
    'heating_flow', 'heating_return',
  ]);

  // Domestic water group
  const domesticGroup = new Set<CircuitKind>(['dhw_cold', 'dhw_hot', 'cold_only']);

  // Heating circuits are internally compatible (primary ↔ heating is fine — same fluid),
  // which also covers the fromCircuit === toCircuit same-kind case
  if (heatingGroup.has(fromCircuit) && heatingGroup.has(toCircuit)) return true;

  // Domestic circuits: same kind is compatible; cold and hot must not be cross-connected
  if (fromCircuit === toCircuit) return true;
  if (fromCircuit === 'dhw_cold' && toCircuit === 'dhw_hot') return false;
  if (fromCircuit === 'dhw_hot'  && toCircuit === 'dhw_cold') return false;

  // Heating ↔ domestic are incompatible — key rule for cylinder plumbing correctness
  if (heatingGroup.has(fromCircuit) && domesticGroup.has(toCircuit)) return false;
  if (domesticGroup.has(fromCircuit) && heatingGroup.has(toCircuit)) return false;

  return true;
}

/** Look up a port definition from the catalog for a given block + portId. */
function findPort(block: LegoBlock, portId: string) {
  const entry = BLOCK_CATALOG[block.type];
  if (!entry) return undefined;
  return entry.ports.find(p => p.id === portId);
}

/** Collect the set of block IDs that feed directly into a target block via a specific port. */
function directUpstreamIdsOnPort(graph: LegoGraph, targetId: string, targetPortId: string): string[] {
  return graph.edges
    .filter(e => e.toBlockId === targetId && e.toPortId === targetPortId)
    .map(e => e.fromBlockId);
}

/** Check whether a port on a block has any connection (inbound or outbound). */
function portIsConnected(graph: LegoGraph, blockId: string, portId: string): boolean {
  return graph.edges.some(
    e => (e.fromBlockId === blockId && e.fromPortId === portId) ||
         (e.toBlockId   === blockId && e.toPortId   === portId),
  );
}

const CYLINDER_TYPES = new Set<string>(['cylinder_vented', 'cylinder_unvented', 'cylinder_mixergy']);

// ─── Main validator ───────────────────────────────────────────────────────────

export function validateGraph(graph: LegoGraph): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const blockMap = new Map<string, LegoBlock>(graph.blocks.map(b => [b.id, b]));

  // ── 1. Port type and circuit compatibility on every edge ───────────────────
  for (const edge of graph.edges) {
    const fromBlock = blockMap.get(edge.fromBlockId);
    const toBlock   = blockMap.get(edge.toBlockId);

    if (!fromBlock) {
      issues.push({ severity: 'error', message: `Edge references unknown source block '${edge.fromBlockId}'.` });
      continue;
    }
    if (!toBlock) {
      issues.push({ severity: 'error', message: `Edge references unknown target block '${edge.toBlockId}'.` });
      continue;
    }

    const fromPort = findPort(fromBlock, edge.fromPortId);
    const toPort   = findPort(toBlock,   edge.toPortId);

    if (!fromPort) {
      issues.push({
        severity: 'error',
        message: `Block '${fromBlock.type}' has no port '${edge.fromPortId}'.`,
        blockId: edge.fromBlockId,
      });
      continue;
    }
    if (!toPort) {
      issues.push({
        severity: 'error',
        message: `Block '${toBlock.type}' has no port '${edge.toPortId}'.`,
        blockId: edge.toBlockId,
      });
      continue;
    }

    if (fromPort.direction !== 'out') {
      issues.push({
        severity: 'error',
        message: `Port '${edge.fromPortId}' on '${fromBlock.type}' is not an output port.`,
        blockId: edge.fromBlockId,
      });
    }
    if (toPort.direction !== 'in') {
      issues.push({
        severity: 'error',
        message: `Port '${edge.toPortId}' on '${toBlock.type}' is not an input port.`,
        blockId: edge.toBlockId,
      });
    }

    if (!portsCompatible(fromPort.type, toPort.type)) {
      issues.push({
        severity: 'error',
        message: `Incompatible port types: '${fromPort.type}' → '${toPort.type}' between '${fromBlock.type}' and '${toBlock.type}'.`,
        blockId: edge.toBlockId,
      });
    }

    // Circuit-kind cross-domain check (new in v2)
    if (!circuitsCompatible(fromPort.circuit, toPort.circuit)) {
      issues.push({
        severity: 'error',
        message: `Circuit mismatch: '${fromPort.circuit}' output cannot connect to '${toPort.circuit}' input (${fromBlock.type} → ${toBlock.type}). Primary heating circuit and domestic water circuit must remain separate.`,
        blockId: edge.toBlockId,
      });
    }
  }

  // ── 2. Required-upstream rules ─────────────────────────────────────────────

  for (const block of graph.blocks) {

    // Rule: cylinder_unvented / cylinder_mixergy requires unvented_inlet_group upstream on cold_in
    if (block.type === 'cylinder_unvented' || block.type === 'cylinder_mixergy') {
      const upstreamIds = directUpstreamIdsOnPort(graph, block.id, 'cold_in');
      const upstreamBlocks = upstreamIds.map(id => blockMap.get(id)).filter(Boolean) as LegoBlock[];
      const hasInletGroup = upstreamBlocks.some(b => b.type === 'unvented_inlet_group');
      if (!hasInletGroup) {
        issues.push({
          severity: 'error',
          message: 'Unvented cylinder needs an inlet control group (unvented_inlet_group) upstream.',
          blockId: block.id,
        });
      }
    }

    // Rule: boiler_combi_dhw_hex 'in' port must receive cold_water
    if (block.type === 'boiler_combi_dhw_hex') {
      const inEdges = graph.edges.filter(e => e.toBlockId === block.id && e.toPortId === 'in');
      for (const edge of inEdges) {
        const fromBlock = blockMap.get(edge.fromBlockId);
        if (!fromBlock) continue;
        const fromPort = findPort(fromBlock, edge.fromPortId);
        if (!fromPort) continue;
        if (fromPort.type !== 'cold_water' && fromPort.type !== 'water') {
          issues.push({
            severity: 'error',
            message: 'Combi DHW heat exchanger must be fed by cold mains (cold_water port).',
            blockId: block.id,
          });
        }
      }
    }

    // Rule: draw_event 'in' port must receive hot_water
    if (block.type === 'draw_event') {
      const inEdges = graph.edges.filter(e => e.toBlockId === block.id && e.toPortId === 'in');
      for (const edge of inEdges) {
        const fromBlock = blockMap.get(edge.fromBlockId);
        if (!fromBlock) continue;
        const fromPort = findPort(fromBlock, edge.fromPortId);
        if (!fromPort) continue;
        if (fromPort.type !== 'hot_water' && fromPort.type !== 'water') {
          issues.push({
            severity: 'error',
            message: 'Draw event must connect to hot water.',
            blockId: block.id,
          });
        }
      }
    }
  }

  // ── 3. Cylinder coil connection rules ──────────────────────────────────────
  // Warn when a cylinder's primary coil is not connected to a heat source.
  // This catches the common modelling error of treating a cylinder as a simple
  // hot-water pass-through rather than a storage vessel with a heat exchanger coil.

  for (const block of graph.blocks) {
    if (!CYLINDER_TYPES.has(block.type)) continue;

    const coilFlowConnected   = portIsConnected(graph, block.id, 'coil_flow_in');
    const coilReturnConnected = portIsConnected(graph, block.id, 'coil_return_out');

    // Only warn when the graph has at least one heat source (avoid noise on in-progress graphs)
    const hasHeatSource = graph.blocks.some(b =>
      b.type === 'boiler_primary' || b.type === 'heat_pump_primary' || b.type === 'immersion_heater',
    );

    if (hasHeatSource) {
      if (!coilFlowConnected) {
        issues.push({
          severity: 'warn',
          message: `Cylinder coil not connected: '${block.id}' coil_flow_in has no heat source. Primary heating circuit must connect to the coil, not the domestic water ports.`,
          blockId: block.id,
        });
      }
      if (!coilReturnConnected) {
        issues.push({
          severity: 'warn',
          message: `Cylinder coil not connected: '${block.id}' coil_return_out has no return path. Primary return must loop back to the heat source.`,
          blockId: block.id,
        });
      }
    }

    // Hard error: detect cross-circuit connection where a primary flow output is wired
    // directly to the cylinder's domestic hot_out port (the "hot water feeds cylinder" model error).
    const hotOutEdges = graph.edges.filter(
      e => e.toBlockId === block.id && e.toPortId === 'hot_out',
    );
    for (const edge of hotOutEdges) {
      const fromBlock = blockMap.get(edge.fromBlockId);
      if (!fromBlock) continue;
      const fromPort = findPort(fromBlock, edge.fromPortId);
      if (!fromPort) continue;
      if (fromPort.circuit === 'primary_flow' || fromPort.circuit === 'heating_flow') {
        issues.push({
          severity: 'error',
          message: `Primary flow connected to domestic hot outlet on '${block.id}': the boiler must heat the cylinder through the coil (coil_flow_in), not by directly supplying the domestic hot water outlet.`,
          blockId: block.id,
        });
      }
    }

    // Warn if a primary source is connected to cold_in (incorrect — cold_in is the domestic cold feed)
    const coldInEdges = graph.edges.filter(
      e => e.toBlockId === block.id && e.toPortId === 'cold_in',
    );
    for (const edge of coldInEdges) {
      const fromBlock = blockMap.get(edge.fromBlockId);
      if (!fromBlock) continue;
      const fromPort = findPort(fromBlock, edge.fromPortId);
      if (!fromPort) continue;
      if (fromPort.circuit === 'primary_flow' || fromPort.circuit === 'primary_return' ||
          fromPort.circuit === 'heating_flow' || fromPort.circuit === 'heating_return') {
        issues.push({
          severity: 'error',
          message: `Heating circuit connected to domestic cold inlet on '${block.id}': cold_in is the domestic cold-water feed, not a heating circuit port.`,
          blockId: block.id,
        });
      }
    }
  }

  return issues;
}
