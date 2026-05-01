/**
 * src/features/visits/index.ts
 *
 * Public barrel for the visits module.
 *
 * Consumers should import from this file rather than from individual modules
 * to keep the public API stable as internals evolve.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type { AtlasVisit } from './createAtlasVisit';
export type { VisitContextValue } from './VisitProvider';

// ─── Model helpers ────────────────────────────────────────────────────────────

export { createAtlasVisit } from './createAtlasVisit';

// ─── Storage helpers ──────────────────────────────────────────────────────────

export { storeActiveVisit, retrieveActiveVisit, clearActiveVisit } from './visitStore';

// ─── React ────────────────────────────────────────────────────────────────────

export { VisitProvider, VisitContext } from './VisitProvider';
export { useActiveVisit } from './useActiveVisit';

// ─── UI ───────────────────────────────────────────────────────────────────────

export { StartVisitPanel } from './StartVisitPanel';
