/**
 * ModeToggle.tsx — Presentation Layer v1.
 *
 * Current ↔ Proposed toggle at the base of the StoryCanvas.
 *
 * When toggled:
 *   - timeline/events/colours in StoryCanvas update via parent state lift
 *   - 'current' → neutral/amber tone (showing existing issues)
 *   - 'proposed' → green tone (showing improvements)
 */

import type { PresentationMode } from './presentationTypes';
import './ModeToggle.css';

interface Props {
  mode: PresentationMode;
  onToggle: (mode: PresentationMode) => void;
}

export default function ModeToggle({ mode, onToggle }: Props) {
  return (
    <div className="mode-toggle" role="group" aria-label="View mode">
      <button
        className={`mode-toggle__btn mode-toggle__btn--current ${mode === 'current' ? 'mode-toggle__btn--active' : ''}`}
        onClick={() => onToggle('current')}
        aria-pressed={mode === 'current'}
      >
        Current
      </button>
      <span className="mode-toggle__arrow" aria-hidden="true">↔</span>
      <button
        className={`mode-toggle__btn mode-toggle__btn--proposed ${mode === 'proposed' ? 'mode-toggle__btn--active' : ''}`}
        onClick={() => onToggle('proposed')}
        aria-pressed={mode === 'proposed'}
      >
        Proposed
      </button>
    </div>
  );
}
