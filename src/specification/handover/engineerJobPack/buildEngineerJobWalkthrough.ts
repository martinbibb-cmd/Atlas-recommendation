import type { EngineerJobPackItemV1, EngineerJobPackV1 } from './EngineerJobPackV1';
import type { EngineerJobLocationType } from './locationResolver';
import type {
  EngineerJobWalkthroughConfidenceSummary,
  EngineerJobWalkthroughSectionV1,
  EngineerJobWalkthroughV1,
} from './EngineerJobWalkthroughV1';

export const REMOVE_CAP_REGEX = /\b(remove|cap|capping|disconnect|decommission)\b/i;

const LOFT_TYPES = new Set<EngineerJobLocationType>(['loft']);
const CYLINDER_TYPES = new Set<EngineerJobLocationType>(['cylinder_location', 'discharge_route']);
const PLANT_TYPES = new Set<EngineerJobLocationType>(['boiler_location']);
const EXTERNAL_TYPES = new Set<EngineerJobLocationType>(['external_wall', 'flue_route', 'condensate_route', 'gas_route']);
const RADIATOR_TYPES = new Set<EngineerJobLocationType>(['radiator', 'room']);

function buildConfidenceSummary(items: readonly EngineerJobPackItemV1[]): EngineerJobWalkthroughConfidenceSummary {
  let confirmed = 0;
  let inferred = 0;
  let needs_survey = 0;
  for (const item of items) {
    if (item.confidence === 'confirmed') confirmed++;
    else if (item.confidence === 'inferred') inferred++;
    else needs_survey++;
  }
  return { confirmed, inferred, needs_survey };
}

function makeSection(
  title: string,
  locationTypes: readonly EngineerJobLocationType[],
  items: readonly EngineerJobPackItemV1[],
): EngineerJobWalkthroughSectionV1 {
  return {
    title,
    locationTypes,
    items,
    mustConfirmCount: items.filter((item) => item.mustConfirmOnSite).length,
    confidenceSummary: buildConfidenceSummary(items),
  };
}

function orderItems(items: readonly EngineerJobPackItemV1[]): EngineerJobPackItemV1[] {
  return [...items].sort((a, b) => {
    const aMustConfirm = a.mustConfirmOnSite ? 0 : 1;
    const bMustConfirm = b.mustConfirmOnSite ? 0 : 1;
    if (aMustConfirm !== bMustConfirm) return aMustConfirm - bMustConfirm;
    const aRemove = REMOVE_CAP_REGEX.test(a.text) ? 0 : 1;
    const bRemove = REMOVE_CAP_REGEX.test(b.text) ? 0 : 1;
    if (aRemove !== bRemove) return aRemove - bRemove;
    if (a.text < b.text) return -1;
    if (a.text > b.text) return 1;
    return 0;
  });
}

function deduplicateItems(items: readonly EngineerJobPackItemV1[]): EngineerJobPackItemV1[] {
  const seen = new Set<string>();
  const result: EngineerJobPackItemV1[] = [];
  for (const item of items) {
    const key = `${item.text}|${item.sourceLineId ?? ''}|${item.relatedRiskId ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function buildEngineerJobWalkthrough(jobPack: EngineerJobPackV1): EngineerJobWalkthroughV1 {
  const allLocationItems = [
    ...jobPack.fitThis,
    ...jobPack.removeThis,
    ...jobPack.checkThis,
    ...jobPack.locationsAndRoutes,
    ...jobPack.doNotMiss,
    ...jobPack.locationsToConfirm,
  ];

  const loftItems: EngineerJobPackItemV1[] = [];
  const cylinderItems: EngineerJobPackItemV1[] = [];
  const plantItems: EngineerJobPackItemV1[] = [];
  const externalItems: EngineerJobPackItemV1[] = [];
  const radiatorItems: EngineerJobPackItemV1[] = [];
  const beforeStartingItems: EngineerJobPackItemV1[] = [];

  for (const item of allLocationItems) {
    const locType = item.location?.type;
    if (locType && LOFT_TYPES.has(locType)) {
      loftItems.push(item);
    } else if (locType && CYLINDER_TYPES.has(locType)) {
      cylinderItems.push(item);
    } else if (locType && PLANT_TYPES.has(locType)) {
      plantItems.push(item);
    } else if (locType && EXTERNAL_TYPES.has(locType)) {
      externalItems.push(item);
    } else if (locType && RADIATOR_TYPES.has(locType)) {
      radiatorItems.push(item);
    } else {
      beforeStartingItems.push(item);
    }
  }

  return {
    walkthroughVersion: 'v1',
    unresolvedBeforeInstall: makeSection(
      'Unresolved before install',
      [],
      orderItems(deduplicateItems(jobPack.unresolvedBeforeInstall)),
    ),
    beforeStarting: makeSection(
      'Before starting',
      ['unknown'],
      orderItems(deduplicateItems(beforeStartingItems)),
    ),
    loft: makeSection(
      'Loft',
      Array.from(LOFT_TYPES),
      orderItems(deduplicateItems(loftItems)),
    ),
    cylinderArea: makeSection(
      'Cylinder area',
      Array.from(CYLINDER_TYPES),
      orderItems(deduplicateItems(cylinderItems)),
    ),
    plantArea: makeSection(
      'Plant area',
      Array.from(PLANT_TYPES),
      orderItems(deduplicateItems(plantItems)),
    ),
    externalWorks: makeSection(
      'External works',
      Array.from(EXTERNAL_TYPES),
      orderItems(deduplicateItems(externalItems)),
    ),
    radiatorsAndRooms: makeSection(
      'Radiators and rooms',
      Array.from(RADIATOR_TYPES),
      orderItems(deduplicateItems(radiatorItems)),
    ),
    commissioning: makeSection(
      'Commissioning',
      [],
      orderItems(deduplicateItems(jobPack.commissioning)),
    ),
    customerHandover: makeSection(
      'Customer handover',
      [],
      orderItems(deduplicateItems(jobPack.discussWithCustomer)),
    ),
  };
}
