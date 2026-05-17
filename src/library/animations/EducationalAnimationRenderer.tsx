import { useMemo, useState } from 'react';
import { DiagramRenderer } from '../diagrams/DiagramRenderer';
import { getEducationalAnimationById } from './animationLookup';

export type EducationalAnimationRenderMode = 'digital' | 'print';

export interface EducationalAnimationRendererProps {
  animationId: string;
  mode?: EducationalAnimationRenderMode;
  prefersReducedMotion?: boolean;
}

function StaticFallback({
  diagramId,
  testId,
}: {
  diagramId: string;
  testId: string;
}) {
  return (
    <div data-testid={testId} data-print-safe="true">
      <DiagramRenderer diagramId={diagramId} printSafe reducedMotion />
    </div>
  );
}

export function EducationalAnimationRenderer({
  animationId,
  mode = 'digital',
  prefersReducedMotion = false,
}: EducationalAnimationRendererProps) {
  const animation = useMemo(() => getEducationalAnimationById(animationId), [animationId]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayTick, setReplayTick] = useState(0);

  if (!animation) {
    return null;
  }

  if (mode === 'print') {
    return (
      <section data-testid={`educational-animation-print-${animation.animationId}`}>
        <h3>{animation.title}</h3>
        <p>{animation.screenReaderSummary}</p>
        <StaticFallback
          diagramId={animation.printFallback}
          testId={`educational-animation-print-fallback-${animation.animationId}`}
        />
      </section>
    );
  }

  if (prefersReducedMotion) {
    return (
      <section data-testid={`educational-animation-reduced-motion-${animation.animationId}`}>
        <h3>{animation.title}</h3>
        <p>{animation.screenReaderSummary}</p>
        <StaticFallback
          diagramId={animation.reducedMotionFallback}
          testId={`educational-animation-reduced-motion-fallback-${animation.animationId}`}
        />
      </section>
    );
  }

  return (
    <section
      aria-label={`${animation.title} animation`}
      data-testid={`educational-animation-${animation.animationId}`}
      data-autoplay="false"
    >
      <h3>{animation.title}</h3>
      <p>{animation.screenReaderSummary}</p>
      <div aria-live="polite" data-replay-tick={replayTick}>
        {isPlaying
          ? `${animation.title} playing. ${animation.screenReaderSummary}`
          : `${animation.title} ready.`}
      </div>
      <div>
        <button
          type="button"
          onClick={() => setIsPlaying((value) => !value)}
          aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          onClick={() => {
            setReplayTick((value) => value + 1);
            setIsPlaying(true);
          }}
          aria-label="Replay animation"
        >
          Replay
        </button>
      </div>
    </section>
  );
}
