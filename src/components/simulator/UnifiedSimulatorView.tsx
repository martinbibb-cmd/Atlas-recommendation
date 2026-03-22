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
import type { RecommendationPresentationState } from '../../lib/selection/optionSelection';
import AdvicePanel from '../advice/AdvicePanel';
import PerformanceOutcomesPanel from '../outcomes/PerformanceOutcomesPanel';
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
}

export default function UnifiedSimulatorView({ engineOutput, surveyData, floorplanOutput }: Props) {
  const surveyAdapted = useMemo(() => adaptFullSurveyToSimulatorInputs(surveyData), [surveyData]);
  const compareSeed = useMemo(() => buildCompareSeedFromSurvey(surveyData, engineOutput), [surveyData, engineOutput]);
  const floorplanOperatingAssumptions = useMemo(() => floorplanOutput ? buildFloorplanOperatingAssumptions(floorplanOutput, surveyData.heatLossWatts) : null, [floorplanOutput, surveyData]);
  const advice = useMemo(() => buildAdviceFromCompare({
    engineOutput,
    compareSeed,
    surveyData,
    floorplanInputs: floorplanOutput ? adaptFloorplanToAtlasInputs(floorplanOutput) : undefined,
  }), [compareSeed, engineOutput, floorplanOutput, surveyData]);

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

  const handlePrint = useCallback(() => { window.print(); }, []);

  const handleCopyPortalLink = useCallback(() => {
    if (!savedReportId) return;
    const url = `${window.location.origin}/report/${savedReportId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    }).catch(() => {});
  }, [savedReportId]);

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
        />
      </div>
      <aside className="unified-simulator-view__insights" aria-label="Simulation outcomes and advice">
        <PerformanceOutcomesPanel advice={advice} />
        <AdvicePanel advice={advice} />
      </aside>
    </div>
  );
}
