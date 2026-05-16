import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { DerivedFloorplanOutput } from '../../components/floorplan/floorplanDerivations';
import { runEngine } from '../../engine/Engine';
import UnifiedSimulatorView from '../../components/simulator/UnifiedSimulatorView';

interface VisitHomeUnifiedSimulatorRouteProps {
  readonly engineInput?: EngineInputV2_3;
  readonly surveyModel?: FullSurveyModelV1;
  readonly floorplanOutput?: DerivedFloorplanOutput;
  readonly onBack: () => void;
  readonly backLabel: string;
}

export function VisitHomeUnifiedSimulatorRoute({
  engineInput,
  surveyModel,
  floorplanOutput,
  onBack,
  backLabel,
}: VisitHomeUnifiedSimulatorRouteProps) {
  const engineOutput = useMemo(() => {
    if (engineInput == null) return undefined;
    try {
      return runEngine(engineInput).engineOutput;
    } catch (error) {
      console.warn('[VisitHome] Unified simulator route could not run engine', error);
      return undefined;
    }
  }, [engineInput]);

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }} data-testid="visit-home-unified-simulator-route">
      <div
        style={{
          padding: '0.5rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          borderBottom: '1px solid #e2e8f0',
          background: '#fff',
        }}
        data-testid="visit-home-unified-simulator-header"
      >
        <button
          className="back-btn"
          onClick={onBack}
          aria-label={`Back to ${backLabel}`}
          data-testid="visit-home-unified-simulator-back"
        >
          ← Back
        </button>
        <span
          style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}
          data-testid="visit-home-unified-simulator-workspace-marker"
        >
          Daily-use simulator — review workspace
        </span>
      </div>
      {engineInput != null && engineOutput != null ? (
        <UnifiedSimulatorView
          engineOutput={engineOutput}
          surveyData={surveyModel ?? engineInput}
          floorplanOutput={floorplanOutput}
        />
      ) : (
        <div style={{ padding: '0 1rem 1rem', color: '#475569' }}>
          Recommendation not available
        </div>
      )}
    </div>
  );
}
import { useMemo } from 'react';
