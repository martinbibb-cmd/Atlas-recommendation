import type { AtlasMvpContentEntryV1 } from '../content/atlasMvpContentMapRegistry';
import type { HomeProfileTile } from '../../features/insightPack/insightPack.types';

export interface PortalEvidenceCardV1 {
  id: string;
  title: string;
  plainEnglishFact: string;
  whyItMatters: string;
  linkedConceptIds: string[];
  suggestedDiagramIds: string[];
  suggestedPrintCardIds: string[];
}

export interface BuildPortalEvidenceCardsInputV1 {
  tiles: HomeProfileTile[];
  atlasMvpContentMapRegistry: AtlasMvpContentEntryV1[];
}

function toToken(value: string): string {
  return value.trim().toLowerCase();
}

function hasAnyToken(source: string, tokens: string[]): boolean {
  const normalized = toToken(source);
  return tokens.some((token) => normalized.includes(token));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function sanitizeFactText(value: string): string {
  const withoutDebugTags = value
    .replace(/\[[^\]]*debug[^\]]*\]/gi, '')
    .replace(/\bdebug\s*:/gi, '')
    .trim();
  const withoutEngineIds = withoutDebugTags
    .replace(/\b[A-Z]{2,}(?:[_-][A-Z0-9]+)+\b/g, '')
    .replace(/\b[a-z]+(?:_[a-z0-9]+)+\b/g, (token) => token.replace(/_/g, ' '));
  return withoutEngineIds.replace(/\s{2,}/g, ' ').trim();
}

function findFact(tiles: HomeProfileTile[], matchTokens: string[], fallback: string): string {
  const tile = tiles.find((entry) => hasAnyToken(entry.title, matchTokens));
  if (!tile?.finding) return fallback;
  const cleaned = sanitizeFactText(tile.finding);
  return cleaned || fallback;
}

function findMvpEntries(
  registry: AtlasMvpContentEntryV1[],
  preferredIds: string[],
): AtlasMvpContentEntryV1[] {
  const preferredSet = new Set(preferredIds);
  return registry.filter((entry) => preferredSet.has(entry.id));
}

function buildCardFromMvp(
  id: string,
  title: string,
  fact: string,
  fallbackWhyItMatters: string,
  fallbackConceptIds: string[],
  mvpEntries: AtlasMvpContentEntryV1[],
): PortalEvidenceCardV1 {
  return {
    id,
    title,
    plainEnglishFact: fact,
    whyItMatters: mvpEntries[0]?.oneLineSummary ?? fallbackWhyItMatters,
    linkedConceptIds: unique(
      mvpEntries.length > 0
        ? mvpEntries.flatMap((entry) => entry.taxonomyConceptIds)
        : fallbackConceptIds,
    ),
    suggestedDiagramIds: unique(mvpEntries.flatMap((entry) => entry.suggestedDiagramIds)),
    suggestedPrintCardIds: unique(mvpEntries.flatMap((entry) => entry.suggestedPrintCardIds)),
  };
}

function buildBathroomsFact(tiles: HomeProfileTile[]): string {
  const explicit = tiles.find((entry) => hasAnyToken(entry.title, ['bathroom', 'simultaneous']));
  if (explicit?.finding) {
    return sanitizeFactText(explicit.finding) || 'Assessed from household size and bathroom count.';
  }
  const hotWater = tiles.find((entry) => hasAnyToken(entry.title, ['hot water']));
  if (hotWater?.finding && /(bath|shower|simultaneous|overlap)/i.test(hotWater.finding)) {
    return sanitizeFactText(hotWater.finding) || 'Assessed from household size and bathroom count.';
  }
  return 'Assessed from household size and bathroom count.';
}

export function buildPortalEvidenceCards({
  tiles,
  atlasMvpContentMapRegistry,
}: BuildPortalEvidenceCardsInputV1): PortalEvidenceCardV1[] {
  const pressureEntries = findMvpEntries(atlasMvpContentMapRegistry, ['CON_C02', 'CON_D01']);
  const currentSystemEntries = findMvpEntries(atlasMvpContentMapRegistry, ['CON_A01']);
  const heatLossEntries = findMvpEntries(atlasMvpContentMapRegistry, ['CON_E03', 'CON_E01']);
  const futureEnergyEntries = findMvpEntries(atlasMvpContentMapRegistry, ['CON_J01', 'CON_J02', 'CON_G01', 'CON_C03']);

  const cards: PortalEvidenceCardV1[] = [
    buildCardFromMvp(
      'hot_water_demand',
      'Hot water demand',
      findFact(tiles, ['hot water demand'], 'Assessed from household size and bathroom count.'),
      'Hot water demand defines the system shape that can meet daily use comfortably.',
      ['pressure_vs_storage'],
      pressureEntries.slice(0, 1),
    ),
    buildCardFromMvp(
      'bathrooms_simultaneous_use',
      'Bathrooms and simultaneous use',
      buildBathroomsFact(tiles),
      'Bathroom count and overlap use determine peak draw and recovery pressure on stored hot water.',
      ['pressure_vs_storage', 'flow_restriction'],
      pressureEntries,
    ),
    buildCardFromMvp(
      'water_pressure_and_flow',
      'Water pressure and flow',
      findFact(tiles, ['water pressure and flow'], 'Measured from supply pressure and flowing demand checks.'),
      'Static pressure and dynamic flow both affect real-world outlet performance.',
      ['pressure_vs_storage', 'flow_restriction', 'hydraulic_constraint'],
      pressureEntries,
    ),
    buildCardFromMvp(
      'current_system',
      'Current system',
      findFact(tiles, ['current boiler', 'current system'], 'Current setup reviewed from survey records.'),
      'Current system architecture sets upgrade scope and what stays familiar.',
      ['sealed_system_conversion'],
      currentSystemEntries,
    ),
    buildCardFromMvp(
      'heat_loss_insulation',
      'Heat loss and insulation',
      findFact(tiles, ['heat loss', 'insulation'], 'Estimated from property fabric and floor area.'),
      'Heat-loss profile drives required output and practical control strategy.',
      ['emitter_sizing', 'hot_radiator_expectation'],
      heatLossEntries,
    ),
    buildCardFromMvp(
      'future_energy_plans',
      'Future energy plans',
      findFact(tiles, ['future energy plans'], 'Future readiness assessed from current survey context.'),
      'Future energy intentions shape controls, storage, and upgrade path choices.',
      ['STR-03', 'weather_compensation'],
      futureEnergyEntries,
    ),
  ];

  const pressureCard = cards.find((card) => card.id === 'water_pressure_and_flow');
  if (!pressureCard || pressureCard.linkedConceptIds.length === 0) {
    return [];
  }

  const cardsWithFacts = cards.filter((card) => card.plainEnglishFact.trim().length > 0);
  return cardsWithFacts.length >= 4 ? cardsWithFacts : [];
}
