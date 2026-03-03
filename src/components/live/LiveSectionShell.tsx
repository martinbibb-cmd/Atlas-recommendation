/**
 * LiveSectionShell — consistent wrapper for every live-output section.
 *
 * Renders the sticky VerdictStrip at the top, a section header with a
 * back button and title, then the section body.
 */
import type { ReactNode } from 'react';
import type { FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import VerdictStrip from './VerdictStrip';

interface Props {
  title: string;
  onBack: () => void;
  result: FullEngineResult | null;
  children: ReactNode;
}

export default function LiveSectionShell({ title, onBack, result, children }: Props) {
  return (
    <div className="live-section">
      <VerdictStrip result={result} />
      <div className="live-section__header">
        <button
          className="live-section__back-btn"
          onClick={onBack}
          aria-label="Back to hub"
        >
          ← Hub
        </button>
        <h2 className="live-section__title">{title}</h2>
      </div>
      <div className="live-section__body">{children}</div>
    </div>
  );
}
