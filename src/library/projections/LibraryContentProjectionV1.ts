import type { CalmWelcomePackCardV1 } from '../packRenderer/CalmWelcomePackViewModelV1';
import type { DiagramExplanationEntry } from '../diagrams/diagramExplanationRegistry';
import type { LibraryAudienceV1 } from './LibraryAudienceV1';

export interface LibraryHiddenReasonEntryV1 {
  readonly contentId: string;
  readonly title: string;
  readonly reason: string;
}

export interface LibraryAuditTraceEntryV1 {
  readonly contentId: string;
  readonly title: string;
  readonly decision: 'visible' | 'hidden';
  readonly reason: string;
  readonly linkedConceptIds: readonly string[];
}

export interface LibraryContentProjectionV1 {
  readonly audience: LibraryAudienceV1;
  /** Unique concept IDs drawn from all visible cards. */
  readonly visibleConcepts: readonly string[];
  /** Cards visible to this audience, sourced from the welcome-pack view model and
   *  the operational digest (for non-customer audiences). */
  readonly visibleCards: readonly CalmWelcomePackCardV1[];
  /** Diagrams whose concept IDs intersect with visibleConcepts. */
  readonly visibleDiagrams: readonly DiagramExplanationEntry[];
  /** Records explaining why specific cards were suppressed for this audience. */
  readonly hiddenReasonLog: readonly LibraryHiddenReasonEntryV1[];
  /** Full decision log for every item considered — used for compliance and audit. */
  readonly auditTrace: readonly LibraryAuditTraceEntryV1[];
}
