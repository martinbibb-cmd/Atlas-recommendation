/**
 * validateGraph — connection and structural validation for a LegoGraph.
 *
 * Returns a list of ValidationIssue describing any problems found.
 * Checks:
 *  1. Port type compatibility on every edge
 *  2. Required-upstream rules:
 *     - cylinder_unvented requires an unvented_inlet_group upstream
 *     - boiler_combi_dhw_hex must receive cold_water on its 'in' port
 *     - draw_event must connect to hot_water on its 'in' port
 */

import type { LegoGraph, LegoBlock, PortType } from '../schema/legoTypes';
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

/** Look up a port definition from the catalog for a given block + portId. */
function findPort(block: LegoBlock, portId: string) {
  const entry = BLOCK_CATALOG[block.type];
  if (!entry) return undefined;
  return entry.ports.find(p => p.id === portId);
}

/** Collect the set of block IDs that feed directly into a target block. */
function directUpstreamIds(graph: LegoGraph, targetId: string): string[] {
  return graph.edges
    .filter(e => e.toBlockId === targetId)
    .map(e => e.fromBlockId);
}

// ─── Main validator ───────────────────────────────────────────────────────────

export function validateGraph(graph: LegoGraph): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const blockMap = new Map<string, LegoBlock>(graph.blocks.map(b => [b.id, b]));

  // ── 1. Port type compatibility ─────────────────────────────────────────────
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
  }

  // ── 2. Required-upstream rules ─────────────────────────────────────────────

  for (const block of graph.blocks) {

    // Rule: cylinder_unvented requires unvented_inlet_group upstream
    if (block.type === 'cylinder_unvented') {
      const upstreamIds = directUpstreamIds(graph, block.id);
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

  return issues;
}
