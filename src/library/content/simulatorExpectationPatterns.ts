import type { LivingExperiencePatternV1 } from './LivingExperiencePatternV1';

export const BOILER_BURST_PATTERN: LivingExperiencePatternV1 = {
  whatYouMayNotice: 'Radiators can feel very hot for shorter bursts.',
  whatThisMeans: 'High-temperature boiler operation often works in short on-off cycles.',
  whatStaysFamiliar: 'Your comfort target in each room remains the same.',
  whatChanges: 'Heat is delivered in peaks rather than steady low-temperature periods.',
  reassurance: 'This is a common boiler pattern and not automatically a fault.',
  commonMisunderstanding: 'Very hot radiators are always needed for comfort.',
  dailyLifeEffect: 'Rooms can swing more between heating peaks and off periods.',
  analogyOptions: [{ title: 'Boiler burst pattern', explanation: 'Short hotter bursts can still heat the home.' }],
  printSummary: 'Boiler comfort is often delivered through shorter hotter bursts.',
};
