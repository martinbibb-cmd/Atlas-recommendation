import type { PrintEquivalentV1 } from './PrintEquivalentV1';

export const printEquivalentRegistry: PrintEquivalentV1[] = [
  {
    assetId: 'WhatIfLab',
    conceptIds: ['physics_myth_busting', 'system_fit_explanation'],
    title: 'What if…? explainer lab',
    printTitle: 'What if…? Core ideas (print guide)',
    summary: 'A static guide to the same core explainers shown in the interactive lab, focused on what each visual is intended to demonstrate.',
    steps: [
      'Identify the home condition shown in the explainer card title.',
      'Read the one-line principle for why behaviour changes under that condition.',
      'Use the QR deep dive for motion detail only if more detail is needed.',
    ],
    labels: ['Myth check', 'System fit', 'Print-safe summary'],
    accessibilityNotes: 'Low-ink, text-first summary of the same explainer intent without motion.',
    qrDeepDiveLabel: 'Open the interactive explainer lab',
    sourceAnimationId: 'WhatIfLab',
  },
  {
    assetId: 'BoilerCyclingAnimation',
    conceptIds: ['boiler_cycling', 'load_matching'],
    title: 'Boiler cycling animation',
    printTitle: 'Boiler cycling (print walkthrough)',
    summary: 'Shows the same cycling concept as the animation: rapid on/off operation under low demand compared with steadier running when load is matched.',
    steps: [
      'Start at low demand: the burner reaches target quickly and cycles.',
      'Compare with matched demand: run periods are longer and steadier.',
      'Use the QR deep dive to see the animated timing pattern.',
    ],
    labels: ['Cycling risk', 'Load matching', 'Steady operation'],
    accessibilityNotes: 'Animation replaced with a numbered sequence so the concept is readable without motion.',
    qrDeepDiveLabel: 'View animated cycling pattern',
    sourceAnimationId: 'BoilerCyclingAnimation',
  },
  {
    assetId: 'FlowRestrictionAnimation',
    conceptIds: ['flow_restriction', 'pipework_constraint'],
    title: 'Flow restriction animation',
    printTitle: 'Flow restriction (print walkthrough)',
    summary: 'Explains the same constraint pathway as the animation: restrictions reduce available flow and limit delivery performance.',
    steps: [
      'Follow the pipe path from source to outlet.',
      'Mark where restriction appears and where flow falls.',
      'Use the QR deep dive to view the dynamic flow movement.',
    ],
    labels: ['Flow-limited', 'Pipework constraint', 'Hydraulic path'],
    accessibilityNotes: 'Static path-and-effect sequence preserves meaning in a print-first format.',
    qrDeepDiveLabel: 'View animated flow restriction',
    sourceAnimationId: 'FlowRestrictionAnimation',
  },
  {
    assetId: 'RadiatorUpgradeAnimation',
    conceptIds: ['emitter_sizing', 'flow_temperature'],
    title: 'Radiator upgrade animation',
    printTitle: 'Radiator upgrade and flow temperature (print walkthrough)',
    summary: 'Explains the same relationship as the animation: emitter size and flow temperature work together to deliver room heat.',
    steps: [
      'Review current emitter output at the target flow temperature.',
      'Compare with upgraded emitter output at lower flow temperature.',
      'Use the QR deep dive for animated side-by-side behaviour.',
    ],
    labels: ['Emitter sizing', 'Flow temperature', 'Heat delivery'],
    accessibilityNotes: 'Step-by-step static comparison keeps the same learning goal as the animation.',
    qrDeepDiveLabel: 'View animated radiator comparison',
    sourceAnimationId: 'RadiatorUpgradeAnimation',
  },
];

export const printEquivalentByAssetId = new Map(
  printEquivalentRegistry.map((entry) => [entry.assetId, entry]),
);
