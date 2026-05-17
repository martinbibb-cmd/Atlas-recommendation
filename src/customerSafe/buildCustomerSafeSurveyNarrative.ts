const EXACT_CUSTOMER_SAFE_NARRATIVES: Record<string, string> = {
  'Wall type not recorded': 'Detailed wall construction assessment was not included in this visit.',
  'Insulation level not recorded': 'Insulation performance was not fully assessed during this survey.',
  'Heat loss band not modelled': 'Detailed heat-loss band analysis was outside the current survey scope.',
  'Pipe layout not recorded': 'Pipe layout details were not fully captured during this survey.',
  'Controls not recorded': 'Heating control details were not fully captured during this survey.',
  'Thermostat type not recorded': 'Thermostat details were not fully captured during this survey.',
  'Programmer type not recorded': 'Timer and programmer details were not fully captured during this survey.',
  'SEDBUK band not recorded': 'Seasonal efficiency band details were not fully captured during this survey.',
  'Service history not recorded': 'Service history details were not included in this visit.',
  'Circuit type not recorded': 'Heating circuit details were not fully captured during this survey.',
  'Pipework access not recorded': 'Pipework access details were not fully captured during this survey.',
  'Bleed water colour not recorded': 'Water-quality evidence was not collected during this survey.',
  'Magnetic filter status not recorded': 'Magnetic filter status was not confirmed during this survey.',
  'Cleaning history not recorded': 'Cleaning history was not available during this survey.',
  'Pipework size not recorded': 'Pipework size was not measured during this survey.',
  'Water supply not recorded': 'Water-supply details were not fully captured during this survey.',
  'PV status not recorded': 'Solar-electricity details were not included in this visit.',
  'Battery status not recorded': 'Battery-storage details were not included in this visit.',
  'Magnetic filter: not recorded': 'Magnetic filter status was not confirmed during this survey.',
  'System age unknown — cannot assess remaining life expectancy.': 'System age was not confirmed during this survey, so remaining life expectancy is assessed more cautiously.',
};

const GENERIC_PATTERNS: Array<[RegExp, string]> = [
  [/\bnot modelled\b/i, 'This detail was outside the current survey scope.'],
  [/\bnot recorded\b/i, 'This detail was not captured during this survey.'],
  [/\bmissing field\b/i, 'This detail was not available in the current survey.'],
  [/\bundefined\b/i, 'This detail was not available in the current survey.'],
  [/\bunknown enum\b/i, 'This detail could not be confirmed during this survey.'],
  [/\bfallback\b/i, 'A simplified explanation is shown here while the full detail is unavailable.'],
];

export function buildCustomerSafeSurveyNarrative(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  if (trimmed in EXACT_CUSTOMER_SAFE_NARRATIVES) {
    return EXACT_CUSTOMER_SAFE_NARRATIVES[trimmed];
  }

  const ageEstimateMatch = trimmed.match(/^Age not recorded — using a condition-led service-life estimate \(~(?<years>\d+) years\)\.$/i);
  if (ageEstimateMatch?.groups?.years) {
    return `System age was not confirmed during this survey, so Atlas used condition evidence to estimate service life (~${ageEstimateMatch.groups.years} years).`;
  }

  for (const [pattern, replacement] of GENERIC_PATTERNS) {
    if (pattern.test(trimmed)) {
      return replacement;
    }
  }

  return trimmed;
}

export function containsCustomerUnsafeSurveyNarrative(text: string): boolean {
  return /\b(not modelled|not recorded|missing field|undefined|unknown enum|fallback)\b/i.test(text);
}
