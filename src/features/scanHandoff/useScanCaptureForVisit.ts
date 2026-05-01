/**
 * useScanCaptureForVisit.ts
 *
 * React hook that retrieves the stored SessionCaptureV2 for a given visitId.
 *
 * Reads from the scan handoff store (localStorage / sessionStorage) on mount
 * and whenever the visitId changes.
 *
 * Design rules
 * ────────────
 * - Returns null when no capture has been stored for the given visit.
 * - Re-reads the store on visitId change using useMemo (synchronous storage read).
 * - No side-effects beyond reading storage.
 */

import { useMemo } from 'react';
import type { SessionCaptureV2 } from '../scanImport/contracts/sessionCaptureV2';
import { getScanCapture } from './scanHandoffStore';

/**
 * Returns the stored SessionCaptureV2 for the given visitId, or null when none
 * has been received from Atlas Scan.
 *
 * @param visitId - The visit ID to look up.  Pass null / undefined to skip.
 */
export function useScanCaptureForVisit(
  visitId: string | null | undefined,
): SessionCaptureV2 | null {
  return useMemo(() => {
    if (!visitId) return null;
    return getScanCapture(visitId);
  }, [visitId]);
}
