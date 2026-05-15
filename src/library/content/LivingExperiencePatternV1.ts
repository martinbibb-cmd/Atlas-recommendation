export interface LivingExperiencePatternAnalogyOptionV1 {
  title: string;
  explanation: string;
}

export interface LivingExperiencePatternV1 {
  whatYouMayNotice: string;
  whatThisMeans: string;
  whatStaysFamiliar?: string;
  whatChanges?: string;
  reassurance?: string;
  commonMisunderstanding?: string;
  dailyLifeEffect?: string;
  optionalTechnicalDetail?: string;
  analogyOptions: readonly LivingExperiencePatternAnalogyOptionV1[];
  printSummary: string;
}
