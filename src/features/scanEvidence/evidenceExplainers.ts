/**
 * evidenceExplainers.ts
 *
 * Maps proposal sections to customer-safe "Why this matters" text and
 * engineer-mode notes.
 *
 * Design rules:
 *   - Text is static per section; it does not re-state scan data verbatim.
 *   - Customer text is reassuring plain English — no jargon, no unsupported
 *     claims ("fits perfectly", "confirmed") unless a capture ref is resolved.
 *   - Engineer notes surface capture-point context and review reminders.
 *   - The `general` section has a ghost-appliance variant when ghost-appliance
 *     refs are present (identified by storyboardCardKey === 'ghost-appliances').
 *   - Returns null for a section when no visible refs exist for it (consistent
 *     with EvidenceProofBlock's render-nothing rule).
 */

import type { EvidenceProofLinkV1, ProposalSection } from './EvidenceProofLinkV1';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvidenceSectionExplainer {
  /** Customer-safe plain-English "Why this matters" text. */
  customerText: string;
  /** Additional context shown only in engineer / surveyor mode. */
  engineerNotes: string;
}

// ─── Static explainer text ────────────────────────────────────────────────────

const BASE_EXPLAINERS: Record<ProposalSection, EvidenceSectionExplainer> = {
  boiler: {
    customerText:
      'Your existing boiler location was captured and measured. This helps confirm the replacement can be planned around the available wall space and service access.',
    engineerNotes:
      'Boiler position confirmed via object pin. Review clearance measurements before confirming the flue route and service access.',
  },
  cylinder: {
    customerText:
      'We checked the available storage location and linked the measurements to this proposal.',
    engineerNotes:
      'Cylinder location and enclosure dimensions captured. Verify hot-water demand calculations match the available space before specifying the cylinder model.',
  },
  flue: {
    customerText:
      'The flue route and nearby clearances were captured to support planning for your installation.',
    engineerNotes:
      'Flue location and clearances captured for engineer review. Confirm terminal position meets Part J separation requirements before finalising the flue specification.',
  },
  radiators: {
    customerText:
      'Room emitter locations and wall surfaces were recorded to support the heat distribution plan for your home.',
    engineerNotes:
      'Emitter pin data and surface scan captured. Cross-reference with heat loss calculations before specifying pipework sizes and balancing requirements.',
  },
  general: {
    customerText:
      'Survey evidence from this property supports the overall recommendation. The information recorded helps plan your installation.',
    engineerNotes:
      'Cross-cutting evidence captured. Items flagged for review must be resolved before the quote is finalised.',
  },
};

/**
 * Explainer used for the `general` section when ghost-appliance refs are
 * present — this specifically covers the space-overlay fit-check scenario.
 */
const GHOST_APPLIANCE_EXPLAINER: EvidenceSectionExplainer = {
  customerText:
    'We overlaid the proposed appliance size against the captured space to support the fit check.',
  engineerNotes:
    'Ghost appliance overlay captured. Confirm physical clearances and access routes are sufficient for the proposed installation.',
};

// ─── Public accessor ──────────────────────────────────────────────────────────

/**
 * Returns the appropriate customer text and engineer notes for a proposal
 * section given the capture refs associated with it.
 *
 * @param section   - The proposal section (boiler, cylinder, flue, etc.).
 * @param links     - All proof links for this section (used to detect
 *                    ghost-appliance variants in the `general` section).
 * @param customerFacing
 *                  - When true, the caller should only show `customerText`.
 *                    When false, both `customerText` and `engineerNotes` are
 *                    available.
 * @returns The explainer object, or null if no links are provided.
 */
export function getExplainerForSection(
  section: ProposalSection,
  links: EvidenceProofLinkV1[],
  customerFacing: boolean,
): EvidenceSectionExplainer | null {
  if (links.length === 0) return null;

  // In customer mode, skip sections that have no confirmed refs
  if (customerFacing) {
    const hasConfirmed = links.some((l) =>
      l.captureRefs.some((r) => r.isResolved),
    );
    if (!hasConfirmed) return null;
  }

  // For the `general` section, prefer the ghost-appliance explainer when any
  // ghost-appliance refs are present.
  if (section === 'general') {
    const hasGhostAppliance = links.some((l) =>
      l.captureRefs.some((r) => r.storyboardCardKey === 'ghost-appliances'),
    );
    if (hasGhostAppliance) return GHOST_APPLIANCE_EXPLAINER;
  }

  return BASE_EXPLAINERS[section];
}

/**
 * Groups a flat array of proof links by their proposal section, returning
 * only sections that have at least one link.
 *
 * The returned map preserves the canonical section order:
 * boiler → cylinder → flue → radiators → general.
 */
export function groupLinksBySection(
  links: EvidenceProofLinkV1[],
): Map<ProposalSection, EvidenceProofLinkV1[]> {
  const order: ProposalSection[] = ['boiler', 'cylinder', 'flue', 'radiators', 'general'];
  const map = new Map<ProposalSection, EvidenceProofLinkV1[]>();
  for (const section of order) {
    const sectionLinks = links.filter((l) => l.section === section);
    if (sectionLinks.length > 0) {
      map.set(section, sectionLinks);
    }
  }
  return map;
}

// ─── Section heading labels ───────────────────────────────────────────────────

export const SECTION_HEADING_LABELS: Record<ProposalSection, string> = {
  boiler:    'Heat source',
  cylinder:  'Hot-water storage',
  flue:      'Flue and ventilation',
  radiators: 'Heat emitters',
  general:   'General survey',
};
