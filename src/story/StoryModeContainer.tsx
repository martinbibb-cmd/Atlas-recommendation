/**
 * StoryModeContainer.tsx
 *
 * Top-level Story Mode container.
 * Replaces Fast Choice when ENABLE_STORY_MODE is true.
 *
 * Flow:
 *   Step A: ScenarioSelector (tile grid)
 *   Step B: ScenarioShell   (inputs + live output)
 *
 * Shared basics (occupancyCount, bathroomCount, mainsFlowLpm, etc.) persist
 * across scenario switches and are merged into each scenario's defaults when
 * a scenario is opened.
 *
 * Escalation:
 *   When the advisor clicks "Explore Full Detail", onEscalate is called with
 *   the current partial engine input so that FullSurveyStepper can prefill.
 */
import { useState } from 'react';
import type { EngineInputV2_3 } from '../engine/schema/EngineInputV2_3';
import type { StorySharedBasics } from './scenarioRegistry';
import ScenarioSelector from './ScenarioSelector';
import ScenarioShell from './ScenarioShell';

/** Feature flag — set to false to render legacy Fast Choice instead. */
export const ENABLE_STORY_MODE = true;

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  /**
   * Called when the advisor escalates to Full Survey.
   * The caller (App.tsx) is responsible for navigating to FullSurveyStepper
   * and passing the prefill state.
   */
  onEscalate: (prefill: Partial<EngineInputV2_3>) => void;
  /**
   * Called when the advisor wants to open the current scenario in System Lab.
   * Receives the partial engine input accumulated so far so that the Lab
   * Quick Inputs gate can skip fields already known.
   */
  onOpenLab?: (partialInput?: Partial<EngineInputV2_3>) => void;
}

// ── Container ─────────────────────────────────────────────────────────────────

type StoryStep = 'select' | 'scenario';

export default function StoryModeContainer({ onBack, onEscalate, onOpenLab }: Props) {
  const [step, setStep]               = useState<StoryStep>('select');
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [sharedBasics, setSharedBasics] = useState<StorySharedBasics>({});

  function handleSelectScenario(id: string) {
    setSelectedId(id);
    setStep('scenario');
  }

  function handleSwitchScenario(id: string) {
    setSelectedId(id);
    // keep step as 'scenario' and sharedBasics intact
  }

  function handleBackToSelector() {
    setStep('select');
    setSelectedId(null);
    // sharedBasics intentionally preserved
  }

  function handleSharedBasicsChange(update: Partial<StorySharedBasics>) {
    setSharedBasics(prev => ({ ...prev, ...update }));
  }

  if (step === 'scenario' && selectedId !== null) {
    return (
      <ScenarioShell
        scenarioId={selectedId}
        sharedBasics={sharedBasics}
        onBack={handleBackToSelector}
        onSwitch={handleSwitchScenario}
        onEscalate={onEscalate}
        onOpenLab={onOpenLab}
        onSharedBasicsChange={handleSharedBasicsChange}
      />
    );
  }

  return (
    <div className="cockpit-page">
      <div className="stepper-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="step-label">Fast Choice</span>
      </div>
      <div className="fc-info-banner">
        <span className="fc-info-banner__icon">ℹ️</span>
        <div className="fc-info-banner__text">
          <p>Fast Choice is a quick first-pass recommendation.</p>
          <p>Use System Lab to compare options and see the physical reasons behind the result.</p>
        </div>
      </div>
      <ScenarioSelector onSelect={handleSelectScenario} />
    </div>
  );
}
