/**
 * buildSystemProtectionSummary.ts
 *
 * Produces a survey-informed system protection summary for the library PDF.
 *
 * The builder reads canonical survey condition signals (sludge evidence,
 * cold spots, circulation noise, system age, filter presence, installer flush
 * strategy) and returns customer-safe copy with no technical jargon.
 *
 * Customer wording rules
 * ──────────────────────
 * Allowed:  clean, protect, water treatment, filter/protection device,
 *           survey showed signs of restricted circulation,
 *           installer will confirm method.
 * Avoid:    BS7593, inhibitor dosing, magnetite, ppm, chemical detail,
 *           guaranteed performance claims.
 *
 * Output
 * ──────
 * SystemProtectionSummaryV1
 *   title                  — section heading (customer-safe)
 *   customerSummary        — one-or-two sentence customer description
 *   whyItMatters           — brief rationale (customer-safe)
 *   whatInstallerWillCheck — what the installer will do (customer-safe)
 *   treatmentLevel         — internal classification driving copy selection
 *   customerVisibleBullets — bullet points for the PDF section
 *   engineerTrace          — internal diagnostic trace (never rendered to customer)
 */

// ─── Treatment level ──────────────────────────────────────────────────────────

export type SystemProtectionTreatmentLevel =
  | 'none_needed'
  | 'standard_protection'
  | 'clean_and_protect'
  | 'needs_engineer_review';

// ─── Input ────────────────────────────────────────────────────────────────────

/**
 * SurveySystemConditionV1
 *
 * Distilled survey signals that drive the system protection summary.
 * All fields are optional — missing fields are treated as unknown.
 * Sources: HeatingConditionDiagnosticsV1, EngineInputV2_3 condition signals,
 * and the installer-selected flush strategy from RecommendationState.
 */
export interface SurveySystemConditionV1 {
  /**
   * Colour of bleed water — primary sludge/debris indicator.
   * Source: HeatingConditionDiagnosticsV1.bleedWaterColour
   */
  bleedWaterColour?: 'clear' | 'brown' | 'black' | 'unknown';
  /**
   * Radiators cold at the bottom — debris settling in the circuit.
   * Source: HeatingConditionDiagnosticsV1.radiatorsColdAtBottom
   */
  coldSpots?: boolean;
  /**
   * Radiators heating unevenly across the circuit — restricted circulation.
   * Source: HeatingConditionDiagnosticsV1.radiatorsHeatingUnevenly
   */
  unevenHeating?: boolean;
  /**
   * Magnetic debris or sludge found in a filter cartridge.
   * Source: HeatingConditionDiagnosticsV1.magneticDebrisEvidence
   */
  magneticDebrisEvidence?: boolean;
  /**
   * Boiler cavitation, banging, or primary-circuit noise.
   * Source: HeatingConditionDiagnosticsV1.boilerCavitationOrNoise
   */
  systemNoisyOrInconsistent?: boolean;
  /**
   * System age in years.
   * Source: EngineInputV2_3.systemAgeYears
   */
  systemAgeYears?: number;
  /**
   * Whether a magnetic or inline protection filter is currently fitted.
   * Source: EngineInputV2_3.hasMagneticFilter or conditionSignals.magneticFilter
   */
  filterPresent?: boolean;
  /**
   * Water quality / hardness risk band.
   * Source: derived from waterHardnessCategory / postcode lookup
   */
  waterQualityRisk?: 'low' | 'moderate' | 'high';
  /**
   * Installer-selected flush/clean strategy from the recommendation step.
   * Source: FullSurveyModelV1.fullSurvey.recommendation.powerflush
   *
   * This field is typed as `... | null` because RecommendationState.powerflush
   * may be explicitly set to null (before selection). The `!= null` check in
   * hasSurveyData intentionally covers both undefined (field absent) and null
   * (field explicitly cleared), distinguishing them from a real selection.
   */
  installerFlushStrategy?: 'yes' | 'no' | 'chemical_only' | 'not_assessed' | null;
  /**
   * Engine-derived condition band from SystemConditionInferenceModule.
   * Source: EngineOutputV1.systemConditionFlags or NormalizerOutput.conditionBand
   */
  conditionBand?: 'good' | 'moderate' | 'poor' | 'severe';
  /**
   * Whether the circuit was recently cleaned (within the last 2–3 years).
   * Source: EngineInputV2_3.currentSystem.conditionSignals.cleaningHistory === 'recently_cleaned'
   */
  recentlyCleaned?: boolean;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface SystemProtectionSummaryV1 {
  /** Customer-facing section heading. */
  title: string;
  /** One-or-two sentence customer summary. Customer-safe language only. */
  customerSummary: string;
  /** Short rationale paragraph. Customer-safe language only. */
  whyItMatters: string;
  /** What the installer will do. Customer-safe language only. */
  whatInstallerWillCheck: string;
  /** Internal classification driving copy selection. Not rendered to customer. */
  treatmentLevel: SystemProtectionTreatmentLevel;
  /** Bullet points for the PDF section. Customer-safe language only. */
  customerVisibleBullets: string[];
  /**
   * Internal diagnostic trace for installer reference.
   * NOT rendered to the customer — engineer-facing context only.
   */
  engineerTrace: string[];
}

// ─── Treatment level derivation ───────────────────────────────────────────────

/** Returns true if any sludge / debris signal is present. */
function hasSludgeSignals(condition: SurveySystemConditionV1): boolean {
  return (
    condition.bleedWaterColour === 'brown' ||
    condition.bleedWaterColour === 'black' ||
    condition.coldSpots === true ||
    condition.magneticDebrisEvidence === true ||
    condition.unevenHeating === true ||
    condition.systemNoisyOrInconsistent === true
  );
}

/** Returns true if any survey signals were captured (i.e. survey has data). */
function hasSurveyData(condition: SurveySystemConditionV1): boolean {
  return (
    condition.bleedWaterColour !== undefined ||
    condition.coldSpots !== undefined ||
    condition.unevenHeating !== undefined ||
    condition.magneticDebrisEvidence !== undefined ||
    condition.systemNoisyOrInconsistent !== undefined ||
    condition.systemAgeYears !== undefined ||
    condition.filterPresent !== undefined ||
    condition.conditionBand !== undefined ||
    condition.installerFlushStrategy != null
  );
}

function deriveTreatmentLevel(condition: SurveySystemConditionV1): SystemProtectionTreatmentLevel {
  if (!hasSurveyData(condition)) {
    return 'needs_engineer_review';
  }

  const installerConfirmedFlush =
    condition.installerFlushStrategy === 'yes' ||
    condition.installerFlushStrategy === 'chemical_only';

  const conditionIsPoor =
    condition.conditionBand === 'poor' || condition.conditionBand === 'severe';

  const isAgedAndUncleaned =
    typeof condition.systemAgeYears === 'number' &&
    condition.systemAgeYears > 10 &&
    condition.recentlyCleaned !== true;

  if (installerConfirmedFlush || hasSludgeSignals(condition) || conditionIsPoor || isAgedAndUncleaned) {
    return 'clean_and_protect';
  }

  // Clear survey evidence with no sludge signals
  const clearBleedWater = condition.bleedWaterColour === 'clear';
  const noSludge = !hasSludgeSignals(condition);

  if (clearBleedWater && noSludge && condition.filterPresent === true) {
    return 'none_needed';
  }

  return 'standard_protection';
}

// ─── Trace builder ────────────────────────────────────────────────────────────

function buildEngineerTrace(
  condition: SurveySystemConditionV1,
  treatmentLevel: SystemProtectionTreatmentLevel,
): string[] {
  const trace: string[] = [`treatmentLevel=${treatmentLevel}`];

  if (condition.bleedWaterColour !== undefined) {
    trace.push(`bleedWaterColour=${condition.bleedWaterColour}`);
  }
  if (condition.coldSpots !== undefined) {
    trace.push(`coldSpots=${condition.coldSpots}`);
  }
  if (condition.unevenHeating !== undefined) {
    trace.push(`unevenHeating=${condition.unevenHeating}`);
  }
  if (condition.magneticDebrisEvidence !== undefined) {
    trace.push(`magneticDebrisEvidence=${condition.magneticDebrisEvidence}`);
  }
  if (condition.systemNoisyOrInconsistent !== undefined) {
    trace.push(`systemNoisyOrInconsistent=${condition.systemNoisyOrInconsistent}`);
  }
  if (condition.systemAgeYears !== undefined) {
    trace.push(`systemAgeYears=${condition.systemAgeYears}`);
  }
  if (condition.filterPresent !== undefined) {
    trace.push(`filterPresent=${condition.filterPresent}`);
  }
  if (condition.conditionBand !== undefined) {
    trace.push(`conditionBand=${condition.conditionBand}`);
  }
  if (condition.recentlyCleaned !== undefined) {
    trace.push(`recentlyCleaned=${condition.recentlyCleaned}`);
  }
  if (condition.installerFlushStrategy != null) {
    trace.push(`installerFlushStrategy=${condition.installerFlushStrategy}`);
  }
  if (condition.waterQualityRisk !== undefined) {
    trace.push(`waterQualityRisk=${condition.waterQualityRisk}`);
  }

  return trace;
}

// ─── Copy per treatment level ─────────────────────────────────────────────────

interface ProtectionCopy {
  customerSummary: string;
  whyItMatters: string;
  whatInstallerWillCheck: string;
  customerVisibleBullets: string[];
}

function buildCopyForTreatmentLevel(
  level: SystemProtectionTreatmentLevel,
  condition: SurveySystemConditionV1,
): ProtectionCopy {
  const installerConfirmedFlush =
    condition.installerFlushStrategy === 'yes' ||
    condition.installerFlushStrategy === 'chemical_only';

  switch (level) {
    case 'none_needed':
      return {
        customerSummary:
          'The survey found no signs of debris or restricted flow in the heating circuit. ' +
          'A protection device is already in place and standard commissioning checks will be completed at handover.',
        whyItMatters:
          'Carrying out commissioning checks helps the retained radiators and pipework perform correctly from day one.',
        whatInstallerWillCheck:
          'Your installer will verify the existing filter is in good order and complete the standard setup checks before handover.',
        customerVisibleBullets: [
          'No signs of restricted circulation found during the survey',
          'Filter/protection device if included in scope is confirmed at handover',
          'Standard commissioning checks will be completed at handover',
        ],
      };

    case 'standard_protection':
      return {
        customerSummary:
          'Standard protection and commissioning checks are still carried out as part of every installation.',
        whyItMatters:
          'Standard preparation helps ensure the retained radiators and pipework work correctly with the new system from day one.',
        whatInstallerWillCheck:
          'Your installer will carry out standard protection and setup checks and confirm the outcome at handover.',
        customerVisibleBullets: [
          'No significant signs of debris noted during the survey',
          'Filter/protection device if included in scope is confirmed before handover',
          'Your installer will confirm the setup checks at handover',
        ],
      };

    case 'clean_and_protect':
      if (installerConfirmedFlush) {
        return {
          customerSummary:
            'Your installer has noted that cleaning the heating circuit is part of the planned preparation. ' +
            'This helps protect the retained radiators, pipework, and new equipment when the system is updated.',
          whyItMatters:
            'Cleaning and protection before or during an upgrade helps the new equipment work at its best from the start.',
          whatInstallerWillCheck:
            'Your installer will confirm the preparation method and complete the circuit clean before or during the installation.',
          customerVisibleBullets: [
            'Circuit cleaning is part of the planned preparation',
            'Cleaning and protection are expected parts of the upgrade',
            'Filter/protection device if included in scope will be confirmed by your installer',
            'Your installer will confirm the method before work begins',
          ],
        };
      }
      return {
        customerSummary:
          'Your survey noted signs that the existing heating circuit may need cleaning and protection before or during the upgrade. ' +
          'Your installer will confirm the right preparation method so the retained radiators, pipework and boiler are protected when the system is updated.',
        whyItMatters:
          'Cleaning and protection before or during an upgrade helps the new equipment work at its best from the start.',
        whatInstallerWillCheck:
          'Your installer will assess the circuit condition and confirm the right preparation approach before work begins.',
        customerVisibleBullets: [
          'Survey showed signs of restricted circulation in the heating circuit',
          'Cleaning and protection are expected parts of the preparation',
          'Filter/protection device if included in scope will be confirmed by your installer',
          'Your installer will confirm the method before work begins',
        ],
      };

    case 'needs_engineer_review':
      return {
        customerSummary:
          'Your installer will confirm the condition of the heating circuit before final handover.',
        whyItMatters:
          'Confirming circuit condition before the upgrade helps ensure the right preparation is in place.',
        whatInstallerWillCheck:
          'Your installer will check the heating circuit and confirm the preparation approach before installation begins.',
        customerVisibleBullets: [
          'Heating circuit condition to be confirmed by your installer',
          'Filter/protection device if included in scope will be confirmed before work begins',
          'Preparation method will be agreed before work begins',
          'Your installer remains your first point of contact for questions',
        ],
      };
  }
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * buildSystemProtectionSummary
 *
 * Produces a SystemProtectionSummaryV1 from canonical survey condition signals.
 * All customer-facing copy is jargon-free per the Atlas terminology rules.
 */
export function buildSystemProtectionSummary(
  condition: SurveySystemConditionV1,
): SystemProtectionSummaryV1 {
  const treatmentLevel = deriveTreatmentLevel(condition);
  const copy = buildCopyForTreatmentLevel(treatmentLevel, condition);
  const engineerTrace = buildEngineerTrace(condition, treatmentLevel);

  return {
    title: 'Protecting the existing heating system',
    ...copy,
    treatmentLevel,
    engineerTrace,
  };
}
