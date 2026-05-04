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

// Known page/card labels
const UI_LABELS = [
  'Installation specification',
  'Specify boiler location, flue route, condensate, pipework and generated install scope.',
  'Open specification',
  'Installation specification progress',
  ...STEP_LABELS,
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
