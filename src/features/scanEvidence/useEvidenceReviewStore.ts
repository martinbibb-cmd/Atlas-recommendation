/**
 * useEvidenceReviewStore.ts
 *
 * React hook for persisting engineer review decisions for scan evidence items.
 *
 * Storage strategy:
 *   - Decisions are stored in localStorage under 'atlas:evidence-review:v1'.
 *   - Each visitId gets its own namespace inside the store so decisions are
 *     scoped to the job (not the device session).
 *   - Uses localStorage (not sessionStorage) so decisions survive tab close and
 *     are available across browser sessions, matching the scanCaptures strategy.
 *
 * Design rules:
 *   - Pure React hook — no engine calls, no mutations to SessionCaptureV2.
 *   - setDecision is idempotent; calling it again with the same arguments
 *     updates decidedAt and engineerNote.
 *   - clearDecision removes a decision, reverting the item to "unreviewed".
 *   - Storage failures are swallowed silently (quota exceeded, private browsing).
 */

import { useCallback, useState } from 'react';
import type {
  EvidenceItemKind,
  EvidenceReviewDecisionV1,
  EvidenceReviewMap,
  EvidenceReviewStatus,
} from './EvidenceReviewDecisionV1';

export type { EvidenceReviewDecisionV1, EvidenceReviewMap, EvidenceReviewStatus };

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'atlas:evidence-review:v1' as const;

interface ReviewStore {
  schemaVersion: 1;
  reviewsByVisitId: Record<string, EvidenceReviewMap>;
}

function readStore(): ReviewStore {
  try {
    const raw = typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY)
      : null;
    if (!raw) return { schemaVersion: 1, reviewsByVisitId: {} };
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      return { schemaVersion: 1, reviewsByVisitId: {} };
    }
    const store = parsed as Partial<ReviewStore>;
    return {
      schemaVersion: 1,
      reviewsByVisitId:
        (store.reviewsByVisitId as Record<string, EvidenceReviewMap>) ?? {},
    };
  } catch {
    return { schemaVersion: 1, reviewsByVisitId: {} };
  }
}

function writeStore(store: ReviewStore): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    }
  } catch {
    // Storage quota exceeded or unavailable — silently ignore.
  }
}

// ─── Hook interface ───────────────────────────────────────────────────────────

export interface UseEvidenceReviewStoreResult {
  /** All current review decisions for this visit, keyed by itemId. */
  decisions: EvidenceReviewMap;
  /**
   * Set (or update) a review decision for an evidence item.
   * Calling this with the same itemId overwrites the previous decision.
   */
  setDecision(
    itemId: string,
    kind: EvidenceItemKind,
    status: EvidenceReviewStatus,
    engineerNote?: string,
  ): void;
  /** Get the current decision for an item, or undefined if not yet reviewed. */
  getDecision(itemId: string): EvidenceReviewDecisionV1 | undefined;
  /**
   * Clear the review decision for an item.
   * Reverts the item to unreviewed (no decision badge).
   */
  clearDecision(itemId: string): void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useEvidenceReviewStore — manages engineer review decisions for a visit.
 *
 * @param visitId — The visit whose review decisions are managed.
 *
 * Usage:
 *   const { decisions, setDecision, getDecision } = useEvidenceReviewStore(visitId);
 *   setDecision('pin-001', 'object_pin', 'confirmed', 'Verified on site');
 */
export function useEvidenceReviewStore(
  visitId: string,
): UseEvidenceReviewStoreResult {
  const [decisions, setDecisionsState] = useState<EvidenceReviewMap>(() => {
    const store = readStore();
    return store.reviewsByVisitId[visitId] ?? {};
  });

  const setDecision = useCallback(
    (
      itemId: string,
      kind: EvidenceItemKind,
      status: EvidenceReviewStatus,
      engineerNote?: string,
    ) => {
      const decision: EvidenceReviewDecisionV1 = {
        itemId,
        kind,
        status,
        engineerNote: engineerNote?.trim() || undefined,
        decidedAt: new Date().toISOString(),
      };
      setDecisionsState((prev) => {
        const next = { ...prev, [itemId]: decision };
        const store = readStore();
        store.reviewsByVisitId[visitId] = next;
        writeStore(store);
        return next;
      });
    },
    [visitId],
  );

  const clearDecision = useCallback(
    (itemId: string) => {
      setDecisionsState((prev) => {
        const next = { ...prev };
        delete next[itemId];
        const store = readStore();
        store.reviewsByVisitId[visitId] = next;
        writeStore(store);
        return next;
      });
    },
    [visitId],
  );

  const getDecision = useCallback(
    (itemId: string): EvidenceReviewDecisionV1 | undefined => decisions[itemId],
    [decisions],
  );

  return { decisions, setDecision, getDecision, clearDecision };
}
