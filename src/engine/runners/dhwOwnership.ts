/**
 * dhwOwnership.ts — PR3: Defensive ownership assertions for DHW result envelopes.
 *
 * `assertValidDhwOwnership` validates that a `FamilyRunnerResult` (or any object
 * carrying a `dhw` envelope alongside a `SystemTopology`) satisfies the hard family
 * ownership rules introduced in PR3:
 *
 *   combi family (drawOff defined):
 *     - dhw.kind must be 'direct_combi'
 *     - dhw.combiDhwV1 must be present
 *     - dhw.storedDhwV1, dhw.mixergy, dhw.mixergyLegacy must be absent
 *
 *   hydronic families (drawOff === undefined):
 *     - dhw.kind must be 'stored'
 *     - dhw.storedDhwV1 must be present
 *     - dhw.combiDhwV1 must be absent
 *
 * This helper is designed to be called inside runners and in `runEngine()` during
 * development and test modes.  In production it should be a no-op or stripped by
 * the build — it is not a hot-path concern.
 *
 * Usage:
 *   assertValidDhwOwnership(result.dhw, result.topology);  // throws on violation
 */

import type { SystemTopology } from '../topology/SystemTopology';
import type { DhwResultEnvelope } from './types';

/**
 * Asserts that the DHW result envelope satisfies family ownership rules.
 *
 * Throws an `Error` if any forbidden field is populated or any required field is absent.
 *
 * @param dhw      The DHW result envelope from a `FamilyRunnerResult`.
 * @param topology The `SystemTopology` that was passed to the runner.
 *
 * @throws {Error} If the envelope violates the ownership contract for the given topology.
 */
export function assertValidDhwOwnership(
  dhw: DhwResultEnvelope,
  topology: SystemTopology,
): void {
  const isCombi = topology.appliance.family === 'combi';

  if (isCombi) {
    // ── Combi ownership rules ─────────────────────────────────────────────
    if (dhw.kind !== 'direct_combi') {
      throw new Error(
        `[dhwOwnership] combi topology requires dhw.kind === 'direct_combi'; ` +
        `got '${dhw.kind}' (sourcePath: '${dhw.sourcePath}')`,
      );
    }
    if (dhw.combiDhwV1 === undefined) {
      throw new Error(
        `[dhwOwnership] combi topology requires dhw.combiDhwV1 to be present ` +
        `(sourcePath: '${dhw.sourcePath}')`,
      );
    }
    if (dhw.storedDhwV1 !== undefined) {
      throw new Error(
        `[dhwOwnership] combi topology forbids dhw.storedDhwV1 ` +
        `(sourcePath: '${dhw.sourcePath}') — stored DHW is owned by hydronic runners`,
      );
    }
    if (dhw.mixergy !== undefined) {
      throw new Error(
        `[dhwOwnership] combi topology forbids dhw.mixergy ` +
        `(sourcePath: '${dhw.sourcePath}') — Mixergy is owned by hydronic runners`,
      );
    }
    if (dhw.mixergyLegacy !== undefined) {
      throw new Error(
        `[dhwOwnership] combi topology forbids dhw.mixergyLegacy ` +
        `(sourcePath: '${dhw.sourcePath}') — Mixergy legacy is owned by hydronic runners`,
      );
    }
  } else {
    // ── Hydronic ownership rules ──────────────────────────────────────────
    if (dhw.kind !== 'stored') {
      throw new Error(
        `[dhwOwnership] hydronic topology requires dhw.kind === 'stored'; ` +
        `got '${dhw.kind}' (sourcePath: '${dhw.sourcePath}')`,
      );
    }
    if (dhw.storedDhwV1 === undefined) {
      throw new Error(
        `[dhwOwnership] hydronic topology requires dhw.storedDhwV1 to be present ` +
        `(sourcePath: '${dhw.sourcePath}')`,
      );
    }
    if (dhw.combiDhwV1 !== undefined) {
      throw new Error(
        `[dhwOwnership] hydronic topology forbids dhw.combiDhwV1 ` +
        `(sourcePath: '${dhw.sourcePath}') — combi DHW is owned by the combi runner`,
      );
    }
    if (topology.drawOff !== undefined) {
      throw new Error(
        `[dhwOwnership] hydronic topology must have drawOff === undefined; ` +
        `drawOff.source is '${topology.drawOff.source}' (sourcePath: '${dhw.sourcePath}')`,
      );
    }
  }
}
