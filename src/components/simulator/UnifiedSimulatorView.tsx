import { useMemo } from 'react';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { DerivedFloorplanOutput } from '../floorplan/floorplanDerivations';
import SimulatorDashboard from '../../explainers/lego/simulator/SimulatorDashboard';
import type { FloorplanOperatingAssumptions } from '../../explainers/lego/simulator/SimulatorDashboard';
import { buildCompareSeedFromSurvey } from '../../lib/simulator/buildCompareSeedFromSurvey';
import { adaptFullSurveyToSimulatorInputs } from '../../explainers/lego/simulator/adaptFullSurveyToSimulatorInputs';
import { adaptFloorplanToAtlasInputs } from '../../lib/floorplan/adaptFloorplanToAtlasInputs';
import { buildHeatingOperatingState, FLOOR_PLAN_EMITTER_EXPLANATION_TAGS } from '../../lib/heating/buildHeatingOperatingState';
import { buildAdviceFromCompare } from '../../lib/advice/buildAdviceFromCompare';
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

  return (
    <div className="unified-simulator-view" data-testid="unified-simulator-view">
      <div className="unified-simulator-view__simulator">
        <div className="unified-simulator-view__header">
          <div>
            <h2>Glass Box Simulator</h2>
            <p>Inputs → simulation → outcomes → advice. No separate recommendation page.</p>
          </div>
          <div className="unified-simulator-view__day-painter" aria-label="Day Painter placeholder">
            <span className="unified-simulator-view__day-painter-label">Day Painter</span>
            <span>24-hour lifestyle timeline placeholder for the next iteration.</span>
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
