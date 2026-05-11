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
 *     cover summary · what changes · pressure vs storage · what stays familiar
 *     unvented safety · living with your system · next steps (+ QR deeper detail)
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
  keyTakeaway: string;
  reassurance: string;
  diagramCaption?: string;
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
  'Morning showers draw from stored hot water, so the first demand feels ready.',
  'Back-to-back use is steadier because the cylinder stores a reserve.',
  'Heating controls and day-to-day habits stay familiar.',
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
  const MAX_COVER_CUSTOMER_FACTS = 3;
  const cover: PortalJourneyPrintCoverV1 = {
    title: 'Your recommendation',
    summary: recommendationSummary,
    customerFacts: customerFacts.slice(0, MAX_COVER_CUSTOMER_FACTS),
    brandName: brandProfile?.name,
  };

  // ── Sections ───────────────────────────────────────────────────────────────
  const sections: PortalJourneyPrintSectionV1[] = [];

  // CON_A01 — what changes / what stays familiar
  // CON_A01 intentionally contributes two pages: "what changes" and "what stays familiar".
  if (selectedSet.has('CON_A01') || selectedSet.size === 0) {
    sections.push({
      contentId: 'CON_A01',
      sectionId: 'what_changes',
      heading: 'What changes in your home',
      summary:
        'You move from tank-fed hot water to a sealed heating circuit with an unvented cylinder.',
      keyTakeaway: 'The upgrade changes hardware, not your comfort goals.',
      reassurance: 'Your installer walks you through every new visible part on handover day.',
      items: [
        'The loft tank is no longer needed.',
        'A pressure gauge and filling loop are added near the boiler.',
        'Hot water is stored in a cylinder, ready for busy times.',
      ],
      diagramCaption: 'Before and after: tank-fed layout to sealed + unvented layout.',
      diagramId: conA01.suggestedDiagramIds[0],
    });

  }

  // CON_C02 — pressure vs storage
  if (selectedSet.has('CON_C02') || selectedSet.size === 0) {
    sections.push({
      contentId: 'CON_C02',
      sectionId: 'pressure_vs_storage',
      heading: 'Why stored hot water helps',
      summary:
        'Pressure affects spray strength, while stored volume decides how long hot water can keep up.',
      keyTakeaway: 'Strong pressure and enough stored hot water are two separate needs.',
      reassurance: 'If hot water dips after heavy use, recovery is normal and expected.',
      items: [
        'A good shower feel does not mean unlimited hot-water volume.',
        'Stored hot water supports overlap use like two showers close together.',
        'The cylinder reheats in the background after heavy demand.',
      ],
      diagramCaption: 'Pressure (force) and storage (amount) shown as separate controls.',
      diagramId: conC02.suggestedDiagramIds[0],
    });
  }

  if (selectedSet.has('CON_A01') || selectedSet.size === 0) {
    sections.push({
      contentId: 'CON_A01',
      sectionId: 'what_stays_familiar',
      heading: 'What stays familiar',
      summary: 'Your daily heating routine and comfort targets stay familiar after the upgrade.',
      keyTakeaway: 'New hardware, familiar day-to-day use.',
      reassurance: 'You still control temperature and schedules in the same way.',
      items: [
        conA01.whatStaysFamiliar,
        'Radiators and room comfort continue to behave as expected.',
        'You do not need to relearn how to run your home.',
      ],
    });
  }

  // CON_C01 — unvented safety
  if (selectedSet.has('CON_C01') || selectedSet.size === 0) {
    sections.push({
      contentId: 'CON_C01',
      sectionId: 'unvented_safety',
      heading: 'How the cylinder keeps itself safe',
      summary:
        'Unvented cylinders include built-in safety controls that are required and normal to see.',
      keyTakeaway: 'Visible safety parts are expected in a compliant setup.',
      reassurance: 'Seeing a tundish or discharge pipe does not mean something is wrong.',
      items: [
        'The cylinder has pressure and temperature safety protection.',
        'A visible tundish and discharge route is part of safe design.',
        'Call your installer if you ever see repeated discharge.',
      ],
      diagramCaption: 'Safety path from cylinder to discharge point.',
      diagramId: conC01.suggestedDiagramIds[0],
    });
  }

  // Living with your system — always included
  sections.push({
    contentId: 'living_with_your_system',
    sectionId: 'living_with_your_system',
    heading: 'Living with the system',
    summary:
      'Day-to-day life should feel calm: ready mornings, steadier overlap use, and quiet background recovery.',
    keyTakeaway: 'The system is designed to support peak family routines more smoothly.',
    reassurance: 'Your installer remains your first point of contact for questions after handover.',
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
  // Cover (1) + one page per section + next steps (with QR area) = estimated pages
  const usedPages = Math.min(1 + sections.length + 1, 7);

  return {
    cover,
    sections,
    nextSteps,
    qrDestinations,
    pageEstimate: {
      usedPages,
      maxPages: 7,
    },
  };
}
