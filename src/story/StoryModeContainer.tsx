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
 * Escalation:
 *   When the advisor clicks "Explore Full Detail", onEscalate is called with
 *   the current partial engine input so that FullSurveyStepper can prefill.
 */
import { useState } from 'react';
import type { EngineInputV2_3 } from '../engine/schema/EngineInputV2_3';
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
}

// ── Container ─────────────────────────────────────────────────────────────────

type StoryStep = 'select' | 'scenario';

export default function StoryModeContainer({ onBack, onEscalate }: Props) {
  const [step, setStep]               = useState<StoryStep>('select');
  const [selectedId, setSelectedId]   = useState<string | null>(null);

  function handleSelectScenario(id: string) {
    setSelectedId(id);
    setStep('scenario');
  }

  function handleBackToSelector() {
    setStep('select');
    setSelectedId(null);
  }

  if (step === 'scenario' && selectedId !== null) {
    return (
      <ScenarioShell
        scenarioId={selectedId}
        onBack={handleBackToSelector}
        onEscalate={onEscalate}
      />
    );
  }

  return (
    <div className="cockpit-page">
      <div className="stepper-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="step-label">Story Toolbox</span>
      </div>
      <ScenarioSelector onSelect={handleSelectScenario} />
    </div>
  );
}
