/**
 * ExplainersHubPage — entry point for the lab simulator.
 *
 * PR6:  Added SimulatorStepper setup journey before the simulator dashboard.
 * PR16: Added survey-backed entry — when surveyData is provided, the stepper
 *       is skipped and the simulator opens pre-configured from survey inputs.
 *       An "Edit setup" button lets users re-enter the stepper at any time.
 */

import { useState, useMemo } from 'react';
import SimulatorDashboard from './lego/simulator/SimulatorDashboard';
import SimulatorStepper from './lego/simulator/SimulatorStepper';
import type { StepperConfig } from './lego/simulator/SimulatorStepper';
import { adaptFullSurveyToSimulatorInputs } from './lego/simulator/adaptFullSurveyToSimulatorInputs';
import type { FullSurveyModelV1 } from '../ui/fullSurvey/FullSurveyModelV1';
import type { EngineInputV2_3 } from '../engine/schema/EngineInputV2_3';
import ExplainerPanel from './educational/ExplainerPanel';
import { runEngine } from '../engine/Engine';
import DecisionSynthesisPage from '../components/advice/DecisionSynthesisPage';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onBack?: () => void;
  /**
   * Engine input used to pre-configure the simulator.  Accepts either a
   * completed EngineInputV2_3 (e.g. from the Full Survey or Fast Choice) or
   * a full FullSurveyModelV1 that includes extended survey diagnostics.
   * When provided, the stepper is hidden by default; users can still access
   * it via "Edit setup".
   */
  surveyData?: EngineInputV2_3 | FullSurveyModelV1;
  /**
   * When provided, a secondary "System Lab" action is shown in the dashboard
   * header so users can navigate to the compare/sandbox area.
   */
  onOpenSystemLab?: () => void;
}

// ─── View ─────────────────────────────────────────────────────────────────────

export default function ExplainersHubPage({ onBack, surveyData, onOpenSystemLab }: Props) {
  const [config, setConfig] = useState<StepperConfig | null>(null);
  // When launched from a survey, hide the stepper by default.
  const [showStepper, setShowStepper] = useState<boolean>(!surveyData);
  // Advice page — only available when survey-backed (engine output derivable).
  const [showAdvice, setShowAdvice] = useState<boolean>(false);

  // Adapt survey data once when present.
  // The adapter accepts FullSurveyModelV1; EngineInputV2_3 satisfies it because
  // FullSurveyModelV1 = EngineInputV2_3 & { optionalExtras? } — missing extras
  // are handled gracefully by the adapter's optional-chaining guards.
  const surveyAdapted = useMemo(
    () => (surveyData != null ? adaptFullSurveyToSimulatorInputs(surveyData as FullSurveyModelV1) : null),
    [surveyData],
  );

  // Run the engine once from survey data to power the advice page.
  // Only computed when surveyData is present; the advice CTA is hidden otherwise.
  const engineOutput = useMemo(
    () => (surveyData != null ? runEngine(surveyData as EngineInputV2_3).engineOutput : null),
    [surveyData],
  );

  // Show dashboard when:
  //   (a) survey-backed entry (surveyAdapted present and stepper not explicitly requested), or
  //   (b) stepper has completed and config is set.
  const showDashboard = !showStepper && (surveyAdapted != null || config != null);

  if (showDashboard) {
    const isSurveyBacked = surveyAdapted != null && !config;
    const initialSystemChoice = surveyAdapted != null && isSurveyBacked
      ? surveyAdapted.systemChoice
      : (config?.systemChoice ?? 'combi');
    const initialSystemInputs = surveyAdapted != null && isSurveyBacked
      ? surveyAdapted.systemInputs
      : undefined;

    // Advice page — shown when user taps "View Decision Advice"
    if (showAdvice && engineOutput) {
      return (
        <DecisionSynthesisPage
          engineOutput={engineOutput}
          onBack={() => setShowAdvice(false)}
        />
      );
    }

    return (
      <div className="hub-page">
        <div className="hub-page__header">
          {onBack && (
            <button className="hub-back-btn" onClick={onBack}>← Back</button>
          )}
          {isSurveyBacked ? (
            <button
              className="hub-back-btn"
              onClick={() => setShowStepper(true)}
              aria-label="Edit simulator setup"
            >
              ⚙ Edit setup
            </button>
          ) : (
            <button
              className="hub-back-btn"
              onClick={() => { setConfig(null); setShowStepper(true); }}
              aria-label="Home"
            >
              ⚙ Home
            </button>
          )}
          {onOpenSystemLab && (
            <button
              className="hub-back-btn"
              onClick={onOpenSystemLab}
              aria-label="Open System Lab"
            >
              🔭 System Lab
            </button>
          )}
          {engineOutput && (
            <button
              className="hub-back-btn"
              onClick={() => setShowAdvice(true)}
              aria-label="View decision advice"
            >
              🎯 Decision Advice
            </button>
          )}
          <div>
            <h1 className="hub-page__title">Simulator Dashboard</h1>
            <p className="hub-page__subtitle">Physics-first heating system simulator</p>
          </div>
        </div>

        <SimulatorDashboard
          initialSystemChoice={initialSystemChoice}
          initialSystemInputs={initialSystemInputs}
          surveyBacked={isSurveyBacked}
        />

        {/* Decision Advice CTA — only available when survey-backed */}
        {engineOutput && (
          <div className="hub-advice-cta">
            <div className="hub-advice-cta__inner">
              <div className="hub-advice-cta__icon" aria-hidden="true">🎯</div>
              <div className="hub-advice-cta__content">
                <div className="hub-advice-cta__title">Decision Advice</div>
                <div className="hub-advice-cta__subtitle">
                  Atlas advises — not just simulates. See the recommended path by objective.
                </div>
              </div>
              <button
                className="hub-advice-cta__btn"
                onClick={() => setShowAdvice(true)}
                aria-label="View decision advice page"
              >
                View Advice →
              </button>
            </div>
          </div>
        )}

        <ExplainerPanel />
      </div>
    );
  }

  // Show stepper (either standalone entry or "Edit setup" from survey-backed mode).
  return (
    <div className="hub-page">
      <div className="hub-page__header">
        {onBack && (
          <button className="hub-back-btn" onClick={onBack}>← Back</button>
        )}
        {surveyAdapted != null && (
          <button
            className="hub-back-btn"
            onClick={() => setShowStepper(false)}
            aria-label="Back to simulator"
          >
            ← Back to simulator
          </button>
        )}
        <div>
          <h1 className="hub-page__title">Simulator Dashboard</h1>
          <p className="hub-page__subtitle">Physics-first heating system simulator</p>
        </div>
      </div>

      <SimulatorStepper
        onComplete={(cfg) => {
          setConfig(cfg);
          setShowStepper(false);
        }}
      />
    </div>
  );
}
