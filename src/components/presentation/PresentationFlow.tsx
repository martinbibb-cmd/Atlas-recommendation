/**
 * PresentationFlow.tsx — Presentation Layer v1.
 *
 * Guided in-room story screen for surveyors.  Shows:
 *   1. What happens in the home
 *   2. Why (without jargon)
 *   3. What fixes it
 *   4. A clear recommended system
 *
 * Layout:
 *   [ PresentationHeader ]       — home chips + family selector
 *   [ SurveyorContextPanel ]     — surveyor context chips
 *   [ StoryCanvas ]              — timeline + cause cards + mode toggle
 *   [ RecommendationCard ]       — best-overall recommendation
 *   [ WhyNotPanel ]              — why not other options
 *   [ FuturePathway ]            — upgrade journey strip
 *   [ InterventionsList ]        — grouped upgrade actions
 *
 * Data wiring:
 *   - useSelectedFamilyData hook provides per-family timeline, events,
 *     limiterLedger for the currently selected family.
 *   - When mode = 'current': shows the currently installed family's issues.
 *   - When mode = 'proposed': shows the recommended family's improvements.
 *   - Family pills let surveyors explore any system manually.
 *
 * Build order followed: Header → StoryCanvas → RecommendationCard →
 *   ModeToggle → real-data wiring → context panel → supporting actions.
 */

import { useState, useMemo } from 'react';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { RecommendationResult } from '../../engine/recommendation/RecommendationModel';
import { runEngine } from '../../engine/Engine';
import {
  useSelectedFamilyData,
  type SelectableFamily,
} from '../family-view/useSelectedFamilyData';
import type { PresentationMode } from './presentationTypes';
import { DEFAULT_SURVEYOR_CONTEXT, type SurveyorContext } from './presentationTypes';
import PresentationHeader from './PresentationHeader';
import SurveyorContextPanel from './SurveyorContextPanel';
import StoryCanvas from './StoryCanvas';
import RecommendationCard from './RecommendationCard';
import WhyNotPanel from './WhyNotPanel';
import FuturePathway from './FuturePathway';
import InterventionsList from './InterventionsList';
import './PresentationFlow.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Maps EngineInputV2_3.currentHeatSourceType to the nearest SelectableFamily.
 * Defaults to 'combi' when no type is provided or unrecognised.
 */
function currentHeatSourceToFamily(
  heatSourceType: EngineInputV2_3['currentHeatSourceType'],
): SelectableFamily {
  switch (heatSourceType) {
    case 'combi':   return 'combi';
    case 'system':  return 'stored_water';
    case 'regular': return 'open_vented';
    case 'ashp':    return 'heat_pump';
    default:        return 'combi';
  }
}

/**
 * Maps ApplianceFamily from the recommendation result to SelectableFamily.
 */
function applianceFamilyToSelectable(family: string): SelectableFamily {
  switch (family) {
    case 'combi':       return 'combi';
    case 'system':      return 'stored_water';
    case 'heat_pump':   return 'heat_pump';
    case 'open_vented':
    case 'regular':     return 'open_vented';
    default:            return 'combi';
  }
}

/**
 * Derives a home summary chip array from the engine input.
 */
function deriveHomeSummary(input: EngineInputV2_3): string[] {
  const chips: string[] = [];
  if (input.occupancyCount != null) {
    chips.push(`${input.occupancyCount} occupant${input.occupancyCount !== 1 ? 's' : ''}`);
  }
  if (input.bathroomCount != null) {
    chips.push(`${input.bathroomCount} bathroom${input.bathroomCount !== 1 ? 's' : ''}`);
  }
  if (input.primaryPipeDiameter != null) {
    chips.push(`${input.primaryPipeDiameter}mm pipes`);
  }
  if (input.dynamicMainsPressure != null) {
    chips.push(`${input.dynamicMainsPressure} bar`);
  }
  return chips.length > 0 ? chips : ['Survey data loaded'];
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Completed engine input from the survey. */
  engineInput: EngineInputV2_3;
  /**
   * PR11 recommendation result from runEngine().
   * When omitted, PresentationFlow computes it internally from engineInput.
   */
  recommendationResult?: RecommendationResult;
  /**
   * Optional override for the home summary chips.
   * When omitted, chips are derived from engineInput.
   */
  homeSummary?: string[];
  /** Navigation callback — back to the previous screen. */
  onBack?: () => void;
  /** Optional callback to navigate to the full simulator dashboard. */
  onOpenSimulator?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PresentationFlow({
  engineInput,
  recommendationResult: recommendationResultProp,
  homeSummary,
  onBack,
  onOpenSimulator,
}: Props) {
  // ── Compute recommendation result if not provided ─────────────────────
  const engineResult = useMemo(() => runEngine(engineInput), [engineInput]);
  const recommendationResult: RecommendationResult =
    recommendationResultProp ?? engineResult.recommendationResult;
  // ── State ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<PresentationMode>('current');
  const [surveyorContext, setSurveyorContext] = useState<SurveyorContext>(DEFAULT_SURVEYOR_CONTEXT);

  // Derive the current and proposed families
  const currentFamily = useMemo(
    () => currentHeatSourceToFamily(engineInput.currentHeatSourceType),
    [engineInput.currentHeatSourceType],
  );
  const proposedFamily = useMemo(
    () =>
      recommendationResult.bestOverall?.family != null
        ? applianceFamilyToSelectable(recommendationResult.bestOverall.family)
        : currentFamily,
    [recommendationResult.bestOverall, currentFamily],
  );

  // Active family is driven by mode toggle; defaults to current/proposed respectively
  const [familyOverride, setFamilyOverride] = useState<SelectableFamily | null>(null);
  const activeFamily: SelectableFamily =
    familyOverride ?? (mode === 'current' ? currentFamily : proposedFamily);

  // Reset family override when mode changes
  function handleModeChange(newMode: PresentationMode) {
    setMode(newMode);
    setFamilyOverride(null);
  }

  function handleSelectFamily(family: SelectableFamily) {
    setFamilyOverride(family);
  }

  // ── Per-family data (from PR10 hook) ───────────────────────────────────
  const { data: familyData } = useSelectedFamilyData(engineInput, activeFamily);

  // ── Home summary chips ─────────────────────────────────────────────────
  const chips = useMemo(
    () => homeSummary ?? deriveHomeSummary(engineInput),
    [homeSummary, engineInput],
  );

  // ── Recommendation data ────────────────────────────────────────────────
  const bestOverall = recommendationResult.bestOverall;
  const interventions = recommendationResult.interventions;
  const disqualified = recommendationResult.disqualifiedCandidates;

  return (
    <div className="pres-flow">
      {/* ── Top strip ──────────────────────────────────────────────────── */}
      <PresentationHeader
        homeSummary={chips}
        selectedFamily={activeFamily}
        onSelectFamily={handleSelectFamily}
        currentFamily={currentFamily}
        recommendedFamily={proposedFamily}
      />

      {/* ── What matters in your home ─────────────────────────────────── */}
      <SurveyorContextPanel
        context={surveyorContext}
        onChange={setSurveyorContext}
      />

      {/* ── Main content area ─────────────────────────────────────────── */}
      <main className="pres-flow__main">
        {/* ── Main story canvas ─────────────────────────────────────── */}
        <div className="pres-flow__canvas-col">
          <StoryCanvas
            events={familyData.events}
            limiterLedger={familyData.limiterLedger}
            family={activeFamily}
            mode={mode}
            onModeChange={handleModeChange}
          />
        </div>

        {/* ── Recommendation + supporting actions ───────────────────── */}
        <div className="pres-flow__side-col">
          {/* Recommendation card */}
          {bestOverall != null && (
            <RecommendationCard
              bestOverall={bestOverall}
              interventions={interventions}
            />
          )}

          {bestOverall == null && (
            <div className="pres-flow__no-rec">
              <p>No recommendation available — please complete the survey.</p>
            </div>
          )}

          {/* Why not other options */}
          <WhyNotPanel disqualifiedCandidates={disqualified} />

          {/* Future upgrade pathway */}
          {bestOverall != null && (
            <FuturePathway
              bestOverall={bestOverall}
              interventions={interventions}
            />
          )}

          {/* What to improve */}
          <InterventionsList interventions={interventions} />
        </div>
      </main>

      {/* ── Footer navigation ─────────────────────────────────────────── */}
      {(onBack != null || onOpenSimulator != null) && (
        <div className="pres-flow__footer">
          {onBack != null && (
            <button className="pres-flow__back-btn" onClick={onBack}>
              ← Back
            </button>
          )}
          {onOpenSimulator != null && (
            <button className="pres-flow__simulator-btn" onClick={onOpenSimulator}>
              Full simulator →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
