/**
 * buildPortalJourneyPrintModel.ts
 *
 * Composes a compact print model for the open-vented → sealed + unvented portal
 * journey path.  The model sources content exclusively from the same
 * atlasMvpContentMapRegistry entries that the portal sections render, so the
 * PDF and the portal journey always stay in sync.
 *
 * Input
 * ─────
 *   selectedSectionIds   — which portal journey content IDs were shown
 *   recommendationSummary — one-sentence recommendation label (customer-safe)
 *   customerFacts         — array of plain-language facts about the home
 *   brandProfile          — optional installer / brand display details
 *
 * Output
 * ──────
 *   PortalJourneyPrintModelV1 — compact, flat model for PortalJourneyPrintPack
 *     cover summary · what changes · what stays familiar · pressure vs storage
 *     unvented safety · living with your system · next steps · QR deeper detail
 */

import { atlasMvpContentMapRegistry } from '../../content/atlasMvpContentMapRegistry';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PortalJourneyPrintCoverV1 {
  title: string;
  summary: string;
  customerFacts: string[];
  brandName?: string;
}

export interface PortalJourneyPrintSectionV1 {
  /** Internal content source ID — never rendered to the customer */
  contentId: string;
  /** Stable section key for layout mapping */
  sectionId:
    | 'what_changes'
    | 'what_stays_familiar'
    | 'pressure_vs_storage'
    | 'unvented_safety'
    | 'living_with_your_system';
  heading: string;
  summary: string;
  /** Bullet-point items for the printed card */
  items: string[];
  /** Optional diagram to render in print-safe mode */
  diagramId?: string;
}

export interface PortalJourneyPrintNextStepV1 {
  label: string;
  body: string;
}

export interface PortalJourneyPrintQrDestinationV1 {
  heading: string;
  note: string;
}

export interface PortalJourneyPrintModelV1 {
  cover: PortalJourneyPrintCoverV1;
  sections: PortalJourneyPrintSectionV1[];
  nextSteps: PortalJourneyPrintNextStepV1[];
  qrDestinations: PortalJourneyPrintQrDestinationV1[];
  pageEstimate: {
    usedPages: number;
    maxPages: number;
  };
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface BuildPortalJourneyPrintModelInputV1 {
  /** Content IDs from the portal journey sections that were rendered */
  selectedSectionIds: string[];
  /** Customer-safe one-sentence description of the recommendation */
  recommendationSummary: string;
  /** Plain-language facts about the customer's home */
  customerFacts: string[];
  /** Optional brand / installer identity */
  brandProfile?: {
    name?: string;
  };
}

// ─── Living-with-your-system static content ───────────────────────────────────

const LIVING_WITH_ITEMS = [
  'Ready hot-water reserve before morning demand.',
  'Multiple showers can overlap with steadier flow.',
  'Bath filling from a stored reserve, not live production only.',
  'Familiar heating behaviour with the same room controls.',
  'Cylinder recovers in the background — no manual step needed.',
] as const;

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * buildPortalJourneyPrintModel
 *
 * Produces a PortalJourneyPrintModelV1 for the open-vented → sealed + unvented
 * path.  All content is sourced from atlasMvpContentMapRegistry so the PDF
 * stays in sync with the portal journey sections.
 */
export function buildPortalJourneyPrintModel(
  input: BuildPortalJourneyPrintModelInputV1,
): PortalJourneyPrintModelV1 {
  const { selectedSectionIds, recommendationSummary, customerFacts, brandProfile } = input;

  const selectedSet = new Set(selectedSectionIds);

  // ── Fetch registry entries ─────────────────────────────────────────────────
  const conA01 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_A01');
  const conC01 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_C01');
  const conC02 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_C02');

  if (!conA01 || !conC01 || !conC02) {
    throw new Error(
      'buildPortalJourneyPrintModel: required content entries CON_A01, CON_C01, CON_C02 missing from registry',
    );
  }

  // ── Cover ──────────────────────────────────────────────────────────────────
  const cover: PortalJourneyPrintCoverV1 = {
    title: 'Supporting Insight — your upgrade explained',
    summary: recommendationSummary,
    customerFacts,
    brandName: brandProfile?.name,
  };

  // ── Sections ───────────────────────────────────────────────────────────────
  const sections: PortalJourneyPrintSectionV1[] = [];

  // CON_A01 — what changes / what stays familiar
  if (selectedSet.has('CON_A01') || selectedSet.size === 0) {
    sections.push({
      contentId: 'CON_A01',
      sectionId: 'what_changes',
      heading: 'What changes with this upgrade',
      summary: conA01.oneLineSummary,
      items: [
        conA01.whatYouMayNotice,
        conA01.customerWording,
        conA01.whatNotToWorryAbout,
      ],
      diagramId: conA01.suggestedDiagramIds[0],
    });

    sections.push({
      contentId: 'CON_A01',
      sectionId: 'what_stays_familiar',
      heading: 'What stays familiar',
      summary: conA01.whatStaysFamiliar,
      items: [
        conA01.whatNotToWorryAbout,
        conA01.reality,
      ],
    });
  }

  // CON_C02 — pressure vs storage
  if (selectedSet.has('CON_C02') || selectedSet.size === 0) {
    sections.push({
      contentId: 'CON_C02',
      sectionId: 'pressure_vs_storage',
      heading: 'Pressure and stored hot water',
      summary: conC02.oneLineSummary,
      items: [
        conC02.whatYouMayNotice,
        conC02.whatNotToWorryAbout,
        `${conC02.misconception} — Reality: ${conC02.reality}`,
      ],
      diagramId: conC02.suggestedDiagramIds[0],
    });
  }

  // CON_C01 — unvented safety
  if (selectedSet.has('CON_C01') || selectedSet.size === 0) {
    sections.push({
      contentId: 'CON_C01',
      sectionId: 'unvented_safety',
      heading: 'Unvented cylinder safety',
      summary: conC01.oneLineSummary,
      items: [
        conC01.customerWording,
        conC01.whatYouMayNotice,
        conC01.whatNotToWorryAbout,
      ],
      diagramId: conC01.suggestedDiagramIds[0],
    });
  }

  // Living with your system — always included
  sections.push({
    contentId: 'living_with_your_system',
    sectionId: 'living_with_your_system',
    heading: 'Living with your system',
    summary:
      'What everyday life can feel like after the upgrade — morning readiness, peak overlap, and quiet background recovery.',
    items: [...LIVING_WITH_ITEMS],
  });

  // ── Next steps ─────────────────────────────────────────────────────────────
  const nextSteps: PortalJourneyPrintNextStepV1[] = [
    {
      label: 'Your appointment',
      body: 'Your engineer will walk through each change on installation day and answer any questions before work begins.',
    },
    {
      label: 'System handover',
      body: 'At the end of installation you will receive a brief handover covering controls, pressure gauge, and the cylinder location.',
    },
    {
      label: 'Questions',
      body: 'Bring this document to your appointment or scan the QR code below to explore each topic in more detail.',
    },
  ];

  // ── QR destinations ────────────────────────────────────────────────────────
  const qrDestinations: PortalJourneyPrintQrDestinationV1[] = [
    {
      heading: 'Pressure and stored hot water — deeper detail',
      note: 'Diagram-guided walkthrough of how pressure and storage work independently.',
    },
    {
      heading: 'Sealed system conversion — step by step',
      note: 'What is removed, what replaces it, and what the new circuit looks like.',
    },
    {
      heading: 'Unvented cylinder safety devices',
      note: 'What each safety device does and when to contact your installer.',
    },
  ];

  // ── Page estimate ──────────────────────────────────────────────────────────
  // Cover (1) + one page per section + next steps + QR = estimated pages
  const usedPages = Math.min(1 + sections.length + 1, 6);

  return {
    cover,
    sections,
    nextSteps,
    qrDestinations,
    pageEstimate: {
      usedPages,
      maxPages: 6,
    },
  };
}
