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
 *   audienceProjection    — optional library audience projection; when supplied,
 *                           only sections whose contentId appears in
 *                           visibleConcepts are included in the PDF
 *
 * Output
 * ──────
 *   PortalJourneyPrintModelV1 — compact, flat model for PortalJourneyPrintPack
 *     cover summary · what changes · pressure vs storage · what stays familiar
 *     unvented safety · living with your system · next steps (+ QR deeper detail)
 */

import { atlasMvpContentMapRegistry } from '../../content/atlasMvpContentMapRegistry';
import type { LibraryContentProjectionV1 } from '../../projections/LibraryContentProjectionV1';

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
    | 'living_with_your_system'
    | 'warm_not_hot_radiators'
    | 'steady_running'
    | 'winter_behaviour';
  heading: string;
  summary: string;
  keyTakeaway: string;
  reassurance: string;
  diagramCaption?: string;
  /** Bullet-point items for the printed card */
  items: string[];
  /** Optional diagram to render in print-safe mode */
  diagramId?: string;
  /** DiagramRenderer ID to use when known for this section */
  diagramRendererId?: string;
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
  /** Journey model to build. Defaults to open_vented for backward compatibility. */
  journeyType?: 'open_vented' | 'heat_pump';
  /**
   * Optional audience projection.  When supplied, only sections whose
   * contentId appears in `audienceProjection.visibleConcepts` are included
   * in the PDF output.  Sections with static content IDs (e.g.
   * `living_with_your_system`) are always included.
   */
  audienceProjection?: LibraryContentProjectionV1;
}

// ─── Living-with-your-system static content ───────────────────────────────────

const LIVING_WITH_ITEMS = [
  'Morning showers draw from stored hot water, so the first demand feels ready.',
  'Back-to-back use is steadier because the cylinder stores a reserve.',
  'Heating controls and day-to-day habits stay familiar.',
] as const;

const HEAT_PUMP_LIVING_ITEMS = [
  'Keep settings steady for day-to-day comfort before making large manual changes.',
  'Weather and load compensation can adjust flow temperature gradually through the day.',
  'Warm radiators and steady running can be normal signs of correct operation.',
] as const;

function buildOpenVentedSectionsAndNextSteps(
  selectedSet: Set<string>,
): Pick<PortalJourneyPrintModelV1, 'sections' | 'nextSteps' | 'qrDestinations'> {
  const conA01 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_A01');
  const conC01 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_C01');
  const conC02 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_C02');

  if (!conA01 || !conC01 || !conC02) {
    throw new Error(
      'buildPortalJourneyPrintModel: required content entries CON_A01, CON_C01, CON_C02 missing from registry',
    );
  }

  const sections: PortalJourneyPrintSectionV1[] = [];
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
      diagramRendererId: 'open_vented_to_unvented',
    });
  }

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
      diagramRendererId: 'pressure_vs_storage',
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
      diagramRendererId: 'open_vented_to_unvented',
    });
  }

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

  return { sections, nextSteps, qrDestinations };
}

function buildHeatPumpSectionsAndNextSteps(
  selectedSet: Set<string>,
): Pick<PortalJourneyPrintModelV1, 'sections' | 'nextSteps' | 'qrDestinations'> {
  const conE02 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_E02');
  const conH01 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_H01');
  const conH04 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_H04');
  const conG01 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_G01');
  const conI01DayToDay = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_I01_DAY_TO_DAY');

  if (!conE02 || !conH01 || !conH04 || !conG01 || !conI01DayToDay) {
    throw new Error(
      'buildPortalJourneyPrintModel: required content entries CON_E02, CON_H01, CON_H04, CON_G01, CON_I01_DAY_TO_DAY missing from registry',
    );
  }

  const sections: PortalJourneyPrintSectionV1[] = [];

  if (selectedSet.has('CON_E02') || selectedSet.size === 0) {
    sections.push({
      contentId: 'CON_E02',
      sectionId: 'warm_not_hot_radiators',
      heading: 'Why radiators may feel warm, not hot',
      summary: conE02.oneLineSummary,
      keyTakeaway: 'Warm radiators can still deliver full comfort when the system is tuned correctly.',
      reassurance: conE02.whatNotToWorryAbout,
      items: [
        conE02.whatYouMayNotice,
        `Reality: ${conE02.reality}`,
        'Comfort is measured by room temperature, not only radiator surface feel.',
      ],
      diagramCaption: 'Warm-for-longer operation compared with shorter hotter bursts.',
      diagramId: conE02.suggestedDiagramIds[0],
      diagramRendererId: 'warm_vs_hot_radiators',
    });
  }

  if (selectedSet.has('CON_H04') || selectedSet.has('CON_G01') || selectedSet.size === 0) {
    sections.push({
      contentId: 'CON_H04',
      sectionId: 'steady_running',
      heading: 'How steady running works',
      summary: conH04.oneLineSummary,
      keyTakeaway: 'Steady low-temperature running and compensation are designed to reduce abrupt swings.',
      reassurance: conG01.whatNotToWorryAbout,
      items: [
        conH04.customerWording,
        conG01.whatYouMayNotice,
        conG01.whatStaysFamiliar,
      ],
      // No renderer-specific diagram exists for compensation curve yet.
      diagramId: conG01.suggestedDiagramIds[0],
    });
  }

  if (selectedSet.has('CON_H01') || selectedSet.size === 0) {
    sections.push({
      contentId: 'CON_H01',
      sectionId: 'winter_behaviour',
      heading: 'What happens in winter',
      summary: conH01.oneLineSummary,
      keyTakeaway: 'Short defrost cycles can be normal winter behaviour and should recover automatically.',
      reassurance: conH01.whatNotToWorryAbout,
      items: [
        conH01.whatYouMayNotice,
        `Reality: ${conH01.reality}`,
        'Brief mist around the outdoor unit can be expected in cold damp conditions.',
      ],
      diagramId: conH01.suggestedDiagramIds[0],
      diagramRendererId: 'heat_pump_defrost',
    });
  }

  sections.push({
    contentId: 'CON_I01_DAY_TO_DAY',
    sectionId: 'living_with_your_system',
    heading: 'Living with the system',
    summary: conI01DayToDay.oneLineSummary,
    keyTakeaway: 'Small, evidence-led adjustments usually work better than repeated manual overrides.',
    reassurance: conI01DayToDay.whatNotToWorryAbout,
    items: [...HEAT_PUMP_LIVING_ITEMS],
  });

  const nextSteps: PortalJourneyPrintNextStepV1[] = [
    {
      label: 'Your recommendation',
      body: 'Your installer will confirm controls, compensation setup, and expected heat-pump running pattern at handover.',
    },
    {
      label: 'First winter checks',
      body: 'Short defrost periods and warm radiators can be normal. Contact your installer if comfort does not recover.',
    },
    {
      label: 'Questions',
      body: 'Use the QR links below if you want deeper guidance on warm radiators, winter behaviour, and controls.',
    },
  ];

  const qrDestinations: PortalJourneyPrintQrDestinationV1[] = [
    {
      heading: 'Warm radiators in low-temperature systems',
      note: 'Why warm-not-hot operation can still deliver full room comfort.',
    },
    {
      heading: 'Heat pump defrost in winter',
      note: 'How normal defrost cycles look and when to ask for a review.',
    },
    {
      heading: 'Compensation and steady running',
      note: 'How weather and load compensation supports stable day-to-day comfort.',
    },
  ];

  return { sections, nextSteps, qrDestinations };
}

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
  const {
    selectedSectionIds,
    recommendationSummary,
    customerFacts,
    brandProfile,
    journeyType = 'open_vented',
    audienceProjection,
  } = input;

  const selectedSet = new Set(selectedSectionIds);

  // ── Cover ──────────────────────────────────────────────────────────────────
  const MAX_COVER_CUSTOMER_FACTS = 3;
  const cover: PortalJourneyPrintCoverV1 = {
    title: 'Your recommendation',
    summary: recommendationSummary,
    customerFacts: customerFacts.slice(0, MAX_COVER_CUSTOMER_FACTS),
    brandName: brandProfile?.name,
  };

  const { sections: rawSections, nextSteps, qrDestinations } =
    journeyType === 'heat_pump'
      ? buildHeatPumpSectionsAndNextSteps(selectedSet)
      : buildOpenVentedSectionsAndNextSteps(selectedSet);

  // When an audience projection is provided, suppress any section whose
  // contentId is not in visibleConcepts.  Static-content sections (e.g.
  // 'living_with_your_system') that do not correspond to a registry concept
  // are always retained.
  const registryConceptIdSet = new Set(atlasMvpContentMapRegistry.map((e) => e.id));
  const sections = audienceProjection != null
    ? rawSections.filter((section) => {
        if (!registryConceptIdSet.has(section.contentId)) return true;
        return audienceProjection.visibleConcepts.includes(section.contentId);
      })
    : rawSections;

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
