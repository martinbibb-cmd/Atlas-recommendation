import { useMemo, useState, useCallback, useRef } from 'react';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import { toEngineInput } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { DerivedFloorplanOutput } from '../floorplan/floorplanDerivations';
import SimulatorDashboard from '../../explainers/lego/simulator/SimulatorDashboard';
import type { FloorplanOperatingAssumptions } from '../../explainers/lego/simulator/SimulatorDashboard';
import { buildCompareSeedFromSurvey } from '../../lib/simulator/buildCompareSeedFromSurvey';
import { adaptFullSurveyToSimulatorInputs } from '../../explainers/lego/simulator/adaptFullSurveyToSimulatorInputs';
import { adaptFloorplanToAtlasInputs } from '../../lib/floorplan/adaptFloorplanToAtlasInputs';
import { buildHeatingOperatingState, FLOOR_PLAN_EMITTER_EXPLANATION_TAGS } from '../../lib/heating/buildHeatingOperatingState';
import { buildAdviceFromCompare } from '../../lib/advice/buildAdviceFromCompare';
import { buildStoredHotWaterContextFromSurvey } from '../../lib/dhw/buildStoredHotWaterContextFromSurvey';
import { computeDrawOff } from '../../engine/modules/StoredDhwModule';
import type { DrawOffFlowStability } from '../../engine/modules/StoredDhwModule';
import type { RecommendationPresentationState } from '../../lib/selection/optionSelection';
import PrintableRecommendationPage from '../advice/PrintableRecommendationPage';
import AdvicePanel from '../advice/AdvicePanel';
import PerformanceOutcomesPanel from '../outcomes/PerformanceOutcomesPanel';
import SystemUpgradeComparisonPanel from './SystemUpgradeComparisonPanel';
import { buildResimulationFromSurvey } from '../../lib/simulator/buildResimulationFromSurvey';
import type { SimulatorSystemOverride } from '../../lib/simulator/buildResimulationFromSurvey';
import './UnifiedSimulatorView.css';

function buildFloorplanOperatingAssumptions(
  floorplanOutput: DerivedFloorplanOutput,
  heatLossWatts?: number,
): FloorplanOperatingAssumptions | null {
  const fp = adaptFloorplanToAtlasInputs(floorplanOutput);
  if (!fp.isReliable) return null;
  const adequacy = fp.wholeSystemEmitterAdequacy;
  const fpOperatingState = adequacy.hasActualData
    ? buildHeatingOperatingState({ flowTempC: 70, floorplanEmitterAdequacy: adequacy, heatLossWatts })
    : null;
  const emitterExplanationTags = fpOperatingState?.explanationTags.filter((t) => FLOOR_PLAN_EMITTER_EXPLANATION_TAGS.has(t)) ?? [];
  return {
    refinedHeatLossKw: fp.refinedHeatLossKw > 0 ? fp.refinedHeatLossKw : null,
    coverageClassification: adequacy.hasActualData ? adequacy.coverageClassification : null,
    undersizedRooms: adequacy.undersizedRooms,
    oversizedRooms: adequacy.oversizedRooms,
    operatingTempInfluenced: adequacy.hasActualData && adequacy.impliedOversizingFactor !== null && adequacy.impliedOversizingFactor !== 1.0,
    emitterExplanationTags,
  };
}

interface Props {
  engineOutput: EngineOutputV1;
  surveyData: FullSurveyModelV1;
  floorplanOutput?: DerivedFloorplanOutput;
  /**
   * When true the simulator is running in the customer portal.
   * Restricts the simulator inputs panel to the portal-safe subset and replaces
   * the direct window.print() call with a dedicated print-preview route that
   * renders PrintableRecommendationPage before triggering the browser print dialog.
   */
  portalMode?: boolean;
}

// ─── System family selector for events/upgrades panel ─────────────────────────

type EventsSystemFamily = SimulatorSystemOverride;

const EVENTS_SYSTEM_OPTIONS: { value: EventsSystemFamily; label: string }[] = [
  { value: 'combi',        label: 'Combi' },
  { value: 'stored_water', label: 'Boiler cylinder' },
  { value: 'mixergy',      label: 'Mixergy cylinder' },
  { value: 'heat_pump',    label: 'Heat pump cylinder' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function UnifiedSimulatorView({ engineOutput, surveyData, floorplanOutput, portalMode = false }: Props) {
  const surveyAdapted = useMemo(() => adaptFullSurveyToSimulatorInputs(surveyData), [surveyData]);
  const compareSeed = useMemo(() => buildCompareSeedFromSurvey(surveyData, engineOutput), [surveyData, engineOutput]);
  const floorplanOperatingAssumptions = useMemo(() => floorplanOutput ? buildFloorplanOperatingAssumptions(floorplanOutput, surveyData.heatLossWatts) : null, [floorplanOutput, surveyData]);

  // ── System selector for the events/upgrades panel ─────────────────────────
  const [eventsSystem, setEventsSystem] = useState<EventsSystemFamily | undefined>(undefined);

  const advice = useMemo(() => buildAdviceFromCompare({
    engineOutput,
    compareSeed,
    surveyData,
    floorplanInputs: floorplanOutput ? adaptFloorplanToAtlasInputs(floorplanOutput) : undefined,
    selectedSystemOverride: eventsSystem,
  }), [compareSeed, engineOutput, eventsSystem, floorplanOutput, surveyData]);

  const resimulationResult = useMemo(
    () => buildResimulationFromSurvey(surveyData, engineOutput, eventsSystem),
    [surveyData, engineOutput, eventsSystem],
  );

  // Compute flow stability for the current (survey) system so that the AdvicePanel
  // can show the pipework advisory when the system is open-vented with marginal/limited flow.
  const currentSystemFlowStability = useMemo((): DrawOffFlowStability | undefined => {
    if (surveyAdapted.systemChoice !== 'open_vented') return undefined;
    const dhwCtx = buildStoredHotWaterContextFromSurvey(surveyData);
    // computeDrawOff(systemType, mainsDynamicPressureBar, mainsDynamicFlowLpm, cwsHeadMetres)
    // For open-vented systems, only cwsHeadMetres is relevant; mains args are not used.
    const drawOff = computeDrawOff(
      'stored_vented',
      /* mainsDynamicPressureBar */ undefined,
      /* mainsDynamicFlowLpm    */ undefined,
      dhwCtx.cwsHeadMetres ?? undefined,
    );
    return drawOff.flowStability;
  }, [surveyAdapted.systemChoice, surveyData]);

  // ── Print state ────────────────────────────────────────────────────────────
  const [isPrinting, setIsPrinting] = useState(false);

  // ── Save/report state ─────────────────────────────────────────────────────
  type SaveState = 'idle' | 'saving' | 'saved' | 'failed';
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const saveStateRef = useRef<SaveState>('idle');
  saveStateRef.current = saveState;

  const persistReport = useCallback(async () => {
    if (advice == null) { setSaveState('failed'); return; }
    try {
      const engineInput = toEngineInput(surveyData);
      const recommendedOptionId =
        engineOutput.options?.find(o => o.status === 'viable')?.id ??
        engineOutput.options?.[0]?.id ?? '';
      const presentationState: RecommendationPresentationState = {
        recommendedOptionId,
        chosenByCustomer: false,
      };
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postcode: surveyData.postcode ?? null,
          payload: { surveyData, engineInput, engineOutput, decisionSynthesis: advice, presentationState },
        }),
      });
      if (!res.ok) { setSaveState('failed'); return; }
      const json = await res.json() as unknown;
      if (json != null && typeof json === 'object' && 'ok' in json && 'id' in json && (json as { ok: boolean }).ok && typeof (json as { id: unknown }).id === 'string') {
        const { id } = json as { ok: boolean; id: string };
        setSavedReportId(id); setSaveState('saved');
      } else { setSaveState('failed'); }
    } catch { setSaveState('failed'); }
  }, [advice, engineOutput, surveyData]);

  const handleSaveReport = useCallback(() => {
    if (saveStateRef.current === 'saving') return;
    setSaveState('saving');
    persistReport();
  }, [persistReport]);

  // Navigate to a dedicated print-preview component that renders
  // PrintableRecommendationPage before triggering window.print() — this ensures
  // the printable layout is fully rendered before the dialog opens, consistent
  // with the DecisionSynthesisPage print flow.
  const handlePrint = useCallback(() => {
    setIsPrinting(true);
  }, []);

  const handleCopyPortalLink = useCallback(() => {
    if (!savedReportId) return;
    const url = `${window.location.origin}/report/${savedReportId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    }).catch(() => {});
  }, [savedReportId]);

  // Build a minimal presentation state for the printable report.
  const presentationState = useMemo((): RecommendationPresentationState => {
    const recommendedOptionId =
      engineOutput.options?.find((o) => o.status === 'viable')?.id ??
      engineOutput.options?.[0]?.id ?? '';
    return { recommendedOptionId, chosenByCustomer: false };
  }, [engineOutput]);

  // Portal print view — render the print-friendly page instead of the dashboard.
  if (isPrinting) {
    return (
      <PrintableRecommendationPage
        advice={advice}
        compareSeed={compareSeed}
        onBack={() => setIsPrinting(false)}
        reportReference={savedReportId ?? undefined}
        engineOutput={engineOutput}
        presentationState={presentationState}
      />
    );
  }

  return (
    <div className="unified-simulator-view" data-testid="unified-simulator-view">
      <div className="unified-simulator-view__simulator">
        <div className="unified-simulator-view__header">
          <div>
            <h2>Glass Box Simulator</h2>
            <p>Inputs → simulation → outcomes → advice. No separate recommendation page.</p>
          </div>
          <div className="unified-simulator-view__actions" data-testid="simulator-actions">
            <button
              className="unified-simulator-view__action-btn"
              onClick={handleSaveReport}
              disabled={saveState === 'saving' || saveState === 'saved'}
              aria-label={saveState === 'failed' ? 'Retry save report' : 'Save report'}
              data-testid="save-report-btn"
            >
              {saveState === 'saving' && '⏳ Saving…'}
              {saveState === 'saved'  && '✅ Saved'}
              {saveState === 'failed' && '❌ Save failed — retry?'}
              {saveState === 'idle'   && '💾 Save report'}
            </button>
            {savedReportId && (
              <button
                className="unified-simulator-view__action-btn"
                onClick={handleCopyPortalLink}
                aria-label="Share portal link"
                data-testid="share-portal-btn"
              >
                {copyState === 'copied' ? '✅ Link copied!' : '🔗 Share portal'}
              </button>
            )}
            <button
              className="unified-simulator-view__action-btn"
              onClick={handlePrint}
              aria-label="Print report"
              data-testid="print-report-btn"
            >
              🖨 Print report
            </button>
          </div>
        </div>
        <SimulatorDashboard
          initialSystemChoice={surveyAdapted.systemChoice}
          initialSystemInputs={surveyAdapted.systemInputs}
          surveyBacked
          defaultMode="compare"
          initialProposedSystemChoice={compareSeed.right.systemChoice}
          initialProposedSystemInputs={compareSeed.right.systemInputs}
          compareLabels={{ current: 'Current system', proposed: 'Proposed system' }}
          floorplanOperatingAssumptions={floorplanOperatingAssumptions ?? undefined}
          initialCurrentFlowStability={currentSystemFlowStability}
          portalMode={portalMode}
        />
      </div>
      <aside className="unified-simulator-view__insights" aria-label="Behaviour outcomes and advice">
        {/* ── System selector for events/upgrades panel ───────────────── */}
        <div className="unified-simulator-view__system-selector" data-testid="events-system-selector">
          <span className="unified-simulator-view__system-selector-label">Show events for:</span>
          <div className="unified-simulator-view__system-selector-pills">
            {EVENTS_SYSTEM_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`unified-simulator-view__system-pill${(eventsSystem ?? resimulationResult?.resimulation.systemType) === opt.value ? ' unified-simulator-view__system-pill--active' : ''}`}
                onClick={() => setEventsSystem(opt.value)}
                aria-pressed={(eventsSystem ?? resimulationResult?.resimulation.systemType) === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {resimulationResult != null && (
          <SystemUpgradeComparisonPanel
            resimulation={resimulationResult.resimulation}
            upgradePackage={resimulationResult.upgradePackage}
            recommendedSystemLabel={resimulationResult.recommendedSystemLabel}
            fitSummary={resimulationResult.fitSummary}
          />
        )}
        <PerformanceOutcomesPanel advice={advice} />
        <AdvicePanel
          advice={advice}
          systemChoice={surveyAdapted.systemChoice}
          flowStability={currentSystemFlowStability}
        />
      </aside>
    </div>
  );
}
