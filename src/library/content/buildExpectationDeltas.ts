import type {
  BuildExpectationDeltasInputV1,
  ExpectationDeltaCategoryV1,
  ExpectationDeltaPerceivedSeverityV1,
  ExpectationDeltaV1,
} from './ExpectationDeltaV1';

const INSTALLER_JARGON_REPLACEMENTS: ReadonlyArray<{
  term: string;
  replacement: string;
}> = [
  { term: 'bs7593', replacement: 'installation standards' },
  { term: 'benchmark', replacement: 'installation record' },
  { term: 'inhibitor', replacement: 'water treatment' },
  { term: 'fill pressure', replacement: 'system pressure' },
  { term: 'zone valve', replacement: 'heating control part' },
  { term: 'g3', replacement: 'unvented safety qualification' },
  { term: 'mcs', replacement: 'installation certification' },
  { term: 'commissioning', replacement: 'setup checks' },
  { term: 'expansion vessel', replacement: 'pressure support vessel' },
  { term: 'primary circuit', replacement: 'heating loop' },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toCustomerSafeWording(value: string | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return '';
  }

  return INSTALLER_JARGON_REPLACEMENTS.reduce((safe, replacement) => safe.replace(
    new RegExp(`\\b${escapeRegExp(replacement.term)}\\b`, 'gi'),
    replacement.replacement,
  ), trimmed);
}

function isCombiToStored(currentSystem: string, recommendedSystem: string): boolean {
  const current = currentSystem.toLowerCase();
  const recommended = recommendedSystem.toLowerCase();
  return current.includes('combi')
    && (recommended.includes('stored') || recommended.includes('unvented') || recommended.includes('system') || recommended.includes('regular'));
}

function isOpenVentedToSealed(currentSystem: string, recommendedSystem: string): boolean {
  const current = currentSystem.toLowerCase();
  const recommended = recommendedSystem.toLowerCase();
  return (current.includes('open') || current.includes('vented') || current.includes('tank'))
    && (recommended.includes('sealed') || recommended.includes('unvented'));
}

function isHeatPumpJourney(recommendedSystem: string): boolean {
  const normalized = recommendedSystem.toLowerCase();
  return normalized.includes('heat_pump')
    || normalized.includes('heat pump')
    || normalized.includes('ashp');
}

function classifySeverity(
  category: ExpectationDeltaCategoryV1,
  currentSystem: string,
  recommendedSystem: string,
  currentExperience: string,
  futureExperience: string,
): ExpectationDeltaPerceivedSeverityV1 {
  const systemsMatch = currentSystem.trim().toLowerCase() === recommendedSystem.trim().toLowerCase();
  const experienceMatch = currentExperience.trim().toLowerCase() === futureExperience.trim().toLowerCase();

  if (systemsMatch && experienceMatch) {
    return 'none';
  }
  if (systemsMatch) {
    return 'minor';
  }
  if (category === 'hot_water' && isCombiToStored(currentSystem, recommendedSystem)) {
    return 'major';
  }
  if (category === 'radiators' && isHeatPumpJourney(recommendedSystem)) {
    return 'moderate';
  }
  if ((category === 'daily_routine' || category === 'hot_water') && isOpenVentedToSealed(currentSystem, recommendedSystem)) {
    return 'moderate';
  }
  return 'minor';
}

function fallbackAdaptationGuidance(category: ExpectationDeltaCategoryV1): string {
  if (category === 'hot_water') return 'Use normal routines first, then adjust peak overlap habits only if needed.';
  if (category === 'radiators') return 'Hold core settings steady for a full day before requesting one measured adjustment.';
  if (category === 'controls') return 'Keep daily controls simple and allow one full cycle before changing settings again.';
  if (category === 'recovery') return 'After heavier use, allow background recovery before the next high-demand period.';
  if (category === 'noise') return 'Small operating sound changes are normal; monitor pattern changes rather than single moments.';
  return 'Most households keep their normal routine and only make small timing tweaks in peak-use periods.';
}

function fallbackReassurance(category: ExpectationDeltaCategoryV1): string {
  if (category === 'hot_water') return 'Everyday hot-water use remains straightforward even when delivery style changes.';
  if (category === 'radiators') return 'The comfort target in each room stays the same.';
  if (category === 'controls') return 'Core comfort goals stay familiar even if behaviour changes slightly.';
  if (category === 'recovery') return 'Background recovery is an expected part of normal operation.';
  if (category === 'noise') return 'Normal operation sounds should remain low and predictable day to day.';
  return 'Most daily home routines stay familiar.';
}

export function buildExpectationDeltas({
  currentSystem,
  recommendedSystem,
  livingExperiencePatterns,
}: BuildExpectationDeltasInputV1): ExpectationDeltaV1[] {
  const deltas = (Object.entries(livingExperiencePatterns) as Array<[ExpectationDeltaCategoryV1, BuildExpectationDeltasInputV1['livingExperiencePatterns'][ExpectationDeltaCategoryV1]]>)
    .map<ExpectationDeltaV1 | undefined>(([category, pair]) => {
      const currentExperience = toCustomerSafeWording(
        pair?.current?.whatYouMayNotice
        ?? pair?.current?.whatStaysFamiliar
        ?? pair?.current?.whatChanges,
      );
      const futureExperience = toCustomerSafeWording(
        pair?.future?.whatYouMayNotice
        ?? pair?.future?.whatChanges
        ?? pair?.future?.whatStaysFamiliar,
      );
      if (!currentExperience || !futureExperience) {
        return undefined;
      }

      const perceivedSeverity = classifySeverity(
        category,
        currentSystem,
        recommendedSystem,
        currentExperience,
        futureExperience,
      );
      const misconceptionRisk = toCustomerSafeWording(
        pair?.future?.commonMisunderstanding
        ?? pair?.current?.commonMisunderstanding,
      );

      return {
        category,
        currentExperience,
        futureExperience,
        perceivedSeverity,
        adaptationGuidance: toCustomerSafeWording(
          pair?.future?.dailyLifeEffect
          ?? pair?.future?.whatChanges
          ?? fallbackAdaptationGuidance(category),
        ),
        reassurance: toCustomerSafeWording(
          pair?.future?.whatStaysFamiliar
          ?? pair?.future?.reassurance
          ?? pair?.current?.whatStaysFamiliar
          ?? fallbackReassurance(category),
        ),
        ...(misconceptionRisk ? { misconceptionRisk } : {}),
      };
    });

  return deltas.filter((delta): delta is ExpectationDeltaV1 => delta !== undefined);
}
