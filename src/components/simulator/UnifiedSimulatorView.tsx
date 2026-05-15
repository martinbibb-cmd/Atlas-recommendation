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
import type { ClassifiedDayEvent } from '../../logic/outcomes/types';
import type { SystemInputs } from '../../explainers/lego/simulator/systemInputsTypes';
import PrintableRecommendationPage from '../advice/PrintableRecommendationPage';
import AdvicePanel from '../advice/AdvicePanel';
import PerformanceOutcomesPanel from '../outcomes/PerformanceOutcomesPanel';
import SystemUpgradeComparisonPanel from './SystemUpgradeComparisonPanel';
import { buildResimulationFromSurvey } from '../../lib/simulator/buildResimulationFromSurvey';
import type { SimulatorSystemOverride } from '../../lib/simulator/buildResimulationFromSurvey';
import { buildCanonicalReportPayload } from '../../features/reports/adapters/buildCanonicalReportPayload';
import { saveReport } from '../../lib/reports/reportApi';
import { generateReportTitle } from '../../lib/reports/generateReportTitle';
import { buildSimulatorExpectationDelta, type SimulatorExpectationDelta } from './buildSimulatorExpectationDelta';
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
  expectationDelta?: SimulatorExpectationDelta | null;
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
type SimulatorDisplayMode = 'customer' | 'surveyor' | 'engineer';
type SummaryChipTone = 'neutral' | 'pass' | 'warn' | 'fail';

const EVENTS_SYSTEM_OPTIONS: { value: EventsSystemFamily; label: string }[] = [
  { value: 'combi',        label: 'Combi' },
  { value: 'stored_water', label: 'Boiler cylinder' },
  { value: 'mixergy',      label: 'Mixergy cylinder' },
  { value: 'heat_pump',    label: 'Heat pump cylinder' },
];

const DISPLAY_MODE_OPTIONS: { value: SimulatorDisplayMode; label: string }[] = [
  { value: 'customer', label: 'Customer view' },
  { value: 'surveyor', label: 'Surveyor view' },
  { value: 'engineer', label: 'Engineer view' },
];

const DRAW_OFF_LABELS: Record<string, string> = {
  shower: 'Shower',
  bath: 'Bath',
  kitchen_draw: 'Kitchen tap',
  tap_draw: 'Hot tap',
};

const RESULT_TONE_ORDER: Record<'successful' | 'reduced' | 'conflict', number> = {
  successful: 0,
  reduced: 1,
  conflict: 2,
};

function isMoreSevereResult(
  nextResult: 'successful' | 'reduced' | 'conflict',
  currentResult: 'successful' | 'reduced' | 'conflict',
): boolean {
  return RESULT_TONE_ORDER[nextResult] > RESULT_TONE_ORDER[currentResult];
}

function formatSystemFamilyLabel(system: EventsSystemFamily | undefined): string {
  switch (system) {
    case 'combi':
      return 'On-demand hot water';
    case 'stored_water':
      return 'Mains-fed hot water';
    case 'open_vented':
      return 'Tank-fed hot water';
    case 'mixergy':
      return 'Mixergy cylinder';
    case 'heat_pump':
      return 'Heat pump with stored hot water';
    default:
      return 'Current system';
  }
}

function formatPressureChip(bar?: number): string | null {
  if (bar == null || !Number.isFinite(bar)) return null;
  return `${bar.toFixed(1)} bar supply`;
}

function formatFlowChip(flowLpm?: number): string | null {
  if (flowLpm == null || !Number.isFinite(flowLpm)) return null;
  return `${Math.round(flowLpm * 10) / 10} L/min flow`;
}

function buildDrawOffChips(events: ClassifiedDayEvent[]) {
  const grouped = new Map<string, { count: number; result: ClassifiedDayEvent['result'] }>();

  for (const event of events) {
    if (!(event.type in DRAW_OFF_LABELS)) continue;
    const existing = grouped.get(event.type);
    if (!existing) {
      grouped.set(event.type, { count: 1, result: event.result });
      continue;
    }

    grouped.set(event.type, {
      count: existing.count + 1,
      // Keep the worst grouped outcome so each chip reflects the most constrained
      // modelled draw for that outlet type (conflict > reduced > successful).
      result: isMoreSevereResult(event.result, existing.result)
        ? event.result
        : existing.result,
    });
  }

  return Array.from(grouped.entries()).map(([type, value]) => ({
    id: type,
    label: `${DRAW_OFF_LABELS[type]} ×${value.count}`,
    tone: value.result === 'conflict'
      ? 'fail'
      : value.result === 'reduced'
        ? 'warn'
        : 'pass' as SummaryChipTone,
  }));
}

function buildRawValueEntries(systemChoice: string, systemInputs: Partial<SystemInputs>) {
  const entries: Array<{ label: string; value: string }> = [
    { label: 'System', value: formatSystemFamilyLabel(systemChoice as EventsSystemFamily) },
  ];

  const maybePush = (label: string, value: string | number | undefined) => {
    if (value == null || value === '') return;
    entries.push({ label, value: String(value) });
  };

  maybePush('Pressure', systemInputs.mainsPressureBar != null ? `${systemInputs.mainsPressureBar} bar` : undefined);
  maybePush('Flow', systemInputs.mainsFlowLpm != null ? `${systemInputs.mainsFlowLpm} L/min` : undefined);
  maybePush('Cold inlet', systemInputs.coldInletTempC != null ? `${systemInputs.coldInletTempC} °C` : undefined);
  maybePush('Cylinder', systemInputs.cylinderSizeLitres != null ? `${systemInputs.cylinderSizeLitres} L` : undefined);
  maybePush('Combi output', systemInputs.combiPowerKw != null ? `${systemInputs.combiPowerKw} kW` : undefined);
  maybePush('Heat loss', systemInputs.heatLossKw != null ? `${systemInputs.heatLossKw} kW` : undefined);
  maybePush('Boiler output', systemInputs.boilerOutputKw != null ? `${systemInputs.boilerOutputKw} kW` : undefined);
  maybePush('Primary pipe', systemInputs.primaryPipeSize);
  maybePush('Emitter type', systemInputs.emitterType);
  maybePush('Controls', systemInputs.controlStrategy);
  maybePush('Condition', systemInputs.systemCondition);

  return entries;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UnifiedSimulatorView({
  engineOutput,
  surveyData,
  floorplanOutput,
  expectationDelta,
  portalMode = false,
}: Props) {
  const surveyAdapted = useMemo(() => adaptFullSurveyToSimulatorInputs(surveyData), [surveyData]);
  const compareSeed = useMemo(() => buildCompareSeedFromSurvey(surveyData, engineOutput), [surveyData, engineOutput]);
  const floorplanOperatingAssumptions = useMemo(() => floorplanOutput ? buildFloorplanOperatingAssumptions(floorplanOutput, surveyData.heatLossWatts) : null, [floorplanOutput, surveyData]);

  // ── System selector for the events/upgrades panel ─────────────────────────
  const [eventsSystem, setEventsSystem] = useState<EventsSystemFamily | undefined>(undefined);
  const [displayMode, setDisplayMode] = useState<SimulatorDisplayMode>('customer');

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

  const setSaveStateSynced = useCallback((next: SaveState) => {
    saveStateRef.current = next;
    setSaveState(next);
  }, []);

  const persistReport = useCallback(async () => {
    if (advice == null) { setSaveStateSynced('failed'); return; }
    try {
      const engineInput = toEngineInput(surveyData);
      const recommendedOptionId =
        engineOutput.options?.find(o => o.status === 'viable')?.id ??
        engineOutput.options?.[0]?.id ?? '';
      const presentationState: RecommendationPresentationState = {
        recommendedOptionId,
        chosenByCustomer: false,
      };
      const payload = buildCanonicalReportPayload({
        surveyData,
        engineInput,
        engineOutput,
        decisionSynthesis: advice,
        presentationState,
        runMeta: { source: 'atlas_mind' },
      });
      const res = await saveReport({
        title: generateReportTitle({
          postcode: surveyData.postcode ?? null,
          recommendedSystem: engineOutput.recommendation?.primary ?? null,
        }),
        postcode: surveyData.postcode ?? null,
        payload,
      });
      setSavedReportId(res.id); setSaveStateSynced('saved');
    } catch { setSaveStateSynced('failed'); }
  }, [advice, engineOutput, setSaveStateSynced, surveyData]);

  const handleSaveReport = useCallback(() => {
    if (saveStateRef.current === 'saving') return;
    setSaveStateSynced('saving');
    persistReport();
  }, [persistReport, setSaveStateSynced]);

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

  const drawOffChips = useMemo(
    () => buildDrawOffChips(resimulationResult?.resimulation.simpleInstall.events ?? []),
    [resimulationResult],
  );

  const resultChips = useMemo(() => {
    const chips: Array<{ label: string; tone: SummaryChipTone }> = [];
    const effectivePressure = surveyAdapted.systemInputs.mainsPressureBar;
    const resolvedMainsFlowLpm = surveyAdapted.systemInputs.mainsFlowLpm ?? surveyData.mainsDynamicFlowLpm;
    const pressureChip = formatPressureChip(effectivePressure);
    const flowChip = formatFlowChip(resolvedMainsFlowLpm);

    if (pressureChip) chips.push({ label: pressureChip, tone: 'neutral' });
    if (flowChip) chips.push({ label: flowChip, tone: 'neutral' });

    if (currentSystemFlowStability != null) {
      chips.push({
        label: `Flow stability: ${currentSystemFlowStability}`,
        tone: currentSystemFlowStability === 'limited'
          ? 'fail'
          : currentSystemFlowStability === 'marginal'
            ? 'warn'
            : 'pass',
      });
    }

    const spec = resimulationResult?.resimulation.simpleInstallSpec;
    if (spec?.peakHotWaterCapacityLpm != null) {
      chips.push({
        label: `Peak hot water ${Math.round(spec.peakHotWaterCapacityLpm * 10) / 10} L/min`,
        tone: 'neutral',
      });
    }
    if (spec?.hotWaterStorageLitres != null) {
      chips.push({
        label: `${Math.round(spec.hotWaterStorageLitres)} L hot-water store`,
        tone: 'pass',
      });
    }
    if (spec?.recoveryRateLitresPerHour != null) {
      chips.push({
        label: `${Math.round(spec.recoveryRateLitresPerHour)} L/h recovery`,
        tone: 'neutral',
      });
    }

    return chips;
  }, [currentSystemFlowStability, resimulationResult, surveyAdapted.systemInputs.mainsPressureBar, surveyAdapted.systemInputs.mainsFlowLpm, surveyData.mainsDynamicFlowLpm]);

  const wrapperMessages = useMemo(() => {
    if (resimulationResult == null) {
      return [{ id: 'unavailable', tone: 'warn' as SummaryChipTone, text: 'Daily summary is unavailable until simulator inputs are ready.' }];
    }

    const messages: Array<{ id: string; tone: SummaryChipTone; text: string }> = [];
    const hotWater = resimulationResult.resimulation.simpleInstall.hotWater;

    if (hotWater.conflict > 0) {
      messages.push({
        id: 'conflict',
        tone: 'fail',
        text: `${hotWater.conflict} daily hot-water draw${hotWater.conflict === 1 ? '' : 's'} fall into conflict on the current pattern.`,
      });
    } else if (hotWater.reduced > 0) {
      messages.push({
        id: 'reduced',
        tone: 'warn',
        text: `${hotWater.reduced} draw${hotWater.reduced === 1 ? '' : 's'} are reduced at busier times, even though hot water is still delivered.`,
      });
    } else {
      messages.push({
        id: 'calm',
        tone: 'pass',
        text: 'The current daily pattern stays calm: modelled hot-water draws complete without reduction.',
      });
    }

    if (currentSystemFlowStability === 'limited' || currentSystemFlowStability === 'marginal') {
      messages.push({
        id: 'flow-stability',
        tone: currentSystemFlowStability === 'limited' ? 'fail' : 'warn',
        text: `Tank-fed supply remains ${currentSystemFlowStability}; pipework layout still matters for outlet performance.`,
      });
    }

    if (resimulationResult.resimulation.comparison.headlineImprovements.length > 0) {
      messages.push({
        id: 'improvement',
        tone: 'neutral',
        text: resimulationResult.resimulation.comparison.headlineImprovements[0],
      });
    }

    return messages;
  }, [currentSystemFlowStability, resimulationResult]);

  const assumptionChips = useMemo(() => {
    const chips: string[] = [
      `${surveyData.bathroomCount} ${surveyData.bathroomCount === 1 ? 'bathroom' : 'bathrooms'}`,
    ];

    if (surveyData.occupancyCount != null) {
      chips.push(`${surveyData.occupancyCount} ${surveyData.occupancyCount === 1 ? 'person' : 'people'}`);
    }
    if (surveyData.peakConcurrentOutlets != null) {
      chips.push(`${surveyData.peakConcurrentOutlets} peak outlet${surveyData.peakConcurrentOutlets === 1 ? '' : 's'}`);
    }
    if (surveyData.heatLossWatts != null) {
      chips.push(`${(surveyData.heatLossWatts / 1000).toFixed(1)} kW heat loss`);
    }
    if (surveyData.primaryPipeDiameter != null) {
      chips.push(`${surveyData.primaryPipeDiameter} mm primary pipe`);
    }

    return chips;
  }, [surveyData]);

  const rawValueSections = useMemo(() => ([
    {
      id: 'current',
      title: 'Current raw values',
      values: buildRawValueEntries(surveyAdapted.systemChoice, surveyAdapted.systemInputs),
    },
    {
      id: 'proposed',
      title: 'Proposed raw values',
      values: buildRawValueEntries(compareSeed.right.systemChoice, compareSeed.right.systemInputs),
    },
  ]), [compareSeed.right.systemChoice, compareSeed.right.systemInputs, surveyAdapted.systemChoice, surveyAdapted.systemInputs]);

  const activeSystemLabel = formatSystemFamilyLabel(
    eventsSystem ?? (resimulationResult?.resimulation.systemType as EventsSystemFamily | undefined),
  );
  const activeSystemChoice = (eventsSystem ?? compareSeed.right.systemChoice) as EventsSystemFamily;
  const matchedExpectationDelta = useMemo(
    () => expectationDelta ?? buildSimulatorExpectationDelta(surveyAdapted.systemChoice, activeSystemChoice, surveyData),
    [activeSystemChoice, expectationDelta, surveyAdapted.systemChoice, surveyData],
  );

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
        <section
          className="unified-simulator-view__wrapper"
          data-testid="simulator-visual-wrapper"
          aria-label="Daily hot-water summary"
        >
          <div className="unified-simulator-view__wrapper-top">
            <div>
              <p className="unified-simulator-view__eyebrow">Daily hot-water performance</p>
              <h3 className="unified-simulator-view__wrapper-title">{activeSystemLabel}</h3>
              <p className="unified-simulator-view__wrapper-copy">
                {resimulationResult?.fitSummary ?? 'Current values are loaded into the existing simulator without changing the model.'}
              </p>
            </div>
            <div className="unified-simulator-view__mode-toggle" role="tablist" aria-label="Simulator display mode">
              {DISPLAY_MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  className={`unified-simulator-view__mode-btn${displayMode === option.value ? ' unified-simulator-view__mode-btn--active' : ''}`}
                  aria-selected={displayMode === option.value}
                  onClick={() => setDisplayMode(option.value)}
                  data-testid={`simulator-display-mode-${option.value}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {matchedExpectationDelta && (
            <section
              className="unified-simulator-view__expectation-delta"
              data-testid={`simulator-expectation-delta-${matchedExpectationDelta.mode}`}
              aria-label={matchedExpectationDelta.heading}
            >
              <p className="unified-simulator-view__section-label">{matchedExpectationDelta.eyebrow}</p>
              <h4 className="unified-simulator-view__expectation-title">{matchedExpectationDelta.heading}</h4>
              <div className="unified-simulator-view__expectation-grid">
                <div className="unified-simulator-view__expectation-item">
                  <p className="unified-simulator-view__expectation-label">Current experience</p>
                  <p className="unified-simulator-view__expectation-body">{matchedExpectationDelta.currentExperience}</p>
                </div>
                <div className="unified-simulator-view__expectation-item">
                  <p className="unified-simulator-view__expectation-label">Future experience</p>
                  <p className="unified-simulator-view__expectation-body">{matchedExpectationDelta.futureExperience}</p>
                </div>
                <div className="unified-simulator-view__expectation-item">
                  <p className="unified-simulator-view__expectation-label">What changes</p>
                  <p className="unified-simulator-view__expectation-body">{matchedExpectationDelta.whatChanges}</p>
                </div>
                <div className="unified-simulator-view__expectation-item">
                  <p className="unified-simulator-view__expectation-label">What stays familiar</p>
                  <p className="unified-simulator-view__expectation-body">{matchedExpectationDelta.whatStaysFamiliar}</p>
                </div>
              </div>
              <div className="unified-simulator-view__expectation-reassurance">
                <p className="unified-simulator-view__expectation-label">Reassurance</p>
                <p className="unified-simulator-view__expectation-body">{matchedExpectationDelta.reassurance}</p>
              </div>
            </section>
          )}

          {drawOffChips.length > 0 && (
            <div className="unified-simulator-view__section">
              <span className="unified-simulator-view__section-label">Modelled draw-offs</span>
              <div className="unified-simulator-view__chips">
                {drawOffChips.map((chip) => (
                  <span
                    key={chip.id}
                    className={`unified-simulator-view__chip unified-simulator-view__chip--${chip.tone}`}
                    data-testid={`simulator-draw-off-chip-${chip.id}`}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {resultChips.length > 0 && (
            <div className="unified-simulator-view__section">
              <span className="unified-simulator-view__section-label">Pressure, flow, and recovery</span>
              <div className="unified-simulator-view__chips">
                {resultChips.map((chip) => (
                  <span
                    key={chip.label}
                    className={`unified-simulator-view__chip unified-simulator-view__chip--${chip.tone}`}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="unified-simulator-view__messages" data-testid="simulator-warning-list">
            {wrapperMessages.map((message) => (
              <div
                key={message.id}
                className={`unified-simulator-view__message unified-simulator-view__message--${message.tone}`}
                role={message.tone === 'fail' ? 'alert' : 'status'}
              >
                {message.text}
              </div>
            ))}
          </div>

          {displayMode !== 'customer' && assumptionChips.length > 0 && (
            <div className="unified-simulator-view__section" data-testid="simulator-assumptions">
              <span className="unified-simulator-view__section-label">Current assumptions</span>
              <div className="unified-simulator-view__chips">
                {assumptionChips.map((chip) => (
                  <span key={chip} className="unified-simulator-view__chip unified-simulator-view__chip--neutral">
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          )}

          {displayMode === 'engineer' && (
            <div className="unified-simulator-view__raw-values" data-testid="simulator-raw-values">
              <div className="unified-simulator-view__raw-links">
                {rawValueSections.map((section) => (
                  <a key={section.id} href={`#simulator-raw-${section.id}`} className="unified-simulator-view__raw-link">
                    {section.title}
                  </a>
                ))}
              </div>
              <div className="unified-simulator-view__raw-grid">
                {rawValueSections.map((section) => (
                  <section
                    key={section.id}
                    id={`simulator-raw-${section.id}`}
                    className="unified-simulator-view__raw-card"
                  >
                    <h4>{section.title}</h4>
                    <dl>
                      {section.values.map((entry) => (
                        <div key={`${section.id}-${entry.label}`} className="unified-simulator-view__raw-row">
                          <dt>{entry.label}</dt>
                          <dd>{entry.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>
            </div>
          )}
        </section>
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
