/**
 * copyGuard.test.ts
 *
 * Ensures visible UI copy does not contain deprecated "planner" or
 * "contractor quotes" terminology anywhere in the known UI label constants.
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
];

// Known visible step labels from InstallationSpecificationStepper
const STEP_LABELS = [
  'Current system',
  'Proposed system',
  'Location change',
  'Key locations',
  'Flue specification',
  'Condensate specification',
  'Pipework specification',
  'Generated scope',
];

// Known system tile titles from CurrentSystemStep and ProposedSystemStep
const SYSTEM_TILE_TITLES = [
  'Combination boiler',
  'System boiler + cylinder',
  'Regular / open vent',
  'Storage combi',
  'Thermal store',
  'Heat pump',
  'Warm air',
];

// Known page/card labels
const UI_LABELS = [
  'Installation specification',
  'Specify boiler location, flue route, condensate, pipework and generated install scope.',
  'Open specification',
  'Installation specification progress',
  'Specification path',
  'Cannot confirm — needs technical review',
  ...STEP_LABELS,
  ...SYSTEM_TILE_TITLES,
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
