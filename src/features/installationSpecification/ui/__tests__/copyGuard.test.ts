/**
 * copyGuard.test.ts
 *
 * Ensures visible UI copy does not contain deprecated "planner",
 * "contractor quotes", "on site" surveyor-inappropriate terminology,
 * or banned phrases anywhere in the known UI label constants.
 */

const BANNED_TERMS = [
  'contractor quote',
  'quote planner',
  'installation planner',
  'job planner',
  'enter quote',
  'quotes you have received',
  'customer quote',
  'Add quote',
  'Quote A',
  'View Insight Pack',
  'Add at least one contractor quote',
  'add quotes for full detail',
  // Surveyor-facing "Unknown" must not appear as a normal tile label.
  'Unknown',
  // Planning-related terms must not appear in surveyor-facing copy.
  'Planner',
  'Planning',
  // Surveyor-inappropriate on-site confirmation language.
  'confirm on site',
  'Confirm on site',
  'check on site',
  'Check on site',
  'verify on site',
  'Verify on site',
  'installer to confirm',
  'Installer to confirm',
];

// Step labels in the new canonical-survey-first stepper
const STEP_LABELS_ALL = [
  'Current system',
  'Proposed heat source',
  'Proposed hot water',
  'Location change',
  'Key locations',
  'Flue specification',
  'Condensate specification',
  'Pipework specification',
  'Outdoor unit siting',
  'Hydraulic route',
  'Electrical supply',
  'Generated scope',
];

// Summary-step and action labels
const SUMMARY_LABELS = [
  'Current system from canonical survey',
  'Correct canonical survey',
  'Missing from canonical survey',
  'Add to survey',
  'Heat source',
  'Hot water',
  'Primary circuit',
];

// Known heat-source tile titles from ProposedSystemStep
const HEAT_SOURCE_TILE_TITLES = [
  'Combination boiler',
  'Regular boiler',
  'System boiler',
  'Storage combi',
  'Heat pump',
  'Warm air unit',
  'Back boiler',
  'Direct electric',
  'Other heat source',
  'None',
];

// Known hot-water tile titles from ProposedHotWaterStep
const HOT_WATER_TILE_TITLES = [
  'No cylinder',
  'Vented cylinder',
  'Unvented cylinder',
  'Thermal store',
  'Mixergy / stratified cylinder',
  'Integrated store',
  'Other arrangement',
  'Retain existing cylinder',
  'Replace with vented cylinder',
  'Replace with unvented cylinder',
  'Heat pump cylinder',
  'No stored hot water',
];

// Known page/card labels
const UI_LABELS = [
  'Installation specification',
  'Specify boiler location, flue route, condensate, pipework and generated install scope.',
  'Open specification',
  'Installation specification progress',
  'Specification path',
  'Cannot confirm — needs technical review',
  ...STEP_LABELS_ALL,
  ...SUMMARY_LABELS,
  ...HEAT_SOURCE_TILE_TITLES,
  ...HOT_WATER_TILE_TITLES,
];

describe('Installation specification copy guard', () => {
  BANNED_TERMS.forEach((banned) => {
    it(`must not contain "${banned}"`, () => {
      UI_LABELS.forEach((label) => {
        expect(label.toLowerCase()).not.toContain(banned.toLowerCase());
      });
    });
  });
});
