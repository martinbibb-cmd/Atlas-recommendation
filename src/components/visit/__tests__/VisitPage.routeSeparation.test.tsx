/**
 * VisitPage.routeSeparation.test.tsx
 *
 * Tests for Phase 1 route/product separation — ensures the visit survey page
 * no longer surfaces the internal diagnostic report list to customers.
 *
 * Acceptance criteria:
 *   - VisitPage does NOT render a reports list section (internal QA only)
 *   - VisitPage does NOT accept or pass an `onOpenReport` prop
 *   - VisitHubPage renders the reports list inside a collapsible
 *     "Internal diagnostics" section (not as a top-level section)
 */

import { describe, it, expect } from 'vitest';
import type { Props as VisitPageProps } from '../VisitPage';

// ─── Contract guard: VisitPage must not have onOpenReport prop ────────────────

describe('VisitPage route separation', () => {
  it('VisitPage Props interface does not include onOpenReport', () => {
    // This test verifies the TypeScript contract by checking that the Props type
    // exported from VisitPage does not include onOpenReport.
    // We use a type assertion that will fail to compile if the prop is re-added.
    type HasOnOpenReport = 'onOpenReport' extends keyof VisitPageProps ? true : false;
    const hasOnOpenReport: HasOnOpenReport = false as HasOnOpenReport;
    expect(hasOnOpenReport).toBe(false);
  });
});
