/**
 * copyGuard.test.ts
 *
 * Ensures visible UI copy does not contain deprecated "planner",
 * "contractor quotes", or "on site" surveyor-inappropriate terminology
 * anywhere in the known UI label constants.
 * Fails if any of the banned strings are found in the known UI label constants.
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
  // Surveyor-facing Unknown must not appear as a normal tile label.
  'Unknown',
  // Planning-related terms must not appear in surveyor-facing copy.
  'Planner',
  'Planning',
  // Surveyor-inappropriate on-site confirmation language.
  'confirm on site',
  'Confirm on site',
  'check on site',
  'Check on site',
  'installer to confirm',
  'Installer to confirm',
];

// Known step labels from InstallationSpecificationStepper — full step list
const STEP_LABELS_ALL = [
  'Current system',
  'Current heat source',
  'Current hot water',
  'Primary circuit',
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

// Known existence tile titles from CurrentSystemStep
const EXISTENCE_TILE_TITLES = [
  'Existing wet heating system',
  'No existing wet heating system',
  'Partial or abandoned system',
];

// Known heat-source tile titles from CurrentHeatSourceStep and ProposedSystemStep
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

// Known hot-water tile titles from CurrentHotWaterStep and ProposedHotWaterStep
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

// Known primary-circuit tile titles from CurrentPrimaryCircuitStep
const PRIMARY_CIRCUIT_TILE_TITLES = [
  'Open vented primary',
  'Sealed primary',
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
  ...EXISTENCE_TILE_TITLES,
  ...HEAT_SOURCE_TILE_TITLES,
  ...HOT_WATER_TILE_TITLES,
  ...PRIMARY_CIRCUIT_TILE_TITLES,
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
