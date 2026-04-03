/**
 * atlasTourSteps.ts
 *
 * Step definitions for the Atlas first-run guided tour.
 *
 * Steps are split into two phases that map to the two surfaces where the tour
 * is mounted:
 *
 *   LANDING_TOUR_STEPS  – landing page (mode choice cards, survey panel)
 *   LAB_TOUR_STEPS      – System Lab (tabs, what-if, visual, export)
 *
 * Each step targets an element via a stable `data-tour` attribute rather than
 * a class name so refactoring styles never silently breaks the tour.
 */

import type { Step } from 'react-joyride';

export const LANDING_TOUR_STEPS: Step[] = [
  {
    target: '[data-tour="mode-choice"]',
    title: 'Start here',
    content:
      'Choose Fast Choice for a quick recommendation, or Full Survey for a more complete picture.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="survey-panel"]',
    title: 'Enter key details',
    content: 'We use these answers to model system behaviour and compare options.',
  },
];

export const LAB_TOUR_STEPS: Step[] = [
  {
    target: '[data-tour="system-lab-tabs"]',
    title: 'Explore the result',
    content: 'Switch between summary, what-if scenarios, and the visual view.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="what-if-tab"]',
    title: 'Test changes',
    content: 'See how upgrades or constraints change the recommendation.',
  },
  {
    target: '[data-tour="visual-tab"]',
    title: 'See behaviour',
    content: 'Visual mode helps explain how heat, flow, and on-demand hot water behave.',
  },
  {
    target: '[data-tour="export-actions"]',
    title: 'Share the output',
    content: 'Create customer-friendly or technical outputs from the current result.',
  },
];
